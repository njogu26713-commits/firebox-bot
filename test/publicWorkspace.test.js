const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const indexSource = fs.readFileSync(path.join(__dirname, "../index.js"), "utf8");
const workspaceSource = fs.readFileSync(path.join(__dirname, "../public/servers.html"), "utf8");

test("the public entry point separates reusable token and pairing-code pages", () => {
    assert.match(indexSource, /app\.get\("\/", \(_req, res\) => res\.redirect\("\/token"\)\)/);
    assert.match(indexSource, /app\.get\("\/token", \(_req, res\) => res\.sendFile\(tokenWorkspace\)\)/);
    assert.match(indexSource, /app\.get\("\/code", \(_req, res\) => res\.sendFile\(codeWorkspace\)\)/);
    assert.match(indexSource, /app\.use\("\/api\/auth", require\("\.\/saas\/authApiRoutes"\)\)/);
    assert.match(indexSource, /app\.get\("\/admin", \(req, res\) => \{ if \(!req\.session\.accountId\) return res\.sendFile\(authWorkspace\); if \(!isAdminAccount\(req\)\) return res\.status\(403\)/);
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
