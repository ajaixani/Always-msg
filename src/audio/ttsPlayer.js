/**
 * ttsPlayer.js — singleton streaming audio player.
 *
 * Plays MP3 audio chunks as they arrive from the TTS endpoint.
 * Supports MediaSource streaming (Chrome/Edge) with a full-blob fallback
 * for browsers that don't support MP3 in MediaSource (Firefox, Safari).
 *
 * Usage:
 *   ttsPlayer.play(readableStream, { onPlay, onStop, onLevel })
 *   ttsPlayer.stop()
 */

const MEDIA_SOURCE_SUPPORTED =
    typeof MediaSource !== 'undefined' &&
    MediaSource.isTypeSupported('audio/mpeg');

class TTSPlayer {
    constructor() {
        this._audio = null;
        this._mediaSource = null;
        this._sourceBuffer = null;
        this._abortCtrl = null;
        this._queue = [];          // pending Uint8Array chunks waiting for sourceBuffer
        this._flushing = false;
        this._onStop = null;
        this._audioCtx = null;
        this._analyser = null;
        this._levelRafId = null;
    }

    /** Return the current AnalyserNode, or null if nothing is playing. */
    getAnalyser() {
        return this._analyser ?? null;
    }

    /** Stop any current playback, abort any in-flight fetch. */
    stop() {
        this._abortCtrl?.abort();
        this._abortCtrl = null;

        if (this._audio) {
            this._audio.pause();
            try { URL.revokeObjectURL(this._audio.src); } catch { }
            this._audio.src = '';
            this._audio.onended = null;
            this._audio = null;
        }

        if (this._levelRafId) {
            cancelAnimationFrame(this._levelRafId);
            this._levelRafId = null;
        }

        try { this._audioCtx?.close(); } catch { }
        this._audioCtx = null;
        this._analyser = null;
        this._mediaSource = null;
        this._sourceBuffer = null;
        this._queue = [];
        this._flushing = false;

        this._onStop?.();
        this._onStop = null;
    }

    /**
     * Start playing from a ReadableStream of Uint8Array chunks.
     *
     * @param {ReadableStream} stream
     * @param {object} opts
     * @param {() => void}         [opts.onPlay]    — fires when audio starts
     * @param {() => void}         [opts.onStop]    — fires when done or stopped
     * @param {(rms: number)=>void} [opts.onLevel]  — fires each animation frame
     */
    async play(stream, { onPlay, onStop, onLevel } = {}) {
        // Stop anything currently playing
        this.stop();

        this._onStop = onStop ?? null;
        this._abortCtrl = new AbortController();

        if (MEDIA_SOURCE_SUPPORTED) {
            await this._playStreaming(stream, { onPlay, onLevel });
        } else {
            await this._playBlob(stream, { onPlay, onLevel });
        }
    }

    // ── MediaSource streaming path ───────────────────────────────────

    async _playStreaming(stream, { onPlay, onLevel }) {
        const ms = new MediaSource();
        this._mediaSource = ms;

        const audio = new Audio();
        this._audio = audio;
        audio.src = URL.createObjectURL(ms);
        audio.preload = 'none';

        audio.onended = () => this.stop();

        ms.addEventListener('sourceopen', async () => {
            let sb;
            try {
                sb = ms.addSourceBuffer('audio/mpeg');
            } catch {
                // Fallback if MP3 fails despite isTypeSupported check
                this.stop();
                return;
            }
            this._sourceBuffer = sb;

            sb.addEventListener('updateend', () => this._flushQueue());

            // Attach analyser for level metering
            this._attachAnalyser(audio, onLevel);

            // Consume the stream
            const reader = stream.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (this._abortCtrl?.signal.aborted) break;
                    this._queue.push(value);
                    this._flushQueue();
                }
            } catch {
                // aborted or network error — just stop
            } finally {
                reader.releaseLock();
                // Signal end of stream after all data is buffered
                const waitEnd = setInterval(() => {
                    if (this._sourceBuffer && !this._sourceBuffer.updating && this._queue.length === 0) {
                        clearInterval(waitEnd);
                        try { ms.endOfStream(); } catch { }
                    }
                }, 50);
            }

            // Start playback
            try {
                await audio.play();
                onPlay?.();
            } catch { /* autoplay blocked or stopped */ }
        });
    }

    _flushQueue() {
        if (!this._sourceBuffer || this._sourceBuffer.updating || this._queue.length === 0) return;
        const chunk = this._queue.shift();
        try {
            this._sourceBuffer.appendBuffer(chunk);
        } catch {
            this._queue.unshift(chunk); // put back, retry on next updateend
        }
    }

    // ── Blob fallback path ───────────────────────────────────────────

    async _playBlob(stream, { onPlay, onLevel }) {
        const reader = stream.getReader();
        const chunks = [];
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (this._abortCtrl?.signal.aborted) return;
                chunks.push(value);
            }
        } catch { return; }

        const blob = new Blob(chunks, { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);

        const audio = new Audio(url);
        this._audio = audio;
        audio.onended = () => this.stop();

        this._attachAnalyser(audio, onLevel);

        try {
            await audio.play();
            onPlay?.();
        } catch { /* blocked */ }
    }

    // ── Level metering ───────────────────────────────────────────────

    _attachAnalyser(audioEl, onLevel) {
        if (!onLevel) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            this._audioCtx = ctx;
            const source = ctx.createMediaElementSource(audioEl);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyser.connect(ctx.destination);
            this._analyser = analyser;

            const data = new Float32Array(analyser.fftSize);
            const tick = () => {
                if (!this._analyser) return;
                analyser.getFloatTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
                onLevel(Math.sqrt(sum / data.length));
                this._levelRafId = requestAnimationFrame(tick);
            };
            this._levelRafId = requestAnimationFrame(tick);
        } catch { /* no level metering */ }
    }
}

// Singleton
export const ttsPlayer = new TTSPlayer();
