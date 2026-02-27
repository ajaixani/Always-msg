/**
 * micCapture.js — getUserMedia + MediaRecorder wrapper.
 *
 * Usage:
 *   // Own the stream (chat tap / PTT):
 *   const recorder = await startRecording();
 *
 *   // Borrow an existing stream (live mode — caller owns lifecycle):
 *   const recorder = await startRecording({ stream: existingStream });
 *
 *   const blob = await recorder.stop();   // webm/opus or ogg/opus
 *
 * Throws MicPermissionError if the user denies microphone access.
 */

export class MicPermissionError extends Error {
    constructor() {
        super('Microphone permission denied. Please allow microphone access in your browser settings.');
        this.name = 'MicPermissionError';
    }
}

/**
 * Start capturing audio from the microphone.
 *
 * @param {object}      [opts]
 * @param {MediaStream} [opts.stream]  — pass an already-open stream to borrow it.
 *                                       When provided, getUserMedia is skipped and
 *                                       stop() will NOT stop the tracks (caller owns them).
 * @returns {Promise<{ stop: () => Promise<Blob>, stream: MediaStream }>}
 */
export async function startRecording({ stream: existingStream } = {}) {
    let stream;
    let ownStream;

    if (existingStream) {
        stream = existingStream;
        ownStream = false;
    } else {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            ownStream = true;
        } catch (err) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                throw new MicPermissionError();
            }
            throw new Error(`Microphone error: ${err.message}`);
        }
    }

    // Pick the best supported MIME type
    const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
    ].find((type) => MediaRecorder.isTypeSupported(type)) || '';

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    const chunks = [];

    recorder.addEventListener('dataavailable', (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
    });

    recorder.start(100); // collect chunks every 100 ms for low-latency streaming

    return {
        stream,
        stop: () =>
            new Promise((resolve) => {
                recorder.addEventListener('stop', () => {
                    // Only stop tracks when we opened the stream ourselves
                    if (ownStream) {
                        stream.getTracks().forEach((t) => t.stop());
                    }
                    resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }));
                });
                recorder.stop();
            }),
    };
}
