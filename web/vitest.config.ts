import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    // Mirror the tsconfig `@/*` -> `./src/*` alias so test files can import
    // modules the same way app/component code does.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Node 22 provides a global `crypto.subtle`, matching the browser runtime.
    environment: 'node',
    globals: true,
  },
})
