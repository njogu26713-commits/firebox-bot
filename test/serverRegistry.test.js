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

test("server registry upserts synchronized bots by Bot ID", async () => {
    process.env.NODE_ENV = "test";
    delete require.cache[require.resolve("../saas/serverRegistry")];
    const registry = require("../saas/serverRegistry");
    const first = await registry.upsertByBotId({ name: "Sync Bot", hubUrl: "https://hub.example.com", botId: "bot_sync", botKey: "sync-key-1234567890", publicUrl: "https://sync.example.com" });
    const second = await registry.upsertByBotId({ name: "Sync Bot Updated", hubUrl: "https://hub.example.com", botId: "bot_sync", botKey: "sync-key-1234567890", publicUrl: "https://sync-updated.example.com" });
    assert.equal(first.id, second.id);
    assert.equal((await registry.list()).filter(bot => bot.name.includes("Sync Bot")).length, 1);
    await registry.close();
});

test("server registry preserves QR pairing mode without exposing the bot key", async () => {
    process.env.NODE_ENV = "test";
    delete require.cache[require.resolve("../saas/serverRegistry")];
    const registry = require("../saas/serverRegistry");
    const bot = await registry.add({ name: "Open-WA QR Bot", hubUrl: "https://hub.example.com", botId: "qr-bot", botKey: "qr-key-1234567890", publicUrl: "https://qr.example.com", pairingMode: "qr" });
    assert.equal(bot.pairingMode, "qr");
    assert.equal("botKey" in bot, false);
    await registry.close();
});
