import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './styles/global.css';

// Register the PWA service worker (injected by vite-plugin-pwa at build time)
// In dev mode with devOptions.enabled=true it also works
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
    onNeedRefresh() {
        // Could show a toast prompt here in a later phase
        console.info('[SW] New version available — auto-updating.');
        updateSW(true);
    },
    onOfflineReady() {
        console.info('[SW] App is ready to work offline.');
    },
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>,
);
