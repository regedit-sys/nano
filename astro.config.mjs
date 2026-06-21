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
    plugins: [
      {
        name: 'vidstack-cloudflare-fix',
        config(config, { ssrBuild }) {
          if (ssrBuild && (process.env.CF_PAGES || process.env.CLOUDFLARE || process.env.WORKERS_CI)) {
            config.resolve = config.resolve || {};
            config.resolve.alias = config.resolve.alias || {};
            config.resolve.alias['@vidstack/react/player/layouts/default'] = fileURLToPath(
              new URL('./node_modules/@vidstack/react/server/player/vidstack-default-layout.js', import.meta.url)
            );
          }
        }
      }
    ],
    resolve: {
      alias: {},
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
      noExternal: [
        '@vidstack/react',
        '@vidstack/react/player/layouts/default'
      ],
      external: [
        'pg', 'pg-pool', 'pgpass', 'pg-cloudflare', 'split2',
        'fscreen', 'fs', 'path', 'events', 'dns', 'stream',
        'crypto', 'net', 'tls', 'util', 'util/types'
      ],
    },
  },
});

