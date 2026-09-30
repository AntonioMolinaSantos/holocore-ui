import { describe, expect, test } from "vitest";
import { DEFAULT_STATE, configSnippet, installLines, normalizeAccent, toOptions } from "../../src/controls";

describe("the lab's state", () => {
  test("defaults: WebGL, Holo, three calm rings, the preset's own accent", () => {
    expect(DEFAULT_STATE).toEqual({ mode: "webgl", preset: "holo", accent: null, rings: 3, activity: "calm" });
  });

  test("an accent is a six-digit hex, upper case, or nothing", () => {
    expect(normalizeAccent("#ff8800")).toBe("#FF8800");
    expect(normalizeAccent("red")).toBeNull();
    expect(normalizeAccent("#f80")).toBeNull();
  });

  test("becomes the orb's options", () => {
    expect(toOptions({ ...DEFAULT_STATE })).toEqual({ theme: "holo", rings: 3, activity: "calm" });
    expect(toOptions({ ...DEFAULT_STATE, preset: "mono", accent: "#FF0000", rings: 5, activity: "busy" }))
      .toEqual({ theme: { preset: "mono", accent: "#FF0000" }, rings: 5, activity: "busy" });
  });
});

describe("Copy this config", () => {
  test("lite: the snippet that reproduces the screen", () => {
    expect(configSnippet({ mode: "lite", preset: "neutral", accent: null, rings: 2, activity: "calm" })).toBe([
      'import { mount } from "holocore-ui/lite";',
      "",
      'const orb = mount(document.getElementById("orb"), {',
      '  theme: "neutral",',
      "  rings: 2,",
      '  activity: "calm",',
      "});",
      "",
    ].join("\n"));
  });

  test("webgl: the webgl entry, the engine, and an accent over its preset", () => {
    expect(configSnippet({ mode: "webgl", preset: "holo", accent: "#FF0000", rings: 6, activity: "busy" })).toBe([
      'import { mount } from "holocore-ui/webgl";',
      "",
      'const orb = mount(document.getElementById("orb"), {',
      '  engine: "webgl",',
      '  theme: { preset: "holo", accent: "#FF0000" },',
      "  rings: 6,",
      '  activity: "busy",',
      "});",
      "",
    ].join("\n"));
  });
});

describe("the install block", () => {
  test("a release candidate installs from next", () => {
    const l = installLines("0.1.0-rc.1");
    expect(l.npm).toBe("npm i holocore-ui@next");
    expect(l.cdn).toBe('import { mount } from "https://cdn.jsdelivr.net/npm/holocore-ui@next/dist/cdn/holocore-lite.min.js";');
  });

  test("a stable version installs plainly, and the CDN pins its minor line", () => {
    const l = installLines("0.1.0");
    expect(l.npm).toBe("npm i holocore-ui");
    expect(l.cdn).toContain("holocore-ui@0.1/dist/cdn/holocore-lite.min.js");
  });

  test("the example is five lines", () => {
    expect(installLines("0.1.0").example.split("\n")).toHaveLength(5);
  });
});
