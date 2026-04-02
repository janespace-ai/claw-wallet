import i18next, { initI18n, changeLanguage, tKey } from './i18n.js';

/** Resolve at call time: bundled ESM can evaluate before preload exposes `walletAPI` on `file://`. */
function wapi() {
  return window.walletAPI;
}

const WEI_DECIMALS = 18;
const TOKEN_DECIMALS = { ETH: 18, USDC: 6, USDT: 6, DAI: 18, WETH: 18 };

function formatTokenAmount(rawValue, token) {
  if (!rawValue || rawValue === "0") return "0";
  const decimals = TOKEN_DECIMALS[token?.toUpperCase()] ?? WEI_DECIMALS;
  const str = String(rawValue).replace(/^0x/, "");
  const value = BigInt(/^[0-9]+$/.test(str) ? str : "0");
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

function normAddrKey(addr) {
  return String(addr || "").trim().toLowerCase();
}

function normChainKey(chain) {
  return String(chain || "").trim().toLowerCase();
}

function contactRecipientKey(chain, addr) {
  return `${normChainKey(chain)}:${normAddrKey(addr)}`;
}

function buildContactLookup(contacts) {
  const m = new Map();
  for (const c of contacts || []) {
    if (!c?.address || !c?.chain) continue;
    m.set(contactRecipientKey(c.chain, c.address), { name: c.name, trusted: !!c.trusted });
  }
  return m;
}

function trustedContactBadgeHtml() {
  const label = tKey("common.contacts.trusted");
  return ` <span style="font-size:11px;background:#1a472a;color:#8f8;padding:2px 6px;border-radius:4px;margin-left:6px">${escapeHtml(label)}</span>`;
}

let currentMode = "setup";
let currentTxRequest = null;
let currentContactAddRequest = null;
let currentAlert = null;
let currentAccountIndex = 0; // Active account index

async function init() {
  await initializeI18n();
  
  const status = await wapi().getStatus();

  if (!status.hasWallet) {
    showScreen("setup");
  } else if (!status.isUnlocked) {
    document.getElementById("unlock-address").textContent = status.address;
    showScreen("unlock");
    await updateBiometricButton();
  } else {
    enterMainScreen(status);
  }

  setupEventListeners();
  setupRealtimeEvents();
  document.body.dataset.appReady = "true";
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(`screen-${name}`).classList.add("active");
  currentMode = name;
}

function enterMainScreen(status) {
  currentAccountIndex = typeof status.activeAccountIndex === "number" ? status.activeAccountIndex : 0;
  showScreen("main");
  document.getElementById("main-address").textContent = status.address;
  if (status.sameMachineWarning) {
    document.getElementById("same-machine-warning").style.display = "block";
  }
  loadPairedDevices();
  void refreshPairingCodeFromMain().catch((e) => console.error(e));
  loadSecurityEvents();
  loadSigningHistory();
  syncSettingsFromStatus(status);
  void syncHomeNetworkFilterFromConfig().finally(() => loadWalletBalances(status.address));
  initializeNetworkFilter();
  refreshAccountHeader().catch((e) => console.error(e));
  renderSettingsAccountsCard().catch((e) => console.error(e));
}

let currentBalances = [];
let currentPrices = {};
let currentAddress = '';
/** Cleared on account switch and when applying a new pairing countdown */
let pairingCountdownTimer = null;

async function loadWalletBalances(address) {
  if (!address) return;

  currentAddress = address;
  const balancesList = document.getElementById("balances-list");
  const portfolioValueDisplay = document.getElementById("portfolio-value");

  balancesList.innerHTML = buildBalanceSkeleton();
  portfolioValueDisplay.innerHTML = '<span class="sk" style="display:inline-block;width:140px;height:36px;border-radius:8px;vertical-align:middle;"></span>';
  const portfolioChangeDisplay = document.getElementById("portfolio-change");
  if (portfolioChangeDisplay) portfolioChangeDisplay.style.display = "none";

  try {
    const balances = await wapi().getWalletBalances(address);
    
    if (!balances || balances.length === 0) {
      balancesList.innerHTML = buildBalanceEmptyState();
      portfolioValueDisplay.textContent = "$0.00";
      document.getElementById("empty-state-refresh-btn")?.addEventListener("click", () => loadWalletBalances(address));
      return;
    }

    currentBalances = balances;

    const tokens = [...new Set(balances.map(b => b.symbol))];
    const prices = await wapi().getTokenPrices(tokens);
    currentPrices = prices;

    renderBalances(balances, prices);
    const totalValue = calculateTotalValue(balances, prices);
    portfolioValueDisplay.textContent = `$${totalValue.toFixed(2)}`;
  } catch (err) {
    console.error("Failed to load balances:", err);
    balancesList.innerHTML = `<p style="color: red;">${tKey('common.messages.error')}</p>`;
    portfolioValueDisplay.textContent = tKey('common.messages.error');
  }
}

function initializeNetworkFilter() {
  const networkFilter = document.getElementById('network-filter');
  const hideZeroBalances = document.getElementById('hide-zero-balances');

  if (networkFilter) {
    networkFilter.addEventListener('change', () => {
      // Sync active chip to match hidden select
      const val = networkFilter.value;
      document.querySelectorAll('#network-chips-row .chip').forEach(chip => {
        const net = chip.dataset.network;
        chip.classList.toggle('active',
          val === 'all' ? net === 'all' : net.toLowerCase() === val.toLowerCase());
      });
      if (currentBalances.length > 0) {
        renderBalances(currentBalances, currentPrices);
      }
    });
  }

  // Wire home network chips → hidden select
  document.querySelectorAll('#network-chips-row .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (!networkFilter) return;
      const net = chip.dataset.network;
      if (net === 'all') {
        networkFilter.value = 'all';
      } else {
        const match = Array.from(networkFilter.options).find(
          o => o.value.toLowerCase() === net.toLowerCase()
        );
        networkFilter.value = match ? match.value : net;
      }
      networkFilter.dispatchEvent(new Event('change'));
    });
  });

  if (hideZeroBalances) {
    hideZeroBalances.addEventListener('change', () => {
      if (currentBalances.length > 0) {
        renderBalances(currentBalances, currentPrices);
      }
    });
  }
}

function aggregateBalancesByToken(balances) {
  const aggregated = new Map();

  for (const balance of balances) {
    const existing = aggregated.get(balance.symbol);
    
    if (existing) {
      existing.networks.push({
        chainId: balance.chainId,
        chainName: balance.chainName,
        amount: balance.amount,
        rawAmount: balance.rawAmount
      });
    } else {
      aggregated.set(balance.symbol, {
        symbol: balance.symbol,
        decimals: balance.decimals,
        networks: [{
          chainId: balance.chainId,
          chainName: balance.chainName,
          amount: balance.amount,
          rawAmount: balance.rawAmount
        }]
      });
    }
  }

  return Array.from(aggregated.values());
}

function calculateAggregatedTotal(networks) {
  let totalAmount = 0;
  for (const network of networks) {
    totalAmount += parseFloat(network.amount) || 0;
  }
  return totalAmount;
}

function getNetworkIcon(chainName) {
  const icons = {
    'Ethereum': '🟦',
    'Base': '🔵',
    'Optimism': '🔴',
    'Arbitrum': '🟣',
    'Polygon': '🟣',
    'zkSync Era': '⚡',
    'Linea': '🟢',
    'Scroll': '📜'
  };
  return icons[chainName] || '⚪';
}

function getNetworkClass(chainName) {
  return chainName.toLowerCase().replace(/\s+/g, '-');
}

function appendNetworkOptionIfMissing(networkFilter, networkName) {
  if (!networkFilter || !networkName) return;
  if (networkName === "all") return;
  const exists = Array.from(networkFilter.options).some((o) => o.value === networkName);
  if (exists) return;
  const option = document.createElement("option");
  option.value = networkName;
  option.textContent = networkName;
  networkFilter.appendChild(option);
}

