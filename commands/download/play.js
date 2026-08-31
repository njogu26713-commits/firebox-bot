const mediaApi = require("../../lib/mediaApi");

module.exports = {
    name: "play",
    aliases: ["song", "music"],
    description: "Search and download music.",
    category: "download",
    cooldown: 15000,
    async execute({ sock, jid, args, msg }) {
        const query = args.join(" ");
        if (!query) return await sock.sendMessage(jid, { text: "❓ *Usage:* `.play <song name>`" });

        await sock.sendPresenceUpdate('composing', jid);
        await sock.sendMessage(jid, { text: "⬇️ *DOWNLOADING...*" }, { quoted: msg });


        try {
            const results = await mediaApi.ytSearch(query);
            if (!results || results.length === 0) {
                return await sock.sendMessage(jid, { text: "❌ No results found. Try a different name." });
            }

            const video = results[0];
            
            const audio = await mediaApi.ytDownload(video.url);
            if (!audio) {
                return await sock.sendMessage(jid, { text: "❌ *ERROR OCCURRED — TRY AGAIN LATER.*" }, { quoted: msg });
            }


            if (audio.buffer) {
                await sock.sendPresenceUpdate('recording', jid);
                await sock.sendMessage(jid, { 
                    audio: audio.buffer,
                    mimetype: "audio/mpeg",
                    ptt: false
                }, { quoted: msg });
            } else {
                await sock.sendMessage(jid, { text: "❌ *ERROR OCCURRED — TRY AGAIN LATER.*" }, { quoted: msg });
            }
            
            if (audio.buffer) await sock.sendMessage(jid, { text: `✅ *Finished:* ${audio.title || video.title}` });

        } catch (err) {
            console.error("Play error:", err);
            await sock.sendMessage(jid, { text: "❌ *ERROR OCCURRED — TRY AGAIN LATER.*" }, { quoted: msg });
        }
    }
};

