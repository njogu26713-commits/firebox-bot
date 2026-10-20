const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const registry = require("../saas/tokenRegistry");

const storePath = path.join(__dirname, "../database/firebox_tokens.json");

test("token registry creates opaque tokens and resolves the protected phone internally", async () => {
    try { fs.unlinkSync(storePath); } catch {}
    const token = await registry.create("+254 769 564 723");
    assert.match(token, /^FIREBOX-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal((await registry.listAdmin())[0].status, "payment_required");
    await assert.rejects(
        () => registry.resolve(token),
        /paid access plan is required/
    );
    const paid = await registry.applyPaidPlan({ phone: "254769564723", days: 7, reference: `fb-${"0".repeat(32)}` });
    assert.equal(paid.token, token);
    assert.equal(paid.planDays, 7);
    const resolved = await registry.resolve(token);
    assert.equal(resolved.phone, "254769564723");
    assert.equal(resolved.record.status, "active");
    assert.equal(resolved.record.pairingAttempts, 0);
    assert.ok(!JSON.stringify({ token }).includes(resolved.phone));
    await registry.markUsed(resolved);
    assert.equal((await registry.resolve(token)).record.pairingAttempts, 1);
    const adminRecords = await registry.listAdmin();
    assert.equal(adminRecords[0].token, token);
    assert.equal(adminRecords[0].phone, "254769564723");
    await assert.rejects(
        () => registry.create("254769564723"),
        /already has a Firebox token/
    );
});

test("verified paid plans issue expiring tokens and repeated references do not double-extend", async () => {
    const phone = "254700000001";
    const firstReference = `fb-${"1".repeat(32)}`;
    const before = Date.now();
    const first = await registry.applyPaidPlan({ phone, days: 7, reference: firstReference });
    assert.match(first.token, /^FIREBOX-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.equal(first.planDays, 7);
    assert.ok(Date.parse(first.expiresAt) >= before + 7 * 24 * 60 * 60 * 1000 - 1000);
    assert.ok(Date.parse(first.expiresAt) <= Date.now() + 7 * 24 * 60 * 60 * 1000 + 1000);

    const replay = await registry.applyPaidPlan({ phone, days: 7, reference: firstReference });
    assert.equal(replay.token, first.token);
    assert.equal(new Date(replay.expiresAt).getTime(), new Date(first.expiresAt).getTime());

    const secondReference = `fb-${"2".repeat(32)}`;
    const extended = await registry.applyPaidPlan({ phone, days: 14, reference: secondReference });
    assert.equal(extended.token, first.token);
    assert.equal(extended.planDays, 14);
    assert.ok(Date.parse(extended.expiresAt) >= Date.parse(first.expiresAt) + 14 * 24 * 60 * 60 * 1000 - 1000);
    assert.deepEqual(await registry.canPurchase(phone), { allowed: true });
    assert.equal((await registry.getPaidTokenByReference(secondReference)).token, first.token);
});

test("expired tokens remain eligible for renewal payment", async () => {
    const phone = "254700000002";
    const reference = `fb-${"3".repeat(32)}`;
    const paid = await registry.applyPaidPlan({ phone, days: 7, reference });
    const records = JSON.parse(fs.readFileSync(storePath, "utf8"));
    const record = records.find(item => item.tokenHash === require("crypto").createHash("sha256").update(paid.token).digest("hex"));
    record.expiresAt = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(storePath, JSON.stringify(records));
    const resolved = await registry.resolveForPayment(paid.token);
    assert.equal(resolved.token, paid.token);
    assert.equal(resolved.phone, phone);
});
test("admin token listing tolerates a record encrypted with an unavailable secret", async () => {
    const records = JSON.parse(fs.readFileSync(storePath, "utf8"));
    records.push({
        tokenHash: "unreadable-token-record",
        tokenCiphertext: { iv: "AA", data: "AA", tag: "AA" },
        phone: { iv: "AA", data: "AA", tag: "AA" },
        status: "active",
        pairingAttempts: 0,
    });
    fs.writeFileSync(storePath, JSON.stringify(records));
    const listed = await registry.listAdmin();
    const unreadable = listed.find(item => item.token === null && item.phone === null);
    assert.ok(unreadable);
    assert.equal(unreadable.decryptionError, "TOKEN_SECRET_MISMATCH");
    assert.equal(listed.length, records.length);
});

test("token deletion removes the token from the registry", async () => {
    const token = await registry.create("254700000099");
    assert.equal(await registry.remove(token), true);
    assert.equal(await registry.remove(token), false);
    await assert.rejects(() => registry.resolve(token), /not found or inactive/);
});

test.after(() => { try { fs.unlinkSync(storePath); } catch {} });
