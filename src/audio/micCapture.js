/**
 * micCapture.js — getUserMedia + MediaRecorder wrapper.
 *
 * Usage:
 *   const recorder = await startRecording();
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
 * @returns {Promise<{ stop: () => Promise<Blob>, stream: MediaStream }>}
 */
export async function startRecording() {
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            throw new MicPermissionError();
        }
        throw new Error(`Microphone error: ${err.message}`);
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
                    // Stop all mic tracks to release the browser indicator
                    stream.getTracks().forEach((t) => t.stop());
                    resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }));
                });
                recorder.stop();
            }),
    };
}
