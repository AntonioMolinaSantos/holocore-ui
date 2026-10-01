// The WebGL engine: the full hologram through three.js, which only this
// engine imports. A shell of points lit from the rim, a ring and satellite
// per ring option, an equatorial data ring and a projector floor, with bloom.
import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry,
  DoubleSide, Group, InstancedMesh, Line, LineBasicMaterial, LineDashedMaterial, Mesh, MeshBasicMaterial,
  Object3D, PerspectiveCamera, Points, PolarGridHelper, Scene, ShaderMaterial, SphereGeometry, Sprite,
  SpriteMaterial, TorusGeometry, Vector2, Vector3, WebGLRenderer, type Material,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import type { EngineStart } from "../engine";
import { smoothLevel } from "../level";
import { atRest, bindTurntable, ringsFor, step, turntable } from "../model";
import { ROLES, type Role, type Theme } from "../theme";

function circleLine(r: number, color: Color, opacity: number, dashed = false): Line {
  const pts: Vector3[] = [];
  for (let i = 0; i <= 256; i++) { const a = (i / 256) * Math.PI * 2; pts.push(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  const g = new BufferGeometry().setFromPoints(pts);
  const common = { color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false };
  const line = new Line(g, dashed ? new LineDashedMaterial({ ...common, dashSize: 0.04, gapSize: 0.08 }) : new LineBasicMaterial(common));
  if (dashed) line.computeLineDistances();
  return line;
}

function glowTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "#fff"); r.addColorStop(0.25, "rgba(255,255,255,.6)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(c);
}

type Drawable = { geometry?: { dispose(): void }; material?: Material | Material[] };

/** Free every geometry and material under `root`. Textures are freed by their owner. */
function disposeTree(root: Object3D): void {
  root.traverse((o) => {
    const d = o as unknown as Drawable;
    d.geometry?.dispose();
    if (Array.isArray(d.material)) for (const m of d.material) m.dispose();
    else d.material?.dispose();
  });
}

export const startWebgl: EngineStart = (stage, canvas, initial, onFrame) => {
  // Throws when the browser refuses a context; the entry then draws the lite orb.
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  // Cleared to black and composited with mix-blend-mode: screen (stage.ts), so
  // the canvas only adds light to the page behind it.
  renderer.setClearColor(0x000000, 1);

  let opts = initial;
  let dirty = true;
  let visible = true;
  let t = 0, last = performance.now(), frames = 0, raf = 0;
  let level = opts.still ? opts.level : 0;

  // One Color per role. Shader uniforms hold these objects, so repainting them repaints the shaders.
  const col: Record<Role, Color> = { core: new Color(), rim: new Color(), accent: new Color(), glow: new Color(), ground: new Color() };
  const paint = (theme: Theme) => { for (const r of ROLES) col[r].set(theme[r]); };
  paint(opts.theme);
  /** Materials whose colour follows a role, repainted in place on a theme change. */
  const tinted: [{ color: Color }, Role][] = [];
  const tint = <M extends { color: Color }>(m: M, role: Role): M => { m.color.copy(col[role]); tinted.push([m, role]); return m; };

  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 100);
  const cam = turntable(0.5, 0.38);
  const unbind = bindTurntable(stage, cam);

  // The shell: points on a Fibonacci sphere, displaced by noise, brightest at the rim.
  const N = 12000, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  let rand = 1; // deterministic, so the shell is the same on every load
  const rnd = () => ((rand = (rand * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    const shellR = rnd() < 0.14 ? 1.18 + rnd() * 0.5 : 1;
    pos.set([Math.cos(a) * r * shellR, y * shellR, Math.sin(a) * r * shellR], i * 3);
    seed[i] = rnd();
  }
  const shellGeo = new BufferGeometry();
  shellGeo.setAttribute("position", new BufferAttribute(pos, 3));
  shellGeo.setAttribute("seed", new BufferAttribute(seed, 1));
  const shellMat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uLevel: { value: 0 }, uA: { value: col.core }, uB: { value: col.rim }, uC: { value: col.glow }, uPx: { value: 1 } },
    vertexShader: `
      uniform float uTime; uniform float uPx; attribute float seed; varying float vRim; varying float vSeed;
      float n3(vec3 p){ return sin(p.x*2.7+uTime*.6)*sin(p.y*3.1+uTime*.45)*sin(p.z*2.3+uTime*.7); }
      void main(){
        float outer = step(1.05, length(position));
        vec3 p = position * (1.0 + 0.07*n3(position*2.2) + outer*0.05*sin(uTime*.8+seed*6.28));
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        vec3 nrm = normalize(normalMatrix * normalize(position));
        vRim = 1.0 - abs(dot(nrm, normalize(-mv.xyz)));
        vSeed = seed;
        gl_PointSize = (1.2 + 2.2*vRim + outer*0.6) * uPx * (7.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform float uLevel; varying float vRim; varying float vSeed;
      void main(){
        float d = length(gl_PointCoord-0.5); if(d>0.5) discard;
        float a = smoothstep(0.5,0.0,d);
        vec3 c = mix(uA, uB, vRim); c = mix(c, uC, step(0.985, vSeed)*0.8);
        gl_FragColor = vec4(c * (0.18 + 0.9*pow(vRim,2.2)) * (1.0 + 0.8*uLevel), a);
      }`,
  });
  const shell = new Points(shellGeo, shellMat);
  scene.add(shell);

  // A dark lens inside the shell.
  scene.add(new Mesh(new SphereGeometry(0.93, 48, 32), tint(new MeshBasicMaterial({ transparent: true, opacity: 0.86, depthWrite: false }), "ground")));

  // Data ring: instanced bars around the equator.
  const BARS = 200;
  const bars = new InstancedMesh(new BoxGeometry(0.012, 1, 0.012), tint(new MeshBasicMaterial({ transparent: true, opacity: 0.75, blending: AdditiveBlending, depthWrite: false }), "core"), BARS);
  const dummy = new Object3D();
  const ringGroup = new Group();
  const inner = circleLine(2.05, col.core, 0.6), outer = circleLine(2.42, col.rim, 0.45, true);
  tint(inner.material as LineBasicMaterial, "core");
  tint(outer.material as LineDashedMaterial, "rim");
  ringGroup.add(bars, inner, outer);
  scene.add(ringGroup);
  const accArc = new Mesh(new TorusGeometry(2.24, 0.009, 6, 160, Math.PI * 0.42), tint(new MeshBasicMaterial(), "accent"));
  accArc.rotation.x = Math.PI / 2;
  scene.add(accArc);

  // Floor and projector. The grid bakes its colours into its geometry, so a theme change rebuilds it.
  const makeFloor = (): PolarGridHelper => {
    const f = new PolarGridHelper(3.2, 16, 6, 96, col.core, col.core);
    f.position.y = -1.75;
    const m = f.material as LineBasicMaterial;
    m.transparent = true; m.opacity = 0.22; m.depthWrite = false;
    scene.add(f);
    return f;
  };
  let floor = makeFloor();
  const beam = new Mesh(new CylinderGeometry(1.15, 0.12, 1.0, 64, 1, true), new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
    uniforms: { uC: { value: col.rim } },
    vertexShader: `varying float vY; void main(){ vY = position.y + 0.5; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uC; varying float vY; void main(){ gl_FragColor = vec4(uC, 0.10*(1.0-vY)); }`,
  }));
  beam.position.y = -1.25;
  scene.add(beam);

  // Rings: an orbit each, a satellite and a trail.
  const TRAIL = 64;
  const glow = glowTexture();
  const orbitRoot = new Group();
  scene.add(orbitRoot);
  type Sat = { r: number; speed: number; phase: number; sat: Sprite; trail: Line; tpos: Float32Array; tcol: Float32Array; color: Color };
  let sats: Sat[] = [];
  function build() {
    disposeTree(orbitRoot);
    orbitRoot.clear();
    sats = ringsFor(opts, 1.45, 0.16).map((o) => {
      const color = o.hot ? col.accent : col.rim;
      const plane = new Group();
      plane.rotation.x = o.inclination; plane.rotation.y = o.node;
      plane.add(circleLine(o.radius, o.hot ? col.accent : col.core, o.hot ? 0.8 : 0.4));
      const sat = new Sprite(new SpriteMaterial({ map: glow, color, blending: AdditiveBlending, depthWrite: false }));
      sat.scale.setScalar(o.hot ? 0.34 : 0.24);
      plane.add(sat);
      const tpos = new Float32Array(TRAIL * 3), tcol = new Float32Array(TRAIL * 3);
      const tg = new BufferGeometry();
      tg.setAttribute("position", new BufferAttribute(tpos, 3));
      tg.setAttribute("color", new BufferAttribute(tcol, 3));
      const trail = new Line(tg, new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false }));
      plane.add(trail);
      orbitRoot.add(plane);
      return { r: o.radius, speed: o.speed, phase: o.phase, sat, trail, tpos, tcol, color };
    });
  }
  build();

  const composer = new EffectComposer(renderer);
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.72, 0.45, 0.22); // threshold high enough that dim points do not haze
  const output = new OutputPass();
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(bloom);
  composer.addPass(output);

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight, px = Math.min(devicePixelRatio || 1, 1.75);
    if (!w || !h) return;
    renderer.setPixelRatio(px); renderer.setSize(w, h, false);
    composer.setPixelRatio(px); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    shellMat.uniforms.uPx.value = px * (h / 620);
    dirty = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();
  const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; }, { threshold: 0.05 });
  io.observe(stage);

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!visible) return;
    // Reduced motion: the level is a still intensity, redrawn when it changes.
    if (opts.still) {
      if (level !== opts.level) { level = opts.level; dirty = true; }
    } else level = smoothLevel(level, opts.level, dt);
    if (opts.still && !dirty && atRest(cam)) return; // a still orb draws only when something changes
    if (!opts.still) t += dt;
    step(cam, dt, { frozen: opts.still });
    // A square stage needs the camera further back than a wide one to keep the data ring in frame.
    const d = camera.aspect < 1.2 ? 9.4 : 8.2, cp = Math.cos(cam.pitch);
    camera.position.set(Math.sin(cam.yaw) * cp * d, Math.sin(cam.pitch) * d, Math.cos(cam.yaw) * cp * d);
    camera.lookAt(0, -0.15, 0);
    shellMat.uniforms.uTime.value = t;
    shellMat.uniforms.uLevel.value = level;
    shell.scale.setScalar(1 + 0.1 * level);
    bloom.strength = 0.72 + 0.8 * level;
    ringGroup.rotation.y = -t * 0.12;
    accArc.rotation.z = t * 0.35;
    for (let i = 0; i < BARS; i++) {
      const a = (i / BARS) * Math.PI * 2;
      const h = (0.04 + 0.22 * Math.pow(Math.abs(Math.sin(i * 0.37 + t * 1.3) * Math.sin(i * 0.11 - t * 0.7)), 1.6)) * (1 + 2.5 * level);
      dummy.position.set(Math.cos(a) * 2.2, h / 2 - 0.02, Math.sin(a) * 2.2);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      bars.setMatrixAt(i, dummy.matrix);
    }
    bars.instanceMatrix.needsUpdate = true;
    for (const s of sats) {
      const a = t * s.speed + s.phase;
      s.sat.position.set(Math.cos(a) * s.r, 0, Math.sin(a) * s.r);
      for (let k = 0; k < TRAIL; k++) {
        const b = a - k * 0.035, f = Math.pow(1 - k / TRAIL, 2);
        s.tpos.set([Math.cos(b) * s.r, 0, Math.sin(b) * s.r], k * 3);
        s.tcol.set([s.color.r * f, s.color.g * f, s.color.b * f], k * 3);
      }
      (s.trail.geometry.attributes.position as BufferAttribute).needsUpdate = true;
      (s.trail.geometry.attributes.color as BufferAttribute).needsUpdate = true;
    }
    composer.render();
    frames += 1;
    onFrame(frames);
    dirty = false;
  }
  raf = requestAnimationFrame(loop);

  return {
    set(next) {
      const themeChanged = next.theme !== opts.theme;
      const ringsChanged = next.rings !== opts.rings || next.activity !== opts.activity || next.lit !== opts.lit;
      opts = next;
      if (themeChanged) {
        paint(opts.theme);
        for (const [m, r] of tinted) m.color.copy(col[r]);
        scene.remove(floor);
        disposeTree(floor);
        floor = makeFloor();
      }
      if (themeChanged || ringsChanged) build();
      dirty = true;
    },
    frames: () => frames,
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      unbind();
      disposeTree(scene);
      glow.dispose();
      bloom.dispose();
      output.dispose();
      composer.dispose();
      renderer.dispose();
      // dispose() frees resources but leaves the context alive; the lab switches engines at will.
      renderer.forceContextLoss();
    },
  };
};