/** Fill home network filter from network-config.json (not only from balance rows). */
async function syncHomeNetworkFilterFromConfig() {
  const networkFilter = document.getElementById("network-filter");
  if (!networkFilter) return;
  while (networkFilter.options.length > 1) {
    networkFilter.remove(1);
  }
  try {
    const nets = await wapi().listConfiguredNetworks();
    for (const n of nets) {
      appendNetworkOptionIfMissing(networkFilter, n.name);
    }
  } catch (e) {
    console.error("syncHomeNetworkFilterFromConfig:", e);
  }
}

function renderBalances(balances, prices) {
  const balancesList = document.getElementById("balances-list");
  const networkFilter = document.getElementById('network-filter');
  const hideZeroBalances = document.getElementById('hide-zero-balances');
  
  if (!balances || balances.length === 0) {
    balancesList.innerHTML = buildBalanceEmptyState();
    return;
  }

  // Ensure any chain present in balances appears in the filter (e.g. after new token/network)
  if (networkFilter && balances.length > 0) {
    const networks = [...new Set(balances.map((b) => b.chainName))];
    networks.forEach((network) => appendNetworkOptionIfMissing(networkFilter, network));
  }

  // Apply network filter
  let filteredBalances = balances;
  if (networkFilter && networkFilter.value !== 'all') {
    filteredBalances = balances.filter(b => b.chainName === networkFilter.value);
  }

  // Apply hide zero balances filter
  const shouldHideZero = hideZeroBalances && hideZeroBalances.checked;
  if (shouldHideZero) {
    filteredBalances = filteredBalances.filter(b => parseFloat(b.amount) > 0);
  }

  if (filteredBalances.length === 0) {
    balancesList.innerHTML = buildBalanceEmptyState();
    return;
  }

  // Aggregate by token
  const aggregated = aggregateBalancesByToken(filteredBalances);

  balancesList.innerHTML = aggregated
    .map(token => {
      const totalAmount = calculateAggregatedTotal(token.networks);
      
      if (shouldHideZero && totalAmount === 0) {
        return '';
      }

      const price = prices[token.symbol] || null;
      const hasPrice = price != null;
      const totalUsd = hasPrice ? (totalAmount * price).toFixed(2) : null;

      // Single network or multiple?
      const isMultiNetwork = token.networks.length > 1;

      const networkLabel = isMultiNetwork
        ? token.networks.map(n => escapeHtml(n.chainName)).join(' · ')
        : escapeHtml(token.networks[0].chainName);

      const iconText = escapeHtml(token.symbol.slice(0, 3));

      return `
        <div class="balance-row" data-symbol="${escapeHtml(token.symbol)}">
          <div class="balance-token-icon">${iconText}</div>
          <div class="balance-info">
            <div class="balance-token-name">${escapeHtml(token.symbol)}</div>
            <div class="balance-network">${networkLabel}</div>
          </div>
          <div class="balance-amounts">
            <div class="balance-amount">${totalAmount.toFixed(6)}</div>
            ${hasPrice && totalUsd ? `<div class="balance-usd">$${totalUsd}</div>` : `<div class="balance-usd">${tKey('common.home.priceUnavailable')}</div>`}
          </div>
        </div>
      `;
    })
    .filter(Boolean)
    .join('');

  if (!balancesList.innerHTML.trim()) {
    balancesList.innerHTML = buildBalanceEmptyState();
  }
}

function calculateTotalValue(balances, prices) {
  let total = 0;
  for (const balance of balances) {
    const amount = parseFloat(balance.amount);
    const price = prices[balance.symbol] || 0;
    total += amount * price;
  }
  return total;
}

function renderMnemonicWords(container, mnemonic) {
  const words = mnemonic.trim().split(/\s+/);
  container.innerHTML = words
    .map(
      (w, i) =>
        `<div class="word"><span class="num">${i + 1}</span> ${escapeHtml(w)}</div>`
    )
    .join("");
}

