/**
 * asrClient.js — ASR router.
 *
 * Strategy:
 *   1. If `settings.asrEndpoint` is set → POST blob to Whisper-compatible endpoint
 *   2. Else if Web Speech API is available → use SpeechRecognition during recording
 *   3. Otherwise → throw with a clear message
 *
 * Usage (Whisper/endpoint path):
 *   const text = await transcribeBlob(blob, settings);
 *
 * Usage (Web Speech API path — integrated into PushToTalkButton):
 *   const { start, stop } = createSpeechSession({ onResult, onError });
 */

// ── Web Speech API path ──────────────────────────────────────────────────────

const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

/**
 * Returns true if the browser supports Web Speech API.
 */
export function isSpeechAPIAvailable() {
    return !!SpeechRecognition;
}

/**
 * Create a Web Speech recognition session.
 * Starts listening immediately; call stop() to end and receive the result.
 *
 * @param {object} opts
 * @param {function} opts.onResult  — (transcript: string) => void
 * @param {function} opts.onError   — (error: Error) => void
 * @returns {{ stop: () => void }}
 */
export function createSpeechSession({ onResult, onError }) {
    if (!SpeechRecognition) {
        onError(new Error('Web Speech API not supported in this browser. Set an ASR endpoint in Settings.'));
        return { stop: () => { } };
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || 'en-US';
    recognition.maxAlternatives = 1;

    let finalTranscript = '';
    let stopped = false;

    recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
    };

    recognition.onerror = (event) => {
        if (stopped) return; // ignore errors after manual stop
        const msg = event.error === 'no-speech'
            ? 'No speech detected.'
            : `ASR error: ${event.error}`;
        onError(new Error(msg));
    };

    recognition.onend = () => {
        if (finalTranscript.trim()) {
            onResult(finalTranscript.trim());
        } else if (!stopped) {
            // No speech captured — fire onResult with empty string so caller can decide
            onResult('');
        }
    };

    recognition.start();

    return {
        stop: () => {
            stopped = true;
            try { recognition.stop(); } catch { /* already stopped */ }
        },
    };
}

// ── Local Whisper endpoint path ──────────────────────────────────────────────

/**
 * Transcribe an audio Blob via an OpenAI-compatible Whisper endpoint.
 *
 * @param {Blob}   blob     — recorded audio
 * @param {object} settings — from Zustand store; uses `asrEndpoint`, `asrModel`
 * @returns {Promise<string>}
 */
export async function transcribeBlob(blob, settings) {
    const endpoint = settings?.asrEndpoint?.trim();
    if (!endpoint) {
        throw new Error('No ASR endpoint configured. Set one in Settings → Audio.');
    }

    const url = `${endpoint.replace(/\/$/, '')}/v1/audio/transcriptions`;

    const form = new FormData();
    form.append('file', blob, `recording.${blob.type.includes('ogg') ? 'ogg' : 'webm'}`);
    form.append('model', settings?.asrModel || 'whisper-1');

    const headers = {};
    if (settings?.asrApiKey?.trim()) {
        headers['Authorization'] = `Bearer ${settings.asrApiKey.trim()}`;
    }

    let response;
    try {
        response = await fetch(url, { method: 'POST', headers, body: form });
    } catch (err) {
        throw new Error(`ASR endpoint unreachable: ${err.message}`);
    }

    if (!response.ok) {
        let detail = response.statusText;
        try { detail = (await response.json()).error?.message || detail; } catch { }
        throw new Error(`ASR error ${response.status}: ${detail}`);
    }

    const data = await response.json();
    return (data.text || '').trim();
}

// ── Unified entry point ──────────────────────────────────────────────────────

/**
 * Choose the right ASR strategy and transcribe.
 * Used for the Whisper-endpoint path (blob available post-recording).
 *
 * For Web Speech API, use createSpeechSession() during recording instead.
 *
 * @param {Blob}   blob
 * @param {object} settings
 * @returns {Promise<string>}
 */
export async function transcribe(blob, settings) {
    const endpoint = settings?.asrEndpoint?.trim();

    if (endpoint) {
        return transcribeBlob(blob, settings);
    }

    // Web Speech API was already used during recording via createSpeechSession;
    // if we somehow reach here with no endpoint, throw a clear error.
    throw new Error(
        'No ASR endpoint set and Web Speech API transcript is not available for post-processing. ' +
        'Use createSpeechSession() during recording or set an ASR endpoint in Settings.',
    );
}
