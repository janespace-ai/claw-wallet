import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/dist/**"],
    passWithNoTests: true,
    globalSetup: ["./vitest.global-setup.ts"],
  },
});