/* ── Empty state (no balances) ────────────────────────────── */
function buildBalanceEmptyState() {
  const walletSvg = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M20 12v4H6a2 2 0 0 0-2 2c0 1.1.9 2 2 2h14v-4"/><line x1="20" y1="12" x2="4" y2="12"/></svg>`;
  const refreshSvg = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${walletSvg}</div>
      <div class="empty-state-title">${escapeHtml(tKey('common.home.noBalances'))}</div>
      <div class="empty-state-desc">${escapeHtml(tKey('common.home.noBalancesHint'))}</div>
      <button class="empty-state-btn" id="empty-state-refresh-btn">
        ${refreshSvg} ${escapeHtml(tKey('common.buttons.refresh'))}
      </button>
    </div>`;
}

/* ── Biometric password modal (replaces unsupported prompt()) ── */
function promptBiometricPassword() {
  return new Promise((resolve) => {
    const modal = document.getElementById("modal-biometric-password");
    const input = document.getElementById("input-biometric-password");
    const err   = document.getElementById("biometric-password-error");
    input.value = "";
    if (err) err.textContent = "";
    modal.classList.add("active");
    input.focus();
    window._biometricResolve = resolve;
    window._biometricReject  = () => resolve(null);
  });
}

/* ── Skeleton helpers ──────────────────────────────────────── */
function buildBalanceSkeleton() {
  const rows = [
    { name: 48, net: 96,  amt: 72, usd: 48 },
    { name: 56, net: 112, amt: 60, usd: 40 },
    { name: 52, net: 80,  amt: 80, usd: 44 },
  ];
  return rows.map(r => `
    <div class="skeleton-balance-row">
      <div class="skeleton-row-left">
        <div class="sk" style="width:40px;height:40px;border-radius:10px;flex-shrink:0;"></div>
        <div class="skeleton-row-texts">
          <div class="sk"     style="width:${r.name}px;height:13px;"></div>
          <div class="sk-dim" style="width:${r.net}px;height:11px;"></div>
        </div>
      </div>
      <div class="skeleton-row-right">
        <div class="sk"     style="width:${r.amt}px;height:13px;"></div>
        <div class="sk-dim" style="width:${r.usd}px;height:11px;"></div>
      </div>
    </div>`).join('');
}

function buildActivitySkeleton() {
  const rows = [
    { icon: 32, label: 80,  meta: 120, amt: 72, usd: 44 },
    { icon: 32, label: 64,  meta: 96,  amt: 56, usd: 36 },
    { icon: 32, label: 96,  meta: 80,  amt: 80, usd: 48 },
    { icon: 32, label: 72,  meta: 110, amt: 64, usd: 40 },
  ];
  return rows.map(r => `
    <div class="skeleton-activity-row">
      <div class="sk" style="width:${r.icon}px;height:${r.icon}px;border-radius:50%;flex-shrink:0;"></div>
      <div class="skeleton-activity-info">
        <div class="sk"     style="width:${r.label}px;height:13px;"></div>
        <div class="sk-dim" style="width:${r.meta}px;height:11px;"></div>
      </div>
      <div class="skeleton-activity-right">
        <div class="sk"     style="width:${r.amt}px;height:13px;"></div>
        <div class="sk-dim" style="width:${r.usd}px;height:11px;"></div>
      </div>
    </div>`).join('');
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateEthAddress(addr) {
  const a = String(addr || "").trim();
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

async function refreshAccountHeader() {
  const wrap = document.getElementById("account-header-group");
  const sel = document.getElementById("account-selector");
  const btnNew = document.getElementById("btn-new-sub-account");
  if (!wrap || !sel || !btnNew) return;
  try {
    const accounts = await wapi().listWalletAccounts();
    wrap.style.display = "flex";
    sel.innerHTML = "";
    const active = accounts.find(a => a.isActive) || accounts[0];
    for (const a of accounts) {
      const opt = document.createElement("option");
      opt.value = String(a.index);
      const mark = a.isActive ? "✓ " : "";
      opt.textContent = `${mark}${a.nickname} (${truncateEthAddress(a.address)})`;
      if (a.isActive) opt.selected = true;
      sel.appendChild(opt);
    }
    btnNew.disabled = accounts.length >= 10;
    btnNew.title = accounts.length >= 10 ? tKey("common.accounts.maxReached") : "";
    // Update pill avatar + name in new header
    const pillEl = document.getElementById("account-avatar-pill");
    const nameEl = document.getElementById("account-header-name");
    if (active && pillEl) pillEl.textContent = (active.nickname || "A")[0].toUpperCase();
    if (active && nameEl) nameEl.textContent = active.nickname || truncateEthAddress(active.address);
  } catch (e) {
    console.error("refreshAccountHeader:", e);
    wrap.style.display = "none";
  }
}

async function renderSettingsAccountsCard() {
  const card = document.getElementById("settings-accounts-card");
  const list = document.getElementById("settings-account-nicknames");
  if (!card || !list) return;
  try {
    const accounts = await wapi().listWalletAccounts();
    card.style.display = "block";
    list.innerHTML = accounts
      .map((a) => {
        const label = a.nickname || `Account ${a.index}`;
        const initials = label.slice(0, 2).toUpperCase();
        return `
      <div class="settings-account-row" data-index="${a.index}">
        <div class="settings-account-avatar">${escapeHtml(initials)}</div>
        <div class="settings-account-info">
          <span class="settings-account-name">${escapeHtml(label)}</span>
          <span class="settings-account-addr">${escapeHtml(truncateEthAddress(a.address))}</span>
        </div>
        <span class="settings-row-chevron">›</span>
      </div>`;
      })
      .join("");
  } catch (e) {
    console.error("renderSettingsAccountsCard:", e);
    card.style.display = "none";
  }
}

function showTxApprovalModal(req) {
  currentTxRequest = req;
  const details = document.getElementById("tx-details");
  const cc = req.counterpartyContact;
  const bookLine =
    cc && cc.name
      ? `<p><strong>${escapeHtml(tKey("modals.tx.addressBook"))}:</strong> ${escapeHtml(cc.name)}${cc.trusted ? trustedContactBadgeHtml() : ""}</p>`
      : "";
  const transferText =
    req.transferDisplay != null && String(req.transferDisplay).trim() !== ""
      ? escapeHtml(req.transferDisplay)
      : `${formatTokenAmount(req.value, req.token)} ${escapeHtml(req.token)}`;
  const estUsd = typeof req.estimatedUsd === "number" ? req.estimatedUsd : 0;
  const canValuate = req.priceAvailable === true;
  const usdtLine = canValuate
    ? `<p><strong>${escapeHtml(tKey("modals.tx.estimatedUsd"))}:</strong> ≈ ${estUsd.toFixed(2)} USDT <span style="color:var(--text-secondary);font-size:12px">${escapeHtml(tKey("modals.tx.estimatedHint"))}</span></p>`
    : `<p><strong>${escapeHtml(tKey("modals.tx.estimatedUsd"))}:</strong> <span style="color:var(--text-secondary)">${escapeHtml(tKey("modals.tx.noUsdt"))}</span></p>`;
  
  // Network badge with icon and styling
  const networkIcon = getNetworkIcon(req.chain);
  const networkClass = getNetworkClass(req.chain);
  const networkBadge = `<span class="network-badge ${networkClass}">${networkIcon} ${escapeHtml(req.chain)}</span>`;
  
  details.innerHTML = `
      <p><strong>${escapeHtml(tKey("modals.tx.method"))}:</strong> ${escapeHtml(req.method)}</p>
      ${bookLine}
      <p><strong>${escapeHtml(tKey("modals.tx.to"))}:</strong> <span class="address">${escapeHtml(req.to)}</span></p>
      <p><strong>${escapeHtml(tKey("modals.tx.transfer"))}:</strong> ${transferText}</p>
      ${usdtLine}
      <p><strong>${escapeHtml(tKey("modals.tx.chain"))}:</strong> ${networkBadge}</p>
      <p><strong>${escapeHtml(tKey("modals.tx.fromDevice"))}:</strong> ${escapeHtml(req.fromDevice)}</p>
      <p><strong>${escapeHtml(tKey("modals.tx.sourceIp"))}:</strong> ${escapeHtml(req.sourceIP)}</p>
    `;
  const trustWrap = document.getElementById("tx-trust-wrap");
  const trustChk = document.getElementById("chk-trust-after-success");
  const nameWrap = document.getElementById("tx-trust-name-wrap");
  const nameInput = document.getElementById("input-trust-contact-name");
  const showTrust = req.allowSaveTrustedContact === true;
  trustWrap.style.display = showTrust ? "flex" : "none";
  trustChk.checked = false;
  if (nameInput) nameInput.value = "";
  if (nameWrap) nameWrap.style.display = "none";

  const fromRow = document.getElementById("tx-from-account-row");
  const fromText = document.getElementById("tx-from-account-text");
  const btnSwitch = document.getElementById("btn-tx-switch-view");
  const isCross = req.isActiveAccount === false;
  if (isCross && req.fromAccountIndex != null && req.fromAccountIndex !== undefined) {
    fromRow.style.display = "flex";
    const nick =
      req.fromAccountNickname ||
      tKey("modals.tx.fromAccountFallback", { index: String(req.fromAccountIndex) });
    fromText.textContent = `${nick} · ${truncateEthAddress(req.fromAccountAddress || "")}`;
    btnSwitch.style.display = "inline-block";
  } else {
    fromRow.style.display = "none";
    btnSwitch.style.display = "none";
  }

  document.getElementById("modal-tx").classList.add("active");
}

function toggleBalanceExpand(element) {
  if (!element.classList.contains('multi-network')) {
    return;
  }
  element.classList.toggle('expanded');
}

async function updateBiometricButton() {
  const btn = document.getElementById("btn-biometric");
  const bioAvailable = await wapi().getBiometricAvailable();
  if (bioAvailable) {
    const label = await wapi().getBiometricLabel();
    btn.textContent = label
      ? tKey("common.biometric.useWithLabel", { label })
      : tKey("setup.unlock.biometricButton");
    btn.style.display = "block";
  } else {
    btn.style.display = "none";
  }
}

async function syncSettingsFromStatus(status) {
  try {
    const allowance = await wapi().getAllowance();
    document.getElementById("input-daily-limit").value = String(allowance.dailyLimitUSD);
    document.getElementById("input-per-tx-limit").value = String(allowance.perTxLimitUSD);
  } catch (_) {
    /* ignore */
  }
  try {
    const mode = await wapi().getLockMode();
    document.getElementById("select-lock-mode").value = mode;
  } catch (_) {
    /* ignore */
  }
  try {
    const canEnable = await wapi().canEnableBiometric();
    const bioCard = document.getElementById("biometric-card");
    if (canEnable) {
      bioCard.style.display = "flex";
      const bioAvailable = await wapi().getBiometricAvailable();
      document.getElementById("toggle-biometric").checked = bioAvailable;
      const label = await wapi().getBiometricLabel();
      document.getElementById("biometric-label").textContent =
        label || tKey("common.biometric.defaultUnlock");
    } else {
      bioCard.style.display = "none";
    }
  } catch (_) {
    /* ignore */
  }
}

function setupEventListeners() {
  // Setup screen
  document.getElementById("btn-create").onclick = () => {
    document.getElementById("password-title").textContent = tKey("setup.password.title");
    document.getElementById("password-desc").textContent = tKey("setup.password.description");
    document.getElementById("mnemonic-input-area").style.display = "none";
    document.getElementById("btn-password-submit").dataset.action = "create";
    showScreen("password");
  };

  document.getElementById("btn-import").onclick = () => {
    document.getElementById("password-title").textContent = tKey("setup.password.importTitle");
    document.getElementById("password-desc").textContent = tKey("setup.password.importDescription");
    document.getElementById("mnemonic-input-area").style.display = "block";
    document.getElementById("btn-password-submit").dataset.action = "import";
    showScreen("password");
  };

  document.getElementById("btn-password-back").onclick = () => showScreen("setup");

  document.getElementById("btn-password-submit").onclick = async () => {
    const password = document.getElementById("input-password").value;
    const confirm = document.getElementById("input-password-confirm").value;
    const errEl = document.getElementById("password-error");

    if (password.length < 8) {
      errEl.textContent = tKey('errors.password.tooShort');
      return;
    }
    if (password !== confirm) {
      errEl.textContent = tKey('errors.password.mismatch');
      return;
    }

    errEl.textContent = "";
    const action = document.getElementById("btn-password-submit").dataset.action;

    try {
      if (action === "create") {
        const result = await wapi().createWallet(password);
        showMnemonicScreen(result.mnemonic);
      } else {
        const mnemonic = document.getElementById("input-mnemonic").value.trim();
        if (!mnemonic) {
          errEl.textContent = tKey('errors.mnemonic.required');
          return;
        }
        await wapi().importWallet(mnemonic, password);
        const status = await wapi().getStatus();
        enterMainScreen(status);
      }
    } catch (err) {
      errEl.textContent = err.message;
    }
  };

  function showMnemonicScreen(mnemonic) {
    const grid = document.getElementById("mnemonic-display");
    renderMnemonicWords(grid, mnemonic);
    document.getElementById("mnemonic-confirmed").checked = false;
    document.getElementById("btn-mnemonic-done").disabled = true;
    showScreen("mnemonic");
  }

  document.getElementById("mnemonic-confirmed").onchange = (e) => {
    document.getElementById("btn-mnemonic-done").disabled = !e.target.checked;
  };

  document.getElementById("btn-mnemonic-done").onclick = async () => {
    const status = await wapi().getStatus();
    enterMainScreen(status);
  };

  // Unlock screen
  document.getElementById("btn-unlock").onclick = async () => {
    const password = document.getElementById("input-unlock-password").value;
    const errEl = document.getElementById("unlock-error");
    try {
      await wapi().unlock(password);
      const status = await wapi().getStatus();
      enterMainScreen(status);
    } catch (err) {
      const msg = err.message || "";
      errEl.textContent = /invalid password|incorrect password|wrong password|密码/i.test(msg)
        ? tKey("errors.password.incorrect")
        : tKey("errors.wallet.unlockFailed");
    }
  };

  document.getElementById("btn-biometric").onclick = async () => {
    try {
      await wapi().unlockBiometric();
      const status = await wapi().getStatus();
      enterMainScreen(status);
    } catch (err) {
      const msg = err.message || "";
      document.getElementById("unlock-error").textContent =
        /invalid password|incorrect password|wrong password|密码/i.test(msg)
          ? tKey("errors.password.incorrect")
          : tKey("errors.wallet.unlockFailed");
    }
  };

  // Tabs (bottom pill bar — 4 tabs: home, activity, pairing, settings)
  document.querySelectorAll(".tab-item").forEach(tab => {
    tab.onclick = async () => {
      document.querySelectorAll(".tab-item").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      const tabEl = document.getElementById(`tab-${tab.dataset.tab}`);
      if (tabEl) tabEl.classList.add("active");

      if (tab.dataset.tab === "home") {
        const status = await wapi().getStatus();
        if (status.address) {
          void syncHomeNetworkFilterFromConfig().finally(() => loadWalletBalances(status.address));
        }
      } else if (tab.dataset.tab === "activity") {
        loadActivityRecords(currentActivityFilter, true);
      } else if (tab.dataset.tab === "pairing") {
        loadPairedDevices();
        void refreshPairingCodeFromMain().catch((e) => console.error(e));
      } else if (tab.dataset.tab === "settings") {
        renderSettingsAccountsCard().catch((e) => console.error(e));
        loadSecurityEvents();
        loadSigningHistory();
        loadDesktopContacts();
      }
    };
  });

  // Refresh balances button
  document.getElementById("btn-refresh-balances").onclick = async () => {
    const status = await wapi().getStatus();
    if (status.address) {
      loadWalletBalances(status.address);
    }
  };

  // Pairing
  document.getElementById("btn-generate-code").onclick = async () => {
    try {
      const result = await wapi().generatePairCode();
      document.getElementById("pair-code").textContent = result.code;
      document.getElementById("pair-code-display").style.display = "block";
      startCountdown(result.expiresAt);

      // Auto-copy to clipboard with Agent-friendly prompt
      const agentPrompt = tKey("pairing.clipboardPrompt", { code: result.code });
      try {
        await navigator.clipboard.writeText(agentPrompt);
        showClipboardFeedback();
      } catch (clipErr) {
        console.error("Clipboard write failed:", clipErr);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  function showClipboardFeedback() {
    const feedback = document.getElementById("clipboard-feedback");
    if (!feedback) {
      const div = document.createElement("div");
      div.id = "clipboard-feedback";
      div.textContent = tKey('common.messages.copiedToClipboard');
      div.style.cssText = "position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #4caf50; color: white; padding: 10px 20px; border-radius: 4px; z-index: 10000;";
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 3000);
    }
  }

  // Settings
  document.getElementById("btn-save-allowance").onclick = async () => {
    await wapi().setAllowance({
      dailyLimitUSD: Number(document.getElementById("input-daily-limit").value),
      perTxLimitUSD: Number(document.getElementById("input-per-tx-limit").value),
      tokenWhitelist: ["ETH", "USDC", "USDT"],
      addressWhitelist: [],
    });
  };

  document.getElementById("select-lock-mode").onchange = async (e) => {
    await wapi().setLockMode(e.target.value);
  };

  document.getElementById("toggle-biometric").onchange = async (e) => {
    const toggle = e.target;
    if (!toggle.checked) {
      try { await wapi().setBiometricEnabled(false); } catch (err) {
        toggle.checked = true;
        showToast(err.message || tKey("errors.biometric.changeFailed"));
      }
      return;
    }
    // Enabling — ask for password via custom modal (prompt() not supported in Electron)
    toggle.checked = false; // revert until confirmed
    const password = await promptBiometricPassword();
    if (!password) return;
    try {
      await wapi().setBiometricEnabled(true, password);
      toggle.checked = true;
    } catch (err) {
      showToast(err.message || tKey("errors.biometric.changeFailed"));
    }
  };

  // Wire up biometric password modal
  const modalBio = document.getElementById("modal-biometric-password");
  document.getElementById("btn-biometric-cancel").onclick = () => {
    modalBio.classList.remove("active");
    if (window._biometricReject) { window._biometricReject(null); window._biometricReject = null; }
  };
  document.getElementById("btn-biometric-confirm").onclick = () => {
    const pw = document.getElementById("input-biometric-password").value;
    if (!pw) { document.getElementById("biometric-password-error").textContent = "Please enter your password."; return; }
    modalBio.classList.remove("active");
    if (window._biometricResolve) { window._biometricResolve(pw); window._biometricResolve = null; }
  };

  document.getElementById("btn-lock-wallet").onclick = async () => {
    await wapi().lock();
    showScreen("unlock");
  };

  const modalExport = document.getElementById("modal-export");
  document.getElementById("btn-export-mnemonic").onclick = () => {
    document.getElementById("input-export-password").value = "";
    document.getElementById("export-error").textContent = "";
    const disp = document.getElementById("export-mnemonic-display");
    disp.style.display = "none";
    disp.innerHTML = "";
    modalExport.classList.add("active");
  };

  document.getElementById("btn-export-cancel").onclick = () => {
    modalExport.classList.remove("active");
  };

  document.getElementById("btn-export-confirm").onclick = async () => {
    const pwd = document.getElementById("input-export-password").value;
    const errEl = document.getElementById("export-error");
    errEl.textContent = "";
    try {
      const { mnemonic } = await wapi().exportMnemonic(pwd);
      await navigator.clipboard.writeText(mnemonic.join(" "));
      modalExport.classList.remove("active");
      showClipboardFeedback();
    } catch (err) {
      errEl.textContent = err.message || String(err);
    }
  };

  // Transaction modal
  document.getElementById("chk-trust-after-success").onchange = (e) => {
    document.getElementById("tx-trust-name-wrap").style.display = e.target.checked ? "block" : "none";
  };

  document.getElementById("btn-approve-tx").onclick = async () => {
    if (currentTxRequest) {
      const trust = document.getElementById("chk-trust-after-success").checked;
      const nameEl = document.getElementById("input-trust-contact-name");
      const trustName = nameEl ? nameEl.value.trim() : "";
      if (trust && !trustName) {
        alert(tKey('common.contacts.nameRequired'));
        return;
      }
      await wapi().approveTransaction(currentTxRequest.requestId, {
        trustRecipientAfterSuccess: trust,
        ...(trust ? { trustRecipientName: trustName } : {}),
      });
      document.getElementById("modal-tx").classList.remove("active");
      currentTxRequest = null;
    }
  };

  document.getElementById("btn-contact-add-normal").onclick = async () => {
    if (currentContactAddRequest) {
      await wapi().respondContactAdd(currentContactAddRequest.requestId, "normal");
      document.getElementById("modal-contact-add").classList.remove("active");
      currentContactAddRequest = null;
    }
  };
  document.getElementById("btn-contact-add-trusted").onclick = async () => {
    if (currentContactAddRequest) {
      await wapi().respondContactAdd(currentContactAddRequest.requestId, "trusted");
      document.getElementById("modal-contact-add").classList.remove("active");
      currentContactAddRequest = null;
    }
  };
  document.getElementById("btn-contact-add-reject").onclick = async () => {
    if (currentContactAddRequest) {
      await wapi().respondContactAdd(currentContactAddRequest.requestId, "reject");
      document.getElementById("modal-contact-add").classList.remove("active");
      currentContactAddRequest = null;
    }
  };

  document.getElementById("btn-reject-tx").onclick = async () => {
    if (currentTxRequest) {
      await wapi().rejectTransaction(currentTxRequest.requestId);
      document.getElementById("modal-tx").classList.remove("active");
      currentTxRequest = null;
    } else {
      document.getElementById("modal-tx").classList.remove("active");
    }
  };

  document.getElementById("btn-tx-switch-view").onclick = async () => {
    if (!currentTxRequest || currentTxRequest.fromAccountIndex == null) return;
    try {
      await wapi().switchWalletAccount(currentTxRequest.fromAccountIndex);
      currentTxRequest = { ...currentTxRequest, isActiveAccount: true };
      showTxApprovalModal(currentTxRequest);
    } catch (e) {
      console.error(e);
    }
  };

  const accountSel = document.getElementById("account-selector");
  if (accountSel) {
    accountSel.addEventListener("change", async () => {
      const idx = parseInt(accountSel.value, 10);
      if (Number.isNaN(idx)) return;
      try {
        const st = await wapi().getStatus();
        if (idx === (st.activeAccountIndex ?? 0)) return;
        await wapi().switchWalletAccount(idx);
      } catch (e) {
        console.error(e);
        await refreshAccountHeader();
      }
    });
  }

  async function submitNewSubAccount(nicknameTrimmed) {
    try {
      await wapi().createWalletSubAccount(nicknameTrimmed || undefined);
      const st = await wapi().getStatus();
      const addrEl = document.getElementById("main-address");
      if (addrEl && st.address) addrEl.textContent = st.address;
      await refreshAccountHeader();
      await renderSettingsAccountsCard();
      if (st.address) loadWalletBalances(st.address);
    } catch (e) {
      alert(e.message || String(e));
    }
  }

  document.getElementById("btn-new-sub-account").onclick = async () => {
    const e2eNick = wapi().e2eSubAccountNickname;
    if (e2eNick) {
      await submitNewSubAccount(e2eNick.trim());
      return;
    }
    const modal = document.getElementById("modal-new-account");
    const inp = document.getElementById("input-new-account-nick");
    if (inp) inp.value = "";
    if (modal) modal.classList.add("active");
    inp?.focus();
  };

  document.getElementById("btn-new-account-cancel").onclick = () => {
    const modal = document.getElementById("modal-new-account");
    if (modal) modal.classList.remove("active");
  };

  document.getElementById("btn-new-account-confirm").onclick = async () => {
    const modal = document.getElementById("modal-new-account");
    const inp = document.getElementById("input-new-account-nick");
    const name = inp ? inp.value : "";
    if (modal) modal.classList.remove("active");
    await submitNewSubAccount(name.trim());
  };

  // Security alert modal
  document.getElementById("btn-alert-freeze").onclick = () => respondAlert("freeze");
  document.getElementById("btn-alert-allow").onclick = () => respondAlert("allow_once");
  document.getElementById("btn-alert-trust").onclick = () => respondAlert("trust");

  // Sub-page navigation
  const subpageBtn = (openId, subpageId, closeId, loadFn) => {
    document.getElementById(openId)?.addEventListener("click", () => {
      if (loadFn) loadFn();
      openSubpage(subpageId);
    });
    document.getElementById(closeId)?.addEventListener("click", () => closeSubpage(subpageId));
  };
  subpageBtn("btn-open-security-events", "subpage-security-events", "btn-close-security-events", loadSecurityEvents);
  subpageBtn("btn-open-signing-history", "subpage-signing-history", "btn-close-signing-history", loadSigningHistory);
  subpageBtn("btn-open-contacts", "subpage-contacts", "btn-close-contacts", loadDesktopContacts);

  // Settings: add account (settings page button)
  document.getElementById("btn-new-sub-account-settings")?.addEventListener("click", () => {
    document.getElementById("btn-new-sub-account").click();
  });

  // Settings: export mnemonic row
  document.getElementById("btn-export-mnemonic-row")?.addEventListener("click", () => {
    document.getElementById("btn-export-mnemonic").click();
  });

  // Theme toggle
  document.getElementById("toggle-dark-theme")?.addEventListener("change", (e) => {
    setTheme(e.target.checked ? "dark" : "light");
  });

  // TX rejection via confirm button (separate from close ×)
  document.getElementById("btn-reject-tx-confirm")?.addEventListener("click", async () => {
    if (currentTxRequest) {
      await wapi().rejectTransaction(currentTxRequest.requestId);
      document.getElementById("modal-tx").classList.remove("active");
      currentTxRequest = null;
    }
  });

  // Activity filter chips
  document.querySelectorAll("#tab-activity .chip[data-filter]").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#tab-activity .chip[data-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadActivityRecords(btn.dataset.filter, true);
    };
  });

  // Activity network filter
  initializeActivityNetworkFilter();

  // Activity load more
  document.getElementById("btn-load-more-activity").onclick = () => {
    loadActivityRecords(currentActivityFilter, false);
  };
}

async function respondAlert(action) {
  if (currentAlert) {
    await wapi().respondToAlert(currentAlert.alertId, action);
    document.getElementById("modal-alert").classList.remove("active");
    currentAlert = null;
  }
}

function setupRealtimeEvents() {
  wapi().onTransactionRequest((req) => {
    showTxApprovalModal(req);
  });

  wapi().onContactAddRequest((req) => {
    currentContactAddRequest = req;
    const summary = document.getElementById("contact-add-summary");
    summary.innerHTML = `
      <strong>${escapeHtml(req.name)}</strong><br>
      ${escapeHtml(tKey("modals.contactAdd.chainLine", { chain: req.chain }))}<br>
      <span class="address">${escapeHtml(req.address)}</span>
    `;
    document.getElementById("modal-contact-add").classList.add("active");
  });

  wapi().onConnectionStatus((status) => {
    document.querySelectorAll(".connection-dot").forEach(dot => {
      if (status.connected) {
        dot.classList.remove("disconnected");
        dot.classList.add("connected");
      } else {
        dot.classList.remove("connected");
        dot.classList.add("disconnected");
      }
    });
    const text = document.getElementById("connection-text");
    if (text) text.textContent = tKey(status.connected ? 'common.connection.connected' : 'common.connection.disconnected');
  });

  wapi().onSecurityAlert((alert) => {
    currentAlert = alert;
    document.getElementById("alert-message").textContent = alert.message;
    document.getElementById("modal-alert").classList.add("active");
    loadSecurityEvents();
  });

  wapi().onLockStateChange((locked) => {
    if (locked) {
      const ag = document.getElementById("account-header-group");
      if (ag) ag.style.display = "none";
      showScreen("unlock");
      updateBiometricButton();
    }
  });

  wapi().onWalletAccountChanged(async ({ address, accountIndex }) => {
    if (typeof accountIndex === "number") {
      currentAccountIndex = accountIndex;
    }
    const el = document.getElementById("main-address");
    if (el) el.textContent = address ?? "";

    await refreshAccountHeader().catch((e) => console.error(e));
    await renderSettingsAccountsCard().catch((e) => console.error(e));

    void syncHomeNetworkFilterFromConfig().finally(() => {
      if (address) loadWalletBalances(address);
    });

    try {
      const status = await wapi().getStatus();
      await syncSettingsFromStatus(status);
    } catch (_) {
      /* ignore */
    }

    // Re-load lists that are scoped by account (UI was stale after header switch)
    loadPairedDevices().catch((e) => console.error(e));
    void refreshPairingCodeFromMain().catch((e) => console.error(e));
    loadSecurityEvents().catch((e) => console.error(e));
    loadSigningHistory().catch((e) => console.error(e));
    loadActivityRecords(currentActivityFilter, true).catch((e) => console.error(e));
    loadDesktopContacts().catch((e) => console.error(e));
  });

  wapi().onBiometricPrompt(async (password) => {
    const label = await wapi().getBiometricLabel();
    const name = label || tKey("common.biometric.defaultUnlock");
    if (confirm(tKey("common.biometric.enableConfirm", { name }))) {
      try {
        await wapi().setBiometricEnabled(true, password);
      } catch (err) {
        console.error("Failed to enable biometric:", err);
      }
    }
  });
}

function resetPairingCodeUI() {
  if (pairingCountdownTimer != null) {
    clearInterval(pairingCountdownTimer);
    pairingCountdownTimer = null;
  }
  const displayEl = document.getElementById("pair-code-display");
  const codeEl = document.getElementById("pair-code");
  const countdownEl = document.getElementById("pair-countdown");
  if (displayEl) displayEl.style.display = "none";
  if (codeEl) codeEl.textContent = "";
  if (countdownEl) countdownEl.textContent = "";
}

async function refreshPairingCodeFromMain() {
  try {
    const pending = await wapi().getPendingPairing();
    if (!pending?.code) {
      resetPairingCodeUI();
      return;
    }
    let expiresAt = pending.expiresAt;
    if (expiresAt != null && expiresAt <= Date.now()) {
      resetPairingCodeUI();
      return;
    }
    if (expiresAt == null) {
      expiresAt = Date.now() + 10 * 60 * 1000;
    }
    const codeEl = document.getElementById("pair-code");
    const displayEl = document.getElementById("pair-code-display");
    if (codeEl) codeEl.textContent = pending.code;
    if (displayEl) displayEl.style.display = "block";
    startCountdown(expiresAt);
  } catch (e) {
    console.error(e);
    resetPairingCodeUI();
  }
}

async function loadPairedDevices() {
  const all = await wapi().getPairedDevices();
  const devices = all.filter((d) => d.accountIndex === currentAccountIndex);
  const list = document.getElementById("paired-devices-list");
  if (devices.length === 0) {
    list.innerHTML = `<p style="color: var(--text-secondary); padding: 16px 20px;">${tKey('pairing.noDevices')}</p>`;
    return;
  }
  list.innerHTML = devices.map(d => {
    const accountLabel = typeof d.accountIndex === "number" ? `Account ${d.accountIndex}` : "";
    const rowMeta = tKey("pairing.rowMeta", { ip: d.lastIP || "?", date: d.pairedAt ? new Date(d.pairedAt).toLocaleDateString() : "?" });
    const meta = [accountLabel, rowMeta].filter(Boolean).join(" · ");
    const nameDisplay = escapeHtml(d.deviceId.length > 18 ? d.deviceId.slice(0, 18) : d.deviceId);
    return `
      <div class="agent-row" onclick="revokeDevice('${escapeHtml(d.deviceId)}')">
        <div class="agent-icon">🔗</div>
        <div class="agent-info">
          <div class="agent-name">${nameDisplay}</div>
          <div class="agent-meta">${meta}</div>
        </div>
        <span class="agent-chevron">›</span>
      </div>
    `;
  }).join("");
}

window.revokeDevice = async (deviceId) => {
  await wapi().revokePairing(deviceId);
  loadPairedDevices();
};

async function loadDesktopContacts() {
  const list = document.getElementById("contacts-list");
  try {
    const rows = await wapi().listDesktopContacts(currentAccountIndex);
    if (!rows || rows.length === 0) {
      list.innerHTML = `<p style="padding:20px;color:var(--text-secondary)">${tKey("contactsPage.empty")}</p>`;
      return;
    }
    list.innerHTML = rows.map(c => {
      const initials = c.name.slice(0, 2).toUpperCase();
      const avatarClass = c.trusted ? "" : "regular";
      const badge = c.trusted
        ? `<span class="contact-badge">${escapeHtml(tKey('common.contacts.trusted'))}</span>`
        : "";
      const addrShort = c.address
        ? `${escapeHtml(c.address.slice(0, 6))}…${escapeHtml(c.address.slice(-4))}`
        : "";
      const trashSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
      return `
        <div class="contact-row">
          <div class="contact-avatar ${avatarClass}">${escapeHtml(initials)}</div>
          <div class="contact-info">
            <div class="contact-name-row">
              <span class="contact-name">${escapeHtml(c.name)}</span>
              ${badge}
            </div>
            <span class="contact-chain">${escapeHtml(c.chain)} · ${addrShort}</span>
          </div>
          <button class="contact-delete-btn" data-name="${escapeHtml(c.name)}" title="${escapeHtml(tKey('common.buttons.remove'))}">${trashSvg}</button>
        </div>`;
    }).join("");

    list.querySelectorAll(".contact-delete-btn").forEach(btn => {
      btn.onclick = async () => {
        const name = btn.dataset.name;
        if (!confirm(tKey('common.contacts.removeConfirm', { name }))) return;
        try {
          await wapi().removeDesktopContact(name, currentAccountIndex);
          await loadDesktopContacts();
        } catch (err) {
          alert(err.message || String(err));
        }
      };
    });
  } catch (err) {
    list.innerHTML = `<p style="padding:20px;color:var(--danger)">${escapeHtml(err.message || String(err))}</p>`;
  }
}

async function loadSecurityEvents() {
  const events = await wapi().getSecurityEvents();
  const list = document.getElementById("security-events-list");
  if (!events || events.length === 0) {
    list.innerHTML = `<p style="padding:20px;color:var(--text-secondary)">${tKey('security.events.noEvents')}</p>`;
    return;
  }
  const dotClass = (type) => {
    if (["fingerprint_change", "same_machine"].includes(type)) return "danger";
    if (["ip_change"].includes(type)) return "warning";
    if (["alert_response"].includes(type)) return "success";
    return "info";
  };
  list.innerHTML = events.slice(0, 50).map(e => `
    <div class="event-row">
      <div class="event-dot ${dotClass(e.type)}"></div>
      <div class="event-info">
        <div class="event-msg">${escapeHtml(e.message)}</div>
        <div class="event-time">${new Date(e.timestamp).toLocaleString()}</div>
      </div>
    </div>`).join("");
}

async function loadSigningHistory() {
  const list = document.getElementById("signing-history-list");
  list.innerHTML = buildSigningHistorySkeleton();

  let records;
  try {
    records = await wapi().getSigningHistory(currentAccountIndex);
  } catch (err) {
    list.innerHTML = buildSigningHistoryEmpty();
    return;
  }

  if (!records || records.length === 0) {
    list.innerHTML = buildSigningHistoryEmpty();
    return;
  }

  let lookup;
  try {
    lookup = buildContactLookup(await wapi().listDesktopContacts(currentAccountIndex));
  } catch {
    lookup = new Map();
  }

  const typeIconChar = { auto: "A", manual: "M", rejected: "✕" };

  list.innerHTML = records.slice(0, 100).map(record => {
    const type = record.type || "auto";
    const iconChar = typeIconChar[type] || "A";
    const typeLabel = escapeHtml(tKey(`activity.types.${type}`));
    const chain = escapeHtml(record.tx_chain || "");
    const token = escapeHtml(record.tx_token || "");
    const amount = formatTokenAmount(record.tx_value || "0", record.tx_token);
    const toAddr = record.tx_to;
    const match = toAddr && record.tx_chain ? lookup.get(contactRecipientKey(record.tx_chain, toAddr)) : null;
    const recipientLabel = match
      ? `${escapeHtml(match.name)}${match.trusted ? trustedContactBadgeHtml() : ""}`
      : (toAddr ? `${escapeHtml(toAddr.slice(0, 10))}...${escapeHtml(toAddr.slice(-8))}` : escapeHtml(tKey("activity.details.noRecipient")));
    const est = typeof record.estimated_usd === "number" ? record.estimated_usd : null;
    const isRejected = type === "rejected";

    return `
      <div class="signing-row">
        <div class="signing-type-icon ${type}">${iconChar}</div>
        <div class="signing-info">
          <div class="signing-label${isRejected ? " rejected" : ""}">${typeLabel}${chain ? ` · ${chain}` : ""}</div>
          <div class="signing-meta">${escapeHtml(tKey("activity.details.to"))}: ${recipientLabel}</div>
        </div>
        <div class="signing-amounts">
          <div class="signing-amount${isRejected ? " rejected" : ""}">${amount} ${token}</div>
          ${est !== null ? `<div class="signing-usd${isRejected ? " rejected" : ""}">$${est.toFixed(2)}</div>` : ""}
        </div>
      </div>`;
  }).join("");
}

function buildSigningHistorySkeleton() {
  const row = `
    <div class="signing-row">
      <div class="sk" style="width:36px;height:36px;border-radius:50%;flex-shrink:0;"></div>
      <div class="signing-info">
        <div class="sk" style="width:110px;height:14px;border-radius:6px;margin-bottom:6px;"></div>
        <div class="sk sk-dim" style="width:160px;height:12px;border-radius:6px;"></div>
      </div>
      <div class="signing-amounts" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div class="sk" style="width:70px;height:14px;border-radius:6px;"></div>
        <div class="sk sk-dim" style="width:50px;height:12px;border-radius:6px;"></div>
      </div>
    </div>`;
  return row.repeat(4);
}

function buildSigningHistoryEmpty() {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="9" y1="13" x2="15" y2="13"/>
          <line x1="9" y1="17" x2="11" y2="17"/>
        </svg>
      </div>
      <div class="empty-state-title">${tKey("security.history.noHistory")}</div>
      <div class="empty-state-desc">${tKey("security.history.noHistoryHint")}</div>
    </div>`;
}

