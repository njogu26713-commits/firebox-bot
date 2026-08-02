const { BufferJSON, initAuthCreds, proto } = require("@whiskeysockets/baileys");
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const mongoose = require("mongoose");
const { isOnline } = require("./db");

const authSchema = new mongoose.Schema({
    keyId: { type: String, required: true, unique: true },
    value: { type: String },
}, { timestamps: true });

let BaileysAuth = null;
try {
    BaileysAuth = mongoose.model("BaileysAuth");
} catch {
    BaileysAuth = mongoose.model("BaileysAuth", authSchema);
}

async function useDatabaseAuthState(sessionName = "session") {
    if (!isOnline()) {
        console.log("💾 MongoDB offline. Falling back to useMultiFileAuthState.");
        return useMultiFileAuthState(sessionName);
    }

    const writeData = async (data, keyId) => {
        try {
            const value = JSON.stringify(data, BufferJSON.replacer);
            await BaileysAuth.findOneAndUpdate({ keyId }, { keyId, value }, { upsert: true, new: true });
        } catch (e) {
            console.error("❌ Auth write error:", e.message);
        }
    };

    const readData = async (keyId) => {
        try {
            const record = await BaileysAuth.findOne({ keyId }).lean();
            return record ? JSON.parse(record.value, BufferJSON.reviver) : null;
        } catch (e) {
            console.error("❌ Auth read error:", e.message);
            return null;
        }
    };

    const removeData = async (keyId) => {
        try {
            await BaileysAuth.deleteOne({ keyId });
        } catch (e) {
            console.error("❌ Auth remove error:", e.message);
        }
    };

    const credsKey = `${sessionName}_creds`;
    let creds = await readData(credsKey);
    if (!creds) {
        creds = initAuthCreds();
        await writeData(creds, credsKey);
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        const keyId = `${sessionName}_${type}_${id}`;
                        let value = await readData(keyId);
                        if (type === "app-state-sync-key" && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const keyId = `${sessionName}_${category}_${id}`;
                            tasks.push(value ? writeData(value, keyId) : removeData(keyId));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => writeData(creds, credsKey)
    };
}

module.exports = { useDatabaseAuthState };
