import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@hwsd/rule-engine': fileURLToPath(new URL('./rule-engine/src/index.ts', import.meta.url)),
      '@hwsd/shared': fileURLToPath(new URL('./shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    include: ['{ai,backend,frontend,rule-engine,shared,tests}/**/*.test.{ts,tsx}'],
    passWithNoTests: false,
  },
});
