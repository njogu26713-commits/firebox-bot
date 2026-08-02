const mongoose = require("mongoose");
const { isOnline } = require("../firebox/db");
const jsonStore = require("../firebox/jsonStore");

const rulesSchema = new mongoose.Schema({
    groupId:   { type: String, required: true, unique: true },
    rulesText: { type: String, default: "No rules set for this group yet." }
}, { timestamps: true });

let RulesDB = null;
try {
    RulesDB = mongoose.model("Rules");
} catch {
    RulesDB = mongoose.model("Rules", rulesSchema);
}

module.exports = {
    RulesDB,
    initRulesDB: async () => {},

    setRules: async (groupId, rulesText) => {
        if (isOnline()) {
            try {
                const doc = await RulesDB.findOneAndUpdate(
                    { groupId }, { groupId, rulesText }, { upsert: true, new: true }
                );
                return doc;
            } catch (e) { console.error("❌ setRules:", e.message); }
        }
        jsonStore.set(`rules_${groupId}`, rulesText);
        return { rulesText };
    },

    getRules: async (groupId) => {
        if (isOnline()) {
            try {
                const doc = await RulesDB.findOne({ groupId }).lean();
                return doc ? doc.rulesText : "No rules set for this group yet.";
            } catch (e) { console.error("❌ getRules:", e.message); }
        }
        return jsonStore.get(`rules_${groupId}`, "No rules set for this group yet.");
    }
};
