import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel/serverless';
import react from '@astrojs/react';

// Force the Vercel adapter to target Node 20 runtime instead of Node 18, 
// as Vercel builder environment runs Node 24 which the old adapter doesn't recognize.
if (process.env.VERCEL) {
  Object.defineProperty(process, 'version', {
    value: 'v20.0.0',
    writable: true,
    configurable: true
  });
}

export default defineConfig({
  output: 'server',
  adapter: process.env.VERCEL
    ? vercel()
    : node({
        mode: 'standalone',
      }),
  integrations: [react()],
});
