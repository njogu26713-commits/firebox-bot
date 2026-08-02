const os = require("os");

module.exports = {
    name: "botinfo",
    aliases: ["info", "system"],
    description: "Check detailed bot info.",
    category: "general",
    execute: async ({ sock, jid }) => {
        const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        
        const info = `🤖 *FIREBOX BOT SYSTEM INFO*\n\n` +
                     `✨ *Version:* \`2.5.0 (Moderation)\`\n` +
                     `👨‍💻 *Developer:* \`Firebox Studios\`\n` +
                     `📂 *GitHub:* https://github.com/njogu26713-commits/firebox-bot\n` +
                     `💬 *Support:* https://chat.whatsapp.com/E8BOikeeP9a0ds2odgneHy\n\n` +
                     `💻 *Platform:* \`${os.platform()}\`\n` +
                     `📟 *Memory:* \`${memory}MB / ${totalMem}GB\`\n` +
                     `🔋 *Node:* \`${process.version}\`\n\n` +
                     `_Firebox Bot is a high-performance bot designed for professional group management._`;
        
        await sock.sendMessage(jid, { text: info });
    }
};
