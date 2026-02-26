# Phase 3 + 4 Walkthrough — LLM Client, Chat UI & Full Chat Completion

**Phase 3 Status: ✅ Complete | Phase 4 Status: ✅ Complete**

---

## Phase 3 — LLM Client & Core Chat UI

### What Was Built

| File | Role |
|---|---|
| [src/llm/llmClient.js](file:///home/amshu/src/Always-msg/src/llm/llmClient.js) | Router — merges contact + global settings, dispatches to adapter |
| [src/llm/openaiAdapter.js](file:///home/amshu/src/Always-msg/src/llm/openaiAdapter.js) | SSE streaming via `ReadableStream` |
| [src/llm/lettaAdapter.js](file:///home/amshu/src/Always-msg/src/llm/lettaAdapter.js) | LETTA REST client |
| [src/llm/localAdapter.js](file:///home/amshu/src/Always-msg/src/llm/localAdapter.js) | Thin wrapper for Ollama/LM Studio |
| [src/db/threadsDb.js](file:///home/amshu/src/Always-msg/src/db/threadsDb.js) | [getOrCreateThread](file:///home/amshu/src/Always-msg/src/db/threadsDb.js#55-74), [updateThreadTimestamp](file:///home/amshu/src/Always-msg/src/db/threadsDb.js#75-82), [deleteThread](file:///home/amshu/src/Always-msg/src/db/threadsDb.js#83-93) |
| [src/db/messagesDb.js](file:///home/amshu/src/Always-msg/src/db/messagesDb.js) | [getMessages(limit)](file:///home/amshu/src/Always-msg/src/db/messagesDb.js#7-25), [addMessage](file:///home/amshu/src/Always-msg/src/db/messagesDb.js#39-57), [updateMessageContent](file:///home/amshu/src/Always-msg/src/db/messagesDb.js#58-66) |
| [src/components/MessageBubble.jsx](file:///home/amshu/src/Always-msg/src/components/MessageBubble.jsx) | User/assistant bubbles with streaming cursor |
| [src/components/ChatInput.jsx](file:///home/amshu/src/Always-msg/src/components/ChatInput.jsx) | Auto-growing textarea, Enter-to-send, spinner |

**Build:** 75 modules — 0 errors.

---

## Phase 4 — Full Chat UI Completion

### What Was Built

**New DB helpers:**
- [getAllThreads()](file:///home/amshu/src/Always-msg/src/db/threadsDb.js#3-10) — all threads ordered by `updatedAt` desc
- [createGroupThread(contactIds, title)](file:///home/amshu/src/Always-msg/src/db/threadsDb.js#11-28) — multi-contact thread
- [updateThreadTitle(id, title)](file:///home/amshu/src/Always-msg/src/db/threadsDb.js#29-37) — rename a thread
- [getLastMessage(threadId)](file:///home/amshu/src/Always-msg/src/db/messagesDb.js#26-38) — for sidebar preview text

**[GroupSheet.jsx](file:///home/amshu/src/Always-msg/src/components/GroupSheet.jsx)** — slide-up modal with Solo / Group toggle. Multi-select contact checklist, optional title input, "Start Chat" / "Create Group (N)" button.

**[ChatView.jsx](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx)** — completely rewritten:
- **Thread list sidebar** — shows all threads with participant avatars, last-message preview (60 chars), and relative timestamp ("2m", "3h", "Mon")
- **Delete thread** — hover reveals ✕ button; removes thread + all messages
- **FAB** — opens GroupSheet for new solo or group thread
- **Group send loop** — iterates contacts in `thread.contactIds`; each gets its own [streamChat](file:///home/amshu/src/Always-msg/src/llm/openaiAdapter.js#8-101) call and reply bubble with `senderName` label
- **Retry** — tracks `lastUserText`; error bubbles show ↺ Retry button

**[MessageBubble.jsx](file:///home/amshu/src/Always-msg/src/components/MessageBubble.jsx)** — added `senderName` label (group threads), `isError` detection, `onRetry` prop with styled button.

**[AppShell.jsx](file:///home/amshu/src/Always-msg/src/components/AppShell.jsx)** — subscribes to `activeThreadTitle` from store; shows contact/thread name in header when on `/chat`.

### Verification Results

````carousel
![Thread list with Aria thread visible, FAB in lower left](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/chat_thread_list_1772133901566.png)
<!-- slide -->
![GroupSheet — Solo mode with Aria selected and "Start Chat" enabled](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/new_chat_sheet_solo_1772133916491.png)
<!-- slide -->
![Aria thread open — header shows "Aria", error bubble with ↺ Retry button](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/dynamic_header_and_retry_button_1772133931725.png)
<!-- slide -->
![Group thread — GroupSheet in Group mode, Aria + Mira both selected](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/group_created_selection_1772133981254.png)
<!-- slide -->
![Group thread replies — two sequential error bubbles with Aria and Mira sender name labels](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/group_replies_1772134018232.png)
<!-- slide -->
![Phase 4 verification recording](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/phase4_verification_1772133813108.webp)
````

| Check | Result |
|---|---|
| Build — 77 modules | ✅ 0 errors |
| Thread list shows all threads with preview + time | ✅ |
| FAB opens GroupSheet with Solo/Group toggle | ✅ |
| New solo thread created from GroupSheet | ✅ |
| AppShell header updates to thread name | ✅ "Aria" shown in header |
| Retry button appears on error bubbles | ✅ ↺ Retry visible |
| Group thread created (Aria + Mira) | ✅ |
| Group send loop — both contacts reply in sequence | ✅ Two error bubbles with sender labels |
| Thread deletion — ✕ button removes thread | ✅ |
| Persistence after hard reload | ✅ |
| Console errors | ✅ None |

---

## Decisions Affecting Later Phases

1. **Group send loop** — Phase 5 (ASR) will call `handleSend` with transcribed text; group threads will automatically round-robin to all participants
2. **`activeThreadTitle` in store** — Phase 8 (Live Mode) will clear this when switching modes
3. **`senderName` on MessageBubble** — Phase 7 (Spectrograph) can key off sender to colour-code the visualizer per contact
4. **`lastUserText` state** — Phase 11 (Polish) can expand retry to include a retry-count cap
