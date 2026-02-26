import db from './db.js';

/**
 * threadsDb — helpers for the threads table.
 */

/**
 * Get all threads that involve a given contact, ordered by updatedAt desc.
 * @param {number} contactId
 * @returns {Promise<Thread[]>}
 */
export async function getThreadsForContact(contactId) {
    const all = await db.threads.orderBy('updatedAt').reverse().toArray();
    return all.filter((t) => {
        const ids = String(t.contactIds).split(',').map(Number);
        return ids.includes(contactId);
    });
}

/**
 * Get the most recent thread for a contact, or create a new one if none exists.
 * @param {number} contactId
 * @returns {Promise<Thread>}
 */
export async function getOrCreateThread(contactId) {
    const threads = await getThreadsForContact(contactId);
    if (threads.length > 0) return threads[0];

    const now = Date.now();
    const id = await db.threads.add({
        title: '',
        contactIds: String(contactId),
        createdAt: now,
        updatedAt: now,
        seedCrystal: null,
    });
    return db.threads.get(id);
}

/**
 * Bump the updatedAt timestamp on a thread (called after each new message).
 * @param {number} threadId
 */
export async function updateThreadTimestamp(threadId) {
    await db.threads.update(threadId, { updatedAt: Date.now() });
}

/**
 * Delete a thread and all its messages.
 * @param {number} threadId
 */
export async function deleteThread(threadId) {
    await db.transaction('rw', db.threads, db.messages, async () => {
        await db.messages.where('threadId').equals(threadId).delete();
        await db.threads.delete(threadId);
    });
}
