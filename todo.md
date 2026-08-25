# Project TODO

- [x] Extend the existing Firebox dashboard and API rather than replace the project with a new application.
- [x] Add an authenticated, per-user server registry using the existing persistence approach, without storing credentials.
- [x] Add overview counts, recent-server records, create/edit/status/delete actions, and a server detail view to the current dashboard.
- [x] Test ownership isolation and verify the existing bot features remain intact after the extension.
- [x] Commit and push the validated in-place server-management dashboard extension to the configured GitHub repository.
- [x] Verify the committed dashboard extension is present on the remote `main` branch after authenticated push access is available.
- [x] Browser-session write access fallback was superseded by the normal authenticated command-line GitHub workflow.
- [x] Push commit `ec63863` through the normal authenticated command-line GitHub workflow and verify it is on `main`.
- [x] Restyle the existing Firebox dashboard with the supplied light server-focused control-panel reference while retaining account-scoped server data and bot controls.
- [x] Verify the reference-inspired dashboard layout and commit the visual update to GitHub.
- [x] Make the reference-inspired authenticated dashboard the default frontend entry point instead of the earlier landing interface.
- [x] Verify the root, login, dashboard, and server routes resolve to the intended updated experience.
- [x] Replace the user-managed server registry with a single read-only Server 1 entry representing the current bot session.
- [x] Remove all user-facing add, edit, status-change, and delete server controls while retaining the pairing connection flow.
- [x] Verify and commit the simplified single-bot dashboard.
- [x] Make the public link open a visitor-specific current-bot connection workspace without requiring dashboard authentication.
- [x] Remove the legacy Bot Controls page and navigation while preserving per-browser bot-session isolation.
- [x] Verify separate visitor sessions and commit the public connection update.
- [x] Inventory and rebrand the requested Baileys fork for Firebox without removing upstream attribution or license notices.
- [x] Create and push a Firebox-owned `firebox-baileys` fork of the reviewed Baileys repository.
- [x] Verify the rebranded package metadata, documentation, and runtime integrity.
- [x] Record the new Firebox fork URL and dependency integration guidance.
- [x] Create a separate Firebox central HTTPS receiver repository for events from multiple bot instances.
- [x] Define authenticated webhook ingestion, bot registration, persistence, and monitoring endpoints.
- [x] Add bot-side webhook integration guidance and verify multi-bot event isolation.
- [x] Make hub bot entries dynamic so every Firebox deployment using its own ID and key appears as a selectable server.
- [x] Add each bot’s public workspace URL and event/health metadata to the hub registry without exposing secrets.
- [x] Update Firebox Bot registration guidance and verify selected-bot connection links and multi-bot isolation.

- [x] Add an administrator bot panel for adding remote Firebox servers with hub URL, bot ID, bot key, public URL, and display name.
- [x] Make the public workspace fetch the current server list and let each visitor select a server before pairing.
- [x] Proxy selected-server pairing requests over HTTPS without exposing bot keys to browsers or storing WhatsApp session credentials in the panel.
- [x] Verify independent visitor sessions and selected-server routing for Server 1, Server 2, and later deployments.

- [x] Split the Firebox Bot UI into `/admin` for server management and `/` for public pairing.
- [x] Remove the add-server control from the public visitor page while leaving server selection available.
- [x] Keep admin server creation unauthenticated for now and document the security limitation.
- [x] Test both page routes and selected-server pairing behavior after the split.

- [x] Temporarily remove webhook hub admin authentication while keeping bot-key event ingestion authentication.
- [x] Update hub UI and documentation to warn that admin operations are publicly accessible during the temporary period.
- [x] Test unauthenticated hub dashboard operations and preserve invalid bot-key rejection.

- [x] Replace the local server registry with MongoDB persistence for added server configuration records.
- [x] Keep bot keys server-side and excluded from public server discovery responses.
- [x] Update asynchronous routes, environment documentation, and MongoDB tests.
