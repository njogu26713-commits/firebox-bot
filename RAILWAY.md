# Railway setup

Create a MongoDB service in the same Railway project as the Firebox Bot panel. In the panel service's Variables page, add a reference variable named `MONGO_URL` with the value `${{Mongo.MONGO_URL}}`, replacing `Mongo` with the exact name of the MongoDB service if it differs. The application also accepts `MONGO_PUBLIC_URL` or `MONGODB_URI` when the database is outside the Railway project, but the private `MONGO_URL` reference is preferred for services in the same project.

Add the following optional values to the panel service:

```env
MONGODB_DATABASE=firebox
MONGODB_SERVERS_COLLECTION=servers
```

After saving the variables, redeploy the panel service. The `/admin` server registry will then save server name, hub URL, bot ID, bot key, public URL, active state, and creation time in the Railway MongoDB service.

The webhook hub URL is not the MongoDB URL. Each actual bot deployment still uses `FIREBOX_HUB_URL`, `FIREBOX_BOT_ID`, `FIREBOX_BOT_KEY`, and `FIREBOX_PUBLIC_URL` for event delivery and pairing.

## Administrator access

Add this variable to the Firebox Bot panel service in Railway:

```env
FIREBOX_ADMIN_EMAIL=your-email@example.com
```

The value must exactly match the email used to create or sign into your Firebox account. Only that account can open `/admin`, add or remove bot servers, or read the users-and-bots overview. The dashboard shows registered user IDs, email addresses, selected bot IDs, bot names, and last activity. Bot keys are never included in the report.

## Automatic bot registration from the Webhook Hub

To register each bot only once in the Webhook Hub and have it appear automatically in this panel, add these variables to the Webhook Hub service:

```env
FIREBOX_PANEL_URL=https://your-firebox-panel.up.railway.app
FIREBOX_PANEL_SYNC_SECRET=one-long-random-secret
FIREBOX_HUB_URL=https://your-webhook-hub.up.railway.app
```

Add the same sync secret to the Firebox panel service:

```env
FIREBOX_PANEL_SYNC_SECRET=one-long-random-secret
```

After both services are redeployed, every new or updated Webhook Hub registration is upserted into the panel by Bot ID. The panel’s `/admin` page no longer needs a duplicate manual server entry for synchronized bots.
