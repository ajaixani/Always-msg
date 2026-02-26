import styles from './ChatView.module.css';

/**
 * ChatView — Phase 1 stub.
 *
 * This view will be fully built in Phase 4 (push-to-activate text chat)
 * and Phase 8 (live mode layout). For now it renders a placeholder UI
 * that demonstrates the layout skeleton within the app shell.
 */
export default function ChatView() {
    return (
        <div className={styles.container}>
            <div className={styles.empty}>
                <div className={styles.emptyIcon} aria-hidden="true">
                    {/* Speech bubble icon */}
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                </div>
                <p className={styles.emptyTitle}>No conversations yet</p>
                <p className={styles.emptySubtext}>
                    Add a contact to start chatting with an AI persona.
                </p>
            </div>
        </div>
    );
}
