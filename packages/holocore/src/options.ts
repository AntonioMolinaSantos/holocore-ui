// The options a caller passes to mount and update, and what they resolve to.
import { sanitizeLevel } from "./level";
import { MAX_RINGS, type Activity, type EngineName } from "./model";
import { PRESETS, resolveTheme, sameTheme, type Theme, type ThemeInput } from "./theme";

export type HolocoreOptions = {
  /** A preset name ("neutral", "holo", "mono"), or roles over a preset. Default: "neutral". */
  theme?: ThemeInput;
  /** Rings around the core, 0 to 8. Default: 3. */
  rings?: number;
  /** "busy" lights a third of the rings in the accent colour and speeds them up. Default: "calm". */
  activity?: Activity;
  /** The voice level, 0 to 1, smoothed by the orb. Default: 0. */
  level?: number;
  /** A still orb: no spin, and the level drawn as a still intensity. Default: prefers-reduced-motion. Read at mount only. */
  reducedMotion?: boolean;
};

export type Resolved = {
  readonly theme: Theme;
  readonly rings: number;
  readonly activity: Activity;
  readonly level: number;
  readonly still: boolean;
};

export const DEFAULTS: Resolved = Object.freeze({ theme: PRESETS.neutral, rings: 3, activity: "calm", level: 0, still: false });

/** `input` over `prev`. Anything invalid keeps the previous value; a theme equal by value keeps the previous object. */
export function resolveOptions(input: HolocoreOptions | undefined, prev: Resolved = DEFAULTS): Resolved {
  const o = input ?? {};
  const theme = o.theme === undefined ? prev.theme : resolveTheme(o.theme, prev.theme);
  return {
    theme: sameTheme(theme, prev.theme) ? prev.theme : theme,
    rings: typeof o.rings === "number" && Number.isFinite(o.rings) ? Math.max(0, Math.min(MAX_RINGS, Math.floor(o.rings))) : prev.rings,
    activity: o.activity === "calm" || o.activity === "busy" ? o.activity : prev.activity,
    level: sanitizeLevel(o.level) ?? prev.level,
    still: typeof o.reducedMotion === "boolean" ? o.reducedMotion : prev.still,
  };
}

/** What mount returns. */
export type Holocore = {
  /** The engine drawing: "webgl" can become "lite" where WebGL is refused. */
  readonly engine: EngineName;
  /** Change any option but reducedMotion. */
  update(options: Omit<HolocoreOptions, "reducedMotion">): void;
  /** Frames drawn so far. */
  frames(): number;
  /** Stop every frame, listener and observer, free every GPU resource, and remove the canvas. */
  destroy(): void;
};
