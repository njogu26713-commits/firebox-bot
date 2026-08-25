/**
 * Per-session bot API routes.
 * Mounted at /api/bot — requires a signed-in account while preserving per-browser session isolation.
 * Each browser session (cookie) maps to one BotInstance.
 */
const express = require("express");
const QRCode = require("qrcode");
const botManager = require("./botManager");
const serverRegistry = require("./serverRegistry");
const { isPanelProxy, matchesSecret } = require("./panelProxyAuth");
const { requireAdmin } = require("./adminAuth");
const usageRegistry = require("./usageRegistry");

const router = express.Router();
router.use(express.json());
router.post("/hub-sync", async (req, res) => {
    if (!matchesSecret(req.get("X-Firebox-Sync-Key"), process.env.FIREBOX_PANEL_SYNC_SECRET)) return res.status(401).json({ error: "Invalid panel sync key." });
    try {
        const bot = await serverRegistry.upsertByBotId({ name: req.body.name, hubUrl: req.body.hubUrl, botId: req.body.botId, botKey: req.body.botKey, publicUrl: req.body.publicUrl });
        return res.json({ synced: true, bot });
    } catch (error) { return res.status(400).json({ error: error.message }); }
});
router.use((req, res, next) => {
    if (req.session.accountId || isPanelProxy(req)) return next();
    return res.status(401).json({ error: "Sign in required." });
});

// Use the express-session ID as the user/bot identifier
function userId(req) {
    return req.session.id;
}

// ── Status ────────────────────────────────────────────────────────────────────

router.get("/status", (req, res) => {
    const inst = botManager.instances.get(userId(req));
    if (!inst) return res.json({ status: "offline", myJid: null, hasQr: false });
    res.json({
        status: inst.status,
        myJid: inst.myJid,
        hasQr: !!inst.latestQr,
    });
});

// ── Start bot ─────────────────────────────────────────────────────────────────

