/**
 * Shared AI helper for Firebox Bot
 * Uses Pollinations AI — free, no API key required.
 *
 * Text API:  GET https://text.pollinations.ai/{prompt}?model=openai&system={system}
 * Image API: GET https://image.pollinations.ai/prompt/{prompt}?width=512&height=512&nologo=true
 */

const axios = require("axios");
const { openaiKey, groqKey } = require("../config");

// ── Per-User AI Rate Limiter ─────────────────────────────────────────────────
const AI_HOURLY_LIMIT = 10;  // max requests per user per hour
const AI_DAILY_LIMIT  = 30;  // max requests per user per day
const aiUsage = new Map(); // key: userId -> { hourCount, hourReset, dayCount, dayReset }

function checkAILimit(userId) {
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day  = 24 * hour;

    if (!aiUsage.has(userId)) {
        aiUsage.set(userId, { hourCount: 0, hourReset: now + hour, dayCount: 0, dayReset: now + day });
    }

    const u = aiUsage.get(userId);
    if (now > u.hourReset) { u.hourCount = 0; u.hourReset = now + hour; }
    if (now > u.dayReset)  { u.dayCount  = 0; u.dayReset  = now + day;  }

    if (u.dayCount >= AI_DAILY_LIMIT) {
        return { allowed: false, reason: `⛔ You've hit your *daily AI limit* (${AI_DAILY_LIMIT} queries). Reset in \`${Math.ceil((u.dayReset - now) / 3600000)}h\`.` };
    }
    if (u.hourCount >= AI_HOURLY_LIMIT) {
        return { allowed: false, reason: `⏳ Slow down! Max *${AI_HOURLY_LIMIT} AI queries/hour*. Reset in \`${Math.ceil((u.hourReset - now) / 60000)}m\`.` };
    }

    u.hourCount++;
    u.dayCount++;
    return { allowed: true };
}

/**
 * Ask a text question with an optional system persona.
 * @param {string} userPrompt  - The user's input
 * @param {string} [system]    - Optional system/persona instruction
 * @returns {Promise<string>}  - The AI's response text
 */
async function askAI(userPrompt, system = "You are Firebox, a helpful, friendly WhatsApp assistant.") {
    // 1. Try Groq (Primary for speed) — cycles through available models
    if (groqKey) {
        const groqModels = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "qwen/qwen3-32b"];
        for (const model of groqModels) {
            try {
                const { data } = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
                    model,
                    messages: [{ role: "system", content: system }, { role: "user", content: userPrompt }]
                }, { 
                    headers: { "Authorization": `Bearer ${groqKey}` },
                    timeout: 10000
                });
                return data.choices[0].message.content.trim();
            } catch (e) {
                console.error(`Groq [${model}] failed:`, e.response?.data?.error?.message || e.message);
            }
        }
    }

    // 2. Try OpenAI (Secondary)
    if (openaiKey) {
        try {
            const { data } = await axios.post("https://api.openai.com/v1/chat/completions", {
                model: "gpt-3.5-turbo",
                messages: [{ role: "system", content: system }, { role: "user", content: userPrompt }]
            }, { 
                headers: { "Authorization": `Bearer ${openaiKey}` },
                timeout: 10000
            });
            return data.choices[0].message.content.trim();
        } catch (e) {
            console.error("OpenAI API Primary failed:", e.message);
        }
    }

    // 2. Fallback to Pollinations AI with multiple models and retries
    const models = ["openai", "mistral", "llama"];
    const delay = (ms) => new Promise(res => setTimeout(res, ms));
    let lastError = null;

    for (let attempt = 0; attempt < 2; attempt++) {
        for (const model of models) {
            try {
                const { data } = await axios.post("https://text.pollinations.ai/", {
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: userPrompt }
                    ],
                    model: model,
                    system: system,
                    seed: Math.floor(Math.random() * 999999)
                }, { 
                    timeout: 20000, 
                    responseType: "text",
                    headers: { 
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
                    }
                });

                if (data && typeof data === "string" && data.length > 3 && !data.includes("error")) {
                    return data.trim();
                }
            } catch (err) {
                lastError = err;
                if (err.response?.status === 429) {
                    await delay(1000);
                }
                continue;
            }
        }
    }
    
    throw lastError || new Error("AI service overloaded.");
}

/**
 * Generate an image from a text prompt.
 * @param {string} prompt - Description of the image
 * @param {number} [width=768]
 * @param {number} [height=768]
 * @returns {Promise<Buffer>} - Image buffer (JPEG)
 */
async function generateImage(prompt, width = 768, height = 768) {
    try {
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
                    `?width=${width}&height=${height}&nologo=true&seed=${Math.floor(Math.random() * 999999)}`;

        const { data } = await axios.get(url, { timeout: 60000, responseType: "arraybuffer" });
        return Buffer.from(data);
    } catch (err) {
        console.error("AI Image Generation failed:", err.message);
        if (err.response?.status === 402 || err.response?.status === 429) {
            throw new Error("AI Image Queue is currently full. Please try again in 5-10 minutes.");
        }
        throw new Error("AI Image service is unavailable.");
    }
}

module.exports = { askAI, generateImage, checkAILimit };

