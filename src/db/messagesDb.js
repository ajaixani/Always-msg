import db from './db.js';

/**
 * messagesDb — helpers for the messages table.
 */

/**
 * Get all messages in a thread, ordered by timestamp ascending.
 * Optionally limited to the last `limit` messages.
 * @param {number} threadId
 * @param {number} [limit]
 * @returns {Promise<Message[]>}
 */
export async function getMessages(threadId, limit) {
    const query = db.messages
        .where('threadId')
        .equals(threadId)
        .sortBy('timestamp');
    const all = await query;
    if (limit && all.length > limit) {
        return all.slice(all.length - limit);
    }
    return all;
}

/**
 * Get the most recent message in a thread (for preview text in thread list).
 * @param {number} threadId
 * @returns {Promise<Message|undefined>}
 */
export async function getLastMessage(threadId) {
    const all = await db.messages
        .where('threadId')
        .equals(threadId)
        .sortBy('timestamp');
    return all[all.length - 1];
}

/**
 * Persist a new message to a thread.
 * @param {number} threadId
 * @param {'user'|'assistant'|'system'} role
 * @param {string} content
 * @param {string|null} [imageDataUrl] — optional attached image as a data URL (Phase 9)
 * @returns {Promise<Message>}
 */
export async function addMessage(threadId, role, content, imageDataUrl = null) {
    if (imageDataUrl && imageDataUrl.length > 500_000) {
        console.warn('[messagesDb] Large image attached:', Math.round(imageDataUrl.length / 1024), 'KB — consider compressing before storing');
    }
    const now = Date.now();
    const id = await db.messages.add({
        threadId,
        role,
        content,
        imageRef: imageDataUrl ?? null,
        timestamp: now,
    });
    return db.messages.get(id);
}

/**
 * Update the content of an existing message (used to finalize a streamed reply).
 * @param {number} id
 * @param {string} content
 */
export async function updateMessageContent(id, content) {
    await db.messages.update(id, { content });
}

/**
 * Delete all messages in a thread.
 * @param {number} threadId
 */
export async function deleteMessages(threadId) {
    await db.messages.where('threadId').equals(threadId).delete();
}
