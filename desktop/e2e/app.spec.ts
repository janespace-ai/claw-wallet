import { test, expect, _electron as electron, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

/** Same resolution as `require("electron")` but without createRequire (Playwright TS loader + ESM). */
function resolveElectronBinary(projectRoot: string): string {
  const electronPkg = path.join(projectRoot, "node_modules", "electron");
  const rel = readFileSync(path.join(electronPkg, "path.txt"), "utf-8").trim();
  return path.join(electronPkg, "dist", rel);
}

const desktopRoot = process.cwd();
const electronExecutable = resolveElectronBinary(desktopRoot);
const screenshotDir = path.join(desktopRoot, "test-results", "e2e");

async function waitForAppReady(window: Page) {
  await window.waitForSelector("body[data-app-ready='true']", { timeout: 30_000 });
}

function launchApp() {
  const userData = mkdtempSync(path.join(tmpdir(), "claw-e2e-"));
  const env = { ...process.env };
  // IDE/Cursor often sets this; it breaks real Electron APIs (require/import "electron").
  delete env.ELECTRON_RUN_AS_NODE;
  return electron.launch({
    executablePath: electronExecutable,
    args: ["."],
    cwd: desktopRoot,
    env: {
      ...env,
      E2E_USER_DATA: userData,
      E2E_SKIP_TRAY: "1",
      E2E_LOW_SCRYPT: "1",
    },
  });
}

test.beforeAll(() => {
  mkdirSync(screenshotDir, { recursive: true });
});

test.describe("截图与交互", () => {
  test("欢迎页截图并进入设置密码页", async () => {
    const app = await launchApp();
    try {
      const window = await app.firstWindow();
      await window.waitForLoadState("domcontentloaded");
      await waitForAppReady(window);
      await expect(window.locator("#screen-setup.screen.active")).toBeVisible();
      await expect(window.locator("#header h1")).toHaveText("Claw Wallet");

      await window.screenshot({ path: path.join(screenshotDir, "01-setup.png"), fullPage: true });

      await window.click("#btn-create");
      await expect(window.locator("#screen-password.screen.active")).toBeVisible();
      await expect(window.locator("#screen-password.screen.active")).toBeVisible();
      await expect(window.locator("#password-title")).toHaveText("Set Password");

      await window.screenshot({ path: path.join(screenshotDir, "02-password.png"), fullPage: true });
    } finally {
      await app.close();
    }
  });

  test("短密码校验与 Tab 切换", async () => {
    const app = await launchApp();
    try {
      const window = await app.firstWindow();
      await window.waitForLoadState("domcontentloaded");
      await waitForAppReady(window);

      await window.click("#btn-create");
      await expect(window.locator("#screen-password.screen.active")).toBeVisible();
      await window.fill("#input-password", "short");
      await window.fill("#input-password-confirm", "short");
      await window.click("#btn-password-submit");
      await expect(window.locator("#password-error")).toContainText("at least 8 characters");

      const testPassword = "TestPass1!";
      await window.fill("#input-password", testPassword);
      await window.fill("#input-password-confirm", testPassword);
      await window.click("#btn-password-submit");

      await expect(window.locator("#screen-mnemonic.screen.active")).toBeVisible({ timeout: 60_000 });
      await window.check("#mnemonic-confirmed");
      await window.click("#btn-mnemonic-done");

      await expect(window.locator("#screen-main.screen.active")).toBeVisible({ timeout: 60_000 });
      await expect(window.locator("#main-address")).not.toBeEmpty();

      await window.screenshot({ path: path.join(screenshotDir, "03-main-home.png"), fullPage: true });

      await window.click('.tab[data-tab="pairing"]');
      await expect(window.locator("#tab-pairing.tab-content.active")).toBeVisible();
      await window.screenshot({ path: path.join(screenshotDir, "04-pairing.png"), fullPage: true });

      await window.click('.tab[data-tab="settings"]');
      await expect(window.locator("#tab-settings.tab-content.active")).toBeVisible();
      await window.screenshot({ path: path.join(screenshotDir, "05-settings.png"), fullPage: true });
    } finally {
      await app.close();
    }
  });

  test("设置页导出助记词（密码校验）", async () => {
    const app = await launchApp();
    try {
      const window = await app.firstWindow();
      await window.waitForLoadState("domcontentloaded");
      await waitForAppReady(window);

      const testPassword = "ExportTest1!";
      await window.click("#btn-create");
      await window.fill("#input-password", testPassword);
      await window.fill("#input-password-confirm", testPassword);
      await window.click("#btn-password-submit");
      await expect(window.locator("#screen-mnemonic.screen.active")).toBeVisible({ timeout: 60_000 });
      await window.check("#mnemonic-confirmed");
      await window.click("#btn-mnemonic-done");
      await expect(window.locator("#screen-main.screen.active")).toBeVisible({ timeout: 60_000 });

      await window.click('.tab[data-tab="settings"]');
      await window.click("#btn-export-mnemonic");
      await expect(window.locator("#modal-export")).toBeVisible();
      await window.fill("#input-export-password", "wrong-password");
      await window.click("#btn-export-confirm");
      await expect(window.locator("#export-error")).not.toBeEmpty();
      await window.fill("#input-export-password", testPassword);
      await window.click("#btn-export-confirm");
      await expect(window.locator("#export-mnemonic-display .word")).toHaveCount(12);
      await window.click("#btn-export-cancel");
    } finally {
      await app.close();
    }
  });
});
