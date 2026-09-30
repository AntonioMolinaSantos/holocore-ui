import { describe, expect, test } from "vitest";
import { TOKENS } from "../../tokens/src/tokens.mjs";
import { contrast } from "../../tokens/src/contrast.mjs";

describe.each(Object.entries(TOKENS))("brand %s", (name, b) => {
  test("is frozen, all the way down", () => {
    expect(Object.isFrozen(b)).toBe(true);
    expect(Object.isFrozen(b.color)).toBe(true);
    expect(() => { b.color.navy = "#000000"; }).toThrow();
    expect(Object.isFrozen(b.space)).toBe(true);
    expect(() => { b.space.push(999); }).toThrow();
    expect(Object.isFrozen(b.text[0])).toBe(true);
  });

  test("colours are six-digit hex", () => {
    for (const [k, v] of Object.entries(b.color)) expect(v, k).toMatch(/^#[0-9A-F]{6}$/);
  });

  test("every text pair holds 4.5:1", () => {
    for (const [fg, bg] of b.text) expect(contrast(b.color[fg], b.color[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  test("every display pair holds 3:1", () => {
    for (const [fg, bg] of b.display) expect(contrast(b.color[fg], b.color[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
  });

  test("spacing sits on the 4px scale, ascending", () => {
    for (const s of b.space) expect(s % 4, String(s)).toBe(0);
    expect([...b.space].sort((x, y) => x - y)).toEqual(b.space);
  });

  test("every font stack ends in a generic family", () => {
    for (const [k, stack] of Object.entries(b.font)) expect(["serif", "sans-serif", "monospace", "system-ui"], k).toContain(stack.at(-1));
  });
});

test("the Antonio Molina values are the approved Modernise values", () => {
  const c = TOKENS["antonio-molina"].color;
  expect([c.navy, c.orange, c["orange-text"], c.ink, c.muted, c.page, c.surface]).toEqual(["#16283F", "#DD5A1E", "#B4471A", "#1F2733", "#566172", "#FCFCFD", "#F3F4F7"]);
  expect(TOKENS["antonio-molina"].font.display[0]).toBe("Bricolage Grotesque");
});

test("orange is display-only: it fails body contrast on the page", () => {
  const c = TOKENS["antonio-molina"].color;
  expect(contrast(c.orange, c.page)).toBeLessThan(4.5);
});
