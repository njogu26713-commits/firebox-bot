const assert = require("node:assert/strict");
const test = require("node:test");
const { matchesSecret } = require("../saas/panelProxyAuth");

test("panel proxy secret matching accepts only the exact configured secret", () => {
    assert.equal(matchesSecret("server-secret", "server-secret"), true);
    assert.equal(matchesSecret("wrong-secret", "server-secret"), false);
    assert.equal(matchesSecret("server-secret", "different-length"), false);
    assert.equal(matchesSecret("", "server-secret"), false);
});
