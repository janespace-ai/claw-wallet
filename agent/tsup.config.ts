import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/openclaw-plugin.ts"],
  format: ["esm", "cjs"],
  dts: { entry: "src/index.ts" },
  sourcemap: true,
  clean: true,
  target: "node18",
});
