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
  showScreen("main");
  document.getElementById("main-address").textContent = status.address;
  if (status.sameMachineWarning) {
    document.getElementById("same-machine-warning").style.display = "block";
  }
  loadPairedDevices();
  loadSecurityEvents();
  loadSigningHistory();
  syncSettingsFromStatus(status);
  loadWalletBalances(status.address);
  initializeNetworkFilter();
  refreshAccountHeader().catch((e) => console.error(e));
  renderSettingsAccountsCard().catch((e) => console.error(e));
}

let currentBalances = [];
let currentPrices = {};
let currentAddress = '';

async function loadWalletBalances(address) {
  if (!address) return;

  currentAddress = address;
  const balancesList = document.getElementById("balances-list");
  const portfolioValueDisplay = document.getElementById("portfolio-value");

  balancesList.innerHTML = `<div class="loading">${tKey('common.messages.loading')}</div>`;
  portfolioValueDisplay.textContent = tKey('common.messages.loading');

  try {
    const balances = await wapi().getWalletBalances(address);
    
    if (!balances || balances.length === 0) {
      balancesList.innerHTML = `<p style="color: #888;">${tKey('common.home.noBalances')}</p>`;
      portfolioValueDisplay.textContent = "$0.00";
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
      if (currentBalances.length > 0) {
        renderBalances(currentBalances, currentPrices);
      }
    });
  }

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

