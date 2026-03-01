/**
 * limenCompressor — background Read → Evaluate → Write cycle.
 *
 * After each assistant turn, this module checks whether the compression
 * threshold has been met and (if so) asynchronously folds new interactions
 * into the contact's memory.systemInstruction via an LLM call.
 *
 * This runs FIRE-AND-FORGET after onDone — the user never waits for it.
 *
 * Threshold: 10 uncompressed interaction rows since last compression.
 */
import db from '../db/db.js';
import { summarize } from './summarizeClient.js';

const COMPRESSION_THRESHOLD = 10; // turns before triggering a write cycle

const COMPRESSION_PROMPT = `You are managing the working memory of an AI agent.

Current Memory State:
{CURRENT_MEMORY}

New Conversation to Integrate:
{NEW_TURNS}

Task:
Update the "Current Memory State" using the New Conversation.
- Modify the "Active Context" if topics have shifted or resolved.
- Add new entries to "Persistent Facts" if the user revealed new immutable information.
- Do NOT change the "Core Persona & Dynamic" unless a dramatic shift in rapport occurred.

Output ONLY the updated memory block in the exact same format. No preamble.`;

/**
 * Evaluate whether a compression cycle is needed and run it if so.
 * Called fire-and-forget from streamChatWithLimen after onDone.
 *
 * @param {object} contact   full contact row (after the latest round-trip)
 * @param {object} settings  global settings from Zustand
 */
export async function evaluateAndCompress(contact, settings) {
    if (!contact?.limenEnabled) return;

    try {
        // Count uncompressed interactions for this contact
        const uncompressed = await db.interactions
            .where({ contactId: contact.id, compressed: 0 })
            .toArray();

        if (uncompressed.length < COMPRESSION_THRESHOLD) return; // threshold not met

        const currentMemory = contact.memory?.systemInstruction?.trim() || '';
        const formattedTurns = uncompressed
            .map((r) => `${r.role === 'user' ? 'USER' : 'ASSISTANT'}: ${r.content}`)
            .join('\n');

        const compressionPrompt = COMPRESSION_PROMPT
            .replace('{CURRENT_MEMORY}', currentMemory || '(empty — first compression cycle)')
            .replace('{NEW_TURNS}', formattedTurns);

        const updatedInstruction = await summarize({
            contact,
            settings,
            messages: [{ role: 'user', content: compressionPrompt }],
            customPrompt: compressionPrompt,
        });

        // Atomic DB update: write new systemInstruction + increment counter
        const freshContact = await db.contacts.get(contact.id);
        if (!freshContact) return;

        await db.contacts.update(contact.id, {
            memory: {
                ...freshContact.memory,
                systemInstruction: updatedInstruction.trim(),
                lastCompressionTimestamp: Date.now(),
                compressionCycleCount: (freshContact.memory?.compressionCycleCount ?? 0) + 1,
            },
        });

        // Mark these interactions as compressed
        const ids = uncompressed.map((r) => r.id);
        await db.interactions.bulkUpdate(
            ids.map((id) => ({ key: id, changes: { compressed: 1 } })),
        );

        console.log(`[Limen] Compression cycle ${(freshContact.memory?.compressionCycleCount ?? 0) + 1} complete for contact ${contact.id}`);

    } catch (err) {
        // Compression failure is non-fatal — the app continues normally
        console.warn('[Limen] Compression cycle failed (non-fatal):', err.message);
    }
}
