import { URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

import SRI from './plugins/subresource-integrity';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      host: true
    },
    optimizeDeps: {
      exclude: ['@babylonjs/havok']
    },
    plugins: [
      vue(),
      VitePWA({
        devOptions: {
          enabled: false
        },
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png}']
        },
        includeAssets: ['assets/favicon.ico', 'assets/images/logo192.png'],
        manifest: {
          name: 'TankeMe!',
          short_name: 'TankMe!',
          description: 'Online 1v1 multiplayer 3D tank battle',
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
          ],
          display: 'fullscreen'
        }
      }),
      SRI()
    ],
    resolve: {
      alias: {
        '@/': new URL('./src/', import.meta.url).pathname
      }
    },
    define: {
      'import.meta.env.VITE_TANKME_PUBLIC_KEY': JSON.stringify(
        env.VITE_TANKME_PUBLIC_KEY ? env.VITE_TANKME_PUBLIC_KEY : env.TANKME_PUBLIC_KEY
      )
    }
  };
});
