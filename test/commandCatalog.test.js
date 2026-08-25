const test = require("node:test");
const assert = require("node:assert/strict");

const community = require("../commands/general/community");

test("community command exposes the Firebox channel and group links", async () => {
    let sent;
    const sock = {
        sendMessage: async (...args) => {
            sent = args;
            return { key: { id: "test" } };
        }
    };
    await community.execute({ sock, jid: "123@s.whatsapp.net", msg: {} });
    assert.equal(community.name, "community");
    assert.ok(community.aliases.includes("followchannel"));
    assert.ok(community.aliases.includes("joingroup"));
    assert.match(sent[1].text, /https:\/\/whatsapp\.com\/channel\/0029Vb8elJp77qVJlCeiNX26/);
    assert.match(sent[1].text, /https:\/\/chat\.whatsapp\.com\/IXBsRfMhQh0GMdn8y5QfW5/);
    assert.match(sent[1].text, /optional/i);
});
