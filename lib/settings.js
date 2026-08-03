const { getBotSettings } = require("../database/settings");
const botContext = require("./botContext");

/**
 * Bridge between Database and the rest of the bot.
 * In SaaS mode, reads/writes from the current user's settings
 * via AsyncLocalStorage. Falls back to the global singleton for
 * single-user / non-SaaS operation.
 */

const defaultSettings = { 
    publicMode: true,
    antiLink: false,
    antiTag: false,
    antiBadword: false,
    antiSpam: true,
    antiDelete: true,
    antiEdit: true,
    antiCall: false,
    statusAntiDelete: false,
    autoDelete: false,
    autoDeleteTime: 30000,
    autoViewStatus: true,
    autoLikeStatus: true,
    autoReplyStatus: false,
    statusReplyText: 'Nice status! ✨',
    statusLikeEmojis: '❤️,✨,🔥,🙌,👍,⭐,💥,🎉,💯,😎,🤩,😍,👏',
    autoRead: false,
    autoType: false,
    autoRecord: false,
    alwaysOnline: false,
    autoBio: false,
    dmPresence: false,
    groupPresence: false,
    chatbotAI: false,
    greetDM: false,
    greetDMMsg: 'Hello, how can i help you today!',
    autoReactDM: false,
    autoReactGrp: false,
    welcome: false,
    goodbye: false,
    welcomeMsg: 'Hi @user, welcome to *@group*! 👋',
    goodbyeMsg: 'Goodbye @user, we hope to see you back soon! 😢',
    antiDeleteNotification: '🕵️ *Firebox Anti-Delete Update*',
    footer: '© Firebox Bot • Channel: https://whatsapp.com/channel/0029Vb8elJp77qVJlCeiNX26',
    ownerNumber: '',
    lockedCommands: '',
    botName: 'Firebox Bot',
    device: 'Android',
    prefix: '.',
    packName: 'Firebox Bot',
    author: 'Firebox Studios',
    timezone: 'Africa/Nairobi',
    botImage: 'Default',
    hideViewChannel: false,
    menuStyle: 1,
    antiLinkGlobal: 'off',
    antiLinkLimit: 3,
    antiStatusMentionGlobal: 'off',
    antiStatusMentionLimit: 3,
    groupEventsGlobal: false,
    eventsPromote: false
};

// Global singleton cache for non-SaaS / legacy use
let globalSettingsCache = null;

const loadSettings = async () => {
    const ctx = botContext.getStore();
    if (ctx && ctx.settingsManager) {
        return ctx.settingsManager.load();
    }
    globalSettingsCache = await getBotSettings();
    if (globalSettingsCache) {
        await _enforceDefaults(globalSettingsCache);
    }
    return globalSettingsCache;
};

const getSettings = () => {
    const ctx = botContext.getStore();
    if (ctx && ctx.settingsCache) {
        return ctx.settingsCache;
    }
    return globalSettingsCache || { ...defaultSettings };
};

const updateSettings = async (updates) => {
    const ctx = botContext.getStore();
    if (ctx && ctx.settingsManager) {
        return ctx.settingsManager.update(updates);
    }
    if (!globalSettingsCache) await loadSettings();
    if (globalSettingsCache) {
        for (const [key, value] of Object.entries(updates)) {
            globalSettingsCache[key] = value;
            if (globalSettingsCache.dataValues) {
                globalSettingsCache.dataValues[key] = value;
            }
        }
        await globalSettingsCache.update(updates);
    }
    return globalSettingsCache;
};

async function _enforceDefaults(cache) {
    let needsUpdate = false;
    const updates = {};
    for (const [key, defaultValue] of Object.entries(defaultSettings)) {
        if (cache[key] === null || cache[key] === undefined) {
            updates[key] = defaultValue;
            cache[key] = defaultValue;
            if (cache.dataValues) cache.dataValues[key] = defaultValue;
            needsUpdate = true;
        }
    }
    if (cache.packName && (cache.packName.includes("BWM") || cache.packName.includes("bwm"))) {
        cache.packName = "Firebox Bot"; updates.packName = "Firebox Bot";
        if (cache.dataValues) cache.dataValues.packName = "Firebox Bot";
        needsUpdate = true;
    }
    if (cache.author && (cache.author.includes("Ibrahim") || cache.author.includes("ibrahim") || cache.author.includes("White Wizard"))) {
        cache.author = "Firebox Studios"; updates.author = "Firebox Studios";
        if (cache.dataValues) cache.dataValues.author = "Firebox Studios";
        needsUpdate = true;
    }
    if (needsUpdate) {
        try {
            if (typeof cache.update === "function") await cache.update(updates);
            else if (typeof cache.save === "function") await cache.save();
        } catch (e) {
            console.error("⚠️ Failed to update setting defaults:", e.message);
        }
    }
}

module.exports = { 
    getSettings, 
    updateSettings,
    loadSettings,
    defaultSettings,
    _enforceDefaults,
};