function startCountdown(expiresAt) {
  if (pairingCountdownTimer != null) {
    clearInterval(pairingCountdownTimer);
    pairingCountdownTimer = null;
  }
  const el = document.getElementById("pair-countdown");
  const update = () => {
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    el.textContent = tKey("pairing.expiresIn", {
      time: `${min}:${sec.toString().padStart(2, "0")}`,
    });
    if (remaining <= 0) {
      el.textContent = tKey("pairing.codeExpired");
      document.getElementById("pair-code-display").style.display = "none";
      if (pairingCountdownTimer != null) {
        clearInterval(pairingCountdownTimer);
        pairingCountdownTimer = null;
      }
    }
  };
  update();
  pairingCountdownTimer = setInterval(() => {
    update();
    if (expiresAt <= Date.now()) {
      clearInterval(pairingCountdownTimer);
      pairingCountdownTimer = null;
    }
  }, 1000);
}

// ==========================================
// Activity Tab Functions
// ==========================================

let currentActivityFilter = "all";
let currentNetworkFilter = "all";
let activityOffset = 0;
const ACTIVITY_PAGE_SIZE = 50;

async function loadActivityRecords(filter = "all", reset = true) {
  if (reset) {
    activityOffset = 0;
  }

  currentActivityFilter = filter;
  const list = document.getElementById("activity-list");
  
  if (reset) {
    list.innerHTML = buildActivitySkeleton();
  }

  try {
    let lookup;
    try {
      lookup = buildContactLookup(await wapi().listDesktopContacts(currentAccountIndex));
    } catch {
      lookup = new Map();
    }

    let records;
    if (filter === "all") {
      records = await wapi().getActivityRecords(currentAccountIndex, ACTIVITY_PAGE_SIZE, activityOffset);
    } else if (["auto", "manual", "rejected"].includes(filter)) {
      records = await wapi().getActivityByType(currentAccountIndex, filter);
    } else if (["pending", "success", "failed"].includes(filter)) {
      records = await wapi().getActivityByStatus(currentAccountIndex, filter);
    }

    if (!records || records.length === 0) {
      list.innerHTML = `<p style="color: #888; text-align: center; padding: 20px;">${tKey('activity.noRecords')}</p>`;
      document.getElementById("activity-load-more").style.display = "none";
      return;
    }

    // Apply network filter
    if (currentNetworkFilter !== "all") {
      records = records.filter(record => record.tx_chain?.toLowerCase() === currentNetworkFilter.toLowerCase());
    }

    if (records.length === 0) {
      list.innerHTML = `<p style="color: #888; text-align: center; padding: 20px;">${tKey('activity.noRecords')}</p>`;
      document.getElementById("activity-load-more").style.display = "none";
      return;
    }

    if (reset) {
      list.innerHTML = "";
    }

    records.forEach((record) => {
      const recordEl = renderActivityRecord(record, lookup);
      list.appendChild(recordEl);
    });

    // Show/hide load more button
    if (filter === "all" && records.length === ACTIVITY_PAGE_SIZE && currentNetworkFilter === "all") {
      document.getElementById("activity-load-more").style.display = "block";
    } else {
      document.getElementById("activity-load-more").style.display = "none";
    }

    activityOffset += records.length;
  } catch (err) {
    console.error("Failed to load activity:", err);
    list.innerHTML = `<p style="color: red;">${escapeHtml(tKey("errors.activity.loadFailed"))}</p>`;
  }
}

