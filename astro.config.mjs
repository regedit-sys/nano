import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel/serverless';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import { fileURLToPath } from 'node:url';

if (process.env.VERCEL) {
  Object.defineProperty(process, 'version', {
    value: 'v20.0.0',
    writable: true,
    configurable: true
  });
}

const getAdapter = () => {
  if (process.env.CF_PAGES || process.env.CLOUDFLARE || process.env.WORKERS_CI) {
    return cloudflare();
  }
  if (process.env.VERCEL) {
    return vercel();
  }
  return node({
    mode: 'standalone',
  });
};

export default defineConfig({
  output: 'server',
  adapter: getAdapter(),
  integrations: [react()],
  vite: {
    resolve: {
      alias: {
        ...(process.env.CF_PAGES || process.env.CLOUDFLARE || process.env.WORKERS_CI
          ? {
              '@vidstack/react/player/layouts/default': fileURLToPath(
                new URL('./src/components/poprink/video-player/vidstack-mock.tsx', import.meta.url)
              ),
            }
          : {}),
      },
    },
    optimizeDeps: {
      include: [
        '@vidstack/react',
        '@vidstack/react/player/layouts/default',
        'hls.js',
      ],
    },
    build: {
      rollupOptions: {
        external: [
          'pg', 'pg-pool', 'pgpass', 'pg-cloudflare', 'split2',
          'fscreen', 'fs', 'path', 'events', 'dns', 'stream',
          'crypto', 'net', 'tls', 'util', 'util/types'
        ],
      },
    },
    ssr: {
      external: [
        'pg', 'pg-pool', 'pgpass', 'pg-cloudflare', 'split2',
        'fscreen', 'fs', 'path', 'events', 'dns', 'stream',
        'crypto', 'net', 'tls', 'util', 'util/types'
      ],
    },
  },
});

