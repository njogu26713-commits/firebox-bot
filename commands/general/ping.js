module.exports = {
    name: "ping",
    aliases: ["p"],
    description: "Check bot speed",
    category: "general",
    execute: async (ctx) => {
        const start = Date.now();
        const sent = await ctx.sock.sendMessage(ctx.jid, { text: "Testing speed..." });
        const end = Date.now();
        await ctx.sock.sendMessage(ctx.jid, { 
            text: `Firebox 𝐏𝐨𝐧𝐠! Speed: \`${end - start}ms\``,
            edit: sent.key 
        });
    }
};
