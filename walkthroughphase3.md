# Phase 3 Walkthrough — LLM Client & Chat UI

**Status: ✅ Complete**

---

## What Was Built

### LLM Adapter Layer (`src/llm/`)

| File | Role |
|---|---|
| `llmClient.js` | Router — merges contact + global settings, dispatches to adapter |
| `openaiAdapter.js` | SSE streaming via `ReadableStream` (OpenAI, Together, OpenRouter) |
| `lettaAdapter.js` | LETTA REST client — parses `send_message` tool call from response |
| `localAdapter.js` | Thin wrapper for Ollama/LM Studio on `localhost:11434/v1` |

**Key design:** `streamChat({ contact, settings, messages, onToken, onDone, onError })` — contact-level config wins, falls back to global settings. System instruction is prepended inside the router before dispatching.

### DB Helpers

- [threadsDb.js](file:///home/amshu/src/Always-msg/src/db/threadsDb.js) — `getOrCreateThread(contactId)` ensures 1 persistent thread per contact; `updateThreadTimestamp` keeps ordering fresh.
- [messagesDb.js](file:///home/amshu/src/Always-msg/src/db/messagesDb.js) — `getMessages(threadId, limit)` slices to `contextWindowSize`; `addMessage` + `updateMessageContent` for streaming finalization.

### State — `llmSlice`

Added to [useAppStore.js](file:///home/amshu/src/Always-msg/src/state/useAppStore.js):
- `isStreaming` / `setStreaming` — blocks double-sends, disables input
- `streamingMessageId` / `setStreamingMessageId` — reserved for future optimistic updates

### Chat UI

**[ChatView.jsx](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx)** — two-panel layout:
- **Left**: contact list with avatar, name, endpoint badge; tap to open thread
- **Right**: scrollable message list + sticky `ChatInput`
- Mobile (<640px): single-panel with back button (CSS-only panel switching)

**[MessageBubble.jsx](file:///home/amshu/src/Always-msg/src/components/MessageBubble.jsx)** — user bubbles right-aligned (`--color-bubble-user`), assistant bubbles left with emoji avatar. Streaming state shows a blinking accent-coloured cursor.

**[ChatInput.jsx](file:///home/amshu/src/Always-msg/src/components/ChatInput.jsx)** — auto-growing textarea (1–5 rows), Enter sends, Shift+Enter newlines, spinner icon while streaming, disabled when `isStreaming`.

### Send Flow (inside `ChatView`)
```
user submits → persist user msg → display bubble → 
call streamChat → onToken: append to streamingText state → 
onDone: persist full reply → display final bubble → clear streaming
onError: persist error bubble → clear streaming
```

---

## Verification Results

````carousel
![Chat list with Aria contact visible](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/chat_list_with_aria_1772106235902.png)
<!-- slide -->
![Empty conversation pane for Aria](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/aria_empty_chat_1772106247611.png)
<!-- slide -->
![User bubble sent; adapter correctly attempted local endpoint and returned an error bubble](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/aria_chat_error_state_1772106269222.png)
<!-- slide -->
![After hard reload — conversation history persisted from IndexedDB](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/aria_chat_persistence_check_1772106288843.png)
<!-- slide -->
![Phase 3 full verification recording](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/phase3_verification_1772106091956.webp)
````

| Check | Result |
|---|---|
| Build — 75 modules | ✅ 0 errors (up from 65 in Phase 2) |
| Contact list renders in Chat tab | ✅ |
| Click contact → opens conversation pane | ✅ |
| Send message → user bubble appears | ✅ |
| LLM adapter invoked (error bubble on 404) | ✅ `LLM error 404: model 'llama3' not found` |
| Conversation persists after hard reload | ✅ IndexedDB round-trip confirmed |
| Mobile layout — back button visible | ✅ (CSS media query, < 640px) |
| Console errors | ✅ None |

---

## Decisions Affecting Later Phases

1. **`streamChat` callback contract** — Phase 5 (Push-to-Talk) and Phase 8 (Live Mode) will reuse `onToken`/`onDone`/`onError` to pipe audio TTS alongside text streaming
2. **`getOrCreateThread`** — Phase 10 (New Chat from Current) will call `deleteThread` + re-run `getOrCreateThread` seeded with a `seedCrystal` summary
3. **`updateMessageContent`** — reserved for Phase 9 image attach (replace placeholder content with final OCR/caption)
4. **`isStreaming` in store** — the live-mode toggle (Phase 8) will set this permanently true while VAD is active
