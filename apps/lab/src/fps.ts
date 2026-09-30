// The lab's frame rate counter, shown only with ?fps in the address: a way to
// read the orb's real speed on a real device. It reads the orb's own frame
// counter (data-holocore-frames) twice a second and draws nothing else.

export type Reading = { t: number; frames: number; engine?: string };

/** Frames per second between two readings; undefined when no time passed, the counter restarted or the engine changed. */
export function fpsBetween(a: Reading, b: Reading): number | undefined {
  if (a.engine !== b.engine) return undefined;
  const dt = b.t - a.t;
  const df = b.frames - a.frames;
  if (dt <= 0 || df < 0) return undefined;
  return (df * 1000) / dt;
}

export function fpsLabel(fps: number | undefined, engine: string): string {
  return fps === undefined ? `measuring, ${engine}` : `${Math.round(fps)} fps, ${engine}`;
}

export function wantsFps(search: string): boolean {
  return new URLSearchParams(search).has("fps");
}

const WINDOW_MS = 2000;

/** Adds the counter next to the orb and keeps it current. Returns a stop function. */
export function mountFpsMeter(orbEl: HTMLElement): () => void {
  const meter = document.createElement("p");
  meter.id = "fps";
  meter.className = "fps";
  meter.setAttribute("aria-live", "off");
  orbEl.insertAdjacentElement("afterend", meter);
  const read = (): Reading => ({ t: performance.now(), frames: Number(orbEl.dataset.holocoreFrames ?? 0), engine: orbEl.dataset.holocoreEngine });
  let readings: Reading[] = [read()];
  meter.textContent = fpsLabel(undefined, orbEl.dataset.holocoreEngine ?? "starting");
  const timer = setInterval(() => {
    const now = read();
    const last = readings[readings.length - 1];
    if (!last || now.engine !== last.engine || now.frames < last.frames) readings = []; // a new engine, or a restart
    readings.push(now);
    while (readings.length > 1 && now.t - readings[0].t > WINDOW_MS) readings.shift();
    const rate = readings.length > 1 ? fpsBetween(readings[0], now) : undefined;
    meter.textContent = fpsLabel(rate, orbEl.dataset.holocoreEngine ?? "starting");
  }, 500);
  return () => { clearInterval(timer); meter.remove(); };
}
