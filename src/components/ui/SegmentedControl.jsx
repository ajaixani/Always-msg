import styles from './SegmentedControl.module.css';

/**
 * SegmentedControl — pill-style selector for a fixed set of options.
 *
 * Props:
 *   options: Array<{ value: string, label: string }>
 *   value:   string — currently selected value
 *   onChange: (value: string) => void
 *   name:    string — for aria group labeling
 */
export default function SegmentedControl({ options, value, onChange, name }) {
    return (
        <div className={styles.control} role="group" aria-label={name}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    className={[styles.segment, value === opt.value ? styles.active : ''].join(' ')}
                    onClick={() => onChange(opt.value)}
                    aria-pressed={value === opt.value}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
