import { useState, useEffect } from 'react';
import styles from './OfflineBanner.module.css';

/**
 * OfflineBanner — fixed top strip that appears when navigator.onLine is false.
 * Listens to window 'online' and 'offline' events and auto-dismisses.
 */
export default function OfflineBanner() {
    const [offline, setOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const goOffline = () => setOffline(true);
        const goOnline = () => setOffline(false);

        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);
        return () => {
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('online', goOnline);
        };
    }, []);

    if (!offline) return null;

    return (
        <div className={styles.banner} role="alert" aria-live="assertive">
            <span className={styles.icon} aria-hidden="true">⚡</span>
            <span className={styles.msg}>No internet connection — messages will not send</span>
        </div>
    );
}
