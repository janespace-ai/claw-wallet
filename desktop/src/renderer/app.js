import i18next, { initI18n, changeLanguage } from './i18n.js';

const api = window.walletAPI;

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
  return ` <span style="font-size:11px;background:#1a472a;color:#8f8;padding:2px 6px;border-radius:4px;margin-left:6px">可信任</span>`;
}

let currentMode = "setup";
let currentTxRequest = null;
let currentContactAddRequest = null;
let currentAlert = null;

async function init() {
  await initializeI18n();
  
  const status = await api.getStatus();

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
}

async function loadWalletBalances(address) {
  if (!address) return;

  const balancesList = document.getElementById("balances-list");
  const portfolioValueDisplay = document.getElementById("portfolio-value");

  balancesList.innerHTML = `<div class="loading">${i18next.t('common.messages.loading')}</div>`;
  portfolioValueDisplay.textContent = i18next.t('common.messages.loading');

  try {
    const balances = await api.getWalletBalances(address);
    
    if (!balances || balances.length === 0) {
      balancesList.innerHTML = `<p style="color: #888;">${i18next.t('common.home.noBalances')}</p>`;
      portfolioValueDisplay.textContent = "$0.00";
      return;
    }

    const tokens = [...new Set(balances.map(b => b.symbol))];
    const prices = await api.getTokenPrices(tokens);

    renderBalances(balances, prices);
    const totalValue = calculateTotalValue(balances, prices);
    portfolioValueDisplay.textContent = `$${totalValue.toFixed(2)}`;
  } catch (err) {
    console.error("Failed to load balances:", err);
    balancesList.innerHTML = `<p style="color: red;">${i18next.t('common.messages.error')}</p>`;
    portfolioValueDisplay.textContent = i18next.t('common.messages.error');
  }
}

