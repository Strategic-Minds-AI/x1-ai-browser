import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sessionManager = await readFile(new URL("../session-manager.js", import.meta.url), "utf8");
const server = await readFile(new URL("../server.js", import.meta.url), "utf8");

test("missing persistence schema fails quiet instead of flooding the runtime", () => {
  assert.match(sessionManager, /browser_sessions_schema_missing/);
  assert.match(sessionManager, /disablePersistence/);
  assert.match(sessionManager, /isMissingSessionTable/);
});

test("session resume seeds origin storage before target navigation", () => {
  assert.match(server, /storageByOrigin/);
  assert.match(server, /addInitScript/);
  assert.match(server, /if \(opts\.target_url\)/);
});
