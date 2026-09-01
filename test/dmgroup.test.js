const assert = require("node:assert/strict");
const test = require("node:test");
const dmgroup = require("../commands/admin/dmgroup");

function context(args, participants = []) {
    const sent = [];
    return {
        args,
        jid: "12345-678@g.us",
        msg: { key: { id: "command-message" } },
        sent,
        sock: {
            user: { id: "99999:1@s.whatsapp.net" },
            async groupMetadata() {
                return { subject: "Training Group", participants };
            },
            async sendMessage(to, content) {
                sent.push({ to, content });
                return { key: { id: `sent-${sent.length}` } };
            },
        },
    };
}

test("dmgroup is owner-only and group-only", () => {
    assert.equal(dmgroup.isOwnerOnly, true);
    assert.equal(dmgroup.isGroupOnly, true);
});

test("dmgroup requires explicit confirmation and a message", async () => {
    const ctx = context(["hello"]);
    await dmgroup.execute(ctx);
    assert.equal(ctx.sent.length, 1);
    assert.match(ctx.sent[0].content.text, /\.dmgroup confirm <message>/);
});

test("dmgroup sends nothing when the safety recipient cap is exceeded", async () => {
    const participants = Array.from({ length: 51 }, (_, index) => ({ id: `${index + 1}@s.whatsapp.net` }));
    const ctx = context(["confirm", "training reminder"], participants);
    await dmgroup.execute(ctx);
    assert.equal(ctx.sent.length, 1);
    assert.match(ctx.sent[0].content.text, /safety limit is 50/);
    assert.equal(ctx.sent[0].to, ctx.jid);
});
