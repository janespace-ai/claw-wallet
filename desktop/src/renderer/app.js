const api = window.walletAPI;

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
    const bioAvailable = await api.getBiometricAvailable();
    if (bioAvailable) {
      document.getElementById("btn-biometric").style.display = "block";
    }
  } else {
    enterMainScreen(status);
  }

  setupEventListeners();
  setupRealtimeEvents();
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
        showMnemonic(result.mnemonic);
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

  function showMnemonic(mnemonic) {
    // mnemonic is passed back but we need to display it
    // In production, createWallet returns address, mnemonic is shown separately
    // For now, store and display
    window._tempMnemonic = mnemonic;
    // We'll show it via export flow instead
    // Go directly to main
    api.getStatus().then(status => enterMainScreen(status));
  }

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

  document.getElementById("btn-lock-wallet").onclick = async () => {
    await api.lock();
    showScreen("unlock");
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
      <p><strong>Amount:</strong> ${req.value} ${req.token}</p>
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
