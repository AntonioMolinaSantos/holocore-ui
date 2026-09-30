import { expect, test } from "vitest";
import { fpsBetween, fpsLabel, wantsFps } from "../../src/fps";

test("frames per second between two readings of the orb's frame counter", () => {
  expect(fpsBetween({ t: 0, frames: 0 }, { t: 2000, frames: 120 })).toBe(60);
  expect(fpsBetween({ t: 1000, frames: 30 }, { t: 1500, frames: 45 })).toBe(30);
});

test("no rate without time passing or with the counter reset", () => {
  expect(fpsBetween({ t: 1000, frames: 10 }, { t: 1000, frames: 20 })).toBeUndefined();
  expect(fpsBetween({ t: 0, frames: 50 }, { t: 1000, frames: 3 })).toBeUndefined(); // the engine was switched
});

test("no rate across an engine switch, even when the new engine has drawn more frames", () => {
  expect(fpsBetween({ t: 0, frames: 5, engine: "lite" }, { t: 1000, frames: 90, engine: "webgl" })).toBeUndefined();
  expect(fpsBetween({ t: 0, frames: 5, engine: "webgl" }, { t: 1000, frames: 65, engine: "webgl" })).toBe(60);
});

test("the label names the rate and the engine", () => {
  expect(fpsLabel(59.94, "webgl")).toBe("60 fps, webgl");
  expect(fpsLabel(undefined, "lite")).toBe("measuring, lite");
});

test("the counter shows only when the address asks for it", () => {
  expect(wantsFps("?fps")).toBe(true);
  expect(wantsFps("?mode=lite&fps")).toBe(true);
  expect(wantsFps("")).toBe(false);
  expect(wantsFps("?fpsx")).toBe(false);
});
