/**
 * PM2 Ecosystem Configuration for Firebox Bot
 * Run: pm2 start ecosystem.config.js
 */

module.exports = {
    apps: [{
        name: "firebox-bot",
        script: "index.js",
        interpreter: "node",

        // Restart bot automatically on crash
        autorestart: true,
        watch: false,
        max_restarts: 10,
        restart_delay: 5000, // wait 5s before restarting

        // Memory limit — restart if it exceeds 500MB
        max_memory_restart: "500M",

        // Log files
        out_file: "./logs/bot.log",
        error_file: "./logs/bot-error.log",
        log_date_format: "YYYY-MM-DD HH:mm:ss",

        // Environment variables
        env: {
            NODE_ENV: "production"
        }
    }]
};
