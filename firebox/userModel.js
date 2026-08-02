const mongoose = require("mongoose");
const { isOnline, toCompat } = require("./db");
const jsonStore = require("./jsonStore");

const userSchema = new mongoose.Schema({
    id:          { type: String, required: true, unique: true },
    xp:          { type: Number, default: 0 },
    level:       { type: Number, default: 1 },
    coins:       { type: Number, default: 0 },
    banned:      { type: Boolean, default: false },
    inventory:   { type: String, default: "[]" },
    lastDaily:   { type: Date, default: null },
    lastWeekly:  { type: Date, default: null },
    lastMonthly: { type: Date, default: null },
    lastWork:    { type: Date, default: null },
    lastCrime:   { type: Date, default: null },
    lastRob:     { type: Date, default: null },
}, { timestamps: true });

let User = null;
try {
    User = mongoose.model("User");
} catch {
    User = mongoose.model("User", userSchema);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const getUser = async (id) => {
    if (isOnline()) {
        try {
            const doc = await User.findOneAndUpdate(
                { id },
                { $setOnInsert: { id, xp: 0, level: 1, coins: 0, inventory: "[]" } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            return toCompat(doc);
        } catch (e) {
            console.error("❌ getUser Error:", e.message);
        }
    }

    // JSON fallback
    const key = `user_${id}`;
    let data = jsonStore.get(key);
    if (!data) {
        data = { id, xp: 0, level: 1, coins: 0, inventory: "[]" };
        jsonStore.set(key, data);
    }
    return {
        ...data,
        dataValues: data,
        update: async (updates) => {
            Object.assign(data, updates);
            jsonStore.set(key, data);
            return data;
        },
        save: async () => { jsonStore.set(key, data); return data; }
    };
};

const xpCooldowns = new Map();

const addXP = async (id, amount) => {
    const now = Date.now();
    if (now - (xpCooldowns.get(id) || 0) < 60000) return null;
    xpCooldowns.set(id, now);

    const user = await getUser(id);
    if (!user) return null;
    const xp = (user.xp || 0) + amount;
    const level = xp >= (user.level || 1) * 100 ? (user.level || 1) + 1 : (user.level || 1);
    await user.update({ xp, level });
    return user.dataValues;
};

const addCoins = async (id, amount) => {
    const user = await getUser(id);
    if (!user) return null;
    await user.update({ coins: (user.coins || 0) + amount });
    return user.dataValues;
};

const getUserCount = async () => {
    if (isOnline()) {
        try { return await User.countDocuments(); } catch {}
    }
    return Object.keys(jsonStore.getAll()).filter(k => k.startsWith("user_")).length;
};

module.exports = { User, getUser, addXP, addCoins, getUserCount };
