# MacSweep

A fast, good-looking system cleaner and optimizer for macOS, built with Electron, React and TypeScript.

| Module | What it does |
| --- | --- |
| **Smart Scan** | One-click scan of caches, logs, Trash and temporary files plus a health check (memory, disk, startup items). |
| **System Junk** | Review every cleanable item by category (caches, logs, temp files, Trash, Xcode, developer caches, old downloads). |
| **Large & Old Files** | Find big files in your home folder, filter by type, preview with Quick Look, move to Trash. |
| **Performance** | Live CPU/memory charts, Activity-Monitor-accurate memory breakdown, battery health, top processes. |
| **Uninstaller** | Remove apps *and* their leftovers (support files, caches, preferences, saved state, launch agents). |
| **Maintenance** | Free RAM, flush DNS, reindex Spotlight, repair home permissions, rebuild Launch Services, thin Time Machine snapshots — one password prompt per run. |
| **Startup Items** | Enable/disable launch agents and daemons through launchd's override database. |
| **Menu bar widget** | Live gauges, battery, top processes and quick actions from the menu bar. |

Also: background scans with native notifications, launch at login, 6 languages (en, pt, es, fr, de, ja), dark / darker / light / system themes and custom accent color.

## Getting started

Requirements: macOS, Node.js 20+ (`.nvmrc`).

```bash
npm install
npm run dev        # Electron app with hot reload
npm run dev:web    # UI only, in the browser, with realistic mock data
```

> Running from VS Code / Cursor's integrated terminal? Those set `ELECTRON_RUN_AS_NODE=1`, which makes Electron start as plain Node. `npm run dev` is unaffected; if you launch Electron by hand use `env -u ELECTRON_RUN_AS_NODE npx electron .`.

## Scripts

| Script | |
| --- | --- |
| `npm run dev` / `dev:web` | Run the app / the UI in a browser |
| `npm run typecheck` | Type-check renderer (`tsconfig.json`) and main process (`tsconfig.node.json`) |
| `npm run lint` | ESLint (typescript-eslint + react-hooks) |
| `npm run test` | Vitest unit tests (`tests/`) |
| `npm run check` | typecheck + lint + test — run before pushing |
| `npm run format` | Prettier |
| `npm run build` | Type-check and build renderer + main into `dist/` and `dist-electron/` |
| `npm run dist` | Build a signed-ready `.dmg` (arm64 + x64) with electron-builder |

## Architecture

```
electron/                 Main process (Node)
  main.ts                 Window lifecycle, app menu, single instance
  ipc.ts                  Every IPC channel, with sender validation
  tray.ts                 Menu bar icon + popover window
  scheduler.ts            Background scans and notifications
  services/
    safety.ts             Allow-list guard for EVERY deletion (renderer is untrusted)
    exec.ts               execFile wrappers, shell quoting, admin prompt
    scanner.ts            Junk categories
    large-files.ts        `find`-based large file search
    apps.ts               App scan, leftover detection, uninstall
    cleaner.ts            Delete / trash with admin retry
    system-info.ts        CPU (tick deltas), memory (vm_stat), disk, battery, processes
    maintenance.ts        Privileged tasks batched into one prompt
    startup-items.ts      launchd agents/daemons via `launchctl`
    settings-store.ts     Settings + stats in userData (atomic writes, validation)
  preload.ts / tray-preload.ts   contextBridge implementations of shared/api.ts

shared/                   Code shared by both processes
  api.ts                  ElectronAPI / TrayAPI — the single IPC contract
  types.ts, defaults.ts

src/                      Renderer (React)
  App.tsx                 Shell; pages mount on first visit and stay mounted
  lib/api.ts              `api` = real bridge or mock-api.ts in the browser
  lib/modules.ts          Per-module color worlds (gradients, icons)
  pages/                  One file per module
  components/             Hero, illustration, dialogs, toasts, checkbox/switch…
  hooks/                  usePolling (visibility-aware), useCleaner (admin retry)
  styles/                 theme.css (tokens), components.css, design.css (module look)
  i18n/locales/*.json     Translations — en.json is the source of truth
```

### Adding an IPC call

1. Add the method to `ElectronAPI` in `shared/api.ts` (TypeScript will now flag every place that must implement it).
2. Implement it in `electron/preload.ts`, register the channel in `electron/ipc.ts`, add a mock in `src/lib/mock-api.ts`.
3. Validate every argument in the main process — never trust the renderer. Anything that deletes must go through `services/safety.ts`.

### Safety model

- All deletions are checked by `checkDeletable()`: absolute, normalized, never a protected location, and only inside your home folder, the user temp folder, or `.app` bundles in `/Applications`.
- Old downloads, large files and uninstalled apps go to the **Trash**, not straight to deletion.
- Commands run with `execFile` (no shell). The few privileged commands are static strings or use `shellQuote()`, and run through the native macOS password prompt.
- Context isolation and sandboxed renderers, a strict CSP in production, IPC sender validation, blocked navigation and window opening.

### Permissions

Some locations (like the Trash) need **Full Disk Access**: System Settings → Privacy & Security → Full Disk Access → enable MacSweep. The app shows a shortcut when access is missing.

## Assets

- `assets/icon.png` — app icon.
- `assets/tray-icon.svg` — menu bar icon source. Regenerate the template PNGs with `node scripts/gen-tray-icon.mjs` (uses headless Chrome).

## License

MIT
