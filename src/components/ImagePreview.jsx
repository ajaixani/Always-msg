import styles from './ImagePreview.module.css';

/**
 * ImagePreview — shows a pending image thumbnail above the input bar.
 *
 * Props:
 *   src     string — data URL of the image to preview
 *   onClear () => void — called when the user taps ✕
 */
export default function ImagePreview({ src, onClear }) {
    if (!src) return null;
    return (
        <div className={styles.wrapper}>
            <div className={styles.card}>
                <img
                    src={src}
                    alt="Attached image preview"
                    className={styles.thumb}
                />
                <button
                    className={styles.clearBtn}
                    onClick={onClear}
                    aria-label="Remove attached image"
                    type="button"
                >
                    ✕
                </button>
            </div>
            <span className={styles.label}>Image attached</span>
        </div>
    );
}
