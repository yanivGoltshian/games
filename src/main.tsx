import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { installTouchZoomGuard } from './platform/touchZoomGuard';

const cleanupTouchZoomGuard = installTouchZoomGuard();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.warn('Service worker registration failed; offline mode is unavailable.', error);
    });
  });
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupTouchZoomGuard();
  });
}
