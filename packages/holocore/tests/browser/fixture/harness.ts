import { mount as mountLite, type EngineName, type Holocore, type HolocoreOptions } from "../../../src/lite";
import { mount as mountWebgl, type WebglOptions } from "../../../src/webgl";

const el = document.getElementById("orb") as HTMLElement;
let current: Holocore | null = null;

function mountEngine(engine: EngineName, options: HolocoreOptions): Holocore {
  return engine === "lite" ? mountLite(el, options) : mountWebgl(el, { ...options, engine: "webgl" });
}

const harness = {
  mount(engine: EngineName, options: HolocoreOptions = {}): EngineName {
    current?.destroy();
    current = mountEngine(engine, options);
    return current.engine;
  },
  /** The webgl entry's own mount, with its `engine` option passed through unforced. */
  mountWebglEntry(options: WebglOptions = {}): EngineName {
    current?.destroy();
    current = mountWebgl(el, options);
    return current.engine;
  },
  update(options: HolocoreOptions): void {
    current?.update(options);
  },
  frames: (): number => current?.frames() ?? 0,
  destroy(): void {
    current?.destroy();
    current = null;
  },
  children: (): number => el.childElementCount,
};

(window as unknown as { harness: typeof harness }).harness = harness;
