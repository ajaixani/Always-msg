import { useRef, useCallback, useEffect } from 'react';
import useAppStore from '../state/useAppStore';
import styles from './PushToTalkButton.module.css';

/**
 * PushToTalkButton — hold-to-record mic button.
 *
 * Props:
 *   onRecordStart  () => void   — called on pointerdown
 *   onRecordStop   () => void   — called on pointerup / pointerleave / pointercancel
 *   disabled       boolean
 */
export default function PushToTalkButton({ onRecordStart, onRecordStop, disabled = false }) {
    const isRecording = useAppStore((s) => s.isRecording);
    const micError = useAppStore((s) => s.micError);
    const vadActive = useAppStore((s) => s.vadActive);

    const holding = useRef(false);

    const handleDown = useCallback((e) => {
        if (disabled) return;
        e.preventDefault();       // prevent text-selection on long-press
        holding.current = true;
        onRecordStart?.();
    }, [disabled, onRecordStart]);

    const handleUp = useCallback(() => {
        if (!holding.current) return;
        holding.current = false;
        onRecordStop?.();
    }, [onRecordStop]);

    // Also release if pointer leaves the button while held
    useEffect(() => {
        const up = () => { if (holding.current) { holding.current = false; onRecordStop?.(); } };
        window.addEventListener('pointerup', up);
        return () => window.removeEventListener('pointerup', up);
    }, [onRecordStop]);

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
            aria-label={isRecording ? 'Recording… release to send' : 'Hold to speak'}
            aria-pressed={isRecording}
            id="push-to-talk-btn"
            // Prevent mobile scroll while holding
            style={{ touchAction: 'none' }}
        >
            {/* Pulsing ring (only shown while recording) */}
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
