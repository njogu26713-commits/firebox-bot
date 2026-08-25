# Railway setup

Create a MongoDB service in the same Railway project as the Firebox Bot panel. In the panel service's Variables page, add a reference variable named `MONGO_URL` with the value `${{Mongo.MONGO_URL}}`, replacing `Mongo` with the exact name of the MongoDB service if it differs. The application also accepts `MONGO_PUBLIC_URL` or `MONGODB_URI` when the database is outside the Railway project, but the private `MONGO_URL` reference is preferred for services in the same project.

Add the following optional values to the panel service:

```env
MONGODB_DATABASE=firebox
MONGODB_SERVERS_COLLECTION=servers
```

After saving the variables, redeploy the panel service. The `/admin` server registry will then save server name, hub URL, bot ID, bot key, public URL, active state, and creation time in the Railway MongoDB service.

The webhook hub URL is not the MongoDB URL. Each actual bot deployment still uses `FIREBOX_HUB_URL`, `FIREBOX_BOT_ID`, `FIREBOX_BOT_KEY`, and `FIREBOX_PUBLIC_URL` for event delivery and pairing.
