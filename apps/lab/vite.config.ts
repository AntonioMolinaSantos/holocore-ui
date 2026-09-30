import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { samplePlugin } from "./sample-plugin";

const clip = fileURLToPath(new URL("./public/sample.mp3", import.meta.url));

export default defineConfig(({ mode, command }) => ({
  plugins: [samplePlugin(clip, mode, command)],
  build: { target: "es2022" },
}));
