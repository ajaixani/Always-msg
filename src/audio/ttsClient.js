/**
 * ttsClient.js — TTS router for Kokoro / Vibe Voice (OpenAI-compatible).
 *
 * Usage:
 *   const handle = await speak(text, settings, { onPlay, onStop, onLevel });
 *   handle.stop();   // interrupt immediately
 */

import { ttsPlayer } from './ttsPlayer.js';

export class TTSError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TTSError';
    }
}

/**
 * Synthesise `text` and start streaming playback via ttsPlayer.
 *
 * @param {string} text           — text to synthesise
 * @param {object} settings       — Zustand settings map
 * @param {object} [callbacks]
 * @param {() => void}            [callbacks.onPlay]
 * @param {() => void}            [callbacks.onStop]
 * @param {(rms: number) => void} [callbacks.onLevel]
 * @returns {Promise<{ stop: () => void }>}
 */
export async function speak(text, settings, { onPlay, onStop, onLevel } = {}) {
    const endpoint = settings?.ttsEndpoint?.trim();
    if (!endpoint) {
        throw new TTSError('No TTS endpoint configured. Set one in Settings → TTS Configuration.');
    }

    // Normalise: strip trailing /v1 or /v1/ then add the full path
    const base = endpoint.replace(/\/v1\/?$/, '').replace(/\/$/, '');
    const url = `${base}/v1/audio/speech`;

    const body = {
        model: settings?.ttsModel || 'kokoro',
        input: text,
        voice: settings?.ttsVoice || 'af_heart',
        speed: Number(settings?.ttsSpeed ?? 1.0),
        response_format: 'mp3',
        stream: true,
    };

    const abortCtrl = new AbortController();

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: abortCtrl.signal,
        });
    } catch (err) {
        if (err.name === 'AbortError') return { stop: () => { } };
        throw new TTSError(`TTS endpoint unreachable: ${err.message}`);
    }

    if (!response.ok) {
        let detail = response.statusText;
        try { detail = (await response.json())?.detail || detail; } catch { }
        throw new TTSError(`TTS error ${response.status}: ${detail}`);
    }

    // response.body is a ReadableStream of Uint8Array chunks (MP3 data)
    const stream = response.body;

    // Hand stream to player; play() is async (starts piping immediately)
    ttsPlayer.play(stream, {
        onPlay,
        onStop: () => {
            onStop?.();
        },
        onLevel,
    });

    return {
        stop: () => {
            abortCtrl.abort();
            ttsPlayer.stop();
        },
    };
}
