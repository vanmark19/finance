import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';
import { initDb } from './lib/init';

registerSW({ immediate: true });
navigator.storage?.persist?.().catch(() => undefined); // ask the browser not to evict local data

initDb()
  .then(() => createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>))
  .catch(e => { document.getElementById('root')!.textContent = 'Eroare la deschiderea bazei de date: ' + String(e); });
