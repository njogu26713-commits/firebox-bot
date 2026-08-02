const fs = require("fs");
const path = require("path");

module.exports = {
    name: "repo",
    aliases: ["github", "source", "script"],
    description: "Get the bot's source code repository link.",
    category: "general",
    execute: async ({ sock, jid, msg }) => {
        const text = `📂 *FIREBOX BOT SOURCE CODE*\n\n` +
                     `You can get the bot script and deployment guide from the official repository:\n\n` +
                     `🔗 *GitHub:* https://github.com/devwhitewizard/firebox-v1md\n` +
                     `📢 *Official Channel:* https://whatsapp.com/channel/0029Vb8elJp77qVJlCeiNX26\n` +
                     `💬 *Support Group:* https://chat.whatsapp.com/CSPKnrOIG52LdMO06pZgNe\n\n` +
                     `👤 *Developer:* White Wizard\n` +
                     `🌐 *Portfolio:* https://jonathanmwanza.vercel.app/\n\n` +
                     `_Don't forget to give a ⭐ if you like the project!_`;

        const { getSettings } = require("../../lib/settings");
        const settings = getSettings();
        const botImageUrl = settings.botImage;

        let banner;
        if (botImageUrl && botImageUrl.startsWith("http")) {
            banner = { url: botImageUrl };
        } else {
            const bannerPath = path.join(__dirname, "../../assets/Fireboxpic.jpg");
            banner = fs.existsSync(bannerPath) ? fs.readFileSync(bannerPath) : null;
        }

        const { sendButtonMessage } = require("../../lib/utils");
        const footerText = "Firebox Bot Script";
        const buttons = [
            { text: "💻 Bot Repo", url: "https://github.com/devwhitewizard/firebox-v1md" },
            { text: "📢 WhatsApp Channel", url: "https://whatsapp.com/channel/0029Vb8elJp77qVJlCeiNX26" }
        ];

        await sendButtonMessage(sock, jid, text, footerText, buttons, banner, msg);
    }
};
