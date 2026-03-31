/**
 * E2E 日志采集与断言。
 *
 * 环境变量：
 * - E2E_STRICT_CONSOLE_ERRORS=1 — 任意主进程/渲染进程 console.error 均失败（忽略允许列表）
 * - E2E_FAIL_ON_MAIN_STDERR=1 — 主进程 stderr 含 error 样文本时失败（Chromium 噪声多，默认关）
 */
import type { ConsoleMessage, ElectronApplication, Page, Request } from "@playwright/test";

/** Substrings — offline / headless 下常见的非缺陷日志（RPC、剪贴板等） */
const ALLOWED_RENDERER_ERROR_SUBSTRINGS = [
  "Clipboard write failed",
  "Failed to load balances",
  "Failed to load activity",
  "refreshAccountHeader:",
  "renderSettingsAccountsCard:",
  "refreshDynamicI18n:",
  "Failed to change language",
];

/** 主进程在无中继 / RPC 不可达时常见 */
const ALLOWED_MAIN_ERROR_SUBSTRINGS = [
  "[TxSync]",
  "[BalanceService]",
  "[RPCProviderManager]",
  "[relay-bridge]",
  "[PriceService]",
  "[ChainAdapter]",
  "[MessageRouter]",
  "[signing-engine]",
  /** IPC 层会把业务错误打成 error；以下仅匹配「预期内的错密码」用例 */
  "handler for 'wallet:export-mnemonic': Error: Invalid password",
  "handler for 'wallet:unlock': Error: Invalid password",
];

function isAllowedError(text: string, allow: readonly string[]): boolean {
  return allow.some((s) => text.includes(s));
}

export class E2eLogCollector {
  readonly pageErrors: string[] = [];
  readonly rendererConsole: Array<{ type: string; text: string }> = [];
  readonly mainConsole: Array<{ type: string; text: string }> = [];
  readonly requestFailed: string[] = [];
  private mainStderr = "";
  private mainStdout = "";
  private stderrHandler?: (chunk: Buffer | string) => void;
  private stdoutHandler?: (chunk: Buffer | string) => void;

  private readonly onMainConsole = (msg: ConsoleMessage) => {
    this.mainConsole.push({ type: msg.type(), text: msg.text() });
  };

  private readonly onRendererConsole = (msg: ConsoleMessage) => {
    this.rendererConsole.push({ type: msg.type(), text: msg.text() });
  };

  private readonly onPageError = (err: Error) => {
    this.pageErrors.push(`${err.message}\n${err.stack ?? ""}`);
  };

  private readonly onRequestFailed = (req: Request) => {
    const f = req.failure();
    this.requestFailed.push(`${f?.errorText ?? "unknown"}\t${req.url()}`);
  };

  attach(app: ElectronApplication, page: Page): void {
    app.on("console", this.onMainConsole);
    page.on("console", this.onRendererConsole);
    page.on("pageerror", this.onPageError);
    page.on("requestfailed", this.onRequestFailed);

    const proc = app.process();
    if (proc.stderr) {
      this.stderrHandler = (chunk: Buffer | string) => {
        this.mainStderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      };
      proc.stderr.on("data", this.stderrHandler);
    }
    if (proc.stdout) {
      this.stdoutHandler = (chunk: Buffer | string) => {
        this.mainStdout += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      };
      proc.stdout.on("data", this.stdoutHandler);
    }
  }

  detach(app: ElectronApplication, page: Page): void {
    app.off("console", this.onMainConsole);
    page.off("console", this.onRendererConsole);
    page.off("pageerror", this.onPageError);
    page.off("requestfailed", this.onRequestFailed);

    const proc = app.process();
    if (this.stderrHandler && proc.stderr) proc.stderr.off("data", this.stderrHandler);
    if (this.stdoutHandler && proc.stdout) proc.stdout.off("data", this.stdoutHandler);
  }

  getRendererErrors(): string[] {
    return this.rendererConsole.filter((e) => e.type === "error").map((e) => e.text);
  }

