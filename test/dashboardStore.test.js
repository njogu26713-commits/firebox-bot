const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createDashboardStore } = require("../saas/dashboardStore");

function makeStore() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "firebox-registry-"));
    return { store: createDashboardStore(path.join(directory, "registry.json")), directory };
}

test("server records are returned only to their owner", async () => {
    const { store, directory } = makeStore();
    try {
        const first = await store.createUser({ name: "Asha", email: "asha@example.com", password: "long-password-1" });
        const second = await store.createUser({ name: "Noah", email: "noah@example.com", password: "long-password-2" });
        const server = store.createServer(first.id, { instanceName: "Primary", provider: "VPS", endpoint: "203.0.113.10", region: "Nairobi", environment: "production", status: "online", notes: "No credentials here." });

        assert.equal(store.listServers(first.id).length, 1);
        assert.equal(store.listServers(second.id).length, 0);
        assert.equal(store.getServer(second.id, server.id), null);
        assert.equal(store.updateServer(second.id, server.id, { status: "offline" }), null);
        assert.equal(store.deleteServer(second.id, server.id), false);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test("the registry returns counts and never exposes an owner identifier", async () => {
    const { store, directory } = makeStore();
    try {
        const user = await store.createUser({ name: "Mina", email: "mina@example.com", password: "long-password-3" });
        store.createServer(user.id, { instanceName: "Live", provider: "Railway", endpoint: "bot.example.com", region: "Europe", environment: "production", status: "online", notes: "" });
        store.createServer(user.id, { instanceName: "Repair", provider: "VPS", endpoint: "198.51.100.4", region: "US", environment: "staging", status: "maintenance", notes: "Rotating image." });

        const overview = store.overview(user.id);
        assert.deepEqual({ total: overview.total, online: overview.online, offline: overview.offline, maintenance: overview.maintenance }, { total: 2, online: 1, offline: 0, maintenance: 1 });
        assert.equal("ownerId" in overview.recent[0], false);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
