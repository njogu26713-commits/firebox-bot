const mongoose = require("mongoose");
const { isOnline } = require("../firebox/db");
const jsonStore = require("../firebox/jsonStore");

const warningSchema = new mongoose.Schema({
    userId:  { type: String, required: true },
    groupId: { type: String, required: true },
    count:   { type: Number, default: 0 }
}, { timestamps: true });

warningSchema.index({ userId: 1, groupId: 1 }, { unique: true });

let WarningDB = null;
try {
    WarningDB = mongoose.model("Warning");
} catch {
    WarningDB = mongoose.model("Warning", warningSchema);
}

module.exports = {
    WarningDB,
    initWarningDB: async () => {},

    addWarning: async (userId, groupId) => {
        if (isOnline()) {
            try {
                const doc = await WarningDB.findOneAndUpdate(
                    { userId, groupId },
                    { $inc: { count: 1 } },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                return doc.count;
            } catch (e) { console.error("❌ addWarning:", e.message); }
        }
        const key = `warn_${userId}_${groupId}`;
        const count = (jsonStore.get(key, 0)) + 1;
        jsonStore.set(key, count);
        return count;
    },

    getWarnings: async (userId, groupId) => {
        if (isOnline()) {
            try {
                const doc = await WarningDB.findOne({ userId, groupId }).lean();
                return doc ? doc.count : 0;
            } catch {}
        }
        return jsonStore.get(`warn_${userId}_${groupId}`, 0);
    },

    clearWarnings: async (userId, groupId) => {
        if (isOnline()) {
            try { await WarningDB.deleteOne({ userId, groupId }); return true; } catch {}
        }
        jsonStore.set(`warn_${userId}_${groupId}`, 0);
        return true;
    }
};
