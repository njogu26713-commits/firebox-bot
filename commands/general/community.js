const CHANNEL_URL = "https://whatsapp.com/channel/0029Vb8elJp77qVJlCeiNX26";
const GROUP_URL = "https://chat.whatsapp.com/IXBsRfMhQh0GMdn8y5QfW5?s=cl&p=a&ilr=4";

const community = {
    name: "community",
    aliases: ["followchannel", "joingroup", "links", "join"],
    category: "general",
    description: "Show the official Firebox community links and let the user opt in.",
    async execute({ sock, jid, msg }) {
        return sock.sendMessage(jid, {
            text: `🌐 *Firebox Community*\n\n` +
                `Follow the official channel:\n${CHANNEL_URL}\n\n` +
                `Join the official group:\n${GROUP_URL}\n\n` +
                `These actions are optional. Open the link and confirm in WhatsApp if you want to follow or join.`
        }, { quoted: msg });
    }
};

module.exports = community;
