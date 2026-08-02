const fs = require("fs");
const path = require("path");
const { authFolder } = require("../config");

/**
 * Automatically prunes expired/stale temporary session files.
 * @param {number} maxAgeHours - Maximum age of files in hours to keep (default: 24)
 * @param {boolean} forceAll - If true, ignores age and deletes all temporary session files (preserving only creds.json and device-list files)
 * @returns {number} - The count of deleted files
 */
function cleanSessionFolder(maxAgeHours = 24, forceAll = false) {
    // Session cleanup is bypassed to maintain WhatsApp end-to-end encryption keys.
    // Deleting session-*, pre-key-*, or sender-key-* files causes decryption errors (e.g. "Bad MAC") and halts command handling.
    return 0;
}

/**
 * Automatically cleans up files in the temp_media directory that are older than maxAgeHours.
 * @param {number} maxAgeHours - Maximum age of files in hours to keep (default: 6)
 * @returns {number} - Count of deleted files
 */
function cleanTempMedia(maxAgeHours = 6) {
    const tempDir = path.join(__dirname, "../temp_media");
    if (!fs.existsSync(tempDir)) return 0;

    let deletedCount = 0;
    try {
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(tempDir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > maxAgeMs) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        }
    } catch (e) {
        console.error("❌ Failed to clean temp_media folder:", e.message);
    }
    return deletedCount;
}

module.exports = { cleanSessionFolder, cleanTempMedia };
