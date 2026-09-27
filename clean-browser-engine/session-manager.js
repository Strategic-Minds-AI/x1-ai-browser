/**
 * Optional Supabase-backed session metadata manager for Cloud Browser Engine.
 * Core browser execution remains in-process and must continue when persistence
 * is unavailable or not provisioned.
 */

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WORKER_ID = process.env.RAILWAY_REPLICA_ID || process.env.HOSTNAME || "worker-local";

const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { realtime: { transport: ws } })
  : null;

const SESSION_TABLE = "browser_sessions";
const HEARTBEAT_INTERVAL_MS = 15000;
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS || "300000", 10);
const ZOMBIE_TIMEOUT_MS = 60000;
const CLEANUP_INTERVAL_MS = 30000;

function isMissingSessionTable(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const message = String(error.message || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /browser_sessions/i.test(message) && /does not exist|schema cache|could not find/i.test(message)
  );
}

class SessionManager {
  constructor() {
    this.localSessions = new Map();
    this.heartbeatTimers = new Map();
    this.isEnabled = !!supabase;
    this.persistenceDisabledReason = this.isEnabled ? null : "persistence_not_configured";
    this.cleanupTimer = null;

    if (!this.isEnabled) {
      console.warn("Session metadata persistence disabled: SUPABASE_URL or SUPABASE_SERVICE_KEY not set.");
    }
  }

  disablePersistence(reason, error) {
    if (!this.isEnabled) return;
    this.isEnabled = false;
    this.persistenceDisabledReason = reason || "persistence_unavailable";
    for (const timer of this.heartbeatTimers.values()) clearInterval(timer);
    this.heartbeatTimers.clear();
    const suffix = error?.message ? ` (${error.message})` : "";
    console.warn(`Session metadata persistence disabled: ${this.persistenceDisabledReason}${suffix}`);
  }

  async initSchema() {
    if (!this.isEnabled) return false;
    try {
      const { error } = await supabase
        .from(SESSION_TABLE)
        .select("id", { count: "exact", head: true })
        .limit(1);

      if (error) {
        if (isMissingSessionTable(error)) {
          this.disablePersistence("browser_sessions_schema_missing", error);
          return false;
        }
        console.warn(`Session schema check failed; continuing in-process only: ${error.message}`);
        this.disablePersistence("session_schema_check_failed", error);
        return false;
      }

      console.log(`Session metadata persistence ready (${SESSION_TABLE}).`);
      return true;
    } catch (error) {
      this.disablePersistence("session_schema_check_exception", error);
      return false;
    }
  }

  async trackSession(id, sessionData) {
    this.localSessions.set(id, sessionData);
    if (!this.isEnabled) return;

    const { status, url } = sessionData;
    const { error } = await supabase.from(SESSION_TABLE).upsert({
      id,
      worker_id: WORKER_ID,
      status: status || "active",
      url: url || "",
      ttl_ms: SESSION_TTL_MS,
      last_heartbeat: new Date().toISOString(),
    });

    if (error) {
      if (isMissingSessionTable(error)) this.disablePersistence("browser_sessions_schema_missing", error);
      else console.warn(`Failed to persist session ${id}: ${error.message}`);
      return;
    }

    this.startHeartbeat(id);
  }

  startHeartbeat(id) {
    if (!this.isEnabled || this.heartbeatTimers.has(id)) return;

    const beat = async () => {
      if (!this.localSessions.has(id)) {
        clearInterval(this.heartbeatTimers.get(id));
        this.heartbeatTimers.delete(id);
        return;
      }
      if (!this.isEnabled) return;

      const { error } = await supabase
        .from(SESSION_TABLE)
        .update({ last_heartbeat: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        if (isMissingSessionTable(error)) this.disablePersistence("browser_sessions_schema_missing", error);
        else console.warn(`Session heartbeat failed for ${id}: ${error.message}`);
      }
    };

    this.heartbeatTimers.set(id, setInterval(beat, HEARTBEAT_INTERVAL_MS));
  }

  async setStatus(id, status) {
    const session = this.localSessions.get(id);
    if (session) session.status = status;
    if (!this.isEnabled) return;

    const { error } = await supabase.from(SESSION_TABLE).update({ status }).eq("id", id);
    if (error) {
      if (isMissingSessionTable(error)) this.disablePersistence("browser_sessions_schema_missing", error);
      else console.warn(`Failed to persist status for ${id}: ${error.message}`);
    }
  }

  async closeSession(id) {
    const session = this.localSessions.get(id);
    if (!session) return false;

    if (this.heartbeatTimers.has(id)) {
      clearInterval(this.heartbeatTimers.get(id));
      this.heartbeatTimers.delete(id);
    }

    if (this.isEnabled) {
      const { error } = await supabase
        .from(SESSION_TABLE)
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", id);
      if (error && isMissingSessionTable(error)) this.disablePersistence("browser_sessions_schema_missing", error);
    }

    this.localSessions.delete(id);
    return true;
  }

  async cleanupZombies() {
    if (!this.isEnabled) {
      const now = Date.now();
      for (const [id, session] of this.localSessions) {
        if (session.status === "active" && now - Number(session.lastActivity || now) > ZOMBIE_TIMEOUT_MS) {
          console.warn(`Local zombie detected: ${id}`);
        }
      }
      return;
    }

    const zombieThreshold = new Date(Date.now() - ZOMBIE_TIMEOUT_MS).toISOString();
    try {
      const { data: zombies, error } = await supabase
        .from(SESSION_TABLE)
        .select("id")
        .in("status", ["active", "pooled"])
        .eq("worker_id", WORKER_ID)
        .lt("last_heartbeat", zombieThreshold);

      if (error) {
        if (isMissingSessionTable(error)) this.disablePersistence("browser_sessions_schema_missing", error);
        else console.warn(`Zombie cleanup query failed: ${error.message}`);
        return;
      }

      if (!zombies?.length) return;
      const ids = zombies.map(({ id }) => id);
      const { error: updateError } = await supabase
        .from(SESSION_TABLE)
        .update({ status: "zombie" })
        .in("id", ids);

      if (updateError) {
        if (isMissingSessionTable(updateError)) this.disablePersistence("browser_sessions_schema_missing", updateError);
        else console.warn(`Failed to mark zombie sessions: ${updateError.message}`);
      }
    } catch (error) {
      console.warn(`Zombie cleanup failed: ${error.message}`);
    }
  }

  async recoverSessions() {
    if (!this.isEnabled) return [];
    try {
      const { data, error } = await supabase
        .from(SESSION_TABLE)
        .select("*")
        .in("status", ["pooled", "active"])
        .eq("worker_id", WORKER_ID);

      if (error) {
        if (isMissingSessionTable(error)) this.disablePersistence("browser_sessions_schema_missing", error);
        else console.warn(`Failed to recover session metadata: ${error.message}`);
        return [];
      }
      return data || [];
    } catch (error) {
      console.warn(`Session metadata recovery failed: ${error.message}`);
      return [];
    }
  }

  getSession(id) {
    return this.localSessions.get(id);
  }

  getAllSessions() {
    return Array.from(this.localSessions.values());
  }

  startCleanupLoop() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => void this.cleanupZombies(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref?.();
  }
}

export { isMissingSessionTable };
export default SessionManager;
