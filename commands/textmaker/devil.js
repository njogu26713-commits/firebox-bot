const mumaker = require('mumaker');

module.exports = {
  name: 'devil',
  aliases: ['demon'],
  category: 'textmaker',
  description: 'Create devil neon wings text effect',
  usage: '.devil <text>',
  async execute({ sock, jid, args, msg }) {
    try {
      const text = args.join(' ');
      if (!text) return await sock.sendMessage(jid, { text: '❌ Example: `.devil Firebox`' }, { quoted: msg });
      await sock.sendMessage(jid, { text: '⏳ *Generating devil effect...*' }, { quoted: msg });
      const result = await mumaker.ephoto('https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html', text);
      if (!result || !result.image) throw new Error('No image received');
      await sock.sendMessage(jid, { image: { url: result.image }, caption: `😈 *DEVIL EFFECT*\n\n💎 *Text:* ${text}\n🛡️ *Powered by Firebox Bot*` }, { quoted: msg });
    } catch (e) { await sock.sendMessage(jid, { text: `❌ *Error:* ${e.message}` }, { quoted: msg }); }
  }
};
