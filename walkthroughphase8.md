# Phase 8 — Live Mode UI Walkthrough

## What Was Built

### Bug Fix 1 — LLM Repeated Responses
[openaiAdapter.js](file:///home/amshu/src/Always-msg/src/llm/openaiAdapter.js) now sends `temperature: 0.7` (overridable) and optional `max_tokens` in every request.
[llmClient.js](file:///home/amshu/src/Always-msg/src/llm/llmClient.js) threads temperature through from the contact/settings config.
**Root cause:** LM Studio defaults to `temperature: 0` for some models → identical responses every time.

### Bug Fix 2 — Per-Contact TTS
[ContactSheet.jsx](file:///home/amshu/src/Always-msg/src/components/ContactSheet.jsx) now has a **TTS Override** section below LLM Configuration:
- **Voice** — overrides global TTS voice for this contact
- **TTS Endpoint URL** — overrides global endpoint for this contact

Blank fields fall back to global settings, matching the pattern of per-contact LLM config.

[ChatView.jsx](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx) [onDone](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx#300-332) resolves TTS settings with contact-wins-over-global merge.

---

## Phase 8 — Live Mode

### Active Mode Toggle
Added to Settings → Audio/VAD section — **Push-to-Talk** | **Live** segmented control.

### Live Mode Layout
When Live mode is active:
- **Message bubbles hidden** via CSS (`opacity: 0`, `max-height: 0`)
- **Spectrograph** switches to `size="large"` and expands to fill the pane vertically
- **LIVE badge** — pulsing red gradient pill in the AppShell header next to the thread title
- **Camera button** — placeholder for Phase 9, disabled, left of input bar
- **Input bar** stays at the bottom in an `inputRow` flex container

---

## Verification Screenshots

### Per-Contact TTS Override in ContactSheet
![TTS Override fields in Contact Sheet](file:///home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/contact_tts_override_1772159614822.png)

### Settings — Active Mode Toggle
![Push/Live segmented control in Audio/VAD section](file:///home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/active_mode_toggle_1772161665388.png)

### Live Mode Activated — Thread Open
![LIVE badge in header, spectrograph centered, camera button + input bar at bottom](file:///home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/thread_open_live_mode_1772161891392.png)

---

## Browser Recording

![Phase 8 Live Mode verification recording](file:///home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/phase8_live_mode_thread_1772161834567.webp)

---

## Build Result
```
✓ 87 modules transformed
✓ built in 2.23s
0 errors, 0 warnings
```

## Files Changed
- [src/llm/openaiAdapter.js](file:///home/amshu/src/Always-msg/src/llm/openaiAdapter.js) — temperature + max_tokens
- [src/llm/llmClient.js](file:///home/amshu/src/Always-msg/src/llm/llmClient.js) — threads temperature through
- [src/components/ContactSheet.jsx](file:///home/amshu/src/Always-msg/src/components/ContactSheet.jsx) — ttsConfig with voice + endpoint override
- [src/components/ContactSheet.module.css](file:///home/amshu/src/Always-msg/src/components/ContactSheet.module.css) — sectionNote style
- [src/views/SettingsView.jsx](file:///home/amshu/src/Always-msg/src/views/SettingsView.jsx) — Active Mode toggle
- [src/views/ChatView.jsx](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx) — isLive, liveMode class, large spectrograph, inputRow, camera button, per-contact TTS resolution
- [src/views/ChatView.module.css](file:///home/amshu/src/Always-msg/src/views/ChatView.module.css) — liveMode, inputRow, cameraBtn classes
- [src/components/AppShell.jsx](file:///home/amshu/src/Always-msg/src/components/AppShell.jsx) — LIVE badge
- [src/components/AppShell.module.css](file:///home/amshu/src/Always-msg/src/components/AppShell.module.css) — liveBadge with pulse animation
