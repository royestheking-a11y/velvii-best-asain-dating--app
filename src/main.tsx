import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';
import { GoogleOAuthProvider } from '@react-oauth/google';

// Auto-update SW
const updateSW = registerSW({
  onNeedRefresh() {
    // Optionally show a "Update available" toast, but user asked for AUTO update.
    // 'autoUpdate' in vite config usually handles the SW update lifecycle, 
    // but a page reload might be needed to activate it fully if not handled.
    // However, with 'registerType: autoUpdate', the new SW activates immediately,
    // and clients claim the new SW.
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

import { HelmetProvider } from 'react-helmet-async';



createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_PLACEHOLDER"}>
      <HelmetProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HelmetProvider>
    </GoogleOAuthProvider>
  </ErrorBoundary>
);
