import { test, expect, type Page, type TestInfo } from "@playwright/test";
import path from "node:path";
import { E2eLogCollector, assertAcceptableLogs } from "./log-collector";
import {
  completeOnboarding,
  ensureE2eDirs,
  firstAppWindow,
  launchApp,
  saveSessionLog,
  screenshotDir,
  waitForAppReady,
} from "./helpers";

test.beforeAll(() => {
  ensureE2eDirs();
});

test.describe("截图与交互", () => {
  test("欢迎页、密码页与像素基线", async ({}, testInfo) => {
    const app = await launchApp();
    const logs = new E2eLogCollector();
    const slug = "01-welcome-baseline";
    let window: Page | undefined;
    try {
      window = await firstAppWindow(app);
      logs.attach(app, window);
      await window.waitForLoadState("domcontentloaded");
      await waitForAppReady(window);

      await expect(window.locator("#screen-setup.screen.active")).toBeVisible();
      await expect(window.locator("#header h1")).toHaveText("Claw Wallet");

      await window.screenshot({ path: path.join(screenshotDir, "01-setup.png"), fullPage: true });
      await expect(window).toHaveScreenshot("baseline-01-setup.png", {
        fullPage: true,
        maxDiffPixels: 3_000,
        animations: "disabled",
      });

      await window.click("#btn-create");
      await expect(window.locator("#screen-password.screen.active")).toBeVisible();
      await expect(window.locator("#password-title")).toHaveText("Set Password");
      await window.screenshot({ path: path.join(screenshotDir, "02-password.png"), fullPage: true });
      await expect(window).toHaveScreenshot("baseline-02-password.png", {
        fullPage: true,
        maxDiffPixels: 2_500,
        animations: "disabled",
      });
    } finally {
      try {
        if (window) logs.detach(app, window);
        await saveSessionLog(testInfo, slug, logs);
        assertAcceptableLogs(logs);
      } finally {
        await app.close();
      }
    }
  });

  test("短密码校验、助记词页、各 Tab 与主页刷新", async ({}, testInfo) => {
    const app = await launchApp();
    const logs = new E2eLogCollector();
    const slug = "02-tabs-balances";
    let window: Page | undefined;
    try {
      window = await firstAppWindow(app);
      logs.attach(app, window);
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
      await window.screenshot({ path: path.join(screenshotDir, "02b-mnemonic.png"), fullPage: true });

      await window.check("#mnemonic-confirmed");
      await window.click("#btn-mnemonic-done");

      await expect(window.locator("#screen-main.screen.active")).toBeVisible({ timeout: 60_000 });
      await expect(window.locator("#main-address")).not.toBeEmpty();
      await window.screenshot({ path: path.join(screenshotDir, "03-main-home.png"), fullPage: true });

      await window.click("#btn-refresh-balances");
      await new Promise((r) => setTimeout(r, 800));

      await window.click('.tab[data-tab="pairing"]');
      await expect(window.locator("#tab-pairing.tab-content.active")).toBeVisible();
      await window.screenshot({ path: path.join(screenshotDir, "04-pairing.png"), fullPage: true });

      await window.click('.tab[data-tab="settings"]');
      await expect(window.locator("#tab-settings.tab-content.active")).toBeVisible();
      await window.screenshot({ path: path.join(screenshotDir, "05-settings.png"), fullPage: true });

      await window.click('.tab[data-tab="security"]');
      await expect(window.locator("#tab-security.tab-content.active")).toBeVisible();
      await window.screenshot({ path: path.join(screenshotDir, "06-security.png"), fullPage: true });

      await window.click('.tab[data-tab="activity"]');
      await expect(window.locator("#tab-activity.tab-content.active")).toBeVisible();
      await window.screenshot({ path: path.join(screenshotDir, "07-activity.png"), fullPage: true });

      await window.click('.tab[data-tab="contacts"]');
      await expect(window.locator("#tab-contacts.tab-content.active")).toBeVisible();
      await window.screenshot({ path: path.join(screenshotDir, "08-contacts.png"), fullPage: true });

      await window.click('.tab[data-tab="home"]');
      await expect(window.locator("#tab-home.tab-content.active")).toBeVisible();
    } finally {
      try {
        if (window) logs.detach(app, window);
        await saveSessionLog(testInfo, slug, logs);
        assertAcceptableLogs(logs);
      } finally {
        await app.close();
      }
    }
  });

  test("导入入口与返回、设置导出助记词", async ({}, testInfo) => {
    const app = await launchApp();
    const logs = new E2eLogCollector();
    const slug = "03-import-export";
    let window: Page | undefined;
    try {
      window = await firstAppWindow(app);
      logs.attach(app, window);
      await window.waitForLoadState("domcontentloaded");
      await waitForAppReady(window);

      await window.click("#btn-import");
      await expect(window.locator("#screen-password.screen.active")).toBeVisible();
      await expect(window.locator("#mnemonic-input-area")).toBeVisible();
      await window.screenshot({ path: path.join(screenshotDir, "09-import-password.png"), fullPage: true });

      await window.click("#btn-password-back");
      await expect(window.locator("#screen-setup.screen.active")).toBeVisible();

      const testPassword = "ExportTest1!";
      await completeOnboarding(window, testPassword);

      await window.click('.tab[data-tab="settings"]');
      await window.click("#btn-export-mnemonic");
      await expect(window.locator("#modal-export")).toBeVisible();
      await window.fill("#input-export-password", "wrong-password");
      await window.click("#btn-export-confirm");
      await expect(window.locator("#export-error")).not.toBeEmpty();
      await window.screenshot({ path: path.join(screenshotDir, "10-export-wrong-pw.png"), fullPage: true });

      await window.fill("#input-export-password", testPassword);
      await window.click("#btn-export-confirm");
      await expect(window.locator("#export-mnemonic-display .word")).toHaveCount(12);
      await window.screenshot({ path: path.join(screenshotDir, "11-export-revealed.png"), fullPage: true });
      await window.click("#btn-export-cancel");
    } finally {
      try {
        if (window) logs.detach(app, window);
        await saveSessionLog(testInfo, slug, logs);
        assertAcceptableLogs(logs);
      } finally {
        await app.close();
      }
    }
  });

  test("锁定钱包后解锁", async ({}, testInfo) => {
    const app = await launchApp();
    const logs = new E2eLogCollector();
    const slug = "04-lock-unlock";
    let window: Page | undefined;
    const testPassword = "LockUnlock1!";
    try {
      window = await firstAppWindow(app);
      logs.attach(app, window);
      await window.waitForLoadState("domcontentloaded");
      await waitForAppReady(window);
      await completeOnboarding(window, testPassword);

      await window.click('.tab[data-tab="settings"]');
      await window.click("#btn-lock-wallet");
      await expect(window.locator("#screen-unlock.screen.active")).toBeVisible({ timeout: 15_000 });
      await window.screenshot({ path: path.join(screenshotDir, "12-unlock.png"), fullPage: true });

      await window.fill("#input-unlock-password", "wrong");
      await window.click("#btn-unlock");
      await expect(window.locator("#unlock-error")).not.toBeEmpty();

      await window.fill("#input-unlock-password", testPassword);
      await window.click("#btn-unlock");
      await expect(window.locator("#screen-main.screen.active")).toBeVisible({ timeout: 30_000 });
      await window.screenshot({ path: path.join(screenshotDir, "13-after-unlock.png"), fullPage: true });
    } finally {
      try {
        if (window) logs.detach(app, window);
        await saveSessionLog(testInfo, slug, logs);
        assertAcceptableLogs(logs);
      } finally {
        await app.close();
      }
    }
  });
});
