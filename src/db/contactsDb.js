import db from './db.js';

/**
 * contactsDb — CRUD helpers for the contacts table.
 *
 * All functions return Promises. Views and components should not import
 * Dexie directly; use these helpers to keep DB logic contained.
 */

/**
 * Get all contacts, ordered by name ascending.
 * @returns {Promise<Contact[]>}
 */
export async function getContacts() {
    return db.contacts.orderBy('name').toArray();
}

/**
 * Get a single contact by id.
 * @param {number} id
 * @returns {Promise<Contact|undefined>}
 */
export async function getContact(id) {
    return db.contacts.get(id);
}

/**
 * Create a new contact.
 * @param {Omit<Contact, 'id'>} data
 * @returns {Promise<number>} The new contact's id.
 */
export async function createContact(data) {
    const now = Date.now();
    return db.contacts.add({
        name: data.name || 'New Contact',
        avatar: data.avatar || '🤖',
        systemInstruction: data.systemInstruction || '',
        llmConfig: data.llmConfig || {
            endpointType: 'openai', // 'openai' | 'letta' | 'local'
            baseUrl: '',
            model: '',
            apiKey: '',
        },
        createdAt: now,
    });
}

/**
 * Update an existing contact by id (partial update).
 * @param {number} id
 * @param {Partial<Contact>} changes
 * @returns {Promise<void>}
 */
export async function updateContact(id, changes) {
    await db.contacts.update(id, changes);
}

/**
 * Delete a contact and all its associated threads and messages.
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteContact(id) {
    await db.transaction('rw', db.contacts, db.threads, db.messages, async () => {
        // Find threads that involve this contact
        const threads = await db.threads.toArray();
        const contactThreadIds = threads
            .filter((t) => {
                const ids = String(t.contactIds).split(',').map(Number);
                return ids.includes(id);
            })
            .map((t) => t.id);

        // Delete all messages in those threads
        await db.messages.where('threadId').anyOf(contactThreadIds).delete();

        // Delete the threads themselves
        await db.threads.bulkDelete(contactThreadIds);

        // Delete the contact
        await db.contacts.delete(id);
    });
}
