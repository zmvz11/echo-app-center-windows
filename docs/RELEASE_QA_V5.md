# Echo Release QA v5

This staged update adds the premium product polish pass:

- Add Apps opens a separate Electron desktop window called Echo App Builder.
- App Builder uses a Steam-style product-page template for live preview.
- Builder includes drag/drop media slots, release package upload, Save Draft, and Post App.
- Builder warns about unsaved changes before close/reload.
- Admin Portal keeps the main window clean and launches the builder as a separate tool.
- Login startup delay fix is included.
- Save login checkbox is included, storing username/session token but not plaintext password.
- Settings now include storage library management, connection testing, saved-login reset, and temporary cache clearing.
- Store, Library, Add Apps, and Release QA v4 button fixes remain included.

## Update order

1. Update Echo App Server first.
2. Reinstall/restart Echo App Server.
3. Run `echo-server doctor`.
4. Update Echo App Center.
5. Reinstall Echo App Center.
6. Open Admin Portal -> Add Apps -> Open Echo App Builder.
