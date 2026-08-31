const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const indexSource = fs.readFileSync(path.join(__dirname, "../index.js"), "utf8");
const workspaceSource = fs.readFileSync(path.join(__dirname, "../public/servers.html"), "utf8");

test("the public entry point serves Firebox pairing without account creation", () => {
    assert.match(indexSource, /app\.get\("\/", \(_req, res\) => res\.sendFile\(serverWorkspace\)\)/);
    assert.match(indexSource, /app\.use\("\/api\/auth", require\("\.\/saas\/authApiRoutes"\)\)/);
    assert.match(indexSource, /app\.get\("\/admin", \(req, res\) => \{ if \(!req\.session\.accountId\) return res\.sendFile\(authWorkspace\); if \(!isAdminAccount\(req\)\) return res\.status\(403\)/);
    assert.match(indexSource, /app\.get\("\/bot-dashboard", \(_req, res\) => res\.redirect\("\/"\)\)/);
    assert.match(indexSource, /app\.get\("\/connect", \(_req, res\) => res\.redirect\("\/"\)\)/);
    assert.match(indexSource, /app\.get\("\/auth", \(_req, res\) => res\.redirect\("\/"\)\)/);
    assert.match(indexSource, /app\.get\("\/settings", \(_req, res\) => res\.redirect\("\/"\)\)/);
    assert.match(indexSource, /app\.get\("\/login", \(_req, res\) => res\.redirect\("\/"\)\)/);
    assert.match(workspaceSource, /FIREBOX BOT/);
    assert.match(workspaceSource, /id="register-stage"/);
    assert.match(workspaceSource, /id="token-stage"/);
    assert.match(workspaceSource, /id="pair-stage"/);
    assert.match(workspaceSource, /\/api\/bot\/token/);
    assert.doesNotMatch(workspaceSource, /Create account|Sign in to choose/);
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
    assert.match(routes, /router\.post\("\/token"/);
    assert.match(routes, /router\.post\("\/token\/pair-code"/);
});

// This test intentionally inspects route contracts without starting a bot or contacting WhatsApp.
