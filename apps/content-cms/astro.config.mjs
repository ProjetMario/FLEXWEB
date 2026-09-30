import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import emdash from 'emdash/astro';
import { d1, r2 } from '@emdash-cms/cloudflare';
import { flexwebPublication } from './src/plugin.mjs';
import { flexwebBrevo } from './src/email-plugin.mjs';

export default defineConfig({
  output: 'server',
  // Declare the content language without adding prefixes or redirects to CMS routes.
  i18n: { defaultLocale: 'fr', locales: ['fr'], routing: 'manual' },
  vite: {
    environments: {
      ssr: {
        build: {
          // Kysely has order-sensitive circular imports. Preserve initialization
          // order across Rolldown chunks in the deployed Worker as well as dev.
          rolldownOptions: { output: { strictExecutionOrder: true } },
        },
      },
    },
  },
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [
    react(),
    emdash({
      database: d1({ binding: 'DB' }),
      storage: r2({ binding: 'MEDIA' }),
      mcp: false,
      toolbar: false,
      plugins: [flexwebPublication(), flexwebBrevo()],
      maxUploadSize: 10 * 1024 * 1024,
      middleware: { outer: './src/outer-middleware.ts' },
      admin: { siteName: 'Flex-Web — contenus', footerLabel: 'Flex-Web · EmDash', logo: '/logo.svg' },
    }),
  ],
});
