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
