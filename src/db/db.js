import Dexie from 'dexie';

/**
 * AlwaysMessengerDB — central IndexedDB instance (via Dexie.js).
 *
 * Schema version history:
 *   v1 (Phase 1)  — contacts, threads, messages, settings, summaries
 *   v2 (LimenLT) — interactions, polaroids (per-contact LimenLT storage)
 *
 * When adding columns in future phases, increment the version and add
 * a new `.stores()` call to the upgrade block. Never modify v1 inline.
 */
const db = new Dexie('AlwaysMessengerDB');

db.version(1).stores({
    /**
     * contacts — each row is an AI persona / conversation partner.
     * llmConfig and ttsConfig are stored as JSON objects.
     *
     * Indexed: id (auto), name
     */
    contacts:
        '++id, name, avatar, systemInstruction, &[llmConfig+ttsConfig], createdAt',

    /**
     * threads — a conversation thread between the user and one or more contacts.
     * contactIds is a comma-separated list for multi-contact (group) threads.
     * Indexed: id (auto), updatedAt (for sorting), contactIds (for lookup)
     */
    threads: '++id, title, contactIds, createdAt, updatedAt, seedCrystal',

    /**
     * messages — individual chat messages inside a thread.
     * role: 'user' | 'assistant' | 'system'
     * imageRef: optional — a Blob key or data URL for attached images (Phase 9)
     * Indexed: id (auto), threadId (for fast thread queries), timestamp
     */
    messages: '++id, threadId, role, content, imageRef, timestamp',

    /**
     * settings — global key-value config store.
     * Key examples: 'ttsProvider', 'ttsEndpoint', 'ttsSpeed', 'vadSensitivity'
     * Indexed: key (primary key — unique; no auto-increment)
     */
    settings: 'key',

    /**
     * summaries — stored results of the Chat Summarizer (Phase 10).
     * mode: 'polaroid' | 'memory'
     * messageRange: JSON — { start: number, end: number }
     * Indexed: id (auto), threadId, createdAt
     */
    summaries: '++id, threadId, mode, content, messageRange, createdAt',
});

db.version(2).stores({
    /**
     * interactions — LimenLT short-term interaction log, scoped per contact.
     * limenId: the ID assigned by LimenLT (uuid)
     * compressed: 1 | 0 — whether this row has been folded into systemInstruction
     */
    interactions: '++id, contactId, limenId, role, content, timestamp, resonanceScore, compressed',

    /**
     * polaroids — LimenLT long-term episodic memory archive, scoped per contact.
     * limenId: the ID assigned by LimenLT
     * back: JSON PolaroidBack — used by ResonanceScorer
     */
    polaroids: '++id, contactId, limenId, front, tokenCost, createdAt',
});

/**
 * Seed default global settings on first launch.
 * Uses put() so re-running is idempotent.
 */
export async function seedDefaultSettings() {
    const defaults = [
        { key: 'ttsProvider', value: 'kokoro' },
        { key: 'ttsEndpoint', value: '' },
        { key: 'ttsSpeed', value: 1.0 },
        { key: 'vadSensitivity', value: 0.5 },
        { key: 'interruptThreshold', value: 0.6 },
        { key: 'contextWindowSize', value: 20 },
        { key: 'activeMode', value: 'push' }, // 'push' | 'live'
        { key: 'asrEndpoint', value: '' },     // blank = use Web Speech API
        { key: 'asrModel', value: 'whisper-1' },
        { key: 'ttsVoice', value: 'af_heart' },
        { key: 'ttsModel', value: 'kokoro' },
        { key: 'limenStaminaEnabled', value: true },
    ];

    await db.transaction('rw', db.settings, async () => {
        for (const setting of defaults) {
            // Only write if the key doesn't exist yet (preserves user changes)
            const existing = await db.settings.get(setting.key);
            if (existing === undefined) {
                await db.settings.put(setting);
            }
        }
    });
}

export default db;
