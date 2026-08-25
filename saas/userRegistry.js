const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { MongoClient } = require("mongodb");

function connectionUri() { return process.env.MONGODB_URI || process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL; }
const databaseName = process.env.MONGODB_DATABASE || "firebox";
const collectionName = process.env.MONGODB_USERS_COLLECTION || "users";
let client;
let collection;
const testUsers = new Map();

function publicUser(user) { return { id: user.id, name: user.name, email: user.email }; }
async function store() {
    if (process.env.NODE_ENV === "test") return null;
    const uri = connectionUri();
    if (!uri) throw new Error("Railway MongoDB is not connected. Add MONGO_URL or set MONGODB_URI.");
    if (!collection) {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
        await client.connect();
        collection = client.db(databaseName).collection(collectionName);
        await collection.createIndex({ id: 1 }, { unique: true });
        await collection.createIndex({ email: 1 }, { unique: true });
    }
    return collection;
}
function normalize(input) {
    const name = String(input.name || "").trim().slice(0, 80);
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password || "");
    if (name.length < 2) throw new Error("Name must be at least 2 characters.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    return { name, email, password };
}
module.exports = {
    async create(input) {
        const data = normalize(input);
        const existing = await this.findByEmail(data.email);
        if (existing) throw new Error("An account with that email already exists.");
        const user = { id: `user_${crypto.randomUUID()}`, name: data.name, email: data.email, passwordHash: await bcrypt.hash(data.password, 12), createdAt: new Date().toISOString() };
        const db = await store();
        if (!db) testUsers.set(user.id, user); else await db.insertOne(user);
        return publicUser(user);
    },
    async list() {
        const db = await store();
        if (!db) return [...testUsers.values()].map(publicUser);
        return (await db.find({}, { projection: { _id: 0, id: 1, name: 1, email: 1, createdAt: 1 } }).sort({ createdAt: -1 }).toArray()).map(publicUser);
    },
    async findByEmail(email) {
        const normalized = String(email || "").trim().toLowerCase();
        const db = await store();
        if (!db) return [...testUsers.values()].find(user => user.email === normalized) || null;
        return db.findOne({ email: normalized });
    },
    async verify(email, password) {
        const user = await this.findByEmail(email);
        if (!user || !(await bcrypt.compare(String(password || ""), user.passwordHash))) return null;
        return publicUser(user);
    },
    async close() { if (client) await client.close(); client = null; collection = null; },
};
