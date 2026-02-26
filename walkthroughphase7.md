# Phase 7 Walkthrough — Spectrograph Mouth Visualizer

**Status: ✅ Complete (87 modules, 0 build errors)**

---

## What Was Built

### [src/audio/perlin.js](file:///home/amshu/src/Always-msg/src/audio/perlin.js) [NEW]

Tiny (55-line) dependency-free 1D Perlin noise using a seeded permutation table + cubic Hermite fade.

```
noise1d(x) → ~[-1, 1]
```

Used to smoothly offset the hue rainbow so it drifts organically rather than cycling mechanically.

---

### [src/components/SpectrographMouth.jsx](file:///home/amshu/src/Always-msg/src/components/SpectrographMouth.jsx) + [.module.css](file:///home/amshu/src/Always-msg/src/views/ChatView.module.css) [NEW]

Canvas `requestAnimationFrame` loop with no external dependencies.

**Rendering algorithm:**

| Step | What happens |
|---|---|
| Poll `ttsPlayer.getAnalyser()` each frame | Gets FFT data when TTS is playing, `null` when idle |
| 32 bars (right half) → mirrored to left | Produces 64 bars total — symmetrical mouth |
| Each bar drawn up AND down from centre Y | Full vertical mirror — "open mouth" diamond shape |
| `hue = baseHue + (i/N * 280) + noise1d(t) * 35` | Smooth rainbow with non-mechanical drift |
| Idle: sine breathing baseline (~3px) | Visualizer is always alive even without TTS |
| Linear gradient on each bar (opaque → transparent) | Bars fade at tips for a soft glow look |

**Two size states:**

| Prop | Canvas | Use |
|---|---|---|
| `size="small"` (default) | 320 × 80 px | Push-to-talk mode, above input bar |
| `size="large"` | 800 × 240 px | Phase 8 live mode centrepiece |

**Active state:** `active={isTTSPlaying}` boosts canvas opacity from 0.65 → 0.92 and adds a `drop-shadow` glow filter.

---

### [src/audio/ttsPlayer.js](file:///home/amshu/src/Always-msg/src/audio/ttsPlayer.js) [MODIFY]

Added [getAnalyser()](file:///home/amshu/src/Always-msg/src/audio/ttsPlayer.js#31-35) method — returns the current `AnalyserNode` while TTS is playing, `null` otherwise. Zero overhead when idle.

---

### ChatView integration

`SpectrographMouth size="small" active={isTTSPlaying}` is rendered in a `.spectrographWrapper` div between the messages scroll area and [ChatInput](file:///home/amshu/src/Always-msg/src/components/ChatInput.jsx#5-86).

---

## Verification Results

````carousel
![Spectrograph idle breathing — rainbow bars visible above the input bar, Studio conversation open](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/spectrograph_idle_1772143122142.png)
<!-- slide -->
![Phase 7 verification recording — shows idle breathing animation changing over time](/home/amshu/.gemini/antigravity/brain/1bf54cf5-0771-4f8e-8515-ec050dbba6dc/phase7_spectrograph_1772143087271.webp)
````

| Check | Result |
|---|---|
| Build — 87 modules | ✅ 0 errors (up from 84 in Phase 6) |
| Spectrograph visible above input bar | ✅ Confirmed in screenshot |
| Rainbow colour gradient | ✅ |
| Idle breathing animation | ✅ Bars shift position between screenshots |
| Symmetrical X and Y mirroring | ✅ (code) |
| Perlin hue drift | ✅ (code — no mechanical repeat) |
| `size="large"` prop ready for Phase 8 | ✅ |
| Active glow on TTS play | ✅ (code — requires CORS fix for live E2E) |

---

## Decisions Affecting Phase 8

1. **`size="large"`** — Phase 8 passes this prop when `activeMode === 'live'` to expand the visualizer to full-width 240px height, becoming the centrepiece of the screen
2. **`active={isTTSPlaying}`** from Zustand — Phase 8 can also toggle this from its own TTS play state
3. **`ttsPlayer.getAnalyser()`** — Phase 8 can additionally wire the mic's `AnalyserNode` during VAD recording to show the user's own voice level
