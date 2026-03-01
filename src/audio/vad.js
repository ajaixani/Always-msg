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

const MicVAD = window.vad?.MicVAD;

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

    // 1. Dynamically load ONNX Runtime Web as an ESM module directly from the public folder.
    // We inject this as a string so Vite's AST analyzer doesn't see the import and 
    // throw a "Cannot import non-asset from /public" error.
    if (!window.ort) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.type = 'module';
            script.textContent = `
                import * as ortObj from '/ort.mjs';
                window.ort = ortObj;
                window.dispatchEvent(new Event('ort-loaded'));
            `;
            script.onerror = () => reject(new Error("Failed to load ONNX Runtime Web"));
            window.addEventListener('ort-loaded', resolve, { once: true });
            document.head.appendChild(script);
        });
    }

    // 2. Inject vad-web's UMD bundle script into the DOM and wait for it to load.
    // This strictly bypasses Vite's CJS dependencies solver while maintaining 
    // the correct load order (after window.ort is set).
    if (!window.vad) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/vad-web.bundle.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error("Failed to load VAD bundle"));
            document.head.appendChild(script);
        });
    }

    const MicVAD = window.vad?.MicVAD;
    if (!MicVAD) {
        throw new Error("MicVAD failed to initialize from the local bundle.");
    }

    // Wait until global ONNX environment is ready and configure it.
    window.ort.env.wasm.wasmPaths = "/";

    // Use Neural VAD via AudioWorklet
    let myvad;
    try {
        myvad = await MicVAD.new({
            stream,
            positiveSpeechThreshold: 0.5, // Sensitivity for speech detection
            minSpeechFrames: 7,           // ~200ms (prevent clicks/pops)
            redemptionFrames: 50,         // ~1500ms (thinking pauses before onSpeechEnd)
            // Load from local public/ directory instead of CDN to avoid network blocks 
            // and Vite serving issues.
            baseAssetPath: '/',
            workletURL: '/vad.worklet.bundle.min.js',
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
