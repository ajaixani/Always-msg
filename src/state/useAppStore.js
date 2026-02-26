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
 */
const useAppStore = create((set) => ({
    // ── ui ──────────────────────────────────────────────────────────
    activeMode: 'push',          // 'push' | 'live'
    activeView: 'chat',          // mirrors current route
    activeThreadId: null,        // number | null
    activeContactId: null,       // number | null

    setActiveMode: (mode) => set({ activeMode: mode }),
    setActiveView: (view) => set({ activeView: view }),
    setActiveThreadId: (id) => set({ activeThreadId: id }),
    setActiveContactId: (id) => set({ activeContactId: id }),
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
}));

export default useAppStore;
