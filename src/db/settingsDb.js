import db from './db.js';

/**
 * settingsDb — helpers for the settings key-value table.
 *
 * Writes are debounced by default so rapid slider drags don't spam IndexedDB.
 */

/** Active debounce timers keyed by setting key */
const _debounceTimers = {};
const DEBOUNCE_MS = 300;

/**
 * Save a single setting to IndexedDB (debounced).
 * @param {string} key
 * @param {any} value
 */
export function saveSetting(key, value) {
    clearTimeout(_debounceTimers[key]);
    _debounceTimers[key] = setTimeout(async () => {
        await db.settings.put({ key, value });
    }, DEBOUNCE_MS);
}

/**
 * Save multiple settings at once (batch, also debounced as a group).
 * @param {Record<string, any>} obj
 */
export function saveSettings(obj) {
    clearTimeout(_debounceTimers['__batch__']);
    _debounceTimers['__batch__'] = setTimeout(async () => {
        const rows = Object.entries(obj).map(([key, value]) => ({ key, value }));
        await db.settings.bulkPut(rows);
    }, DEBOUNCE_MS);
}

/**
 * Immediately (no debounce) persist a setting — use for form onBlur/submit.
 * @param {string} key
 * @param {any} value
 */
export async function saveSettingNow(key, value) {
    clearTimeout(_debounceTimers[key]);
    await db.settings.put({ key, value });
}

/**
 * Load all settings and return as a plain object.
 * @returns {Promise<Record<string, any>>}
 */
export async function loadAllSettings() {
    const rows = await db.settings.toArray();
    return Object.fromEntries(rows.map(({ key, value }) => [key, value]));
}
