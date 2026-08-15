import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // Next.js compiles JSX with the automatic runtime, so component files never
  // import React. Vitest transforms them itself and needs to be told the same,
  // otherwise any test that imports a .tsx module fails to parse. Affects tests
  // only; the Next build has its own pipeline.
  oxc: { jsx: { runtime: 'automatic' } },
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
