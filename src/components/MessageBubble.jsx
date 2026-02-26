import styles from './MessageBubble.module.css';

/**
 * MessageBubble — renders a single chat message as a user or assistant bubble.
 *
 * Props:
 *   role        'user' | 'assistant' | 'system'
 *   content     string — the message text (may be partial during streaming)
 *   isStreaming  boolean — shows a blinking cursor while streaming
 *   avatar      string — emoji to show next to assistant bubbles
 */
export default function MessageBubble({ role, content, isStreaming = false, avatar = '🤖' }) {
    const isUser = role === 'user';

    return (
        <div className={`${styles.wrapper} ${isUser ? styles.userWrapper : styles.assistantWrapper}`}>
            {!isUser && (
                <span className={styles.avatar} aria-hidden="true">
                    {avatar}
                </span>
            )}
            <div
                className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}
                role="listitem"
                aria-label={`${isUser ? 'You' : 'Assistant'}: ${content}`}
            >
                <span className={styles.content}>
                    {content || (isStreaming ? '' : <em className={styles.empty}>…</em>)}
                </span>
                {isStreaming && <span className={styles.cursor} aria-hidden="true" />}
            </div>
        </div>
    );
}
