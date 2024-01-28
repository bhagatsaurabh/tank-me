import { URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

import SRI from './plugins/subresource-integrity';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png}']
      },
      includeAssets: ['assets/favicon.ico', 'assets/images/logo192.png'],
      manifest: {
        name: 'TankeMe!',
        short_name: 'TankMe!',
        description: 'Online 1v3 multiplayer 3D tank battle',
        theme_color: '#000000',
        background_color: '#000000',
        icons: [
          {
            src: 'assets/images/logo192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'assets/images/logo512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
    SRI()
  ],
  resolve: {
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname
    }
  }
});
