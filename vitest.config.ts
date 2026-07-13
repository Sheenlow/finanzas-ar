import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['node_modules', '.agents', '.next', '.vercel', '.opencode'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 60,
        functions: 60,
        statements: 60,
        branches: 50,
      },
      exclude: [
        'node_modules/',
        'src/types/',
        '**/*.d.ts',
        '.next/',
        '.agents/',
        'supabase/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
