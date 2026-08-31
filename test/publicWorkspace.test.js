const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const indexSource = fs.readFileSync(path.join(__dirname, "../index.js"), "utf8");
const workspaceSource = fs.readFileSync(path.join(__dirname, "../public/servers.html"), "utf8");
const adminSource = fs.readFileSync(path.join(__dirname, "../public/admin.html"), "utf8");
const adminAccessSource = fs.readFileSync(path.join(__dirname, "../public/admin-access.html"), "utf8");
const commandHandlerSource = fs.readFileSync(path.join(__dirname, "../lib/commandHandler.js"), "utf8");
const devCommandSource = fs.readFileSync(path.join(__dirname, "../commands/general/dev.js"), "utf8");
const ownerCommandSource = fs.readFileSync(path.join(__dirname, "../commands/general/owner.js"), "utf8");

test("the public entry point separates reusable token and pairing-code pages", () => {
    assert.match(indexSource, /app\.get\("\/", \(_req, res\) => res\.redirect\("\/token"\)\)/);
    assert.match(indexSource, /app\.get\("\/token", \(_req, res\) => res\.sendFile\(tokenWorkspace\)\)/);
    assert.match(indexSource, /app\.get\("\/code", \(_req, res\) => res\.sendFile\(codeWorkspace\)\)/);
    assert.match(indexSource, /app\.use\("\/api\/auth", require\("\.\/saas\/authApiRoutes"\)\)/);
    assert.match(indexSource, /app\.get\("\/admin", \(req, res\) => \{ if \(!req\.session\.accountId\) return res\.sendFile\(adminAccessWorkspace\); if \(!isAdminAccount\(req\)\) return res\.status\(403\)/);
    assert.match(indexSource, /app\.get\("\/bot-dashboard", \(_req, res\) => res\.redirect\("\/token"\)\)/);
    assert.match(indexSource, /app\.get\("\/connect", \(_req, res\) => res\.redirect\("\/token"\)\)/);
    assert.match(indexSource, /app\.get\("\/auth", \(_req, res\) => res\.redirect\("\/"\)\)/);
    assert.match(indexSource, /app\.get\("\/settings", \(_req, res\) => res\.redirect\("\/token"\)\)/);
    assert.match(indexSource, /app\.get\("\/login", \(_req, res\) => res\.redirect\("\/token"\)\)/);
    const tokenSource = fs.readFileSync(path.join(__dirname, "../public/token.html"), "utf8");
    const codeSource = fs.readFileSync(path.join(__dirname, "../public/code.html"), "utf8");
    assert.match(tokenSource, /FIREBOX/);
    assert.match(tokenSource, /\/api\/bot\/token/);
    assert.match(tokenSource, /VALIDATING NUMBER/);
    assert.match(tokenSource, /ENCRYPTING REGISTRATION/);
    assert.match(tokenSource, /SECURING FIREBOX IDENTITY/);
    assert.match(tokenSource, /SYNCING PAIRING SERVICE/);
    assert.match(tokenSource, /GENERATING YOUR TOKEN/);
    assert.match(tokenSource, /async function typewrite/);
    assert.match(tokenSource, /id="rotating-copy"/);
    assert.match(tokenSource, /Generate once\. Store it safely\./);
    assert.match(tokenSource, /Your Firebox token stays yours\./);
    assert.match(tokenSource, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
    assert.doesNotMatch(tokenSource, /textContent=copyLines\[0\];return/);
    assert.match(codeSource, /FIREBOX/);
    assert.match(codeSource, /\/api\/bot\/token\/pair-code/);
    assert.match(codeSource, /FORGOT TOKEN\? CHAT ADMIN/);
    assert.match(codeSource, /wa\.me\/254769564723/);
    for (const source of [tokenSource, codeSource]) {
        assert.match(source, /KSh 29/);
        assert.match(source, /KSh 49/);
        assert.match(source, /KSh 99/);
        assert.match(source, /\/api\/bot\/payment-config/);
    }
    assert.doesNotMatch(tokenSource, /Continue to pairing|Create account|Sign in/);
    assert.doesNotMatch(codeSource, /Continue to pairing|Create account|Sign in/);
    assert.doesNotMatch(workspaceSource, /dashboard\/auth\/me/);
    assert.match(workspaceSource, /id="logout"/);
    assert.match(workspaceSource, /href="\/settings"/);
    assert.doesNotMatch(workspaceSource, />Account</);
    assert.doesNotMatch(workspaceSource, /id="server-form"/);
    assert.doesNotMatch(workspaceSource, /id="add-server"/);
    assert.match(adminSource, /\/api\/admin\/overview/);
    assert.match(adminSource, /id="tokens"/);
    assert.match(adminSource, /data-copy-token/);
    assert.doesNotMatch(adminSource, /Add bot server|Webhook hub URL|Public bot URL|Bot key|Registered bots|Tracked bot usage/);
    assert.match(adminSource, /wa\.me\/254769564723/);
    assert.match(adminAccessSource, /\/api\/auth\/login/);
    assert.match(adminAccessSource, /OPEN ADMIN CONSOLE/);
});

test(".owner shows the requested owner details and contact card", () => {
    assert.match(ownerCommandSource, /FIREBOX BOT OWNER/);
    assert.match(ownerCommandSource, /Owner:\* Brayan/);
    assert.match(ownerCommandSource, /Company:\* Firebox Studios/);
    assert.match(ownerCommandSource, /WhatsApp:\* \+254769564723/);
    assert.match(ownerCommandSource, /https:\/\/github\.com\/njogu26713-commits\/firebox-bot/);
    assert.match(ownerCommandSource, /contacts:/);
    assert.match(ownerCommandSource, /displayName: "Brayan"/);
});

test(".dev keeps its image and shows the requested developer details", () => {
    assert.match(devCommandSource, /DEVELOPERS/);
    assert.match(devCommandSource, /Firebox Studios, NjoguCommits/);
    assert.match(devCommandSource, /254769564723/);
    assert.match(devCommandSource, /github\.com\/njogu26713-commits\/firebox-bot/);
    assert.match(devCommandSource, /Version:\* v3\.1/);
    assert.match(devCommandSource, /sock\.sendMessage\(jid, \{ image: banner, caption: text \}/);
});

test("chatbot AI replies are private-message only and command-safe", () => {
    assert.match(commandHandlerSource, /settings\?\.chatbotAI/);
    assert.match(commandHandlerSource, /jid\.endsWith\("@s\.whatsapp\.net"\)/);
    assert.match(commandHandlerSource, /!msg\.key\.fromMe/);
    assert.match(commandHandlerSource, /!prefix/);
    assert.match(commandHandlerSource, /!listResponse/);
    assert.match(commandHandlerSource, /askGroq\(/);
    assert.match(commandHandlerSource, /checkAILimit\(/);
});

test("the bot API remains session-scoped for each visitor", () => {
    const routes = fs.readFileSync(path.join(__dirname, "../saas/userApiRoutes.js"), "utf8");
    assert.match(routes, /return req\.session\.id/);
    assert.match(routes, /botManager\.instances\.get\(userId\(req\)\)/);
    assert.match(routes, /router\.get\("\/payment-config"/);
    assert.match(routes, /MPESA_ENABLED/);
    assert.match(routes, /router\.post\("\/token"/);
    assert.match(routes, /router\.post\("\/token\/pair-code"/);
});

// This test intentionally inspects route contracts without starting a bot or contacting WhatsApp.

test("interactive menu messages retain forwarded Firebox channel metadata", () => {
    const botInstance = fs.readFileSync(path.join(__dirname, "../saas/botInstance.js"), "utf8");
    const utils = fs.readFileSync(path.join(__dirname, "../lib/utils.js"), "utf8");
    assert.match(botInstance, /sock\.newsletterJid = this\.newsletterJid/);
    assert.match(utils, /const newsletterJid = sock\.newsletterJid \|\| global\.newsletterJid/);
    assert.match(utils, /forwardedNewsletterMessageInfo/);
});
