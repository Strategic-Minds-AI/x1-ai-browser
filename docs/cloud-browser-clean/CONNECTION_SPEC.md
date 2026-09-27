# Canonical Cloud Browser Connection Specification

## Public MCP surface

- Transport: Streamable HTTP
- Route: `/mcp`
- Authentication: `Authorization: Bearer <CLOUD_BROWSER_MCP_KEY>`
- TLS: required for remote/public use
- Session model: MCP transport is stateless; browser session continuity is carried explicitly by `session_id` tool arguments
- Protocol serving: current MCP v2 modern protocol with stateless compatibility for 2025-era clients on the same endpoint

No alternate MCP paths should be registered for this service.

## Server-to-engine surface

- Engine base URL: `https://cloudbrowser-engine-production.up.railway.app`
- Engine authentication: `x-api-key: <ENGINE_API_KEY>`
- Engine key location: server-side environment/secret store only
- Engine health: `GET /health`
- Create session: `POST /sessions`
- Session state: `GET /sessions/:id`
- Execute action: `POST /sessions/:id/execute`
- Keepalive: `POST /sessions/:id/keepalive`
- Screenshot: `GET /sessions/:id/screenshot`
- End session: `DELETE /sessions/:id`

MCP clients do not connect directly to the engine and never receive the engine credential.

## Required gateway environment

| Variable | Required | Purpose |
|---|---:|---|
| `CLOUD_BROWSER_MCP_KEY` | yes | Bearer credential for MCP clients |
| `BROWSER_ENGINE_URL` | yes | Canonical Railway engine URL |
| `ENGINE_API_KEY` | yes | Private gateway-to-engine credential |
| `PORT` | platform-dependent | Gateway HTTP port |
| `MCP_ALLOWED_HOSTS` | optional | Explicit hostname allowlist |
| `MCP_ALLOWED_ORIGINS` | optional | Browser-origin allowlist |

## Connection invariant

`one client endpoint -> one MCP gateway -> one canonical engine target`

Do not wire this runtime through Strategic Comms or any communication project. Communications may consume receipts/alerts later, but they are not part of the browser transport path.
