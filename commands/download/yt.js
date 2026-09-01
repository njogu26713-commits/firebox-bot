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
            const video = await mediaApi.ytDownload(url, { type: "video" });
            
            if (!video) {
                return await sock.sendMessage(jid, { text: "❌ *ERROR OCCURRED — TRY AGAIN LATER.*" }, { quoted: msg });
            }

            if (video.buffer) {
                await sock.sendPresenceUpdate('recording', jid);
                await sock.sendMessage(jid, {
                    video: video.buffer,
                    mimetype: "video/mp4",
                    fileName: `${video.title || "video"}.mp4`,
                    caption: `🎬 *YouTube Video*\n\n✨ *Title:* ${video.title || "Unknown"}\n📦 *Format:* MP4\n\n_Firebox Bot • Media Delivery_`
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

