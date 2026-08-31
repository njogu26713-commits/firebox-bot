const express = require("express");
const serverRegistry = require("./serverRegistry");
const userRegistry = require("./userRegistry");
const usageRegistry = require("./usageRegistry");
const tokenRegistry = require("./tokenRegistry");
const { requireAdmin } = require("./adminAuth");
const router = express.Router();
router.use(express.json(), requireAdmin);

router.get("/overview", async (_req, res) => {
    try {
        const [users, bots, usage] = await Promise.all([userRegistry.list(), serverRegistry.listAdmin(), usageRegistry.list()]);
        const tokens = tokenRegistry.listAdmin().map(item => ({
            ...item,
            phone: item.phone.length > 4 ? `${"•".repeat(Math.max(0, item.phone.length - 4))}${item.phone.slice(-4)}` : "••••",
        }));
        res.json({ users, bots, usage, tokens });
    } catch (error) { res.status(503).json({ error: error.message }); }
});

module.exports = router;
