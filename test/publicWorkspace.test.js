const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const indexSource = fs.readFileSync(path.join(__dirname, "../index.js"), "utf8");
const workspaceSource = fs.readFileSync(path.join(__dirname, "../public/servers.html"), "utf8");

test("the public entry point serves the visitor-specific dynamic server workspace", () => {
    assert.match(indexSource, /app\.get\("\/", \(req, res\) => res\.sendFile\(req\.session\.accountId \? serverWorkspace : authWorkspace\)\)/);
    assert.match(indexSource, /app\.use\("\/api\/auth", require\("\.\/saas\/authApiRoutes"\)\)/);
    assert.match(indexSource, /app\.get\("\/admin", \(req, res\) => \{ if \(!req\.session\.accountId\) return res\.sendFile\(authWorkspace\); if \(!isAdminAccount\(req\)\) return res\.status\(403\)/);
    assert.match(indexSource, /app\.get\("\/bot-dashboard", \(_req, res\) => res\.redirect\("\/"\)\)/);
    assert.match(indexSource, /app\.get\("\/connect", \(_req, res\) => res\.redirect\("\/"\)\)/);
    assert.match(indexSource, /app\.get\("\/auth", \(_req, res\) => res\.sendFile\(authWorkspace\)\)/);
    assert.match(indexSource, /app\.get\("\/settings", \(req, res\) => res\.sendFile\(req\.session\.accountId \? settingsWorkspace : authWorkspace\)\)/);
    assert.match(workspaceSource, /id="server-list"/);
    assert.match(workspaceSource, /\/api\/bot\/servers/);
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
});

// This test intentionally inspects route contracts without starting a bot or contacting WhatsApp.
