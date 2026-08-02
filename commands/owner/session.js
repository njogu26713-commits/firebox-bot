const fs = require("fs");
const path = require("path");
const { authFolder } = require("../../config");

module.exports = {
    name: "session",
    aliases: ["getsession", "id", "sessionid"],
    description: "Generate a Session ID for deployment.",
    category: "owner",
    ownerOnly: true,
    async execute({ sock, jid, msg }) {
        try {
            const credsPath = path.join(process.cwd(), authFolder, "creds.json");

            if (!fs.existsSync(credsPath)) {
                return await sock.sendMessage(jid, { text: "❌ *Error:* No credentials found. Are you logged in?" });
            }

            const creds = fs.readFileSync(credsPath, "utf-8");
            const sessionId = Buffer.from(creds).toString("base64");
            const finalizedId = `FIREBOX~${sessionId}`;

            await sock.sendMessage(jid, { text: finalizedId });

        } catch (err) {
            console.error("Session ID Error:", err);
            await sock.sendMessage(jid, { text: "❌ Failed to generate Session ID." });
        }
    }
};
