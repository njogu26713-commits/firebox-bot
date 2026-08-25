function configuredAdminEmail() { return String(process.env.FIREBOX_ADMIN_EMAIL || "").trim().toLowerCase(); }
function isAdminAccount(req) {
    const configured = configuredAdminEmail();
    const email = String(req.session?.accountUser?.email || "").trim().toLowerCase();
    return Boolean(configured && email && email === configured);
}
function requireAdmin(req, res, next) {
    if (!req.session?.accountId) return res.status(401).json({ error: "Sign in required." });
    if (!isAdminAccount(req)) return res.status(403).json({ error: "Administrator access required." });
    next();
}
module.exports = { configuredAdminEmail, isAdminAccount, requireAdmin };
