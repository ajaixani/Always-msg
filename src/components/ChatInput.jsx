import { useState, useRef, useCallback } from 'react';
import styles from './ChatInput.module.css';

/**
 * ChatInput — growing textarea + send button for the chat pane.
 *
 * Props:
 *   onSend      (text: string) => void
 *   disabled    boolean — true while streaming
 *   placeholder string
 */
export default function ChatInput({ onSend, disabled = false, placeholder = 'Message…' }) {
    const [text, setText] = useState('');
    const textareaRef = useRef(null);

    const submit = useCallback(() => {
        const trimmed = text.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setText('');
        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [text, disabled, onSend]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    };

    const handleInput = (e) => {
        setText(e.target.value);
        // Auto-grow up to ~5 rows
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    };

    return (
        <div className={styles.bar}>
            <textarea
                ref={textareaRef}
                className={styles.textarea}
                value={text}
                rows={1}
                placeholder={disabled ? 'Thinking…' : placeholder}
                disabled={disabled}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                aria-label="Message input"
                id="chat-input-textarea"
            />
            <button
                className={styles.sendBtn}
                onClick={submit}
                disabled={disabled || !text.trim()}
                aria-label="Send message"
                id="chat-send-button"
            >
                {disabled ? (
                    // Spinner icon
                    <svg className={styles.spinner} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                ) : (
                    // Arrow-up icon
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="12 19 12 5" />
                        <polyline points="5 12 12 5 19 12" />
                    </svg>
                )}
            </button>
        </div>
    );
}
