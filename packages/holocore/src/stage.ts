// The element mount draws into: a stage that fills the container and takes
// the pointer, and one canvas. mount owns both, since a canvas that has given
// a 2D context can never give a WebGL one.
import type { EngineName } from "./model";

export type Stage = { stage: HTMLDivElement; canvas: HTMLCanvasElement; remove(): void };

const MASK = "radial-gradient(closest-side, #000 68%, transparent 100%)";

export function createStage(container: HTMLElement, engine: EngineName): Stage {
  const stage = document.createElement("div");
  stage.dataset.holocoreStage = engine;
  Object.assign(stage.style, {
    position: "relative", width: "100%", height: "100%", cursor: "grab",
    touchAction: "pan-y", userSelect: "none", webkitUserSelect: "none",
  });
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block" });
  // The canvas fades out at its edge, so the orb never sits in a visible square.
  canvas.style.setProperty("mask-image", MASK);
  canvas.style.setProperty("-webkit-mask-image", MASK);
  // WebGL clears to black and adds its light to the page behind it.
  if (engine === "webgl") canvas.style.setProperty("mix-blend-mode", "screen");
  stage.append(canvas);
  container.append(stage);
  return { stage, canvas, remove: () => stage.remove() };
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
