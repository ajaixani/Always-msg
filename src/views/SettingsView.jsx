import styles from './SettingsView.module.css';

/**
 * SettingsView — Phase 1 stub.
 *
 * Full settings UI (LLM config, TTS config, VAD sensitivity) is built in Phase 2.
 */
export default function SettingsView() {
    return (
        <div className={styles.container}>
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>LLM Configuration</h2>
                <div className={styles.placeholder}>
                    <span>Coming in Phase 2</span>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>TTS Configuration</h2>
                <div className={styles.placeholder}>
                    <span>Coming in Phase 2</span>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Audio / VAD</h2>
                <div className={styles.placeholder}>
                    <span>Coming in Phase 2</span>
                </div>
            </section>
        </div>
    );
}
