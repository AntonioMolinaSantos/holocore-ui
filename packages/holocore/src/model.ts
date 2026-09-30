// The orb's model, shared by both engines: which engine runs, where each ring
// orbits, and how the orb turns under the pointer. No renderer, and no DOM
// outside bindTurntable and webglAvailable, so every rule is unit tested.

export type EngineName = "lite" | "webgl";
/** What a caller may ask for. "auto" is WebGL where it works, the lite orb elsewhere. */
export type EngineRequest = "auto" | EngineName;
/** "busy" lights some rings in the accent colour and speeds them up. */
export type Activity = "calm" | "busy";

/**
 * Which engine runs. The request and WebGL support are the only inputs: the
 * package never reads the URL. "webgl" where WebGL is refused draws the lite
 * orb rather than nothing.
 */
export function chooseEngine(opts: { requested?: EngineRequest; webgl: boolean }): EngineName {
  if (opts.requested === "lite") return "lite";
  return opts.webgl ? "webgl" : "lite";
}

/** Whether this browser can open a WebGL context. The probe's own context is released at once. */
export function webglAvailable(make: () => HTMLCanvasElement = () => document.createElement("canvas")): boolean {
  try {
    const c = make();
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    // Browsers cap live contexts, and the orb opens its own: this one must not count.
    gl.getExtension?.("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export type Ring = {
  index: number;
  /** Radius in scene units, the core being 1. */
  radius: number;
  /** Tilt of the ring's plane, radians. */
  inclination: number;
  /** Rotation of the plane around the vertical axis, radians. */
  node: number;
  /** Angular speed of its bead, radians per second. */
  speed: number;
  phase: number;
  /** Drawn in the accent colour, with a trail. */
  hot: boolean;
};

/** Beyond this many, rings stop reading as separate things. */
export const MAX_RINGS = 8;
/** How much faster the beads run when the orb is busy. */
export const BUSY_SPEED = 1.8;

/** Lit rings: none when calm; a third of them, at least one, when busy. */
export function hotRings(n: number, activity: Activity): number {
  return activity === "busy" && n > 0 ? Math.max(1, Math.ceil(n / 3)) : 0;
}

/** One ring per count, each on its own plane so none hides another. */
export function ringsFor(o: { rings: number; activity: Activity }, base: number, step: number): Ring[] {
  const n = Math.max(0, Math.min(MAX_RINGS, Math.floor(o.rings)));
  const hot = hotRings(n, o.activity);
  const speedK = o.activity === "busy" ? BUSY_SPEED : 1;
  return Array.from({ length: n }, (_, i) => ({
    index: i,
    radius: base + i * step,
    inclination: ((18 + (i * 128) / Math.max(1, n)) * Math.PI) / 180,
    node: i * 2.399, // the golden angle, so planes spread without clumping
    speed: (0.55 - i * 0.05) * speedK,
    phase: i * 1.9,
    hot: i < hot,
  }));
}

/** A point on a ring at angle `a`, in world space. */
export function orbitPoint(o: Ring, a: number): [number, number, number] {
  let x = Math.cos(a) * o.radius;
  let y = 0;
  let z = Math.sin(a) * o.radius;
  const ci = Math.cos(o.inclination), si = Math.sin(o.inclination);
  [y, z] = [y * ci - z * si, y * si + z * ci];
  const cn = Math.cos(o.node), sn = Math.sin(o.node);
  [x, z] = [x * cn + z * sn, -x * sn + z * cn];
  return [x, y, z];
}

// ---------------------------------------------------------------- turning

export type Turntable = {
  yaw: number;
  pitch: number;
  /** The tilt the orb springs back to. */
  rest: number;
  /** Angular velocities, radians per second. */
  vYaw: number;
  vPitch: number;
  dragging: boolean;
};

export const DRAG_GAIN = 0.0065; // radians per pixel
export const AUTO_SPIN = 0.16; // radians per second when nobody is touching it
export const PITCH_MIN = -0.15;
export const PITCH_MAX = 1.1;

export function turntable(yaw = 0.5, pitch = 0.4): Turntable {
  return { yaw, pitch, rest: pitch, vYaw: 0, vPitch: 0, dragging: false };
}

/** Past a limit the orb still follows, at a quarter of the pointer: it resists rather than stops. */
export function rubberband(x: number, lo: number, hi: number): number {
  if (x < lo) return lo - (lo - x) * 0.25;
  if (x > hi) return hi + (x - hi) * 0.25;
  return x;
}

/** 1:1 tracking while dragging. */
export function dragBy(t: Turntable, dx: number, dy: number): void {
  t.yaw += dx * DRAG_GAIN;
  t.pitch = rubberband(t.pitch + dy * DRAG_GAIN, PITCH_MIN, PITCH_MAX);
}

export type Sample = { x: number; y: number; t: number };

/** Release velocity from the last few pointer samples, so a throw keeps its speed. */
export function releaseVelocity(samples: Sample[]): { vYaw: number; vPitch: number } {
  if (samples.length < 2) return { vYaw: 0, vPitch: 0 };
  const a = samples[0], b = samples[samples.length - 1];
  const dt = Math.max(16, b.t - a.t) / 1000;
  return { vYaw: ((b.x - a.x) * DRAG_GAIN) / dt, vPitch: ((b.y - a.y) * DRAG_GAIN) / dt };
}

/**
 * Advance the orb by `dt` seconds when nobody holds it. Yaw eases from the
 * throw back to the slow automatic spin (to zero when frozen). Pitch carries
 * the throw, then returns to rest on a critically damped spring: no bounce,
 * settled in about a second.
 */
export function step(t: Turntable, dt: number, opts: { frozen: boolean }): void {
  if (t.dragging) return;
  const target = opts.frozen ? 0 : AUTO_SPIN;
  t.vYaw += (target - t.vYaw) * (1 - Math.exp(-dt * 1.4));
  t.yaw += t.vYaw * dt;
  const k = 48, d = 2 * Math.sqrt(k);
  t.vPitch += (-k * (t.pitch - t.rest) - d * t.vPitch) * dt;
  t.pitch += t.vPitch * dt;
}

/** Nothing is moving: a frozen orb at rest needs no new frame. */
export function atRest(t: Turntable): boolean {
  return !t.dragging && Math.abs(t.vYaw) < 1e-3 && Math.abs(t.vPitch) < 1e-3 && Math.abs(t.pitch - t.rest) < 1e-3;
}

/** Wire pointer events on `el` to the turntable. Returns the unbinding function. */
export function bindTurntable(el: HTMLElement, t: Turntable): () => void {
  let samples: Sample[] = [];
  const down = (e: PointerEvent) => {
    try { el.setPointerCapture(e.pointerId); } catch { /* a synthetic event has no active pointer */ }
    t.dragging = true;
    t.vYaw = t.vPitch = 0;
    samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    el.style.cursor = "grabbing";
  };
  const move = (e: PointerEvent) => {
    if (!t.dragging) return;
    const last = samples[samples.length - 1];
    dragBy(t, e.clientX - last.x, e.clientY - last.y);
    samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (samples.length > 6) samples.shift();
  };
  const up = () => {
    if (!t.dragging) return;
    t.dragging = false;
    Object.assign(t, releaseVelocity(samples));
    el.style.cursor = "grab";
  };
  const events: [string, (e: PointerEvent) => void][] = [
    ["pointerdown", down], ["pointermove", move], ["pointerup", up], ["pointercancel", up], ["lostpointercapture", up],
  ];
  for (const [type, fn] of events) el.addEventListener(type, fn as EventListener);
  return () => {
    for (const [type, fn] of events) el.removeEventListener(type, fn as EventListener);
  };
}
