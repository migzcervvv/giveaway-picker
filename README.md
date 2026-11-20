# Giveaway Picker

Giveaway Picker runs raffles on your computer. Paste a roster or import a CSV or XLSX file, draw winners and ordered backups, and reveal the saved results on an audience screen. The app uses your browser’s cryptographically secure randomness. Entrant data stays on your device.

## Download and run

Get `giveaway-picker-v0.1.0.zip` from the [GitHub Releases page](https://github.com/migzcervvv/giveaway-picker/releases). Install [Node.js](https://nodejs.org/en/download) (22 or later), then extract the ZIP.

- **Windows install:** Double-click `Install on Windows.cmd`. This copies the app to your user profile and creates a **Giveaway Picker** Start menu shortcut. Open that shortcut to start the app.
- **Windows portable:** Double-click `Start Giveaway Picker.cmd` in the extracted folder.
- **macOS and Linux:** Open a terminal in the extracted folder, run `node serve.mjs`, and visit `http://127.0.0.1:43107/` in a modern browser.

Keep the launcher window open while using the app. Press **Ctrl+C** in that window to stop the local server. The package includes the production build, fonts, and spreadsheet reader. Once you have the ZIP and Node.js, you can run without an internet connection or a package installation step. To remove the Windows installation, close the launcher, remove the Start menu shortcut, and delete `%LOCALAPPDATA%\Programs\Giveaway Picker`.

## Run a raffle

1. Paste names, or import a CSV/XLSX file and select its name column. Review the entrant count and duplicate handling.
2. Set the number of winners and backups. Use **Shuffle Names** if you want to reorder the roster before the draw.
3. Open **Audience View**, choose a prize category and batch size, then start the draw. Reveal each batch when ready. Use **Hide Audience** for standby.
4. Return to the operator between batches to mark disclosed winners **Called** or **No-show**. No-show promotes the next available backup. Reveal promoted names explicitly on the audience screen.
5. Use **History** to review records and download JSON, CSV, or XLSX. Export a copy before clearing browser data or moving to a different computer.

Restart Round records a cancellation before releasing unawarded slots. Reset Session preserves history and can keep or clear the roster. Keeping the roster starts a fresh session in which earlier winners may win again.

## Local data and event setup

- History is stored in your browser profile at `http://127.0.0.1:43107/`. Use the same browser, profile, and address to see that history. Private browsing and clearing site data can remove it. Reloading ends the live session.
- The release is a local browser app. Close or switch away the projector before opening the roster, History, or full operator controls. A mirrored display shows what the host opens.
- Rehearse the projector routing, long-name readability, keyboard controls, and PA volume on the equipment you’ll use.

## Build from source

Use Node.js `26.13.1` (see [`.nvmrc`](.nvmrc)) and pnpm `12.18.0`.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm verify
```

`pnpm build` writes the production files to `dist/`. Serve that directory over HTTP at the root of the web origin. Project status and contributor workflow are documented in [HANDOFF.md](docs/HANDOFF.md) and [AGENTS.md](AGENTS.md).
