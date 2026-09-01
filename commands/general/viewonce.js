const { downloadMediaMessage } = require("@whiskeysockets/baileys");

module.exports = {
    name: "viewonceopen",
    aliases: ["viewonce", "vv"],
    description: "Reveal a view-once image or video (Reply to the message)",
    category: "general",
    execute: async (ctx) => {
        const { sock, jid, msg: message } = ctx;

        try {
            console.log("🔍 ViewOnce Debug: Processing command...");
            // Extract quoted imageMessage or videoMessage
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) {
                return await sock.sendMessage(jid, { text: "❌ Please reply to a view-once message." }, { quoted: message });
            }

            // WhatsApp may wrap the quoted media in several nested containers.
            // Unwrap them for type/caption detection; Baileys handles the same
            // structure when downloading the complete quoted message below.
            let mediaContent = quoted;
            for (let i = 0; i < 5; i++) {
                const wrapper = mediaContent?.ephemeralMessage ||
                                mediaContent?.viewOnceMessage ||
                                mediaContent?.viewOnceMessageV2 ||
                                mediaContent?.viewOnceMessageV2Extension ||
                                mediaContent?.documentWithCaptionMessage;
                if (!wrapper?.message) break;
                mediaContent = wrapper.message;
            }

            const imageMsg = mediaContent.imageMessage;
            const videoMsg = mediaContent.videoMessage;

            if (imageMsg) {
                console.log("📸 Found Image Message");
                const buffer = await downloadMediaMessage(
                    { message: quoted },
                    "buffer",
                    {},
                    { logger: console }
                );
                await sock.sendMessage(jid, { image: buffer, caption: imageMsg.caption || '' }, { quoted: message });
            } else if (videoMsg) {
                console.log("🎥 Found Video Message");
                const buffer = await downloadMediaMessage(
                    { message: quoted },
                    "buffer",
                    {},
                    { logger: console }
                );
                await sock.sendMessage(jid, { video: buffer, caption: videoMsg.caption || '' }, { quoted: message });
            } else {
                await sock.sendMessage(jid, { text: '❌ Please reply to a view-once image or video.' }, { quoted: message });
            }
        } catch (err) {
            console.error("❌ ViewOnce Error:", err);
            await sock.sendMessage(jid, { text: `⚠️ Error: ${err.message}` }, { quoted: message });
        }
    }
};
