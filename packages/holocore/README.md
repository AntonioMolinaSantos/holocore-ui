# holocore-ui

A light holographic orb for AI and voice agents. Two modes: **lite**, Canvas
2D with zero dependencies, and **WebGL**, the full hologram on three.js. No
framework required; a React wrapper for those who want it.

Try it in the lab, and read the full guide, at
[github.com/AntonioMolinaSantos/holocore-ui](https://github.com/AntonioMolinaSantos/holocore-ui).

## Install

```bash
npm i holocore-ui          # lite
npm i holocore-ui three    # WebGL too
```

## Use

```js
import { mount } from "holocore-ui/lite";

const orb = mount(document.getElementById("orb"), { theme: "holo", rings: 3 });
orb.update({ level: 0.6 }); // a voice level from 0 to 1, as often as you like
orb.destroy();
```

- `holocore-ui/lite`: the Canvas 2D orb, no dependency.
  Also one file for a CDN: `dist/cdn/holocore-lite.min.js`.
- `holocore-ui/webgl`: `mount(el, { engine: "auto" })`
  draws WebGL where it works and the lite orb elsewhere; `orb.engine` says
  which. Needs `three` (0.170).
- `holocore-ui/react`: `<Holocore theme="holo" level={level} />`,
  the lite orb, with no three. Add
  `webgl={() => import("holocore-ui/webgl")}` for WebGL once it has drawn.

Options: `theme` (`"neutral"`, `"holo"`, `"mono"`, or
`{ preset, core, rim, accent, glow, ground }` in hex), `rings` (0 to 8),
`activity` (`"calm"` or `"busy"`), `level` (0 to 1, smoothed by the orb),
`reducedMotion` (defaults to the visitor's setting). The container needs a
size. The orb never reads the URL and never opens the microphone.

## Tokens

`holocore-ui/tokens` carries the Antonio Molina brand tokens (colour, type,
spacing, radius, shadow) and the Jarvis brand, with a measured WCAG contrast
for every listed text pair:

```js
import { TOKENS, brand, contrast } from "holocore-ui/tokens";
import "holocore-ui/tokens/antonio-molina.css"; // or jarvis.css, tokens.css
```

`brand(name)` throws on an unknown name; `contrast(a, b)` is the WCAG 2.2 ratio
of two hex colours. Tokens only: no mark, wordmark or favicon.

MIT licence.
