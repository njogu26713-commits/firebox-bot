const express = require("express");
const serverRegistry = require("./serverRegistry");
const userRegistry = require("./userRegistry");
const usageRegistry = require("./usageRegistry");
const tokenRegistry = require("./tokenRegistry");
const { requireAdmin } = require("./adminAuth");
const router = express.Router();
router.use(express.json(), requireAdmin);

function safeErrorMessage(error) {
    return String(error?.message || error || "Unknown error")
        .replace(/mongodb(?:\+srv)?:\/\/[^\s/]+:[^\s@]+@/gi, "mongodb://***:***@")
        .replace(/(password|passwd|pwd|secret|token|key)=([^&\s]+)/gi, "$1=***");
}

async function loadOverviewPart(name, loader) {
    try {
        return { name, value: await loader() };
    } catch (error) {
        const message = safeErrorMessage(error);
        console.error(`[AdminOverview] ${name} failed: ${message}`);
        if (error?.stack) console.error(`[AdminOverview] ${name} stack: ${safeErrorMessage(error.stack)}`);
        return { name, error: message };
    }
}

router.get("/overview", async (_req, res) => {
    const parts = await Promise.all([
        loadOverviewPart("users", () => userRegistry.list()),
        loadOverviewPart("bots", () => serverRegistry.listAdmin()),
        loadOverviewPart("usage", () => usageRegistry.list()),
        loadOverviewPart("tokens", () => tokenRegistry.listAdmin()),
    ]);
    const failed = parts.find(part => part.error);
    if (failed) {
        console.error(`[AdminOverview] request failed at ${failed.name}; verify the runtime database URI and credentials.`);
        return res.status(503).json({
            error: `Admin overview failed at ${failed.name}: ${failed.error}`,
            diagnostic: { operation: failed.name, code: "ADMIN_OVERVIEW_DEPENDENCY_FAILURE" },
        });
    }
    const data = Object.fromEntries(parts.map(part => [part.name, part.value]));
    res.json(data);
});

module.exports = router;
