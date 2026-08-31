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

- [x] Fix the webhook hub Register bot action that is currently not working.
- [x] Add a regression test for successful bot registration and useful error responses.

- [ ] Diagnose the deployed `/admin` add-server error `bad auth: Authentication failed.`
- [ ] Align the deployed panel and bot authentication contract and improve the error message.
- [ ] Verify adding a hub-generated bot identity succeeds without admin login.
- [x] Accept Railway’s `MONGO_URL` private reference variable and `MONGO_PUBLIC_URL` fallback for the panel registry.

- [x] Restyle the public workspace to match the supplied dark Firebox reference design.
- [x] Preserve dynamic server selection, remote status polling, pairing-code requests, and per-browser session isolation.
- [x] Verify responsive layout and existing functional tests after the visual-only change.

- [x] Remove hard-coded user identity, email, and default Server 1 labels from the public UI.
- [x] Remove unused sidebar and main-content empty spacing while preserving the dark reference layout.
- [x] Show a compact `Bots are coming soon` state when the dynamic server list is empty.
- [x] Verify populated server selection and no-server rendering after the refinement.

- [x] Add MongoDB-backed user accounts with unique email addresses and securely hashed passwords.
- [x] Add create-account, sign-in, sign-out, and current-user session endpoints.
- [x] Add matching dark account UI without changing server selection or pairing routes.
- [x] Test account isolation, invalid credentials, persistence, and unchanged pairing behavior.

- [x] Add a phone-only sidebar toggle that opens the dynamic bot list.
- [x] Close the mobile sidebar and show the selected bot pairing page when a bot is tapped.
- [x] Verify responsive phone layout and preserve desktop behavior and pairing APIs.

- [x] Fix remote selected-bot requests that return `Sign in required` after the user signs into the main panel.
- [x] Add a secure panel-to-bot authentication bridge without exposing bot keys to browsers.
- [x] Test status and pairing requests through the selected remote bot deployment.

- [x] Add `FIREBOX_ADMIN_EMAIL` authorization for `/admin` and admin reporting APIs.
- [x] Track the signed-in account and selected bot ID for server usage reporting without storing secrets in responses.
- [x] Build an admin dashboard showing registered users, registered bots, and each user’s selected bot ID.
- [x] Test admin/non-admin access, privacy, usage tracking, and unchanged pairing behavior.

- [x] Fix the selected bot status path so the UI shows the real remote error instead of a generic Unavailable state.
- [x] Make logout work from desktop and mobile navigation and remove the Account link.
- [x] Add a signed-in Settings page with account and session information.
- [x] Test status diagnostics, logout, Settings access, and unchanged pairing behavior.

- [x] Diagnose why the deployed selected bot still returns `Sign in required` after the panel bridge update.
- [x] Make the panel-to-bot handshake compatible with the deployed remote version or provide a precise redeployment fix.
- [x] Re-test remote status and pairing requests after the handshake repair.

- [x] Fix the firebox-baileys Railway Yarn 4 immutable-install failure caused by the missing or mismatched lockfile.
- [x] Validate the library install and build with the exact Railway command.
- [x] Push the build repair to the firebox-baileys repository.

- [x] Automatically sync every Webhook Hub bot registration into the Firebox panel server registry.
- [x] Keep hub bot keys server-side and make sync idempotent by Bot ID.
- [x] Show synchronized bots immediately in the public panel without duplicate admin entry.
- [x] Test registration sync, updates, secret protection, and public visibility.

- [x] Diagnose the remote bot HTTP 502 and determine whether firebox-baileys or Railway startup is responsible.
- [x] Verify the bot health endpoint, assigned port handling, and Baileys dependency compatibility.
- [x] Apply and test the smallest required repair, or document the exact deployment correction.

- [x] Repair the remote bot Railway deployment that returns HTTP 502 at its public URL.
- [x] Verify the deployed source, startup command, assigned port, and health endpoint.
- [x] Validate the corrected public URL before using it for Webhook Hub registration and pairing.

- [ ] Add the requested command catalog to the bot’s menu and command registry, resolving duplicate names and aliases safely.
- [x] Add explicit opt-in commands or menu links for the Firebox WhatsApp channel and group.
- [x] Test command discovery, `.menu`, and consent-based onboarding behavior.

