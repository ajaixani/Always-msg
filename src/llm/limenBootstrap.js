/**
 * limenBootstrap — one-time Bootstrap Migration for existing contacts.
 *
 * When limenEnabled is flipped on for an existing contact, this module:
 *   1. Fetches the contact's legacy systemInstruction + last N messages
 *   2. Calls the LLM with a digest prompt to synthesize a compressed systemInstruction
 *   3. Ports the legacy systemInstruction → bootsector (immutable identity)
 *   4. Saves the output → memory.systemInstruction (mutable lore block)
 *   5. Updates the contact in IndexedDB and resets the registry engine
 *
 * Idempotent: skips if contact.limenEnabled is already true.
 */
import db from '../db/db.js';
import { getThreadsForContact } from '../db/threadsDb.js';
import { getMessages } from '../db/messagesDb.js';
import { summarize } from './summarizeClient.js';
import { resetEngine } from './limenRegistry.js';

const BOOTSTRAP_PROMPT = `You are a memory synthesis engine. Your task is to compress a legacy AI persona and its recent conversation history into a dense, highly efficient memory block.

Task:
Analyze the inputs and output ONLY the extracted data, categorized exactly as follows:

**Core Persona & Dynamic:** 2–3 sentences defining the AI's established behavioral traits and its specific rapport/relationship dynamic with the user.

**Active Context:** A concise bulleted list of current topics being discussed, immediate goals, or unresolved threads.

**Persistent Facts:** A bulleted list of strict facts the AI has learned about the user or world during this conversation.

Constraints: Prioritize token density. Use shorthand where appropriate. Do not include greetings, conversational filler, or meta-commentary.`;

/**
 * Run the one-time bootstrap migration for a contact.
 *
 * @param {object} contact    full contact row from IndexedDB
 * @param {object} settings   global settings from Zustand
 * @returns {Promise<boolean>} true on success, false on failure
 */
export async function bootstrapLimenMigration(contact, settings) {
    if (contact.memory?.bootstrapped) {
        console.log(`[Limen] Contact ${contact.id} already bootstrapped. Skipping.`);
        return true;
    }

    try {
        // Find this contact's most recently updated thread
        const contactThreads = await getThreadsForContact(contact.id);
        const contactThread = contactThreads[0] ?? null;

        let recentMessages = [];
        if (contactThread) {
            recentMessages = await getMessages(contactThread.id, 20);
        }

        const legacyPrompt = contact.systemInstruction?.trim() || '';
        const formattedHistory = recentMessages
            .filter((m) => m.role !== 'system')
            .map((m) => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
            .join('\n');

        const userContent = [
            legacyPrompt ? `Legacy System Prompt:\n${legacyPrompt}` : '',
            formattedHistory ? `Recent Chat History:\n${formattedHistory}` : 'No prior history.',
        ].filter(Boolean).join('\n\n');

        // Run the digest LLM call
        const compressedInstruction = await summarize({
            contact,
            settings,
            messages: [{ role: 'user', content: userContent }],
            customPrompt: BOOTSTRAP_PROMPT,
        });

        // Build the new memory state
        const newMemory = {
            bootsector: legacyPrompt || 'An AI assistant that helps the user thoughtfully.',
            systemInstruction: compressedInstruction.trim(),
            lastCompressionTimestamp: Date.now(),
            compressionCycleCount: 0,
            bootstrapped: true,
        };

        // Atomic Dexie update
        await db.contacts.update(contact.id, {
            limenEnabled: true,
            memory: newMemory,
        });

        // Destroy any cached engine so it's rebuilt with new config
        resetEngine(contact.id);

        console.log(`[Limen] Bootstrap migration successful for contact ${contact.id}`);
        return true;

    } catch (err) {
        console.error(`[Limen] Bootstrap migration failed for contact ${contact.id}:`, err);
        return false;
    }
}

/**
 * Activate LimenLT for a brand-new contact (no prior history).
 * Simply initialises an empty memory state — no LLM call needed.
 *
 * @param {object} contact   contact row with memory.bootsector already set
 */
export async function activateNewContact(contact) {
    const bootsector = contact.memory?.bootsector?.trim()
        || contact.systemInstruction?.trim()
        || 'An AI assistant that helps the user thoughtfully.';

    const newMemory = {
        bootsector,
        systemInstruction: '',
        lastCompressionTimestamp: Date.now(),
        compressionCycleCount: 0,
        bootstrapped: true,
    };

    await db.contacts.update(contact.id, {
        limenEnabled: true,
        memory: newMemory,
    });

    resetEngine(contact.id);
}
