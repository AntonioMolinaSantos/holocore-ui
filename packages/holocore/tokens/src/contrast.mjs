// WCAG 2.2 contrast ratio between two hex colours: #RRGGBB or #RGB, either case.
// Anything else throws: a NaN ratio would make a guard like `contrast(a, b) < 4.5`
// silently pass.
function channels(hex) {
  if (typeof hex !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
    throw new TypeError(`contrast() takes six-digit or three-digit hex colours, got ${JSON.stringify(hex)}`);
  }
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
  return [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = channels(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
