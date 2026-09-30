import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { E2E_TONE, samplePlugin } from "../../sample-plugin";
import { toneWav } from "../../scripts/tone-wav.mjs";

type Hook = (this: unknown, ...args: unknown[]) => unknown;
const missing = path.join(tmpdir(), "lab-no-such-dir", "sample.mp3");
const present = (() => {
  const f = path.join(mkdtempSync(path.join(tmpdir(), "lab-sample-")), "sample.mp3");
  writeFileSync(f, "clip");
  return f;
})();
const failing = { error(m: string): never { throw new Error(m); } };
const defines = (p: ReturnType<typeof samplePlugin>) => ((p.config as unknown as () => { define: Record<string, string> })()).define;

describe("the sample", () => {
  test("a production build without the clip fails", () => {
    const p = samplePlugin(missing, "production", "build");
    expect(() => (p.buildStart as unknown as Hook).call(failing, {})).toThrow(/sample\.mp3 is missing/);
  });

  test("a production build with the clip passes and plays it", () => {
    const p = samplePlugin(present, "production", "build");
    expect(() => (p.buildStart as unknown as Hook).call(failing, {})).not.toThrow();
    expect(defines(p)).toEqual({ __SAMPLE_PRESENT__: "true", __SAMPLE_SRC__: '"/sample.mp3"' });
  });

  test("the dev server without the clip runs, with the button disabled", () => {
    const p = samplePlugin(missing, "development", "serve");
    expect(() => (p.buildStart as unknown as Hook).call(failing, {})).not.toThrow();
    expect(defines(p).__SAMPLE_PRESENT__).toBe("false");
  });

  test("the e2e build plays a generated tone and emits it", () => {
    const p = samplePlugin(missing, "e2e", "build");
    expect(() => (p.buildStart as unknown as Hook).call(failing, {})).not.toThrow();
    expect(defines(p)).toEqual({ __SAMPLE_PRESENT__: "true", __SAMPLE_SRC__: JSON.stringify(E2E_TONE) });
    const emitFile = vi.fn();
    (p.generateBundle as unknown as Hook).call({ emitFile }, {}, {}, false);
    // Long enough that the WebGL sample test's peak-level poll still finds it playing.
    expect(emitFile).toHaveBeenCalledWith({ type: "asset", fileName: "e2e-tone.wav", source: toneWav(6) });
  });

  test("the tone is a WAV of the length asked", () => {
    const wav = toneWav(1, 440, 8000);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(wav.slice(8, 12))).toBe("WAVE");
    expect(wav.length).toBe(44 + 8000 * 2);
  });
});
