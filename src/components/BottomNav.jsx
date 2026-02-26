import { NavLink } from 'react-router-dom';
import styles from './BottomNav.module.css';

/**
 * BottomNav — three-tab navigation fixed to the bottom of the screen.
 *
 * Tabs: Chat | Contacts | Settings
 *
 * Uses React Router's <NavLink> which automatically applies `aria-current="page"`
 * and lets us style the active tab via the `isActive` callback.
 */

// Icon components — clean SVG paths, no external icon library needed
function IconChat({ active }) {
    return (
        <svg
            width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke={active ? 'var(--color-accent)' : 'var(--color-text-muted)'}
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    );
}

function IconContacts({ active }) {
    return (
        <svg
            width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke={active ? 'var(--color-accent)' : 'var(--color-text-muted)'}
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}

function IconSettings({ active }) {
    return (
        <svg
            width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke={active ? 'var(--color-accent)' : 'var(--color-text-muted)'}
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    );
}

const TABS = [
    { to: '/chat', label: 'Chat', Icon: IconChat },
    { to: '/contacts', label: 'Contacts', Icon: IconContacts },
    { to: '/settings', label: 'Settings', Icon: IconSettings },
];

export default function BottomNav() {
    return (
        <nav className={styles.nav} aria-label="Main navigation">
            {TABS.map(({ to, label, Icon }) => (
                <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                        [styles.tab, isActive ? styles.tabActive : ''].join(' ')
                    }
                    aria-label={label}
                >
                    {({ isActive }) => (
                        <>
                            <Icon active={isActive} />
                            <span className={styles.label}>{label}</span>
                        </>
                    )}
                </NavLink>
            ))}
        </nav>
    );
}
