# Phase 5 Walkthrough — Audio Pipeline: ASR & VAD

**Status: ✅ Complete**

---

## What Was Built

### `src/audio/` [NEW]

| File | Role |
|---|---|
| `micCapture.js` | `getUserMedia` + `MediaRecorder` wrapper; typed `MicPermissionError`; best-effort MIME selection (webm/opus → ogg/opus → mp4) |
| `vad.js` | Web Audio `AnalyserNode` RMS VAD; polls every 30 ms; configurable `sensitivity` (0–1 maps to 0.02–0.20 RMS threshold); fires `onSpeechStart`/`onSpeechEnd` after 800 ms of silence; returns `onLevel(rms)` for Phase 7 spectrograph |
| `asrClient.js` | ASR router: `createSpeechSession()` for Web Speech API (Chrome/Edge); `transcribeBlob()` for POST to local Whisper endpoint |

### [NEW] `src/components/PushToTalkButton.jsx` + `.module.css`

Hold-to-record mic button placed **left of the textarea** in `ChatInput`. Visual states:

| State | Appearance |
|---|---|
| Idle | Dim mic icon |
| Recording | Accent border + pulsing ring animation |
| VAD speaking | Brighter accent + larger scale |
| Error | Red + shake animation |

`touch-action: none` prevents scroll-jacking on mobile. Global `pointerup` listener ensures release is always caught even if pointer leaves the button.

### State — `audioSlice`

Added to `useAppStore.js`:
- `isRecording` / `setRecording` — PTT held
- `isListening` / `setListening` — live mode active
- `vadActive` / `setVadActive` — VAD detecting speech
- `micError` / `setMicError` — error message for PTT error state

### ChatView — PTT wiring

`handleRecordStart`:
1. Checks `settings.asrEndpoint` — if set, uses Whisper path (`startRecording()`)
2. Otherwise uses `createSpeechSession()` (Web Speech API)
3. Sets `isRecording = true` in store

`handleRecordStop`:
1. For Web Speech: calls `.stop()` on the recognition session; transcript arrives via `onResult` callback → `handleSend()`
2. For Whisper: finalises blob → `transcribeBlob(blob, settings)` → `handleSend()`

**Live mode VAD loop** — `useEffect` keyed on `settings.activeMode` and the active thread:
- When `activeMode === 'live'`: acquires mic, starts a `createVAD` loop, fires `handleSend` on each `onSpeechEnd`
- Cleans up on thread change or mode switch

### SettingsView — ASR Config

Two new fields added to the Audio / VAD section:
- **ASR Endpoint URL** — optional; leave blank to use Web Speech API (Chrome)
- **ASR Model** — default `whisper-1`

---

## Verification Results

````carousel
![PTT mic button visible in chat input bar to the left of the textarea; "↺ Retry" visible below the error bubble](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/ptt_button_visible_1772135149140.png)
<!-- slide -->
![Settings → Audio / VAD — new ASR Endpoint URL and ASR Model fields](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/settings_asr_fields_1772135161229.png)
<!-- slide -->
![Phase 5 verification recording](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/phase5_verification_1772135117451.webp)
````

| Check | Result |
|---|---|
| Build — 82 modules | ✅ 0 errors (up from 77 in Phase 4) |
| PTT mic button in chat input bar | ✅ Visible left of textarea |
| Settings → ASR Endpoint URL + Model fields | ✅ Rendered with correct placeholders |
| Error bubble + Retry still works | ✅ Visible in screenshot |
| AppShell header shows "Aria" | ✅ |
| `micCapture`, `vad`, `asrClient` modules importable | ✅ (82 modules bundles cleanly) |

---

## Decisions Affecting Later Phases

1. **`onLevel(rms)` callback in VAD** — Phase 7 Spectrograph will connect to this to drive the mouth visualizer amplitude
2. **`isListening` in store** — Phase 8 (Live Mode UI) will permanently show the spectrograph when `isListening === true`
3. **`setVadActive`** — Phase 8 mouth visualizer will pulse only when `vadActive === true`
4. **Web Speech API vs Whisper** — users on Firefox must set an ASR endpoint; a console warning is logged by `asrClient.js` if neither is available
5. **Live mode VAD loop** — currently scaffolded; Phase 8 will add the full visual layout around it
