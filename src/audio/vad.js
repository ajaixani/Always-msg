/**
 * vad.js — Web Audio API voice activity detection.
 *
 * Uses an AnalyserNode to measure RMS amplitude on an animation-frame loop.
 * Fires callbacks when speech starts / ends, and reports live level for visualizers.
 *
 * Usage:
 *   const vad = createVAD({ stream, sensitivity: 0.5,
 *                           onSpeechStart, onSpeechEnd, onLevel });
 *   // later:
 *   vad.destroy();
 */

const POLL_INTERVAL_MS = 30;    // how often to compute RMS (ms)
const SILENCE_FRAMES_UNTIL_END = 50; // ~1500 ms of silence before onSpeechEnd fires

/**
 * Map a sensitivity value (0–1) to an RMS threshold.
 * sensitivity=0   → threshold 0.20 (only loud sounds trigger)
 * sensitivity=0.5 → threshold 0.08
 * sensitivity=1   → threshold 0.02 (whispers trigger)
 */
function sensitivityToThreshold(s) {
    return 0.20 - s * 0.18;
}

/**
 * Create a VAD instance attached to a live MediaStream.
 *
 * @param {object} opts
 * @param {MediaStream} opts.stream            — live mic stream
 * @param {number}      opts.sensitivity       — 0–1 from settings
 * @param {function}    [opts.onSpeechStart]   — () => void
 * @param {function}    [opts.onSpeechEnd]     — () => void
 * @param {function}    [opts.onLevel]         — (rms: number) => void
 * @returns {{ isSpeaking: () => boolean, destroy: () => void }}
 */
export function createVAD({ stream, sensitivity = 0.5, onSpeechStart, onSpeechEnd, onLevel }) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();

    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Float32Array(analyser.fftSize);
    const threshold = sensitivityToThreshold(sensitivity);

    let speaking = false;
    let silenceFrames = 0;
    let rafId = null;
    let destroyed = false;

    function computeRMS() {
        analyser.getFloatTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        return Math.sqrt(sum / dataArray.length);
    }

    function tick() {
        if (destroyed) return;

        const rms = computeRMS();
        onLevel?.(rms);

        if (rms > threshold) {
            silenceFrames = 0;
            if (!speaking) {
                speaking = true;
                onSpeechStart?.();
            }
        } else if (speaking) {
            silenceFrames++;
            if (silenceFrames >= SILENCE_FRAMES_UNTIL_END) {
                speaking = false;
                silenceFrames = 0;
                onSpeechEnd?.();
            }
        }

        // Use setTimeout instead of rAF to work even in background tabs
        rafId = setTimeout(tick, POLL_INTERVAL_MS);
    }

    tick();

    return {
        isSpeaking: () => speaking,
        destroy: () => {
            destroyed = true;
            clearTimeout(rafId);
            try {
                source.disconnect();
                audioCtx.close();
            } catch {
                // ignore if already closed
            }
        },
    };
}
