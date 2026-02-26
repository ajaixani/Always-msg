import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import ChatView from './views/ChatView';
import ContactsView from './views/ContactsView';
import SettingsView from './views/SettingsView';

/**
 * Application router.
 * Uses the nested layout pattern: AppShell renders the chrome (header + bottom
 * nav), and each view renders inside <Outlet />.
 *
 * Routes:
 *   /           → redirect to /chat
 *   /chat       → ChatView
 *   /contacts   → ContactsView
 *   /settings   → SettingsView
 */
export const router = createBrowserRouter([
    {
        path: '/',
        element: <AppShell />,
        children: [
            { index: true, element: <Navigate to="/chat" replace /> },
            { path: 'chat', element: <ChatView /> },
            { path: 'contacts', element: <ContactsView /> },
            { path: 'settings', element: <SettingsView /> },
        ],
    },
]);
