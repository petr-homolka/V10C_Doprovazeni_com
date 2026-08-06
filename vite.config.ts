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
      // 'prompt', ne 'autoUpdate' (změna 27. 7.). `autoUpdate` novou verzi
      // stáhne na pozadí, ale otevřená stránka dál běží na starých souborech
      // — nasazená změna se tak tvářila jako nenasazená. Teď se uživatel
      // zeptá a obnoví sám; obsluhuje to `components/UpdatePrompt.tsx`,
      // kde je i vysvětlení, proč se neobnovuje automaticky.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'Doprovázení.com',
        short_name: 'Doprovázení',
        description: 'CRM pro doprovázející organizace pěstounské péče',
        lang: 'cs',
        // DESIGN_SYSTEM.md §9.1 — theme/background = --bg-app, NIKDY bílá,
        // jinak instalační splash screen vypadá jako prázdný bílý blesk.
        // Cesta E: --bg-app je Geist `background-200`, tedy #FAFAFA. Musí
        // sedět s tokenem, jinak nainstalovaná PWA blikne cizí barvou.
        theme_color: '#FAFAFA',
        background_color: '#FAFAFA',
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
