import styles from './MessageBubble.module.css';

/**
 * MessageBubble — renders a single chat message as a user or assistant bubble.
 *
 * Props:
 *   role        'user' | 'assistant' | 'system'
 *   content     string — the message text (may be partial during streaming)
 *   imageRef    string | null — data URL of an attached image (Phase 9)
 *   isStreaming  boolean — shows a blinking cursor while streaming
 *   avatar      string — emoji to show next to assistant bubbles
 *   onRetry     () => void — if provided, shown as a retry button on error bubbles
 *   senderName  string — optional label shown above assistant bubble in group threads
 */
export default function MessageBubble({ role, content, imageRef, isStreaming = false, avatar = '🤖', onRetry, senderName }) {
    const isUser = role === 'user';
    const isError = !isUser && typeof content === 'string' && content.startsWith('⚠️');

    return (
        <div className={`${styles.wrapper} ${isUser ? styles.userWrapper : styles.assistantWrapper}`}>
            {!isUser && (
                <span className={styles.avatar} aria-hidden="true">
                    {avatar}
                </span>
            )}
            <div className={styles.bubbleCol}>
                {!isUser && senderName && (
                    <span className={styles.senderName}>{senderName}</span>
                )}
                <div
                    className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble} ${isError ? styles.errorBubble : ''}`}
                    role="listitem"
                    aria-label={`${isUser ? 'You' : 'Assistant'}: ${content}`}
                >
                    {imageRef && (
                        <img
                            src={imageRef}
                            alt="Attached image"
                            className={styles.attachedImage}
                            loading="lazy"
                        />
                    )}
                    <span className={styles.content}>
                        {content || (isStreaming ? '' : <em className={styles.empty}>…</em>)}
                    </span>
                    {isStreaming && <span className={styles.cursor} aria-hidden="true" />}
                </div>
                {isError && onRetry && (
                    <button className={styles.retryBtn} onClick={onRetry} id="message-retry-btn">
                        ↺ Retry
                    </button>
                )}
            </div>
        </div>
    );
}
