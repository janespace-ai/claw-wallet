import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

class Logger {
  private logFile: string;
  private logToConsole: boolean;

  constructor(logFile?: string) {
    const logDir = join(homedir(), ".openclaw", "logs");
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    
    // Include time in filename to avoid overwriting on restart
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19); // YYYY-MM-DDTHH-MM-SS
    this.logFile = logFile || join(logDir, `agent-${timestamp}.log`);
    this.logToConsole = true;

    // Initialize log file with header
    const header = `
========================================
Claw Wallet Agent Log
Started: ${new Date().toISOString()}
Log File: ${this.logFile}
========================================

`;
    writeFileSync(this.logFile, header);
  }

  private formatMessage(level: string, component: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] [${component}] ${message}`;
    
    if (data !== undefined) {
      try {
        logMessage += `\n  Data: ${JSON.stringify(data, null, 2)}`;
      } catch (err) {
        logMessage += `\n  Data: [Circular or non-serializable]`;
      }
    }
    
    return logMessage + "\n";
  }

  log(component: string, message: string, data?: any) {
    const formatted = this.formatMessage("INFO", component, message, data);
    if (this.logToConsole) {
      console.log(formatted.trim());
    }
    appendFileSync(this.logFile, formatted);
  }

  error(component: string, message: string, error?: any) {
    const formatted = this.formatMessage("ERROR", component, message, error);
    if (this.logToConsole) {
      console.error(formatted.trim());
    }
    appendFileSync(this.logFile, formatted);
  }

  warn(component: string, message: string, data?: any) {
    const formatted = this.formatMessage("WARN", component, message, data);
    if (this.logToConsole) {
      console.warn(formatted.trim());
    }
    appendFileSync(this.logFile, formatted);
  }

  debug(component: string, message: string, data?: any) {
    const formatted = this.formatMessage("DEBUG", component, message, data);
    if (this.logToConsole) {
      console.log(formatted.trim());
    }
    appendFileSync(this.logFile, formatted);
  }

  getLogFile(): string {
    return this.logFile;
  }

  setConsoleOutput(enabled: boolean) {
    this.logToConsole = enabled;
  }
}

// Global logger instance
export const logger = new Logger();

// Helper to log tool executions
export function logToolExecution(toolName: string, args: any, result: any) {
  logger.log("TOOL", `Executing ${toolName}`, { args, result });
}

// Helper to log errors with stack traces
export function logError(component: string, message: string, error: Error) {
  logger.error(component, message, {
    message: error.message,
    stack: error.stack,
    name: error.name,
  });
}
