/**
 * Vitest configuration
 * 
 * WHY VITEST:
 * - Modern test runner with great developer experience
 * - Native TypeScript and ESM support
 * - Compatible with Cloudflare Workers runtime
 * - Fast parallel execution
 * - Built-in coverage reporting
 * 
 * ALTERNATIVE CONSIDERED:
 * Jest: More mature but slower and requires complex setup for ESM
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test file patterns
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.wrangler'],

    // Coverage configuration
    coverage: {
      // Istanbul instrumentation works in both Node and the documented
      // Bun-first workflow; Bun does not expose Node's V8 inspector API.
      provider: 'istanbul',
      
      // Include all source files in coverage
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types.ts',  // Type definitions don't need coverage
        'src/index.ts',  // Entry point, tested via integration tests
      ],

      // Coverage thresholds
      // Baseline from the full source-included suite. Keep the gate honest and
      // raise these values as Worker-runtime and MCP-agent coverage lands.
      thresholds: {
        lines: 40,
        functions: 34,
        branches: 34,
        statements: 40,
      },

      // Output formats
      reporter: ['text', 'json', 'html'],
      
      // Report uncovered lines
      reportOnFailure: true,
    },

    // Test environment
    // WHY NODE:
    // Cloudflare Workers use V8 isolates, similar to Node.js
    // We mock Workers-specific APIs (KV, etc.)
    environment: 'node',

    // Global test timeout
    testTimeout: 10000,  // 10 seconds

    // Retry flaky tests
    retry: 0,  // Don't retry, fix flaky tests instead

    // Reporter
    reporters: ['verbose'],

    // Mock reset behavior
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
});
