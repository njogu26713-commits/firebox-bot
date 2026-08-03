/**
 * BotManager — manages one BotInstance per SaaS user.
 * Instances are created on demand (first connection attempt)
 * and kept alive in memory while the process runs.
 */
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
