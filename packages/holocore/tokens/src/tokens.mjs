// The one source of the brand values. css/*.css is generated from it
// (scripts/build.mjs), and every consumer reads it or that CSS.
// antonio-molina: the advisory brand, approved 25 Sept 2026.
// jarvis: approved 25 Sept 2026. The snapshot in tests/jarvis.snapshot.json
// fails any change to it that does not update the snapshot too.
// Tokens only: no mark, wordmark or favicon (the package is public).

function freeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === "object") freeze(v);
  return Object.freeze(o);
}

export const TOKENS = freeze({
  "antonio-molina": {
    color: {
      navy: "#16283F", orange: "#DD5A1E", "orange-text": "#B4471A", ink: "#1F2733", muted: "#566172",
      page: "#FCFCFD", surface: "#F3F4F7", rule: "#E6E8EC", white: "#FFFFFF",
      "on-navy": "#E8EEF6", "on-navy-muted": "#B7C3D3", "on-navy-accent": "#F0A276",
      disabled: "#C9CFD8", "field-border": "#CDD3DB", placeholder: "#7A8390",
    },
    font: {
      display: ["Bricolage Grotesque", "Inter", "Noto Sans Thai", "Segoe UI", "sans-serif"],
      body: ["Inter", "Noto Sans Thai", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
    },
    weight: { display: [600, 700, 800], body: [400, 500, 600, 700] },
    size: { name: 84, "name-mid": 68, "name-phone": 52, h2: 40, "h2-phone": 32, headline: 30, h3: 21, lead: 20, body: 17, "body-phone": 16, small: 15, xsmall: 14, label: 13 },
    space: [4, 8, 12, 16, 24, 32, 48, 64, 96],
    radius: { sm: 8, md: 10, lg: 16, pill: 999 },
    shadow: { card: "0 1px 2px rgba(22,40,63,.04), 0 12px 32px rgba(22,40,63,.07)", focus: "0 0 0 3px #FFFFFF, 0 0 0 5px #16283F" },
    text: [["navy", "page"], ["ink", "page"], ["muted", "page"], ["muted", "surface"], ["orange-text", "page"], ["orange-text", "surface"], ["on-navy", "navy"], ["on-navy-muted", "navy"], ["on-navy-accent", "navy"]],
    display: [["orange", "page"], ["orange", "white"]],
  },
  jarvis: {
    color: {
      p: "#14A0E6", p2: "#5CC8FF", acc: "#DD5A1E", acc2: "#F0A276",
      ground: "#030B14", "surface-1": "#071A2A", "surface-2": "#0A2438", "surface-3": "#0E2F48",
      text: "#E8F4FB", "text-muted": "#8FB5C9", "text-subtle": "#6F93A8", "on-accent": "#030B14",
    },
    font: {
      body: ["Geist", "Segoe UI", "system-ui", "sans-serif"], mono: ["Geist Mono", "Consolas", "ui-monospace", "monospace"],
      display: ["Orbitron", "Geist", "sans-serif"], title: ["Titillium Web", "Geist", "sans-serif"],
    },
    weight: { body: [400, 500, 600], mono: [400, 500], display: [500, 600, 700], title: [600, 700] },
    size: { h1: 36, h2: 24, h3: 19, body: 14, label: 12, tag: 11, figure: 28 },
    space: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
    radius: { sm: 2, md: 4, chamfer: 12, "chamfer-sm": 8 },
    shadow: { float: "0 12px 32px rgba(0, 0, 0, 0.45)", focus: "0 0 0 2px #030B14, 0 0 0 4px #5CC8FF" },
    text: [["text", "surface-1"], ["text-muted", "surface-1"], ["text-subtle", "surface-1"], ["acc2", "surface-1"], ["p2", "surface-1"], ["text", "ground"], ["text-muted", "surface-2"], ["on-accent", "p2"]],
    display: [["acc", "surface-1"]],
  },
});