function initializeActivityNetworkFilter() {
  const networkFilter = document.getElementById("activity-network-filter");
  if (!networkFilter) return;

  // Populate network options
  const networks = [
    { value: 'ethereum', label: 'Ethereum' },
    { value: 'base', label: 'Base' },
    { value: 'optimism', label: 'Optimism' },
    { value: 'arbitrum', label: 'Arbitrum' },
    { value: 'polygon', label: 'Polygon' },
    { value: 'zksync', label: 'zkSync Era' },
    { value: 'linea', label: 'Linea' },
    { value: 'scroll', label: 'Scroll' }
  ];

  // Clear existing options (except "All Networks")
  while (networkFilter.options.length > 1) {
    networkFilter.remove(1);
  }

  // Add network options
  networks.forEach(net => {
    const option = document.createElement('option');
    option.value = net.value;
    option.textContent = `${getNetworkIcon(net.value)} ${net.label}`;
    networkFilter.appendChild(option);
  });

  // Handle network filter change
  networkFilter.addEventListener('change', (e) => {
    currentNetworkFilter = e.target.value;
    loadActivityRecords(currentActivityFilter, true);
  });
}

function renderActivityRecord(record, contactLookup) {
  const div = document.createElement("div");
  div.className = "activity-row";

  const typeClass = record.type === "rejected" ? "rejected"
    : record.type === "auto" ? "auto"
    : "manual";
  const typeIconChar = record.type === "auto" ? "A"
    : record.type === "rejected" ? "✕"
    : "M";

  const typeLabel = escapeHtml(tKey(`activity.types.${record.type}`));
  const timestamp = formatRelativeTime(record.timestamp);
  const amount = formatTokenAmount(record.tx_value || "0", record.tx_token);

  const signedPolicyUsd = record.estimated_usd || 0;
  const match = record.tx_to && record.tx_chain && contactLookup
    ? contactLookup.get(contactRecipientKey(record.tx_chain, record.tx_to))
    : null;
  const toText = match
    ? escapeHtml(match.name)
    : record.tx_to
    ? `${escapeHtml(record.tx_to.slice(0, 6))}…${escapeHtml(record.tx_to.slice(-4))}`
    : "";

  const typeLabelFull = toText ? `${typeLabel} → ${toText}` : typeLabel;
  const chainName = record.tx_chain ? escapeHtml(record.tx_chain) : "";
  const metaText = [chainName, timestamp].filter(Boolean).join(" · ");

  const amountClass = record.type === "rejected" ? "rejected" : "";
  const amountText = `${amount} ${escapeHtml(record.tx_token || "")}`.trim();
  const usdText = signedPolicyUsd > 0 ? `$${signedPolicyUsd.toFixed(2)}` : "";

  div.innerHTML = `
    <div class="activity-type-icon ${typeClass}">${typeIconChar}</div>
    <div class="activity-info">
      <div class="activity-type-label">${typeLabelFull}</div>
      <div class="activity-meta">${metaText}</div>
    </div>
    <div class="activity-amounts">
      <div class="activity-amount ${amountClass}">${escapeHtml(amountText)}</div>
      ${usdText ? `<div class="activity-usd">${escapeHtml(usdText)}</div>` : ""}
    </div>
  `;

  return div;
}

