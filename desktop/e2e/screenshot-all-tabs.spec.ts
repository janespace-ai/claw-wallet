import { test } from "@playwright/test";
import path from "node:path";
import {
  completeOnboarding,
  ensureE2eDirs,
  firstAppWindow,
  launchApp,
  screenshotDir,
  waitForAppReady,
} from "./helpers";

test("screenshot all tabs", async () => {
  ensureE2eDirs();
  const app = await launchApp();
  const w = await firstAppWindow(app);
  try {
    await w.waitForLoadState("domcontentloaded");
    await waitForAppReady(w);
    await completeOnboarding(w, "TestPass1!");

    await w.waitForTimeout(800);
    await w.screenshot({ path: path.join(screenshotDir, "tab-home.png") });

    await w.click('.tab-item[data-tab="activity"]');
    await w.waitForSelector("#tab-activity.tab-content.active");
    await w.waitForTimeout(500);
    await w.screenshot({ path: path.join(screenshotDir, "tab-activity.png") });

    await w.click('.tab-item[data-tab="contacts"]');
    await w.waitForSelector("#tab-contacts.tab-content.active");
    await w.waitForTimeout(500);
    await w.screenshot({ path: path.join(screenshotDir, "tab-contacts.png") });

    await w.click('.tab-item[data-tab="settings"]');
    await w.waitForSelector("#tab-settings.tab-content.active");
    await w.waitForTimeout(500);
    await w.screenshot({ path: path.join(screenshotDir, "tab-settings.png") });

    // Pairing subpage inside home
    await w.click('.tab-item[data-tab="home"]');
    await w.click('#btn-agent-status');
    await w.waitForTimeout(500);
    await w.screenshot({ path: path.join(screenshotDir, "tab-pairing-card.png") });

  } finally {
    await app.close();
  }
});
