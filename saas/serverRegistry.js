const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const registryFile = process.env.FIREBOX_SERVER_REGISTRY_FILE || path.join(__dirname, "../data/servers.json");
const encryptionSecret = process.env.FIREBOX_REGISTRY_SECRET || process.env.SESSION_SECRET;
if (!encryptionSecret) throw new Error("FIREBOX_REGISTRY_SECRET or SESSION_SECRET is required for the server registry.");

const key = crypto.createHash("sha256").update(encryptionSecret).digest();
function ensureDirectory() { fs.mkdirSync(path.dirname(registryFile), { recursive: true }); }
function encrypt(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return { iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), data: encrypted.toString("base64url") };
}
function decrypt(record) {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(record.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(record.tag, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.data, "base64url")), decipher.final()]).toString("utf8"));
}
function read() {
    ensureDirectory();
    if (!fs.existsSync(registryFile)) return [];
    try { return JSON.parse(fs.readFileSync(registryFile, "utf8")).map(decrypt); } catch (error) { throw new Error(`Could not read server registry: ${error.message}`); }
}
function write(records) { ensureDirectory(); fs.writeFileSync(registryFile, JSON.stringify(records.map(encrypt), null, 2), { mode: 0o600 }); }
function publicRecord(record) { return { id: record.id, name: record.name, publicUrl: record.publicUrl, active: record.active, createdAt: record.createdAt }; }

module.exports = {
    list() { return read().filter(record => record.active).map(publicRecord); },
    get(id) { return read().find(record => record.id === id && record.active) || null; },
    add(input) {
        const name = String(input.name || "").trim().slice(0, 120);
        const publicUrl = String(input.publicUrl || "").trim().replace(/\/$/, "");
        const hubUrl = String(input.hubUrl || "").trim().replace(/\/$/, "");
        const botId = String(input.botId || "").trim();
        const botKey = String(input.botKey || "").trim();
        if (!name || !/^https?:\/\//i.test(publicUrl) || !/^https?:\/\//i.test(hubUrl) || !botId || !botKey) throw new Error("Name, public URL, hub URL, bot ID, and bot key are required.");
        const records = read();
        const record = { id: `server_${crypto.randomUUID()}`, name, publicUrl, hubUrl, botId, botKey, active: true, createdAt: new Date().toISOString() };
        records.push(record); write(records); return publicRecord(record);
    },
    remove(id) { const records = read(); const next = records.map(record => record.id === id ? { ...record, active: false } : record); write(next); return next.some(record => record.id === id); },
};
