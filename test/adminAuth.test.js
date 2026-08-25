const assert = require("node:assert/strict");
const test = require("node:test");
const { isAdminAccount } = require("../saas/adminAuth");

test("admin access matches the configured email only", () => {
    const previous = process.env.FIREBOX_ADMIN_EMAIL;
    process.env.FIREBOX_ADMIN_EMAIL = "owner@example.com";
    assert.equal(isAdminAccount({ session: { accountId: "1", accountUser: { email: "OWNER@example.com" } } }), true);
    assert.equal(isAdminAccount({ session: { accountId: "2", accountUser: { email: "user@example.com" } } }), false);
    assert.equal(isAdminAccount({ session: {} }), false);
    if (previous === undefined) delete process.env.FIREBOX_ADMIN_EMAIL; else process.env.FIREBOX_ADMIN_EMAIL = previous;
});
