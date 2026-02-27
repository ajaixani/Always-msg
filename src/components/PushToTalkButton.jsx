import { useRef, useCallback, useEffect } from 'react';
import useAppStore from '../state/useAppStore';
import styles from './PushToTalkButton.module.css';

/**
 * PushToTalkButton — dual-function mic button.
 *
 * Tap  (< 300 ms)  → onTap()    — triggers ASR toggle mode (start/stop)
 * Hold (≥ 300 ms)  → onRecordStart on press, onRecordStop on release (PTT)
 *
 * Props:
 *   onTap           () => void   — called on a short tap
 *   onRecordStart   () => void   — called when hold begins
 *   onRecordStop    () => void   — called when hold ends
 *   disabled        boolean
 */
export default function PushToTalkButton({
    onTap,
    onRecordStart,
    onRecordStop,
    disabled = false,
}) {
    const isRecording = useAppStore((s) => s.isRecording);
    const micError = useAppStore((s) => s.micError);
    const vadActive = useAppStore((s) => s.vadActive);

    const pressStartRef = useRef(null);   // timestamp of pointerdown
    const holdFiredRef = useRef(false);   // did we fire hold?
    const holdTimerRef = useRef(null);    // setTimeout handle

    const HOLD_MS = 300;

    const handleDown = useCallback((e) => {
        if (disabled) return;
        e.preventDefault();
        pressStartRef.current = Date.now();
        holdFiredRef.current = false;

        // After HOLD_MS without release → start PTT hold
        holdTimerRef.current = setTimeout(() => {
            holdFiredRef.current = true;
            onRecordStart?.();
        }, HOLD_MS);
    }, [disabled, onRecordStart]);

    const handleUp = useCallback(() => {
        clearTimeout(holdTimerRef.current);
        const elapsed = Date.now() - (pressStartRef.current ?? 0);

        if (holdFiredRef.current) {
            // Was a hold — release PTT
            onRecordStop?.();
        } else if (elapsed < HOLD_MS) {
            // Was a tap — trigger ASR toggle
            onTap?.();
        }
        holdFiredRef.current = false;
        pressStartRef.current = null;
    }, [onTap, onRecordStop]);

    // Release hold if pointer leaves the window
    useEffect(() => {
        const up = () => {
            if (holdFiredRef.current) {
                clearTimeout(holdTimerRef.current);
                holdFiredRef.current = false;
                pressStartRef.current = null;
                onRecordStop?.();
            }
        };
        window.addEventListener('pointerup', up);
        return () => window.removeEventListener('pointerup', up);
    }, [onRecordStop]);

    // Clean up timer on unmount
    useEffect(() => () => clearTimeout(holdTimerRef.current), []);

    let stateClass = styles.idle;
    if (micError) stateClass = styles.error;
    else if (isRecording && vadActive) stateClass = styles.speaking;
    else if (isRecording) stateClass = styles.recording;

    return (
        <button
            className={`${styles.btn} ${stateClass} ${disabled ? styles.disabled : ''}`}
            onPointerDown={handleDown}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
            disabled={disabled}
            aria-label={
                isRecording
                    ? 'Recording — release to send (hold) or tap to stop'
                    : 'Tap to speak (toggle) or hold for push-to-talk'
            }
            aria-pressed={isRecording}
            id="push-to-talk-btn"
            style={{ touchAction: 'none' }}
            title="Tap = toggle recording  •  Hold = push-to-talk"
        >
            {/* Pulsing ring while recording */}
            {isRecording && <span className={styles.ring} aria-hidden="true" />}

            {/* Mic icon */}
            <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
        </button>
    );
}
