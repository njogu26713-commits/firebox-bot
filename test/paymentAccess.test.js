const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const paymentAccess = require("../saas/paymentAccess");

const statePath = path.join(__dirname, "../database/payment_access.json");

function removeState() {
    try { fs.unlinkSync(statePath); } catch {}
}

test("free pairing is active on Saturday and Sunday but not Monday", () => {
    removeState();
    assert.equal(paymentAccess.getStatus(new Date("2026-11-07T10:00:00Z")).weekendFree, true);
    assert.equal(paymentAccess.getStatus(new Date("2026-11-08T10:00:00Z")).weekendFree, true);
    assert.equal(paymentAccess.getStatus(new Date("2026-11-09T10:00:00Z")).weekendFree, false);
});

test("admin override enables and disables free pairing outside the weekend", () => {
    removeState();
    paymentAccess.setManualFreeMode(true);
    assert.equal(paymentAccess.getStatus(new Date("2026-11-09T10:00:00Z")).freePairing, true);
    paymentAccess.setManualFreeMode(false);
    assert.equal(paymentAccess.getStatus(new Date("2026-11-09T10:00:00Z")).freePairing, false);
    removeState();
});

test.after(removeState);
