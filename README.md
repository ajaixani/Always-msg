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

### Spectrograph Mouth
- Visualizes TTS output as a symmetrical spectrograph mirrored on both axes
- Flowing rainbow gradient with perlin noise hue drift (no mechanical periodicity)
- Animates only during TTS playback; idles gracefully

### Memory System
- Rolling context window (configurable size)
- **Chat Summarizer** — Polaroid mode (vivid image prompt) or Memory mode (dense narrative)
- **Seed Crystal / New Chat** — distill current thread into a ~2000 char seed for a fresh conversation

### Vision
- Camera capture in Live Mode; attaches current frame to LLM request
- Manual image attach in Push-to-Activate mode
- Graceful degradation for non-vision models

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
| 3 — LLM Client Module | ⬜ Planned | Unified adapter for OpenAI / LETTA / Local |
| 4 — Chat UI | ⬜ Planned | Text thread, send/receive, context window |
| 5 — Audio: ASR & VAD | ⬜ Planned | Mic access, VAD, push-to-activate + live mode |
| 6 — TTS Client | ⬜ Planned | Kokoro + Vibe Voice, streaming playback, interrupt |
| 7 — Spectrograph Mouth | ⬜ Planned | Canvas visualizer, rainbow gradient, two size states |
| 8 — Live Mode UI | ⬜ Planned | Full live mode layout, all audio/visual features |
| 9 — Vision | ⬜ Planned | Camera capture, image attach, vision detection |
| 10 — Memory & Summarizer | ⬜ Planned | Rolling context, Polaroid/Memory modes, Seed Crystal |
| 11 — Polish & Hardening | ⬜ Planned | Offline support, error states, accessibility, perf audit |

---

## Project Structure

```
src/
├── components/
│   ├── ui/              # Shared primitives: Sheet, Slider, SegmentedControl, EmojiPicker
│   ├── AppShell.jsx     # Persistent layout: header + outlet + bottom nav
│   ├── BottomNav.jsx    # Three-tab navigation
│   └── ContactSheet.jsx # Create/edit AI persona sheet
├── db/
│   ├── db.js            # Dexie schema (contacts, threads, messages, settings, summaries)
│   ├── contactsDb.js    # Contact CRUD helpers
│   └── settingsDb.js    # Debounced settings persistence
├── state/
│   └── useAppStore.js   # Zustand global store
├── styles/
│   └── global.css       # CSS custom properties design system
└── views/
    ├── ChatView.jsx
    ├── ContactsView.jsx
    └── SettingsView.jsx
```

---

## License

MIT
