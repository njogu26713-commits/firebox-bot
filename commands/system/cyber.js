const crypto = require("node:crypto");
const net = require("node:net");

const helpText = `🛡️ *FIREBOX CYBERSECURITY LAB*

Safe educational tools only — these commands do not scan, attack, exploit, or access systems.

• *.hash <text>* — Create a SHA-256 fingerprint
• *.b64 encode <text>* — Encode text as Base64
• *.b64 decode <base64>* — Decode Base64 text locally
• *.ioc <value>* — Classify an indicator without contacting it
• *.passwordtips* — Learn safer password practices

Use *.help <command>* for command details.`;

const cybersecurity = {
    name: "cybersecurity",
    aliases: ["cyber", "cybersafe", "securitylab"],
    description: "Show safe defensive cybersecurity education commands.",
    category: "system",
    async execute({ sock, jid, msg }) {
        return await sock.sendMessage(jid, { text: helpText }, { quoted: msg });
    },
};

const hash = {
    name: "hash",
    aliases: ["sha256", "hashtext"],
    description: "Create a SHA-256 fingerprint of text locally.",
    category: "system",
    async execute({ sock, jid, args, msg }) {
        const input = args.join(" ");
        if (!input) return await sock.sendMessage(jid, { text: "❓ *Usage:* `.hash <text>`\n\nThis creates a one-way SHA-256 fingerprint; it does not encrypt the text." }, { quoted: msg });
        if (input.length > 2048) return await sock.sendMessage(jid, { text: "⚠️ Please keep the text under 2,048 characters." }, { quoted: msg });
        const digest = crypto.createHash("sha256").update(input, "utf8").digest("hex");
        return await sock.sendMessage(jid, { text: `🔐 *SHA-256 FINGERPRINT*\n\n\`${digest}\`\n\n_The original text is not stored by this command._` }, { quoted: msg });
    },
};

const base64 = {
    name: "b64",
    aliases: ["base64"],
    description: "Encode or decode Base64 text locally.",
    category: "system",
    async execute({ sock, jid, args, msg }) {
        const action = (args.shift() || "").toLowerCase();
        const input = args.join(" ");
        if (!action || !input || !["encode", "decode"].includes(action)) {
            return await sock.sendMessage(jid, { text: "❓ *Usage:* `.b64 encode <text>` or `.b64 decode <base64>`" }, { quoted: msg });
        }
        try {
            if (action === "encode") {
                const encoded = Buffer.from(input, "utf8").toString("base64");
                return await sock.sendMessage(jid, { text: `🧩 *BASE64 ENCODED*\n\n\`${encoded}\`` }, { quoted: msg });
            }
            const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) throw new Error("Invalid Base64 text.");
            const decoded = Buffer.from(normalized, "base64").toString("utf8");
            return await sock.sendMessage(jid, { text: `🧩 *BASE64 DECODED*\n\n${decoded || "(empty text)"}` }, { quoted: msg });
        } catch (error) {
            return await sock.sendMessage(jid, { text: `⚠️ ${error.message}` }, { quoted: msg });
        }
    },
};

const ioc = {
    name: "ioc",
    aliases: ["ioccheck", "indicator"],
    description: "Classify an IP, URL, domain, email, or hash offline.",
    category: "system",
    async execute({ sock, jid, args, msg }) {
        const value = args.join(" ").trim();
        if (!value) return await sock.sendMessage(jid, { text: "❓ *Usage:* `.ioc <IP, URL, domain, email, or hash>`\n\nThis only classifies the value locally; it does not scan or contact it." }, { quoted: msg });
        let type = "unknown indicator";
        if (net.isIP(value) === 4) type = "IPv4 address";
        else if (net.isIP(value) === 6) type = "IPv6 address";
        else if (/^https?:\/\//i.test(value)) {
            try { type = `URL (${new URL(value).protocol.replace(":", "")} scheme)`; } catch { type = "malformed URL"; }
        } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) type = "email-shaped indicator";
        else if (/^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value)) type = `cryptographic hash (${value.length * 4}-bit)`;
        else if (/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(value)) type = "domain name";
        return await sock.sendMessage(jid, { text: `🔎 *LOCAL IOC CLASSIFICATION*\n\n*Value:* \`${value}\`\n*Type:* ${type}\n\n_No reputation lookup or network request was performed._` }, { quoted: msg });
    },
};

const passwordTips = {
    name: "passwordtips",
    aliases: ["passtips", "securepassword"],
    description: "Show defensive password-safety guidance.",
    category: "system",
    async execute({ sock, jid, msg }) {
        const text = `🔑 *PASSWORD SAFETY TIPS*

• Use a unique passphrase for every account.
• Prefer a password manager and long randomly generated passwords.
• Enable multi-factor authentication, preferably an authenticator app or security key.
• Never send passwords, recovery codes, or private keys in chat.
• Treat unexpected login links and urgent requests as suspicious.
• If a password may be exposed, change it from the official website and revoke active sessions.

_Firebox does not ask you to enter a real password here._`;
        return await sock.sendMessage(jid, { text }, { quoted: msg });
    },
};

module.exports = { cybersecurity, hash, base64, ioc, passwordTips };

