/**
 * Firebox Bot — SaaS Server
 *
 * The original Firebox Bot browser session remains available for bot setup.
 * The optional server registry uses a separate password-authenticated account
 * stored in the existing local application database directory.
 */

const path = require("path");
const fireboxWebhook = require("./saas/fireboxWebhook");
const { isAdminAccount } = require("./saas/adminAuth");

// ── Log noise filter ──────────────────────────────────────────────────────────
const _origError = console.error.bind(console);
const _origLog   = console.log.bind(console);

const CLEAN_SIGNAL_ERRORS = [
    { match: "Bad MAC",                                           msg: "⚠️  [Signal] Corrupt session key — will auto-refresh." },
    { match: "No matching sessions found",                        msg: "⚠️  [Signal] No session found — awaiting key exchange." },
    { match: "No session found to decrypt",                       msg: "⚠️  [Signal] Missing sender key — will resolve automatically." },
    { match: "Failed to decrypt message with any known session",  msg: "⚠️  [Signal] All session keys failed." },
    { match: "Closing open session in favor of incoming prekey",  msg: "ℹ️  [Signal] Re-keying session." },
    { match: "Closing session:",                                   msg: "ℹ️  [Signal] Closing stale session." },
    { match: "Decrypted message with closed session",             msg: "ℹ️  [Signal] Decrypted via closed session (harmless)." },
    { match: "transaction failed, rolling back",                  msg: "⚠️  [Signal] Transaction rollback (non-fatal)." },
    { match: "_chains",         msg: null },
    { match: "registrationId",  msg: null },
    { match: "currentRatchet",  msg: null },
    { match: "pendingPreKey",   msg: null },
    { match: "indexInfo",       msg: null },
    { match: "baseKeyType",     msg: null },
    { match: "ephemeralKeyPair",msg: null },
];

const _logCooldowns = new Map();
const COOLDOWN_MS = 30_000;

function interceptLog(originalFn, args) {
    const raw = String(args[0] ?? "");
    for (const { match, msg } of CLEAN_SIGNAL_ERRORS) {
        if (raw.includes(match)) {
            if (msg === null) return;
            const now = Date.now();
            if (now - (_logCooldowns.get(match) || 0) >= COOLDOWN_MS) {
                _logCooldowns.set(match, now);
                _origLog(msg);
            }
            return;
        }
    }
    originalFn(...args);
}

console.error = (...args) => interceptLog(_origError, args);
console.log   = (...args) => interceptLog(_origLog,   args);

process.on("unhandledRejection", (reason) => _origError("⚠️ Unhandled Rejection:", reason));
process.on("uncaughtException",  (error)  => _origError("⚠️ Uncaught Exception:", error));

// ── Express ───────────────────────────────────────────────────────────────────
const express = require("express");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || require("crypto").randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,   // 30 days
    },
}));

// ── Static files ──────────────────────────────────────────────────────────────
// Disable Express's automatic index.html fallback so `/` always opens the
// public visitor-specific Server 1 bot workspace.
app.use(express.static(path.join(__dirname, "public"), { index: false }));

// ── Bot API (/api/bot/*) ──────────────────────────────────────────────────────
app.use("/api/auth", require("./saas/authApiRoutes"));
app.use("/api/admin", require("./saas/adminApiRoutes"));
app.use("/api/bot", require("./saas/userApiRoutes"));

// ── Pages ─────────────────────────────────────────────────────────────────────

const serverWorkspace = path.join(__dirname, "public", "servers.html");
const adminWorkspace = path.join(__dirname, "public", "admin.html");
const authWorkspace = path.join(__dirname, "public", "auth.html");
const settingsWorkspace = path.join(__dirname, "public", "settings.html");

// Every visitor gets the current bot workspace. express-session provides the
// per-browser identity consumed by /api/bot, so different visitors cannot
// share the same in-memory BotInstance.
app.get("/", (req, res) => res.sendFile(req.session.accountId ? serverWorkspace : authWorkspace));
app.get("/admin", (req, res) => { if (!req.session.accountId) return res.sendFile(authWorkspace); if (!isAdminAccount(req)) return res.status(403).send("Administrator access required."); return res.sendFile(adminWorkspace); });
app.get("/auth", (_req, res) => res.sendFile(authWorkspace));
app.get("/settings", (req, res) => res.sendFile(req.session.accountId ? settingsWorkspace : authWorkspace));

app.get("/connect", (_req, res) => res.redirect("/"));

app.get("/dashboard", (req, res) => res.sendFile(req.session.accountId ? serverWorkspace : authWorkspace));

// The old dashboard and sign-in routes are intentionally retired. Keep
// redirects for bookmarked links so users land in the public workspace.
app.get("/bot-dashboard", (_req, res) => res.redirect("/"));
app.get("/login", (_req, res) => res.sendFile(authWorkspace));
app.get("/servers", (req, res) => res.sendFile(req.session.accountId ? serverWorkspace : authWorkspace));

// Legacy redirect
app.get("/pair", (_req, res) => res.redirect("/"));

app.get("/health", (req, res) => res.send("🤖 Firebox Bot SaaS is Online!"));

// ── Listen ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🌍 Firebox Bot SaaS listening on port ${PORT}`);
    fireboxWebhook.start();
});
