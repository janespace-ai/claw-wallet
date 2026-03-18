import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { exec } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AuthProvider, SigningContext, PasswordValidator } from "./auth-provider.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = join(__dirname, "gui-pages");

const TIMEOUT_MS = 120_000;

function loadPage(name: string): string {
  return readFileSync(join(PAGES_DIR, `${name}.html`), "utf-8");
}

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin"
    ? `open "${url}"`
    : process.platform === "win32"
      ? `start "" "${url}"`
      : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      process.stderr.write(`\n[GuiAuth] Could not open browser. Please open manually:\n${url}\n`);
    }
  });
}

interface DialogResult {
  [key: string]: unknown;
}

function startDialogServer(
  html: string,
  token: string,
  timeoutMs = TIMEOUT_MS,
): Promise<DialogResult | null> {
  return new Promise((resolve) => {
    let resolved = false;

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.method === "GET" && req.url?.startsWith("/dialog")) {
        const url = new URL(req.url, `http://127.0.0.1`);
        if (url.searchParams.get("token") !== token) {
          res.writeHead(403, { "Content-Type": "text/plain" });
          res.end("Forbidden");
          return;
        }
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Pragma": "no-cache",
        });
        res.end(html);
        return;
      }

      if (req.method === "POST" && req.url === "/submit") {
        let body = "";
        req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        req.on("end", () => {
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end('{"ok":true}');

          try {
            const data = JSON.parse(body);
            if (data.token === token && !resolved) {
              resolved = true;
              cleanup();
              resolve(data);
            }
          } catch {}
        });
        return;
      }

      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(null);
      }
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      server.close();
    }

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        const url = `http://127.0.0.1:${addr.port}/dialog?token=${token}`;
        openBrowser(url);
      }
    });
  });
}

function formatContext(ctx: SigningContext): { title: string; description: string } {
  switch (ctx.operation) {
    case "create_wallet":
      return { title: "Create Wallet", description: "Set a strong password to protect your wallet." };
    case "import_wallet":
      return { title: "Import Wallet", description: "Set a strong password for the imported wallet." };
    case "send":
      return { title: "Confirm Transaction", description: `Sending ${ctx.amount ?? "?"} ${ctx.token ?? "ETH"} to ${ctx.to ?? "?"}` };
    case "sign_message":
      return { title: "Sign Message", description: "Enter password to sign message." };
    case "unlock":
      return { title: "Unlock Wallet", description: "Enter your password to unlock." };
    case "set_allowance":
      return { title: "Update Allowance", description: "Enter password to modify spending limits." };
    default:
      return { title: "Authentication Required", description: "Enter your password." };
  }
}

export class GuiAuthProvider implements AuthProvider {
  async requestPin(context: SigningContext): Promise<string> {
    const { title, description } = formatContext(context);
    const token = randomUUID();
    const html = loadPage("password-input")
      .replace(/\{\{TITLE\}\}/g, title)
      .replace(/\{\{DESCRIPTION\}\}/g, description)
      .replace(/\{\{TOKEN\}\}/g, token);

    const result = await startDialogServer(html, token);
    if (!result || result.cancelled) throw new Error("User cancelled");
    return result.password as string;
  }

  async requestConfirm(context: SigningContext): Promise<boolean> {
    const token = randomUUID();
    const html = loadPage("tx-confirm")
      .replace(/\{\{TO\}\}/g, context.to ?? "Unknown")
      .replace(/\{\{AMOUNT\}\}/g, context.amount ?? "?")
      .replace(/\{\{TOKEN_SYMBOL\}\}/g, context.token ?? "ETH")
      .replace(/\{\{CHAIN\}\}/g, context.chain ?? "base")
      .replace(/\{\{TOKEN\}\}/g, token);

    const result = await startDialogServer(html, token);
    if (!result) return false;
    return result.confirmed === true;
  }

  async requestSecretInput(prompt: string): Promise<string> {
    const token = randomUUID();
    const html = loadPage("password-input")
      .replace(/\{\{TITLE\}\}/g, "Secret Input")
      .replace(/\{\{DESCRIPTION\}\}/g, prompt)
      .replace(/\{\{TOKEN\}\}/g, token);

    const result = await startDialogServer(html, token);
    if (!result || result.cancelled) throw new Error("User cancelled");
    return result.password as string;
  }

  async requestPasswordWithConfirmation(
    context: SigningContext,
    validator: PasswordValidator,
    maxRetries = 3,
  ): Promise<string> {
    const { title, description } = formatContext(context);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const token = randomUUID();
      const html = loadPage("password-create")
        .replace(/\{\{TITLE\}\}/g, title)
        .replace(/\{\{DESCRIPTION\}\}/g, description)
        .replace(/\{\{TOKEN\}\}/g, token);

      const result = await startDialogServer(html, token);
      if (!result || result.cancelled) throw new Error("User cancelled");

      const password = result.password as string;
      const validation = validator(password);
      if (validation.valid) return password;
    }

    throw new Error("Maximum password retries exceeded");
  }

  async displaySecretToUser(title: string, secret: string): Promise<void> {
    const token = randomUUID();
    const words = secret.split(" ");
    const wordsHtml = words
      .map((w, i) => `<div class="word"><span class="num">${i + 1}.</span>${w}</div>`)
      .join("");

    const html = loadPage("mnemonic-display")
      .replace(/\{\{TITLE\}\}/g, title)
      .replace(/\{\{WORDS_HTML\}\}/g, wordsHtml)
      .replace(/\{\{SECRET\}\}/g, secret)
      .replace(/\{\{TOKEN\}\}/g, token);

    await startDialogServer(html, token, 70_000);
  }

  notify(message: string): void {
    console.log(`[Claw Wallet] ${message}`);
  }
}
