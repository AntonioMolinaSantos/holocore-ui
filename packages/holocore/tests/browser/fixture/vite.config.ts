import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Serves the harness pages from source, so the browser tests exercise src/
// directly; the built files are tested by the pack and CDN tests.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  esbuild: { jsx: "automatic" },
  server: { fs: { allow: [fileURLToPath(new URL("../../../../..", import.meta.url))] } },
});
