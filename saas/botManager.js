/**
 * BotManager — manages one BotInstance per SaaS user.
 * Instances are created on demand (first connection attempt)
 * and kept alive in memory while the process runs.
 */
const fs = require("fs");
const path = require("path");
const BotInstance = require("./botInstance");

class BotManager {
    constructor() {
        /** @type {Map<string, BotInstance>} */
        this.instances = new Map();
    }

    /**
     * Get an existing instance or create a new one for userId.
     */
    get(userId) {
        if (!this.instances.has(userId)) {
            this.instances.set(userId, new BotInstance(userId));
        }
        return this.instances.get(userId);
    }

    /**
     * Start the bot for a user (idempotent — safe to call multiple times).
     */
    async start(userId) {
        const instance = this.get(userId);
        if (instance.status === "offline" && !instance.isReconnecting) {
            await instance.start();
        }
        return instance;
    }

    /**
     * Stop and remove the bot instance for a user.
     */
    stop(userId) {
        const instance = this.instances.get(userId);
        if (instance) {
            instance.stop();
            this.instances.delete(userId);
        }
    }

    /**
     * Get the status summary for a user's bot.
     */
    getStatus(userId) {
        const instance = this.instances.get(userId);
        if (!instance) return { status: "offline", latestQr: null, myJid: null };
        return {
            status: instance.status,
            latestQr: instance.latestQr,
            myJid: instance.myJid,
        };
    }

    /**
     * Check if a user has an active bot instance.
     */
    has(userId) {
        return this.instances.has(userId);
    }

    /**
     * Rehydrate saved sessions after a process/container restart.
     * SESSION_ID is the portable deployment credential; local session folders
     * are also restored when the host provides persistent storage.
     */
    async restoreAtBoot() {
        const sessionRoot = path.join(__dirname, "../sessions");
        const userIds = new Set();

        if (process.env.SESSION_ID && process.env.SESSION_ID.trim()) {
            userIds.add(process.env.BOT_USER_ID || "default");
        }

        try {
            if (fs.existsSync(sessionRoot)) {
                for (const entry of fs.readdirSync(sessionRoot, { withFileTypes: true })) {
                    if (entry.isDirectory()) userIds.add(entry.name);
                }
            }
        } catch (error) {
            console.error("[boot] Could not scan saved bot sessions:", error.message);
        }

        await Promise.all([...userIds].map(async (userId) => {
            const options = userId === (process.env.BOT_USER_ID || "default") && process.env.SESSION_ID
                ? { sessionId: process.env.SESSION_ID.trim() }
                : {};
            const instance = this.get(userId);
            if (options.sessionId) instance.sessionId = options.sessionId;
            try {
                await instance.start();
                console.log(`[boot] Reconnecting bot session ${userId}...`);
            } catch (error) {
                console.error(`[boot] Failed to restore bot session ${userId}:`, error.message);
            }
        }));
    }

    /**
     * Stop every bot instance cleanly before the process exits.
     */
    stopAll() {
        for (const instance of this.instances.values()) instance.stop();
    }

    /**
     * Return all running instances.
     */
    all() {
        return Array.from(this.instances.entries()).map(([userId, inst]) => ({
            userId,
            status: inst.status,
            myJid: inst.myJid,
        }));
    }
}

// Singleton
module.exports = new BotManager();
