import { mount as mountLite, type Holocore, type HolocoreOptions } from "holocore-ui/lite";
import type { Mode } from "./controls";

export type LabOrb = { setMode(mode: Mode): Promise<void>; update(options: HolocoreOptions): void; engine(): Mode };

/** The lab's one orb. Switching engines is destroy, then mount, as often as a visitor likes. */
export function createOrb(el: HTMLElement, initial: HolocoreOptions): LabOrb {
  let options: HolocoreOptions = { ...initial };
  let handle: Holocore = mountLite(el, options);
  let request = 0;
  return {
    async setMode(mode) {
      const mine = ++request;
      if (mode === "lite") {
        handle.destroy();
        handle = mountLite(el, options);
        return;
      }
      const { mount } = await import("holocore-ui/webgl");
      if (mine !== request) return; // a later switch won
      handle.destroy();
      handle = mount(el, { ...options, engine: "webgl" });
    },
    update(next) {
      options = { ...options, ...next };
      handle.update(next);
    },
    engine: () => handle.engine,
  };
}
