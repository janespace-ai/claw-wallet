import type { AuthProvider, SigningContext } from "./auth-provider.js";

/**
 * GUI AuthProvider skeleton — to be implemented with native dialogs (Electron/Tauri).
 * Falls back to console for now.
 */
export class GuiAuthProvider implements AuthProvider {
  async requestPin(context: SigningContext): Promise<string> {
    throw new Error("GuiAuthProvider not implemented. Use TUI or Webhook provider.");
  }

  async requestConfirm(context: SigningContext): Promise<boolean> {
    throw new Error("GuiAuthProvider not implemented. Use TUI or Webhook provider.");
  }

  async requestSecretInput(prompt: string): Promise<string> {
    throw new Error("GuiAuthProvider not implemented. Use TUI or Webhook provider.");
  }

  notify(message: string): void {
    console.log(`[GUI] ${message}`);
  }
}
