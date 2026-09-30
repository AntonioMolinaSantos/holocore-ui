import { defineConfig, devices } from "@playwright/test";

// Headless Chromium draws WebGL on SwiftShader, which recent versions only use when asked.
const gl = ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"];

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "**/*.spec.ts",
  timeout: 120_000,
  // Software WebGL is CPU bound: more than two workers at once starve each other's frames and
  // turn the 30-cycle stress tests into timing tests. CI runners already run one or two.
  workers: process.env.CI ? 1 : 2,
  webServer: {
    command: "npx vite --config tests/browser/fixture/vite.config.ts --port 5199 --strictPort",
    url: "http://localhost:5199/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: "http://localhost:5199" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { args: gl } } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
