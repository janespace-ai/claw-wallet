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
  // Clear unlock password immediately after successful authentication
  const pwd = document.getElementById("input-unlock-password");
  const err = document.getElementById("unlock-error");
  if (pwd) pwd.value = "";
  if (err) err.textContent = "";
  currentAccountIndex = typeof status.activeAccountIndex === "number" ? status.activeAccountIndex : 0;
  showScreen("main");
  // Restore account header group visibility (may have been hidden on lock)
  const ag = document.getElementById("account-header-group");
  if (ag) ag.style.display = "";
  document.getElementById("main-address").textContent = status.address;
  if (status.sameMachineWarning) {
    document.getElementById("same-machine-warning").style.display = "block";
  }
  loadSecurityEvents();
  loadSigningHistory();
  syncSettingsFromStatus(status);
  void syncHomeNetworkFilterFromConfig().finally(() => loadWalletBalances(status.address));
  initializeNetworkFilter();
  refreshAccountHeader().catch((e) => console.error(e));
}

let currentBalances = [];
let currentPrices = {};
let currentAddress = '';
/** Cleared on account switch and when applying a new pairing countdown */
let pairingCountdownTimer = null;

function setLockModeDisplay(mode) {
  const display = document.getElementById("lock-mode-display");
  if (display) display.textContent = tKey(`settings.lockMode.option${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
  document.querySelectorAll("#lock-mode-picker .custom-picker-option").forEach(opt => {
    opt.classList.toggle("selected", opt.dataset.value === mode);
  });
}
let pairCodeAutoHideTimer = null;
let agentStatus = { paired: false, online: false };
let currentPairCode = null;

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

function closeHomeNetworkPicker() {
  const picker = document.getElementById("home-network-picker");
  if (picker) picker.style.display = "none";
  document.getElementById("home-network-btn")?.classList.remove("active");
}

function buildHomeNetworkPicker() {
  const picker = document.getElementById("home-network-picker");
  const networkFilter = document.getElementById("network-filter");
  if (!picker || !networkFilter) return;

  const checkSvg = `<svg class="network-picker-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const netColors = { ethereum:"#627EEA", base:"#0052FF", optimism:"#FF0420", arbitrum:"#28A0F0", polygon:"#8247E5", zksync:"#8C8DFC", linea:"#61DFFF", scroll:"#FFDBB0" };
  const current = networkFilter.value || "all";

  const allOption = `<div class="network-picker-option${current === "all" ? " selected" : ""}" data-value="all">
    <span class="network-picker-dot" style="background:var(--text-secondary);opacity:0.4"></span>
    <span class="network-picker-name">${escapeHtml(tKey("common.home.allNetworks"))}</span>
    ${checkSvg}
  </div>`;

  const netOptions = Array.from(networkFilter.options)
    .filter(o => o.value !== "all")
    .map(o => {
      const color = netColors[o.value.toLowerCase()] || "var(--text-secondary)";
      const sel = current === o.value;
      return `<div class="network-picker-option${sel ? " selected" : ""}" data-value="${escapeHtml(o.value)}">
        <span class="network-picker-dot" style="background:${color}"></span>
        <span class="network-picker-name">${escapeHtml(o.text || o.value)}</span>
        ${checkSvg}
      </div>`;
    }).join("");

  picker.innerHTML = allOption + netOptions;

  picker.querySelectorAll(".network-picker-option").forEach(opt => {
    opt.addEventListener("click", () => {
      const val = opt.dataset.value;
      networkFilter.value = val;
      networkFilter.dispatchEvent(new Event("change"));
      closeHomeNetworkPicker();
    });
  });
}

function updateHomeNetworkLabel() {
  const networkFilter = document.getElementById("network-filter");
  const label = document.getElementById("home-network-label");
  if (!label || !networkFilter) return;
  const val = networkFilter.value || "all";
  label.textContent = val === "all"
    ? tKey("common.home.allNetworks")
    : (Array.from(networkFilter.options).find(o => o.value === val)?.text || val);
}

function initializeNetworkFilter() {
  const networkFilter = document.getElementById('network-filter');
  const hideZeroBalances = document.getElementById('hide-zero-balances');
  const btn = document.getElementById("home-network-btn");
  const picker = document.getElementById("home-network-picker");

  if (networkFilter) {
    networkFilter.addEventListener('change', () => {
      updateHomeNetworkLabel();
      if (currentBalances.length > 0) renderBalances(currentBalances, currentPrices);
    });
  }

  // Home network picker button
  if (btn && picker) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (picker.style.display !== "none") { closeHomeNetworkPicker(); return; }
      buildHomeNetworkPicker();
      const rect = btn.getBoundingClientRect();
      picker.style.width = "190px";
      picker.style.left = (rect.right - 190) + "px";
      picker.style.top = (rect.bottom + 4) + "px";
      picker.style.display = "block";
      btn.classList.add("active");
    });

    document.addEventListener("click", (e) => {
      if (!picker.contains(e.target) && e.target !== btn) closeHomeNetworkPicker();
    });
  }

  if (hideZeroBalances) {
    hideZeroBalances.addEventListener('change', () => {
      if (currentBalances.length > 0) renderBalances(currentBalances, currentPrices);
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
    updateHomeNetworkLabel();
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

function showCopyToast(anchorEl) {
  const existing = document.getElementById("copy-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "copy-toast";
  toast.textContent = "已复制";
  document.body.appendChild(toast);

  const rect = anchorEl.getBoundingClientRect();
  toast.style.left = `${rect.left + rect.width / 2 - toast.offsetWidth / 2}px`;
  toast.style.top = `${rect.top - toast.offsetHeight - 8}px`;

  toast.classList.add("copy-toast-show");
  setTimeout(() => toast.classList.add("copy-toast-hide"), 1000);
  setTimeout(() => toast.remove(), 1400);
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
  const nameEl = document.getElementById("account-header-name");
  const btnNew = document.getElementById("btn-new-sub-account");
  if (!wrap) return;
  try {
    const accounts = await wapi().listWalletAccounts();
    const active = accounts.find(a => a.isActive) || accounts[0];

    // Update centered account name
    if (active && nameEl) {
      nameEl.textContent = active.nickname || truncateEthAddress(active.address);
    }

    // Disable add button at account limit
    if (btnNew) {
      btnNew.disabled = accounts.length >= 10;
      btnNew.title = accounts.length >= 10 ? tKey("common.accounts.maxReached") : "";
    }

    // Populate dropdown list
    const list = document.getElementById("account-dropdown-list");
    if (list) {
      list.innerHTML = accounts.map(a => {
        const label = escapeHtml(a.nickname || `Account ${a.index}`);
        const initials = (a.nickname || `A${a.index}`).slice(0, 2).toUpperCase();
        const addr = escapeHtml(truncateEthAddress(a.address));
        const isActive = a.isActive;
        return `
          <div class="acct-dropdown-row" data-index="${a.index}">
            <div class="acct-dropdown-row-left">
              <div class="acct-dropdown-avatar${isActive ? " active" : ""}">${escapeHtml(initials)}</div>
              <div class="acct-dropdown-info">
                <span class="acct-dropdown-name">${label}</span>
                <span class="acct-dropdown-addr">${addr}</span>
              </div>
            </div>
            ${isActive ? '<span class="acct-dropdown-check">✓</span>' : ''}
          </div>`;
      }).join("");

      // Row click → switch account
      list.querySelectorAll(".acct-dropdown-row").forEach(row => {
        row.addEventListener("click", async () => {
          const idx = parseInt(row.dataset.index, 10);
          closeAccountDropdown();
          try {
            const st = await wapi().getStatus();
            if (idx === (st.activeAccountIndex ?? 0)) return;
            await wapi().switchWalletAccount(idx);
          } catch (e) {
            console.error(e);
            await refreshAccountHeader();
          }
        });
      });
    }
  } catch (e) {
    console.error("refreshAccountHeader:", e);
  }
}

function openAccountDropdown() {
  const panel = document.getElementById("account-dropdown-panel");
  if (!panel) return;
  panel.classList.add("open");
  // Scrim to close on outside click
  const scrim = document.createElement("div");
  scrim.className = "acct-dropdown-scrim";
  scrim.id = "acct-dropdown-scrim";
  scrim.addEventListener("click", closeAccountDropdown);
  document.body.appendChild(scrim);
}

function closeAccountDropdown() {
  document.getElementById("account-dropdown-panel")?.classList.remove("open");
  document.getElementById("acct-dropdown-scrim")?.remove();
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
    setLockModeDisplay(mode);
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
      } else if (tab.dataset.tab === "contacts") {
        loadContactsTab();
      } else if (tab.dataset.tab === "settings") {
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

  // Agent status button
  document.getElementById("btn-agent-status")?.addEventListener("click", async () => {
    if (agentStatus.online) {
      const confirmed = confirm(tKey("home.agent.repairConfirm"));
      if (!confirmed) return;
    }
    await generateAndShowPairCode();
  });

  // Pair code close button
  document.getElementById("btn-pair-code-close")?.addEventListener("click", () => {
    hidePairCodeCard();
  });


  // Settings
  document.getElementById("btn-save-allowance").onclick = async () => {
    try {
      await wapi().setAllowance({
        dailyLimitUSD: Number(document.getElementById("input-daily-limit").value),
        perTxLimitUSD: Number(document.getElementById("input-per-tx-limit").value),
        tokenWhitelist: ["ETH", "USDC", "USDT"],
        addressWhitelist: [],
      });
      showToast(tKey("settings.allowance.saved"));
    } catch (err) {
      showToast(tKey("common.messages.saveFailed"));
      console.error("setAllowance failed:", err);
    }
  };

  // Custom lock-mode picker
  function closeLockModePicker() {
    document.getElementById("lock-mode-picker").style.display = "none";
    document.removeEventListener("click", closeLockModePickerOutside, true);
  }

  function closeLockModePickerOutside(e) {
    const picker = document.getElementById("lock-mode-picker");
    const row = document.getElementById("row-lock-mode");
    if (!picker.contains(e.target) && !row.contains(e.target)) closeLockModePicker();
  }

  document.getElementById("row-lock-mode").addEventListener("click", () => {
    const picker = document.getElementById("lock-mode-picker");
    const row = document.getElementById("row-lock-mode");
    if (picker.style.display !== "none") { closeLockModePicker(); return; }
    const rect = row.getBoundingClientRect();
    picker.style.display = "block";
    // Position: right-align to row, just below it
    const pickerW = 260;
    picker.style.width = pickerW + "px";
    picker.style.left = Math.max(8, rect.right - pickerW) + "px";
    picker.style.top = rect.bottom + 4 + "px";
    setTimeout(() => document.addEventListener("click", closeLockModePickerOutside, true), 0);
  });

  document.querySelectorAll("#lock-mode-picker .custom-picker-option").forEach(opt => {
    opt.addEventListener("click", async () => {
      const mode = opt.dataset.value;
      setLockModeDisplay(mode);
      closeLockModePicker();
      await wapi().setLockMode(mode);
    });
  });

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
      // Clear declined flag so future prompts can show if biometric is toggled off again
      localStorage.removeItem("biometric-prompt-declined");
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

  function openExportModal() {
    document.getElementById("input-export-password").value = "";
    document.getElementById("export-error").textContent = "";
    document.getElementById("export-mnemonic-display").innerHTML = "";
    document.getElementById("export-phase-password").style.display = "flex";
    document.getElementById("export-phase-mnemonic").style.display = "none";
    modalExport.classList.add("active");
  }

  document.getElementById("btn-export-mnemonic").onclick = openExportModal;

  // Phase 1: cancel
  document.getElementById("btn-export-cancel").onclick = () => {
    modalExport.classList.remove("active");
  };

  // Phase 1: confirm password → show mnemonic
  document.getElementById("btn-export-confirm").onclick = async () => {
    const pwd = document.getElementById("input-export-password").value;
    const errEl = document.getElementById("export-error");
    errEl.textContent = "";
    try {
      const { mnemonic } = await wapi().exportMnemonic(pwd);
      const words = Array.isArray(mnemonic) ? mnemonic : mnemonic.split(" ");
      renderMnemonicWords(document.getElementById("export-mnemonic-display"), words.join(" "));
      document.getElementById("export-phase-password").style.display = "none";
      document.getElementById("export-phase-mnemonic").style.display = "flex";
      modalExport._exportedMnemonic = words.join(" ");
    } catch (err) {
      const msg = err?.message || String(err);
      const isWrongPwd = /password|incorrect|invalid|wrong|unauthorized/i.test(msg);
      errEl.textContent = isWrongPwd
        ? tKey("modals.export.wrongPassword")
        : tKey("messages.saveFailed");
    }
  };

  // Phase 2: copy mnemonic → toast + close
  document.getElementById("btn-export-copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText(modalExport._exportedMnemonic || "");
    } catch (_) { /* ignore */ }
    modalExport.classList.remove("active");
    showToast(tKey("modals.export.copied"));
  };

  // Phase 2: close
  document.getElementById("btn-export-close").onclick = () => {
    modalExport.classList.remove("active");
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

  // Account dropdown toggle
  document.getElementById("btn-account-dropdown")?.addEventListener("click", () => {
    const panel = document.getElementById("account-dropdown-panel");
    if (panel?.classList.contains("open")) {
      closeAccountDropdown();
    } else {
      openAccountDropdown();
    }
  });

  async function submitNewSubAccount(nicknameTrimmed) {
    try {
      await wapi().createWalletSubAccount(nicknameTrimmed || undefined);
      const st = await wapi().getStatus();
      const addrEl = document.getElementById("main-address");
      if (addrEl && st.address) addrEl.textContent = st.address;
      await refreshAccountHeader();
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
  // contacts is now a top-level tab, not a sub-page

  // Settings: export mnemonic row
  document.getElementById("btn-export-mnemonic-row")?.addEventListener("click", () => {
    document.getElementById("btn-export-mnemonic").click();
  });

  // Theme segmented control
  document.querySelectorAll(".theme-seg-btn").forEach(btn => {
    btn.addEventListener("click", () => setTheme(btn.dataset.themeVal));
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

  // TX detail modal close
  document.getElementById("btn-tx-detail-close")?.addEventListener("click", () => {
    document.getElementById("modal-tx-detail").classList.remove("active");
  });
  document.getElementById("modal-tx-detail")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-tx-detail")) {
      document.getElementById("modal-tx-detail").classList.remove("active");
    }
  });

  // Biometric enable confirmation modal
  document.getElementById("btn-biometric-enable-confirm")?.addEventListener("click", async () => {
    const modal = document.getElementById("modal-biometric-enable");
    const password = modal._pendingPassword;
    modal.classList.remove("active");
    modal._pendingPassword = null;
    if (password) {
      try {
        await wapi().setBiometricEnabled(true, password);
      } catch (err) {
        console.error("Failed to enable biometric:", err);
      }
    }
  });
  document.getElementById("btn-biometric-enable-cancel")?.addEventListener("click", () => {
    const modal = document.getElementById("modal-biometric-enable");
    modal.classList.remove("active");
    modal._pendingPassword = null;
    // Remember user's choice — don't prompt again
    localStorage.setItem("biometric-prompt-declined", "1");
  });

  // Contact delete modal buttons
  document.getElementById("btn-contact-delete-confirm")?.addEventListener("click", async () => {
    const name = _pendingDeleteName;
    if (!name) return;
    document.getElementById("modal-contact-delete").classList.remove("active");
    _pendingDeleteName = null;
    try {
      await wapi().removeDesktopContact(name, currentAccountIndex);
      await loadContactsTab();
    } catch (err) {
      showToast(err.message || String(err));
    }
  });
  document.getElementById("btn-contact-delete-cancel")?.addEventListener("click", () => {
    document.getElementById("modal-contact-delete").classList.remove("active");
    _pendingDeleteName = null;
  });

  // Contact detail modal buttons
  document.getElementById("btn-contact-detail-copy")?.addEventListener("click", async () => {
    const addr = _currentDetailContact?.address || "";
    try { await navigator.clipboard.writeText(addr); } catch (_) {}
    document.getElementById("modal-contact-detail").classList.remove("active");
    showToast(tKey("common.contacts.detailModal.copied"));
  });
  document.getElementById("btn-contact-detail-cancel")?.addEventListener("click", () => {
    document.getElementById("modal-contact-detail").classList.remove("active");
  });

  // Contact trust picker options
  document.getElementById("contact-trust-picker")?.querySelectorAll(".custom-picker-option").forEach(opt => {
    opt.addEventListener("click", async () => {
      if (!_trustPickerTarget) return;
      const newTrusted = opt.dataset.trust === "true";
      const { name } = _trustPickerTarget;
      closeContactTrustPicker();
      try {
        await wapi().updateDesktopContactTrust(name, newTrusted, currentAccountIndex);
        await loadContactsTab();
      } catch (err) {
        showToast(err.message || String(err));
      }
    });
  });
  document.getElementById("contact-trust-picker-cancel")?.addEventListener("click", closeContactTrustPicker);
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
    const label = tKey(status.connected ? 'common.connection.connected' : 'common.connection.disconnected');
    document.querySelectorAll(".connection-dot").forEach(dot => {
      if (status.connected) {
        dot.classList.remove("disconnected");
        dot.classList.add("connected");
      } else {
        dot.classList.remove("connected");
        dot.classList.add("disconnected");
      }
      // Update every dot's text span so all indicators stay in sync
      const span = dot.querySelector("span");
      if (span) span.textContent = label;
    });
  });

  wapi().onAgentStatus((status) => {
    agentStatus = status;
    renderAgentStatusBtn();
    if (status.online) {
      hidePairCodeCard();
    }
  });

  wapi().onSecurityAlert((alert) => {
    currentAlert = alert;
    const localizedMsg = tKey(`security.alertMessages.${alert.type}`);
    document.getElementById("alert-message").textContent = localizedMsg || alert.message;
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
    closeAccountDropdown();
    hidePairCodeCard();
    if (typeof accountIndex === "number") {
      currentAccountIndex = accountIndex;
    }
    const el = document.getElementById("main-address");
    if (el) el.textContent = address ?? "";

    await refreshAccountHeader().catch((e) => console.error(e));

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
    loadSecurityEvents().catch((e) => console.error(e));
    loadSigningHistory().catch((e) => console.error(e));
    loadActivityRecords(currentActivityFilter, true).catch((e) => console.error(e));
    loadDesktopContacts().catch((e) => console.error(e));
  });

  wapi().onBiometricPrompt(async (password) => {
    // Respect user's previous decline — don't prompt again
    if (localStorage.getItem("biometric-prompt-declined") === "1") return;
    const label = await wapi().getBiometricLabel();
    const name = label || tKey("common.biometric.defaultUnlock");
    const modal = document.getElementById("modal-biometric-enable");
    document.getElementById("biometric-enable-body").textContent =
      tKey("common.biometric.enableConfirm", { name });
    modal._pendingPassword = password;
    modal.classList.add("active");
  });
}


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
  const el = document.getElementById("pair-code-countdown");
  const update = () => {
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    if (el) el.textContent = tKey("pairing.expiresIn", {
      time: `${min}:${sec.toString().padStart(2, "0")}`,
    });
    if (remaining <= 0) {
      if (el) el.textContent = tKey("pairing.codeExpired");
      hidePairCodeCard();
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

let toastHideTimer = null;
function showToast(message) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "app-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  if (toastHideTimer != null) {
    clearTimeout(toastHideTimer);
    toastHideTimer = null;
  }
  // Force reflow so transition plays even on re-show
  toast.classList.remove("visible");
  void toast.offsetWidth;
  toast.classList.add("visible");
  toastHideTimer = setTimeout(() => {
    toast.classList.remove("visible");
    toastHideTimer = null;
  }, 3000);
}

function renderAgentStatusBtn() {
  const btn = document.getElementById("btn-agent-status");
  const label = document.getElementById("agent-status-label");
  if (!btn) return;
  btn.classList.remove("unpaired", "offline", "online");
  const icon = btn.querySelector("svg");
  if (agentStatus.online) {
    btn.classList.add("online");
    if (icon) icon.style.display = "none";
    if (label) label.setAttribute("data-i18n", "home.agent.online");
    if (label) label.textContent = tKey("home.agent.online");
  } else if (agentStatus.paired) {
    btn.classList.add("offline");
    if (icon) icon.style.display = "none";
    if (label) label.setAttribute("data-i18n", "home.agent.offline");
    if (label) label.textContent = tKey("home.agent.offline");
  } else {
    btn.classList.add("unpaired");
    if (icon) icon.style.display = "";
    if (label) label.setAttribute("data-i18n", "home.agent.unpaired");
    if (label) label.textContent = tKey("home.agent.unpaired");
  }
}

async function generateAndShowPairCode() {
  try {
    const result = await wapi().generatePairCode();
    currentPairCode = result.code;
    const codeEl = document.getElementById("pair-code-value");
    const card = document.getElementById("pair-code-card");
    if (codeEl) codeEl.textContent = result.code;
    if (card) card.style.display = "flex";
    startCountdown(result.expiresAt);

    // Auto-copy to clipboard and show toast
    const agentPrompt = tKey("pairing.clipboardPrompt", { code: result.code });
    try {
      await navigator.clipboard.writeText(agentPrompt);
      showToast(tKey("home.agent.pairCode.copied"));
    } catch (e) {
      console.error("Auto-copy failed:", e);
    }

    // Auto-hide card after 5 seconds
    if (pairCodeAutoHideTimer != null) clearTimeout(pairCodeAutoHideTimer);
    pairCodeAutoHideTimer = setTimeout(() => {
      pairCodeAutoHideTimer = null;
      hidePairCodeCard();
    }, 10000);
  } catch (err) {
    console.error("generatePairCode failed:", err);
    alert(err.message || String(err));
  }
}

function hidePairCodeCard() {
  const card = document.getElementById("pair-code-card");
  if (card) card.style.display = "none";
  if (pairingCountdownTimer != null) {
    clearInterval(pairingCountdownTimer);
    pairingCountdownTimer = null;
  }
  if (pairCodeAutoHideTimer != null) {
    clearTimeout(pairCodeAutoHideTimer);
    pairCodeAutoHideTimer = null;
  }
  currentPairCode = null;
}

// ── Contact trust picker ──────────────────────────────────────
let _trustPickerTarget = null; // { name, trusted, rowEl }

function closeContactTrustPicker() {
  const picker = document.getElementById("contact-trust-picker");
  if (picker) picker.style.display = "none";
  _trustPickerTarget = null;
}

function openContactTrustPicker(name, trusted, anchorEl) {
  const picker = document.getElementById("contact-trust-picker");
  if (!picker) return;

  // Update title and selection state
  document.getElementById("contact-trust-picker-title").textContent = tKey("common.contacts.trustPicker.title");
  picker.querySelectorAll(".custom-picker-option").forEach(opt => {
    const isTrusted = opt.dataset.trust === "true";
    opt.classList.toggle("selected", isTrusted === trusted);
  });

  // Position near anchor
  const rect = anchorEl.getBoundingClientRect();
  const pickerW = 240;
  let left = rect.right - pickerW;
  if (left < 8) left = 8;
  const top = rect.bottom + 6;
  picker.style.width = pickerW + "px";
  picker.style.left = left + "px";
  picker.style.top = top + "px";
  picker.style.display = "block";

  _trustPickerTarget = { name, trusted };
}

document.addEventListener("click", (e) => {
  const picker = document.getElementById("contact-trust-picker");
  if (picker && picker.style.display !== "none" && !picker.contains(e.target)) {
    closeContactTrustPicker();
  }
});

// ── Contact delete modal ──────────────────────────────────────
let _pendingDeleteName = null;

function openContactDeleteModal(name) {
  _pendingDeleteName = name;
  document.getElementById("contact-delete-body").textContent =
    tKey("common.contacts.deleteModal.body", { name });
  document.getElementById("modal-contact-delete").classList.add("active");
}

// ── Contact detail modal ──────────────────────────────────────
let _currentDetailContact = null;

function openContactDetailModal(contact) {
  _currentDetailContact = contact;
  const initials = (contact.name || contact.address).slice(0, 2).toUpperCase();
  const avatarEl = document.getElementById("contact-detail-avatar");
  avatarEl.textContent = initials;
  avatarEl.style.background = contact.trusted ? "var(--success)" : "var(--accent)";

  document.getElementById("contact-detail-name").textContent = contact.name;
  const badge = document.getElementById("contact-detail-badge");
  badge.style.display = contact.trusted ? "inline-block" : "none";
  document.getElementById("contact-detail-chain").textContent = contact.chain || "";
  document.getElementById("contact-detail-addr").textContent = contact.address || "";
  document.getElementById("modal-contact-detail").classList.add("active");
}

async function loadContactsTab() {
  const list = document.getElementById("contacts-list-main");
  if (!list) return;

  const agentHintHtml = `
    <div class="contact-agent-hint">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span>${escapeHtml(tKey("common.contacts.agentHint"))}</span>
    </div>`;

  try {
    const rows = await wapi().listDesktopContacts(currentAccountIndex);
    if (!rows || rows.length === 0) {
      list.innerHTML = `<p style="padding:24px 20px 8px;color:var(--text-secondary);font-size:14px;">${escapeHtml(tKey("contactsPage.empty") || "暂无联系人")}</p>${agentHintHtml}`;
      return;
    }

    const shieldSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    const trashSvg  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

    list.innerHTML = rows.map(c => {
      const initials = (c.name || c.address).slice(0, 2).toUpperCase();
      const badge = c.trusted
        ? `<span class="contact-badge">${escapeHtml(tKey("common.contacts.trusted"))}</span>`
        : "";
      const addrShort = c.address
        ? `${escapeHtml(c.address.slice(0, 6))}…${escapeHtml(c.address.slice(-4))}`
        : "";
      const avatarClass = c.trusted ? "" : "regular";
      const trustBtnClass = `contact-action-btn trust${c.trusted ? " is-trusted" : ""}`;
      return `
        <div class="contact-row" data-name="${escapeHtml(c.name)}" data-address="${escapeHtml(c.address)}" data-chain="${escapeHtml(c.chain || "")}" data-trusted="${c.trusted}" style="cursor:pointer">
          <div class="contact-avatar ${avatarClass}">${escapeHtml(initials)}</div>
          <div class="contact-info">
            <div class="contact-name-row">
              <span class="contact-name">${escapeHtml(c.name)}</span>
              ${badge}
            </div>
            <span class="contact-chain">${escapeHtml(addrShort)}</span>
          </div>
          <div class="contact-actions">
            <button class="${trustBtnClass}" data-name="${escapeHtml(c.name)}" data-trusted="${c.trusted}" title="${escapeHtml(tKey("common.contacts.trustPicker.title"))}">${shieldSvg}</button>
            <button class="contact-action-btn delete" data-name="${escapeHtml(c.name)}" title="${escapeHtml(tKey("common.contacts.deleteModal.confirm"))}">${trashSvg}</button>
          </div>
        </div>`;
    }).join("") + agentHintHtml;

    // Row click → detail modal (but not on action buttons)
    list.querySelectorAll(".contact-row").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".contact-actions")) return;
        openContactDetailModal({
          name: row.dataset.name,
          address: row.dataset.address,
          chain: row.dataset.chain,
          trusted: row.dataset.trusted === "true",
        });
      });
    });

    // Trust button → open picker
    list.querySelectorAll(".contact-action-btn.trust").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openContactTrustPicker(btn.dataset.name, btn.dataset.trusted === "true", btn);
      };
    });

    // Delete button → custom modal
    list.querySelectorAll(".contact-action-btn.delete").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openContactDeleteModal(btn.dataset.name);
      };
    });
  } catch (e) {
    list.innerHTML = `<p style="padding:20px;color:var(--danger)">${escapeHtml(String(e))}</p>`;
  }
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
      recordEl.addEventListener("click", () => openTxDetailModal(record, lookup));
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

