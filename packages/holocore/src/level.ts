// The voice level a caller feeds the orb, from 0 to 1, as often as it likes.
// The orb smooths it here, so every voice agent gets the same feel.

/** Seconds to rise about two thirds of the way to a louder level: quick, so speech onsets show. */
export const ATTACK = 0.06;
/** Seconds to fall the same share back: slower, so the orb breathes out rather than flickers. */
export const RELEASE = 0.28;

/** A level as the orb uses it: clamped to 0..1, or undefined when it is not a number (NaN included). */
export function sanitizeLevel(x: unknown): number | undefined {
  if (typeof x !== "number" || Number.isNaN(x)) return undefined;
  return Math.min(1, Math.max(0, x));
}

/** One step of attack and release smoothing toward `target`, over `dt` seconds. */
export function smoothLevel(current: number, target: number, dt: number): number {
  if (!(dt > 0)) return current;
  const tau = target > current ? ATTACK : RELEASE;
  const next = current + (target - current) * (1 - Math.exp(-dt / tau));
  return Math.abs(next - target) < 1e-4 ? target : next;
}
