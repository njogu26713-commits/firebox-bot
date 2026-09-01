/**
 * BotInstance — one WhatsApp connection per SaaS user.
 *
 * Extracts the connectionLogic from index.js and scopes all state
 * (sock, latestQr, myJid, settings, jsonStore) to the instance.
 * Message processing runs inside AsyncLocalStorage.run() so that
 * getSettings() and jsonStore in commands transparently use this
 * user's data without any code changes to command files.
 */

const path = require("path");
const fs = require("fs");
const zlib = require("zlib");

const { DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const makeWASocket = require("@whiskeysockets/baileys").default;
const QRCode = require("qrcode");
const NodeCache = require("node-cache");
const P = require("pino");

const { handleMessages } = require("../lib/commandHandler");
const { handleAutomation, handleMessageDelete } = require("../lib/automation");
const botContext = require("../lib/botContext");
const { createUserStore } = require("../firebox/jsonStore");
const SettingsManager = require("./settingsManager");
const { version: botVersion } = require("../config");

class BotInstance {
    constructor(userId, options = {}) {
        this.userId = userId;
        this.sessionDir = path.join(__dirname, `../sessions/${userId}`);
        this.store = createUserStore(userId);
        this.settingsManager = new SettingsManager(this.store);

        // Runtime state
        this.sock = null;
        this.latestQr = null;
        this.myJid = null;
        this.botStartTime = null;
        this.status = "offline"; // offline | connecting | online
        this.isReconnecting = false;
        this.isStopping = false;
        this.consecutiveFailures = 0;
        this.hasWipedSessionOnStartup = false;

        // Timers
        this.alwaysOnlineInterval = null;
        this.healthCheckInterval = null;

        // Pairing
        this.pairingCodeResolve = null;
        this.pairingCodeReject = null;
        this.pairingRestartInProgress = false;
        this.pairingCodeRequested = false;
        this.pendingPairingNumber = null;
        this.sessionIdFailed = false;
        this.sessionIdInvalid = false;

        // Newsletter
        this.newsletterJid = "120363428521307680@newsletter";
        this.newsletterName = "Firebox Bot Updates";

        // User's WhatsApp number (for pairing)
        this.sessionId = options.sessionId || null;
    }

    // ── Context runner ─────────────────────────────────────────────────────────

    _runInContext(fn) {
        const ctx = {
            store: this.store,
            settingsCache: this.settingsManager.get(),
            settingsManager: this.settingsManager,
            myJid: this.myJid,
        };
        return botContext.run(ctx, fn);
    }

    // ── Start ──────────────────────────────────────────────────────────────────

    async start() {
        this.isStopping = false;
        if (!fs.existsSync(this.sessionDir)) {
            fs.mkdirSync(this.sessionDir, { recursive: true });
        }
        await this.settingsManager.load();
        await this._connectionLogic();
    }

    // ── Stop ───────────────────────────────────────────────────────────────────

    stop() {
        this.isStopping = true;
        this.isReconnecting = false;
        this._clearTimers();
        if (this.sock) {
            try { this.sock.end(new Error("BotInstance stopped")); } catch (_) {}
            this.sock = null;
        }
        this.status = "offline";
        this.latestQr = null;
        this.myJid = null;
    }

    // ── Pairing trigger (called from API route) ────────────────────────────────

    triggerPairingRestart(phone) {
        return new Promise((resolve, reject) => {
            this.pairingCodeResolve = resolve;
            this.pairingCodeReject = reject;

            const timer = setTimeout(() => {
                if (this.pairingCodeResolve === resolve) {
                    this.pairingCodeResolve = null;
                    this.pairingCodeReject = null;
                    reject(new Error("Timed out waiting for pairing code (25s)."));
                }
            }, 25000);
            if (timer.unref) timer.unref();

            this.pendingPairingNumber = phone;
            this.pairingCodeRequested = false;
            this.sessionId = null;
            this.sessionIdFailed = false;

            // Wipe stale session
            try {
                if (fs.existsSync(this.sessionDir)) {
                    fs.readdirSync(this.sessionDir).forEach(f => {
                        try { fs.unlinkSync(path.join(this.sessionDir, f)); } catch (_) {}
                    });
                }
            } catch (_) {}

            this.pairingRestartInProgress = true;

            if (this.sock) {
                const oldSock = this.sock;
                try { oldSock.end(new Error("Pairing restart")); } catch (_) {}
                this.sock = null;
            } else {
                setTimeout(() => this._connectionLogic(), 100);
            }
        });
    }

    wipeSession() {
        try {
            if (fs.existsSync(this.sessionDir)) {
                fs.readdirSync(this.sessionDir).forEach(f => {
                    try { fs.unlinkSync(path.join(this.sessionDir, f)); } catch (_) {}
                });
            }
        } catch (e) {
            console.error(`[${this.userId}] wipeSession error:`, e.message);
        }
    }

    getSessionId() {
        const credsPath = path.join(this.sessionDir, "creds.json");
        if (!fs.existsSync(credsPath) || fs.statSync(credsPath).size < 10) return null;
        const creds = fs.readFileSync(credsPath, "utf-8");
        return "FIREBOX~" + Buffer.from(creds).toString("base64");
    }

    restoreSessionId(sessionId) {
        const rawId = sessionId.trim();
        const encoded = rawId.includes("~") ? rawId.split("~")[1] : rawId;
        const buffer = Buffer.from(encoded, "base64");

        const decodeBuffer = (buf) => {
            try { return zlib.gunzipSync(buf).toString("utf-8"); } catch (_) {
                try { return zlib.inflateSync(buf).toString("utf-8"); } catch (_) {
                    return buf.toString("utf-8");
                }
            }
        };

        let credsJson = decodeBuffer(buffer);
        if (!credsJson.includes("{") && /^[a-zA-Z0-9+/=]+$/.test(credsJson.trim())) {
            credsJson = decodeBuffer(Buffer.from(credsJson.trim(), "base64"));
        }

        let finalJson = null;
        for (let i = 0; i < credsJson.length; i++) {
            if (credsJson[i] === "{") {
                try {
                    const candidate = credsJson.substring(i, credsJson.lastIndexOf("}") + 1);
                    if (candidate.includes("noiseKey") || candidate.includes("creds")) {
                        JSON.parse(candidate);
                        finalJson = candidate;
                        break;
                    }
                } catch (_) {}
            }
        }

        if (!finalJson) throw new Error("Could not find valid credentials in that Session ID.");

        const parsed = JSON.parse(finalJson);
        const creds = parsed.creds || (parsed.noiseKey ? parsed : null);
        if (!creds) throw new Error("No credentials found inside Session ID.");

        creds.registered = true;
        if (!fs.existsSync(this.sessionDir)) fs.mkdirSync(this.sessionDir, { recursive: true });
        fs.writeFileSync(path.join(this.sessionDir, "creds.json"), JSON.stringify(creds));
    }

    // ── Core connection logic ─────────────────────────────────────────────────

    async _connectionLogic() {
        if (this.isStopping || this.isReconnecting) return;
        this.isReconnecting = true;
        this.status = "connecting";

        // SESSION_ID restore
        if (this.sessionId && !this.sessionIdInvalid) {
            const credsPath = path.join(this.sessionDir, "creds.json");
            const sessionExists = fs.existsSync(credsPath) && fs.statSync(credsPath).size > 10;
            if (!sessionExists) {
                console.log(`[${this.userId}] Restoring session from SESSION_ID...`);
                try {
                    this.restoreSessionId(this.sessionId);
                    console.log(`[${this.userId}] ✅ Session restored.`);
                } catch (e) {
                    console.error(`[${this.userId}] ❌ Session restore failed:`, e.message);
                }
            }
        }

        let { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);

        // Fresh login cleanup
        if (!this.hasWipedSessionOnStartup && !state.creds.registered && !this.sessionId) {
            this.hasWipedSessionOnStartup = true;
            try {
                if (fs.existsSync(this.sessionDir)) {
                    fs.readdirSync(this.sessionDir).forEach(file => {
                        try { fs.unlinkSync(path.join(this.sessionDir, file)); } catch (_) {}
                    });
                }
                const freshState = await useMultiFileAuthState(this.sessionDir);
                state = freshState.state;
                saveCreds = freshState.saveCreds;
            } catch (e) {
                console.error(`[${this.userId}] ⚠️ Failed to clean session folder:`, e.message);
            }
        }

        const usePairingCode = !!this.pendingPairingNumber && !state.creds.registered;

        const msgRetryCounterCache = new NodeCache();
        const logger = P({ level: "silent" });

        let version = [2, 3000, 1017531287];
        try {
            const { version: latestVer } = await fetchLatestBaileysVersion();
            version = latestVer;
        } catch (_) {}

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            logger,
            version,
            markOnline: true,
            browser: Browsers.ubuntu("Chrome"),
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            syncFullHistory: false,
            shouldSyncHistoryMessage: () => false,
            linkPreviewHighQuality: false,
            generateHighQualityLinkPreview: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            getMessage: async (key) => {
                try {
                    const { getMessage: getMsg } = require("../firebox/messageModel");
                    const msg = await getMsg(key.id);
                    return msg ? msg.content : undefined;
                } catch (_) { return undefined; }
            }
        });

        this.sock = sock;
        // Attach instance-level trackers to sock for commandHandler/automation
        sock.myJid = this.myJid;
        sock.stormTracker = {};
        sock.presenceTracker = {};
        sock.alwaysOnlineTracker = 0;
        sock.spamTracker = {};
        sock.newsletterJid = this.newsletterJid;
        sock.newsletterName = this.newsletterName;

        // Wrap sendMessage for "View Channel" label
        const originalSendMessage = sock.sendMessage.bind(sock);
        sock.sendMessage = async (jid, content, options = {}) => {
            const settings = this.settingsManager.get();
            if (!settings.hideViewChannel && this.newsletterJid) {
                if (content && typeof content === "object" && !content.delete && !content.react) {
                    if (!content.contextInfo) content.contextInfo = {};
                    if (!content.contextInfo.forwardedNewsletterMessageInfo) {
                        content.contextInfo.forwardingScore = 999;
                        content.contextInfo.isForwarded = true;
                        content.contextInfo.forwardedNewsletterMessageInfo = {
                            newsletterJid: this.newsletterJid,
                            newsletterName: this.newsletterName,
                            serverMessageId: 1
                        };
                    }
                }
            }
            return await originalSendMessage(jid, content, options);
        };

        // SESSION_ID watchdog
        if (this.sessionId && !this.sessionIdInvalid) {
            const wdTimer = setTimeout(() => {
                if (!sock.user) {
                    console.log(`[${this.userId}] ⚠️ Session ID failed to connect within 30s. Enabling QR fallback.`);
                    this.sessionIdFailed = true;
                }
            }, 30000);
            if (wdTimer.unref) wdTimer.unref();
        }

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) this.latestQr = qr;

            // Trigger pairing code on the QR event — this is when WhatsApp signals
            // the connection is ready, ensuring the code is cryptographically valid.
            if (qr && usePairingCode && this.pendingPairingNumber && !this.pairingCodeRequested) {
                this.pairingCodeRequested = true;
                try {
                    // WhatsApp may emit the first QR while the replacement socket is
                    // still completing its handshake. Give the socket a short settle
                    // window and reject stale-socket results after a restart.
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    if (this.sock !== sock || !this.pendingPairingNumber) throw new Error("Pairing socket was replaced; retry the request.");
                    const pNum = this.pendingPairingNumber.replace(/[^0-9]/g, "");
                    if (!/^\d{7,15}$/.test(pNum)) throw new Error("Invalid phone number for WhatsApp pairing.");
                    const code = await sock.requestPairingCode(pNum);
                    console.log(`[${this.userId}] 🔗 Pairing code: ${code}`);
                    if (this.pairingCodeResolve) {
                        this.pairingCodeResolve(code);
                        this.pairingCodeResolve = null;
                        this.pairingCodeReject = null;
                    }
                    this.pendingPairingNumber = null;
                } catch (err) {
                    console.error(`[${this.userId}] ❌ Pairing code error:`, err.message);
                    if (this.pairingCodeReject) {
                        this.pairingCodeReject(err);
                        this.pairingCodeResolve = null;
                        this.pairingCodeReject = null;
                    }
                    this.pairingCodeRequested = false;
                }
            }

            if (qr && (!this.sessionId || this.sessionIdFailed) && !usePairingCode) {
                console.log(`[${this.userId}] 📱 QR code available`);
            }

            if (connection === "open") {
                this.latestQr = null;
                this.isReconnecting = false;
                this.consecutiveFailures = 0;
                this.status = "online";
                this.botStartTime = Math.floor(Date.now() / 1000);
                console.log(`[${this.userId}] ✅ Bot connected!`);

                // Init DB
                try {
                    const { initDb } = require("../firebox/db");
                    await initDb();
                } catch (_) {}

                // Load settings
                await this._runInContext(async () => {
                    await this.settingsManager.load();
                });

                const settings = this.settingsManager.get();

                if (settings.alwaysOnline) {
                    await sock.sendPresenceUpdate("available").catch(() => {});
                }

                if (this.alwaysOnlineInterval) clearInterval(this.alwaysOnlineInterval);
                this.alwaysOnlineInterval = setInterval(async () => {
                    const s = this.settingsManager.get();
                    if (s.alwaysOnline) await sock.sendPresenceUpdate("available").catch(() => {});
                }, 15000);

                // Resolve newsletter JID
                try {
                    const metadata = await sock.newsletterMetadata("invite", "0029Vb8elJp77qVJlCeiNX26").catch(() => null);
                    if (metadata && metadata.id) {
                        this.newsletterJid = metadata.id;
                        this.newsletterName = metadata.subject || "Firebox Bot Updates";
                        sock.newsletterJid = this.newsletterJid;
                        sock.newsletterName = this.newsletterName;
                    }
                } catch (_) {}

                // Set myJid
                const myJid = (sock.user && sock.user.id) || "";
                const cleanJid = myJid.split(":")[0];
                const domain = myJid.includes("@lid") ? "@lid" : "@s.whatsapp.net";
                this.myJid = cleanJid ? cleanJid + domain : "";
                sock.myJid = this.myJid;
                console.log(`[${this.userId}] 📊 Connected as ${this.myJid}`);

                // Health watchdog
                if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = setInterval(async () => {
                    try {
                        const wsOpen = sock && sock.ws && (
                            sock.ws.isOpen === true ||
                            sock.ws.readyState === 1 ||
                            (sock.ws.socket && sock.ws.socket.readyState === 1)
                        );
                        if (wsOpen) {
                            await Promise.race([
                                sock.fetchBlocklist().catch(() => null),
                                new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000))
                            ]);
                        } else {
                            throw new Error("WebSocket not open");
                        }
                    } catch (err) {
                        console.error(`[${this.userId}] ⚠️ Watchdog failed:`, err.message);
                        this._clearTimers();
                        try { sock.end(); } catch (_) {}
                        this.status = "offline";
                        this.isReconnecting = false;
                        if (!this.isStopping) setTimeout(() => this._connectionLogic(), 5000);
                    }
                }, 3 * 60 * 1000);
            }

            if (connection === "close") {
                this.isReconnecting = false;
                if (this.isStopping) return;
                this.status = "offline";
                this._clearTimers();

                if (this.pairingRestartInProgress) {
                    this.pairingRestartInProgress = false;
                    if (!this.isStopping) setTimeout(() => this._connectionLogic(), 2000);
                    return;
                }

                const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
                console.log(`[${this.userId}] 🔌 Disconnected. Status: ${statusCode}`);

                const isNetworkError =
                    lastDisconnect?.error?.code === "ENOTFOUND" ||
                    lastDisconnect?.error?.code === "EAI_AGAIN" ||
                    lastDisconnect?.error?.code === "ECONNREFUSED" ||
                    lastDisconnect?.error?.code === "ETIMEDOUT" ||
                    lastDisconnect?.error?.code === "ECONNRESET" ||
                    statusCode === DisconnectReason.connectionLost ||
                    statusCode === DisconnectReason.connectionClosed ||
                    statusCode === DisconnectReason.timedOut;

                if (!isNetworkError) this.consecutiveFailures++;

                if (statusCode === DisconnectReason.loggedOut || this.consecutiveFailures >= 5) {
                    this.consecutiveFailures = 0;
                    this.hasWipedSessionOnStartup = false;
                    if (this.sessionId) {
                        this.sessionIdInvalid = true;
                        this.sessionId = null;
                    }
                    this.wipeSession();
                    if (!this.isStopping) setTimeout(() => this._connectionLogic(), 10000);
                } else {
                    const delay = 10000;
                    if (!this.isStopping) setTimeout(() => this._connectionLogic(), delay);
                }
            }
        });

        // Message events — wrap in per-user context
        sock.ev.on("messages.upsert", async (upsert) => {
            if (upsert.type !== "notify") return;
            const m = upsert.messages[0];
            if (!m.message) return;

            const msgTime = m.messageTimestamp ? Number(m.messageTimestamp) : 0;
            if (this.botStartTime && msgTime < this.botStartTime) return;

            this._runInContext(() => {
                handleAutomation(sock, m).catch(err => console.error(`[${this.userId}] Automation error:`, err));
                handleMessages(sock, upsert);
            });
        });

        sock.ev.on("messages.update", async (update) => {
            this._runInContext(() => handleMessageDelete(sock, update));
        });

        sock.ev.on("call", async (calls) => {
            const settings = this.settingsManager.get();
            if (settings.antiCall) {
                for (const call of calls) {
                    if (call.status === "offer") {
                        await sock.rejectCall(call.id, call.from).catch(() => {});
                    }
                }
            }
        });

        sock.ev.on("group-participants.update", async (update) => {
            try {
                const { id, participants, action } = update;
                const settings = this.settingsManager.get();

                const localMode = this.store.get(`events_mode_${id}`, null);
                const isActive = localMode !== null ? (localMode === "on") : settings.groupEventsGlobal;
                if (!isActive) return;

                const metadata = await sock.groupMetadata(id).catch(() => null);
                if (!metadata) return;

                const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
                const groupName = metadata.subject || "";
                const memberCount = metadata.participants?.length || 0;

                for (const participant of participants) {
                    const userMention = `@${participant.split("@")[0]}`;
                    if (action === "add") {
                        const msgTemplate = this.store.get(`welcome_msg_${id}`, null) || settings.welcomeMsg;
                        const msg = msgTemplate.replace(/@user/g, userMention).replace(/@group/g, groupName).replace(/{count}/g, memberCount);
                        await sock.sendMessage(id, { text: msg, mentions: [participant] }).catch(() => {});
                    } else if (action === "remove") {
                        const msgTemplate = this.store.get(`goodbye_msg_${id}`, null) || settings.goodbyeMsg;
                        const msg = msgTemplate.replace(/@user/g, userMention).replace(/@group/g, groupName);
                        await sock.sendMessage(id, { text: msg, mentions: [participant] }).catch(() => {});
                    }
                }
            } catch (err) {
                console.error(`[${this.userId}] group-participants error:`, err.message);
            }
        });
    }

    _clearTimers() {
        if (this.alwaysOnlineInterval) { clearInterval(this.alwaysOnlineInterval); this.alwaysOnlineInterval = null; }
        if (this.healthCheckInterval) { clearInterval(this.healthCheckInterval); this.healthCheckInterval = null; }
    }
}

module.exports = BotInstance;
