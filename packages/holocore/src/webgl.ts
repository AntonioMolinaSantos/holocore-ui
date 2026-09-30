// holocore-ui/webgl: the full hologram on three.js, a peer
// dependency only this entry loads. Where WebGL is refused, the lite orb draws.
import { startLite } from "./engines/lite";
import { startWebgl } from "./engines/webgl";
import { chooseEngine, webglAvailable, type EngineRequest } from "./model";
import { mountWith } from "./mount";
import type { Holocore, HolocoreOptions } from "./options";

export { chooseEngine, webglAvailable } from "./model";
export type { Activity, EngineName, EngineRequest } from "./model";
export { PRESETS, resolveTheme } from "./theme";
export type { PresetName, Role, Theme, ThemeInput } from "./theme";
export type { Holocore, HolocoreOptions } from "./options";

export type WebglOptions = HolocoreOptions & {
  /** "auto" (the default): WebGL where it works. "webgl": the same, said plainly. "lite": the 2D orb. */
  engine?: EngineRequest;
};

let hasWebgl: boolean | undefined;

/** Draw the orb into `container`, which must have a size. `handle.engine` says which engine is drawing. */
export function mount(container: HTMLElement, options: WebglOptions = {}): Holocore {
  const { engine: requested, ...rest } = options;
  // "lite" is decisive on its own: chooseEngine never looks at webgl for it,
  // so skip the probe rather than open and immediately lose a context for nothing.
  if (requested !== "lite") hasWebgl ??= webglAvailable();
  if (chooseEngine({ requested, webgl: hasWebgl ?? false }) === "webgl") {
    try {
      return mountWith(startWebgl, "webgl", container, rest);
    } catch (e) {
      console.warn("[holocore] WebGL refused a context, drawing the lite orb:", e);
    }
  }
  return mountWith(startLite, "lite", container, rest);
}
