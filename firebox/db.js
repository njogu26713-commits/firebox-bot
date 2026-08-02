const mongoose = require("mongoose");

let isDatabaseOnline = false;

const initDb = async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.log("ℹ️  No MONGODB_URI set. Using JSON file fallback store.");
        return;
    }
    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        isDatabaseOnline = true;
        console.log("🗄️ MongoDB connected successfully.");

        mongoose.connection.on("disconnected", () => {
            isDatabaseOnline = false;
            console.warn("⚠️ MongoDB disconnected. Falling back to JSON store.");
        });
        mongoose.connection.on("reconnected", () => {
            isDatabaseOnline = true;
            console.log("✅ MongoDB reconnected.");
        });
    } catch (e) {
        console.error("❌ MongoDB connection failed:", e.message);
        isDatabaseOnline = false;
    }
};

/**
 * Wraps a Mongoose document with Sequelize-compatible helpers
 * (.dataValues, .update(), .save()) so existing commands work unchanged.
 */
function toCompat(doc) {
    if (!doc) return null;
    if (!Object.getOwnPropertyDescriptor(doc, "dataValues")) {
        Object.defineProperty(doc, "dataValues", {
            get() { return doc.toObject ? doc.toObject() : { ...doc }; },
            configurable: true
        });
    }
    if (!doc.update) {
        doc.update = async (changes) => {
            Object.assign(doc, changes);
            await doc.save();
            return doc;
        };
    }
    return doc;
}

module.exports = { mongoose, initDb, isOnline: () => isDatabaseOnline, toCompat };
