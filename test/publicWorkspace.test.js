const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const indexSource = fs.readFileSync(path.join(__dirname, "../index.js"), "utf8");
const workspaceSource = fs.readFileSync(path.join(__dirname, "../public/servers.html"), "utf8");

test("the public entry point serves the visitor-specific Server 1 workspace", () => {
    assert.match(indexSource, /app\.get\("\/", \(_req, res\) => res\.sendFile\(serverWorkspace\)\)/);
    assert.match(indexSource, /app\.get\("\/bot-dashboard", \(_req, res\) => res\.redirect\("\/"\)\)/);
    assert.match(indexSource, /app\.get\("\/connect", \(_req, res\) => res\.redirect\("\/"\)\)/);
    assert.match(workspaceSource, /<span>Server 1<\/span>/);
    assert.doesNotMatch(workspaceSource, /dashboard\/auth\/me/);
    assert.doesNotMatch(workspaceSource, /id="logout"/);
    assert.doesNotMatch(workspaceSource, /Add server|Edit server|Remove/);
});

test("the bot API remains session-scoped for each visitor", () => {
    const routes = fs.readFileSync(path.join(__dirname, "../saas/userApiRoutes.js"), "utf8");
    assert.match(routes, /return req\.session\.id/);
    assert.match(routes, /botManager\.instances\.get\(userId\(req\)\)/);
});

// This test intentionally inspects route contracts without starting a bot or contacting WhatsApp.
