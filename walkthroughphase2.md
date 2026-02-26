# Phase 1 & 2 Walkthrough — Always Messenger PWA

**Phase 1 Status: ✅ Complete | Phase 2 Status: ✅ Complete**

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
![Desktop view — Chat tab loaded with dark theme, bottom nav, correct header](/home/amshu/.gemini/antigravity/brain/dd90aa9c-92f6-4d4c-ac20-9ab29831e02b/screenshot_desktop.png)
<!-- slide -->
![Mobile view — 390x844 (iPhone 14 Pro), layout fills screen, bottom nav thumb-reachable](/home/amshu/.gemini/antigravity/brain/dd90aa9c-92f6-4d4c-ac20-9ab29831e02b/screenshot_mobile.png)
<!-- slide -->
![Phase 1 verification recording](/home/amshu/.gemini/antigravity/brain/dd90aa9c-92f6-4d4c-ac20-9ab29831e02b/phase1_verification_1772065675857.webp)
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

5. **Dexie schema v1 locked** — future phases must increment the version number and add a new `.stores()` call; never edit v1 inline
2. **Zustand slices** — `audioSlice` (Phase 5), `llmSlice` (Phase 3), `ttsSlice` (Phase 6) should be added as new properties in [useAppStore.js](file:///home/amshu/src/Always-msg/src/state/useAppStore.js)
3. **CSS Module composition** — view modules currently compose from [src/styles/views.css](file:///home/amshu/src/Always-msg/src/styles/views.css). Each phase's new components should follow the same pattern.
4. **`imageRef` in messages table** — stored as a placeholder string/data-URL field; Phase 9 will populate this
5. **`seedCrystal` in threads table** — placeholder for Phase 10's New Chat from Current feature

---

## Phase 2 — Contact Cards & Settings

**Build:** `vite build` — 65 modules (+12), 0 errors

### What Was Built

**DB Helpers**
- [src/db/contactsDb.js](file:///home/amshu/src/Always-msg/src/db/contactsDb.js) — CRUD functions with cascade delete (threads + messages)
- [src/db/settingsDb.js](file:///home/amshu/src/Always-msg/src/db/settingsDb.js) — debounced [saveSetting](file:///home/amshu/src/Always-msg/src/db/settingsDb.js#13-24) / immediate [saveSettingNow](file:///home/amshu/src/Always-msg/src/db/settingsDb.js#37-46)

**UI Primitives** (`src/components/ui/`)

| Component | Purpose |
|---|---|
| `SegmentedControl` | OpenAI / LETTA / Local endpoint picker, TTS provider |
| `Sheet` | Slide-up bottom sheet with backdrop, escape key, scroll lock |
| `Slider` | Styled range input with fill gradient and live value label |
| `EmojiPicker` | 40-emoji inline grid for avatar selection |

**ContactSheet** (`src/components/ContactSheet.jsx`)
- Create / edit modal: name, emoji avatar, system instruction, full LLM config
- API key visibility toggle
- Delete with two-tap confirmation
- Syncs to Dexie + Zustand on save

**ContactsView** (replaced stub)
- Contact list with avatar, name, model, endpoint badge
- FAB to open new-contact sheet
- Empty state

**SettingsView** (replaced stub)
- LLM default config (endpoint type, base URL, model)
- TTS config (provider, endpoint, speed slider)
- Audio/VAD (sensitivity + interrupt threshold sliders)
- Context window size slider
- All controls debounce-persist to IndexedDB

### Verification Results

````carousel
![App on load — clean dark UI, Chat tab active, bottom navigation](/home/amshu/.gemini/antigravity/brain/dd90aa9c-92f6-4d4c-ac20-9ab29831e02b/p2_app_load.png)
<!-- slide -->
![New Contact sheet — Avatar picker, System Instruction field, LLM Configuration section with SegmentedControl](/home/amshu/.gemini/antigravity/brain/dd90aa9c-92f6-4d4c-ac20-9ab29831e02b/p2_contact_sheet.png)
<!-- slide -->
![Phase 2 verification recording](/home/amshu/.gemini/antigravity/brain/dd90aa9c-92f6-4d4c-ac20-9ab29831e02b/phase2_verification_1772066873906.webp)
````

| Check | Result |
|---|---|
| Build — 65 modules | ✅ 0 errors |
| Create contact (Aria, emoji, Local config) | ✅ Appears in list with badge |
| Edit contact (rename to Aria v2) | ✅ Card updated immediately |
| Settings panel — all sections present | ✅ LLM / TTS / VAD / Context |
| TTS provider switch + speed slider | ✅ Functional, value label updates |
| Persistence on hard reload | ✅ Settings + contacts survive reload |
| Delete with confirm (two-tap) | ✅ Card removed, empty state shows |
| Console errors | ✅ None |

### Decisions Affecting Later Phases

1. **`endpointType`** stored on contact `llmConfig` — Phase 3 LLM client adapter selection reads this field
2. **Global settings as defaults** — Phase 3 LLM client falls back to `settings.baseUrl/model` when contact config is blank
3. **`Sheet` component is reusable** — Phase 10's summarizer UI and Phase 9's image-attach flow can use the same Sheet primitive