router.post("/start", async (req, res) => {
    try {
        await botManager.start(userId(req));
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Stop / disconnect ─────────────────────────────────────────────────────────

router.post("/stop", (req, res) => {
    botManager.stop(userId(req));
    res.json({ ok: true });
});

// ── QR code ───────────────────────────────────────────────────────────────────

router.get("/qr", async (req, res) => {
    const inst = botManager.instances.get(userId(req));
    if (!inst || !inst.latestQr) {
        return res.status(404).json({ error: "No QR available yet." });
    }
    try {
        const dataUrl = await QRCode.toDataURL(inst.latestQr, { width: 300, margin: 2 });
        res.json({ qr: dataUrl });
    } catch (e) {
        res.status(500).json({ error: "Failed to generate QR: " + e.message });
    }
});

// ── Pairing code ──────────────────────────────────────────────────────────────

router.post("/pair-code", async (req, res) => {
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ error: "Phone number is required." });

    const clean = String(phone).replace(/\D/g, "");
    if (clean.length < 7 || clean.length > 15) {
        return res.status(400).json({ error: "Invalid phone number. Include country code, digits only." });
    }

    const inst = botManager.get(userId(req));
    if (inst.status === "online") {
        return res.status(409).json({ error: "Already connected. Disconnect first." });
    }
    if (inst.status === "offline" && !inst.isReconnecting) {
        inst.start().catch(() => {});
    }

    try {
        const code = await inst.triggerPairingRestart(clean);
        res.json({ ok: true, code });
    } catch (err) {
        res.status(500).json({ error: err.message || "Failed to generate pairing code." });
    }
});

// ── Session ID ────────────────────────────────────────────────────────────────

router.get("/session-id", (req, res) => {
    const inst = botManager.instances.get(userId(req));
    if (!inst) return res.status(404).json({ error: "Bot not started." });
    const sid = inst.getSessionId();
    if (!sid) return res.status(404).json({ error: "No session yet. Connect WhatsApp first." });
    res.json({ sessionId: sid });
});

router.post("/restore-session", (req, res) => {
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: "sessionId is required." });
    const inst = botManager.get(userId(req));
    try {
        inst.restoreSessionId(sessionId);
        inst.sessionId = sessionId;
        res.json({ ok: true });
        if (inst.status === "offline" && !inst.isReconnecting) inst.start().catch(() => {});
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// ── Wipe session ──────────────────────────────────────────────────────────────

router.post("/wipe-session", (req, res) => {
    const inst = botManager.get(userId(req));
    inst.stop();
    inst.wipeSession();
    res.json({ ok: true });
});

// ── Settings ──────────────────────────────────────────────────────────────────

router.get("/settings", (req, res) => {
    const inst = botManager.get(userId(req));
    const s = inst.settingsManager.get();
    res.json(s.dataValues || s);
});

router.post("/settings", async (req, res) => {
    try {
        const inst = botManager.get(userId(req));
        const updated = await inst.settingsManager.update(req.body);
        res.json({ ok: true, settings: updated.dataValues || updated });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function selectedServer(req) {
    const id = req.session.selectedServerId;
    return id ? serverRegistry.get(id) : null;
}

function remoteCookieKey(serverId) { return `remoteCookie_${serverId}`; }

async function remoteRequest(req, server, route, options = {}) {
    const headers = { "Content-Type": "application/json", "X-Firebox-Panel-Proxy": "1", "X-Firebox-Panel-Key": server.botKey, ...(options.headers || {}) };
    const cookie = req.session[remoteCookieKey(server.id)];
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(`${server.publicUrl}${route}`, { ...options, headers, redirect: "manual" });
    const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    if (setCookies.length) req.session[remoteCookieKey(server.id)] = setCookies.map(value => value.split(";", 1)[0]).join("; ");
    const body = await response.json().catch(() => ({}));
    return { response, body };
}

// Public server discovery: credentials are never returned.
router.get("/servers", async (_req, res) => { try { res.json({ servers: await serverRegistry.list() }); } catch (error) { res.status(503).json({ error: error.message }); } });

// Intentionally unauthenticated for now; secure this route before public production use.
router.post("/servers", requireAdmin, async (req, res) => {
    try {
        res.status(201).json({ server: await serverRegistry.add(req.body || {}) });
    } catch (error) { res.status(400).json({ error: error.message }); }
});

router.delete("/servers/:id", requireAdmin, async (req, res) => {
    res.json({ ok: await serverRegistry.remove(req.params.id) });
});

router.post("/servers/:id/select", async (req, res) => {
    if (!await serverRegistry.get(req.params.id)) return res.status(404).json({ error: "Server not found." });
    req.session.selectedServerId = req.params.id;
    await usageRegistry.touch({ userId: req.session.accountId, email: req.session.accountUser?.email, serverId: req.params.id });
    res.json({ ok: true, server: { id: req.params.id } });
});

router.get("/servers/:id/status", async (req, res) => {
    const server = await serverRegistry.get(req.params.id);
    if (!server) return res.status(404).json({ error: "Server not found." });
    try {
        const { response, body } = await remoteRequest(req, server, "/api/bot/status");
        if (body.error === "Sign in required.") { body.code = "REMOTE_PROXY_AUTH_REQUIRED"; body.error = "Remote bot rejected the panel bridge. Redeploy that bot from the latest Firebox Bot code and set FIREBOX_BOT_KEY to the same key saved for this server."; }
        if (!response.ok && !body.error) body.error = `Remote bot returned HTTP ${response.status}. Confirm its public URL and redeploy the latest Firebox Bot code.`;
        res.status(response.status).json(body);
    } catch (error) { res.status(502).json({ error: `Selected server unavailable: ${error.message}. Confirm the remote bot URL is reachable.` }); }
});

router.post("/servers/:id/pair-code", async (req, res) => {
    const server = await serverRegistry.get(req.params.id);
    if (server) await usageRegistry.touch({ userId: req.session.accountId, email: req.session.accountUser?.email, serverId: req.params.id });
    if (!server) return res.status(404).json({ error: "Server not found." });
    try {
        const { response, body } = await remoteRequest(req, server, "/api/bot/pair-code", { method: "POST", body: JSON.stringify({ phone: req.body && req.body.phone }) });
        if (body.error === "Sign in required.") { body.code = "REMOTE_PROXY_AUTH_REQUIRED"; body.error = "Remote bot rejected the panel bridge. Redeploy that bot from the latest Firebox Bot code and set FIREBOX_BOT_KEY to the same key saved for this server."; }
        res.status(response.status).json(body);
    } catch (error) { res.status(502).json({ error: `Selected server unavailable: ${error.message}` }); }
});

module.exports = router;
