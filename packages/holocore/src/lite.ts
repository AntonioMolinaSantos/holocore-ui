// holocore-ui/lite: the Canvas 2D orb, with no dependency.
import { startLite } from "./engines/lite";
import { mountWith } from "./mount";
import type { Holocore, HolocoreOptions } from "./options";

export { chooseEngine, webglAvailable } from "./model";
export type { Activity, EngineName, EngineRequest } from "./model";
export { PRESETS, resolveTheme } from "./theme";
export type { PresetName, Role, Theme, ThemeInput } from "./theme";
export type { Holocore, HolocoreOptions } from "./options";

/** Draw the lite orb into `container`, which must have a size. The orb makes and owns its canvas. */
export function mount(container: HTMLElement, options?: HolocoreOptions): Holocore {
  return mountWith(startLite, "lite", container, options);
}
