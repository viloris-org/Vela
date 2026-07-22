import { describe, expect, test } from "bun:test";
import {
  rpcErr,
  rpcOk,
  VelaRpcErrorCodes,
  type VelaRpcRequest,
  type VelaRpcResponse,
} from "./rpc.ts";

describe("RPC envelopes", () => {
  test("request shape is JSON-serializable", () => {
    const req: VelaRpcRequest = {
      id: "1",
      channel: "call",
      method: "fs.read",
      args: { path: "a.txt" },
    };
    expect(JSON.parse(JSON.stringify(req))).toEqual(req);
  });

  test("rpcOk / rpcErr helpers", () => {
    const ok: VelaRpcResponse = rpcOk("1", { n: 2 });
    expect(ok).toEqual({ id: "1", ok: true, result: { n: 2 } });
    const err = rpcErr("2", VelaRpcErrorCodes.capabilityDenied, "missing fs");
    expect(err.ok).toBe(false);
    if (!err.ok) {
      expect(err.error.code).toBe("capability.denied");
    }
  });

  test("generation.stale code matches web-shape reject reason", () => {
    expect(VelaRpcErrorCodes.generationStale).toBe("generation.stale");
  });
});
