// The contract between mountWith and an engine.
import type { Resolved } from "./options";

/** What an engine gives mountWith. `set` receives every option change, already resolved. */
export type EngineHandle = {
  set(next: Resolved): void;
  frames(): number;
  destroy(): void;
};

/**
 * Starts an engine on a stage (the pointer target, sized by its container)
 * and its canvas. `onFrame` is called after every drawn frame with the count
 * so far. Throws when the canvas refuses the engine's context.
 */
export type EngineStart = (
  stage: HTMLElement,
  canvas: HTMLCanvasElement,
  initial: Resolved,
  onFrame: (frames: number) => void,
) => EngineHandle;
