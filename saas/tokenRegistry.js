const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { initDb, isOnline } = require("../firebox/db");

const storePath = path.join(__dirname, "..", "database", "firebox_tokens.json");
const configuredSecrets = [
    process.env.FIREBOX_TOKEN_SECRET,
    process.env.FIREBOX_TOKEN_SECRET_PREVIOUS,
    process.env.SESSION_SECRET,
    process.env.SESSION_SECRET_PREVIOUS,
    "firebox-development-secret",
].filter(value => String(value || "").length > 0).map(value => String(value));
const encryptionKeys = [...new Set(configuredSecrets)].map(secret => crypto.createHash("sha256").update(secret).digest());
const encryptionKey = encryptionKeys[0];
const tokenPattern = /^FIREBOX-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const tokenSchema = new mongoose.Schema({
    tokenHash: { type: String, required: true, unique: true, index: true },
    tokenCiphertext: { type: mongoose.Schema.Types.Mixed, required: true },
    phone: { type: mongoose.Schema.Types.Mixed, required: true },
    phoneHash: { type: String, unique: true, sparse: true },
    status: { type: String, default: "active", index: true },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: Date,
    expiresAt: Date,
    planDays: Number,
    requiresPayment: { type: Boolean, default: false },
    paidPaymentRefs: { type: [String], default: [] },
    pairingAttempts: { type: Number, default: 0 },
}, { collection: "firebox_tokens" });
let FireboxToken;
try { FireboxToken = mongoose.model("FireboxToken"); } catch { FireboxToken = mongoose.model("FireboxToken", tokenSchema); }

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
function phoneDigest(phone) { return crypto.createHmac("sha256", encryptionKey).update(phone).digest("hex"); }
function encryptText(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return { iv: iv.toString("base64url"), data: encrypted.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") };
}
function decryptText(payload) {
    let lastError;
    for (const key of encryptionKeys) {
        try {
            const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64url"));
            decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
            return Buffer.concat([decipher.update(Buffer.from(payload.data, "base64url")), decipher.final()]).toString("utf8");
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error("Unable to decrypt Firebox token data.");
}
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
async function useMongo() {
    await initDb();
    return isOnline();
}
function plain(record) {
    const item = record.toObject ? record.toObject() : record;
    let token = null;
    let phone = null;
    let decryptionError = null;
    try { token = item.tokenCiphertext ? decryptText(item.tokenCiphertext) : null; } catch (error) { decryptionError = error; }
    try { phone = decryptPhone(item); } catch (error) { decryptionError = decryptionError || error; }
    return {
        token,
        phone,
        status: item.status,
        createdAt: item.createdAt,
        lastUsedAt: item.lastUsedAt,
        expiresAt: item.expiresAt,
        planDays: Number(item.planDays || 0) || null,
        requiresPayment: item.requiresPayment === true,
        pairingAttempts: Number(item.pairingAttempts || 0),
        decryptionError: decryptionError ? "TOKEN_SECRET_MISMATCH" : null,
    };
}
function samePhone(record, normalized) {
    try { return decryptPhone(record) === normalized; } catch (_) { return false; }
}
function expiryDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

module.exports = {
    normalizePhone,
    async resolveForPayment(token) {
        const normalized = String(token || "").trim().toUpperCase();
        if (!tokenPattern.test(normalized)) throw new Error("Invalid Firebox token format.");
        const hash = hashToken(normalized);
        let record;
        let records;
        const mongo = await useMongo();
        if (mongo) {
            record = await FireboxToken.findOne({ tokenHash: hash }).lean();
        } else {
            records = readRecords();
            record = records.find(item => item.tokenHash === hash);
        }
        if (!record || !["active", "payment_required"].includes(record.status)) {
            throw new Error("Firebox token not found or inactive.");
        }
        // Expiry is enforced when generating pairing codes. An expired token
        // must remain selectable here so its owner can renew the same token.
        return { token: normalized, phone: decryptPhone(record), record, records, mongo };
    },
    async create(phone) {
        const normalized = normalizePhone(phone);
        const token = makeToken();
        const record = {
            tokenHash: hashToken(token),
            tokenCiphertext: encryptText(token),
            phone: encryptText(normalized),
            phoneHash: phoneDigest(normalized),
            status: "payment_required",
            createdAt: new Date(),
            lastUsedAt: null,
            expiresAt: null,
            planDays: null,
            requiresPayment: true,
            paidPaymentRefs: [],
            pairingAttempts: 0,
        };
        if (await useMongo()) {
            const existing = await FireboxToken.find({}).lean();
            if (existing.some(item => samePhone(item, normalized))) {
                throw new Error("This phone number already has a Firebox token. Use the existing token instead.");
            }
            await FireboxToken.create(record);
        } else {
            const records = readRecords();
            if (records.some(item => samePhone(item, normalized))) {
                throw new Error("This phone number already has a Firebox token. Use the existing token instead.");
            }
            record.createdAt = record.createdAt.toISOString();
            writeRecords([...records, record]);
        }
        return token;
    },
    async canPurchase(phone) {
        const normalized = normalizePhone(phone);
        const records = await useMongo() ? await FireboxToken.find({}).lean() : readRecords();
        const existing = records.find(item => samePhone(item, normalized));
        if (!existing) return { allowed: true };
        if (existing.status !== "active") return { allowed: true };
        if (!existing.expiresAt && existing.requiresPayment !== true) {
            return {
                allowed: false,
                message: "This number already has a non-expiring Firebox token. Use that token instead of purchasing another plan.",
            };
        }
        return { allowed: true };
    },
    async applyPaidPlan({ phone, days, reference }) {
        const normalized = normalizePhone(phone);
        const duration = Number(days);
        if (![7, 14, 30].includes(duration)) throw new Error("Invalid Firebox access plan.");
        if (!/^fb-[a-f0-9]{32}$/.test(String(reference || ""))) throw new Error("Invalid payment reference.");

        const mongo = await useMongo();
        const records = mongo ? await FireboxToken.find({}).lean() : readRecords();
        const existing = records.find(item => samePhone(item, normalized));
        if (existing) {
            if ((existing.paidPaymentRefs || []).includes(reference)) return plain(existing);
            if (existing.status === "active" && !existing.expiresAt && existing.requiresPayment !== true) {
                throw new Error("This number already has a non-expiring Firebox token.");
            }
            const priorExpiry = expiryDate(existing.expiresAt);
            const base = priorExpiry && priorExpiry.getTime() > Date.now() ? priorExpiry.getTime() : Date.now();
            const expiresAt = new Date(base + duration * 24 * 60 * 60 * 1000);

            if (mongo) {
                const updated = await FireboxToken.findOneAndUpdate(
                    { tokenHash: existing.tokenHash, paidPaymentRefs: { $ne: reference } },
                    {
                        $set: { status: "active", phoneHash: phoneDigest(normalized), expiresAt, planDays: duration, requiresPayment: false },
                        $addToSet: { paidPaymentRefs: reference },
                    },
                    { new: true },
                ).lean();
                if (updated) return plain(updated);
                const afterRace = await FireboxToken.findOne({ tokenHash: existing.tokenHash }).lean();
                if (afterRace && (afterRace.paidPaymentRefs || []).includes(reference)) return plain(afterRace);
                throw new Error("Could not safely apply the Firebox access plan. Please retry verification.");
            }

            existing.status = "active";
            existing.phoneHash = phoneDigest(normalized);
            existing.expiresAt = expiresAt.toISOString();
            existing.planDays = duration;
            existing.requiresPayment = false;
            existing.paidPaymentRefs = [...new Set([...(existing.paidPaymentRefs || []), reference])];
            writeRecords(records);
            return plain(existing);
        }

        const token = makeToken();
        const now = new Date();
        const record = {
            tokenHash: hashToken(token),
            tokenCiphertext: encryptText(token),
            phone: encryptText(normalized),
            phoneHash: phoneDigest(normalized),
            status: "active",
            createdAt: now,
            lastUsedAt: null,
            expiresAt: new Date(now.getTime() + duration * 24 * 60 * 60 * 1000),
            planDays: duration,
            requiresPayment: false,
            paidPaymentRefs: [reference],
            pairingAttempts: 0,
        };
        if (mongo) {
            try {
                await FireboxToken.create(record);
            } catch (error) {
                if (error.code === 11000) {
                    const raced = await FireboxToken.findOne({ phoneHash: phoneDigest(normalized) }).lean();
                    if (raced) return module.exports.applyPaidPlan({ phone: normalized, days: duration, reference });
                }
                throw error;
            }
            return plain(record);
        }
        record.createdAt = record.createdAt.toISOString();
        record.expiresAt = record.expiresAt.toISOString();
        writeRecords([...records, record]);
        return plain(record);
    },
    async getPaidTokenByReference(reference) {
        const ref = String(reference || "");
        if (!/^fb-[a-f0-9]{32}$/.test(ref)) return null;
        const mongo = await useMongo();
        const record = mongo
            ? await FireboxToken.findOne({ paidPaymentRefs: ref }).lean()
            : readRecords().find(item => (item.paidPaymentRefs || []).includes(ref));
        return record ? plain(record) : null;
    },
    async resolve(token) {
        const normalized = String(token || "").trim().toUpperCase();
        if (!tokenPattern.test(normalized)) throw new Error("Invalid Firebox token format.");
        const hash = hashToken(normalized);
        let record;
        let records;
        if (await useMongo()) {
            record = await FireboxToken.findOne({ tokenHash: hash }).lean();
        } else {
            records = readRecords();
            record = records.find(item => item.tokenHash === hash);
        }
        if (!record || record.status !== "active") {
            if (record && record.requiresPayment === true) throw new Error("A paid access plan is required before this token can generate a pairing code.");
            throw new Error("Firebox token not found or inactive.");
        }
        if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) throw new Error("Firebox token has expired.");
        if (record.requiresPayment === true) throw new Error("A paid access plan is required before this token can generate a pairing code.");
        return { token: normalized, phone: decryptPhone(record), record, records, mongo: await useMongo() };
    },
    async markUsed(resolved) {
        if (resolved.mongo) {
            await FireboxToken.updateOne({ tokenHash: resolved.record.tokenHash }, { $set: { lastUsedAt: new Date() }, $inc: { pairingAttempts: 1 } });
            return;
        }
        resolved.record.lastUsedAt = new Date().toISOString();
        resolved.record.pairingAttempts = Number(resolved.record.pairingAttempts || 0) + 1;
        writeRecords(resolved.records);
    },
    async listAdmin() {
        if (await useMongo()) return (await FireboxToken.find({}).lean()).map(plain);
        return readRecords().map(plain);
    },
    async remove(token) {
        const normalized = String(token || "").trim().toUpperCase();
        if (!tokenPattern.test(normalized)) throw new Error("Invalid Firebox token format.");
        const tokenHash = hashToken(normalized);
        if (await useMongo()) {
            const result = await FireboxToken.deleteOne({ tokenHash });
            return result.deletedCount === 1;
        }
        const records = readRecords();
        const remaining = records.filter(item => item.tokenHash !== tokenHash);
        if (remaining.length === records.length) return false;
        writeRecords(remaining);
        return true;
    },
    async enableFreeMode(token) {
        const normalized = String(token || "").trim().toUpperCase();
        if (!tokenPattern.test(normalized)) throw new Error("Invalid Firebox token format.");
        const tokenHash = hashToken(normalized);
        if (await useMongo()) {
            const updated = await FireboxToken.findOneAndUpdate(
                { tokenHash },
                { $set: { status: "active", expiresAt: null, planDays: null, requiresPayment: false } },
                { new: true },
            ).lean();
            if (!updated) throw new Error("Firebox token not found.");
            return plain(updated);
        }
        const records = readRecords();
        const record = records.find(item => item.tokenHash === tokenHash);
        if (!record) throw new Error("Firebox token not found.");
        record.status = "active";
        record.expiresAt = null;
        record.planDays = null;
        record.requiresPayment = false;
        writeRecords(records);
        return plain(record);
    },
    async listActiveBotIds() {
        const isValid = item => item.status === "active" && (!item.expiresAt || Date.parse(item.expiresAt) >= Date.now());
        if (await useMongo()) {
            return (await FireboxToken.find({ status: "active" }).select({ tokenHash: 1, expiresAt: 1 }).lean())
                .filter(isValid).map(item => item.tokenHash);
        }
        return readRecords().filter(isValid).map(item => item.tokenHash);
    },
};
