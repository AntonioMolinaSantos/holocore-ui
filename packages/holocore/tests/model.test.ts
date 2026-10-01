import { describe, expect, test } from "vitest";
import {
  AUTO_SPIN, BUSY_SPEED, MAX_RINGS, PITCH_MAX, atRest, chooseEngine, dragBy, hotRings, orbitPoint, releaseVelocity,
  ringsFor, rubberband, step, turntable, webglAvailable,
} from "../src/model";

describe("which engine runs", () => {
  test("auto is WebGL where it works, the lite orb where it does not", () => {
    expect(chooseEngine({ webgl: true })).toBe("webgl");
    expect(chooseEngine({ requested: "auto", webgl: true })).toBe("webgl");
    expect(chooseEngine({ requested: "auto", webgl: false })).toBe("lite");
  });

  test("lite is honoured with WebGL present; webgl without WebGL falls back to lite", () => {
    expect(chooseEngine({ requested: "lite", webgl: true })).toBe("lite");
    expect(chooseEngine({ requested: "webgl", webgl: true })).toBe("webgl");
    expect(chooseEngine({ requested: "webgl", webgl: false })).toBe("lite");
  });

  test("a canvas that refuses both WebGL contexts, or throws, means no WebGL", () => {
    const refuses = () => ({ getContext: () => null }) as unknown as HTMLCanvasElement;
    const throws = () => ({ getContext: () => { throw new Error("blocked"); } }) as unknown as HTMLCanvasElement;
    const webgl1 = () => ({ getContext: (k: string) => (k === "webgl" ? {} : null) }) as unknown as HTMLCanvasElement;
    expect(webglAvailable(refuses)).toBe(false);
    expect(webglAvailable(throws)).toBe(false);
    expect(webglAvailable(webgl1)).toBe(true);
  });

  test("the probe releases the context it opened, since browsers cap live contexts", () => {
    let lost = 0;
    const gl = { getExtension: (n: string) => (n === "WEBGL_lose_context" ? { loseContext: () => { lost += 1; } } : null) };
    const make = () => ({ getContext: (k: string) => (k === "webgl2" ? gl : null) }) as unknown as HTMLCanvasElement;
    expect(webglAvailable(make)).toBe(true);
    expect(lost).toBe(1);
  });
});

describe("rings", () => {
  test("calm: the rings asked for, none lit", () => {
    const r = ringsFor({ rings: 3, activity: "calm" }, 1, 0.1);
    expect(r.map((x) => x.hot)).toEqual([false, false, false]);
    expect(r.map((x) => x.radius)).toEqual([1, 1.1, 1.2]);
  });

  test("busy lights a third of the rings, at least one, and speeds them up", () => {
    expect(hotRings(3, "busy")).toBe(1);
    expect(hotRings(7, "busy")).toBe(3);
    expect(hotRings(0, "busy")).toBe(0);
    expect(hotRings(5, "calm")).toBe(0);
    const calm = ringsFor({ rings: 2, activity: "calm" }, 1, 0.1);
    const busy = ringsFor({ rings: 2, activity: "busy" }, 1, 0.1);
    expect(busy.map((x) => x.hot)).toEqual([true, false]);
    expect(busy[1].speed).toBeCloseTo(calm[1].speed * BUSY_SPEED, 10);
  });

  test("lit names how many rings are lit, whatever the activity, and never more than there are", () => {
    expect(hotRings(5, "calm", 2)).toBe(2);
    expect(hotRings(6, "busy", 0)).toBe(0);
    expect(hotRings(3, "calm", 7)).toBe(3);
    expect(hotRings(6, "busy", null)).toBe(2);
    const r = ringsFor({ rings: 4, activity: "calm", lit: 3 }, 1, 0.1);
    expect(r.map((x) => x.hot)).toEqual([true, true, true, false]);
    expect(r[3].speed).toBeCloseTo(ringsFor({ rings: 4, activity: "calm" }, 1, 0.1)[3].speed, 10);
  });

  test("no rings draws none, and past the cap the drawing stops adding rings", () => {
    expect(ringsFor({ rings: 0, activity: "busy" }, 1, 0.1)).toEqual([]);
    expect(ringsFor({ rings: 40, activity: "calm" }, 1, 0.1)).toHaveLength(MAX_RINGS);
  });

  test("a negative count draws none, a fractional one is floored", () => {
    expect(ringsFor({ rings: -3, activity: "calm" }, 1, 0.1)).toEqual([]);
    expect(ringsFor({ rings: 2.9, activity: "calm" }, 1, 0.1)).toHaveLength(2);
  });

  test("every plane is distinct, so no ring hides behind another", () => {
    const r = ringsFor({ rings: 6, activity: "calm" }, 1, 0.1);
    expect(new Set(r.map((x) => x.inclination.toFixed(3))).size).toBe(6);
  });

  test("a point on a ring stays at the ring's radius, whatever the tilt", () => {
    for (const o of ringsFor({ rings: 5, activity: "busy" }, 1.4, 0.2)) {
      for (const a of [0, 1, 2.5, 4]) expect(Math.hypot(...orbitPoint(o, a))).toBeCloseTo(o.radius, 10);
    }
  });
});

describe("turning", () => {
  test("a drag tracks the pointer 1:1, and past the tilt limit it resists instead of stopping", () => {
    const t = turntable(0, 0.4);
    dragBy(t, 100, 0);
    expect(t.yaw).toBeCloseTo(0.65, 6);
    dragBy(t, 0, 10_000);
    expect(t.pitch).toBeGreaterThan(PITCH_MAX);
    expect(t.pitch - PITCH_MAX).toBeLessThan((10_000 * 0.0065) / 2);
    expect(rubberband(0.5, 0, 1)).toBe(0.5);
  });

  test("a throw keeps its speed on release", () => {
    const v = releaseVelocity([{ x: 0, y: 0, t: 0 }, { x: 50, y: 0, t: 50 }, { x: 100, y: 0, t: 100 }]);
    expect(v.vYaw).toBeCloseTo((100 * 0.0065) / 0.1, 6);
    expect(releaseVelocity([{ x: 0, y: 0, t: 0 }])).toEqual({ vYaw: 0, vPitch: 0 });
  });

  test("after a throw the spin eases back to the slow automatic turn, and the tilt settles without bouncing", () => {
    const t = turntable(0, 0.4);
    t.vYaw = 5;
    t.pitch = 1.0;
    let overshoot = false;
    for (let i = 0; i < 600; i++) {
      step(t, 1 / 60, { frozen: false });
      if (t.pitch < t.rest - 1e-3) overshoot = true;
    }
    expect(t.vYaw).toBeCloseTo(AUTO_SPIN, 2);
    expect(t.pitch).toBeCloseTo(t.rest, 3);
    expect(overshoot).toBe(false);
  });

  test("frozen, the orb comes to rest, and a resting orb needs no new frame", () => {
    const t = turntable(0, 0.4);
    t.vYaw = 2;
    for (let i = 0; i < 1200; i++) step(t, 1 / 60, { frozen: true });
    expect(atRest(t)).toBe(true);
  });

  test("while held, the orb does not move by itself", () => {
    const t = turntable(1, 0.4);
    t.dragging = true;
    t.vYaw = 3;
    step(t, 1, { frozen: false });
    expect(t.yaw).toBe(1);
  });
});
