/**
 * screenshot-design-audit.spec.ts
 *
 * Comprehensive screenshot capture for every visual state of the desktop app.
 * Output goes to test-results/e2e/audit/ and is used to verify / update
 * the Pencil design file (docs/design/desktop-redesign.pen).
 *
 * Coverage:
 *   Onboarding: welcome, password-create, mnemonic-backup, password-import
 *   Main (light): home, pair-code, network-picker, account-dropdown,
 *                 activity, activity-network-picker,
 *                 contacts, settings, lock-mode-picker, language-picker,
 *                 security-events subpage, signing-history subpage,
 *                 modal-new-account, modal-export (phase1 + phase2)
 *   Main (dark):  same as light, theme switched to dark
 *   Unlock screen
 *
 * Approach: pure through-UI navigation — zero code changes to the app.
 */

import { test } from "@playwright/test";
import path from "node:path";
import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";
import {
  completeOnboarding,
  ensureE2eDirs,
  firstAppWindow,
  launchApp,
  waitForAppReady,
} from "./helpers";

const auditDir = path.join(process.cwd(), "test-results", "e2e", "audit");

function ss(name: string) {
  return path.join(auditDir, `${name}.png`);
}

async function goTab(w: Page, tab: "home" | "activity" | "contacts" | "settings") {
  await dismissBlockingModals(w);
  await w.click(`.tab-item[data-tab="${tab}"]`);
  await w.waitForSelector(`#tab-${tab}.tab-content.active`, { timeout: 8_000 });
  await w.waitForTimeout(300);
}

async function switchTheme(w: Page, theme: "light" | "dark" | "system") {
  await goTab(w, "settings");
  await w.click(`.theme-seg-btn[data-theme-val="${theme}"]`);
  await w.waitForTimeout(400);
}

async function closeModal(w: Page) {
  // press Escape to close any open modal/picker
  await w.keyboard.press("Escape");
  await w.waitForTimeout(200);
}

