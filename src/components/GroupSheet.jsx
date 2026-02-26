import { useState, useMemo } from 'react';
import Sheet from './ui/Sheet';
import styles from './GroupSheet.module.css';

/**
 * GroupSheet — modal for creating a new solo or group thread.
 *
 * Props:
 *   contacts    Contact[]   — all available contacts
 *   open        boolean
 *   onClose     () => void
 *   onCreateSolo  (contactId: number) => void
 *   onCreateGroup (contactIds: number[], title: string) => void
 */
export default function GroupSheet({ contacts, open, onClose, onCreateSolo, onCreateGroup }) {
    const [mode, setMode] = useState('solo');   // 'solo' | 'group'
    const [selected, setSelected] = useState([]);
    const [title, setTitle] = useState('');

    function reset() {
        setMode('solo');
        setSelected([]);
        setTitle('');
    }

    function handleClose() {
        reset();
        onClose();
    }

    function toggleContact(id) {
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    }

    function handleCreate() {
        if (mode === 'solo') {
            if (selected.length !== 1) return;
            onCreateSolo(selected[0]);
        } else {
            if (selected.length < 2) return;
            const autoTitle = title.trim() ||
                selected
                    .map((id) => contacts.find((c) => c.id === id)?.name ?? '')
                    .join(', ');
            onCreateGroup(selected, autoTitle);
        }
        handleClose();
    }

    const canCreate = mode === 'solo'
        ? selected.length === 1
        : selected.length >= 2;

    return (
        <Sheet open={open} onClose={handleClose} title="New Chat">
            {/* Mode toggle */}
            <div className={styles.modeRow}>
                <button
                    className={`${styles.modeBtn} ${mode === 'solo' ? styles.modeBtnActive : ''}`}
                    onClick={() => { setMode('solo'); setSelected([]); }}
                    id="new-chat-solo-btn"
                >
                    Solo
                </button>
                <button
                    className={`${styles.modeBtn} ${mode === 'group' ? styles.modeBtnActive : ''}`}
                    onClick={() => { setMode('group'); setSelected([]); }}
                    id="new-chat-group-btn"
                >
                    Group
                </button>
            </div>

            {mode === 'group' && (
                <div className={styles.titleRow}>
                    <input
                        className={styles.titleInput}
                        type="text"
                        placeholder="Thread title (optional)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        id="group-title-input"
                    />
                </div>
            )}

            <p className={styles.hint}>
                {mode === 'solo'
                    ? 'Select a contact to start chatting.'
                    : 'Select 2 or more contacts for a group thread.'}
            </p>

            <ul className={styles.contactList} role="list">
                {contacts.length === 0 && (
                    <li className={styles.noContacts}>No contacts yet — add one first.</li>
                )}
                {contacts.map((c) => {
                    const isSelected = selected.includes(c.id);
                    const isSoloDisabled = mode === 'solo' && selected.length === 1 && !isSelected;
                    return (
                        <li key={c.id}>
                            <button
                                className={`${styles.contactRow} ${isSelected ? styles.contactRowSelected : ''} ${isSoloDisabled ? styles.contactRowDisabled : ''}`}
                                onClick={() => {
                                    if (mode === 'solo') {
                                        setSelected([c.id]);
                                    } else {
                                        toggleContact(c.id);
                                    }
                                }}
                                id={`group-contact-${c.id}`}
                                aria-pressed={isSelected}
                            >
                                <span className={styles.avatar}>{c.avatar || '🤖'}</span>
                                <div className={styles.meta}>
                                    <span className={styles.name}>{c.name}</span>
                                    <span className={styles.endpoint}>{c.llmConfig?.endpointType ?? 'local'}</span>
                                </div>
                                <span className={styles.check} aria-hidden="true">
                                    {isSelected ? '✓' : ''}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>

            <button
                className={styles.createBtn}
                disabled={!canCreate}
                onClick={handleCreate}
                id="group-create-btn"
            >
                {mode === 'solo' ? 'Start Chat' : `Create Group (${selected.length})`}
            </button>
        </Sheet>
    );
}
