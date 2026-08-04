import { defineConfig } from "tsup";

/** Builds the sole public ESM entry point and its declarations. */
export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  sourcemap: true,
  target: "es2022"
});
