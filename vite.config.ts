import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'Doprovázení.com',
        short_name: 'Doprovázení',
        description: 'CRM pro doprovázející organizace pěstounské péče',
        lang: 'cs',
        // DESIGN_SYSTEM.md §9.1 — theme/background = --bg-app, NIKDY bílá,
        // jinak instalační splash screen vypadá jako prázdný bílý blesk.
        theme_color: '#FAF9F5',
        background_color: '#FAF9F5',
        display: 'standalone',
        // TODO(M9.5): nahradit skutečným logem organizace Doprovázení.com —
        // toto je jen placeholder tvar (teal kruh na --bg-app), ne finální
        // ikona. Až bude logo hotové, vygenerovat 192/512 PNG + maskable
        // variantu přesně dle §9.1 (ikona na --bg-app pozadí, ne na bílé).
        icons: [
          { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
})
