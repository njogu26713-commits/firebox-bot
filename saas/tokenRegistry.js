const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const storePath = path.join(__dirname, "..", "database", "firebox_tokens.json");
const encryptionKey = crypto.createHash("sha256").update(String(process.env.FIREBOX_TOKEN_SECRET || process.env.SESSION_SECRET || "firebox-development-secret")).digest();
const tokenPattern = /^FIREBOX-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function readRecords() {
    try { return JSON.parse(fs.readFileSync(storePath, "utf8")); } catch { return []; }
}
function writeRecords(records) {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    const temp = `${storePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(records, null, 2));
    fs.renameSync(temp, storePath);
}
function hashToken(token) { return crypto.createHash("sha256").update(token).digest("hex"); }
function encryptText(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return { iv: iv.toString("base64url"), data: encrypted.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") };
}
function decryptText(payload) {
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(payload.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(payload.data, "base64url")), decipher.final()]).toString("utf8");
}
function encryptPhone(phone) { return encryptText(phone); }
function decryptPhone(record) { return decryptText(record.phone); }
function makeToken() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const part = () => Array.from({ length: 4 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
    return `FIREBOX-${part()}-${part()}`;
}
function normalizePhone(phone) {
    const clean = String(phone || "").replace(/\D/g, "");
    if (clean.length < 7 || clean.length > 15) throw new Error("Invalid phone number. Include country code.");
    return clean;
}

module.exports = {
    create(phone) {
        const normalized = normalizePhone(phone);
        const records = readRecords();
        const alreadyHasToken = records.some(record => {
            try { return decryptPhone(record) === normalized; } catch (_) { return false; }
        });
        if (alreadyHasToken) {
            throw new Error("This phone number already has a Firebox token. Use the existing token instead.");
        }
        let token;
        do { token = makeToken(); } while (records.some(record => record.tokenHash === hashToken(token)));
        records.push({ tokenHash: hashToken(token), tokenCiphertext: encryptText(token), phone: encryptPhone(normalized), status: "active", createdAt: new Date().toISOString(), lastUsedAt: null, expiresAt: null, pairingAttempts: 0 });
        writeRecords(records);
        return token;
    },
    resolve(token) {
        const normalized = String(token || "").trim().toUpperCase();
        if (!tokenPattern.test(normalized)) throw new Error("Invalid Firebox token format.");
        const records = readRecords();
        const record = records.find(item => item.tokenHash === hashToken(normalized));
        if (!record || record.status !== "active") throw new Error("Firebox token not found or inactive.");
        if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) throw new Error("Firebox token has expired.");
        return { token: normalized, phone: decryptPhone(record), record, records };
    },
    markUsed(resolved) {
        resolved.record.lastUsedAt = new Date().toISOString();
        resolved.record.pairingAttempts = Number(resolved.record.pairingAttempts || 0) + 1;
        writeRecords(resolved.records);
    },
    listAdmin() {
        return readRecords().map(record => ({
            token: record.tokenCiphertext ? decryptText(record.tokenCiphertext) : null,
            phone: decryptPhone(record),
            status: record.status,
            createdAt: record.createdAt,
            lastUsedAt: record.lastUsedAt,
            expiresAt: record.expiresAt,
            pairingAttempts: Number(record.pairingAttempts || 0),
        }));
    },
};
