import { useEffect, useState, useCallback } from 'react';
import useAppStore from '../state/useAppStore';
import SegmentedControl from '../components/ui/SegmentedControl';
import Slider from '../components/ui/Slider';
import { saveSetting, saveSettingNow } from '../db/settingsDb';
import styles from './SettingsView.module.css';

/**
 * SettingsView — Phase 2.
 * Full settings panel: global LLM defaults, TTS config, VAD audio config.
 * All changes persist immediately to IndexedDB via settingsDb helpers.
 */

const ENDPOINT_OPTIONS = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'letta', label: 'LETTA' },
    { value: 'local', label: 'Local' },
];

const TTS_OPTIONS = [
    { value: 'kokoro', label: 'Kokoro' },
    { value: 'vibe-voice', label: 'Vibe Voice' },
];

export default function SettingsView() {
    const settings = useAppStore((s) => s.settings);
    const setSetting = useAppStore((s) => s.setSetting);

    /** Update both Zustand (instant UI) and IndexedDB (debounced) */
    function update(key, value) {
        setSetting(key, value);
        saveSetting(key, value);
    }

    /** Immediate write — used on input blur */
    function updateNow(key, value) {
        setSetting(key, value);
        saveSettingNow(key, value);
    }

    // Derived values with defaults so controls never start undefined
    const endpointType = settings.endpointType ?? 'openai';
    const baseUrl = settings.baseUrl ?? '';
    const model = settings.model ?? '';
    const ttsProvider = settings.ttsProvider ?? 'kokoro';
    const ttsEndpoint = settings.ttsEndpoint ?? '';
    const ttsSpeed = Number(settings.ttsSpeed ?? 1.0);
    const vadSensitivity = Number(settings.vadSensitivity ?? 0.5);
    const interruptThreshold = Number(settings.interruptThreshold ?? 0.6);
    const contextWindowSize = Number(settings.contextWindowSize ?? 20);
    const asrEndpoint = settings.asrEndpoint ?? '';
    const asrModel = settings.asrModel ?? 'whisper-1';
    const ttsVoice = settings.ttsVoice ?? 'af_heart';
    const ttsModel = settings.ttsModel ?? 'kokoro';

    // ── Endpoint test state ────────────────────────────────────────
    const [llmStatus, setLlmStatus] = useState('idle'); // 'idle'|'testing'|'ok'|'error'
    const [llmError, setLlmError] = useState('');
    const [ttsStatus, setTtsStatus] = useState('idle');
    const [ttsError, setTtsError] = useState('');

    const testLLM = useCallback(async () => {
        const url = (settings.baseUrl || '').replace(/\/$/, '');
        if (!url) { setLlmStatus('error'); setLlmError('No Base URL set.'); return; }
        setLlmStatus('testing');
        setLlmError('');
        try {
            const headers = {};
            if (settings.apiKey) headers['Authorization'] = `Bearer ${settings.apiKey}`;
            const res = await fetch(`${url}/models`, { headers, signal: AbortSignal.timeout(6000) });
            if (res.ok) {
                setLlmStatus('ok');
            } else {
                setLlmStatus('error');
                setLlmError(`HTTP ${res.status}: ${res.statusText}`);
            }
        } catch (err) {
            setLlmStatus('error');
            setLlmError(err.message);
        }
    }, [settings.baseUrl, settings.apiKey]);

    const testTTS = useCallback(async () => {
        const url = (settings.ttsEndpoint || '').replace(/\/$/, '');
        if (!url) { setTtsStatus('error'); setTtsError('No TTS Endpoint set.'); return; }
        setTtsStatus('testing');
        setTtsError('');
        try {
            const voice = settings.ttsVoice || 'af_heart';
            const model = settings.ttsModel || 'kokoro';
            const res = await fetch(`${url}/audio/speech`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, input: 'Test', voice }),
                signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
                setTtsStatus('ok');
            } else {
                setTtsStatus('error');
                setTtsError(`HTTP ${res.status}: ${res.statusText}`);
            }
        } catch (err) {
            setTtsStatus('error');
            setTtsError(err.message);
        }
    }, [settings.ttsEndpoint, settings.ttsVoice, settings.ttsModel]);

    function statusLabel(status, errMsg) {
        if (status === 'testing') return <span className={styles.statusTesting}>🔄 Testing…</span>;
        if (status === 'ok') return <span className={styles.statusOk}>✅ Connected</span>;
        if (status === 'error') return <span className={styles.statusError}>⚠️ {errMsg || 'Error'}</span>;
        return null;
    }

    return (
        <div className={styles.container}>

            {/* ─────────────── LLM Configuration ─────────────── */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>LLM Configuration</h2>
                <p className={styles.sectionNote}>
                    Global default — individual contacts can override these.
                </p>

                <div className={styles.field}>
                    <label className={styles.label}>Endpoint Type</label>
                    <SegmentedControl
                        name="Endpoint type"
                        options={ENDPOINT_OPTIONS}
                        value={endpointType}
                        onChange={(v) => update('endpointType', v)}
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="settings-base-url" className={styles.label}>Base URL</label>
                    <input
                        id="settings-base-url"
                        type="url"
                        className={styles.input}
                        placeholder={endpointType === 'local' ? 'http://localhost:11434' : 'https://api.openai.com/v1'}
                        value={baseUrl}
                        onChange={(e) => setSetting('baseUrl', e.target.value)}
                        onBlur={(e) => updateNow('baseUrl', e.target.value)}
                        inputMode="url"
                        autoComplete="off"
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="settings-model" className={styles.label}>Model</label>
                    <input
                        id="settings-model"
                        type="text"
                        className={styles.input}
                        placeholder={endpointType === 'local' ? 'llama3.2' : 'gpt-4o'}
                        value={model}
                        onChange={(e) => setSetting('model', e.target.value)}
                        onBlur={(e) => updateNow('model', e.target.value)}
                        autoComplete="off"
                    />
                </div>

                <div className={styles.testRow}>
                    <button
                        className={styles.testBtn}
                        onClick={testLLM}
                        disabled={llmStatus === 'testing'}
                        id="llm-test-btn"
                        type="button"
                    >
                        Test Connection
                    </button>
                    {statusLabel(llmStatus, llmError)}
                </div>
            </section>

            {/* ─────────────── TTS Configuration ─────────────── */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>TTS Configuration</h2>

                <div className={styles.field}>
                    <label className={styles.label}>Provider</label>
                    <SegmentedControl
                        name="TTS provider"
                        options={TTS_OPTIONS}
                        value={ttsProvider}
                        onChange={(v) => update('ttsProvider', v)}
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="settings-tts-voice" className={styles.label}>
                        Voice
                        <span className={styles.labelNote}>browse voices at <em>/v1/audio/voices</em></span>
                    </label>
                    <input
                        id="settings-tts-voice"
                        type="text"
                        className={styles.input}
                        placeholder="af_heart"
                        value={ttsVoice}
                        onChange={(e) => setSetting('ttsVoice', e.target.value)}
                        onBlur={(e) => updateNow('ttsVoice', e.target.value)}
                        autoComplete="off"
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="settings-tts-model" className={styles.label}>Model</label>
                    <input
                        id="settings-tts-model"
                        type="text"
                        className={styles.input}
                        placeholder="kokoro"
                        value={ttsModel}
                        onChange={(e) => setSetting('ttsModel', e.target.value)}
                        onBlur={(e) => updateNow('ttsModel', e.target.value)}
                        autoComplete="off"
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="settings-tts-endpoint" className={styles.label}>Endpoint URL</label>
                    <input
                        id="settings-tts-endpoint"
                        type="url"
                        className={styles.input}
                        placeholder="http://localhost:8880/v1"
                        value={ttsEndpoint}
                        onChange={(e) => setSetting('ttsEndpoint', e.target.value)}
                        onBlur={(e) => updateNow('ttsEndpoint', e.target.value)}
                        inputMode="url"
                        autoComplete="off"
                    />
                </div>

                <div className={styles.field}>
                    <Slider
                        id="settings-tts-speed"
                        label="Playback Speed"
                        value={ttsSpeed}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        onChange={(v) => update('ttsSpeed', v)}
                        format={(v) => `${v.toFixed(1)}×`}
                    />
                </div>

                <div className={styles.testRow}>
                    <button
                        className={styles.testBtn}
                        onClick={testTTS}
                        disabled={ttsStatus === 'testing'}
                        id="tts-test-btn"
                        type="button"
                    >
                        Test TTS
                    </button>
                    {statusLabel(ttsStatus, ttsError)}
                </div>
            </section>

            {/* ─────────────── TTS Text Filter ─────────────────── */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>TTS Text Filter</h2>
                <p className={styles.sectionNote}>
                    Strip LLM stage directions before sending to the voice engine.
                    Chat bubbles always show the full, unedited text.
                </p>

                {[
                    { key: 'tts_remove_special_char', label: 'Strip Emojis 🎉', def: true },
                    { key: 'tts_ignore_parentheses', label: 'Strip (parentheses)', def: true },
                    { key: 'tts_ignore_brackets', label: 'Strip [brackets]', def: true },
                    { key: 'tts_ignore_angle_brackets', label: 'Strip <angle brackets>', def: true },
                    { key: 'tts_ignore_asterisks', label: 'Strip *asterisk emotes*', def: false },
                ].map(({ key, label, def }) => (
                    <div className={styles.field} key={key}>
                        <label className={styles.label}>
                            <input
                                id={`settings-${key}`}
                                type="checkbox"
                                checked={settings[key] ?? def}
                                onChange={(e) => update(key, e.target.checked)}
                                style={{ marginRight: 8 }}
                            />
                            {label}
                        </label>
                    </div>
                ))}
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Audio / VAD</h2>

                <p className={styles.sectionNote}>
                    LIVE / PUSH mode is now a toggle pill in the chat input area.
                </p>

                <div className={styles.field}>
                    <Slider
                        id="settings-vad-sensitivity"
                        label="VAD Sensitivity"
                        value={vadSensitivity}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v) => update('vadSensitivity', v)}
                        format={(v) => v.toFixed(2)}
                    />
                </div>

                <div className={styles.field}>
                    <Slider
                        id="settings-interrupt-threshold"
                        label="Interrupt Threshold"
                        value={interruptThreshold}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v) => update('interruptThreshold', v)}
                        format={(v) => v.toFixed(2)}
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="settings-asr-endpoint" className={styles.label}>
                        ASR Endpoint URL
                        <span className={styles.labelNote}>optional — leave blank for Web Speech API (Chrome)</span>
                    </label>
                    <input
                        id="settings-asr-endpoint"
                        type="url"
                        className={styles.input}
                        placeholder="http://localhost:9000 (Whisper-compatible)"
                        value={asrEndpoint}
                        onChange={(e) => setSetting('asrEndpoint', e.target.value)}
                        onBlur={(e) => updateNow('asrEndpoint', e.target.value)}
                        inputMode="url"
                        autoComplete="off"
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="settings-asr-model" className={styles.label}>ASR Model</label>
                    <input
                        id="settings-asr-model"
                        type="text"
                        className={styles.input}
                        placeholder="whisper-1"
                        value={asrModel}
                        onChange={(e) => setSetting('asrModel', e.target.value)}
                        onBlur={(e) => updateNow('asrModel', e.target.value)}
                        autoComplete="off"
                    />
                </div>
            </section>

            {/* ─────────────── Context Window ──────────────────── */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Context Window</h2>

                <div className={styles.field}>
                    <Slider
                        id="settings-context-window"
                        label="Message History Size"
                        value={contextWindowSize}
                        min={5}
                        max={100}
                        step={5}
                        onChange={(v) => update('contextWindowSize', v)}
                        format={(v) => `${v} msgs`}
                    />
                </div>
            </section>

            {/* ─────────────── Memory (LimenLT) ────────────────── */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Memory (LimenLT)</h2>
                <p className={styles.sectionNote}>
                    Cognitive memory engine settings. Individual contacts configure Bootsector and opt-in via the Contact Sheet.
                </p>

                <div className={styles.field}>
                    <label className={styles.label}>
                        <input
                            id="settings-limen-stamina"
                            type="checkbox"
                            checked={settings.limenStaminaEnabled !== false}
                            onChange={(e) => update('limenStaminaEnabled', e.target.checked)}
                            style={{ marginRight: 8 }}
                        />
                        Enable Stamina Meter
                    </label>
                    <p className={styles.sectionNote} style={{ marginTop: 4 }}>
                        Tracks cognitive fatigue. When stamina reaches 0%, a sleep cycle is triggered automatically to consolidate memory.
                    </p>
                </div>

                <div className={styles.field}>
                    <button
                        className={styles.testBtn}
                        id="settings-limen-reset"
                        type="button"
                        onClick={async () => {
                            const { resetAllEngines } = await import('../llm/limenRegistry.js');
                            resetAllEngines();
                        }}
                    >
                        Hard Reset All Engines
                    </button>
                    <p className={styles.sectionNote} style={{ marginTop: 4 }}>
                        Destroys all in-memory engine instances. They will be recreated on the next message. Does not delete persisted memories or Polaroids.
                    </p>
                </div>
            </section>
        </div>
    );
}
