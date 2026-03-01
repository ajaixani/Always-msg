/**
 * limenRegistry — singleton registry of per-contact LimenEngine instances.
 *
 * Each AI persona gets its own isolated LimenEngine with its own StorageAdapter,
 * Bootsector, sensors, stamina state, and Polaroid archive.
 *
 * Usage:
 *   import { getEngineForContact, resetEngine } from './limenRegistry';
 *   const engine = await getEngineForContact(contact, settings);
 */
import { LimenEngine, defaultTokenEstimator } from 'limenlt';
import { createStorageAdapter } from './limenStorage.js';
import { registerSensors } from './limenSensors.js';
import { makeLLMService } from './limenLLMBridge.js';

/** Map<contactId, LimenEngine> */
const registry = new Map();

/**
 * Get (or lazily create) the LimenEngine for a contact.
 *
 * @param {object} contact    full contact row from IndexedDB
 * @param {object} settings   global settings map from Zustand
 * @returns {LimenEngine}
 */
export async function getEngineForContact(contact, settings) {
    const id = contact.id;
    if (registry.has(id)) return registry.get(id);

    const memory = contact.memory ?? {};
    const llm = contact.llmConfig ?? {};

    const bootsectorText = memory.bootsector?.trim()
        || contact.systemInstruction?.trim()
        || 'An AI assistant that helps the user thoughtfully.';

    const maxTokens = llm.maxTokens || 8192;
    const staminaEnabled = settings?.limenStaminaEnabled !== false;

    const storage = createStorageAdapter(id);
    const llmService = makeLLMService(contact, settings);

    const engine = new LimenEngine(
        {
            maxTokens,
            storage,
            tokenEstimator: defaultTokenEstimator,
            bootsector: {
                id: `boot-${id}`,
                coreIdentity: bootsectorText,
                tokenCost: defaultTokenEstimator(bootsectorText),
            },
            enableStamina: staminaEnabled,
            enablePlasticity: false,  // Phase D — deferred
        },
        llmService,
    );

    // Register standard sense plugins
    registerSensors(engine);

    registry.set(id, engine);
    return engine;
}

/**
 * Destroy and remove the engine for a contact (e.g. after contact edit).
 * Next call to getEngineForContact will recreate it with fresh config.
 */
export function resetEngine(contactId) {
    registry.delete(contactId);
}

/** Reset all engines (e.g. global hard reset from Settings). */
export function resetAllEngines() {
    registry.clear();
}

/** Read-only view of all active engines (for diagnostics). */
export function getAllEngines() {
    return new Map(registry);
}
