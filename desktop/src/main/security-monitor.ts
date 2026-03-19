import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";

export interface SecurityEvent {
  type: string;
  message: string;
  timestamp: number;
  details?: Record<string, string>;
}

interface PendingAlert {
  alertId: string;
  type: string;
  resolved: boolean;
  action?: string;
  timestamp: number;
}

const MAX_EVENTS = 1000;

export class SecurityMonitor {
  private dataDir: string;
  private events: SecurityEvent[] = [];
  private pendingAlerts = new Map<string, PendingAlert>();
  private sameMachineDetected = false;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async initialize(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    try {
      const raw = await readFile(join(this.dataDir, "security-events.json"), "utf-8");
      this.events = JSON.parse(raw);
    } catch {
      this.events = [];
    }
  }

  recordIPChange(deviceId: string, oldIP: string, newIP: string): void {
    this.addEvent({
      type: "ip_change",
      message: `Agent device ${deviceId} IP changed from ${oldIP} to ${newIP}`,
      timestamp: Date.now(),
      details: { deviceId, oldIP, newIP },
    });
  }

  recordFingerprintChange(deviceId: string, oldFingerprint: string, newFingerprint: string): void {
    this.addEvent({
      type: "fingerprint_change",
      message: `Agent device ${deviceId} fingerprint changed`,
      timestamp: Date.now(),
      details: { deviceId, old: oldFingerprint, new: newFingerprint },
    });
  }

  recordSameMachine(machineId: string): void {
    this.sameMachineDetected = true;
    this.addEvent({
      type: "same_machine",
      message: "Agent and Wallet App detected on the same machine",
      timestamp: Date.now(),
      details: { machineId },
    });
  }

  hasSameMachineWarning(): boolean {
    return this.sameMachineDetected;
  }

  async respondToAlert(alertId: string, action: "freeze" | "allow_once" | "trust"): Promise<void> {
    const alert = this.pendingAlerts.get(alertId);
    if (!alert) throw new Error("Alert not found");

    alert.resolved = true;
    alert.action = action;

    this.addEvent({
      type: "alert_response",
      message: `Alert ${alertId} responded with action: ${action}`,
      timestamp: Date.now(),
      details: { alertId, action },
    });
  }

  getEvents(): SecurityEvent[] {
    return [...this.events].reverse();
  }

  getPendingAlerts(): PendingAlert[] {
    return [...this.pendingAlerts.values()].filter(a => !a.resolved);
  }

  private addEvent(event: SecurityEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }
    this.saveEvents();
  }

  private async saveEvents(): Promise<void> {
    try {
      await writeFile(
        join(this.dataDir, "security-events.json"),
        JSON.stringify(this.events, null, 2),
        { mode: 0o600 }
      );
    } catch {}
  }
}
