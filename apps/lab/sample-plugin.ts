import { existsSync } from "node:fs";
import type { Plugin } from "vite";
import { toneWav } from "./scripts/tone-wav.mjs";

export const E2E_TONE = "/e2e-tone.wav";

/**
 * The sample in Antonio's voice. A production build without the clip fails,
 * so the lab never ships a silent or missing sample. The dev server shows the
 * button disabled ("Sample coming soon"). The e2e build plays a generated
 * tone instead, and never ships.
 */
export function samplePlugin(clipPath: string, mode: string, command: "build" | "serve"): Plugin {
  const present = existsSync(clipPath);
  const e2e = mode === "e2e";
  return {
    name: "lab-sample",
    config: () => ({
      define: {
        __SAMPLE_PRESENT__: JSON.stringify(e2e || present),
        __SAMPLE_SRC__: JSON.stringify(e2e ? E2E_TONE : "/sample.mp3"),
      },
    }),
    buildStart() {
      if (command === "build" && !e2e && !present) {
        this.error(`${clipPath} is missing: record the sample before building the lab for production.`);
      }
    },
    generateBundle() {
      // Longer than the default: the WebGL sample test needs the tone to still
      // be playing while its peak-level poll runs, within the caption's 15s timeout.
      if (e2e) this.emitFile({ type: "asset", fileName: E2E_TONE.slice(1), source: toneWav(6) });
    },
  };
}
