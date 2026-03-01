# Always Messenger

A **Progressive Web App** for real-time multimodal and text communication with LLMs. Designed mobile-first; installable on iOS and Android as a standalone app.

---

## Features

### Core Interaction Modes
- **Push-to-Activate** — hold a button to record; ASR result auto-sends after VAD closes; small spectrograph mouth above the button
- **Live Mode** — continuous listening with VAD interrupt handling; large spectrograph mouth centered on screen

### AI Personas (Contact Cards)
- Each contact is a configurable AI persona with its own system instruction, LLM endpoint, and model
- Supports **OpenAI API**, **LETTA streaming voice agents**, and **local inference** (Ollama / LM Studio)
- Group threads: single conversation with multiple AI personas

### Audio Pipeline
- VAD-based voice detection with configurable sensitivity
- ASR in push-to-activate and live/interrupt modes
- TTS via **Kokoro** or **Vibe Voice Realtime** (OpenAI-compatible endpoints), configurable playback speed
- TTS interrupt: VAD speech detection stops active playback immediately

### Spectrograph Mouth
- Visualizes TTS output as a symmetrical spectrograph mirrored on both axes
- Flowing rainbow gradient with Perlin noise hue drift (no mechanical periodicity)
- Two size/position states: small + bottom-anchored (push-to-activate), large + centered (live mode)
- Animates only during TTS playback; idles gracefully

### Memory System
- Rolling context window (configurable size)
- **Chat Summarizer** — Polaroid mode (vivid image prompt) or Memory mode (dense narrative)
- **Seed Crystal / New Chat** — distill current thread into a ~2000-char seed for a fresh conversation, or start fresh from a single response

### Vision
- Camera capture in Live Mode; attaches current frame to LLM request
- Manual image attach in Push-to-Activate mode
- Graceful degradation for non-vision models

### PWA & Polish
- Installable on iOS and Android (standalone display mode)
- Service worker with Workbox precaching for offline asset delivery
- Offline banner with `aria-live` alert when connectivity is lost
- LLM and TTS endpoint test buttons with live status indicators in Settings
- ARIA attributes throughout (`aria-busy`, `role="alert"`, `aria-live`)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Vite + React 18 |
| PWA | vite-plugin-pwa (Workbox) |
| State | Zustand |
| Storage | Dexie.js (IndexedDB) |
| Routing | React Router v6 |
| Styling | Vanilla CSS Modules + custom properties |

---

## Getting Started

```bash
git clone https://github.com/ajaixani/Always-msg.git
cd Always-msg
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). To install as a PWA, use Chrome's **Install app** option in the address bar.

---

## Development Phases

| Phase | Status | Deliverable |
|---|---|---|
| 1 — Project Scaffold | ✅ Complete | Installable PWA shell, routing, IndexedDB schema |
| 2 — Contacts & Settings | ✅ Complete | Contact CRUD, per-contact LLM config, settings UI |
| 3 — LLM Client Module | ✅ Complete | Unified adapter for OpenAI / LETTA / Local |
| 4 — Chat UI | ✅ Complete | Text thread, send/receive, context window |
| 5 — Audio: ASR & VAD | ✅ Complete | Mic access, VAD, push-to-activate + live mode |
| 6 — TTS Client | ✅ Complete | Kokoro + Vibe Voice, streaming playback, interrupt |
| 7 — Spectrograph Mouth | ✅ Complete | Canvas visualizer, rainbow gradient, two size states |
| 8 — Live Mode UI | ✅ Complete | Full live mode layout, all audio/visual features |
| 9 — Vision | ✅ Complete | Camera capture, image attach, vision detection |
| 10 — Memory & Summarizer | ✅ Complete | Rolling context, Polaroid/Memory modes, Seed Crystal |
| 11 — Polish & Hardening | ✅ Complete | Offline banner, endpoint validation, ARIA, perf audit |

---

## Project Structure

```
src/
├── audio/
│   ├── asrClient.js      # Web Speech API ASR wrapper (push-to-activate + live)
│   ├── micCapture.js     # Microphone stream acquisition
│   ├── perlin.js         # Perlin noise for spectrograph hue drift
│   ├── ttsClient.js      # TTS fetch adapter (Kokoro / Vibe Voice)
│   ├── ttsPlayer.js      # Streaming audio playback + interrupt logic
│   └── vad.js            # Voice Activity Detection with configurable threshold
├── components/
│   ├── ui/               # Shared primitives: Sheet, Slider, SegmentedControl, EmojiPicker
│   ├── AppShell.jsx      # Persistent layout: header + outlet + bottom nav + OfflineBanner
│   ├── BottomNav.jsx     # Three-tab navigation
│   ├── ChatInput.jsx     # Text input bar with image attach and push-to-talk trigger
│   ├── ContactSheet.jsx  # Create/edit AI persona sheet
│   ├── GroupSheet.jsx    # Create/edit group thread sheet
│   ├── ImagePreview.jsx  # Attached image preview before send
│   ├── MessageBubble.jsx # Chat bubble (text + image thumbnail support)
│   ├── OfflineBanner.jsx # Offline detection banner with aria-live
│   ├── PushToTalkButton.jsx   # Hold-to-record button with VAD feedback
│   ├── SeedCrystalSheet.jsx   # New Chat from Current / Single Response sheet
│   ├── SpectrographMouth.jsx  # Canvas TTS visualizer (mirrored, rainbow gradient)
│   └── SummarizerSheet.jsx    # Polaroid / Memory mode summarizer sheet
├── db/
│   ├── db.js             # Dexie schema (contacts, threads, messages, settings, summaries)
│   ├── contactsDb.js     # Contact CRUD helpers
│   ├── messagesDb.js     # Message persistence (with large-image warning)
│   ├── settingsDb.js     # Debounced settings persistence
│   └── threadsDb.js      # Thread CRUD helpers
├── llm/
│   ├── llmClient.js      # Unified LLM client (routing + streaming handler)
│   ├── openaiAdapter.js  # OpenAI chat completions adapter (streaming)
│   ├── lettaAdapter.js   # LETTA streaming voice agent adapter
│   ├── localAdapter.js   # Local inference adapter (Ollama / LM Studio)
│   └── summarizeClient.js # Summarizer inference calls (Polaroid / Memory / Seed Crystal)
├── state/
│   └── useAppStore.js    # Zustand global store (ui, contacts, settings, audio, tts slices)
├── styles/
│   └── global.css        # CSS custom properties design system
└── views/
    ├── ChatView.jsx       # Main chat screen (push-to-activate + live mode, full feature set)
    ├── ContactsView.jsx   # Contact list with group thread support
    ├── SettingsView.jsx   # Global settings + LLM/TTS endpoint validation
    └── ...module.css      # Per-view CSS modules
```

---

## License

MIT
