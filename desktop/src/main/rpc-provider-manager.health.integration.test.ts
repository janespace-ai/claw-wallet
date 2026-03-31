import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { RPCProviderManager } from "./rpc-provider-manager";
import type { NetworkConfigService, RPCProvider } from "./network-config-service";

const CHAIN_ID = 900001;
const CHAIN_ID_HEX = "0x" + CHAIN_ID.toString(16);

function mockNetworkConfig(rpcs: RPCProvider[]): NetworkConfigService {
  return {
    getSupportedChainIds: () => [CHAIN_ID],
    getRPCProviders: (chainId: number) => (chainId === CHAIN_ID ? rpcs : []),
    getNetwork: (chainId: number) => ({ name: "IntegrationMock", chainId: chainId }),
  } as NetworkConfigService;
}

type RpcServer = { url: string; close: () => Promise<void> };

type RpcReq = { method?: string; id?: number | string };

function startJsonRpcServer(opts: {
  respond: (body: RpcReq | RpcReq[]) => { status: number; json?: unknown };
}): Promise<RpcServer> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 404;
        res.end();
        return;
      }
      let buf = "";
      req.on("data", (c) => {
        buf += c;
      });
      req.on("end", () => {
        let body: unknown;
        try {
          body = JSON.parse(buf || "{}");
        } catch {
          res.statusCode = 400;
          res.end();
          return;
        }
        const out = opts.respond(body as RpcReq | RpcReq[]);
        res.statusCode = out.status;
        if (out.json != null) {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(out.json));
        } else {
          res.end();
        }
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise<void>((r, rej) => {
            server.close((e) => (e ? rej(e) : r()));
          }),
      });
    });
    server.on("error", reject);
  });
}

function standardNodeResponses(body: RpcReq | RpcReq[]): { status: number; json?: unknown } {
  const chainHex = CHAIN_ID_HEX;
  const answer = (req: RpcReq): Record<string, unknown> => {
    const id = req.id ?? 1;
    const m = req.method;
    if (m === "eth_blockNumber") {
      return { jsonrpc: "2.0", id, result: "0x2a" };
    }
    if (m === "eth_chainId" || m === "eth_networkId") {
      return { jsonrpc: "2.0", id, result: chainHex };
    }
    if (m === "net_version") {
      return { jsonrpc: "2.0", id, result: String(CHAIN_ID) };
    }
    return { jsonrpc: "2.0", id, result: null };
  };
  if (Array.isArray(body)) {
    return { status: 200, json: body.map((r) => answer(r)) };
  }
  return { status: 200, json: answer(body) };
}

const loopbackHttpOk = process.env.VITEST_LOOPBACK_HTTP === "1";

describe.skipIf(!loopbackHttpOk)("RPCProviderManager health checks (mock HTTP JSON-RPC)", () => {
  const servers: RpcServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((s) => s.close()));
  });

  it("marks RPC healthy after successful eth_blockNumber via real provider", async () => {
    const srv = await startJsonRpcServer({
      respond: (body) => standardNodeResponses(body),
    });
    servers.push(srv);

    const manager = new RPCProviderManager(
      mockNetworkConfig([{ url: srv.url, priority: 0, custom: false }]),
    );
    const metrics = await manager.manualHealthCheck(srv.url, CHAIN_ID);
    expect(metrics.healthy).toBe(true);
    expect(metrics.consecutiveFailures).toBe(0);

    const p = await manager.getProvider(CHAIN_ID);
    const url = (p as unknown as { _getConnection: () => { url: string } })._getConnection().url;
    expect(url).toBe(srv.url);
  });

  it("fails over to second endpoint when first returns RPC errors", async () => {
    const bad = await startJsonRpcServer({
      respond: () => ({ status: 500 }),
    });
    const good = await startJsonRpcServer({
      respond: (body) => standardNodeResponses(body),
    });
    servers.push(bad, good);

    const manager = new RPCProviderManager(
      mockNetworkConfig([
        { url: bad.url, priority: 0, custom: false },
        { url: good.url, priority: 1, custom: false },
      ]),
    );

    await manager.manualHealthCheck(bad.url, CHAIN_ID);
    await manager.manualHealthCheck(good.url, CHAIN_ID);

    const p = await manager.getProvider(CHAIN_ID);
    const url = (p as unknown as { _getConnection: () => { url: string } })._getConnection().url;
    expect(url).toBe(good.url);
  });
});
