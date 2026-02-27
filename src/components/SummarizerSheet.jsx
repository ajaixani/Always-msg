import { useState, useCallback } from 'react';
import { summarize } from '../llm/summarizeClient';
import { addSummary } from '../db/summariesDb';
import { updateContact } from '../db/contactsDb';
import SegmentedControl from './ui/SegmentedControl';
import Slider from './ui/Slider';
import styles from './SummarizerSheet.module.css';

const MODE_OPTIONS = [
    { value: 'polaroid', label: 'Polaroid' },
    { value: 'memory', label: 'Memory' },
];

/**
 * SummarizerSheet — bottom sheet for summarizing a conversation.
 *
 * Props:
 *   open          boolean
 *   onClose       () => void
 *   messages      Message[] — full thread messages
 *   contact       object — primary contact (for llmConfig + save-to-notes)
 *   settings      object — global settings
 *   threadId      number
 *   onContactUpdate () => void — called after save-to-notes so ContactSheet refreshes
 */
export default function SummarizerSheet({
    open, onClose, messages, contact, settings, threadId, onContactUpdate,
}) {
    const msgCount = messages.filter((m) => m.role !== 'system').length;

    const [mode, setMode] = useState('polaroid');
    const [startPct, setStartPct] = useState(0);
    const [endPct, setEndPct] = useState(100);
    const [output, setOutput] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [savedMsg, setSavedMsg] = useState('');

    // Map 0–100 percentages to actual message slice
    const contentMsgs = messages.filter((m) => m.role !== 'system');
    const startIdx = Math.round((startPct / 100) * Math.max(0, contentMsgs.length - 1));
    const endIdx = Math.round((endPct / 100) * Math.max(0, contentMsgs.length - 1));
    const slicedMsgs = contentMsgs.slice(startIdx, endIdx + 1);

    const rangeLabel = msgCount === 0
        ? 'No messages'
        : `Messages ${startIdx + 1}–${endIdx + 1} of ${msgCount}`;

    const handleSummarize = useCallback(async () => {
        if (!slicedMsgs.length) return;
        setBusy(true);
        setError('');
        setOutput('');
        setSavedMsg('');
        try {
            const text = await summarize({
                contact,
                settings,
                messages: slicedMsgs,
                promptKey: mode,
            });
            setOutput(text);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }, [contact, settings, slicedMsgs, mode]);

    const handleSaveToDb = useCallback(async () => {
        if (!output) return;
        await addSummary(threadId, mode, output, { startIdx, endIdx });
        setSavedMsg('Saved to summaries ✓');
    }, [output, threadId, mode, startIdx, endIdx]);

    const handleSaveToNotes = useCallback(async () => {
        if (!output || !contact) return;
        const existing = contact.systemInstruction?.trim() || '';
        const separator = existing ? '\n\n---\n' : '';
        const updated = existing + separator + `[${mode === 'polaroid' ? 'Polaroid' : 'Memory'}]\n${output}`;
        await updateContact(contact.id, { systemInstruction: updated });
        onContactUpdate?.();
        setSavedMsg('Saved to contact notes ✓');
    }, [output, contact, mode, onContactUpdate]);

    const handleClose = () => {
        setOutput('');
        setError('');
        setSavedMsg('');
        onClose();
    };

    if (!open) return null;

    return (
        <div className={styles.overlay} onClick={handleClose}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                <div className={styles.handle} />

                {/* Header */}
                <div className={styles.header}>
                    <h2 className={styles.title}>Summarize</h2>
                    <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">✕</button>
                </div>

                {msgCount === 0 ? (
                    <p className={styles.emptyNote}>No messages to summarize yet.</p>
                ) : (
                    <>
                        {/* Mode */}
                        <div className={styles.field}>
                            <label className={styles.label}>Mode</label>
                            <SegmentedControl
                                name="Summarizer mode"
                                options={MODE_OPTIONS}
                                value={mode}
                                onChange={setMode}
                            />
                        </div>

                        {/* Message range (start) */}
                        <div className={styles.field}>
                            <Slider
                                id="sum-range-start"
                                label="From"
                                value={startPct}
                                min={0}
                                max={Math.max(0, endPct - (100 / Math.max(msgCount, 2)))}
                                step={1}
                                onChange={setStartPct}
                                format={() => `msg ${startIdx + 1}`}
                            />
                        </div>
                        <div className={styles.field}>
                            <Slider
                                id="sum-range-end"
                                label="To"
                                value={endPct}
                                min={Math.min(100, startPct + (100 / Math.max(msgCount, 2)))}
                                max={100}
                                step={1}
                                onChange={setEndPct}
                                format={() => `msg ${endIdx + 1}`}
                            />
                        </div>
                        <p className={styles.rangeLabel}>{rangeLabel}</p>

                        {/* Summarize button */}
                        <button
                            className={styles.btnPrimary}
                            onClick={handleSummarize}
                            disabled={busy || !slicedMsgs.length}
                            id="summarize-btn"
                        >
                            {busy ? 'Summarizing…' : 'Summarize'}
                        </button>

                        {/* Error */}
                        {error && <p className={styles.error}>{error}</p>}

                        {/* Output */}
                        {output && (
                            <>
                                <div className={styles.outputCard}>
                                    <p className={styles.outputText}>{output}</p>
                                </div>

                                <div className={styles.actions}>
                                    <button className={styles.btnGhost} onClick={handleSaveToDb} id="save-to-summaries-btn">
                                        Save to Summaries
                                    </button>
                                    {contact && (
                                        <button className={styles.btnGhost} onClick={handleSaveToNotes} id="save-to-notes-btn">
                                            Save to Notes
                                        </button>
                                    )}
                                </div>
                                {savedMsg && <p className={styles.savedMsg}>{savedMsg}</p>}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
