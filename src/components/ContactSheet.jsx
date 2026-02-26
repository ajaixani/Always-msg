import { useState, useEffect } from 'react';
import Sheet from './ui/Sheet';
import SegmentedControl from './ui/SegmentedControl';
import EmojiPicker from './ui/EmojiPicker';
import { createContact, updateContact, deleteContact } from '../db/contactsDb';
import useAppStore from '../state/useAppStore';
import styles from './ContactSheet.module.css';

/**
 * ContactSheet — create/edit a contact card in a slide-up bottom sheet.
 *
 * Props:
 *   open:       boolean
 *   onClose:    () => void
 *   contactId:  number | null  — null = create mode, number = edit mode
 */

const ENDPOINT_OPTIONS = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'letta', label: 'LETTA' },
    { value: 'local', label: 'Local' },
];

const DEFAULT_LLM_CONFIG = {
    endpointType: 'openai',
    baseUrl: '',
    model: '',
    apiKey: '',
};

const DEFAULT_FORM = {
    name: '',
    avatar: '🤖',
    systemInstruction: '',
    llmConfig: { ...DEFAULT_LLM_CONFIG },
};

export default function ContactSheet({ open, onClose, contactId }) {
    const contacts = useAppStore((s) => s.contacts);
    const upsertContact = useAppStore((s) => s.upsertContact);
    const removeContact = useAppStore((s) => s.removeContact);

    const isEdit = contactId != null;

    // ── Local form state ─────────────────────────────────────────
    const [form, setForm] = useState(DEFAULT_FORM);
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState('');

    // Hydrate form when editing an existing contact
    useEffect(() => {
        if (open && isEdit) {
            const contact = contacts.find((c) => c.id === contactId);
            if (contact) {
                setForm({
                    name: contact.name ?? '',
                    avatar: contact.avatar ?? '🤖',
                    systemInstruction: contact.systemInstruction ?? '',
                    llmConfig: { ...DEFAULT_LLM_CONFIG, ...(contact.llmConfig ?? {}) },
                });
            }
        } else if (open && !isEdit) {
            setForm(DEFAULT_FORM);
        }
        // Reset transient UI state whenever sheet opens
        setShowKey(false);
        setConfirmDelete(false);
        setError('');
    }, [open, contactId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Field helpers ─────────────────────────────────────────────
    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    const setLlmField = (key, value) =>
        setForm((f) => ({ ...f, llmConfig: { ...f.llmConfig, [key]: value } }));

    // ── Actions ───────────────────────────────────────────────────
    async function handleSave() {
        if (!form.name.trim()) { setError('Name is required.'); return; }
        setError('');
        setSaving(true);
        try {
            if (isEdit) {
                await updateContact(contactId, form);
                upsertContact({ id: contactId, ...form });
            } else {
                const newId = await createContact(form);
                upsertContact({ id: newId, ...form });
            }
            onClose();
        } catch (err) {
            setError('Failed to save. Please try again.');
            console.error(err);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!confirmDelete) { setConfirmDelete(true); return; }
        setDeleting(true);
        try {
            await deleteContact(contactId);
            removeContact(contactId);
            onClose();
        } catch (err) {
            setError('Failed to delete. Please try again.');
            console.error(err);
        } finally {
            setDeleting(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────
    return (
        <Sheet
            open={open}
            onClose={onClose}
            title={isEdit ? 'Edit Contact' : 'New Contact'}
            fullHeight
        >
            <form
                className={styles.form}
                onSubmit={(e) => { e.preventDefault(); handleSave(); }}
                noValidate
            >
                {/* ── Avatar + Name ──────────────────────────────── */}
                <div className={styles.avatarRow}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.label}>Avatar</label>
                        <EmojiPicker value={form.avatar} onChange={(e) => setField('avatar', e)} />
                    </div>
                    <div className={styles.fieldGroup} style={{ flex: 1 }}>
                        <label htmlFor="contact-name" className={styles.label}>Name</label>
                        <input
                            id="contact-name"
                            type="text"
                            className={styles.input}
                            placeholder="e.g. Riley"
                            value={form.name}
                            onChange={(e) => setField('name', e.target.value)}
                            autoComplete="off"
                            autoFocus={!isEdit}
                        />
                    </div>
                </div>

                {/* ── System Instruction ─────────────────────────── */}
                <div className={styles.fieldGroup}>
                    <label htmlFor="contact-instruction" className={styles.label}>
                        System Instruction
                    </label>
                    <textarea
                        id="contact-instruction"
                        className={styles.textarea}
                        placeholder="You are a helpful assistant…"
                        value={form.systemInstruction}
                        onChange={(e) => setField('systemInstruction', e.target.value)}
                        rows={4}
                    />
                </div>

                {/* ── LLM Config ─────────────────────────────────── */}
                <div className={styles.sectionHeader}>LLM Configuration</div>

                <div className={styles.fieldGroup}>
                    <label className={styles.label}>Endpoint Type</label>
                    <SegmentedControl
                        name="Endpoint type"
                        options={ENDPOINT_OPTIONS}
                        value={form.llmConfig.endpointType}
                        onChange={(v) => setLlmField('endpointType', v)}
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label htmlFor="contact-base-url" className={styles.label}>Base URL</label>
                    <input
                        id="contact-base-url"
                        type="url"
                        className={styles.input}
                        placeholder={
                            form.llmConfig.endpointType === 'local'
                                ? 'http://localhost:11434'
                                : 'https://api.openai.com/v1'
                        }
                        value={form.llmConfig.baseUrl}
                        onChange={(e) => setLlmField('baseUrl', e.target.value)}
                        autoComplete="off"
                        inputMode="url"
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label htmlFor="contact-model" className={styles.label}>Model</label>
                    <input
                        id="contact-model"
                        type="text"
                        className={styles.input}
                        placeholder={
                            form.llmConfig.endpointType === 'local'
                                ? 'llama3.2'
                                : 'gpt-4o'
                        }
                        value={form.llmConfig.model}
                        onChange={(e) => setLlmField('model', e.target.value)}
                        autoComplete="off"
                    />
                </div>

                {/* Don't show API key for local endpoints */}
                {form.llmConfig.endpointType !== 'local' && (
                    <div className={styles.fieldGroup}>
                        <label htmlFor="contact-api-key" className={styles.label}>API Key</label>
                        <div className={styles.passwordRow}>
                            <input
                                id="contact-api-key"
                                type={showKey ? 'text' : 'password'}
                                className={styles.input}
                                placeholder="sk-..."
                                value={form.llmConfig.apiKey}
                                onChange={(e) => setLlmField('apiKey', e.target.value)}
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                className={styles.showHideBtn}
                                onClick={() => setShowKey((s) => !s)}
                                aria-label={showKey ? 'Hide API key' : 'Show API key'}
                            >
                                {showKey ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Error ──────────────────────────────────────── */}
                {error && <p className={styles.error}>{error}</p>}

                {/* ── Actions ────────────────────────────────────── */}
                <div className={styles.actions}>
                    {isEdit && (
                        <button
                            type="button"
                            className={[styles.btn, styles.btnDanger].join(' ')}
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? 'Deleting…' : confirmDelete ? 'Tap to confirm' : 'Delete'}
                        </button>
                    )}
                    <div className={styles.actionsSpacer} />
                    <button
                        type="button"
                        className={[styles.btn, styles.btnGhost].join(' ')}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className={[styles.btn, styles.btnPrimary].join(' ')}
                        disabled={saving}
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>
        </Sheet>
    );
}
