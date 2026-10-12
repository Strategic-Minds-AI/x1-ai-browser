import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (await readFile(new URL("../base44/shared/engineClient.ts", import.meta.url), "utf8"))
  .replace('import { secrets } from "base44:runtime";', 'const secrets = { get:(name)=>globalThis.__testSecrets.get(name) };');
const client = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const urls = ["https://engine-a.invalid", "https://engine-b.invalid", "https://engine-c.invalid"];
const owner = "worker-b";
const originalFetch = globalThis.fetch;
const originalSecrets = globalThis.__testSecrets;
function configure(record, healthIds) {
  globalThis.__testSecrets = { get(name) {
    return ({ ENGINE_URL:urls[0], ENGINE_URL_2:urls[1], ENGINE_URL_3:urls[2], ENGINE_API_KEY:"test-nonsecret" })[name];
  }};
  client.setEngineClient({ asServiceRole:{entities:{
    Setting:{filter:async()=>[]},
    Session:{filter:async()=>record == null ? [] : [record]},
  }}});
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    const base = urls.find(u=>url.startsWith(u));
    if (url.endsWith("/health")) return { ok:true, status:200, json:async()=>({worker_id:healthIds[base]}) };
    return {ok:true,status:200,text:async()=>JSON.stringify({result:"ok"})};
  };
  return calls;
}
test.after(()=>{globalThis.fetch=originalFetch;globalThis.__testSecrets=originalSecrets});
test("session action uses only the matching owning engine",async()=>{
  const calls=configure({metadata:{worker_id:owner}},Object.fromEntries(urls.map((u,i)=>[u,"worker-"+String.fromCharCode(97+i)])));
  await client.enginePost("/sessions/sess-123/execute",{action_type:"goto"});
  assert.equal(calls.filter(x=>x.includes("/execute")).length,1);
  assert.equal(calls.find(x=>x.includes("/execute")),urls[1]+"/sessions/sess-123/execute");
});
test("unknown owner rejects before session execution",async()=>{
  const calls=configure({metadata:{}},Object.fromEntries(urls.map((u,i)=>[u,"worker-"+i])));
  await assert.rejects(client.enginePost("/sessions/sess-123/execute",{}),/SESSION_OWNER_UNVERIFIED/);
  assert.equal(calls.filter(x=>x.includes("/execute")).length,0);
});
test("ambiguous owner rejects rather than cross-routing",async()=>{
  const calls=configure({metadata:{worker_id:owner}},{[urls[0]]:owner,[urls[1]]:owner,[urls[2]]:"worker-c"});
  await assert.rejects(client.enginePost("/sessions/sess-123/execute",{}),/SESSION_OWNER_ENGINE_UNAVAILABLE/);
  assert.equal(calls.filter(x=>x.includes("/execute")).length,0);
});
test("missing engine rejects rather than cycling through alternate sessions",async()=>{
  const calls=configure({metadata:{worker_id:owner}},Object.fromEntries(urls.map((u,i)=>[u,"different-"+i])));
  await assert.rejects(client.enginePost("/sessions/sess-123/execute",{}),/SESSION_OWNER_ENGINE_UNAVAILABLE/);
  assert.equal(calls.filter(x=>x.includes("/execute")).length,0);
});
