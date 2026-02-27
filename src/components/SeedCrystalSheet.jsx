import { useState, useCallback } from 'react';
import { summarize } from '../llm/summarizeClient';
import { createGroupThread, createSoloThread } from '../db/threadsDb';
import { addMessage } from '../db/messagesDb';
import styles from './SeedCrystalSheet.module.css';

/**
 * SeedCrystalSheet — bottom sheet for seeding a new thread from the current context.
 *
 * Props:
 *   open            boolean
 *   onClose         () => void
 *   mode            'current' | 'single'
 *   messages        Message[] — full thread messages
 *   contact         object — primary contact (for llmConfig)
 *   settings        object — global settings
 *   threadContacts  object[] — all contacts in the thread
 *   onThreadCreated (newThread) => void — called when new thread is ready
 */
export default function SeedCrystalSheet({
    open, onClose, mode = 'current', messages, contact, settings, threadContacts, onThreadCreated,
}) {
    const [selectedMsgId, setSelectedMsgId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState('pick'); // 'pick' | 'done'

    const contentMsgs = messages.filter((m) => m.role !== 'system');

    const handleClose = () => {
        setSelectedMsgId(null);
        setError('');
        setStep('pick');
        onClose();
    };

    const runSeedCrystal = useCallback(async () => {
        setBusy(true);
        setError('');
        try {
            let slicedMsgs;
            let promptKey;

            if (mode === 'current') {
                slicedMsgs = contentMsgs;
                promptKey = 'seedCrystal';
            } else {
                // Single message mode — find selected
                const picked = messages.find((m) => m.id === selectedMsgId);
                if (!picked) { setError('Please select a message.'); setBusy(false); return; }
                slicedMsgs = [picked];
                promptKey = 'seedSingle';
            }

            if (!slicedMsgs.length) { setError('No messages to process.'); setBusy(false); return; }

            // 1. Run inference to get seed crystal text
            const crystal = await summarize({
                contact,
                settings,
                messages: slicedMsgs,
                promptKey,
            });

            // 2. Create a fresh thread for each contact in the group (or solo)
            const isGroup = threadContacts.length > 1;
            let newThread;
            if (isGroup) {
                const ids = threadContacts.map((c) => c.id);
                const names = threadContacts.map((c) => c.name).join(', ');
                newThread = await createGroupThread(ids, `↩ ${names}`);
            } else {
                newThread = await createSoloThread(contact.id, `↩ ${contact?.name ?? 'New Chat'}`);
            }

            // 3. Seed the thread with the crystal as initial assistant context
            await addMessage(newThread.id, 'assistant', `🌱 ${crystal}`);

            setStep('done');
            onThreadCreated?.(newThread);
            handleClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }, [mode, contentMsgs, messages, selectedMsgId, contact, settings, threadContacts, onThreadCreated]);

    if (!open) return null;

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.handle} />

                <div className={styles.header}>
                    <h2 className={styles.title}>
                        {mode === 'current'
                            ? 'New Chat from Current'
                            : 'New Chat from Single Response'}
                    </h2>
                    <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">✕</button>
                </div>

                <p className={styles.desc}>
                    {mode === 'current'
                        ? 'The LLM will distill this entire conversation into a seed crystal (~2000 chars) and open a fresh thread seeded with it.'
                        : 'Pick a single message below. The LLM will build a brief context from it and open a fresh thread.'}
                </p>

                {/* Single-message picker */}
                {mode === 'single' && (
                    <ul className={styles.msgList} role="listbox" aria-label="Pick a message">
                        {contentMsgs.length === 0 && (
                            <li className={styles.emptyNote}>No messages in this thread yet.</li>
                        )}
                        {contentMsgs.map((m) => (
                            <li key={m.id}>
                                <button
                                    className={`${styles.msgItem} ${selectedMsgId === m.id ? styles.msgItemSelected : ''}`}
                                    onClick={() => setSelectedMsgId(m.id)}
                                    role="option"
                                    aria-selected={selectedMsgId === m.id}
                                >
                                    <span className={styles.msgRole}>{m.role === 'user' ? 'You' : contact?.name ?? 'AI'}</span>
                                    <span className={styles.msgPreview}>
                                        {m.content.slice(0, 120)}{m.content.length > 120 ? '…' : ''}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {error && <p className={styles.error}>{error}</p>}

                <button
                    className={styles.btnPrimary}
                    onClick={runSeedCrystal}
                    disabled={busy || (mode === 'single' && !selectedMsgId) || contentMsgs.length === 0}
                    id="seed-crystal-btn"
                >
                    {busy ? 'Generating…' : '✨ Generate & Open New Chat'}
                </button>
            </div>
        </div>
    );
}
