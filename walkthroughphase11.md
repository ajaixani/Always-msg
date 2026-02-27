# Phase 11 — Polish, Edge Cases & PWA Hardening Walkthrough

## Build Result
```
✓ 97 modules transformed  (+2 from Phase 10: OfflineBanner + OfflineBanner.module.css)
✓ built in 2.08s
0 errors, 0 warnings
```

---

## What Was Done

### 1. Offline Detection — [OfflineBanner](file:///home/amshu/src/Always-msg/src/components/OfflineBanner.jsx#4-32)
New **[OfflineBanner.jsx](file:///home/amshu/src/Always-msg/src/components/OfflineBanner.jsx)** + **[OfflineBanner.module.css](file:///home/amshu/src/Always-msg/src/components/OfflineBanner.module.css)** mounted at the very top of [AppShell](file:///home/amshu/src/Always-msg/src/components/AppShell.jsx#10-71). Uses `window.addEventListener('offline' | 'online')` to show/hide a red gradient banner:

> ⚡ No internet connection — messages will not send

- `role="alert"` + `aria-live="assertive"` for screen-reader awareness
- Slide-down animation on appear
- Auto-hides when connectivity returns

---

### 2. Settings Endpoint Validation
**Two "Test" buttons** added to [SettingsView](file:///home/amshu/src/Always-msg/src/views/SettingsView.jsx#25-362):

| Button | What it hits | Timeout |
|---|---|---|
| **Test Connection** (LLM) | `GET {baseUrl}/models` | 6 s |
| **Test TTS** | `POST {ttsEndpoint}/audio/speech` with a short payload | 8 s |

Status indicators: `🔄 Testing…` → `✅ Connected` or `⚠️ HTTP 502: ...`

New CSS: `.testBtn`, `.testRow`, `.statusOk`, `.statusError`, `.statusTesting`, `.labelNote`

---

### 3. ARIA Improvements
| Change | File |
|---|---|
| `aria-busy={isStreaming}` on conversation `<section>` | [ChatView.jsx](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx) |
| `role="alert"` on error `<p>` | [SummarizerSheet.jsx](file:///home/amshu/src/Always-msg/src/components/SummarizerSheet.jsx), [SeedCrystalSheet.jsx](file:///home/amshu/src/Always-msg/src/components/SeedCrystalSheet.jsx) |
| Existing `role="alert"` + `aria-live="assertive"` | [OfflineBanner.jsx](file:///home/amshu/src/Always-msg/src/components/OfflineBanner.jsx) |

---

### 4. ⋯ Menu Outside-Click Close
Added `menuWrapperRef` + a `useEffect` that listens for `mousedown` events on `document` and closes the ⋯ menu when the click lands outside the wrapper div. Previously the menu stayed open until a menu item was clicked.

---

### 5. Performance
| Change | Detail |
|---|---|
| `loading="lazy"` | Image thumbnails in [MessageBubble](file:///home/amshu/src/Always-msg/src/components/MessageBubble.jsx#3-57) |
| `scroll-behavior: smooth` | `.messages` list in [ChatView.module.css](file:///home/amshu/src/Always-msg/src/views/ChatView.module.css) |
| `console.warn` if image > 500 KB | `messagesDb.addMessage` |
| SpectrographMouth RAF cancel | Already correct — `cancelAnimationFrame(rafRef.current)` in cleanup |

---

## Files Changed
| File | Change |
|---|---|
| [OfflineBanner.jsx](file:///home/amshu/src/Always-msg/src/components/OfflineBanner.jsx) | **NEW** |
| [OfflineBanner.module.css](file:///home/amshu/src/Always-msg/src/components/OfflineBanner.module.css) | **NEW** |
| [AppShell.jsx](file:///home/amshu/src/Always-msg/src/components/AppShell.jsx) | Import + render OfflineBanner |
| [SettingsView.jsx](file:///home/amshu/src/Always-msg/src/views/SettingsView.jsx) | Test buttons, status states, testLLM/testTTS callbacks |
| [SettingsView.module.css](file:///home/amshu/src/Always-msg/src/views/SettingsView.module.css) | .testBtn, .testRow, .statusOk/Error/Testing, .labelNote |
| [ChatView.jsx](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx) | aria-busy, outside-click menu close, menuWrapperRef |
| [ChatView.module.css](file:///home/amshu/src/Always-msg/src/views/ChatView.module.css) | scroll-behavior: smooth on .messages |
| [MessageBubble.jsx](file:///home/amshu/src/Always-msg/src/components/MessageBubble.jsx) | loading="lazy" on image thumbnail |
| [SummarizerSheet.jsx](file:///home/amshu/src/Always-msg/src/components/SummarizerSheet.jsx) | role="alert" on error paragraph |
| [SeedCrystalSheet.jsx](file:///home/amshu/src/Always-msg/src/components/SeedCrystalSheet.jsx) | role="alert" on error paragraph |
| [messagesDb.js](file:///home/amshu/src/Always-msg/src/db/messagesDb.js) | Large image console.warn |
