const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const registry = require("../saas/tokenRegistry");

const storePath = path.join(__dirname, "../database/firebox_tokens.json");

test("token registry creates opaque tokens and resolves the protected phone internally", () => {
    try { fs.unlinkSync(storePath); } catch {}
    const token = registry.create("+254 769 564 723");
    assert.match(token, /^FIREBOX-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    const resolved = registry.resolve(token);
    assert.equal(resolved.phone, "254769564723");
    assert.equal(resolved.record.status, "active");
    assert.equal(resolved.record.pairingAttempts, 0);
    assert.ok(!JSON.stringify({ token }).includes(resolved.phone));
    registry.markUsed(resolved);
    assert.equal(registry.resolve(token).record.pairingAttempts, 1);
    const adminRecords = registry.listAdmin();
    assert.equal(adminRecords[0].token, token);
    assert.equal(adminRecords[0].phone, "254769564723");
    assert.throws(
        () => registry.create("254769564723"),
        /already has a Firebox token/
    );
});

test.after(() => { try { fs.unlinkSync(storePath); } catch {} });
