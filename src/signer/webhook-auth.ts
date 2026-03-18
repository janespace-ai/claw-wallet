import type { AuthProvider, SigningContext } from "./auth-provider.js";

/**
 * Webhook AuthProvider skeleton — sends HTTP POST notifications and polls for response.
 * To be implemented with specific webhook targets (Telegram Bot, custom endpoint).
 */
export class WebhookAuthProvider implements AuthProvider {
  private webhookUrl: string;
  private pollIntervalMs: number;
  private timeoutMs: number;

  constructor(webhookUrl: string, pollIntervalMs = 2000, timeoutMs = 60_000) {
    this.webhookUrl = webhookUrl;
    this.pollIntervalMs = pollIntervalMs;
    this.timeoutMs = timeoutMs;
  }

  async requestPin(_context: SigningContext): Promise<string> {
    throw new Error("WebhookAuthProvider not fully implemented");
  }

  async requestConfirm(_context: SigningContext): Promise<boolean> {
    throw new Error("WebhookAuthProvider not fully implemented");
  }

  async requestSecretInput(_prompt: string): Promise<string> {
    throw new Error("WebhookAuthProvider not fully implemented — secret input requires secure channel");
  }

  notify(message: string): void {
    fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, timestamp: Date.now() }),
    }).catch(() => {});
  }
}
