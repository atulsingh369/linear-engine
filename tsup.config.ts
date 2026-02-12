import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["cjs"],
  target: "node18",
  platform: "node",
  sourcemap: true,
  dts: true,
  clean: true,
  banner: {
    js: "#!/usr/bin/env node"
  }
});
