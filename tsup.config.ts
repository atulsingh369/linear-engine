import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "api/server": "src/api/server.ts"
  },
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
