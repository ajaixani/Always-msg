import { create } from 'zustand';

/**
 * useAppStore — global Zustand store.
 *
 * Organized into named slices. Each later phase will add its own slice
 * (audioSlice, llmSlice, etc.) to keep concerns separated.
 *
 * ── ui slice ──────────────────────────────────────────────────
 *   activeMode: 'push' | 'live'
 *   activeView: 'chat' | 'contacts' | 'settings'
 *   activeThreadId: number | null
 *   activeContactId: number | null
 *   contactSheetOpen: boolean
 *   editingContactId: number | null
 *
 * ── contacts slice ─────────────────────────────────────────────
 *   contacts: Contact[]         — in-memory cache, synced from IndexedDB
 *   setContacts(contacts)
 *
 * ── settings slice ─────────────────────────────────────────────
 *   settings: Record<string, any>   — in-memory cache of key-value settings
 *   setSetting(key, value)
 *   bulkSetSettings(obj)
 *
 * ── llm slice ──────────────────────────────────────────────────
 *   isStreaming: boolean          — true while an LLM response is in flight
 *   streamingMessageId: number | null  — DB id of the in-progress assistant msg
 *
 * ── audio slice ─────────────────────────────────────────────────
 *   isRecording: boolean          — PTT button is held
 *   isListening: boolean          — live mode VAD loop active
 *   vadActive:   boolean          — VAD currently detecting speech
 *   micError:    string | null    — last mic/ASR error message
 *
 * ── tts slice ────────────────────────────────────────────────────
 *   isTTSPlaying: boolean         — TTS audio playing
 *   ttsLevel:     number          — RMS level for spectrograph (0–1)
 */
const useAppStore = create((set) => ({
    // ── ui ──────────────────────────────────────────────────────────
    activeMode: 'push',          // 'push' | 'live'
    activeView: 'chat',          // mirrors current route
    activeThreadId: null,        // number | null
    activeContactId: null,       // number | null

    activeThreadTitle: '',

    setActiveMode: (mode) => set({ activeMode: mode }),
    setActiveView: (view) => set({ activeView: view }),
    setActiveThreadId: (id) => set({ activeThreadId: id }),
    setActiveContactId: (id) => set({ activeContactId: id }),
    setActiveThreadTitle: (title) => set({ activeThreadTitle: title }),
    // ContactSheet state
    contactSheetOpen: false,
    editingContactId: null,
    openContactSheet: (contactId = null) =>
        set({ contactSheetOpen: true, editingContactId: contactId }),
    closeContactSheet: () =>
        set({ contactSheetOpen: false, editingContactId: null }),

    // ── contacts ────────────────────────────────────────────────────
    contacts: [],

    setContacts: (contacts) => set({ contacts }),

    /** Upsert a single contact in the cache (used after CRUD ops in Phase 2) */
    upsertContact: (contact) =>
        set((state) => {
            const idx = state.contacts.findIndex((c) => c.id === contact.id);
            if (idx === -1) return { contacts: [...state.contacts, contact] };
            const updated = [...state.contacts];
            updated[idx] = contact;
            return { contacts: updated };
        }),

    removeContact: (id) =>
        set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) })),

    // ── settings ────────────────────────────────────────────────────
    settings: {},

    setSetting: (key, value) =>
        set((state) => ({ settings: { ...state.settings, [key]: value } })),

    bulkSetSettings: (obj) =>
        set((state) => ({ settings: { ...state.settings, ...obj } })),

    // ── llm ─────────────────────────────────────────────────────────
    isStreaming: false,
    streamingMessageId: null,

    setStreaming: (flag) => set({ isStreaming: flag }),
    setStreamingMessageId: (id) => set({ streamingMessageId: id }),

    // ── audio ────────────────────────────────────────────────────────
    isRecording: false,
    isListening: false,
    vadActive: false,
    micError: null,

    setRecording: (flag) => set({ isRecording: flag }),
    setListening: (flag) => set({ isListening: flag }),
    setVadActive: (flag) => set({ vadActive: flag }),
    setMicError: (msg) => set({ micError: msg }),

    // ── tts ──────────────────────────────────────────────────────────
    isTTSPlaying: false,
    ttsLevel: 0,

    setTTSPlaying: (flag) => set({ isTTSPlaying: flag }),
    setTTSLevel: (rms) => set({ ttsLevel: rms }),
}));

export default useAppStore;
