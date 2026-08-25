const assert = require("node:assert/strict");
const test = require("node:test");

test("user registry creates accounts, hashes passwords, and verifies credentials", async () => {
    process.env.NODE_ENV = "test";
    delete require.cache[require.resolve("../saas/userRegistry")];
    const registry = require("../saas/userRegistry");
    const user = await registry.create({ name: "Test User", email: "Test@Example.com", password: "correct-horse-battery" });
    assert.equal(user.email, "test@example.com");
    assert.equal("passwordHash" in user, false);
    assert.equal((await registry.verify("TEST@example.com", "correct-horse-battery")).id, user.id);
    assert.equal(await registry.verify("test@example.com", "wrong-password"), null);
    await assert.rejects(() => registry.create({ name: "Other", email: "test@example.com", password: "another-password" }), /already exists/);
    await registry.close();
});
