import http from "node:http";

/**
 * Detect whether we can bind an HTTP server to 127.0.0.1 (some sandboxes return EPERM).
 * Integration tests that need a local mock JSON-RPC server read `process.env.VITEST_LOOPBACK_HTTP`.
 */
export default async function vitestGlobalSetup(): Promise<void> {
  const ok = await new Promise<boolean>((resolve) => {
    const s = http.createServer((_req, res) => res.end());
    s.listen(0, "127.0.0.1", () => {
      s.close(() => resolve(true));
    });
    s.on("error", () => resolve(false));
  });
  process.env.VITEST_LOOPBACK_HTTP = ok ? "1" : "0";
}
