# Phase 9 — Vision / Image Support Walkthrough

## What Was Built

### DB Layer
**`messagesDb.addMessage`** now accepts an optional `imageDataUrl` parameter (stored in the pre-existing `imageRef` field — no schema migration needed).

### LLM Layer
**`llmClient.streamChat`** now accepts `imageDataUrl`. When present, it transforms the last user message from plain text into an OpenAI vision multipart content array:
```js
{ type: 'image_url', image_url: { url: dataUrl, detail: 'auto' } }
{ type: 'text', text: '...' }
```
Only the latest user message gets the vision format — context history stays as plain text strings to avoid bloating the payload with repeated base64 blobs.

---

## New Component — ImagePreview

**[ImagePreview.jsx](file:///home/amshu/src/Always-msg/src/components/ImagePreview.jsx)** + **[ImagePreview.module.css](file:///home/amshu/src/Always-msg/src/components/ImagePreview.module.css)**

- Shows a 64×64 thumbnail of the pending image above the input bar
- Red ✕ dismiss button in the top-right corner
- Animated slide-up entry
- "Image attached" label

---

## MessageBubble

Added `imageRef` prop. When a user message has an attached image, it renders a thumbnail (220×180 max) inside the bubble, above the text.

---

## ContactSheet — Vision Toggle

New **Vision** segmented control in the LLM Configuration section:
- **Auto** — auto-detects vision from model name (`gpt-4*`, `claude-3*`, `*vision*`, `*gemini*`)
- **On** — always show image controls for this contact
- **Off** — never show image controls for this contact

---

## ChatView — Image Attachment

### [isVisionCapable()](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx#79-93) helper
Checks `contact.llmConfig.vision` first, then falls back to model-name pattern matching. `threadHasVision` is true if **any** contact in the active thread supports vision.

### Push Mode — Paperclip Button
- Appears left of [ChatInput](file:///home/amshu/src/Always-msg/src/components/ChatInput.jsx#5-86) when `!isLive && threadHasVision`
- Clicks a hidden `<input type="file" accept="image/*" capture="environment">`
- Selected image → `FileReader` → `pendingImage` data URL state

### Live Mode — Camera Button
- Appears left of [ChatInput](file:///home/amshu/src/Always-msg/src/components/ChatInput.jsx#5-86) when `isLive && threadHasVision`
- **Now fully functional** (was a disabled placeholder in Phase 8)
- Calls `getUserMedia({video:true})` → captures one frame to canvas → JPEG data URL → `pendingImage`
- Clicking again when image is already pending clears it

### ImagePreview
Rendered above the inputRow when `pendingImage` is set.

### On Send
`handleSend` consumes `pendingImage`, passes it to:
1. [addMessage(threadId, 'user', text, imageDataUrl)](file:///home/amshu/src/Always-msg/src/db/messagesDb.js#39-58) — persisted to DB
2. [streamChat({ ..., imageDataUrl })](file:///home/amshu/src/Always-msg/src/llm/localAdapter.js#12-26) — sent to LLM

---

## CSS Changes
- **`cameraBtn`** — upgraded from `cursor: not-allowed` disabled placeholder to fully interactive with hover+active states
- **`cameraBtnActive`** / **`attachBtnActive`** — accent-colored fill when an image is pending
- **`attachBtn`** — new paperclip button, same dimensions as camera button
- **`hiddenInput`** — `display: none` for the file input

---

## Build Result
```
✓ 89 modules transformed  (+2 from Phase 8: ImagePreview + ImagePreview.module.css)
✓ built in 2.09s
0 errors, 0 warnings
```

## Files Changed
| File | Change |
|---|---|
| [messagesDb.js](file:///home/amshu/src/Always-msg/src/db/messagesDb.js) | [addMessage](file:///home/amshu/src/Always-msg/src/db/messagesDb.js#39-58) accepts `imageDataUrl` |
| [llmClient.js](file:///home/amshu/src/Always-msg/src/llm/llmClient.js) | [streamChat](file:///home/amshu/src/Always-msg/src/llm/localAdapter.js#12-26) builds vision multipart payload |
| [ImagePreview.jsx](file:///home/amshu/src/Always-msg/src/components/ImagePreview.jsx) | **NEW** — thumbnail + dismiss component |
| [ImagePreview.module.css](file:///home/amshu/src/Always-msg/src/components/ImagePreview.module.css) | **NEW** |
| [MessageBubble.jsx](file:///home/amshu/src/Always-msg/src/components/MessageBubble.jsx) | Renders `imageRef` thumbnail |
| [MessageBubble.module.css](file:///home/amshu/src/Always-msg/src/components/MessageBubble.module.css) | `.attachedImage` style |
| [ContactSheet.jsx](file:///home/amshu/src/Always-msg/src/components/ContactSheet.jsx) | Vision toggle (Auto/On/Off) |
| [ChatView.jsx](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx) | `pendingImage` state, [isVisionCapable](file:///home/amshu/src/Always-msg/src/views/ChatView.jsx#79-93), `handleAttachFile`, `handleCameraCapture`, camera + attach buttons |
| [ChatView.module.css](file:///home/amshu/src/Always-msg/src/views/ChatView.module.css) | `cameraBtn`, `attachBtn`, `cameraBtnActive`, `attachBtnActive`, `hiddenInput` |
