import { createInterface } from "node:readline";
import { createReadStream, createWriteStream } from "node:fs";
import type { AuthProvider, SigningContext, PasswordValidator } from "./auth-provider.js";

export class TuiAuthProvider implements AuthProvider {
  private getTty() {
    const input = createReadStream("/dev/tty");
    const output = createWriteStream("/dev/tty");
    return { input, output };
  }

  private prompt(question: string, hidden = false): Promise<string> {
    return new Promise((resolve, reject) => {
      let ttyInput: ReturnType<typeof createReadStream> | undefined;
      let ttyOutput: ReturnType<typeof createWriteStream> | undefined;
      try {
        const tty = this.getTty();
        ttyInput = tty.input;
        ttyOutput = tty.output;
      } catch {
        reject(new Error("No TTY available for secure input"));
        return;
      }

      const rl = createInterface({ input: ttyInput, output: ttyOutput, terminal: true });

      if (hidden) {
        ttyOutput.write(question);
        const origWrite = ttyOutput.write.bind(ttyOutput);
        (ttyOutput as any).write = (data: any) => {
          if (typeof data === "string" && data !== "\n" && data !== "\r\n") return true;
          return origWrite(data);
        };
        rl.question("", (answer) => {
          (ttyOutput as any).write = origWrite;
          ttyOutput!.write("\n");
          rl.close();
          ttyInput!.destroy();
          resolve(answer);
        });
      } else {
        rl.question(question, (answer) => {
          rl.close();
          ttyInput!.destroy();
          resolve(answer);
        });
      }
    });
  }

  async requestPin(context: SigningContext): Promise<string> {
    const desc = this.formatContext(context);
    return this.prompt(`\n🔐 ${desc}\nEnter PIN: `, true);
  }

  async requestConfirm(context: SigningContext): Promise<boolean> {
    const desc = this.formatContext(context);
    const answer = await this.prompt(`\n🔐 ${desc}\nConfirm? [y/N]: `);
    return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
  }

  async requestSecretInput(promptText: string): Promise<string> {
    return this.prompt(`\n🔑 ${promptText}: `, true);
  }

  async requestPasswordWithConfirmation(
    context: SigningContext,
    validator: PasswordValidator,
    maxRetries = 3,
  ): Promise<string> {
    const desc = this.formatContext(context);
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const password = await this.prompt(`\n🔐 ${desc}\nEnter password: `, true);
      const result = validator(password);
      if (!result.valid) {
        this.notifyDirect(`❌ Password rejected:\n${result.errors.map((e) => `  - ${e}`).join("\n")}`);
        continue;
      }
      const confirm = await this.prompt("Confirm password: ", true);
      if (password !== confirm) {
        this.notifyDirect("❌ Passwords do not match");
        continue;
      }
      return password;
    }
    throw new Error("Maximum password retries exceeded");
  }

  notify(message: string): void {
    this.notifyDirect(`📋 ${message}`);
  }

  async displaySecretToUser(title: string, secret: string): Promise<void> {
    try {
      const { output } = this.getTty();
      output.write(`\n${"=".repeat(50)}\n`);
      output.write(`⚠️  ${title}\n`);
      output.write(`${"=".repeat(50)}\n\n`);
      output.write(`${secret}\n\n`);
      output.write(`${"=".repeat(50)}\n`);
      output.write(`Keep this safe. Press Enter to clear.\n`);
      output.destroy();
    } catch {}

    await new Promise<void>((resolve) => {
      try {
        const { input } = this.getTty();
        const rl = (import("node:readline")).then((m) =>
          m.createInterface({ input, terminal: false })
        );
        rl.then((r) => {
          r.once("line", () => { r.close(); resolve(); });
          setTimeout(() => { r.close(); resolve(); }, 60_000);
        });
      } catch {
        resolve();
      }
    });
  }

  private notifyDirect(message: string): void {
    try {
      const { output } = this.getTty();
      output.write(`\n${message}\n`);
      output.destroy();
    } catch {}
  }

  private formatContext(ctx: SigningContext): string {
    const parts: string[] = [];
    parts.push(`Operation: ${ctx.operation}`);
    if (ctx.to) parts.push(`To: ${ctx.to}`);
    if (ctx.amount && ctx.token) parts.push(`Amount: ${ctx.amount} ${ctx.token}`);
    if (ctx.chain) parts.push(`Chain: ${ctx.chain}`);
    parts.push(`Auth level: ${ctx.level}`);
    return parts.join(" | ");
  }
}
