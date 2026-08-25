const crypto = require("crypto");

const hubUrl = String(process.env.FIREBOX_HUB_URL || "").replace(/\/$/, "");
const botId = process.env.FIREBOX_BOT_ID;
const botKey = process.env.FIREBOX_BOT_KEY;
const workspaceUrl = process.env.FIREBOX_PUBLIC_URL || process.env.PUBLIC_URL || "";
const botName = process.env.FIREBOX_BOT_NAME || botId || "Firebox Bot";

const enabled = Boolean(hubUrl && botId && botKey);
let warned = false;

async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
        const response = await fetch(`${hubUrl}${path}`, {
            ...options,
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                "X-Firebox-Bot-Id": botId,
                "X-Firebox-Bot-Key": botKey,
                ...(options.headers || {}),
            },
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `Hub returned ${response.status}`);
        return body;
    } finally {
        clearTimeout(timer);
    }
}

async function register() {
    if (!enabled) {
        if (!warned && (process.env.FIREBOX_HUB_URL || process.env.FIREBOX_BOT_ID || process.env.FIREBOX_BOT_KEY)) {
            warned = true;
            console.warn("[FireboxHub] Incomplete hub configuration; expected FIREBOX_HUB_URL, FIREBOX_BOT_ID, and FIREBOX_BOT_KEY.");
        }
        return null;
    }
    return request("/api/register", {
        method: "POST",
        body: JSON.stringify({ name: botName, workspaceUrl }),
    });
}

async function sendEvent(type, data = {}) {
    if (!enabled) return null;
    const eventId = crypto.randomUUID();
    return request(`/api/ingest/${encodeURIComponent(botId)}`, {
        method: "POST",
        headers: { "X-Firebox-Event-Id": eventId },
        body: JSON.stringify({ type, data }),
    });
}

function start() {
    if (!enabled) return;
    register()
        .then(() => sendEvent("bot.status", { status: "service_online" }))
        .catch(error => console.warn(`[FireboxHub] Registration failed: ${error.message}`));
}

module.exports = { enabled, register, sendEvent, start };
