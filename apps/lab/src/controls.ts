import type { HolocoreOptions, PresetName } from "holocore-ui/lite";

export type Mode = "lite" | "webgl";
export type LabState = { mode: Mode; preset: PresetName; accent: string | null; rings: number; activity: "calm" | "busy" };

export const DEFAULT_STATE: Readonly<LabState> = Object.freeze({ mode: "webgl", preset: "holo", accent: null, rings: 3, activity: "calm" });

/** A colour input's value as an accent: "#RRGGBB" upper case, or null. */
export function normalizeAccent(v: string): string | null {
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null;
}

export function toOptions(s: LabState): HolocoreOptions {
  return { theme: s.accent ? { preset: s.preset, accent: s.accent } : s.preset, rings: s.rings, activity: s.activity };
}

/** The code that reproduces what is on screen. */
export function configSnippet(s: LabState): string {
  const theme = s.accent ? `{ preset: "${s.preset}", accent: "${s.accent}" }` : `"${s.preset}"`;
  return [
    `import { mount } from "holocore-ui/${s.mode}";`,
    "",
    'const orb = mount(document.getElementById("orb"), {',
    ...(s.mode === "webgl" ? ['  engine: "webgl",'] : []),
    `  theme: ${theme},`,
    `  rings: ${s.rings},`,
    `  activity: "${s.activity}",`,
    "});",
    "",
  ].join("\n");
}

/** The install block for the published version: next while it is a release candidate. */
export function installLines(version: string): { npm: string; cdn: string; example: string } {
  const rc = version.includes("-");
  const tag = rc ? "next" : version.split(".").slice(0, 2).join(".");
  return {
    npm: `npm i holocore-ui${rc ? "@next" : ""}`,
    cdn: `import { mount } from "https://cdn.jsdelivr.net/npm/holocore-ui@${tag}/dist/cdn/holocore-lite.min.js";`,
    example: [
      'import { mount } from "holocore-ui/lite";',
      "",
      'const orb = mount(document.getElementById("orb"), { theme: "holo" });',
      "// your voice level, from 0 to 1, as often as you like",
      "orb.update({ level: 0.6 });",
    ].join("\n"),
  };
}
