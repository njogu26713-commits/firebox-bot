const express = require("express");
const userRegistry = require("./userRegistry");
const router = express.Router();
router.use(express.json());

router.get("/me", async (req, res) => {
    if (!req.session.accountId) return res.json({ user: null });
    try { res.json({ user: req.session.accountUser || null }); } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post("/register", async (req, res) => {
    try {
        const user = await userRegistry.create(req.body || {});
        req.session.accountId = user.id;
        req.session.accountUser = user;
        res.status(201).json({ user });
    } catch (error) { res.status(400).json({ error: error.message }); }
});

router.post("/login", async (req, res) => {
    try {
        const user = await userRegistry.verify(req.body?.email, req.body?.password);
        if (!user) return res.status(401).json({ error: "Invalid email or password." });
        req.session.accountId = user.id;
        req.session.accountUser = user;
        res.json({ user });
    } catch (error) { res.status(503).json({ error: error.message }); }
});

router.post("/logout", (req, res) => {
    req.session.destroy(error => {
        if (error) return res.status(500).json({ error: "Could not sign out." });
        res.clearCookie("connect.sid");
        res.json({ ok: true });
    });
});

module.exports = router;