/** Dismiss any modal that might be blocking navigation (e.g. biometric enable prompt). */
async function dismissBlockingModals(w: Page) {
  // Biometric enable modal
  const bioCancel = w.locator("#btn-biometric-enable-cancel");
  if (await bioCancel.isVisible().catch(() => false)) {
    await bioCancel.click();
    await w.waitForTimeout(200);
  }
  // Biometric password modal
  const bioPassCancel = w.locator("#btn-biometric-cancel");
  if (await bioPassCancel.isVisible().catch(() => false)) {
    await bioPassCancel.click();
    await w.waitForTimeout(200);
  }
  // Generic alert modal
  const alertAllow = w.locator("#btn-alert-allow");
  if (await alertAllow.isVisible().catch(() => false)) {
    await alertAllow.click();
    await w.waitForTimeout(200);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA HELPERS
// Inject realistic display data so screenshots show populated states.
// Called AFTER goTab() so real (empty) data loads first, then we overwrite.
// ─────────────────────────────────────────────────────────────────────────────

async function injectMockBalances(w: Page) {
  await w.evaluate(() => {
    const list = document.getElementById("balances-list");
    if (list) {
      list.innerHTML = `
        <div class="balance-row" data-symbol="ETH">
          <div class="balance-token-icon">Ξ</div>
          <div class="balance-info">
            <div class="balance-token-name">ETH</div>
            <div class="balance-network">Ethereum</div>
          </div>
          <div class="balance-amounts">
            <div class="balance-amount">0.5000</div>
            <div class="balance-usd">$1,840.00</div>
          </div>
        </div>
        <div class="balance-row" data-symbol="USDC">
          <div class="balance-token-icon">$</div>
          <div class="balance-info">
            <div class="balance-token-name">USDC</div>
            <div class="balance-network">Base · Ethereum</div>
          </div>
          <div class="balance-amounts">
            <div class="balance-amount">500.0000</div>
            <div class="balance-usd">$500.00</div>
          </div>
        </div>
        <div class="balance-row" data-symbol="MATIC">
          <div class="balance-token-icon">⬡</div>
          <div class="balance-info">
            <div class="balance-token-name">MATIC</div>
            <div class="balance-network">Polygon</div>
          </div>
          <div class="balance-amounts">
            <div class="balance-amount">250.0000</div>
            <div class="balance-usd">$125.00</div>
          </div>
        </div>`;
    }
    const pv = document.getElementById("portfolio-value");
    if (pv) pv.textContent = "$12,345.67";
    const pc = document.getElementById("portfolio-change");
    if (pc) { pc.textContent = "↑ $124.50 today"; pc.style.display = "block"; }
  });
  await w.waitForTimeout(100);
}

async function injectMockContacts(w: Page) {
  await w.evaluate(() => {
    const list = document.getElementById("contacts-list-main");
    if (!list) return;
    list.innerHTML = `
      <div class="contact-row" data-name="Alice" data-address="0x742d742d742df44e" data-chain="ETH" data-trusted="true" style="cursor:pointer">
        <div class="contact-avatar">AL</div>
        <div class="contact-info">
          <div class="contact-name-row">
            <span class="contact-name">Alice</span>
            <span class="contact-badge">可信任</span>
          </div>
          <span class="contact-chain">0x742d...f44e</span>
        </div>
        <div class="contact-actions">
          <button class="contact-action-btn trust is-trusted" title="Trust">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </button>
          <button class="contact-action-btn delete" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>
      <div class="contact-row" data-name="Bob" data-address="0x12345678" data-chain="BSC" data-trusted="false" style="cursor:pointer">
        <div class="contact-avatar regular">BO</div>
        <div class="contact-info">
          <div class="contact-name-row"><span class="contact-name">Bob</span></div>
          <span class="contact-chain">0x1234...5678 · BSC</span>
        </div>
        <div class="contact-actions">
          <button class="contact-action-btn trust" title="Trust">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </button>
          <button class="contact-action-btn delete" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>
      <div class="contact-row" data-name="Carol" data-address="0x9876dcba" data-chain="Polygon" data-trusted="false" style="cursor:pointer">
        <div class="contact-avatar regular">CA</div>
        <div class="contact-info">
          <div class="contact-name-row"><span class="contact-name">Carol</span></div>
          <span class="contact-chain">0x9876...DCBA · Polygon</span>
        </div>
        <div class="contact-actions">
          <button class="contact-action-btn trust" title="Trust">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </button>
          <button class="contact-action-btn delete" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>
      <div class="contact-agent-hint">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Contacts are added automatically when an Agent sends you transactions.</span>
      </div>`;
  });
  await w.waitForTimeout(100);
}

async function injectMockActivity(w: Page) {
  await w.evaluate(() => {
    const list = document.getElementById("activity-list");
    if (!list) return;
    list.innerHTML = `
      <div class="activity-row" style="cursor:pointer">
        <div class="activity-type-icon auto">A</div>
        <div class="activity-info">
          <div class="activity-type-label">Auto · Send ETH</div>
          <div class="activity-meta">Base · 14:32</div>
        </div>
        <div class="activity-amounts">
          <div class="activity-amount">-0.01 ETH</div>
          <div class="activity-usd">$24.50</div>
        </div>
      </div>
      <div class="activity-row" style="cursor:pointer">
        <div class="activity-type-icon manual">M</div>
        <div class="activity-info">
          <div class="activity-type-label">Manual · Send USDC</div>
          <div class="activity-meta">Ethereum · 11:05</div>
        </div>
        <div class="activity-amounts">
          <div class="activity-amount">-50.00 USDC</div>
          <div class="activity-usd">$50.00</div>
        </div>
      </div>
      <div class="activity-row" style="cursor:pointer">
        <div class="activity-type-icon rejected">✕</div>
        <div class="activity-info">
          <div class="activity-type-label">Rejected · Send ETH</div>
          <div class="activity-meta">Arbitrum · 09:15</div>
        </div>
        <div class="activity-amounts">
          <div class="activity-amount rejected">0.5 ETH</div>
          <div class="activity-usd">$1,840.00</div>
        </div>
      </div>`;
  });
  await w.waitForTimeout(100);
}

test.beforeAll(() => {
  ensureE2eDirs();
  mkdirSync(auditDir, { recursive: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 1 — Onboarding screens (fresh wallet, light theme)
// ─────────────────────────────────────────────────────────────────────────────
test("onboarding screens", async () => {
  const app = await launchApp();
  const w = await firstAppWindow(app);
  try {
    await w.waitForLoadState("domcontentloaded");
    await waitForAppReady(w);

    // 01 Welcome
    await w.waitForSelector("#screen-setup.screen.active");
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("01-welcome") });

    // 02 Password setup — Create flow
    await w.click("#btn-create");
    await w.waitForSelector("#screen-password.screen.active");
    await w.waitForTimeout(200);
    await w.screenshot({ path: ss("02-password-create") });

    // 03 Mnemonic backup
    await w.fill("#input-password", "AuditPass1!");
    await w.fill("#input-password-confirm", "AuditPass1!");
    await w.click("#btn-password-submit");
    await w.waitForSelector("#screen-mnemonic.screen.active", { timeout: 60_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("03-mnemonic-backup") });

    // Back to welcome, then import flow
    // (Can't easily go back from mnemonic, so launch fresh for import screenshot)
  } finally {
    await app.close();
  }
});

test("onboarding import flow", async () => {
  const app = await launchApp();
  const w = await firstAppWindow(app);
  try {
    await w.waitForLoadState("domcontentloaded");
    await waitForAppReady(w);

    // 04 Password — Import flow (shows mnemonic textarea)
    await w.click("#btn-import");
    await w.waitForSelector("#screen-password.screen.active");
    await w.waitForSelector("#mnemonic-input-area:visible", { timeout: 5_000 });
    await w.waitForTimeout(200);
    await w.screenshot({ path: ss("04-password-import") });
  } finally {
    await app.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 2 — Main app, LIGHT theme (all tabs, subpages, pickers, modals)
// ─────────────────────────────────────────────────────────────────────────────
test("main app - light theme", async () => {
  const app = await launchApp();
  const w = await firstAppWindow(app);
  try {
    await w.waitForLoadState("domcontentloaded");
    await waitForAppReady(w);
    await completeOnboarding(w, "AuditPass1!");
    await w.waitForTimeout(500);

    // ── HOME ──────────────────────────────────────────────────────────────
    await goTab(w, "home");
    await w.waitForTimeout(600); // let real (empty) data load settle
    await injectMockBalances(w);
    await w.screenshot({ path: ss("10-home") });

    // Home: pair-code card (click agent status button)
    await w.click("#btn-agent-status");
    await w.waitForSelector("#pair-code-card:visible", { timeout: 5_000 });
    await w.waitForTimeout(400);
    await w.screenshot({ path: ss("11-home-pair-code") });
    await w.click("#btn-pair-code-close");
    await w.waitForTimeout(200);

    // Home: network filter picker
    await w.click("#home-network-btn");
    await w.waitForSelector("#home-network-picker:visible", { timeout: 3_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("12-home-network-picker") });
    await closeModal(w);

    // Home: account dropdown
    await w.click("#btn-account-dropdown");
    await w.waitForSelector("#account-dropdown-panel:visible", { timeout: 3_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("13-home-account-dropdown") });
    await w.click("#acct-dropdown-scrim"); // close via scrim
    await w.waitForTimeout(200);

    // ── ACTIVITY ──────────────────────────────────────────────────────────
    await goTab(w, "activity");
    await w.waitForTimeout(600);
    await injectMockActivity(w);
    await w.screenshot({ path: ss("20-activity") });

    // Activity: network picker
    await w.click("#activity-network-btn");
    await w.waitForSelector("#activity-network-picker:visible", { timeout: 3_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("21-activity-network-picker") });
    await closeModal(w);

    // ── CONTACTS ──────────────────────────────────────────────────────────
    await goTab(w, "contacts");
    await w.waitForTimeout(600);
    await injectMockContacts(w);
    await w.screenshot({ path: ss("30-contacts") });

    // ── SETTINGS ──────────────────────────────────────────────────────────
    await goTab(w, "settings");
    await w.screenshot({ path: ss("40-settings") });

    // Settings: lock mode picker
    await w.click("#row-lock-mode");
    await w.waitForSelector("#lock-mode-picker:visible", { timeout: 3_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("41-settings-lock-mode-picker") });
    // close picker by clicking elsewhere
    await w.click(".settings-section-header");
    await w.waitForTimeout(200);

    // Settings: language picker
    await w.click("#row-language");
    await w.waitForSelector("#language-picker:visible", { timeout: 3_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("42-settings-language-picker") });
    await w.click(".settings-section-header");
    await w.waitForTimeout(200);

    // Settings: Security Events subpage
    await w.click("#btn-open-security-events");
    await w.waitForSelector("#subpage-security-events.active", { timeout: 5_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("43-settings-security-events") });
    await w.click("#btn-close-security-events");
    await w.waitForTimeout(200);

    // Settings: Signing History subpage
    await w.click("#btn-open-signing-history");
    await w.waitForSelector("#subpage-signing-history.active", { timeout: 5_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("44-settings-signing-history") });
    await w.click("#btn-close-signing-history");
    await w.waitForTimeout(200);

    // ── MODALS ────────────────────────────────────────────────────────────

    // Modal: New sub-account
    // Note: in e2e mode the + button bypasses the modal and creates directly,
    // so we show the modal via evaluate() for the screenshot.
    await goTab(w, "home");
    await w.evaluate(() => {
      const m = document.getElementById("modal-new-account");
      const inp = document.getElementById("input-new-account-nick") as HTMLInputElement;
      if (inp) inp.value = "";
      if (m) m.classList.add("active");
    });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("50-modal-new-account") });
    await w.evaluate(() => {
      document.getElementById("modal-new-account")?.classList.remove("active");
    });
    await w.waitForTimeout(200);

    // Modal: Export Mnemonic — phase 1 (password input)
    await goTab(w, "settings");
    await w.click("#btn-export-mnemonic-row");
    await w.waitForSelector("#modal-export:visible", { timeout: 5_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("51-modal-export-phase1") });

    // Modal: Export Mnemonic — phase 2 (mnemonic revealed)
    await w.fill("#input-export-password", "AuditPass1!");
    await w.click("#btn-export-confirm");
    await w.waitForSelector("#export-phase-mnemonic:visible", { timeout: 10_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("52-modal-export-phase2") });
    await w.click("#btn-export-close");
    await w.waitForTimeout(300);
    await dismissBlockingModals(w);
  } finally {
    await app.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 3 — Main app, DARK theme
// ─────────────────────────────────────────────────────────────────────────────
test("main app - dark theme", async () => {
  const app = await launchApp();
  const w = await firstAppWindow(app);
  try {
    await w.waitForLoadState("domcontentloaded");
    await waitForAppReady(w);
    await completeOnboarding(w, "AuditPass1!");
    await w.waitForTimeout(500);

    // Switch to dark
    await switchTheme(w, "dark");
    await w.waitForTimeout(400);

    // ── HOME ──────────────────────────────────────────────────────────────
    await goTab(w, "home");
    await w.waitForTimeout(600); // let real (empty) data load settle
    await injectMockBalances(w);
    await w.screenshot({ path: ss("D10-home") });

    // Home: pair-code card
    await w.click("#btn-agent-status");
    await w.waitForSelector("#pair-code-card:visible", { timeout: 5_000 });
    await w.waitForTimeout(400);
    await w.screenshot({ path: ss("D11-home-pair-code") });
    await w.click("#btn-pair-code-close");
    await w.waitForTimeout(200);

    // Home: network picker
    await w.click("#home-network-btn");
    await w.waitForSelector("#home-network-picker:visible", { timeout: 3_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("D12-home-network-picker") });
    await closeModal(w);

    // Home: account dropdown
    await w.click("#btn-account-dropdown");
    await w.waitForSelector("#account-dropdown-panel:visible", { timeout: 3_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("D13-home-account-dropdown") });
    await w.click("#acct-dropdown-scrim"); // close via scrim
    await w.waitForTimeout(200);

    // ── ACTIVITY ──────────────────────────────────────────────────────────
    await goTab(w, "activity");
    await w.waitForTimeout(600);
    await injectMockActivity(w);
    await w.screenshot({ path: ss("D20-activity") });

    // Activity: network picker
    await w.click("#activity-network-btn");
    await w.waitForSelector("#activity-network-picker:visible", { timeout: 3_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("D21-activity-network-picker") });
    await closeModal(w);

    // ── CONTACTS ──────────────────────────────────────────────────────────
    await goTab(w, "contacts");
    await w.waitForTimeout(600);
    await injectMockContacts(w);
    await w.screenshot({ path: ss("D30-contacts") });

    // ── SETTINGS ──────────────────────────────────────────────────────────
    await goTab(w, "settings");
    await w.screenshot({ path: ss("D40-settings") });

    // Settings: lock mode picker
    await w.click("#row-lock-mode");
    await w.waitForSelector("#lock-mode-picker:visible", { timeout: 3_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("D41-settings-lock-mode-picker") });
    await w.click(".settings-section-header");
    await w.waitForTimeout(200);

    // Settings: language picker
    await w.click("#row-language");
    await w.waitForSelector("#language-picker:visible", { timeout: 3_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("D42-settings-language-picker") });
    await w.click(".settings-section-header");
    await w.waitForTimeout(200);

    // Settings: Security Events subpage
    await w.click("#btn-open-security-events");
    await w.waitForSelector("#subpage-security-events.active", { timeout: 5_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("D43-settings-security-events") });
    await w.click("#btn-close-security-events");
    await w.waitForTimeout(200);

    // Settings: Signing History subpage
    await w.click("#btn-open-signing-history");
    await w.waitForSelector("#subpage-signing-history.active", { timeout: 5_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("D44-settings-signing-history") });
    await w.click("#btn-close-signing-history");
    await w.waitForTimeout(200);

    // ── MODALS ────────────────────────────────────────────────────────────

    // Modal: New sub-account (use evaluate — e2e mode bypasses button)
    await goTab(w, "home");
    await w.evaluate(() => {
      const m = document.getElementById("modal-new-account");
      const inp = document.getElementById("input-new-account-nick") as HTMLInputElement;
      if (inp) inp.value = "";
      if (m) m.classList.add("active");
    });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("D50-modal-new-account") });
    await w.evaluate(() => {
      document.getElementById("modal-new-account")?.classList.remove("active");
    });
    await w.waitForTimeout(200);

    // Modal: Export — phase 1
    await goTab(w, "settings");
    await w.click("#btn-export-mnemonic-row");
    await w.waitForSelector("#modal-export:visible", { timeout: 5_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("D51-modal-export-phase1") });

    // Modal: Export — phase 2
    await w.fill("#input-export-password", "AuditPass1!");
    await w.click("#btn-export-confirm");
    await w.waitForSelector("#export-phase-mnemonic:visible", { timeout: 10_000 });
    await w.waitForTimeout(300);
    await w.screenshot({ path: ss("D52-modal-export-phase2") });
    await w.click("#btn-export-close");
    await w.waitForTimeout(300);
    await dismissBlockingModals(w);
  } finally {
    await app.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 4 — Unlock screen (light + dark)
// ─────────────────────────────────────────────────────────────────────────────
test("unlock screen - light and dark", async () => {
  const app = await launchApp();
  const w = await firstAppWindow(app);
  try {
    await w.waitForLoadState("domcontentloaded");
    await waitForAppReady(w);
    await completeOnboarding(w, "AuditPass1!");

    // Lock the wallet
    await goTab(w, "settings");
    await w.click("#btn-lock-wallet");
    await w.waitForSelector("#screen-unlock.screen.active", { timeout: 15_000 });
    await w.waitForTimeout(300);

    // 60 Unlock — light
    await w.screenshot({ path: ss("60-unlock") });

    // Unlock to get back to main
    await w.fill("#input-unlock-password", "AuditPass1!");
    await w.click("#btn-unlock");
    await w.waitForSelector("#screen-main.screen.active", { timeout: 30_000 });

    // Switch to dark, lock again
    await switchTheme(w, "dark");
    await w.click("#btn-lock-wallet");
    await w.waitForSelector("#screen-unlock.screen.active", { timeout: 15_000 });
    await w.waitForTimeout(400);

    // D60 Unlock — dark
    await w.screenshot({ path: ss("D60-unlock") });
  } finally {
    await app.close();
  }
});
