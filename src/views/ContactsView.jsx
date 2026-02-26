import { useState, useEffect } from 'react';
import useAppStore from '../state/useAppStore';
import ContactSheet from '../components/ContactSheet';
import styles from './ContactsView.module.css';

/**
 * ContactsView — Phase 2.
 * Displays the contact list with a FAB to create contacts.
 * Tapping a card opens ContactSheet in edit mode.
 */
export default function ContactsView() {
    const contacts = useAppStore((s) => s.contacts);
    const openContactSheet = useAppStore((s) => s.openContactSheet);
    const closeContactSheet = useAppStore((s) => s.closeContactSheet);
    const contactSheetOpen = useAppStore((s) => s.contactSheetOpen);
    const editingContactId = useAppStore((s) => s.editingContactId);

    return (
        <div className={styles.container}>
            {/* ── Header row ───────────────────────────── */}
            <div className={styles.listHeader}>
                <span className={styles.count}>
                    {contacts.length === 0
                        ? 'No contacts'
                        : `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`}
                </span>
            </div>

            {/* ── Contact list ─────────────────────────── */}
            {contacts.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyIcon} aria-hidden="true">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <p className={styles.emptyTitle}>No contacts yet</p>
                    <p className={styles.emptySubtext}>
                        Tap <strong>+</strong> to create your first AI persona.
                    </p>
                </div>
            ) : (
                <ul className={styles.list} aria-label="Contacts">
                    {contacts.map((contact) => (
                        <ContactCard
                            key={contact.id}
                            contact={contact}
                            onEdit={() => openContactSheet(contact.id)}
                        />
                    ))}
                </ul>
            )}

            {/* ── FAB — create new contact ─────────────── */}
            <button
                className={styles.fab}
                onClick={() => openContactSheet(null)}
                aria-label="Add new contact"
            >
                <span aria-hidden="true">+</span>
            </button>

            {/* ── ContactSheet (create / edit) ─────────── */}
            <ContactSheet
                open={contactSheetOpen}
                onClose={closeContactSheet}
                contactId={editingContactId}
            />
        </div>
    );
}

/** Renders a single contact row card */
function ContactCard({ contact, onEdit }) {
    const endpointLabel = {
        openai: 'OpenAI',
        letta: 'LETTA',
        local: 'Local',
    }[contact.llmConfig?.endpointType ?? 'openai'] ?? 'OpenAI';

    return (
        <li>
            <button className={styles.card} onClick={onEdit} aria-label={`Edit ${contact.name}`}>
                <span className={styles.avatar} aria-hidden="true">{contact.avatar ?? '🤖'}</span>
                <div className={styles.cardInfo}>
                    <span className={styles.cardName}>{contact.name}</span>
                    {contact.llmConfig?.model && (
                        <span className={styles.cardMeta}>{contact.llmConfig.model}</span>
                    )}
                </div>
                <span className={styles.endpointBadge}>{endpointLabel}</span>
                <span className={styles.chevronRight} aria-hidden="true">›</span>
            </button>
        </li>
    );
}
