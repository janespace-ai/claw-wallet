import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: path.join(process.cwd(), "e2e"),
  /** Full create path uses scrypt; E2E sets E2E_LOW_SCRYPT */
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
});
