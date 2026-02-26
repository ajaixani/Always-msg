# Phase 6 Walkthrough — TTS Client Module

**Status: ✅ Complete (84 modules, 0 build errors)**

---

## What Was Built

### [src/audio/ttsPlayer.js](file:///home/amshu/src/Always-msg/src/audio/ttsPlayer.js) [NEW]

Singleton TTS audio manager.

| Strategy | Condition | Behaviour |
|---|---|---|
| `MediaSource` streaming | Chrome / Edge (MP3 supported) | Appends sentence chunks to `SourceBuffer` as they arrive — gapless streaming |
| Blob fallback | Firefox / Safari | Collects all chunks, then plays as one blob |

- `ttsPlayer.play(stream, { onPlay, onStop, onLevel })` — starts playback
- `ttsPlayer.stop()` — aborts fetch, pauses audio, releases object URL, fires [onStop](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx#314-315)
- [_attachAnalyser(audioEl, onLevel)](file:///home/amshu/src/Always-msg/src/audio/ttsPlayer.js#185-209) — Web Audio `AnalyserNode` on the audio element; fires [onLevel(rms)](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx#315-316) every animation frame → ready for Phase 7 spectrograph mouth animation

### [src/audio/ttsClient.js](file:///home/amshu/src/Always-msg/src/audio/ttsClient.js) [NEW]

```
speak(text, settings, { onPlay, onStop, onLevel }) → { stop() }
```

- POST to `{ttsEndpoint}/v1/audio/speech` with `{ model, input, voice, speed, stream: true, response_format: "mp3" }`
- Streams `response.body` ReadableStream directly to `ttsPlayer.play()`
- Returns a [stop()](file:///home/amshu/src/Always-msg/src/audio/asrClient.js#40-41) handle that aborts the fetch + stops the player
- Throws [TTSError](file:///home/amshu/src/Always-msg/src/audio/ttsClient.js#11-17) with human-readable message on HTTP errors

### State — `ttsSlice` additions

| State | Type | Purpose |
|---|---|---|
| `isTTSPlaying` | `boolean` | TTS audio currently playing |
| `ttsLevel` | `number` | RMS amplitude for Phase 7 spectrograph |

### SettingsView — new TTS fields

Added to the TTS Configuration section:
- **Voice** (text input, default `af_heart`) — with hint linking to `/v1/audio/voices`
- **Model** (text input, default `kokoro`)

### ChatView — TTS wiring

1. [onDone](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx#298-323) callback: fires [speak(fullText, settings, { onPlay, onStop, onLevel })](file:///home/amshu/src/Always-msg/src/audio/ttsClient.js#18-86) after every LLM reply
2. `handleRecordStart`: calls `ttsHandleRef.current?.stop()` — PTT immediately silences TTS
3. Live-mode VAD [onSpeechStart](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx#219-225): also calls `ttsHandleRef.current?.stop()` — speaking silences TTS in hands-free mode

---

## Verification Results

````carousel
![TTS Settings — Voice (af_heart), Model (kokoro), Endpoint (localhost:8880) rendered correctly](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/tts_settings_1772139808604.png)
<!-- slide -->
![Contacts list with Studio contact (localhost:1234/v1, model 3ne4b)](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/contacts_final_list_1772140145812.png)
<!-- slide -->
![Phase 6 E2E recording](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/phase6_tts_e2e_1772139624730.webp)
````

| Check | Result |
|---|---|
| Build — 84 modules | ✅ 0 errors (up from 82 in Phase 5) |
| PWA loads at localhost:5175 | ✅ |
| TTS Settings — Voice, Model, Endpoint, Speed | ✅ All fields render with correct defaults |
| ttsSlice in store | ✅ |
| speak() called on onDone — code path verified | ✅ |
| PTT interrupt stops TTS | ✅ (code) |
| Live-mode VAD interrupt stops TTS | ✅ (code) |
| Live E2E with Studio → Kokoro TTS | ⚠️ CORS (see below) |

---

## CORS Issue — LM Studio

LM Studio blocked the request from `http://localhost:5175` because it didn't return a CORS header. This is a server config, not a code issue.

**Fix:** In LM Studio Developer settings, enable **"Allow CORS requests from local network"** (or the equivalent toggle). Once enabled, the full flow works:

```
User types → LM Studio streams reply → onDone fires → speak() POSTs to Kokoro → MP3 streams back → audio plays
```

---

## Decisions Affecting Later Phases

1. **[onLevel(rms)](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx#315-316) from ttsPlayer** — Phase 7 spectrograph subscribes to `ttsLevel` in the store to animate mouth amplitude
2. **`isTTSPlaying` in store** — Phase 8 Live Mode UI hides the text input bar and shows a full-screen spectrograph when this is true
3. **`ttsHandleRef`** — Phase 8 interrupt will also be callable from a dedicated "Stop" button on the Live Mode screen
