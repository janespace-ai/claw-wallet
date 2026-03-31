import { expect, _electron as electron, type Page, type TestInfo } from "@playwright/test";
import path from "node:path";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import type { E2eLogCollector } from "./log-collector";

export const desktopRoot = process.cwd();
export const screenshotDir = path.join(desktopRoot, "test-results", "e2e");
export const logDir = path.join(screenshotDir, "logs");

export const E2E_STARTUP_MS = 90_000;

export function resolveElectronBinary(projectRoot: string): string {
  const electronPkg = path.join(projectRoot, "node_modules", "electron");
  const rel = readFileSync(path.join(electronPkg, "path.txt"), "utf-8").trim();
  return path.join(electronPkg, "dist", rel);
}

const electronExecutable = resolveElectronBinary(desktopRoot);

export function launchApp() {
  const userData = mkdtempSync(path.join(tmpdir(), "claw-e2e-"));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.FORCE_COLOR;
  delete env.NO_COLOR;
  return electron.launch({
    executablePath: electronExecutable,
    args: ["."],
    cwd: desktopRoot,
    timeout: E2E_STARTUP_MS,
    env: {
      ...env,
      E2E_USER_DATA: userData,
      E2E_SKIP_TRAY: "1",
      E2E_LOW_SCRYPT: "1",
    },
  });
}

export async function firstAppWindow(app: Awaited<ReturnType<typeof electron.launch>>) {
  return app.firstWindow({ timeout: E2E_STARTUP_MS });
}

export async function waitForAppReady(window: Page) {
  await window.waitForSelector("body[data-app-ready='true']", { timeout: E2E_STARTUP_MS });
}

export async function completeOnboarding(window: Page, password: string): Promise<void> {
  await window.click("#btn-create");
  await expect(window.locator("#screen-password.screen.active")).toBeVisible();
  await window.fill("#input-password", password);
  await window.fill("#input-password-confirm", password);
  await window.click("#btn-password-submit");
  await expect(window.locator("#screen-mnemonic.screen.active")).toBeVisible({ timeout: 60_000 });
  await window.check("#mnemonic-confirmed");
  await window.click("#btn-mnemonic-done");
  await expect(window.locator("#screen-main.screen.active")).toBeVisible({ timeout: 60_000 });
  await expect(window.locator("#main-address")).not.toBeEmpty();
}

export async function saveSessionLog(testInfo: TestInfo, slug: string, logs: E2eLogCollector): Promise<void> {
  mkdirSync(logDir, { recursive: true });
  const filePath = path.join(logDir, `${slug}.log`);
  const body = logs.formatReport();
  writeFileSync(filePath, body, "utf8");
  await testInfo.attach(`e2e-logs-${slug}.txt`, { body, contentType: "text/plain" });
}

export function ensureE2eDirs(): void {
  mkdirSync(screenshotDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });
}
