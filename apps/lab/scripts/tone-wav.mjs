/** A sine tone as a 16-bit mono WAV, for the browser tests only: the e2e build's sample and the fake microphone. */
export function toneWav(seconds = 2, hz = 440, rate = 22050) {
  const n = Math.floor(seconds * rate);
  const buf = new Uint8Array(44 + n * 2);
  const v = new DataView(buf.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
  str(0, "RIFF"); v.setUint32(4, buf.length - 8, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 16383), true);
  return buf;
}