function renderBalances(balances, prices) {
  const balancesList = document.getElementById("balances-list");
  
  if (!balances || balances.length === 0) {
    balancesList.innerHTML = '<p style="color: #888;">No balances found</p>';
    return;
  }

  balancesList.innerHTML = balances
    .map(balance => {
      const amount = parseFloat(balance.amount);
      if (amount === 0) return '';

      const price = prices[balance.symbol] || null;
      const usdValue = price ? (amount * price).toFixed(2) : "N/A";
      const unitPrice = price ? `$${price.toFixed(2)}/${balance.symbol}` : "";

      return `
        <div class="balance-card">
          <div class="balance-header">
            <span class="balance-token">${escapeHtml(balance.symbol)}</span>
            <span class="balance-chain">${escapeHtml(balance.chain)}</span>
          </div>
          <div class="balance-amount">${amount.toFixed(6)}</div>
          <div class="balance-usd">${usdValue !== "N/A" ? `$${usdValue}` : "Price unavailable"}</div>
          ${unitPrice ? `<div class="balance-unit-price">${unitPrice}</div>` : ""}
        </div>
      `;
    })
    .filter(Boolean)
    .join('');

  if (!balancesList.innerHTML.trim()) {
    balancesList.innerHTML = '<p style="color: #888;">All balances are zero</p>';
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

async function updateBiometricButton() {
  const btn = document.getElementById("btn-biometric");
  const bioAvailable = await api.getBiometricAvailable();
  if (bioAvailable) {
    const label = await api.getBiometricLabel();
    btn.textContent = label ? `Use ${label}` : "Use Biometrics";
    btn.style.display = "block";
  } else {
    btn.style.display = "none";
  }
}

async function syncSettingsFromStatus(status) {
  try {
    const allowance = await api.getAllowance();
    document.getElementById("input-daily-limit").value = String(allowance.dailyLimitUSD);
    document.getElementById("input-per-tx-limit").value = String(allowance.perTxLimitUSD);
  } catch (_) {
    /* ignore */
  }
  try {
    const mode = await api.getLockMode();
    document.getElementById("select-lock-mode").value = mode;
  } catch (_) {
    /* ignore */
  }
  try {
    const canEnable = await api.canEnableBiometric();
    const bioCard = document.getElementById("biometric-card");
    if (canEnable) {
      bioCard.style.display = "block";
      const bioAvailable = await api.getBiometricAvailable();
      document.getElementById("toggle-biometric").checked = bioAvailable;
      const label = await api.getBiometricLabel();
      document.getElementById("biometric-label").textContent = label || "Biometrics";
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
    document.getElementById("password-title").textContent = "Set Password";
    document.getElementById("password-desc").textContent = "Choose a strong password to encrypt your wallet.";
    document.getElementById("mnemonic-input-area").style.display = "none";
    document.getElementById("btn-password-submit").dataset.action = "create";
    showScreen("password");
  };

  document.getElementById("btn-import").onclick = () => {
    document.getElementById("password-title").textContent = "Import Wallet";
    document.getElementById("password-desc").textContent = "Enter your mnemonic and set a password.";
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
      errEl.textContent = i18next.t('errors.password.tooShort');
      return;
    }
    if (password !== confirm) {
      errEl.textContent = i18next.t('errors.password.mismatch');
      return;
    }

    errEl.textContent = "";
    const action = document.getElementById("btn-password-submit").dataset.action;

    try {
      if (action === "create") {
        const result = await api.createWallet(password);
        showMnemonicScreen(result.mnemonic);
      } else {
        const mnemonic = document.getElementById("input-mnemonic").value.trim();
        if (!mnemonic) {
          errEl.textContent = i18next.t('errors.mnemonic.required');
          return;
        }
        await api.importWallet(mnemonic, password);
        const status = await api.getStatus();
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
    const status = await api.getStatus();
    enterMainScreen(status);
  };

  // Unlock screen
  document.getElementById("btn-unlock").onclick = async () => {
    const password = document.getElementById("input-unlock-password").value;
    const errEl = document.getElementById("unlock-error");
    try {
      await api.unlock(password);
      const status = await api.getStatus();
      enterMainScreen(status);
    } catch (err) {
      errEl.textContent = err.message;
    }
  };

  document.getElementById("btn-biometric").onclick = async () => {
    try {
      await api.unlockBiometric();
      const status = await api.getStatus();
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
        const status = await api.getStatus();
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
      }
    };
  });

  // Refresh balances button
  document.getElementById("btn-refresh-balances").onclick = async () => {
    const status = await api.getStatus();
    if (status.address) {
      loadWalletBalances(status.address);
    }
  };

  // Pairing
  document.getElementById("btn-generate-code").onclick = async () => {
    try {
      const result = await api.generatePairCode();
      document.getElementById("pair-code").textContent = result.code;
      document.getElementById("pair-code-display").style.display = "block";
      startCountdown(result.expiresAt);

      // Auto-copy to clipboard with Agent-friendly prompt
      const agentPrompt = `My Claw Wallet pairing code is: ${result.code}\nPlease pair with it using wallet_pair tool.`;
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
      div.textContent = i18next.t('common.messages.copiedToClipboard');
      div.style.cssText = "position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #4caf50; color: white; padding: 10px 20px; border-radius: 4px; z-index: 10000;";
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 3000);
    }
  }

  // Settings
  document.getElementById("btn-save-allowance").onclick = async () => {
    await api.setAllowance({
      dailyLimitUSD: Number(document.getElementById("input-daily-limit").value),
      perTxLimitUSD: Number(document.getElementById("input-per-tx-limit").value),
      tokenWhitelist: ["ETH", "USDC", "USDT"],
      addressWhitelist: [],
    });
  };

  document.getElementById("select-lock-mode").onchange = async (e) => {
    await api.setLockMode(e.target.value);
  };

  document.getElementById("toggle-biometric").onchange = async (e) => {
    try {
      if (e.target.checked) {
        const password = prompt("Enter your wallet password to enable biometric unlock:");
        if (!password) {
          e.target.checked = false;
          return;
        }
        await api.setBiometricEnabled(true, password);
      } else {
        await api.setBiometricEnabled(false);
      }
    } catch (err) {
      e.target.checked = !e.target.checked;
      alert(err.message || "Failed to change biometric setting");
    }
  };

  document.getElementById("btn-lock-wallet").onclick = async () => {
    await api.lock();
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
      const { mnemonic } = await api.exportMnemonic(pwd);
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
        alert(i18next.t('common.contacts.nameRequired'));
        return;
      }
      await api.approveTransaction(currentTxRequest.requestId, {
        trustRecipientAfterSuccess: trust,
        ...(trust ? { trustRecipientName: trustName } : {}),
      });
      document.getElementById("modal-tx").style.display = "none";
      currentTxRequest = null;
    }
  };

  document.getElementById("btn-contact-add-normal").onclick = async () => {
    if (currentContactAddRequest) {
      await api.respondContactAdd(currentContactAddRequest.requestId, "normal");
      document.getElementById("modal-contact-add").style.display = "none";
      currentContactAddRequest = null;
    }
  };
  document.getElementById("btn-contact-add-trusted").onclick = async () => {
    if (currentContactAddRequest) {
      await api.respondContactAdd(currentContactAddRequest.requestId, "trusted");
      document.getElementById("modal-contact-add").style.display = "none";
      currentContactAddRequest = null;
    }
  };
  document.getElementById("btn-contact-add-reject").onclick = async () => {
    if (currentContactAddRequest) {
      await api.respondContactAdd(currentContactAddRequest.requestId, "reject");
      document.getElementById("modal-contact-add").style.display = "none";
      currentContactAddRequest = null;
    }
  };

  document.getElementById("btn-reject-tx").onclick = async () => {
    if (currentTxRequest) {
      await api.rejectTransaction(currentTxRequest.requestId);
      document.getElementById("modal-tx").style.display = "none";
      currentTxRequest = null;
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
    await api.respondToAlert(currentAlert.alertId, action);
    document.getElementById("modal-alert").style.display = "none";
    currentAlert = null;
  }
}