const ACTIVITY_NETWORKS = [
  { value: 'all',      label: () => tKey('activity.filters.allNetworks'), color: null },
  { value: 'ethereum', label: () => 'Ethereum',  color: '#627EEA' },
  { value: 'base',     label: () => 'Base',      color: '#0052FF' },
  { value: 'optimism', label: () => 'Optimism',  color: '#FF0420' },
  { value: 'arbitrum', label: () => 'Arbitrum',  color: '#28A0F0' },
  { value: 'polygon',  label: () => 'Polygon',   color: '#8247E5' },
  { value: 'zksync',   label: () => 'zkSync Era',color: '#8C8DFC' },
  { value: 'linea',    label: () => 'Linea',     color: '#61DFFF' },
  { value: 'scroll',   label: () => 'Scroll',    color: '#FFDBB0' },
];

function updateActivityNetworkLabel() {
  const net = ACTIVITY_NETWORKS.find(n => n.value === currentNetworkFilter) || ACTIVITY_NETWORKS[0];
  const label = document.getElementById("activity-network-label");
  if (label) label.textContent = net.label();
}

function closeActivityNetworkPicker() {
  const picker = document.getElementById("activity-network-picker");
  if (picker) picker.style.display = "none";
  document.getElementById("activity-network-btn")?.classList.remove("active");
}

