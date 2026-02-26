import { useEffect, useRef } from 'react';
import styles from './Sheet.module.css';

/**
 * Sheet — reusable slide-up bottom sheet modal.
 *
 * Props:
 *   open:        boolean
 *   onClose:     () => void — called when backdrop clicked or escape pressed
 *   title:       string — displayed in drag-handle area
 *   children:    React nodes
 *   fullHeight:  boolean — if true, sheet takes ~95dvh (edit forms)
 */
export default function Sheet({ open, onClose, title, children, fullHeight = false }) {
    const sheetRef = useRef(null);

    // Close on Escape key
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    // Prevent body scroll when sheet is open
    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    if (!open) return null;

    return (
        <div className={styles.overlay} onPointerDown={onClose} aria-modal="true" role="dialog">
            <div
                ref={sheetRef}
                className={[styles.sheet, fullHeight ? styles.fullHeight : ''].join(' ')}
                onPointerDown={(e) => e.stopPropagation()} // prevent overlay close when clicking inside
            >
                {/* Drag handle */}
                <div className={styles.handle} aria-hidden="true">
                    <div className={styles.handleBar} />
                </div>

                {/* Header */}
                {title && (
                    <div className={styles.header}>
                        <h2 className={styles.title}>{title}</h2>
                    </div>
                )}

                {/* Content */}
                <div className={styles.content}>
                    {children}
                </div>
            </div>
        </div>
    );
}
