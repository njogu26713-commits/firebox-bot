const express = require("express");
const serverRegistry = require("./serverRegistry");
const userRegistry = require("./userRegistry");
const usageRegistry = require("./usageRegistry");
const { requireAdmin } = require("./adminAuth");
const router = express.Router();
router.use(express.json(), requireAdmin);

router.get("/overview", async (_req, res) => {
    try {
        const [users, bots, usage] = await Promise.all([userRegistry.list(), serverRegistry.listAdmin(), usageRegistry.list()]);
        res.json({ users, bots, usage });
    } catch (error) { res.status(503).json({ error: error.message }); }
});

module.exports = router;
