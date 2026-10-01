// holocore-ui/react: the orb as a React component. The
// lite orb draws at once. Given a `webgl` loader, and where WebGL is wanted and
// works, the WebGL orb takes over once it has drawn its first frame, so there is
// never an empty frame. This entry never imports the WebGL one itself: a bundler
// follows even a dynamic import, and an app on the lite orb must build without
// three. React is an optional peer dependency.
import { useEffect, useRef, type CSSProperties } from "react";
import { mount as mountLite } from "./lite";
import { chooseEngine, webglAvailable, type EngineRequest } from "./model";
import type { Holocore as Handle, HolocoreOptions } from "./options";

/** Loads the WebGL entry, for example `() => import("holocore-ui/webgl")`. */
export type WebglLoader = () => Promise<{
  mount: (container: HTMLElement, options?: HolocoreOptions & { engine?: EngineRequest }) => Handle;
}>;

export type HolocoreProps = HolocoreOptions & {
  /** Without it the orb stays lite, and three is never needed. */
  webgl?: WebglLoader;
  /** "auto" (the default), "webgl" or "lite". Changing it, or reducedMotion, mounts again. */
  engine?: EngineRequest;
  className?: string;
  style?: CSSProperties;
};

const layer: CSSProperties = { position: "absolute", inset: 0 };

export function Holocore({ engine = "auto", webgl, theme, rings, activity, lit, level, reducedMotion, className, style }: HolocoreProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const liteRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLDivElement>(null);
  const active = useRef<Handle | null>(null);
  const latest = useRef<HolocoreOptions>({ theme, rings, activity, lit, level });
  latest.current = { theme, rings, activity, lit, level };
  const loader = useRef(webgl); // an inline arrow is new on every render: read it, never depend on it
  loader.current = webgl;
  const canUpgrade = Boolean(webgl);

  useEffect(() => {
    const root = rootRef.current, liteEl = liteRef.current, glEl = glRef.current;
    if (!root || !liteEl || !glEl) return;
    let cancelled = false;
    let raf = 0;
    let lite: Handle | null = mountLite(liteEl, { ...latest.current, reducedMotion });
    let gl: Handle | null = null;
    active.current = lite;
    root.dataset.holocoreEngine = "lite";
    // The WebGL layer waits unseen, and ignores the pointer, until it has drawn.
    glEl.style.opacity = "0";
    glEl.style.pointerEvents = "none";

    const load = loader.current;
    if (load && chooseEngine({ requested: engine, webgl: webglAvailable() }) === "webgl") {
      load()
        .then(({ mount }) => {
          if (cancelled) return;
          const started = mount(glEl, { ...latest.current, reducedMotion, engine: "webgl" });
          if (started.engine !== "webgl") { started.destroy(); return; } // refused: the lite orb stays
          gl = started;
          const handover = () => {
            if (cancelled || !gl) return;
            if (gl.frames() === 0) { raf = requestAnimationFrame(handover); return; }
            glEl.style.opacity = "1";
            glEl.style.pointerEvents = "";
            lite?.destroy();
            lite = null;
            active.current = gl;
            gl.update(latest.current); // props that changed while three.js loaded
            root.dataset.holocoreEngine = "webgl";
          };
          raf = requestAnimationFrame(handover);
        })
        .catch((e) => console.warn("[holocore] the WebGL entry failed to load, keeping the lite orb:", e));
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      lite?.destroy();
      gl?.destroy();
      active.current = null;
      delete root.dataset.holocoreEngine;
    };
  }, [engine, reducedMotion, canUpgrade]);

  useEffect(() => {
    active.current?.update({ theme, rings, activity, lit, level });
  }, [theme, rings, activity, lit, level]);

  return (
    <div ref={rootRef} className={className} style={{ position: "relative", width: "100%", height: "100%", ...style }}>
      <div ref={liteRef} style={layer} />
      <div ref={glRef} style={layer} />
    </div>
  );
}
