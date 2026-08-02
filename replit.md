# Firebox Bot

A lightweight, customizable WhatsApp automation and userbot built on the [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) library.

## Stack
- **Runtime**: Node.js
- **WhatsApp API**: Baileys (`@whiskeysockets/baileys`)
- **Database**: PostgreSQL (via `DATABASE_URL`) or SQLite fallback (`database/firebox.db`)
- **HTTP server**: Express (health check + Admin API)
- **AI**: GROQ / OpenAI (optional)

## Project structure
```
index.js            — entry point; starts WhatsApp connection & Express server
config.js           — static config (version, owner numbers, prefixes)
commands/           — all bot commands, grouped by category
firebox/            — core DB models, JSON store fallback, auth helpers
lib/                — business logic (admin API, AI helper, economy, automation, etc.)
database/           — settings, badwords, rules, warnings helpers
assets/             — Firebox Bot branding images
```

## Running the bot
```bash
npm start       # production
npm run dev     # development (nodemon, auto-restart on file change)
```

## Required environment variables
| Variable | Description |
|---|---|
| `SUDO` | Your WhatsApp number with country code (e.g. `254712345678`) |
| `SESSION_ID` | Base64 gzip session string (`FIREBOX~...`) from first QR scan |

## Optional environment variables
| Variable | Description |
|---|---|
| `OWNERS` | Comma-separated secondary admin numbers |
| `DATABASE_URL` | PostgreSQL/MySQL URL — falls back to SQLite if empty |
| `OPENAI_API_KEY` | For `.ai` OpenAI commands |
| `GROQ_API_KEY` | For `.ai` GROQ commands |
| `PREFIX` | Command prefix (default: `.`) |
| `MODE` | `public` or `private` (default: `public`) |
| `ADMIN_TOKEN` | Bearer token for the Admin API (auto-generated if not set) |

## User preferences
- Project should be fully branded as **Firebox Bot** — no Nexus references
