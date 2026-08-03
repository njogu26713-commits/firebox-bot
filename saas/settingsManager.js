/**
 * Per-user settings manager.
 * Each BotInstance gets one of these. It manages a user-scoped
 * settings cache backed by a namespaced key in their JsonStore.
 */
const { defaultSettings, _enforceDefaults } = require("../lib/settings");

class SettingsManager {
    constructor(store) {
        this.store = store;
        this.cache = null;
    }

    async load() {
        const raw = this.store.get("bot_settings");
        const data = raw ? { ...defaultSettings, ...raw } : { ...defaultSettings };

        // Build compat object with update/save/dataValues
        this.cache = this._wrap(data);
        await _enforceDefaults(this.cache);
        return this.cache;
    }

    get() {
        return this.cache || { ...defaultSettings };
    }

    async update(updates) {
        if (!this.cache) await this.load();
        for (const [k, v] of Object.entries(updates)) {
            this.cache[k] = v;
            if (this.cache.dataValues) this.cache.dataValues[k] = v;
        }
        this.store.set("bot_settings", this._toPlain(this.cache));
        return this.cache;
    }

    _toPlain(cache) {
        const plain = {};
        for (const k of Object.keys(defaultSettings)) {
            plain[k] = cache[k];
        }
        return plain;
    }

    _wrap(data) {
        const obj = { ...data };
        obj.dataValues = obj;
        obj.update = async (updates) => {
            Object.assign(obj, updates);
            this.store.set("bot_settings", this._toPlain(obj));
            return obj;
        };
        obj.save = async () => {
            this.store.set("bot_settings", this._toPlain(obj));
            return obj;
        };
        return obj;
    }
}

module.exports = SettingsManager;
