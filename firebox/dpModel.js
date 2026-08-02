const mongoose = require("mongoose");
const { isOnline } = require("./db");
const jsonStore = require("./jsonStore");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const crypto = require("crypto");

const dpSchema = new mongoose.Schema({
    jid:       { type: String, required: true },
    imageUrl:  { type: String, required: true },
    localPath: { type: String },
    hash:      { type: String },
}, { timestamps: true });

let DpHistory = null;
try {
    DpHistory = mongoose.model("DpHistory");
} catch {
    DpHistory = mongoose.model("DpHistory", dpSchema);
}

const getHash = (buf) => crypto.createHash("md5").update(buf).digest("hex");

const saveDpRecord = async (jid, imageUrl, localPath, hash) => {
    if (isOnline()) {
        try {
            await DpHistory.create({ jid, imageUrl, localPath, hash });
            return;
        } catch (e) {
            console.error("❌ saveDpRecord Error:", e.message);
        }
    }
    const key = `dp_history_${jid}`;
    const history = jsonStore.get(key, []);
    history.unshift({ jid, imageUrl, localPath, hash, createdAt: new Date() });
    if (history.length > 20) {
        const removed = history.pop();
        if (removed?.localPath && fs.existsSync(removed.localPath)) {
            try { fs.unlinkSync(removed.localPath); } catch {}
        }
    }
    jsonStore.set(key, history);
};

const getDpHistory = async (jid) => {
    if (isOnline()) {
        try {
            return await DpHistory.find({ jid }).sort({ createdAt: -1 }).lean();
        } catch (e) {
            console.error("❌ getDpHistory Error:", e.message);
        }
    }
    return jsonStore.get(`dp_history_${jid}`, []);
};

const trackDp = async (sock, jid) => {
    try {
        let dpUrl;
        try {
            dpUrl = await sock.profilePictureUrl(jid, "image");
        } catch {
            return { changed: false, error: "No public profile picture found." };
        }

        const history = await getDpHistory(jid);
        const lastRecord = history[0];
        const response = await axios.get(dpUrl, { responseType: "arraybuffer", timeout: 15000 });
        const buffer = Buffer.from(response.data);
        const hash = getHash(buffer);

        if (lastRecord && lastRecord.hash === hash) {
            return { changed: false, imageUrl: dpUrl, localPath: lastRecord.localPath, hash };
        }

        const cleanJid = jid.split("@")[0];
        const dir = path.join(__dirname, "../assets/dp_history");
        fs.mkdirSync(dir, { recursive: true });
        const localPath = path.join(dir, `${cleanJid}_${Date.now()}.png`);
        fs.writeFileSync(localPath, buffer);
        await saveDpRecord(jid, dpUrl, localPath, hash);

        return { changed: true, imageUrl: dpUrl, localPath, hash };
    } catch (e) {
        console.error("❌ trackDp Error:", e.message);
        return { changed: false, error: e.message };
    }
};

module.exports = { trackDp, getDpHistory };