function initializeActivityNetworkFilter() {
  const btn = document.getElementById("activity-network-btn");
  const picker = document.getElementById("activity-network-picker");
  if (!btn || !picker) return;

  const checkSvg = `<svg class="network-picker-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  // Build picker options
  picker.innerHTML = ACTIVITY_NETWORKS.map(net => {
    const dot = net.color
      ? `<span class="network-picker-dot" style="background:${net.color}"></span>`
      : `<span class="network-picker-dot" style="background:var(--text-secondary);opacity:0.4"></span>`;
    return `<div class="network-picker-option${net.value === currentNetworkFilter ? ' selected' : ''}" data-value="${net.value}">
      ${dot}
      <span class="network-picker-name">${net.label()}</span>
      ${checkSvg}
    </div>`;
  }).join("");

  // Option click
  picker.querySelectorAll(".network-picker-option").forEach(opt => {
    opt.addEventListener("click", () => {
      currentNetworkFilter = opt.dataset.value;
      updateActivityNetworkLabel();
      // Update selected state
      picker.querySelectorAll(".network-picker-option").forEach(o =>
        o.classList.toggle("selected", o.dataset.value === currentNetworkFilter)
      );
      closeActivityNetworkPicker();
      loadActivityRecords(currentActivityFilter, true);
    });
  });

  // Button click → show/hide picker
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (picker.style.display !== "none") {
      closeActivityNetworkPicker();
      return;
    }
    const rect = btn.getBoundingClientRect();
    picker.style.left = (rect.right - 180) + "px";
    picker.style.top = (rect.bottom + 6) + "px";
    picker.style.display = "block";
    btn.classList.add("active");
  });

  // Outside click closes picker
  document.addEventListener("click", (e) => {
    if (!picker.contains(e.target) && e.target !== btn) {
      closeActivityNetworkPicker();
    }
  });

  updateActivityNetworkLabel();
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

  div.style.cursor = "pointer";
  div._activityRecord = record;
  div._contactLookup = contactLookup;

  return div;
}

function openTxDetailModal(record, contactLookup) {
  const modal = document.getElementById("modal-tx-detail");

  // Type badge
  const typeBadge = document.getElementById("tx-detail-type-badge");
  const typeMap = { manual: "typeBadgeManual", auto: "typeBadgeAuto", rejected: "typeBadgeRejected" };
  typeBadge.textContent = tKey(`activity.detail.${typeMap[record.type] || "typeBadgeManual"}`);
  typeBadge.className = `tx-badge type-${record.type}`;

  // Status badge
  const statusBadge = document.getElementById("tx-detail-status-badge");
  let statusKey, statusClass;
  if (record.type === "rejected") { statusKey = "rejected"; statusClass = "status-failed"; }
  else if (!record.tx_hash)       { statusKey = "signed";   statusClass = "status-signed"; }
  else if (record.tx_status === "success") { statusKey = "success"; statusClass = "status-success"; }
  else if (record.tx_status === "failed")  { statusKey = "failed";  statusClass = "status-failed"; }
  else if (record.tx_status === "pending") { statusKey = "pending"; statusClass = "status-pending"; }
  else                                     { statusKey = "signed";  statusClass = "status-signed"; }
  statusBadge.textContent = tKey(`activity.status.${statusKey}`);
  statusBadge.className = `tx-badge ${statusClass}`;

  // Amount
  const amount = formatTokenAmount(record.tx_value || "0", record.tx_token);
  const amountText = `${amount} ${record.tx_token || ""}`.trim();
  document.getElementById("tx-detail-amount").textContent = amountText;
  const usdEl = document.getElementById("tx-detail-usd");
  usdEl.textContent = record.estimated_usd > 0 ? `$${record.estimated_usd.toFixed(2)}` : "";

  // Recipient
  const match = record.tx_to && record.tx_chain && contactLookup
    ? contactLookup.get(contactRecipientKey(record.tx_chain, record.tx_to))
    : null;
  const recipientDisplay = match
    ? match.name
    : record.tx_to || tKey("activity.detail.noRecipient");

  // Time
  const dt = new Date(record.timestamp);
  const timeStr = dt.toLocaleString("zh-CN", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });

  // Type label
  const typeLabels = { manual: tKey("activity.filters.manual"), auto: tKey("activity.filters.auto"), rejected: tKey("activity.filters.rejected") };

  // Hash
  const hashDisplay = record.tx_hash
    ? `${record.tx_hash.slice(0, 10)}…${record.tx_hash.slice(-8)}`
    : tKey("activity.detail.noHash");

  // Network dot color
  const netColors = { ethereum:"#627EEA", base:"#0052FF", optimism:"#FF0420", arbitrum:"#28A0F0", polygon:"#8247E5", zksync:"#8C8DFC", linea:"#61DFFF", scroll:"#FFDBB0" };
  const netColor = netColors[(record.tx_chain || "").toLowerCase()] || "var(--text-secondary)";
  const chainLabel = record.tx_chain
    ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${netColor};margin-right:6px;vertical-align:middle;"></span>${escapeHtml(record.tx_chain)}`
    : "—";

  // Status row value
  const statusValueClass = record.tx_status === "success" ? "success" : record.tx_status === "failed" ? "danger" : "";

  // Build info rows
  const rows = [
    { label: tKey("activity.detail.labelTo"),     value: escapeHtml(recipientDisplay), cls: record.tx_to ? "accent mono" : "" },
    { label: tKey("activity.detail.labelChain"),  value: chainLabel, raw: true },
    { label: tKey("activity.detail.labelTime"),   value: escapeHtml(timeStr) },
    { label: tKey("activity.detail.labelType"),   value: escapeHtml(typeLabels[record.type] || record.type) },
    { label: tKey("activity.detail.labelHash"),   value: escapeHtml(hashDisplay), cls: record.tx_hash ? "accent mono" : "", copyHash: record.tx_hash || null },
    { label: tKey("activity.detail.labelStatus"), value: escapeHtml(tKey(`activity.status.${statusKey}`)), cls: statusValueClass },
  ];
  if (record.gas_used)    rows.push({ label: tKey("activity.detail.labelGas"),   value: escapeHtml(String(record.gas_used)) });
  if (record.block_number) rows.push({ label: tKey("activity.detail.labelBlock"), value: escapeHtml(String(record.block_number)) });

  document.getElementById("tx-detail-info").innerHTML = rows.map(r => {
    const valueHtml = r.copyHash
      ? `<span class="tx-hash-value"><span class="${r.cls || ""}">${r.value}</span><button class="btn-copy-hash" data-hash="${r.copyHash}" title="复制"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></span>`
      : `<span class="${r.cls || ""}">${r.raw ? r.value : r.value}</span>`;
    return `<div class="tx-detail-row"><span class="tx-detail-label">${escapeHtml(r.label)}</span><span class="tx-detail-value">${valueHtml}</span></div>`;
  }).join("");

  document.getElementById("tx-detail-info").querySelectorAll(".btn-copy-hash").forEach(btn => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.hash).then(() => {
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        showCopyToast(btn);
        setTimeout(() => {
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        }, 1500);
      });
    });
  });

  // Explorer button
  const explorerUrl = getBlockExplorerUrl(record.tx_chain, record.tx_hash);
  const explorerBtn = document.getElementById("btn-tx-detail-explorer");
  explorerBtn.style.display = explorerUrl ? "" : "none";
  explorerBtn.onclick = () => { if (explorerUrl) window.open(explorerUrl, "_blank"); };

  modal.classList.add("active");
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
      if (tab === "contacts") {
        loadContactsTab();
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
  const LANG_LABELS = { "en": "English", "zh-CN": "简体中文" };

  function setLanguageDisplay(lang) {
    const display = document.getElementById("language-display");
    if (display) display.textContent = LANG_LABELS[lang] ?? lang;
    document.querySelectorAll("#language-picker .custom-picker-option").forEach(opt => {
      opt.classList.toggle("selected", opt.dataset.value === lang);
    });
  }

  function closeLanguagePicker() {
    document.getElementById("language-picker").style.display = "none";
    document.removeEventListener("click", closeLanguagePickerOutside, true);
  }

  function closeLanguagePickerOutside(e) {
    const picker = document.getElementById("language-picker");
    const row = document.getElementById("row-language");
    if (!picker.contains(e.target) && !row.contains(e.target)) closeLanguagePicker();
  }

  setLanguageDisplay(i18next.language);

  document.getElementById("row-language")?.addEventListener("click", () => {
    const picker = document.getElementById("language-picker");
    const row = document.getElementById("row-language");
    if (picker.style.display !== "none") { closeLanguagePicker(); return; }
    const rect = row.getBoundingClientRect();
    const pickerW = 200;
    picker.style.display = "block";
    picker.style.width = pickerW + "px";
    picker.style.left = Math.max(8, rect.right - pickerW) + "px";
    picker.style.top = rect.bottom + 4 + "px";
    setTimeout(() => document.addEventListener("click", closeLanguagePickerOutside, true), 0);
  });

  document.querySelectorAll("#language-picker .custom-picker-option").forEach(opt => {
    opt.addEventListener("click", async () => {
      const newLang = opt.dataset.value;
      setLanguageDisplay(newLang);
      closeLanguagePicker();
      const appRoot = document.getElementById("app");
      appRoot?.classList.add("i18n-switching");
      try {
        await changeLanguage(newLang);
        updateStaticTexts();
        await refreshDynamicI18n();
      } catch (err) {
        console.error("Failed to change language:", err);
        setLanguageDisplay(i18next.language);
      } finally {
        appRoot?.classList.remove("i18n-switching");
      }
    });
  });
}

// ============================================================
// THEME SYSTEM
// ============================================================

let _systemThemeListener = null;

function initTheme() {
  const saved = localStorage.getItem('claw-theme') || 'system';
  applyTheme(saved);
}

function resolveTheme(theme) {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyTheme(theme) {
  const resolved = resolveTheme(theme);
  if (resolved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  // Update segmented control active state
  document.querySelectorAll('.theme-seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeVal === theme);
  });

  // Listen for system theme changes only when "system" is selected
  if (_systemThemeListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', _systemThemeListener);
    _systemThemeListener = null;
  }
  if (theme === 'system') {
    _systemThemeListener = () => applyTheme('system');
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', _systemThemeListener);
  }
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
