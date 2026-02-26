import styles from './Slider.module.css';

/**
 * Slider — styled range input with live value label.
 *
 * Props:
 *   label:    string
 *   value:    number
 *   min:      number
 *   max:      number
 *   step:     number
 *   onChange: (value: number) => void
 *   format:   (value: number) => string  — optional display formatter
 *   id:       string — for label association
 */
export default function Slider({ label, value, min, max, step = 0.1, onChange, format, id }) {
    const displayValue = format ? format(value) : String(value);
    // Compute fill percentage for the custom track gradient
    const pct = ((value - min) / (max - min)) * 100;

    return (
        <div className={styles.wrapper}>
            <div className={styles.labelRow}>
                <label htmlFor={id} className={styles.label}>{label}</label>
                <span className={styles.value}>{displayValue}</span>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className={styles.input}
                style={{ '--fill-pct': `${pct}%` }}
            />
        </div>
    );
}
