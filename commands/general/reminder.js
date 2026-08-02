module.exports = {
    name: "reminder",
    aliases: ["remind", "remindme"],
    description: "Set a reminder. Usage: .reminder <time> <message>",
    category: "general",
    execute: async ({ sock, jid, sender, args, msg }) => {
        // Usage: .reminder 10s Buy groceries  OR  .reminder 5m Call mom  OR  .reminder 2h Meeting
        if (args.length < 2) {
            return await sock.sendMessage(jid, {
                text:
                    "❓ *Usage:* `.reminder <time> <message>`\n\n" +
                    "*Time formats:*\n" +
                    "• `30s` — 30 seconds\n" +
                    "• `5m` — 5 minutes\n" +
                    "• `2h` — 2 hours\n\n" +
                    "*Examples:*\n" +
                    "• `.reminder 10m Take your medicine`\n" +
                    "• `.reminder 1h Team meeting`\n" +
                    "• `.reminder 30s Check the oven`"
            });
        }

        const timeStr = args[0].toLowerCase();
        const reminderText = args.slice(1).join(" ");

        // Parse time
        const match = timeStr.match(/^(\d+)(s|m|h)$/);
        if (!match) {
            return await sock.sendMessage(jid, {
                text: "❌ Invalid time format. Use `30s`, `5m`, or `2h`."
            });
        }

        const value = parseInt(match[1]);
        const unit = match[2];

        // Limits
        const MAX_SECONDS = 24 * 60 * 60; // 24 hours max
        let delayMs;

        if (unit === "s") delayMs = value * 1000;
        else if (unit === "m") delayMs = value * 60 * 1000;
        else if (unit === "h") delayMs = value * 60 * 60 * 1000;

        if (delayMs > MAX_SECONDS * 1000) {
            return await sock.sendMessage(jid, { text: "❌ Maximum reminder time is *24 hours*." });
        }
        if (delayMs < 5000) {
            return await sock.sendMessage(jid, { text: "❌ Minimum reminder time is *5 seconds*." });
        }

        // Friendly display
        let displayTime = "";
        if (unit === "s") displayTime = `${value} second${value !== 1 ? "s" : ""}`;
        else if (unit === "m") displayTime = `${value} minute${value !== 1 ? "s" : ""}`;
        else if (unit === "h") displayTime = `${value} hour${value !== 1 ? "s" : ""}`;

        await sock.sendMessage(jid, {
            text: `⏰ *Reminder Set!*\n\n📝 *Message:* ${reminderText}\n⏱️ *Fires in:* ${displayTime}\n\n_I'll ping you when it's time!_`
        }, { quoted: msg });

        // Fire the reminder
        setTimeout(async () => {
            try {
                const reminderMsg =
                    `⏰ *REMINDER!*\n\n` +
                    `📣 @${sender.split("@")[0]}, here's your reminder:\n\n` +
                    `💬 *"${reminderText}"*\n\n` +
                    `_Set ${displayTime} ago • Firebox Bot_`;

                await sock.sendMessage(jid, {
                    text: reminderMsg,
                    mentions: [sender]
                });
            } catch (err) {
                console.error("Reminder fire error:", err);
            }
        }, delayMs);
    }
};
