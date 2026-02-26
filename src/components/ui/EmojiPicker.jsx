import { useState } from 'react';
import styles from './EmojiPicker.module.css';

/**
 * EmojiPicker — simple inline emoji grid for avatar selection.
 * No external library required.
 *
 * Props:
 *   value:    string — currently selected emoji
 *   onChange: (emoji: string) => void
 */

// Curated set of robot/tech/creature/face emoji suitable for AI personas
const EMOJI_OPTIONS = [
    '🤖', '👾', '🦾', '🧠', '🎭', '🌀', '⚡', '🔮',
    '🌊', '🦋', '🌺', '🌙', '🪐', '✨', '💎', '🎯',
    '🦊', '🐉', '🦅', '🐬', '🌿', '🍄', '🔥', '💫',
    '👁️', '🎪', '🏔️', '🌌', '🎵', '🎨', '📡', '🛸',
    '🧬', '⚗️', '🔭', '🌐', '💡', '🧩', '🎲', '🃏',
];

export default function EmojiPicker({ value, onChange }) {
    const [open, setOpen] = useState(false);

    return (
        <div className={styles.wrapper}>
            <button
                type="button"
                className={styles.trigger}
                onClick={() => setOpen((o) => !o)}
                aria-label={`Selected avatar: ${value}. Click to change.`}
            >
                <span className={styles.currentEmoji}>{value}</span>
                <span className={styles.chevron} aria-hidden="true">
                    {open ? '▲' : '▼'}
                </span>
            </button>

            {open && (
                <div className={styles.grid} role="listbox" aria-label="Choose avatar emoji">
                    {EMOJI_OPTIONS.map((emoji) => (
                        <button
                            key={emoji}
                            type="button"
                            role="option"
                            aria-selected={emoji === value}
                            className={[styles.option, emoji === value ? styles.selected : ''].join(' ')}
                            onClick={() => { onChange(emoji); setOpen(false); }}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
