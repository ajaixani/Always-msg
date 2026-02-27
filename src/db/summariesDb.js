import db from './db.js';

/**
 * summariesDb — helpers for the summaries table (Phase 10).
 *
 * Each summary is linked to a threadId and has:
 *   mode:         'polaroid' | 'memory'
 *   content:      the full summary text
 *   messageRange: { startIdx, endIdx } — indices into the thread's message array
 *   createdAt:    timestamp
 */

/**
 * Persist a new summary.
 * @param {number} threadId
 * @param {'polaroid'|'memory'} mode
 * @param {string} content
 * @param {{ startIdx: number, endIdx: number }} messageRange
 * @returns {Promise<object>}
 */
export async function addSummary(threadId, mode, content, messageRange) {
    const id = await db.summaries.add({
        threadId,
        mode,
        content,
        messageRange: JSON.stringify(messageRange),
        createdAt: Date.now(),
    });
    return db.summaries.get(id);
}

/**
 * Get all summaries for a thread, newest first.
 * @param {number} threadId
 * @returns {Promise<object[]>}
 */
export async function getSummaries(threadId) {
    const all = await db.summaries
        .where('threadId')
        .equals(threadId)
        .toArray();
    return all.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Delete a summary by id.
 * @param {number} id
 */
export async function deleteSummary(id) {
    await db.summaries.delete(id);
}
