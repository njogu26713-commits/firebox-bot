const { MongoClient } = require("mongodb");
function connectionUri() { return process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL; }
const databaseName = process.env.MONGODB_DATABASE || "firebox";
const collectionName = process.env.MONGODB_USAGE_COLLECTION || "user_bot_usage";
let client;
let collection;
const testUsage = new Map();
async function store() {
    if (process.env.NODE_ENV === "test") return null;
    const uri = connectionUri();
    if (!uri) throw new Error("Railway MongoDB is not connected. Add MONGO_URL or set MONGODB_URI.");
    if (!collection) {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
        await client.connect();
        collection = client.db(databaseName).collection(collectionName);
        await collection.createIndex({ userId: 1, serverId: 1 }, { unique: true });
        await collection.createIndex({ updatedAt: -1 });
    }
    return collection;
}
async function touch(entry) {
    const record = { userId: entry.userId, email: entry.email, serverId: entry.serverId, updatedAt: new Date().toISOString() };
    const db = await store();
    if (!db) { testUsage.set(`${record.userId}:${record.serverId}`, record); return record; }
    await db.updateOne({ userId: record.userId, serverId: record.serverId }, { $set: record }, { upsert: true });
    return record;
}
module.exports = {
    touch,
    async list() {
        const db = await store();
        if (!db) return [...testUsage.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return db.find({}, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).toArray();
    },
    async close() { if (client) await client.close(); client = null; collection = null; },
};
