const crypto = require("crypto");
const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE || "firebox";
const collectionName = process.env.MONGODB_SERVERS_COLLECTION || "servers";
let client;
let collection;
const testRecords = new Map();

function publicRecord(record) {
    return { id: record.id, name: record.name, publicUrl: record.publicUrl, active: record.active, createdAt: record.createdAt };
}
async function store() {
    if (process.env.NODE_ENV === "test") return null;
    if (!uri) throw new Error("MONGODB_URI is required for the Firebox server registry.");
    if (!collection) {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
        await client.connect();
        collection = client.db(databaseName).collection(collectionName);
        await collection.createIndex({ id: 1 }, { unique: true });
        await collection.createIndex({ active: 1, createdAt: -1 });
    }
    return collection;
}
function validate(input) {
    const name = String(input.name || "").trim().slice(0, 120);
    const publicUrl = String(input.publicUrl || "").trim().replace(/\/$/, "");
    const hubUrl = String(input.hubUrl || "").trim().replace(/\/$/, "");
    const botId = String(input.botId || "").trim();
    const botKey = String(input.botKey || "").trim();
    if (!name || !/^https?:\/\//i.test(publicUrl) || !/^https?:\/\//i.test(hubUrl) || !botId || !botKey) throw new Error("Name, public URL, hub URL, bot ID, and bot key are required.");
    return { name, publicUrl, hubUrl, botId, botKey };
}
module.exports = {
    async list() {
        const db = await store();
        if (!db) return [...testRecords.values()].filter(record => record.active).map(publicRecord);
        return (await db.find({ active: true }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()).map(publicRecord);
    },
    async get(id) {
        const db = await store();
        if (!db) return testRecords.get(id)?.active ? testRecords.get(id) : null;
        return db.findOne({ id, active: true }, { projection: { _id: 0 } });
    },
    async add(input) {
        const data = validate(input);
        const record = { id: `server_${crypto.randomUUID()}`, ...data, active: true, createdAt: new Date().toISOString() };
        const db = await store();
        if (!db) testRecords.set(record.id, record); else await db.insertOne(record);
        return publicRecord(record);
    },
    async remove(id) {
        const db = await store();
        if (!db) { const record = testRecords.get(id); if (record) record.active = false; return Boolean(record); }
        return (await db.updateOne({ id }, { $set: { active: false } })).matchedCount > 0;
    },
    async close() { if (client) await client.close(); client = null; collection = null; },
};
