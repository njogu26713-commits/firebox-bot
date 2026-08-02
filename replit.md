# Firebox Bot

A feature-rich WhatsApp bot built with Node.js and the [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) library.

## Stack

- **Runtime**: Node.js
- **WhatsApp**: Baileys (`@whiskeysockets/baileys`)
- **Web server**: Express (port 3000)
- **Database**: SQLite (default) / MongoDB (optional via `MONGODB_URI`)
- **AI**: Groq / OpenAI (optional)

## How to run

The bot starts automatically via the **Firebox Bot** workflow (`node index.js`).

On first run (no session set) the bot shows a QR code in the terminal. You can also connect via pairing code at the dashboard:

```
http://localhost:3000/pair
```

## Configuration

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `SESSION_ID` | Yes (or pair) | Encoded session string starting with `FIREBOX~` |
| `SUDO` | Optional | Super-admin phone number (with country code) |
| `OWNERS` | Optional | Comma-separated additional admin numbers |
| `PAIRING_NUMBER` | Optional | Auto-pair on startup without QR |
| `PREFIX` | Optional | Command prefix (default `.`) |
| `MODE` | Optional | `public` or `private` (default `public`) |
| `MONGODB_URI` | Optional | MongoDB Atlas connection string |
| `GROQ_API_KEY` | Optional | For `.ai` / `.chat` commands |
| `OPENAI_API_KEY` | Optional | For `.imagine` and GPT commands |

## Key routes

| Route | Description |
|---|---|
| `GET /` | Health check |
| `GET /pair` | Pairing code dashboard |
| `POST /api/pair-code` | Generate a WhatsApp pairing code (body: `{ phone }`) |
| `GET /api/bot/status` | Bot connection status (public) |
| `POST /api/bot/restart` | Restart bot (requires `Authorization: Bearer <ADMIN_TOKEN>`) |

## Project structure

```
index.js          — Entry point; express server + Baileys connection logic
config.js         — Bot config (owners, prefix, auth folder)
commands/         — All bot commands, organised by category
lib/              — Utilities: command handler, admin API, settings, DB helpers
firebox/          — Database models and message storage
public/           — Static web assets (pair dashboard)
assets/           — Bot images and logos
session/          — WhatsApp auth state (auto-created, gitignored)
```

## User preferences

- Keep existing project structure; do not restructure or migrate the stack.
