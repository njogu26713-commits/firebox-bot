/**
 * Firebox Bot — SaaS Server
 *
 * The original Firebox Bot browser session remains available for bot setup.
 * The optional server registry uses a separate password-authenticated account
 * stored in the existing local application database directory.
 */

const path = require("path");

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
app.use(express.static(path.join(__dirname, "public")));

// ── Bot API (/api/bot/*) ──────────────────────────────────────────────────────
app.use("/api/bot", require("./saas/userApiRoutes"));
app.use("/api/dashboard", require("./saas/dashboardRoutes").router);

// ── Pages ─────────────────────────────────────────────────────────────────────

app.get("/", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "index.html")));

app.get("/connect", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "connect.html")));

app.get("/dashboard", require("./saas/dashboardRoutes").requireDashboardAuth, (req, res) =>
    res.sendFile(path.join(__dirname, "public", "servers.html")));

app.get("/bot-dashboard", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "dashboard.html")));

app.get("/login", (req, res) =>
    res.sendFile(path.join(__dirname, "public", "login.html")));

app.get("/servers", require("./saas/dashboardRoutes").requireDashboardAuth, (req, res) =>
    res.sendFile(path.join(__dirname, "public", "servers.html")));

// Legacy redirect
app.get("/pair", (req, res) => res.redirect("/connect"));

app.get("/health", (req, res) => res.send("🤖 Firebox Bot SaaS is Online!"));

// ── Listen ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🌍 Firebox Bot SaaS listening on port ${PORT}`);
});