  getMainErrors(): string[] {
    return this.mainConsole.filter((e) => e.type === "error").map((e) => e.text);
  }

  getRendererWarnings(): string[] {
    return this.rendererConsole.filter((e) => e.type === "warning").map((e) => e.text);
  }

  getMainWarnings(): string[] {
    return this.mainConsole.filter((e) => e.type === "warning").map((e) => e.text);
  }

  /** 未允许的 renderer console.error */
  getUnexpectedRendererErrors(): string[] {
    return this.getRendererErrors().filter((t) => !isAllowedError(t, ALLOWED_RENDERER_ERROR_SUBSTRINGS));
  }

  /** 未允许的主进程 console.error */
  getUnexpectedMainErrors(): string[] {
    return this.getMainErrors().filter((t) => !isAllowedError(t, ALLOWED_MAIN_ERROR_SUBSTRINGS));
  }

  formatReport(): string {
    const lines: string[] = [];
    lines.push("=== E2E log summary ===");
    if (this.pageErrors.length) {
      lines.push("--- pageerror (uncaught) ---");
      lines.push(...this.pageErrors);
    }
    lines.push("--- main process console ---");
    for (const e of this.mainConsole) lines.push(`[${e.type}] ${e.text}`);
    lines.push("--- renderer console ---");
    for (const e of this.rendererConsole) lines.push(`[${e.type}] ${e.text}`);
    if (this.requestFailed.length) {
      lines.push("--- request failed ---");
      lines.push(...this.requestFailed);
    }
    if (this.mainStderr.trim()) {
      lines.push("--- main stderr (raw) ---");
      lines.push(this.mainStderr.trimEnd());
    }
    if (this.mainStdout.trim()) {
      lines.push("--- main stdout (raw) ---");
      lines.push(this.mainStdout.trimEnd());
    }
    lines.push("--- unexpected renderer errors (after allowlist) ---");
    lines.push(...this.getUnexpectedRendererErrors().map((t) => `* ${t}`));
    lines.push("--- unexpected main errors (after allowlist) ---");
    lines.push(...this.getUnexpectedMainErrors().map((t) => `* ${t}`));
    lines.push(`--- warning counts: renderer=${this.getRendererWarnings().length} main=${this.getMainWarnings().length} ---`);
    return lines.join("\n");
  }
}

/**
 * pageerror 始终视为失败。
 * 主/渲染 console.error：默认允许离线相关子串；设 E2E_STRICT_CONSOLE_ERRORS=1 则不允许任何 error。
 */
export function assertAcceptableLogs(logs: E2eLogCollector): void {
  if (logs.pageErrors.length > 0) {
    throw new Error(
      `Renderer pageerror (${logs.pageErrors.length}):\n${logs.pageErrors.join("\n---\n")}\n\nFull report:\n${logs.formatReport()}`,
    );
  }

  const strict = process.env.E2E_STRICT_CONSOLE_ERRORS === "1";
  const badRenderer = strict ? logs.getRendererErrors() : logs.getUnexpectedRendererErrors();
  const badMain = strict ? logs.getMainErrors() : logs.getUnexpectedMainErrors();

  if (badRenderer.length > 0 || badMain.length > 0) {
    throw new Error(
      `Unexpected console.error (set E2E_STRICT_CONSOLE_ERRORS=1 to treat all errors strictly):\n` +
        `renderer:\n${badRenderer.map((s) => `  - ${s}`).join("\n")}\n` +
        `main:\n${badMain.map((s) => `  - ${s}`).join("\n")}\n\n` +
        `Full report:\n${logs.formatReport()}`,
    );
  }

  const failStderr = process.env.E2E_FAIL_ON_MAIN_STDERR === "1";
  if (failStderr && logs.mainStderr.trim()) {
    const s = logs.mainStderr;
    if (/\berror\b/i.test(s) || /ERROR:/.test(s)) {
      throw new Error(`Main stderr contained error-like output (E2E_FAIL_ON_MAIN_STDERR=1):\n${s}`);
    }
  }
}
