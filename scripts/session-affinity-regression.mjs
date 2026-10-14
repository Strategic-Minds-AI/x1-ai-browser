// Isolated session-affinity regression. No browser, live credentials, or network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const engineSource = readFileSync(new URL("../base44/shared/engineClient.ts", import.meta.url), "utf8");
const transformed = engineSource
  .replace(/^import \{ secrets \} from "base44:runtime";\s*$/m, "const secrets = globalThis.__secrets;")
  .replace(/^export /gm, "")
  + "\nglobalThis.__api = { setEngineClient, enginePost, engineDelete, engineFetch };";
assert.ok(transformed.includes("globalThis.__api"), "harness prepared");
assert.ok(!transformed.includes('from "base44:runtime"'), "service import stubbed");

const engines = ["https://engine-one.example", "https://engine-two.example", "https://engine-three.example"];
const apiKey = "SYNTHETIC_DO_NOT_USE_ANYWHERE";
const secretsMap = {
  ENGINE_URL: engines[0], ENGINE_URL_2: engines[1], ENGINE_URL_3: engines[2], ENGINE_API_KEY: apiKey,
};
let requests = [];
let failPinned = false;
const mockFetch = async (url, options = {}) => {
  requests.push({ url, method: options.method, authorized: options.headers?.["x-api-key"] === apiKey });
  const origin = engines.find(e => url.startsWith(e + "/"));
  if (!origin) throw new Error("unexpected outbound origin");
  const path = url.slice(origin.length);
  const reply = (status, data) => ({
    status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(data),
  });
  if (path === "/sessions" && options.method === "POST") {
    return origin === engines[0]
      ? reply(503, { error: "first engine unavailable" })
      : reply(201, { sessionId: "sess_test_affinity", workerId: "worker-two" });
  }
  if (path === "/sessions/sess_test_affinity/execute" && origin === engines[1]) {
    return failPinned ? reply(503, { error: "engine temporarily down" }) : reply(200, { ok: true, url: "https://example.org" });
  }
  return reply(404, { error: "Session not found" });
};
const context = {
  __secrets: { get: key => secretsMap[key] },
  fetch: mockFetch,
  console: { error() {}, log() {} },
  crypto,
  TextEncoder, Uint8Array, Array, Object, String, JSON, Error, Set,
};
context.globalThis = context;
vm.runInNewContext(transformed, context, { timeout: 1500 });
const { setEngineClient, enginePost, engineDelete } = context.__api;
setEngineClient({ asServiceRole: { entities: { Setting: { filter: async () => [] } } } });

// Creation may fail over to another healthy engine, but carries origin.
const created = await enginePost("/sessions", { usePool: true });
assert.equal(created.sessionId, "sess_test_affinity");
assert.equal(created._engine_origin, engines[1]);
assert.deepEqual(requests.map(r => r.url), engines.slice(0, 2).map(e => e + "/sessions"));
assert.ok(requests.every(r => r.authorized), "secret-vault API key forwarded on all engine requests");

// Existing session actions stay on the exact engine that created the session.
requests = [];
const action = await enginePost("/sessions/sess_test_affinity/execute", { action_type: "observe" }, undefined, created._engine_origin);
assert.equal(action.ok, true);
assert.deepEqual(requests.map(r => r.url), [engines[1] + "/sessions/sess_test_affinity/execute"]);

// A forged session origin cannot produce SSRF or route outside approved engines.
requests = [];
await assert.rejects(
  () => enginePost("/sessions/sess_test_affinity/execute", {}, undefined, "https://not-an-engine.example"),
  /not a configured browser engine/
);
assert.equal(requests.length, 0);

// Session requests must not cross over to a different engine on 5xx.
requests = [];
failPinned = true;
await assert.rejects(
  () => enginePost("/sessions/sess_test_affinity/execute", {}, undefined, created._engine_origin),
  /All engines failed/
);
assert.deepEqual(requests.map(r => r.url), [engines[1] + "/sessions/sess_test_affinity/execute"]);

// Session cleanup uses the same validated origin.
requests = [];
await assert.rejects(() => engineDelete("/sessions/sess_test_affinity", undefined, created._engine_origin), /All engines failed/);
assert.deepEqual(requests.map(r => r.url), [engines[1] + "/sessions/sess_test_affinity"]);

// Ensure both routing surfaces persist origin metadata from the real engine response.
const mcpTools = readFileSync(new URL("../base44/functions/mcpTools/entry.ts", import.meta.url), "utf8");
const gateway = readFileSync(new URL("../base44/shared/gatewayCore.ts", import.meta.url), "utf8");
assert.match(mcpTools, /engine_origin: engineRes\._engine_origin/);
assert.match(mcpTools, /session\.metadata\?\.engine_origin/);
assert.equal((gateway.match(/engine_origin: engineRes\._engine_origin/g) || []).length, 2);
assert.match(gateway, /requestId, session\.metadata\?\.engine_origin/);
console.log("PASS engine origin routing: creation, sticky action, SSRF allowlist, no cross-engine failover, sticky cleanup, integration coverage");