function renderBalances(balances, prices) {
  const balancesList = document.getElementById("balances-list");
  const networkFilter = document.getElementById('network-filter');
  const hideZeroBalances = document.getElementById('hide-zero-balances');
  
  if (!balances || balances.length === 0) {
    balancesList.innerHTML = `<p style="color: #888;">${tKey("common.home.noBalances")}</p>`;
    return;
  }

  // Update network filter options
  if (networkFilter && networkFilter.options.length === 1) {
    const networks = [...new Set(balances.map(b => b.chainName))];
    networks.forEach(network => {
      const option = document.createElement('option');
      option.value = network;
      option.textContent = network;
      networkFilter.appendChild(option);
    });
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
    balancesList.innerHTML = `<p style="color: #888;">${tKey("common.home.noBalances")}</p>`;
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

      const networkBreakdown = token.networks.map(network => {
        const amount = parseFloat(network.amount);
        const networkUsd = hasPrice ? (amount * price).toFixed(2) : null;
        const icon = getNetworkIcon(network.chainName);
        
        return `
          <div class="network-balance">
            <div class="network-name">
              <span class="network-icon">${icon}</span>
              <span>${escapeHtml(network.chainName)}</span>
            </div>
            <div class="balance-amount">
              <div class="balance-amount-crypto">${amount.toFixed(6)} ${escapeHtml(token.symbol)}</div>
              ${hasPrice && networkUsd ? `<div class="balance-amount-usd">$${networkUsd}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="balance-item ${isMultiNetwork ? 'multi-network' : ''}" data-symbol="${escapeHtml(token.symbol)}" onclick="toggleBalanceExpand(this)">
          <div class="balance-row">
            <div class="balance-token">
              <span style="font-weight: 600;">${escapeHtml(token.symbol)}</span>
              ${!isMultiNetwork ? `<span class="network-badge ${getNetworkClass(token.networks[0].chainName)}">${getNetworkIcon(token.networks[0].chainName)} ${escapeHtml(token.networks[0].chainName)}</span>` : ''}
              ${isMultiNetwork ? `<span class="expand-toggle">▶</span>` : ''}
            </div>
            <div class="balance-amount">
              <div class="balance-amount-crypto">${totalAmount.toFixed(6)}</div>
              ${hasPrice && totalUsd ? `<div class="balance-amount-usd">$${totalUsd}</div>` : ''}
            </div>
          </div>
          ${isMultiNetwork ? `<div class="balance-breakdown">${networkBreakdown}</div>` : ''}
        </div>
      `;
    })
    .filter(Boolean)
    .join('');

  if (!balancesList.innerHTML.trim()) {
    balancesList.innerHTML = `<p style="color: #888;">${tKey("common.home.allBalancesZero")}</p>`;
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
      .map(
        (a) => `
      <div class="settings-account-row" data-index="${a.index}">
        <span class="settings-account-addr">${escapeHtml(truncateEthAddress(a.address))}</span>
        <input type="text" class="input-nick" data-index="${a.index}" value="${escapeHtml(a.nickname)}" />
        <button type="button" class="btn ghost btn-sm btn-save-nick" data-index="${a.index}">${escapeHtml(tKey("common.buttons.save"))}</button>
      </div>`,
      )
      .join("");
    list.querySelectorAll(".btn-save-nick").forEach((btn) => {
      btn.onclick = async () => {
        const idx = parseInt(btn.getAttribute("data-index"), 10);
        const row = btn.closest(".settings-account-row");
        const inp = row && row.querySelector(".input-nick");
        if (!inp) return;
        try {
          await wapi().updateWalletAccountNickname(idx, inp.value);
          await refreshAccountHeader();
          await renderSettingsAccountsCard();
        } catch (err) {
          alert(err.message || String(err));
        }
      };
    });
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

  document.getElementById("modal-tx").style.display = "flex";
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
      bioCard.style.display = "block";
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
      errEl.textContent = err.message;
    }
  };

  document.getElementById("btn-biometric").onclick = async () => {
    try {
      await wapi().unlockBiometric();
      const status = await wapi().getStatus();
      enterMainScreen(status);
    } catch (err) {
      document.getElementById("unlock-error").textContent = err.message;
    }
  };

  // Tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.onclick = async () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");

      if (tab.dataset.tab === "home") {
        const status = await wapi().getStatus();
        if (status.address) {
          loadWalletBalances(status.address);
        }
      } else if (tab.dataset.tab === "security") {
        loadSecurityEvents();
        loadSigningHistory();
      } else if (tab.dataset.tab === "activity") {
        loadActivityRecords(currentActivityFilter, true);
      } else if (tab.dataset.tab === "contacts") {
        loadDesktopContacts();
      } else if (tab.dataset.tab === "settings") {
        renderSettingsAccountsCard().catch((e) => console.error(e));
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
    try {
      if (e.target.checked) {
        const password = prompt(tKey("errors.biometric.promptPassword"));
        if (!password) {
          e.target.checked = false;
          return;
        }
        await wapi().setBiometricEnabled(true, password);
      } else {
        await wapi().setBiometricEnabled(false);
      }
    } catch (err) {
      e.target.checked = !e.target.checked;
      alert(err.message || tKey("errors.biometric.changeFailed"));
    }
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
    modalExport.style.display = "flex";
  };

  document.getElementById("btn-export-cancel").onclick = () => {
    modalExport.style.display = "none";
  };

  document.getElementById("btn-export-confirm").onclick = async () => {
    const pwd = document.getElementById("input-export-password").value;
    const errEl = document.getElementById("export-error");
    const disp = document.getElementById("export-mnemonic-display");
    errEl.textContent = "";
    try {
      const { mnemonic } = await wapi().exportMnemonic(pwd);
      errEl.textContent = "";
      renderMnemonicWords(disp, mnemonic);
      disp.style.display = "grid";
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
      document.getElementById("modal-tx").style.display = "none";
      currentTxRequest = null;
    }
  };

  document.getElementById("btn-contact-add-normal").onclick = async () => {
    if (currentContactAddRequest) {
      await wapi().respondContactAdd(currentContactAddRequest.requestId, "normal");
      document.getElementById("modal-contact-add").style.display = "none";
      currentContactAddRequest = null;
    }
  };
  document.getElementById("btn-contact-add-trusted").onclick = async () => {
    if (currentContactAddRequest) {
      await wapi().respondContactAdd(currentContactAddRequest.requestId, "trusted");
      document.getElementById("modal-contact-add").style.display = "none";
      currentContactAddRequest = null;
    }
  };
  document.getElementById("btn-contact-add-reject").onclick = async () => {
    if (currentContactAddRequest) {
      await wapi().respondContactAdd(currentContactAddRequest.requestId, "reject");
      document.getElementById("modal-contact-add").style.display = "none";
      currentContactAddRequest = null;
    }
  };

  document.getElementById("btn-reject-tx").onclick = async () => {
    if (currentTxRequest) {
      await wapi().rejectTransaction(currentTxRequest.requestId);
      document.getElementById("modal-tx").style.display = "none";
      currentTxRequest = null;
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

  document.getElementById("btn-new-sub-account").onclick = async () => {
    const hint = tKey("settings.accounts.newNicknamePrompt");
    const name = window.prompt(hint, "");
    if (name === null) return;
    try {
      await wapi().createWalletSubAccount(name.trim() || undefined);
      const st = await wapi().getStatus();
      const addrEl = document.getElementById("main-address");
      if (addrEl && st.address) addrEl.textContent = st.address;
      await refreshAccountHeader();
      await renderSettingsAccountsCard();
      if (st.address) loadWalletBalances(st.address);
    } catch (e) {
      alert(e.message || String(e));
    }
  };

  // Security alert modal
  document.getElementById("btn-alert-freeze").onclick = () => respondAlert("freeze");
  document.getElementById("btn-alert-allow").onclick = () => respondAlert("allow_once");
  document.getElementById("btn-alert-trust").onclick = () => respondAlert("trust");

  // Activity filters
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadActivityRecords(btn.dataset.filter, true);
    };
  });

  // Activity load more
  document.getElementById("btn-load-more-activity").onclick = () => {
    loadActivityRecords(currentActivityFilter, false);
  };
}

async function respondAlert(action) {
  if (currentAlert) {
    await wapi().respondToAlert(currentAlert.alertId, action);
    document.getElementById("modal-alert").style.display = "none";
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
    document.getElementById("modal-contact-add").style.display = "flex";
  });

  wapi().onConnectionStatus((status) => {
    const indicator = document.getElementById("connection-indicator");
    const text = document.getElementById("connection-text");
    if (status.connected) {
      indicator.className = "connected";
      text.textContent = tKey('common.connection.connected');
    } else {
      indicator.className = "disconnected";
      text.textContent = tKey('common.connection.disconnected');
    }
  });

  wapi().onSecurityAlert((alert) => {
    currentAlert = alert;
    document.getElementById("alert-message").textContent = alert.message;
    document.getElementById("modal-alert").style.display = "flex";
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

  wapi().onWalletAccountChanged(({ address }) => {
    const el = document.getElementById("main-address");
    if (el) el.textContent = address ?? "";
    if (address) loadWalletBalances(address);
    refreshAccountHeader().catch((e) => console.error(e));
    renderSettingsAccountsCard().catch((e) => console.error(e));
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

async function loadPairedDevices() {
  const devices = await wapi().getPairedDevices();
  const list = document.getElementById("paired-devices-list");
  if (devices.length === 0) {
    list.innerHTML = `<p style="color: var(--text-secondary)">${tKey('pairing.noDevices')}</p>`;
    return;
  }
  list.innerHTML = devices.map(d => `
    <div class="device-item">
      <div class="info">
        <div>${d.deviceId}</div>
        <div class="ip">${tKey("pairing.rowMeta", {
          ip: d.lastIP,
          date: new Date(d.pairedAt).toLocaleDateString(),
        })}</div>
      </div>
      <button class="btn danger" style="width:auto;padding:6px 12px" onclick="revokeDevice('${d.deviceId}')">${tKey("pairing.revoke")}</button>
    </div>
  `).join("");
}

window.revokeDevice = async (deviceId) => {
  await wapi().revokePairing(deviceId);
  loadPairedDevices();
};

async function loadDesktopContacts() {
  const list = document.getElementById("contacts-list");
  try {
    const rows = await wapi().listDesktopContacts();
    if (!rows || rows.length === 0) {
      list.innerHTML = `<p style="color: var(--text-secondary)">${tKey("contactsPage.empty")}</p>`;
      return;
    }
    list.innerHTML = "";
    for (const c of rows) {
      const wrap = document.createElement("div");
      wrap.className = "device-item";
      const info = document.createElement("div");
      info.className = "info";
      const badge = c.trusted
        ? ` <span style="font-size:11px;background:#1a472a;color:#8f8;padding:2px 6px;border-radius:4px;margin-left:6px">${tKey('common.contacts.trusted')}</span>`
        : "";
      info.innerHTML = `<div><strong>${escapeHtml(c.name)}</strong> · ${escapeHtml(c.chain)}${badge}</div>
        <div class="ip address">${escapeHtml(c.address)}</div>`;
      const btn = document.createElement("button");
      btn.className = "btn danger";
      btn.style.cssText = "width:auto;padding:6px 12px";
      btn.textContent = tKey('common.buttons.remove');
      btn.onclick = async () => {
        if (!confirm(tKey('common.contacts.removeConfirm', { name: c.name }))) return;
        try {
          await wapi().removeDesktopContact(c.name);
          await loadDesktopContacts();
        } catch (err) {
          alert(err.message || String(err));
        }
      };
      wrap.appendChild(info);
      wrap.appendChild(btn);
      list.appendChild(wrap);
    }
  } catch (err) {
    list.innerHTML = `<p style="color: red;">${escapeHtml(err.message || String(err))}</p>`;
  }
}

async function loadSecurityEvents() {
  const events = await wapi().getSecurityEvents();
  const list = document.getElementById("security-events-list");
  if (events.length === 0) {
    list.innerHTML = `<p style="color: var(--text-secondary)">${tKey('security.events.noEvents')}</p>`;
    return;
  }
  list.innerHTML = events.slice(0, 50).map(e => `
    <div class="event-item">
      <div>${e.message}</div>
      <div class="time">${new Date(e.timestamp).toLocaleString()}</div>
    </div>
  `).join("");
}

async function loadSigningHistory() {
  const records = await wapi().getSigningHistory(currentAccountIndex);
  const list = document.getElementById("signing-history-list");
  
  if (!records || records.length === 0) {
    list.innerHTML = `<p style="color: var(--text-secondary)">${tKey('security.history.noHistory')}</p>`;
    return;
  }

  let lookup;
  try {
    lookup = buildContactLookup(await wapi().listDesktopContacts(currentAccountIndex));
  } catch {
    lookup = new Map();
  }

    const typeIcons = {
    auto: "🤖",
    manual: "👤",
    rejected: "❌"
  };

  list.innerHTML = records.slice(0, 100).map(record => {
    const icon = typeIcons[record.type] || "⚪";
    const typeLabel = tKey(`activity.types.${record.type}`);
    const timestamp = new Date(record.timestamp).toLocaleString();
    const amount = formatTokenAmount(record.tx_value || "0", record.tx_token);
    const toAddr = record.tx_to;
    const chain = record.tx_chain;
    const match = toAddr && chain ? lookup.get(contactRecipientKey(chain, toAddr)) : null;
    const toLabel = match
      ? `${escapeHtml(match.name)}${match.trusted ? trustedContactBadgeHtml() : ""} · `
      : "";
    const shortTo = toAddr
      ? `${escapeHtml(toAddr.slice(0, 10))}...${escapeHtml(toAddr.slice(-8))}`
      : escapeHtml(tKey("activity.details.noRecipient"));
    const est = typeof record.estimated_usd === "number" ? record.estimated_usd : 0;
    const onChain = escapeHtml(tKey("activity.details.onChain", { chain: record.tx_chain }));
    
    return `
      <div class="signing-record ${record.type}">
        <div class="signing-record-header">
          <span class="signing-icon">${icon}</span>
          <span class="signing-type">${escapeHtml(typeLabel)}</span>
          <span class="signing-time">${timestamp}</span>
        </div>
        <div class="signing-details">
          <div><strong>${amount} ${escapeHtml(record.tx_token)}</strong> ${onChain}</div>
          <div>${escapeHtml(tKey("activity.details.to"))}: ${toLabel}<span class="address-short">${shortTo}</span></div>
          <div>${escapeHtml(tKey("activity.details.estimated"))}: $${est.toFixed(2)} <span style="color: #888; font-size: 10px;">${escapeHtml(tKey("activity.details.atSigning"))}</span></div>
          ${record.tx_hash ? `<div>${escapeHtml(tKey("activity.details.txHash"))}: <span class="address-short">${escapeHtml(record.tx_hash.slice(0, 10))}...</span></div>` : ''}
        </div>
      </div>
    `;
  }).join("");
}

function startCountdown(expiresAt) {
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
    }
  };
  update();
  const timer = setInterval(() => {
    update();
    if (expiresAt <= Date.now()) clearInterval(timer);
  }, 1000);
}

// ==========================================
// Activity Tab Functions
// ==========================================

let currentActivityFilter = "all";
let activityOffset = 0;
const ACTIVITY_PAGE_SIZE = 50;

async function loadActivityRecords(filter = "all", reset = true) {
  if (reset) {
    activityOffset = 0;
  }

  currentActivityFilter = filter;
  const list = document.getElementById("activity-list");
  
  if (reset) {
    list.innerHTML = `<div class="loading">${tKey('common.messages.loading')}</div>`;
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

    if (reset) {
      list.innerHTML = "";
    }

    records.forEach((record) => {
      const recordEl = renderActivityRecord(record, lookup);
      list.appendChild(recordEl);
    });

    // Show/hide load more button
    if (filter === "all" && records.length === ACTIVITY_PAGE_SIZE) {
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

function renderActivityRecord(record, contactLookup) {
  const div = document.createElement("div");
  div.className = `activity-record ${record.type} ${record.tx_status || "no-tx"}`;

  const statusIcon = getStatusIcon(record);
  const timestamp = formatRelativeTime(record.timestamp);
  const amount = formatTokenAmount(record.tx_value || "0", record.tx_token);

  /** Policy USD computed on desktop at signing time (see `tx-usd-estimate` / relay-bridge). */
  const signedPolicyUsd = record.estimated_usd || 0;
  const match =
    record.tx_to && record.tx_chain && contactLookup
      ? contactLookup.get(contactRecipientKey(record.tx_chain, record.tx_to))
      : null;
  const toPrefix = match
    ? `${escapeHtml(match.name)}${match.trusted ? trustedContactBadgeHtml() : ""} · `
    : "";

  const typeLabel = escapeHtml(tKey(`activity.types.${record.type}`));
  
  // Network badge with icon
  const networkIcon = getNetworkIcon(record.tx_chain);
  const networkClass = getNetworkClass(record.tx_chain);
  const networkBadge = `<span class="network-badge ${networkClass}">${networkIcon} ${escapeHtml(record.tx_chain)}</span>`;
  
  // Block explorer link
  const explorerUrl = getBlockExplorerUrl(record.tx_chain, record.tx_hash);
  const txHashDisplay = explorerUrl && record.tx_hash
    ? `<a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: none;">${escapeHtml(record.tx_hash.slice(0, 10))}...${escapeHtml(record.tx_hash.slice(-8))}</a>`
    : record.tx_hash 
      ? `<span class="address-mono">${escapeHtml(record.tx_hash.slice(0, 10))}...${escapeHtml(record.tx_hash.slice(-8))}</span>`
      : '';
  
  const estLine =
    signedPolicyUsd > 0
      ? `$${signedPolicyUsd.toFixed(2)}`
      : escapeHtml(tKey("activity.details.priceUnavailable"));

  div.innerHTML = `
    <div class="activity-record-header">
      <span class="activity-status">${statusIcon}</span>
      <span class="activity-type">${typeLabel}</span>
      <span class="activity-time">${timestamp}</span>
    </div>
    <div class="activity-details">
      <div class="activity-amount"><strong>${amount} ${escapeHtml(record.tx_token)}</strong></div>
      <div class="activity-chain">${networkBadge}</div>
      ${record.tx_to ? `<div>${escapeHtml(tKey("activity.details.to"))}: ${toPrefix}<span class="address-mono">${escapeHtml(record.tx_to.slice(0, 10))}...${escapeHtml(record.tx_to.slice(-8))}</span></div>` : ''}
      <div>${escapeHtml(tKey("activity.details.estimated"))}: ${estLine} <span style="color: #888; font-size: 10px;">${escapeHtml(tKey("activity.details.atSigning"))}</span></div>
      ${record.tx_hash ? `<div>${escapeHtml(tKey("activity.details.txHash"))}: ${txHashDisplay}</div>` : ''}
      ${record.block_number ? `<div>${escapeHtml(tKey("activity.details.block"))}: ${record.block_number}</div>` : ''}
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
    const activeTab = document.querySelector(".tab.active");
    const tab = activeTab?.dataset.tab;
    try {
      if (tab === "pairing") await loadPairedDevices();
      else if (tab === "security") {
        await loadSecurityEvents();
        await loadSigningHistory();
      } else if (tab === "activity") await loadActivityRecords(currentActivityFilter, true);
      else if (tab === "contacts") await loadDesktopContacts();
      else if (tab === "home") {
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

init();