function getBlockExplorerUrl(chain, txHash) {
  if (!txHash) return null;
  
  const explorers = {
    'ethereum': `https://etherscan.io/tx/${txHash}`,
    'base': `https://basescan.org/tx/${txHash}`,
    'optimism': `https://optimistic.etherscan.io/tx/${txHash}`,
    'arbitrum': `https://arbiscan.io/tx/${txHash}`,
    'polygon': `https://polygonscan.com/tx/${txHash}`,
    'zksync': `https://explorer.zksync.io/tx/${txHash}`,
    'linea': `https://lineascan.build/tx/${txHash}`,
    'scroll': `https://scrollscan.com/tx/${txHash}`,
  };
  
  return explorers[chain?.toLowerCase()] || null;
}

function getStatusIcon(record) {
  if (record.type === "rejected") return "❌";
  if (!record.tx_hash) return "📝"; // Signed but not broadcast
  if (record.tx_status === "success") return "✅";
  if (record.tx_status === "failed") return "⛔";
  if (record.tx_status === "pending") return "⏳";
  return "❓";
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return tKey("common.relativeTime.secondsAgo", { count: seconds });
  if (minutes < 60) return tKey("common.relativeTime.minutesAgo", { count: minutes });
  if (hours < 24) return tKey("common.relativeTime.hoursAgo", { count: hours });
  return tKey("common.relativeTime.daysAgo", { count: days });
}

