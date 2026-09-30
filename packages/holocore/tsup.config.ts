import { defineConfig } from "tsup";

// three and React are peers: never bundled into the package entries.
const external = [/^three(\/|$)/, /^react(-dom)?(\/|$)/];

export default defineConfig([
  {
    entry: { lite: "src/lite.ts", webgl: "src/webgl.ts", react: "src/react.tsx" },
    format: ["esm"],
    dts: true,
    splitting: true,
    treeshake: true,
    clean: false,
    target: "es2022",
    outDir: "dist",
    external,
  },
  {
    // One file for a CDN <script type="module">: the lite entry and nothing else.
    entry: { "holocore-lite.min": "src/lite.ts" },
    format: ["esm"],
    dts: false,
    splitting: false,
    minify: true,
    treeshake: true,
    clean: false,
    target: "es2022",
    outDir: "dist/cdn",
  },
]);
