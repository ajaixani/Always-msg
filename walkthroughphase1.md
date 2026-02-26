# Phase 1 Walkthrough — Project Scaffold & State Foundation

**Status: ✅ Complete**  
**Build:** `vite build` — 53 modules, 0 errors  
**Dev server:** `http://localhost:5173`

---

## What Was Built

### PWA Shell
- [vite.config.js](file:///home/amshu/src/Always-msg/vite.config.js) — `vite-plugin-pwa` configured with Workbox `generateSW` mode; precaches 9 entries (484 KiB)
- [public/icons/icon-192.png](file:///home/amshu/src/Always-msg/public/icons/icon-192.png) + `icon-512.png` — custom app icon generated and resized
- Service worker registered and activated in dev mode

### IndexedDB Schema ([src/db/db.js](file:///home/amshu/src/Always-msg/src/db/db.js))
Dexie v4 database **AlwaysMessengerDB** (Version 1) with 5 tables:

| Table | Purpose |
|---|---|
| `contacts` | AI persona cards — name, avatar, llmConfig, ttsConfig, systemInstruction |
| `threads` | Conversation threads (1:1 and group) |
| `messages` | Individual chat messages with role, content, imageRef |
| `settings` | Key-value global config store (seeds 7 defaults on first launch) |
| `summaries` | Stored chat summarizer results (Polaroid / Memory mode, Phase 10) |

### State Management ([src/state/useAppStore.js](file:///home/amshu/src/Always-msg/src/state/useAppStore.js))
Zustand store with three slices ready for expansion:
- **ui** — activeMode, activeView, activeThreadId, activeContactId
- **contacts** — in-memory cache with upsert/remove helpers
- **settings** — in-memory key-value map, hydrated from IndexedDB on mount

### Routing ([src/router.jsx](file:///home/amshu/src/Always-msg/src/router.jsx))
React Router v6 with nested layout — [AppShell](file:///home/amshu/src/Always-msg/src/components/AppShell.jsx#9-76) wraps all views. `/` redirects to `/chat`.

### Layout Components
- [AppShell.jsx](file:///home/amshu/src/Always-msg/src/components/AppShell.jsx) — sticky header + scrollable `<Outlet>` + fixed bottom nav; initializes DB and hydrates store on mount
- [BottomNav.jsx](file:///home/amshu/src/Always-msg/src/components/BottomNav.jsx) — three tabs (Chat / Contacts / Settings) with inline SVG icons, active-link state

### Design System ([src/styles/global.css](file:///home/amshu/src/Always-msg/src/styles/global.css))
CSS custom properties: dark-mode-first palette, 8px spacing scale, Inter typography, `dvh`/`safe-area-inset` mobile support.

---

## Verification Results

````carousel
![Desktop view — Chat tab loaded with dark theme, bottom nav, correct header](./screenshot_desktop.png)
<!-- slide -->
![Mobile view — 390×844 (iPhone 14 Pro), layout fills screen, bottom nav thumb-reachable](./screenshot_mobile.png)
<!-- slide -->
![Verification recording](./phase1_verification_1772065675857.webp)
````

| Check | Result |
|---|---|
| Production build | ✅ 53 modules, 0 errors, 1.81s |
| PWA manifest | ✅ name, theme_color, display:standalone, icons 192+512 |
| Service worker | ✅ Registered + activated (dev mode) |
| IndexedDB tables | ✅ All 5 tables present: contacts, threads, messages, settings, summaries |
| Route navigation | ✅ /chat, /contacts, /settings all render correctly |
| Default redirect | ✅ / → /chat |
| Mobile layout (390px) | ✅ Header, content, bottom nav all correctly positioned |
| Console errors | ✅ None (only React Router future-flag warnings, non-critical) |

---

## Decisions That Affect Later Phases

1. **Dexie schema v1 locked** — future phases must increment the version number and add a new `.stores()` call; never edit v1 inline
2. **Zustand slices** — `audioSlice` (Phase 5), `llmSlice` (Phase 3), `ttsSlice` (Phase 6) should be added as new properties in [useAppStore.js](file:///home/amshu/src/Always-msg/src/state/useAppStore.js)
3. **CSS Module composition** — view modules currently compose from [src/styles/views.css](file:///home/amshu/src/Always-msg/src/styles/views.css). Each phase's new components should follow the same pattern.
4. **`imageRef` in messages table** — stored as a placeholder string/data-URL field; Phase 9 will populate this
5. **`seedCrystal` in threads table** — placeholder for Phase 10's New Chat from Current feature
