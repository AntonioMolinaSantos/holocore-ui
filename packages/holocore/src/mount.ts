// Every engine starts here: the stage and canvas, the options, the frames
// counter on the container, and a destroy that removes everything it made.
import type { EngineHandle, EngineStart } from "./engine";
import type { EngineName } from "./model";
import { DEFAULTS, resolveOptions, type Holocore, type HolocoreOptions } from "./options";
import { createStage, prefersReducedMotion } from "./stage";

/** How often, at most, the frame count is written to the container. */
const REPORT_MS = 250;

export function mountWith(start: EngineStart, engine: EngineName, container: HTMLElement, options?: HolocoreOptions): Holocore {
  let opts = resolveOptions(options, { ...DEFAULTS, still: prefersReducedMotion() });
  const { stage, canvas, remove } = createStage(container, engine);
  let reportedAt = -Infinity;
  const report = (frames: number) => {
    const now = performance.now();
    if (frames === 1 || now - reportedAt >= REPORT_MS) {
      reportedAt = now;
      container.dataset.holocoreFrames = String(frames);
    }
  };
  let handle: EngineHandle;
  try {
    handle = start(stage, canvas, opts, report);
  } catch (e) {
    remove();
    throw e;
  }
  const running = handle;
  container.dataset.holocoreEngine = engine;
  container.dataset.holocoreFrames = "0";
  let alive = true;
  return {
    engine,
    update(next) {
      if (!alive) return;
      const { reducedMotion: _readAtMountOnly, ...rest } = next as HolocoreOptions;
      opts = resolveOptions(rest, opts);
      running.set(opts);
    },
    frames: () => running.frames(),
    destroy() {
      if (!alive) return;
      alive = false;
      running.destroy();
      remove();
      delete container.dataset.holocoreEngine;
      delete container.dataset.holocoreFrames;
    },
  };
}
