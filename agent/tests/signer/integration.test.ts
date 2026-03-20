import { describe, it, expect } from "vitest";
import { SignerClient } from "../../signer/ipc-client.js";

describe("Signer IPC protocol", () => {
  it("SignerClient throws when signer is not running", async () => {
    const client = new SignerClient("/tmp/nonexistent-socket.sock", 1000);
    await expect(client.call("get_address")).rejects.toThrow();
  });
});
