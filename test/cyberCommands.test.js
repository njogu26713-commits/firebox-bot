const assert = require("node:assert/strict");
const test = require("node:test");
const commands = require("../commands/system/cyber");

function fakeContext(args = []) {
    const sent = [];
    return {
        args,
        msg: { key: { id: "test-message" } },
        sock: {
            async sendMessage(jid, content) {
                sent.push({ jid, content });
                return { key: { id: "sent-message" } };
            },
        },
        jid: "test@s.whatsapp.net",
        sent,
    };
}

test("cybersecurity help exposes only safe defensive tools", async () => {
    const ctx = fakeContext();
    await commands.cybersecurity.execute(ctx);
    assert.match(ctx.sent[0].content.text, /\.hash <text>/);
    assert.match(ctx.sent[0].content.text, /\.b64 encode <text>/);
    assert.match(ctx.sent[0].content.text, /do not scan, attack, exploit/);
});

test("hash creates the known SHA-256 fingerprint locally", async () => {
    const ctx = fakeContext(["hello"]);
    await commands.hash.execute(ctx);
    assert.match(ctx.sent[0].content.text, /2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824/);
});

test("Base64 encodes and decodes text", async () => {
    const encode = fakeContext(["encode", "hello world"]);
    await commands.base64.execute(encode);
    assert.match(encode.sent[0].content.text, /aGVsbG8gd29ybGQ=/);

    const decode = fakeContext(["decode", "aGVsbG8gd29ybGQ="]);
    await commands.base64.execute(decode);
    assert.match(decode.sent[0].content.text, /hello world/);
});

test("IOC command classifies indicators without a network lookup", async () => {
    const ctx = fakeContext(["192.0.2.10"]);
    await commands.ioc.execute(ctx);
    assert.match(ctx.sent[0].content.text, /IPv4 address/);
    assert.match(ctx.sent[0].content.text, /No reputation lookup or network request/);
});

test("password tips never request a real password", async () => {
    const ctx = fakeContext();
    await commands.passwordTips.execute(ctx);
    assert.match(ctx.sent[0].content.text, /does not ask you to enter a real password/);
});
