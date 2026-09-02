const crypto = require("crypto");

function configuredAdminPasscode() {
    return String(process.env.FIREBOX_ADMIN_PASSCODE || "");
}

function isAdminAuthenticated(req) {
    return req.session?.adminAuthenticated === true;
}

function verifyAdminPasscode(passcode) {
    const configured = configuredAdminPasscode();
    const supplied = String(passcode || "");
    if (!configured || !supplied) return false;
    const configuredBuffer = Buffer.from(configured);
    const suppliedBuffer = Buffer.from(supplied);
    return configuredBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(configuredBuffer, suppliedBuffer);
}

function requireAdmin(req, res, next) {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Administrator passcode required." });
    next();
}

module.exports = { configuredAdminPasscode, isAdminAuthenticated, verifyAdminPasscode, requireAdmin };
