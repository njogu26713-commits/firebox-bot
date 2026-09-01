const activeGroups = new Set();
const MAX_RECIPIENTS = 50;
const MESSAGE_MAX_LENGTH = 1000;
const DELAY_MS = 1200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
    name: "dmgroup",
    aliases: ["groupdm"],
    description: "Send a confirmed direct message to group members (owner only).",
    category: "admin",
    isOwnerOnly: true,
    isGroupOnly: true,
    async execute({ sock, jid, args, msg }) {
        const action = (args[0] || "").toLowerCase();
        const message = args.slice(1).join(" ").trim();

        if (action !== "confirm" || !message) {
            return await sock.sendMessage(jid, {
                text: "❓ *Usage:* `.dmgroup confirm <message>`\n\nThis sends one direct message to each member of the current group. Owner-only, maximum 50 recipients, and paced to reduce accidental spam."
            }, { quoted: msg });
        }

        if (message.length > MESSAGE_MAX_LENGTH) {
            return await sock.sendMessage(jid, { text: `⚠️ Keep the direct message under ${MESSAGE_MAX_LENGTH} characters.` }, { quoted: msg });
        }

        if (activeGroups.has(jid)) {
            return await sock.sendMessage(jid, { text: "⏳ A group DM is already being sent for this group. Please wait for its summary." }, { quoted: msg });
        }

        activeGroups.add(jid);
        try {
            const metadata = await sock.groupMetadata(jid);
            const botNumber = sock.user?.id?.split(":")[0];
            const botJid = botNumber ? `${botNumber}@s.whatsapp.net` : null;
            const recipients = (metadata?.participants || [])
                .map((participant) => participant.id)
                .filter((participantJid) => participantJid && participantJid !== botJid && !participantJid.endsWith("@g.us"));

            if (recipients.length === 0) {
                return await sock.sendMessage(jid, { text: "⚠️ No direct-message recipients were found in this group." }, { quoted: msg });
            }
            if (recipients.length > MAX_RECIPIENTS) {
                return await sock.sendMessage(jid, {
                    text: `⚠️ This group has ${recipients.length} members. The safety limit is ${MAX_RECIPIENTS} recipients; no messages were sent.`
                }, { quoted: msg });
            }

            const groupName = metadata.subject || "the group";
            const directMessage = `📢 *Message from ${groupName}*\n\n${message}`;
            await sock.sendMessage(jid, {
                text: `⏳ Sending the confirmed message privately to ${recipients.length} group member(s).`
            }, { quoted: msg });

            let sent = 0;
            let failed = 0;
            for (const recipientJid of recipients) {
                try {
                    await sock.sendMessage(recipientJid, { text: directMessage });
                    sent += 1;
                } catch (error) {
                    failed += 1;
                    console.error(`dmgroup failed for ${recipientJid}:`, error.message);
                }
                if (recipientJid !== recipients[recipients.length - 1]) await sleep(DELAY_MS);
            }

            return await sock.sendMessage(jid, {
                text: `✅ *Group DM complete*\n\n*Sent:* ${sent}\n*Failed:* ${failed}\n*Total:* ${recipients.length}`
            }, { quoted: msg });
        } catch (error) {
            console.error("dmgroup error:", error);
            return await sock.sendMessage(jid, { text: "❌ Could not read this group or send the direct messages." }, { quoted: msg });
        } finally {
            activeGroups.delete(jid);
        }
    }
};
