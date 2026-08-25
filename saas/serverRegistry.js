const crypto = require("crypto");
const { MongoClient } = require("mongodb");

function connectionUri() { return process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL; }
const databaseName = process.env.MONGODB_DATABASE || "firebox";
const collectionName = process.env.MONGODB_SERVERS_COLLECTION || "servers";
let client;
let collection;
const testRecords = new Map();

function publicRecord(record) {
    return { id: record.id, name: record.name, publicUrl: record.publicUrl, active: record.active, createdAt: record.createdAt };
}
function adminRecord(record) {
    return { id: record.id, name: record.name, botId: record.botId, hubUrl: record.hubUrl, publicUrl: record.publicUrl, active: record.active, createdAt: record.createdAt };
}
async function store() {
    if (process.env.NODE_ENV === "test") return null;
    const uri = connectionUri();
    if (!uri) throw new Error("Railway MongoDB is not connected. Add a reference variable named MONGO_URL or set MONGODB_URI.");
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
    async listAdmin() {
        const db = await store();
        if (!db) return [...testRecords.values()].filter(record => record.active).map(adminRecord);
        return (await db.find({ active: true }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()).map(adminRecord);
    },
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
    async upsertByBotId(input) {
        const data = validate(input);
        const db = await store();
        if (!db) {
            const existing = [...testRecords.values()].find(record => record.botId === data.botId);
            const record = existing ? { ...existing, ...data, active: true, updatedAt: new Date().toISOString() } : { id: `server_${crypto.randomUUID()}`, ...data, active: true, createdAt: new Date().toISOString() };
            testRecords.set(record.id, record);
            return publicRecord(record);
        }
        const existing = await db.findOne({ botId: data.botId }, { projection: { _id: 0 } });
        const now = new Date().toISOString();
        const record = { id: existing?.id || `server_${crypto.randomUUID()}`, ...data, active: true, createdAt: existing?.createdAt || now, updatedAt: now };
        await db.replaceOne({ id: record.id }, record, { upsert: true });
        return publicRecord(record);
    },
    async remove(id) {
        const db = await store();
        if (!db) { const record = testRecords.get(id); if (record) record.active = false; return Boolean(record); }
        return (await db.updateOne({ id }, { $set: { active: false } })).matchedCount > 0;
    },
    async close() { if (client) await client.close(); client = null; collection = null; },
};
