const mediaApi = require("../../lib/mediaApi");

module.exports = {
    name: "yt",
    aliases: ["youtube", "video"],
    description: "Download YouTube videos.",
    category: "download",
    async execute({ sock, jid, args, msg }) {
        const url = args[0];
        if (!url || !url.includes("youtube.com") && !url.includes("youtu.be")) {
            return await sock.sendMessage(jid, { text: "❓ *Usage:* `.yt <link>`" });
        }

        await sock.sendMessage(jid, { text: "⬇️ *DOWNLOADING...*" }, { quoted: msg });

        try {
            const audio = await mediaApi.ytDownload(url);
            
            if (!audio) {
                return await sock.sendMessage(jid, { text: "❌ *ERROR OCCURRED — TRY AGAIN LATER.*" }, { quoted: msg });
            }


            if (audio.buffer) {
                await sock.sendPresenceUpdate('recording', jid);
                await sock.sendMessage(jid, { 
                    audio: audio.buffer,
                    mimetype: "audio/mpeg",
                    fileName: `${audio.title || "audio"}.mp3`,
                    caption: `🎵 *YouTube Audio*\n\n✨ *Title:* ${audio.title || "Unknown"}\n📦 *Format:* MP3\n\n_Firebox Bot • Media Delivery_`
                }, { quoted: msg });
            } else {
                await sock.sendMessage(jid, { text: "❌ *ERROR OCCURRED — TRY AGAIN LATER.*" }, { quoted: msg });
            }


        } catch (err) {
            console.error("YouTube error:", err);
            await sock.sendMessage(jid, { text: "❌ *ERROR OCCURRED — TRY AGAIN LATER.*" }, { quoted: msg });
        }
    }
};

