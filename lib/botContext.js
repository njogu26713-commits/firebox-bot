/**
 * Central AsyncLocalStorage for per-user bot context.
 * Allows settings, jsonStore, and myJid to be scoped to
 * a specific bot instance without touching command files.
 */
const { AsyncLocalStorage } = require("async_hooks");
const botContext = new AsyncLocalStorage();
module.exports = botContext;
