import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/**/*.test.ts'],
    alias: {
      '@v-gold/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@v-gold/database': path.resolve(__dirname, 'packages/database/src/index.ts'),
      '@v-gold/ai-gateway': path.resolve(__dirname, 'packages/ai-gateway/src/index.ts'),
    },
  },
});
