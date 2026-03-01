import { useState, useEffect } from 'react';
import Sheet from './ui/Sheet';
import SegmentedControl from './ui/SegmentedControl';
import EmojiPicker from './ui/EmojiPicker';
import { createContact, updateContact, deleteContact } from '../db/contactsDb';
import { bootstrapLimenMigration, activateNewContact } from '../llm/limenBootstrap.js';
import { resetEngine } from '../llm/limenRegistry.js';
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

const VISION_OPTIONS = [
    { value: 'auto', label: 'Auto' },
    { value: 'on', label: 'On' },
    { value: 'off', label: 'Off' },
];

const DEFAULT_LLM_CONFIG = {
    endpointType: 'openai',
    baseUrl: '',
    model: '',
    apiKey: '',
    vision: 'auto',   // 'auto' | 'on' | 'off'
};

const DEFAULT_TTS_CONFIG = {
    voice: '',   // blank = inherit global ttsVoice
    endpoint: '',   // blank = inherit global ttsEndpoint
};

const DEFAULT_FORM = {
    name: '',
    avatar: '🤖',
    systemInstruction: '',
    llmConfig: { ...DEFAULT_LLM_CONFIG },
    ttsConfig: { ...DEFAULT_TTS_CONFIG },
    limenEnabled: true,   // on by default for new contacts
    memory: { bootsector: '', systemInstruction: '', compressionCycleCount: 0 },
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
    const [migrating, setMigrating] = useState(false);

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
                    ttsConfig: { ...DEFAULT_TTS_CONFIG, ...(contact.ttsConfig ?? {}) },
                    limenEnabled: contact.limenEnabled ?? false,  // existing contacts default off
                    memory: {
                        bootsector: contact.memory?.bootsector ?? '',
                        systemInstruction: contact.memory?.systemInstruction ?? '',
                        compressionCycleCount: contact.memory?.compressionCycleCount ?? 0,
                    },
                });
            }
        } else if (open && !isEdit) {
            setForm(DEFAULT_FORM);
        }
        // Reset transient UI state whenever sheet opens
        setShowKey(false);
        setConfirmDelete(false);
        setError('');
        setMigrating(false);
    }, [open, contactId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Field helpers ─────────────────────────────────────────────
    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
    const setLlmField = (key, value) =>
        setForm((f) => ({ ...f, llmConfig: { ...f.llmConfig, [key]: value } }));
    const setTtsField = (key, value) =>
        setForm((f) => ({ ...f, ttsConfig: { ...f.ttsConfig, [key]: value } }));
    const setMemoryField = (key, value) =>
        setForm((f) => ({ ...f, memory: { ...f.memory, [key]: value } }));

    // ── Actions ───────────────────────────────────────────────────
    async function handleSave() {
        if (!form.name.trim()) { setError('Name is required.'); return; }
        setError('');
        setSaving(true);
        try {
            // Merge bootsector from form.memory into the saved memory block
            const memoryToSave = {
                ...(form.memory ?? {}),
                bootsector: form.memory?.bootsector?.trim() || form.systemInstruction?.trim() || '',
                bootstrapped: false,  // will be set true by migration/activation
            };
            const payload = { ...form, memory: memoryToSave };

            if (isEdit) {
                const previousState = contacts.find((c) => c.id === contactId);
                const wasLimenOff = !previousState?.limenEnabled;
                await updateContact(contactId, payload);
                upsertContact({ id: contactId, ...payload });
                // If limen was just turned on for an existing contact, run Bootstrap Migration
                if (form.limenEnabled && wasLimenOff) {
                    resetEngine(contactId);
                    // Non-blocking migration — runs in background after sheet closes
                    const settings = useAppStore.getState().settings;
                    bootstrapLimenMigration({ id: contactId, ...payload }, settings).catch(
                        (e) => console.warn('[Limen] Bootstrap migration failed:', e.message),
                    );
                } else if (!form.limenEnabled) {
                    resetEngine(contactId);
                }
            } else {
                const newId = await createContact(payload);
                const newContact = { id: newId, ...payload };
                upsertContact(newContact);
                // Activate new contact (no history to migrate)
                if (form.limenEnabled) {
                    const settings = useAppStore.getState().settings;
                    activateNewContact(newContact, settings).catch(
                        (e) => console.warn('[Limen] Activation failed:', e.message),
                    );
                }
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

                {/* Vision capability override */}
                <div className={styles.fieldGroup}>
                    <label className={styles.label}>Vision
                        <span className={styles.sectionNote}> — Auto detects gpt-4*, claude-3*, *vision*</span>
                    </label>
                    <SegmentedControl
                        name="Vision capability"
                        options={VISION_OPTIONS}
                        value={form.llmConfig.vision ?? 'auto'}
                        onChange={(v) => setLlmField('vision', v)}
                    />
                </div>

                {/* Don’t show API key for local endpoints */}
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

                {/* ── TTS Override ────────────────────────────────── */}
                <div className={styles.sectionHeader}>TTS Override
                    <span className={styles.sectionNote}> — leave blank to use global defaults</span>
                </div>

                <div className={styles.fieldGroup}>
                    <label htmlFor="contact-tts-voice" className={styles.label}>Voice</label>
                    <input
                        id="contact-tts-voice"
                        type="text"
                        className={styles.input}
                        placeholder="af_heart (global default)"
                        value={form.ttsConfig.voice}
                        onChange={(e) => setTtsField('voice', e.target.value)}
                        autoComplete="off"
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label htmlFor="contact-tts-endpoint" className={styles.label}>TTS Endpoint URL</label>
                    <input
                        id="contact-tts-endpoint"
                        type="url"
                        className={styles.input}
                        placeholder="http://localhost:8880 (global default)"
                        value={form.ttsConfig.endpoint}
                        onChange={(e) => setTtsField('endpoint', e.target.value)}
                        autoComplete="off"
                        inputMode="url"
                    />
                </div>

                {/* ── LimenLT Memory ──────────────────────────────── */}
                <div className={styles.sectionHeader}>Memory (LimenLT)
                    <span className={styles.sectionNote}> — cognitive context engine</span>
                </div>

                <div className={styles.fieldGroup}>
                    <label className={styles.label}>
                        <input
                            id="contact-limen-enabled"
                            type="checkbox"
                            checked={!!form.limenEnabled}
                            onChange={(e) => setField('limenEnabled', e.target.checked)}
                            style={{ marginRight: 8 }}
                        />
                        Enable LimenLT Memory Engine
                    </label>
                    {isEdit && !contacts.find((c) => c.id === contactId)?.limenEnabled && form.limenEnabled && (
                        <p className={styles.sectionNote} style={{ marginTop: 4 }}>
                            💡 A Bootstrap Migration will run when you save — the contact&apos;s history will be digested into the memory system.
                        </p>
                    )}
                </div>

                {form.limenEnabled && (
                    <div className={styles.fieldGroup}>
                        <label htmlFor="contact-bootsector" className={styles.label}>
                            Bootsector
                            <span className={styles.sectionNote}> — immutable identity seed (Tamarian-style)</span>
                        </label>
                        <textarea
                            id="contact-bootsector"
                            className={styles.textarea}
                            placeholder={'e.g. "The Mechanic, under a single lamp. Speaks in short, blunt sentences. Never breaks character."'}
                            value={form.memory?.bootsector ?? ''}
                            onChange={(e) => setMemoryField('bootsector', e.target.value)}
                            rows={3}
                        />
                        {isEdit && (
                            <p className={styles.sectionNote} style={{ marginTop: 4 }}>
                                Compression cycles: {form.memory?.compressionCycleCount ?? 0}
                            </p>
                        )}
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
