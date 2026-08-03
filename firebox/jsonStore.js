
const fs = require("fs");
const path = require("path");
const botContext = require("../lib/botContext");

const STORAGE_FILE = path.join(__dirname, "../database/storage.json");

/**
 * Super simple Pure-JS JSON storage for when real databases are missing.
 * Zero binary dependencies (No SQLite/GLIBC headaches!)
 *
 * In SaaS mode, each user gets their own JsonStore instance.
 * The module-level exports proxy to the current context's store when available.
 */
class JsonStore {
    constructor(filePath) {
        this.filePath = filePath || STORAGE_FILE;
        this.cache = {};
        this.saveTimeout = null;
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                this.cache = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
            } else {
                this.cache = {};
                this.save();
            }
        } catch (e) {
            console.error("❌ JsonStore Load Error:", e.message);
            this.cache = {};
        }
    }

    save() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        
        this.saveTimeout = setTimeout(() => {
            try {
                const dir = path.dirname(this.filePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                
                const data = JSON.stringify(this.cache);
                fs.writeFile(this.filePath, data, "utf-8", (err) => {
                    if (err) console.error("❌ JsonStore Save Error:", err.message);
                });
                this.saveTimeout = null;
            } catch (e) {
                console.error("❌ JsonStore Save Error:", e.message);
                this.saveTimeout = null;
            }
        }, 5000);
    }

    getAll() {
        return this.cache;
    }

    get(key, defaultValue = null) {
        return this.cache[key] !== undefined ? this.cache[key] : defaultValue;
    }

    set(key, value) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            const cleanObj = {};
            for (const k in value) {
                if (k !== "dataValues" && k !== "update" && k !== "save" && typeof value[k] !== "function") {
                    cleanObj[k] = value[k];
                }
            }
            this.cache[key] = cleanObj;
        } else {
            this.cache[key] = value;
        }
        this.save();
    }

    delete(key) {
        delete this.cache[key];
        this.save();
    }

    async findOrCreate(options) {
        const key = `settings_${options.where.id}`;
        if (!this.cache[key]) {
            this.cache[key] = options.defaults;
            this.save();
        }
        const data = this.cache[key];
        const result = {
            ...data,
            dataValues: data,
        };
        result.update = async (updates) => {
            const cleanUpdates = {};
            for (const k in updates) {
                if (k !== "dataValues" && k !== "update" && k !== "save" && typeof updates[k] !== "function") {
                    cleanUpdates[k] = updates[k];
                    result[k] = updates[k];
                }
            }
            Object.assign(this.cache[key], cleanUpdates);
            this.save();
            return result;
        };
        result.save = async () => {
            this.save();
            return result;
        };
        return [result];
    }
}

// Global fallback store (single-user / non-SaaS)
const globalStore = new JsonStore(STORAGE_FILE);

/**
 * Create a per-user store instance. Used by BotInstance.
 */
function createUserStore(userId) {
    const filePath = path.join(__dirname, `../database/storage_${userId}.json`);
    return new JsonStore(filePath);
}

// Proxy helpers — route to context store when in SaaS message context
function getActiveStore() {
    const ctx = botContext.getStore();
    return (ctx && ctx.store) ? ctx.store : globalStore;
}

module.exports = {
    // Raw class + factory for BotInstance use
    JsonStore,
    createUserStore,

    // Proxy API — transparent to all command files
    get: (key, defaultValue = null) => getActiveStore().get(key, defaultValue),
    set: (key, value) => getActiveStore().set(key, value),
    delete: (key) => getActiveStore().delete(key),
    getAll: () => getActiveStore().getAll(),
    findOrCreate: (opts) => getActiveStore().findOrCreate(opts),

    // Expose global store for direct use when needed
    _global: globalStore,
};
