const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

test("server registry stores multiple servers and returns only public metadata", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "firebox-panel-"));
    process.env.NODE_ENV = "test";
    delete require.cache[require.resolve("../saas/serverRegistry")];
    const registry = require("../saas/serverRegistry");
    const first = await registry.add({ name: "Server 1", hubUrl: "https://hub.example.com", botId: "server-1", botKey: "private-key-one-123456789", publicUrl: "https://server-1.example.com" });
    const second = await registry.add({ name: "Server 2", hubUrl: "https://hub.example.com", botId: "server-2", botKey: "private-key-two-123456789", publicUrl: "https://server-2.example.com" });
    assert.equal((await registry.list()).length, 2);
    assert.equal((await registry.get(second.id)).botKey, "private-key-two-123456789");
    assert.equal("botKey" in first, false);
    await registry.close();
    fs.rmSync(directory, { recursive: true, force: true });
});
