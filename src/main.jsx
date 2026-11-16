import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { startFileSync } from './fileSync.js';
import { LockGate } from './Lock.jsx';
// Fonts are bundled with the app, so the workspace works with no internet connection.
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import '@fontsource-variable/geist';
import './styles.css';
import './dark.css';
import './calendar.css';
import './glass.css';

// Public demo build (VITE_DEMO=1): no file on this computer, just sample creators in the visitor's browser.
const DEMO = import.meta.env.VITE_DEMO === '1';
// Load your data from the file on this computer first, then start the app.
(DEMO ? Promise.resolve() : startFileSync()).finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <LockGate>
        <App />
      </LockGate>
    </StrictMode>,
  );
});
