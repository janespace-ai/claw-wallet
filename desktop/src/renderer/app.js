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

let currentMode = "setup";
let currentTxRequest = null;
let currentAlert = null;

async function init() {
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
  syncSettingsFromStatus(status);
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
      errEl.textContent = "Password must be at least 8 characters";
      return;
    }
    if (password !== confirm) {
      errEl.textContent = "Passwords do not match";
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
          errEl.textContent = "Please enter your mnemonic phrase";
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
    tab.onclick = () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
    };
  });

  // Pairing
  document.getElementById("btn-generate-code").onclick = async () => {
    try {
      const result = await api.generatePairCode();
      document.getElementById("pair-code").textContent = result.code;
      document.getElementById("pair-code-display").style.display = "block";
      startCountdown(result.expiresAt);
    } catch (err) {
      alert(err.message);
    }
  };

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
  document.getElementById("btn-approve-tx").onclick = async () => {
    if (currentTxRequest) {
      await api.approveTransaction(currentTxRequest.requestId);
      document.getElementById("modal-tx").style.display = "none";
      currentTxRequest = null;
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
    details.innerHTML = `
      <p><strong>Method:</strong> ${req.method}</p>
      <p><strong>To:</strong> <span class="address">${req.to}</span></p>
      <p><strong>Amount:</strong> ${formatTokenAmount(req.value, req.token)} ${req.token}</p>
      <p><strong>Chain:</strong> ${req.chain}</p>
      <p><strong>From Device:</strong> ${req.fromDevice}</p>
      <p><strong>Source IP:</strong> ${req.sourceIP}</p>
    `;
    document.getElementById("modal-tx").style.display = "flex";
  });

  api.onConnectionStatus((status) => {
    const indicator = document.getElementById("connection-indicator");
    const text = document.getElementById("connection-text");
    if (status.connected) {
      indicator.className = "connected";
      text.textContent = "Connected";
    } else {
      indicator.className = "disconnected";
      text.textContent = "Disconnected";
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
    list.innerHTML = '<p style="color: var(--text-secondary)">No paired devices yet.</p>';
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

async function loadSecurityEvents() {
  const events = await api.getSecurityEvents();
  const list = document.getElementById("security-events-list");
  if (events.length === 0) {
    list.innerHTML = '<p style="color: var(--text-secondary)">No security events.</p>';
    return;
  }
  list.innerHTML = events.slice(0, 50).map(e => `
    <div class="event-item">
      <div>${e.message}</div>
      <div class="time">${new Date(e.timestamp).toLocaleString()}</div>
    </div>
  `).join("");
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

init();