- [x] Add QR pairing mode to server registration and display/refresh QR codes in the user pairing workspace.
- [x] Add authenticated QR proxying while preserving phone-code pairing for code-mode servers.

- [ ] Propagate `pairingMode: qr` through Webhook Hub registration so the independent Open-WA bot is not routed to `/api/bot/pair-code`.
- [ ] Verify automatic Hub synchronization and QR routing without manual admin entry.

- [x] Auto-detect Open-WA QR mode from remote status and fall back to `/api/bot/qr` for legacy code-mode records.

- [x] Add a binary QR-image proxy and use it from the panel to avoid broken data-URL rendering.
- [x] Identify whether the live QR failure is caused by an old deployment, a missing bot QR payload, or a non-image proxy response, then repair it.

- [x] Replace the multi-bot/server chooser with a single Firebox Bot identity and workspace
- [x] Implement the two-stage Firebox token registration and pairing-code UI from the supplied brief
- [x] Remove alternate bot names, links, and non-Firebox bot choices from user-facing pages
- [ ] Preserve compatible existing status, pairing, QR, and account behavior
- [x] Verify desktop/mobile UI and run the regression test suite

- [x] Commit and push the validated Firebox-only UI redesign to the configured GitHub repository

- [x] Remove login and account-creation requirements from the public Firebox pairing route
- [x] Implement secure token creation and token-to-pairing-code endpoints used by the redesigned UI
- [x] Add regression coverage for public access and token pairing behavior
- [x] Re-run tests and push the repaired flow to GitHub

- [x] Diagnose and repair WhatsApp rejection of generated pairing codes
- [x] Verify pairing-code formatting and phone normalization against the bot runtime
- [x] Re-test and push the pairing-code repair to GitHub

- [x] Make Firebox tokens reusable for repeated pairing-code generation
- [x] Add regression coverage proving a token remains active after use
- [x] Push the reusable-token correction to GitHub

- [x] Split Firebox pairing into separate public `/token` and `/code` pages
- [x] Remove the in-page Continue button connecting the two stages
- [x] Apply a simple cyberpunk visual style to both pages
- [x] Ensure Firebox tokens are reusable for repeated pairing-code generation
- [x] Verify route separation, reusable tokens, and responsive cyberpunk UI
- [ ] Push the split-page cyberpunk redesign to GitHub

- [x] Restore forwarded-from-channel metadata on `.menu` command messages
- [x] Add regression coverage for the `.menu` forwarded-channel behavior
- [x] Test and push the forwarded-channel repair

- [ ] Integrate Groq AI replies when `aichat` is enabled
- [ ] Preserve commands, owner controls, and disabled-AI behavior
- [ ] Add Groq configuration guidance and secure secret handling
- [ ] Add tests for AI on/off behavior and push the feature

- [x] Add staged token-generation animation: storing number, typewriter generation, animated reveal
- [x] Handle animation cancellation, API errors, and reduced-motion preferences
- [x] Verify and push the token-page animation update

- [x] Expand token-generation animation beyond the example messages into a full staged cyberpunk status sequence

- [x] Reduce excess side and bottom whitespace on `/token` and `/code`
- [x] Increase the main container and card height while preserving responsive behavior
- [x] Verify and push the spacing adjustment

- [x] Make each of the six token-generation stages last exactly 3 seconds
- [x] Ensure the real token is revealed only after the complete 18-second sequence
- [x] Verify and push the exact timing update

- [ ] Add M-Pesa STK Push plans: 7 days KSh 29, 14 days KSh 49, 30 days KSh 99
- [ ] Allow payment to activate a new token or extend an existing token
- [ ] Add secure payment callback, idempotency, and token expiry handling
- [ ] Add payment UI and status polling
- [ ] Add tests and push the payment implementation

- [x] Add disabled M-Pesa configuration scaffolding with `MPESA_ENABLED=false`
- [x] Show 7-day KSh 29, 14-day KSh 49, and 30-day KSh 99 plans in the UI
- [x] Make the UI read the disabled-payment state without attempting STK Push
- [x] Test and push the disabled payment scaffolding

- [x] Add a compact Firebox icon beside the top-left header brand on `/token` and `/code`
- [x] Verify header alignment and push the icon update

- [x] Add rotating typewriter copy that types, pauses, clears, and cycles through additional Firebox messages
- [x] Add reduced-motion fallback and verify the intro animation
- [x] Push the rotating intro update