/**
 * Update all static UI elements with current language
 */
function updateStaticTexts() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = tKey(key);
    
    if (el.tagName === 'INPUT' && el.type === 'button') {
      el.value = translation;
    } else {
      el.textContent = translation;
    }
  });

  document.querySelectorAll("option[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = tKey(key);
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = tKey(key);
  });
  
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = tKey(key);
  });

  document.title = tKey("modals.app.title");
}

function applyPasswordScreenI18n() {
  const action = document.getElementById("btn-password-submit")?.dataset?.action;
  const titleEl = document.getElementById("password-title");
  const descEl = document.getElementById("password-desc");
  if (!titleEl || !descEl) return;
  if (action === "import") {
    titleEl.textContent = tKey("setup.password.importTitle");
    descEl.textContent = tKey("setup.password.importDescription");
  } else {
    titleEl.textContent = tKey("setup.password.title");
    descEl.textContent = tKey("setup.password.description");
  }
}

async function refreshDynamicI18n() {
  await updateBiometricButton();
  const main = document.getElementById("screen-main");
  if (main?.classList.contains("active")) {
    const activeTab = document.querySelector(".tab-item.active");
    const tab = activeTab?.dataset.tab;
    try {
      if (tab === "pairing") {
        await loadPairedDevices();
        await refreshPairingCodeFromMain().catch((e) => console.error(e));
      } else if (tab === "activity") {
        await loadActivityRecords(currentActivityFilter, true);
      } else if (tab === "settings") {
        await loadSecurityEvents();
        await loadSigningHistory();
        await loadDesktopContacts();
      } else if (tab === "home") {
        const status = await wapi().getStatus();
        if (status.address) await loadWalletBalances(status.address);
      }
    } catch (e) {
      console.error("refreshDynamicI18n:", e);
    }
  }
  const pwd = document.getElementById("screen-password");
  if (pwd?.classList.contains("active")) applyPasswordScreenI18n();
}

