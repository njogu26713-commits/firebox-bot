const mongoose = require("mongoose");
const { isOnline, toCompat } = require("../firebox/db");
const jsonStore = require("../firebox/jsonStore");

const SETTINGS_KEY = "bot_settings";

const defaults = {
    publicMode: true,
    antiLink: false, antiTag: false, antiBadword: false,
    antiSpam: true, antiDelete: true, antiEdit: true, antiCall: false,
    statusAntiDelete: false, autoDelete: false, autoDeleteTime: 30000,
    autoViewStatus: true, autoLikeStatus: true, autoReplyStatus: false,
    statusReplyText: "Nice status! ✨",
    statusLikeEmojis: "❤️,✨,🔥,🙌,👍,⭐,💥,🎉,💯,😎,🤩,😍,👏",
    autoRead: false, autoType: false, autoRecord: false,
    alwaysOnline: false, autoBio: false,
    dmPresence: false, groupPresence: false, chatbotAI: false,
    greetDM: false, greetDMMsg: "Hello, how can I help you today!",
    autoReactDM: false, autoReactGrp: false,
    welcome: false, goodbye: false,
    welcomeMsg: "Hi @user, welcome to *@group*! 👋",
    goodbyeMsg: "Goodbye @user, we hope to see you back soon! 😢",
    antiDeleteNotification: "🕵️ *Firebox Anti-Delete Update*",
    footer: "© Firebox Bot • Channel: https://whatsapp.com/channel/0029Vb8elJp77qVJlCeiNX26",
    ownerNumber: "", lockedCommands: "",
    botName: "Firebox Bot", device: "Android", prefix: ".",
    packName: "Firebox Bot", author: "Firebox Studios",
    timezone: "Africa/Nairobi", botImage: "Default",
    hideViewChannel: false, menuStyle: 1,
    antiLinkGlobal: "off", antiLinkLimit: 3,
    antiStatusMentionGlobal: "off", antiStatusMentionLimit: 3,
    groupEventsGlobal: false, eventsPromote: false
};

const settingsSchema = new mongoose.Schema(
    Object.fromEntries(Object.entries(defaults).map(([k, v]) => {
        const type = typeof v === "boolean" ? Boolean :
                     typeof v === "number"  ? Number  : String;
        return [k, { type, default: v }];
    })),
    { timestamps: true }
);

let SettingsDB = null;
try {
    SettingsDB = mongoose.model("Settings");
} catch {
    SettingsDB = mongoose.model("Settings", settingsSchema);
}

const getBotSettings = async () => {
    if (isOnline()) {
        try {
            let doc = await SettingsDB.findOne();
            if (!doc) doc = await SettingsDB.create(defaults);
            return toCompat(doc);
        } catch (e) {
            console.error("❌ getBotSettings Error:", e.message);
        }
    }

    // JSON fallback
    let data = jsonStore.get(SETTINGS_KEY);
    if (!data) {
        data = { ...defaults };
        jsonStore.set(SETTINGS_KEY, data);
    }
    return {
        ...data,
        dataValues: data,
        update: async (updates) => {
            Object.assign(data, updates);
            jsonStore.set(SETTINGS_KEY, data);
            return data;
        },
        save: async () => { jsonStore.set(SETTINGS_KEY, data); return data; }
    };
};

module.exports = {
    SettingsDB,
    getBotSettings,
    initSettingsDB: async () => { /* No-op — Mongoose handles schema sync */ }
};
