import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
        hmr: {
          clientPort: 443,
          protocol: 'wss',
          host: env.VITE_HOST || 'ais-dev-2xcgaysvxcb2zyufktlghp-411069503225.europe-west2.run.app',
        },
      },
      plugins: [
        tailwindcss(),
        react(),
        VitePWA({
          strategies: 'injectManifest',
          srcDir: 'src',
          filename: 'sw.ts',
          registerType: 'prompt',
          injectRegister: false,
          devOptions: {
            enabled: false,
          },
          includeAssets: [
            'icons/icon-192x192.png',
            'icons/icon-512x512.png',
            'icon-192-maskable.png',
            'icon-512-maskable.png',
            'icon.svg',
            'offline.html',
            'screenshots/wide-1920x880.png',
            'screenshots/narrow-627x1280.png',
          ],
          manifest: {
            name: 'EduBlay - Study Hub',
            short_name: 'EduBlay',
            description: 'AI-powered student learning app for smarter studying',
            theme_color: '#1d4ed8',
            background_color: '#0f172a',
            display: 'standalone',
            display_override: ['window-controls-overlay', 'standalone'],
            orientation: 'portrait',
            scope: '/',
            start_url: '/',
            id: '/',
            lang: 'en',
            categories: ['education', 'productivity'],
            // ── Icons: PNG required for installability ──
            icons: [
              { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
              { src: '/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
              { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
            screenshots: [
              {
                src: '/screenshots/wide-1920x880.png',
                sizes: '1920x880',
                type: 'image/png',
                form_factor: 'wide',
                label: 'EduBlay Desktop Dashboard',
              },
              {
                src: '/screenshots/narrow-627x1280.png',
                sizes: '627x1280',
                type: 'image/png',
                form_factor: 'narrow',
                label: 'EduBlay Mobile View',
              },
            ],
          },
          injectManifest: {
            globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
            globIgnores: ['screenshots/**', '**/screenshots/**'],
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          },
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
        dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'react/jsx-runtime', '@google/genai'],
      },
      build: {
        chunkSizeWarningLimit: 2000,
      },
    };
});