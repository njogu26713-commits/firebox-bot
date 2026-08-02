const mongoose = require("mongoose");
const { isOnline } = require("../firebox/db");
const jsonStore = require("../firebox/jsonStore");

const badwordSchema = new mongoose.Schema({
    word: { type: String, required: true, unique: true, lowercase: true }
}, { timestamps: true });

let BadwordDB = null;
try {
    BadwordDB = mongoose.model("Badword");
} catch {
    BadwordDB = mongoose.model("Badword", badwordSchema);
}

module.exports = {
    BadwordDB,
    initBadwordDB: async () => {},

    addBadword: async (word) => {
        const w = word.toLowerCase();
        if (isOnline()) {
            try {
                await BadwordDB.findOneAndUpdate({ word: w }, { word: w }, { upsert: true, new: true });
                return true;
            } catch (e) { console.error("❌ addBadword:", e.message); }
        }
        const list = jsonStore.get("badwords", []);
        if (!list.includes(w)) { list.push(w); jsonStore.set("badwords", list); }
        return true;
    },

    removeBadword: async (word) => {
        const w = word.toLowerCase();
        if (isOnline()) {
            try { await BadwordDB.deleteOne({ word: w }); return true; } catch (e) { console.error("❌ removeBadword:", e.message); }
        }
        jsonStore.set("badwords", jsonStore.get("badwords", []).filter(x => x !== w));
        return true;
    },

    getBadwords: async () => {
        if (isOnline()) {
            try {
                const docs = await BadwordDB.find().lean();
                return docs.map(d => d.word);
            } catch (e) { console.error("❌ getBadwords:", e.message); }
        }
        return jsonStore.get("badwords", []);
    }
};
