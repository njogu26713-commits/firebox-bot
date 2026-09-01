const axios = require('axios');
const yts = require('yt-search');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const YTDLP_BIN = process.env.YTDLP_PATH || 'yt-dlp';
const MAX_MEDIA_BYTES = 48 * 1024 * 1024;

const AXIOS_OPTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

const mediaApi = {
    /**
     * Search for videos on YouTube
     */
    async ytSearch(query) {
        try {
            const search = await yts(query);
            return search.videos.length > 0 ? search.videos : null;
        } catch (error) {
            console.error('ytSearch error:', error);
            return null;
        }
    },

    /**
     * Download YouTube media locally with yt-dlp and ffmpeg.
     * Local extraction avoids the unreliable third-party converter APIs that
     * are commonly blocked or unavailable from Railway IPs.
     * @param {string} url YouTube URL
     * @param {{ type?: 'audio'|'video' }} options
     */
    async ytDownload(url, options = {}) {
        const type = options.type === 'video' ? 'video' : 'audio';
        const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'firebox-yt-'));
        const outputTemplate = path.join(workDir, 'media.%(ext)s');
        const format = type === 'video'
            ? 'bestvideo[ext=mp4][height<=480]+bestaudio[ext=m4a]/best[ext=mp4][height<=480]/best[height<=480]'
            : 'bestaudio[ext=m4a]/bestaudio';
        const args = [
            '--no-playlist',
            '--no-warnings',
            '--no-progress',
            '--force-ipv4',
            '--retries', '2',
            '--fragment-retries', '2',
            '--print', 'after_move:title',
            '-f', format,
            '-o', outputTemplate,
        ];
        if (type === 'audio') {
            args.push('-x', '--audio-format', 'mp3', '--audio-quality', '5');
        } else {
            args.push('--merge-output-format', 'mp4');
        }
        args.push(url);

        try {
            const { stdout } = await execFileAsync(YTDLP_BIN, args, {
                timeout: 150000,
                maxBuffer: 1024 * 1024,
            });
            const expectedExtension = type === 'video' ? 'mp4' : 'mp3';
            const mediaPath = path.join(workDir, `media.${expectedExtension}`);
            const stat = await fs.promises.stat(mediaPath);
            if (stat.size > MAX_MEDIA_BYTES) {
                throw new Error(`The ${type} is too large to send on WhatsApp.`);
            }
            const buffer = await fs.promises.readFile(mediaPath);
            const title = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || 'YouTube media';
            return { buffer, title, type };
        } catch (error) {
            console.error(`yt-dlp ${type} download error:`, error.stderr || error.message);
            return null;
        } finally {
            await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => {});
        }
    },

    /**
     * Download Facebook video
     */
    async facebookDownload(url) {
        try {
            const { data } = await axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`, AXIOS_OPTS);
            if (data.status && data.data) {
                const videoUrl = data.data.hd || data.data.sd || data.data.urls?.[0]?.url;
                if (videoUrl) {
                    try {
                        const response = await axios.get(videoUrl, { ...AXIOS_OPTS, responseType: 'arraybuffer' });
                        return { buffer: Buffer.from(response.data), url: videoUrl, title: data.data.title || "Facebook Video" };
                    } catch (e) {
                        return { url: videoUrl, title: data.data.title || "Facebook Video" };
                    }
                }
            }
        } catch (error) {
            console.error('facebookDownload error:', error);
        }
        return null;
    },

    /**
     * Download TikTok video (no watermark)
     */
    async tiktokDownload(url) {
        try {
            const { data } = await axios.get(`https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`, AXIOS_OPTS);
            if (data.status && data.data?.videoNoWatermark) {
                const videoUrl = data.data.videoNoWatermark;
                try {
                    const response = await axios.get(videoUrl, { ...AXIOS_OPTS, responseType: 'arraybuffer' });
                    return {
                        buffer: Buffer.from(response.data),
                        url: videoUrl,
                        author: data.data.author,
                        title: data.data.title
                    };
                } catch (e) {
                    return { url: videoUrl, author: data.data.author, title: data.data.title };
                }
            }
        } catch (error) {
            console.error('tiktokDownload error:', error);
        }
        return null;
    },

    /**
     * Download Instagram media
     */
    async igDownload(url) {
        try {
            const { data } = await axios.get(`https://api.vreden.my.id/api/igdl?url=${encodeURIComponent(url)}`, AXIOS_OPTS);
            if (data.status && data.result && data.result.length > 0) {
                const mediaItems = [];
                for (const item of data.result) {
                    const mediaUrl = item.url || item;
                    try {
                        const response = await axios.get(mediaUrl, { ...AXIOS_OPTS, responseType: 'arraybuffer' });
                        mediaItems.push({
                            buffer: Buffer.from(response.data),
                            url: mediaUrl,
                            isVideo: mediaUrl.includes(".mp4")
                        });
                    } catch (e) {
                        mediaItems.push({ url: mediaUrl, isVideo: mediaUrl.includes(".mp4") });
                    }
                }
                return mediaItems;
            }
        } catch (error) {
            console.error('igDownload error:', error);
        }
        return null;
    },

    /**
     * Get lyrics for a song (LRCLIB)
     */
    async getLyrics(query) {
        const queryEncoded = encodeURIComponent(query);
        const sources = [
            // 🔗 Source 1: LRCLIB (Standard / Quality)
            async () => {
                const { data } = await axios.get(`https://lrclib.net/api/search?q=${queryEncoded}`, AXIOS_OPTS);
                if (data && data.length > 0) {
                    const queryLower = query.toLowerCase();
                    let best = data.find(m => m.plainLyrics && (queryLower.includes(m.artistName.toLowerCase()) || queryLower.includes(m.trackName.toLowerCase()))) || data[0];
                    if (best && best.plainLyrics) return { title: best.trackName, artist: best.artistName, lyrics: best.plainLyrics, album: best.albumName };
                }
                throw new Error('LRCLIB: No match');
            },
            // 🔗 Source 2: Vreden (High Reliability)
            async () => {
                const { data } = await axios.get(`https://api.vreden.my.id/api/lyrics?query=${queryEncoded}`, AXIOS_OPTS);
                if (data.status && data.result?.lyrics) return { title: data.result.title, artist: data.result.artist, lyrics: data.result.lyrics };
                throw new Error('Vreden: No match');
            },
            // 🔗 Source 3: Siputzx (Extensive Database)
            async () => {
                const { data } = await axios.get(`https://api.siputzx.my.id/api/s/lyrics?query=${queryEncoded}`, AXIOS_OPTS);
                if (data.status && data.data?.lyrics) return { title: data.data.title, artist: data.data.artist, lyrics: data.data.lyrics };
                throw new Error('Siputzx: No match');
            },
            // 🔗 Source 4: Nabees (Owner's Suite)
            async () => {
                const { data } = await axios.get(`https://api.nabees.online/api/lyrics?q=${queryEncoded}`, AXIOS_OPTS);
                if (data && data.result) return { title: data.result.title || query, artist: data.result.artist || "Unknown", lyrics: data.result.lyrics };
                throw new Error('Nabees: No match');
            }
        ];

        for (const source of sources) {
            try {
                const res = await source();
                if (res && res.lyrics) return res;
            } catch (e) {
                console.warn(`Lyrics Fallback Error: ${e.message}`);
                continue; // Try next source
            }
        }

        return null;
    }
};

module.exports = mediaApi;
