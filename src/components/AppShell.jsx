import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import useAppStore from '../state/useAppStore';
import { seedDefaultSettings } from '../db/db';
import db from '../db/db';
import styles from './AppShell.module.css';

/**
 * AppShell — persistent layout frame rendered on every route.
 *
 * Responsibilities:
 *   1. On mount: initialize IndexedDB (open DB, seed defaults, load cached data)
 *   2. Render the app chrome: top header + scrollable content area + bottom nav
 *   3. Track active view in global store (mirrors current URL)
 */
export default function AppShell() {
    const location = useLocation();
    const setActiveView = useAppStore((s) => s.setActiveView);
    const bulkSetSettings = useAppStore((s) => s.bulkSetSettings);
    const setContacts = useAppStore((s) => s.setContacts);

    // Sync active view to store whenever the route changes
    useEffect(() => {
        const view = location.pathname.replace('/', '') || 'chat';
        setActiveView(view);
    }, [location.pathname, setActiveView]);

    // Initialize DB and hydrate store on first mount
    useEffect(() => {
        async function init() {
            try {
                // Seed defaults (idempotent — only writes missing keys)
                await seedDefaultSettings();

                // Load all settings into store
                const allSettings = await db.settings.toArray();
                const settingsMap = Object.fromEntries(
                    allSettings.map(({ key, value }) => [key, value]),
                );
                bulkSetSettings(settingsMap);

                // Load contacts into store
                const contacts = await db.contacts.toArray();
                setContacts(contacts);

                console.info('[AlwaysMessenger] DB initialized. Contacts:', contacts.length);
            } catch (err) {
                console.error('[AlwaysMessenger] DB init failed:', err);
            }
        }
        init();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Derive view name for header title
    const viewLabels = { chat: 'Always', contacts: 'Contacts', settings: 'Settings' };
    const currentView = location.pathname.replace('/', '') || 'chat';

    return (
        <div className={styles.shell}>
            {/* ── Top Header ─────────────────────────────────── */}
            <header className={styles.header}>
                <span className={styles.headerTitle}>{viewLabels[currentView] ?? 'Always'}</span>
            </header>

            {/* ── Scrollable Content Area ─────────────────────── */}
            <main className={styles.content}>
                <Outlet />
            </main>

            {/* ── Bottom Navigation ───────────────────────────── */}
            <BottomNav />
        </div>
    );
}
