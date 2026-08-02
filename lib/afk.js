/**
 * AFK (Away From Keyboard) Logic
 * Stores users who are currently away.
 */

const afkData = new Map();

const setAfk = (jid, sender, reason = "AFK") => {
    afkData.set(`${jid}_${sender}`, {
        reason,
        time: Date.now()
    });
};

const getAfk = (jid, sender) => {
    return afkData.get(`${jid}_${sender}`);
};

const removeAfk = (jid, sender) => {
    return afkData.delete(`${jid}_${sender}`);
};

module.exports = { setAfk, getAfk, removeAfk };
