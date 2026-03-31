import { describe, it, expect, vi } from "vitest";
import {
  MessageRouter,
  MessageType,
  type DecryptedMessage,
  type EncryptedMessage,
} from "./message-router.js";

function enc(): EncryptedMessage {
  return { type: "x", payload: "ignored" };
}

describe("MessageRouter", () => {
  it("emits sign-request for SIGN_REQUEST from any account when inactive", async () => {
    const router = new MessageRouter();
    router.setActiveAccount(1);
    const handler = vi.fn();
    router.on("sign-request", handler);
    router.setDecryptFunction(async () => ({
      type: MessageType.SIGN_REQUEST,
      requestId: "r1",
    }));
    await router.route(0, enc());
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      fromAccount: 0,
      isActiveAccount: false,
      requestId: "r1",
    });
  });

  it("queues BALANCE_UPDATE for inactive account and processes on processQueuedMessages", async () => {
    const router = new MessageRouter();
    router.setActiveAccount(1);
    const balanceHandler = vi.fn();
    router.on("balance-update", balanceHandler);
    router.setDecryptFunction(async (_idx, msg) => {
      if (msg.payload === "bal") {
        return { type: MessageType.BALANCE_UPDATE, total: "1" };
      }
      return { type: MessageType.SIGN_REQUEST };
    });
    await router.route(0, { type: "x", payload: "bal" });
    expect(balanceHandler).not.toHaveBeenCalled();
    expect(router.getQueuedMessageCount(0)).toBe(1);

    router.setActiveAccount(0);
    await router.processQueuedMessages(0);
    expect(balanceHandler).toHaveBeenCalledTimes(1);
    expect(router.getQueuedMessageCount(0)).toBe(0);
  });

  it("emits transaction-confirmed with showNotification false when from another account", async () => {
    const router = new MessageRouter();
    router.setActiveAccount(2);
    const handler = vi.fn();
    router.on("transaction-confirmed", handler);
    router.setDecryptFunction(async () => ({
      type: MessageType.TRANSACTION_CONFIRMED,
      hash: "0xabc",
    }));
    await router.route(1, enc());
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        fromAccount: 1,
        showNotification: false,
        hash: "0xabc",
      }),
    );
  });

  it("emits unknown-message for unrecognized type", async () => {
    const router = new MessageRouter();
    const handler = vi.fn();
    router.on("unknown-message", handler);
    router.setDecryptFunction(async () => ({ type: "NOT_A_REAL_TYPE" }));
    await router.route(0, enc());
    expect(handler).toHaveBeenCalled();
  });

  it("routeDecrypted dispatches SIGN_REQUEST without decryptFn (Relay path)", async () => {
    const router = new MessageRouter();
    router.setActiveAccount(1);
    router.setAccountInfoResolver(async (idx) => ({
      nickname: `N${idx}`,
      address: `0x${idx.toString().padStart(40, "0")}`,
    }));
    const handler = vi.fn();
    router.on("sign-request", handler);
    const msg: DecryptedMessage = {
      type: MessageType.SIGN_REQUEST,
      fromAccount: 0,
      data: { requestId: "relay-r1", method: "sign_transaction" },
    };
    await router.routeDecrypted(msg);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({
      fromAccount: 0,
      isActiveAccount: false,
      requestId: "relay-r1",
    });
  });
});
