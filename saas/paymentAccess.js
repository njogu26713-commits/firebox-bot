const fs = require("fs");
const path = require("path");

const statePath = path.join(__dirname, "..", "database", "payment_access.json");
const timezone = String(process.env.FIREBOX_FREE_WEEKEND_TIMEZONE || "Africa/Nairobi");

function readState() {
    try {
        const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
        return { manualFreeMode: state.manualFreeMode === true };
    } catch {
        return { manualFreeMode: false };
    }
}

function writeState(state) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const temporaryPath = `${statePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify({
        manualFreeMode: state.manualFreeMode === true,
        updatedAt: new Date().toISOString(),
    }, null, 2));
    fs.renameSync(temporaryPath, statePath);
}

function isWeekend(now = new Date()) {
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(now);
    return weekday === "Sat" || weekday === "Sun";
}

function getStatus(now = new Date()) {
    const state = readState();
    const weekendFree = isWeekend(now);
    return {
        manualFreeMode: state.manualFreeMode,
        weekendFree,
        freePairing: state.manualFreeMode || weekendFree,
        timezone,
    };
}

module.exports = {
    getStatus,
    isFreePairing: () => getStatus().freePairing,
    setManualFreeMode(enabled) {
        const manualFreeMode = enabled === true;
        writeState({ manualFreeMode });
        return getStatus();
    },
};
