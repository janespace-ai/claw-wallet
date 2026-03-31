import { test, expect, type Page } from "@playwright/test";
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

test.describe("多账户与多网络", () => {
  test("子账户创建、下拉切换与设置页账户列表", async ({}, testInfo) => {
    const app = await launchApp();
    const logs = new E2eLogCollector();
    const slug = "05-multi-account";
    let window: Page | undefined;
    const password = "MultiAcc1!";
    try {
      window = await firstAppWindow(app);
      logs.attach(app, window);
      await window.waitForLoadState("domcontentloaded");
      await waitForAppReady(window);
      await completeOnboarding(window, password);

      await expect(window.locator("#account-header-group")).toBeVisible();
      await expect(window.locator("#account-selector option")).toHaveCount(1);

      const addr0 = (await window.locator("#main-address").textContent())?.trim() ?? "";
      expect(addr0.length).toBeGreaterThan(10);

      await window.screenshot({ path: path.join(screenshotDir, "20-account-single.png"), fullPage: true });

      await window.click("#btn-new-sub-account");

      await expect(window.locator("#account-selector option")).toHaveCount(2, { timeout: 15_000 });
      await window.screenshot({ path: path.join(screenshotDir, "21-account-two-options.png"), fullPage: true });

      await window.locator("#account-selector").selectOption("1");
      await expect
        .poll(async () => (await window!.locator("#main-address").textContent())?.trim(), { timeout: 15_000 })
        .not.toBe(addr0);

      const addr1 = (await window.locator("#main-address").textContent())?.trim() ?? "";
      expect(addr1).not.toBe(addr0);

      await window.screenshot({ path: path.join(screenshotDir, "22-account-active-index-1.png"), fullPage: true });

      await expect(window.locator("#account-selector")).toHaveValue("1");

      await window.locator("#account-selector").selectOption("0");
      await expect
        .poll(async () => (await window!.locator("#main-address").textContent())?.trim(), { timeout: 15_000 })
        .toBe(addr0);

      await expect(window.locator("#account-selector")).toHaveValue("0");
      await window.screenshot({ path: path.join(screenshotDir, "23-account-back-to-0.png"), fullPage: true });

      await window.click('.tab[data-tab="settings"]');
      await expect(window.locator("#tab-settings.tab-content.active")).toBeVisible();
      await expect(window.locator(".settings-account-row")).toHaveCount(2);
      await window.screenshot({ path: path.join(screenshotDir, "24-settings-two-accounts.png"), fullPage: true });

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

  test("活动页网络筛选切换；主页余额网络筛选（多链数据可用时）", async ({}, testInfo) => {
    const app = await launchApp();
    const logs = new E2eLogCollector();
    const slug = "06-multi-network";
    let window: Page | undefined;
    const password = "MultiNet1!";
    try {
      window = await firstAppWindow(app);
      logs.attach(app, window);
      await window.waitForLoadState("domcontentloaded");
      await waitForAppReady(window);
      await completeOnboarding(window, password);

      await window.click('.tab[data-tab="activity"]');
      await expect(window.locator("#tab-activity.tab-content.active")).toBeVisible();

      const actFilter = window.locator("#activity-network-filter");
      await expect(actFilter).toBeVisible();
      await expect(actFilter.locator("option")).toHaveCount(9);
      await expect(actFilter).toHaveValue("all");
      await window.screenshot({ path: path.join(screenshotDir, "30-activity-network-all.png"), fullPage: true });

      await actFilter.selectOption("ethereum");
      await expect(actFilter).toHaveValue("ethereum");
      await new Promise((r) => setTimeout(r, 600));
      await window.screenshot({ path: path.join(screenshotDir, "31-activity-network-ethereum.png"), fullPage: true });

      await actFilter.selectOption("base");
      await expect(actFilter).toHaveValue("base");
      await new Promise((r) => setTimeout(r, 600));
      await window.screenshot({ path: path.join(screenshotDir, "32-activity-network-base.png"), fullPage: true });

      await actFilter.selectOption("all");
      await expect(actFilter).toHaveValue("all");

      await window.click('.tab[data-tab="home"]');
      await expect(window.locator("#tab-home.tab-content.active")).toBeVisible();

      await window.click("#btn-refresh-balances");
      let homeNetworkOptions = 0;
      try {
        await expect
          .poll(async () => window!.locator("#network-filter option").count(), {
            timeout: 22_000,
            intervals: [400, 800, 1500, 2000],
          })
          .toBeGreaterThanOrEqual(3);
        homeNetworkOptions = await window.locator("#network-filter option").count();
      } catch {
        testInfo.annotations.push({
          type: "issue",
          description: "主页 #network-filter 未在超时内出现多链选项（RPC/余额未返回多链时属预期）",
        });
      }

      if (homeNetworkOptions >= 3) {
        const homeFilter = window.locator("#network-filter");
        await homeFilter.selectOption({ label: "Ethereum" });
        await new Promise((r) => setTimeout(r, 500));
        await window.screenshot({ path: path.join(screenshotDir, "33-home-network-ethereum.png"), fullPage: true });

        await homeFilter.selectOption("all");
        await expect(homeFilter).toHaveValue("all");
        await window.screenshot({ path: path.join(screenshotDir, "34-home-network-all.png"), fullPage: true });
      } else {
        await window.screenshot({ path: path.join(screenshotDir, "33-home-network-filter-skipped.png"), fullPage: true });
      }

      await expect(window.locator("#activity-network-filter")).toHaveValue("all");
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

  test("活动页网络筛选 — 像素基线（静态下拉区域）", async ({}, testInfo) => {
    const app = await launchApp();
    const logs = new E2eLogCollector();
    const slug = "07-activity-network-baseline";
    let window: Page | undefined;
    const password = "NetBase1!";
    try {
      window = await firstAppWindow(app);
      logs.attach(app, window);
      await window.waitForLoadState("domcontentloaded");
      await waitForAppReady(window);
      await completeOnboarding(window, password);

      await window.click('.tab[data-tab="activity"]');
      await expect(window.locator("#tab-activity.tab-content.active")).toBeVisible();

      const filters = window.locator(".activity-filters");
      await expect(filters).toBeVisible();
      await expect(filters).toHaveScreenshot("baseline-activity-filters.png", {
        maxDiffPixels: 4_000,
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
});
