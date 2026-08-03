/**
 * Per-session bot API routes.
 * Mounted at /api/bot — no login required.
 * Each browser session (cookie) maps to one BotInstance.
 */
const express = require("express");
const QRCode = require("qrcode");
const botManager = require("./botManager");

const router = express.Router();
router.use(express.json());

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

module.exports = router;
