/**
 * StaminaBar — shows the LimenLT stamina level for the active contact.
 *
 * Props:
 *   stamina       number 0–100
 *   onSleep       () => void   — called when the user taps 💤 Sleep
 *   isSleeping    boolean      — true while sleep cycle is running
 */
import styles from './StaminaBar.module.css';

export default function StaminaBar({ stamina = 100, onSleep, isSleeping = false }) {
    const pct = Math.max(0, Math.min(100, stamina));

    let colorClass = styles.green;
    if (pct <= 39) colorClass = styles.red;
    else if (pct <= 69) colorClass = styles.amber;

    return (
        <div className={styles.wrapper} title={`Stamina: ${Math.round(pct)}%`}>
            <div className={styles.track}>
                <div
                    className={`${styles.fill} ${colorClass}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <button
                className={styles.sleepBtn}
                onClick={onSleep}
                disabled={isSleeping}
                aria-label={isSleeping ? 'Dream cycle running…' : 'Trigger sleep / memory consolidation'}
                title="Sleep — consolidate memory"
            >
                {isSleeping ? '⌛' : '💤'}
            </button>
        </div>
    );
}
