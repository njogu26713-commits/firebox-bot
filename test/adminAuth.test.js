const assert = require("node:assert/strict");
const test = require("node:test");
const { isAdminAuthenticated, verifyAdminPasscode } = require("../saas/adminAuth");

test("admin access uses the configured passcode only", () => {
    const previous = process.env.FIREBOX_ADMIN_PASSCODE;
    process.env.FIREBOX_ADMIN_PASSCODE = "correct-admin-passcode";
    assert.equal(verifyAdminPasscode("correct-admin-passcode"), true);
    assert.equal(verifyAdminPasscode("wrong-admin-passcode"), false);
    assert.equal(verifyAdminPasscode(""), false);
    assert.equal(isAdminAuthenticated({ session: { adminAuthenticated: true } }), true);
    assert.equal(isAdminAuthenticated({ session: { adminAuthenticated: false } }), false);
    assert.equal(isAdminAuthenticated({ session: {} }), false);
    if (previous === undefined) delete process.env.FIREBOX_ADMIN_PASSCODE; else process.env.FIREBOX_ADMIN_PASSCODE = previous;
});
