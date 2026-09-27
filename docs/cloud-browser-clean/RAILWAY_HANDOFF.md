# Railway Engine Handoff

Verified read-only runtime observations on 2026-09-27:

- Project: `cloudbrowser-control`
- Service: `cloudbrowser-engine`
- Environment: `production`
- Service domain: `cloudbrowser-engine-production.up.railway.app`
- Target port: `8080`
- Health path: `/health`
- Source root: `browser-engine`
- Active source commit observed at deployment: `c9e5a5a10fcfd8d9adf72a8d3491afd9cfc3ee97`
- Active deployment status observed: `SUCCESS`
- Replica count observed: `1`

The cleaned `browser-engine/railway.toml` therefore uses one replica by default. Browser sessions are held by a process-local Playwright worker, so horizontal scaling must not be enabled without a verified routing/session-affinity or distributed-session design.

Recent Railway request evidence showed successful engine health checks, session creation, action execution, and session deletion. Separate log noise showed the optional `browser_sessions` persistence table was missing; the cleaned session manager now disables optional metadata persistence after that condition instead of polling the missing table indefinitely.
