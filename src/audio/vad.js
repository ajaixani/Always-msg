/**
 * vad.js — Web Audio API voice activity detection using Silero ONNX.
 *
 * Uses @ricky0123/vad-web for robust, neural-based voice activity detection.
 * Maintains an AnalyserNode to report live level for visualizers.
 *
 * Usage:
 *   const vad = await createVAD({ stream, sensitivity: 0.5,
 *                                 onSpeechStart, onSpeechEnd, onLevel });
 *   // later:
 *   vad.destroy();
 */

import { MicVAD } from "@ricky0123/vad-web";

const POLL_INTERVAL_MS = 30; // how often to compute RMS (ms) for visualizer

/**
 * Create a VAD instance attached to a live MediaStream.
 *
 * @param {object} opts
 * @param {MediaStream} opts.stream            — live mic stream
 * @param {number}      opts.sensitivity       — 0–1 from settings (currently unused for Neural VAD)
 * @param {function}    [opts.onSpeechStart]   — () => void
 * @param {function}    [opts.onSpeechEnd]     — () => void
 * @param {function}    [opts.onLevel]         — (rms: number) => void
 * @returns {Promise<{ isSpeaking: () => boolean, destroy: () => void }>}
 */
export async function createVAD({ stream, sensitivity = 0.5, onSpeechStart, onSpeechEnd, onLevel }) {
    let speaking = false;

    // Use Neural VAD via AudioWorklet
    let myvad;
    try {
        myvad = await MicVAD.new({
            stream,
            positiveSpeechThreshold: 0.5, // Sensitivity for speech detection
            minSpeechFrames: 7,           // ~200ms (prevent clicks/pops)
            redemptionFrames: 50,         // ~1500ms (thinking pauses before onSpeechEnd)
            // Explicitly load model + worklet from CDN to avoid Vite serving issues
            modelURL: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/silero_vad_legacy.onnx',
            workletURL: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/vad.worklet.bundle.min.js',
            onSpeechStart: () => {
                speaking = true;
                onSpeechStart?.();
            },
            onSpeechEnd: () => {
                speaking = false;
                onSpeechEnd?.();
            },
        });
    } catch (err) {
        console.error('[VAD] Failed to initialise neural VAD:', err);
        throw new Error(`Voice Activity Detection failed to load: ${err.message}`);
    }

    myvad.start();

    // Maintain visualizer loop using AnalyserNode
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();

    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Float32Array(analyser.fftSize);
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
                myvad.pause();
            } catch (err) { }
            try {
                source.disconnect();
                audioCtx.close();
            } catch { }
        },
    };
}
