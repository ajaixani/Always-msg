/**
 * limenStorage — Dexie-backed StorageAdapter for LimenLT.
 *
 * Each contact gets its own isolated scope via contactId.
 * Implements the StorageAdapter interface from LimenLT:
 *   saveInteraction / loadRecentInteractions / deleteInteraction
 *   savePolaroid / fetchArchive / getPolaroid / updatePolaroid
 */
import db from '../db/db.js';

export function createStorageAdapter(contactId) {
    return {
        // ── Interaction log (short-term) ─────────────────────────────

        async saveInteraction(interaction) {
            await db.interactions.put({
                contactId,
                limenId: interaction.id,
                role: interaction.role,
                content: interaction.content,
                timestamp: interaction.timestamp,
                resonanceScore: interaction.resonanceScore ?? null,
                metadata: interaction.metadata ? JSON.stringify(interaction.metadata) : null,
                compressed: 0,
            });
        },

        async loadRecentInteractions(limit = 50) {
            const rows = await db.interactions
                .where('contactId')
                .equals(contactId)
                .reverse()
                .limit(limit)
                .toArray();
            // Return in chronological order, re-hydrated to LimenLT shape
            return rows.reverse().map(rowToInteraction);
        },

        async deleteInteraction(id) {
            await db.interactions
                .where({ contactId, limenId: id })
                .delete();
        },

        // ── Polaroid archive (long-term episodic memory) ─────────────

        async savePolaroid(polaroid) {
            await db.polaroids.put({
                contactId,
                limenId: polaroid.id,
                front: polaroid.front,
                back: JSON.stringify(polaroid.back),
                tokenCost: polaroid.tokenCost,
                createdAt: Date.now(),
            });
        },

        async fetchArchive() {
            const rows = await db.polaroids
                .where('contactId')
                .equals(contactId)
                .toArray();
            return rows.map(rowToPolaroid);
        },

        async getPolaroid(id) {
            const row = await db.polaroids
                .where({ contactId, limenId: id })
                .first();
            return row ? rowToPolaroid(row) : null;
        },

        async updatePolaroid(id, updates) {
            const existing = await db.polaroids
                .where({ contactId, limenId: id })
                .first();
            if (!existing) return;
            const currentBack = JSON.parse(existing.back || '{}');
            await db.polaroids.update(existing.id, {
                back: JSON.stringify({ ...currentBack, ...updates }),
            });
        },

        // ── Optional: session summaries ───────────────────────────────
        async saveSummary(summaryText, timeframe) {
            // Route into the existing summaries table (mode = 'limen')
            await db.summaries.add({
                threadId: contactId,  // repurpose threadId slot for contactId
                mode: 'limen',
                content: summaryText,
                messageRange: JSON.stringify(timeframe),
                createdAt: Date.now(),
            });
        },
    };
}

// ── Shape converters ──────────────────────────────────────────────────────────

function rowToInteraction(row) {
    return {
        id: row.limenId,
        role: row.role,
        content: row.content,
        timestamp: row.timestamp,
        resonanceScore: row.resonanceScore ?? undefined,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
}

function rowToPolaroid(row) {
    return {
        id: row.limenId,
        front: row.front,
        back: JSON.parse(row.back || '{}'),
        tokenCost: row.tokenCost,
    };
}
