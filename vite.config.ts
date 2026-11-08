import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base path is configurable: VITE_BASE=/my-repo/ npm run build (defaults to "/")
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate', includeAssets: ['apple-touch-icon.png'],
    manifest: { name: 'FinTrack', short_name: 'FinTrack', display: 'standalone', start_url: base, scope: base,
      background_color: '#0f172a', theme_color: '#0f172a',
      icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] },
    workbox: { globPatterns: ['**/*.{js,css,html,png,svg}'] },
  })],
});
