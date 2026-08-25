const express = require("express");
const { createDashboardStore, STATUSES, ENVIRONMENTS } = require("./dashboardStore");

const router = express.Router();
const store = createDashboardStore();

function activeUser(req) {
    const id = req.session && req.session.dashboardUserId;
    return id ? store.publicUser(store.findUserById(id)) : null;
}

function requireDashboardAuth(req, res, next) {
    const user = activeUser(req);
    if (!user) return res.status(401).json({ error: "Sign in to access the server registry." });
    req.dashboardUser = user;
    next();
}

router.post("/auth/register", async (req, res) => {
    try {
        const user = await store.createUser(req.body || {});
        req.session.dashboardUserId = user.id;
        res.status(201).json({ user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post("/auth/login", async (req, res) => {
    const user = await store.authenticate(req.body?.email, req.body?.password);
    if (!user) return res.status(401).json({ error: "Email or password is incorrect." });
    req.session.dashboardUserId = user.id;
    res.json({ user });
});

router.post("/auth/logout", requireDashboardAuth, (req, res) => {
    delete req.session.dashboardUserId;
    res.json({ ok: true });
});

router.get("/auth/me", (req, res) => {
    res.json({ user: activeUser(req) });
});

router.get("/servers/options", requireDashboardAuth, (_req, res) => {
    res.json({ statuses: STATUSES, environments: ENVIRONMENTS });
});

router.get("/servers", requireDashboardAuth, (req, res) => {
    res.json({ servers: store.listServers(req.dashboardUser.id) });
});

router.get("/servers/overview", requireDashboardAuth, (req, res) => {
    res.json(store.overview(req.dashboardUser.id));
});

router.get("/servers/:id", requireDashboardAuth, (req, res) => {
    const server = store.getServer(req.dashboardUser.id, req.params.id);
    if (!server) return res.status(404).json({ error: "Server record not found." });
    res.json({ server });
});

router.post("/servers", requireDashboardAuth, (req, res) => {
    try {
        const server = store.createServer(req.dashboardUser.id, req.body || {});
        res.status(201).json({ server });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put("/servers/:id", requireDashboardAuth, (req, res) => {
    try {
        const server = store.updateServer(req.dashboardUser.id, req.params.id, req.body || {});
        if (!server) return res.status(404).json({ error: "Server record not found." });
        res.json({ server });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.patch("/servers/:id/status", requireDashboardAuth, (req, res) => {
    try {
        const server = store.updateServer(req.dashboardUser.id, req.params.id, { status: req.body?.status });
        if (!server) return res.status(404).json({ error: "Server record not found." });
        res.json({ server });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete("/servers/:id", requireDashboardAuth, (req, res) => {
    if (!store.deleteServer(req.dashboardUser.id, req.params.id)) {
        return res.status(404).json({ error: "Server record not found." });
    }
    res.json({ ok: true });
});

module.exports = { router, requireDashboardAuth };