/**
 * Initialize i18n on app startup
 */
async function initializeI18n() {
  await initI18n();
  updateStaticTexts();
  initializeLanguageSwitcher();
}

/**
 * Initialize language switcher UI component
 */
function initializeLanguageSwitcher() {
  const selector = document.getElementById('language-selector');
  if (!selector) return;
  
  selector.value = i18next.language;
  
  selector.addEventListener('change', async (e) => {
    const newLang = e.target.value;
    const appRoot = document.getElementById("app");

    selector.disabled = true;
    appRoot?.classList.add("i18n-switching");

    try {
      await changeLanguage(newLang);
      updateStaticTexts();
      await refreshDynamicI18n();
      console.log(`Language changed to: ${newLang}`);
    } catch (err) {
      console.error('Failed to change language:', err);
      selector.value = i18next.language;
    } finally {
      selector.disabled = false;
      appRoot?.classList.remove("i18n-switching");
    }
  });
}

// ============================================================
// THEME SYSTEM
// ============================================================

function initTheme() {
  const saved = localStorage.getItem('claw-theme') || 'light';
  applyTheme(saved);
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const toggle = document.getElementById('toggle-dark-theme');
  if (toggle) toggle.checked = (theme === 'dark');
}

function setTheme(theme) {
  localStorage.setItem('claw-theme', theme);
  applyTheme(theme);
}

// ============================================================
// SUB-PAGE NAVIGATION (within Settings)
// ============================================================

function openSubpage(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeSubpage(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

// Call initTheme before first render
initTheme();
init();