function setupRealtimeEvents() {
  api.onTransactionRequest((req) => {
    currentTxRequest = req;
    const details = document.getElementById("tx-details");
    const cc = req.counterpartyContact;
    const bookLine =
      cc && cc.name
        ? `<p><strong>通讯录:</strong> ${escapeHtml(cc.name)}${cc.trusted ? trustedContactBadgeHtml() : ""}</p>`
        : "";
    const transferText =
      req.transferDisplay != null && String(req.transferDisplay).trim() !== ""
        ? escapeHtml(req.transferDisplay)
        : `${formatTokenAmount(req.value, req.token)} ${escapeHtml(req.token)}`;
    const estUsd = typeof req.estimatedUsd === "number" ? req.estimatedUsd : 0;
    const canValuate = req.priceAvailable === true;
    const usdtLine = canValuate
      ? `<p><strong>预估价值:</strong> ≈ ${estUsd.toFixed(2)} USDT <span style="color:var(--text-secondary);font-size:12px">（按桌面市价换算）</span></p>`
      : `<p><strong>预估价值:</strong> <span style="color:var(--text-secondary)">暂无法换算为 USDT</span></p>`;
    details.innerHTML = `
      <p><strong>Method:</strong> ${escapeHtml(req.method)}</p>
      ${bookLine}
      <p><strong>To:</strong> <span class="address">${escapeHtml(req.to)}</span></p>
      <p><strong>转账（币种 × 数量）:</strong> ${transferText}</p>
      ${usdtLine}
      <p><strong>Chain:</strong> ${escapeHtml(req.chain)}</p>
      <p><strong>From Device:</strong> ${escapeHtml(req.fromDevice)}</p>
      <p><strong>Source IP:</strong> ${escapeHtml(req.sourceIP)}</p>
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
    document.getElementById("modal-tx").style.display = "flex";
  });

  api.onContactAddRequest((req) => {
    currentContactAddRequest = req;
    const summary = document.getElementById("contact-add-summary");
    summary.innerHTML = `
      <strong>${escapeHtml(req.name)}</strong><br>
      链: ${escapeHtml(req.chain)}<br>
      <span class="address">${escapeHtml(req.address)}</span>
    `;
    document.getElementById("modal-contact-add").style.display = "flex";
  });

  api.onConnectionStatus((status) => {
    const indicator = document.getElementById("connection-indicator");
    const text = document.getElementById("connection-text");
    if (status.connected) {
      indicator.className = "connected";
      text.textContent = i18next.t('common.connection.connected');
    } else {
      indicator.className = "disconnected";
      text.textContent = i18next.t('common.connection.disconnected');
    }
  });

  api.onSecurityAlert((alert) => {
    currentAlert = alert;
    document.getElementById("alert-message").textContent = alert.message;
    document.getElementById("modal-alert").style.display = "flex";
    loadSecurityEvents();
  });

  api.onLockStateChange((locked) => {
    if (locked) {
      showScreen("unlock");
      updateBiometricButton();
    }
  });

  api.onBiometricPrompt(async (password) => {
    const label = await api.getBiometricLabel();
    const name = label || "biometric unlock";
    if (confirm(`Enable ${name} for quick unlock?`)) {
      try {
        await api.setBiometricEnabled(true, password);
      } catch (err) {
        console.error("Failed to enable biometric:", err);
      }
    }
  });
}

async function loadPairedDevices() {
  const devices = await api.getPairedDevices();
  const list = document.getElementById("paired-devices-list");
  if (devices.length === 0) {
    list.innerHTML = `<p style="color: var(--text-secondary)">${i18next.t('pairing.noDevices')}</p>`;
    return;
  }
  list.innerHTML = devices.map(d => `
    <div class="device-item">
      <div class="info">
        <div>${d.deviceId}</div>
        <div class="ip">IP: ${d.lastIP} · Paired: ${new Date(d.pairedAt).toLocaleDateString()}</div>
      </div>
      <button class="btn danger" style="width:auto;padding:6px 12px" onclick="revokeDevice('${d.deviceId}')">Revoke</button>
    </div>
  `).join("");
}

window.revokeDevice = async (deviceId) => {
  await api.revokePairing(deviceId);
  loadPairedDevices();
};

async function loadDesktopContacts() {
  const list = document.getElementById("contacts-list");
  try {
    const rows = await api.listDesktopContacts();
    if (!rows || rows.length === 0) {
      list.innerHTML =
        '<p style="color: var(--text-secondary)">No contacts yet. Add them from the Agent (wallet_contacts_add).</p>';
      return;
    }
    list.innerHTML = "";
    for (const c of rows) {
      const wrap = document.createElement("div");
      wrap.className = "device-item";
      const info = document.createElement("div");
      info.className = "info";
      const badge = c.trusted
        ? ` <span style="font-size:11px;background:#1a472a;color:#8f8;padding:2px 6px;border-radius:4px;margin-left:6px">${i18next.t('common.contacts.trusted')}</span>`
        : "";
      info.innerHTML = `<div><strong>${escapeHtml(c.name)}</strong> · ${escapeHtml(c.chain)}${badge}</div>
        <div class="ip address">${escapeHtml(c.address)}</div>`;
      const btn = document.createElement("button");
      btn.className = "btn danger";
      btn.style.cssText = "width:auto;padding:6px 12px";
      btn.textContent = i18next.t('common.buttons.remove');
      btn.onclick = async () => {
        if (!confirm(i18next.t('common.contacts.removeConfirm', { name: c.name }))) return;
        try {
          await api.removeDesktopContact(c.name);
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
  const events = await api.getSecurityEvents();
  const list = document.getElementById("security-events-list");
  if (events.length === 0) {
    list.innerHTML = `<p style="color: var(--text-secondary)">${i18next.t('security.events.noEvents')}</p>`;
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
  const records = await api.getSigningHistory();
  const list = document.getElementById("signing-history-list");
  
  if (!records || records.length === 0) {
    list.innerHTML = `<p style="color: var(--text-secondary)">${i18next.t('security.history.noHistory')}</p>`;
    return;
  }

  let lookup;
  try {
    lookup = buildContactLookup(await api.listDesktopContacts());
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
      : "—";
    const est = typeof record.estimated_usd === "number" ? record.estimated_usd : 0;
    
    return `
      <div class="signing-record ${record.type}">
        <div class="signing-record-header">
          <span class="signing-icon">${icon}</span>
          <span class="signing-type">${record.type.toUpperCase()}</span>
          <span class="signing-time">${timestamp}</span>
        </div>
        <div class="signing-details">
          <div><strong>${amount} ${escapeHtml(record.tx_token)}</strong> on ${escapeHtml(record.tx_chain)}</div>
          <div>To: ${toLabel}<span class="address-short">${shortTo}</span></div>
          <div>Estimated: $${est.toFixed(2)} <span style="color: #888; font-size: 10px;">(at signing)</span></div>
          ${record.tx_hash ? `<div>TX: <span class="address-short">${escapeHtml(record.tx_hash.slice(0, 10))}...</span></div>` : ''}
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
    el.textContent = `Expires in ${min}:${sec.toString().padStart(2, "0")}`;
    if (remaining <= 0) {
      el.textContent = "Code expired";
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
    list.innerHTML = `<div class="loading">${i18next.t('common.messages.loading')}</div>`;
  }

  try {
    let lookup;
    try {
      lookup = buildContactLookup(await api.listDesktopContacts());
    } catch {
      lookup = new Map();
    }

    let records;
    if (filter === "all") {
      records = await api.getActivityRecords(ACTIVITY_PAGE_SIZE, activityOffset);
    } else if (["auto", "manual", "rejected"].includes(filter)) {
      records = await api.getActivityByType(filter);
    } else if (["pending", "success", "failed"].includes(filter)) {
      records = await api.getActivityByStatus(filter);
    }

    if (!records || records.length === 0) {
      list.innerHTML = `<p style="color: #888; text-align: center; padding: 20px;">${i18next.t('activity.noRecords')}</p>`;
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
    list.innerHTML = '<p style="color: red;">Failed to load activity</p>';
  }
}

function renderActivityRecord(record, contactLookup) {
  const div = document.createElement("div");
  div.className = `activity-record ${record.type} ${record.tx_status || "no-tx"}`;

  const statusIcon = getStatusIcon(record);
  const typeIcon = getTypeIcon(record.type);
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

  div.innerHTML = `
    <div class="activity-record-header">
      <span class="activity-status">${statusIcon}</span>
      <span class="activity-type">${typeIcon} ${record.type.toUpperCase()}</span>
      <span class="activity-time">${timestamp}</span>
    </div>
    <div class="activity-details">
      <div class="activity-amount"><strong>${amount} ${escapeHtml(record.tx_token)}</strong></div>
      <div class="activity-chain">on ${escapeHtml(record.tx_chain)}</div>
      ${record.tx_to ? `<div>To: ${toPrefix}<span class="address-mono">${escapeHtml(record.tx_to.slice(0, 10))}...${escapeHtml(record.tx_to.slice(-8))}</span></div>` : ''}
      <div>Estimated: ${signedPolicyUsd > 0 ? `$${signedPolicyUsd.toFixed(2)}` : 'Price unavailable'} <span style="color: #888; font-size: 10px;">(at signing)</span></div>
      ${record.tx_hash ? `<div>TX: <span class="address-mono">${escapeHtml(record.tx_hash.slice(0, 10))}...${escapeHtml(record.tx_hash.slice(-8))}</span></div>` : ''}
      ${record.block_number ? `<div>Block: ${record.block_number}</div>` : ''}
    </div>
  `;

  return div;
}

function getStatusIcon(record) {
  if (record.type === "rejected") return "❌";
  if (!record.tx_hash) return "📝"; // Signed but not broadcast
  if (record.tx_status === "success") return "✅";
  if (record.tx_status === "failed") return "⛔";
  if (record.tx_status === "pending") return "⏳";
  return "❓";
}

function getTypeIcon(type) {
  const icons = { auto: "🤖", manual: "👤", rejected: "❌" };
  return icons[type] || "⚪";
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/**
 * Update all static UI elements with current language
 */
function updateStaticTexts() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = i18next.t(key);
    
    if (el.tagName === 'INPUT' && el.type === 'button') {
      el.value = translation;
    } else {
      el.textContent = translation;
    }
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = i18next.t(key);
  });
  
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = i18next.t(key);
  });
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
    
    try {
      await changeLanguage(newLang);
      updateStaticTexts();
      console.log(`Language changed to: ${newLang}`);
    } catch (err) {
      console.error('Failed to change language:', err);
      selector.value = i18next.language;
    }
  });
}

init();
