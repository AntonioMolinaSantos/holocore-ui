/**
 * Installed before the page loads (page.addInitScript): counts what the orb
 * could leave behind. Animation frames scheduled and not yet run or
 * cancelled; event listeners still registered; observers still observing;
 * WebGL contexts not lost.
 */
export function probe(): void {
  const live = new Set<number>();
  const rAF = window.requestAnimationFrame.bind(window);
  const cAF = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    const id = rAF((t) => { live.delete(id); cb(t); });
    live.add(id);
    return id;
  };
  window.cancelAnimationFrame = (id: number): void => { live.delete(id); cAF(id); };

  const fnIds = new WeakMap<object, number>();
  let nextFn = 1;
  const idOf = (f: object) => { let id = fnIds.get(f); if (!id) { id = nextFn++; fnIds.set(f, id); } return id; };
  // WeakMap so a removed target can still be collected; a running count
  // (not an iteration over values) so listeners() holds nothing itself.
  const registered = new WeakMap<EventTarget, Set<string>>();
  let listenerCount = 0;
  const keyOf = (type: string, l: EventListenerOrEventListenerObject, o?: boolean | EventListenerOptions) =>
    `${type}|${idOf(l)}|${typeof o === "boolean" ? o : Boolean(o?.capture)}`;
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, l: EventListenerOrEventListenerObject | null, o?: boolean | AddEventListenerOptions) {
    if (l) {
      let s = registered.get(this);
      if (!s) registered.set(this, (s = new Set()));
      const k = keyOf(type, l, o);
      if (!s.has(k)) { s.add(k); listenerCount += 1; }
    }
    return add.call(this, type, l, o);
  };
  EventTarget.prototype.removeEventListener = function (this: EventTarget, type: string, l: EventListenerOrEventListenerObject | null, o?: boolean | EventListenerOptions) {
    if (l) {
      const s = registered.get(this);
      const k = keyOf(type, l, o);
      if (s?.has(k)) { s.delete(k); listenerCount -= 1; }
    }
    return remove.call(this, type, l, o);
  };

  let observing = 0;
  const count = (Real: typeof ResizeObserver | typeof IntersectionObserver) =>
    class extends (Real as typeof ResizeObserver) {
      private on = false;
      observe(...args: Parameters<ResizeObserver["observe"]>) { if (!this.on) { this.on = true; observing += 1; } return super.observe(...args); }
      disconnect() { if (this.on) { this.on = false; observing -= 1; } return super.disconnect(); }
    };
  window.ResizeObserver = count(window.ResizeObserver);
  window.IntersectionObserver = count(window.IntersectionObserver) as unknown as typeof IntersectionObserver;

  // WeakRef so a lost context's JS wrapper can still be collected: a live
  // browser (WebKit especially) counts a context toward its cap until then,
  // so a probe that held the object itself would be the leak it looks for.
  const contexts: WeakRef<WebGLRenderingContext>[] = [];
  const seen = new WeakSet<WebGLRenderingContext>();
  let created = 0, lost = 0;
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    const ctx = (getContext as (...a: unknown[]) => unknown).call(this, type, ...rest);
    if (ctx && (type === "webgl" || type === "webgl2")) {
      const c = ctx as WebGLRenderingContext;
      // The same canvas can be asked again and hand back the same context
      // (three retries with no attributes to read the failure reason): count
      // it once.
      if (!seen.has(c)) {
        seen.add(c);
        created += 1;
        contexts.push(new WeakRef(c));
        // The original addEventListener, so this listener never shows up in
        // listeners(); it only turns "the context is lost" into a number
        // the test can compare against created() without polling isContextLost().
        add.call(this, "webglcontextlost", () => { lost += 1; }, false);
      }
    }
    return ctx;
  } as typeof getContext;

  (window as unknown as { __probe: unknown }).__probe = {
    pendingFrames: () => live.size,
    listeners: () => listenerCount,
    observing: () => observing,
    liveContexts: () => contexts.reduce((n, ref) => { const c = ref.deref(); return n + (c && !c.isContextLost() ? 1 : 0); }, 0),
    created: () => created,
    lost: () => lost,
  };
}
