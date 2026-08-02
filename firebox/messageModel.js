const mongoose = require("mongoose");
const { isOnline } = require("./db");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const jsonStore = require("./jsonStore");
const { getSettings } = require("../lib/settings");
const messageCache = require("../lib/messageCache");

const TEMP_MEDIA_DIR = path.join(__dirname, "../temp_media");
if (!fs.existsSync(TEMP_MEDIA_DIR)) fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });

const messageLogSchema = new mongoose.Schema({
    msgId:       { type: String, required: true, unique: true },
    remoteJid:   { type: String, required: true },
    participant: { type: String },
    pushName:    { type: String },
    messageType: { type: String },
    content:     { type: String },
    mediaPath:   { type: String },
    timestamp:   { type: Number },
}, { timestamps: true });

let MessageLog = null;
try {
    MessageLog = mongoose.model("MessageLog");
} catch {
    MessageLog = mongoose.model("MessageLog", messageLogSchema);
}

const saveMessage = async (m, sock) => {
    try {
        if (!m.message || m.message.protocolMessage) return;

        let mediaPath = null;
        const msgId = m.key.id;
        const message = m.message.viewOnceMessageV2?.message || m.message.viewOnceMessage?.message || m.message;
        const mediaType = message.imageMessage ? "image" : message.videoMessage ? "video" :
                          message.audioMessage ? "audio" : message.stickerMessage ? "sticker" : null;

        const settings = getSettings();
        const isViewOnce = m.message.viewOnceMessageV2 || m.message.viewOnceMessage;
        const shouldDownload = isViewOnce || settings.antiDelete || settings.statusAntiDelete;

        if (mediaType && sock && shouldDownload) {
            try {
                const mediaMsg = message[`${mediaType}Message`];
                const size = mediaMsg?.fileLength ? parseInt(mediaMsg.fileLength, 10) : 0;
                if (size < 15 * 1024 * 1024) {
                    const ext = { image: "jpg", video: "mp4", audio: "mp3", sticker: "webp" }[mediaType];
                    const stream = await downloadContentFromMessage(mediaMsg, mediaType);
                    const chunks = [];
                    for await (const chunk of stream) chunks.push(chunk);
                    const filePath = path.join(TEMP_MEDIA_DIR, `${msgId}.${ext}`);
                    await fs.promises.writeFile(filePath, Buffer.concat(chunks));
                    mediaPath = filePath;
                }
            } catch {}
        }

        if (isOnline()) {
            await MessageLog.findOneAndUpdate(
                { msgId },
                {
                    msgId,
                    remoteJid: m.key.remoteJid,
                    participant: m.key.participant || m.key.remoteJid,
                    pushName: m.pushName,
                    messageType: Object.keys(m.message)[0],
                    content: JSON.stringify(m.message),
                    mediaPath,
                    timestamp: m.messageTimestamp,
                },
                { upsert: true, new: true }
            ).catch(() => {});
        } else {
            const textContent = (message.conversation || message.extendedTextMessage?.text ||
                                 message.imageMessage?.caption || message.videoMessage?.caption || "");
            messageCache.setLog(m.key.id, {
                msgId: m.key.id,
                remoteJid: m.key.remoteJid,
                participant: m.key.participant || m.key.remoteJid,
                pushName: m.pushName,
                messageType: Object.keys(m.message)[0],
                content: textContent ? { conversation: textContent } : m.message,
                mediaPath,
                timestamp: m.messageTimestamp,
            });
        }

        // Always maintain rolling JSON buffer for AI summarization
        const textContent = (message.conversation || message.extendedTextMessage?.text ||
                             message.imageMessage?.caption || "").trim();
        if (textContent) {
            const history = jsonStore.get(`history_${m.key.remoteJid}`) || [];
            history.push({ name: m.pushName || "User", text: textContent, time: m.messageTimestamp });
            if (history.length > 50) history.shift();
            jsonStore.set(`history_${m.key.remoteJid}`, history);
        }
    } catch {}
};

const getMessage = async (msgId) => {
    try {
        if (isOnline()) {
            const log = await MessageLog.findOne({ msgId }).lean();
            return log ? { ...log, content: JSON.parse(log.content) } : null;
        }
        return messageCache.getLog(msgId) || null;
    } catch {
        return null;
    }
};

const getGroupHistory = async (jid, limit = 50) => {
    try {
        if (isOnline()) {
            const logs = await MessageLog.find({ remoteJid: jid })
                .sort({ timestamp: -1 }).limit(limit).lean();
            return logs.map(l => ({
                name: l.pushName || "User",
                text: (() => { try { const c = JSON.parse(l.content); return c.conversation || c.extendedTextMessage?.text || ""; } catch { return ""; } })(),
                time: l.timestamp
            })).reverse();
        }
        return (jsonStore.get(`history_${jid}`) || []).slice(-limit);
    } catch {
        return [];
    }
};

module.exports = { MessageLog, saveMessage, getMessage, getGroupHistory };
