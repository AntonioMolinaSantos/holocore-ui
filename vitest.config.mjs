import { defineConfig } from "vitest/config";

// Unit, build and pack tests only. Browser tests are *.spec.ts under
// tests/browser and tests/e2e, run by Playwright, never by vitest.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.mjs", "packages/*/tests/**/*.test.{ts,mjs}", "apps/*/tests/unit/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
