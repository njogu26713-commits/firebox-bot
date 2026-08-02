const fs = require("fs");
const path = require("path");

module.exports = {
    name: "dev",
    aliases: ["developer", "creator", "wizard"],
    description: "Short info about the developer.",
    category: "general",
    execute: async ({ sock, jid, msg }) => {
        const text = `👨‍💻 *DEVELOPER PROFILE*\n\n` +
                     `✨ *Name:* Firebox Studios\n` +
                     `🌐 *WhatsApp:* https://wa.me/254769564723\n` +
                     `👨‍💻 *Bio:* Building powerful WhatsApp bots and automation tools for everyone!\n\n` +
                     `📂 *GitHub:* https://github.com/njogu26713-commits/firebox-bot\n\n` +
                     `_\"Built with passion by Firebox Studios.\"_`;

        const { getSettings } = require("../../lib/settings");
        const settings = getSettings();
        const botImageUrl = settings.botImage;

        try {
            let banner;
            if (botImageUrl && botImageUrl.startsWith("http")) {
                banner = { url: botImageUrl };
            } else {
                const imgPath = path.join(__dirname, "../../assets/Fireboxpic.jpg");
                banner = fs.readFileSync(imgPath);
            }
            await sock.sendMessage(jid, { image: banner, caption: text }, { quoted: msg });
        } catch (e) {
            await sock.sendMessage(jid, { text }, { quoted: msg });
        }
    }
};
