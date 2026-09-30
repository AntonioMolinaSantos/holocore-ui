// The lite engine: the orb in Canvas 2D with a hand-rolled perspective
// projection. No dependency, so it also ships as one file for a CDN.
import type { EngineStart } from "../engine";
import { smoothLevel } from "../level";
import { atRest, bindTurntable, orbitPoint, ringsFor, step, turntable, type Ring } from "../model";
import { mix, rgba, type Theme } from "../theme";

/** A soft glow, rendered once per colour and stamped, instead of a shadowBlur per bead. */
function sprite(center: string, color: string): HTMLCanvasElement {
  const s = document.createElement("canvas");
  s.width = s.height = 64;
  const g = s.getContext("2d");
  if (!g) return s;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, center);
  r.addColorStop(0.18, color);
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return s;
}

type P = [number, number, number, number]; // screen x, screen y, depth, perspective scale

export const startLite: EngineStart = (stage, canvas, initial, onFrame) => {
  const maybe = canvas.getContext("2d");
  if (!maybe) throw new Error("holocore: this browser gives no 2D canvas context");
  const ctx: CanvasRenderingContext2D = maybe;

  let opts = initial;
  let theme: Theme = opts.theme;
  let dirty = true;
  let visible = true;
  let W = 0, H = 0, dpr = 1, S = 1, cx = 0, cy = 0;
  let t = 0, last = performance.now(), frames = 0, raf = 0;
  let level = opts.still ? opts.level : 0;

  const cam = turntable(0.6, 0.42);
  const unbind = bindTurntable(stage, cam);
  let glowRim = sprite(theme.glow, rgba(theme.rim, 0.9));
  let glowAccent = sprite(theme.glow, rgba(theme.accent, 0.95));

  // Core lattice: points on a Fibonacci sphere.
  const lattice: [number, number, number][] = [];
  for (let i = 0, N = 460; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    lattice.push([Math.cos(a) * r * 0.62, y * 0.62, Math.sin(a) * r * 0.62]);
  }

  let rings: (Ring & { trail: number[] })[] = [];
  const build = () => { rings = ringsFor(opts, 0.95, 0.12).map((o) => ({ ...o, trail: [] })); };
  build();

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = stage.clientWidth; H = stage.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    dirty = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; }, { threshold: 0.05 });
  io.observe(stage);

  function proj(p: [number, number, number]): P {
    const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const x = p[0] * cyw + p[2] * syw, z = -p[0] * syw + p[2] * cyw, y = p[1];
    const y2 = y * cp - z * sp, z2 = y * sp + z * cp;
    const f = 4.4 / (4.4 - z2);
    return [cx + x * S * f, cy - y2 * S * f, z2, f];
  }

  function strokeDepth(pts: P[], front: boolean, color: string, wFront: number, wBack: number, aFront: number, aBack: number) {
    ctx.beginPath();
    let on = false;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (((a[2] + b[2]) / 2 >= 0) === front) {
        if (!on) { ctx.moveTo(a[0], a[1]); on = true; }
        ctx.lineTo(b[0], b[1]);
      } else on = false;
    }
    ctx.strokeStyle = color; ctx.lineWidth = front ? wFront : wBack; ctx.globalAlpha = front ? aFront : aBack;
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  function draw() {
    const lv = level;
    S = Math.min(W, H) * 0.27; cx = W / 2; cy = H / 2 + 4;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Floor: polar grid below the core, light pooled under it, and the projector beam.
    const fy = -1.25, floor = proj([0, fy, 0]);
    const pool = ctx.createRadialGradient(floor[0], floor[1], 0, floor[0], floor[1], S * 1.3);
    pool.addColorStop(0, rgba(theme.core, 0.22 + 0.25 * lv)); pool.addColorStop(1, rgba(theme.core, 0));
    ctx.fillStyle = pool; ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1;
    for (const r of [0.55, 1.05, 1.55, 2.05]) {
      ctx.beginPath();
      for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2, q = proj([Math.cos(a) * r, fy, Math.sin(a) * r]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
      ctx.strokeStyle = rgba(theme.core, 0.28); ctx.setLineDash(r > 2 ? [2, 6] : []); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, p = proj([Math.cos(a) * 0.55, fy, Math.sin(a) * 0.55]), q = proj([Math.cos(a) * 2.05, fy, Math.sin(a) * 2.05]);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.strokeStyle = rgba(theme.core, 0.12); ctx.stroke();
    }
    const top = proj([0, -0.55, 0]);
    const beam = ctx.createLinearGradient(0, floor[1], 0, top[1]);
    beam.addColorStop(0, rgba(theme.rim, 0.14 + 0.12 * lv)); beam.addColorStop(1, rgba(theme.rim, 0));
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = beam; ctx.beginPath();
    ctx.moveTo(floor[0] - S * 0.08, floor[1]); ctx.lineTo(top[0] - S * 0.5, top[1]); ctx.lineTo(top[0] + S * 0.5, top[1]); ctx.lineTo(floor[0] + S * 0.08, floor[1]);
    ctx.fill(); ctx.globalCompositeOperation = "source-over";

    // Equatorial bezel: 120 ticks, a major every 30 degrees.
    const bez: [P, P][] = [];
    for (let i = 0; i < 120; i++) { const a = (i / 120) * Math.PI * 2, r0 = i % 10 === 0 ? 1.6 : 1.66; bez.push([proj([Math.cos(a) * r0, 0, Math.sin(a) * r0]), proj([Math.cos(a) * 1.72, 0, Math.sin(a) * 1.72])]); }
    const bezRing: P[] = [];
    for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2; bezRing.push(proj([Math.cos(a) * 1.72, 0, Math.sin(a) * 1.72])); }
    const drawBezel = (front: boolean) => {
      strokeDepth(bezRing, front, theme.core, 1.2, 0.8, 0.8, 0.22);
      ctx.beginPath();
      for (const [a, b] of bez) if ((a[2] >= 0) === front) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.strokeStyle = front ? theme.rim : theme.core; ctx.globalAlpha = front ? 0.75 : 0.2; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    };

    const paths = rings.map((o) => { const pts: P[] = []; for (let i = 0; i <= 144; i++) pts.push(proj(orbitPoint(o, (i / 144) * Math.PI * 2))); return pts; });
    const beads = rings.map((o) => ({ o, p: proj(orbitPoint(o, t * o.speed + o.phase)) }));
    const drawBead = ({ o, p }: { o: Ring & { trail: number[] }; p: P }) => {
      const s = (o.hot ? 34 : 24) * p[3] * (1 + 0.5 * lv);
      ctx.globalCompositeOperation = "lighter";
      if (o.hot) {
        o.trail.forEach((a, i) => { const q = proj(orbitPoint(o, a)), k = i / o.trail.length; ctx.globalAlpha = k * 0.55; ctx.drawImage(glowAccent, q[0] - 6 * k, q[1] - 6 * k, 12 * k, 12 * k); });
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(o.hot ? glowAccent : glowRim, p[0] - s / 2, p[1] - s / 2, s, s);
      ctx.globalCompositeOperation = "source-over";
    };

    // Back to front: back halves, the core, front halves.
    drawBezel(false);
    paths.forEach((pts, i) => strokeDepth(pts, false, rings[i].hot ? theme.accent : theme.core, 1.6, 1, 0.9, 0.25));
    beads.filter((b) => b.p[2] < 0).forEach(drawBead);

    const c0 = proj([0, 0, 0]), lensR = S * 0.66 * c0[3] * (1 + 0.06 * lv);
    const lens = ctx.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], lensR);
    lens.addColorStop(0, rgba(theme.ground, 0.92)); lens.addColorStop(0.8, rgba(mix(theme.ground, theme.core, 0.15), 0.75)); lens.addColorStop(1, rgba(theme.core, 0.25));
    ctx.fillStyle = lens; ctx.beginPath(); ctx.arc(c0[0], c0[1], lensR, 0, Math.PI * 2); ctx.fill();
    const pulse = 1 + 0.025 * Math.sin(t * 1.6) + 0.1 * lv;
    for (const q of lattice) {
      const p = proj([q[0] * pulse, q[1] * pulse, q[2] * pulse]), front = p[2] >= 0;
      ctx.fillStyle = front ? theme.rim : theme.core; ctx.globalAlpha = front ? 0.35 + (0.5 * p[2]) / 0.62 : 0.12;
      const r = front ? 1.3 * p[3] : 0.8;
      ctx.fillRect(p[0] - r / 2, p[1] - r / 2, r, r);
    }
    ctx.globalAlpha = 1;

    paths.forEach((pts, i) => strokeDepth(pts, true, rings[i].hot ? theme.accent : theme.rim, rings[i].hot ? 2 : 1.4, 1, 0.95, 0.25));
    drawBezel(true);
    beads.filter((b) => b.p[2] >= 0).forEach(drawBead);
  }

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!visible || !W || !H) return;
    // Reduced motion: the level is a still intensity, redrawn when it changes.
    if (opts.still) {
      if (level !== opts.level) { level = opts.level; dirty = true; }
    } else level = smoothLevel(level, opts.level, dt);
    // A still orb draws only when something moves: a drag, a throw settling, a resize, a new option.
    if (opts.still && !dirty && atRest(cam)) return;
    if (!opts.still) {
      t += dt;
      for (const o of rings) if (o.hot) { o.trail.push(t * o.speed + o.phase); if (o.trail.length > 46) o.trail.shift(); }
    }
    step(cam, dt, { frozen: opts.still });
    draw();
    frames += 1;
    onFrame(frames);
    dirty = false;
  }
  raf = requestAnimationFrame(loop);

  return {
    set(next) {
      const rebuild = next.rings !== opts.rings || next.activity !== opts.activity;
      if (next.theme !== opts.theme) {
        theme = next.theme;
        glowRim = sprite(theme.glow, rgba(theme.rim, 0.9));
        glowAccent = sprite(theme.glow, rgba(theme.accent, 0.95));
      }
      opts = next;
      if (rebuild) build();
      dirty = true;
    },
    frames: () => frames,
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      unbind();
    },
  };
};
