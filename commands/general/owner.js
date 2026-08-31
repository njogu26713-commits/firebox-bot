const { ownerNumbers } = require("../../config");

module.exports = {
    name: "owner",
    aliases: ["creator", "master", "boss"],
    description: "Displays the Bot Owner's contact information.",
    category: "general",
    async execute({ sock, jid, msg }) {
        try {
            const primaryOwner = ownerNumbers[0].split("@")[0];
            const vcard = 'BEGIN:VCARD\n' // metadata of the contact card
                + 'VERSION:3.0\n' 
                + 'FN:Brayan\n' // full name
                + 'ORG:Firebox Studios;\n' // the organization of the contact
                + `TEL;type=CELL;type=VOICE;waid=${primaryOwner}:+${primaryOwner}\n` // WhatsApp ID + phone number
                + 'END:VCARD';

            await sock.sendMessage(jid, {
                contacts: {
                    displayName: "Brayan",
                    contacts: [{ vcard }]
                }
            }, { quoted: msg });

            await sock.sendMessage(jid, { 
                text: `👑 *FIREBOX BOT OWNER*\n\n*Owner:* Brayan\n*Company:* Firebox Studios\n*WhatsApp:* +254769564723\n*GitHub:* https://github.com/njogu26713-commits/firebox-bot`
            }, { quoted: msg });

        } catch (err) {
            console.error("Owner card error:", err);
            await sock.sendMessage(jid, { text: "❌ Failed to send owner contact information." });
        }
    }
};
