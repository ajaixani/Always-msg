import styles from './ContactsView.module.css';

/**
 * ContactsView — Phase 1 stub.
 *
 * Full CRUD for contact cards is built in Phase 2.
 */
export default function ContactsView() {
    return (
        <div className={styles.container}>
            <div className={styles.empty}>
                <div className={styles.emptyIcon} aria-hidden="true">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                </div>
                <p className={styles.emptyTitle}>No contacts yet</p>
                <p className={styles.emptySubtext}>
                    Contacts will appear here. Each contact holds an AI persona with its own LLM config.
                </p>
            </div>
        </div>
    );
}
