import { useEffect } from 'react';
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
            </section>

            {/* ─────────────── Audio / VAD ─────────────────────── */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Audio / VAD</h2>

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
        </div>
    );
}
