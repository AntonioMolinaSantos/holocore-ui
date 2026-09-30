import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { toneWav } from "./scripts/tone-wav.mjs";

// The fake microphone plays this tone, so a hold always has a level to show.
const tone = path.join(tmpdir(), "holocore-lab-tone.wav");
writeFileSync(tone, toneWav(10));

// Headless Chromium draws WebGL on SwiftShader, which recent versions only use when asked.
const gl = ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"];
const base = process.env.LAB_BASE_URL ?? "http://localhost:4317";
const notVoice = /voice\.spec\.ts$/;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  // The orb draws WebGL in software here: more than two browsers at once starve each other's
  // frames, and the sample tests then miss the tone's window. CI runners already run one or two.
  workers: process.env.CI ? 1 : 2,
  // Live link checks run only when asked (LAB_LIVE=1), against the public web.
  grepInvert: process.env.LAB_LIVE ? undefined : /@live/,
  webServer: process.env.LAB_BASE_URL
    ? undefined
    : { command: "npm run build:e2e && npm run preview:e2e", url: base, reuseExistingServer: !process.env.CI, timeout: 300_000 },
  use: { baseURL: base },
  projects: [
    { name: "chromium-1440", testIgnore: notVoice, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions: { args: gl } } },
    { name: "chromium-390", testIgnore: notVoice, use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true, launchOptions: { args: gl } } },
    { name: "webkit-1440", testIgnore: notVoice, use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
    { name: "webkit-390", testIgnore: notVoice, use: { ...devices["iPhone 13"] } },
    {
      name: "chromium-mic",
      testMatch: notVoice,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        permissions: ["microphone"],
        launchOptions: { args: [...gl, "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${tone}`] },
      },
    },
  ],
});
