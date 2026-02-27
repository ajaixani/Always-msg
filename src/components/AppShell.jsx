import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import OfflineBanner from './OfflineBanner';
import useAppStore from '../state/useAppStore';
import { seedDefaultSettings } from '../db/db';
import db from '../db/db';
import styles from './AppShell.module.css';

export default function AppShell() {
    const location = useLocation();
    const setActiveView = useAppStore((s) => s.setActiveView);
    const bulkSetSettings = useAppStore((s) => s.bulkSetSettings);
    const setContacts = useAppStore((s) => s.setContacts);
    const activeThreadTitle = useAppStore((s) => s.activeThreadTitle);
    const settings = useAppStore((s) => s.settings);

    useEffect(() => {
        const view = location.pathname.replace('/', '') || 'chat';
        setActiveView(view);
    }, [location.pathname, setActiveView]);

    useEffect(() => {
        async function init() {
            try {
                await seedDefaultSettings();
                const allSettings = await db.settings.toArray();
                bulkSetSettings(Object.fromEntries(allSettings.map(({ key, value }) => [key, value])));
                const contacts = await db.contacts.toArray();
                setContacts(contacts);
                console.info('[AlwaysMessenger] DB initialized. Contacts:', contacts.length);
            } catch (err) {
                console.error('[AlwaysMessenger] DB init failed:', err);
            }
        }
        init();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const viewLabels = { chat: 'Always', contacts: 'Contacts', settings: 'Settings' };
    const currentView = location.pathname.replace('/', '') || 'chat';

    // On the chat route: show active thread name (if any); fall back to "Always"
    const headerTitle = currentView === 'chat' && activeThreadTitle
        ? activeThreadTitle
        : (viewLabels[currentView] ?? 'Always');

    const isLive = currentView === 'chat' && settings?.activeMode === 'live';

    return (
        <div className={styles.shell}>
            <OfflineBanner />
            <header className={styles.header}>
                <span className={styles.headerTitle}>
                    {headerTitle}
                    {isLive && activeThreadTitle && (
                        <span className={styles.liveBadge} aria-label="Live mode active">
                            LIVE
                        </span>
                    )}
                </span>
            </header>

            <main className={styles.content}>
                <Outlet />
            </main>

            <BottomNav />
        </div>
    );
}
