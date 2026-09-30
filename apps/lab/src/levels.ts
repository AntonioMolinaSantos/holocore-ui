/** Root mean square of a time-domain buffer. */
export function rms(buf: Float32Array): number {
  if (!buf.length) return 0;
  let s = 0;
  for (const x of buf) s += x * x;
  return Math.sqrt(s / buf.length);
}

/** -60 dBFS and below is 0, -12 dBFS and above is 1, linear in decibels between. */
export function levelFromRms(r: number): number {
  if (!(r > 0)) return 0;
  const db = 20 * Math.log10(r);
  return Math.min(1, Math.max(0, (db + 60) / 48));
}
