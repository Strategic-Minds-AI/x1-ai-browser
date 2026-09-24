# X1 Independent Code Review Contract

GitHub Copilot code review is an independent validation lane for this repository.

## Review source truth
- Re-fetch the current PR head SHA, base SHA, changed files, and current workflow/check results.
- Bind every conclusion to the current head SHA.
- Treat author-written claims and local test notes as supporting context, not independent proof.
- Missing, skipped, stale, waived, inaccessible, or wrong-SHA mandatory evidence is not a pass.

## Mandatory fail-closed checks
Do not approve when:
- a required workflow or check is failing, missing, skipped, stale, or not bound to the current head
- a high-severity security issue remains unresolved
- credentials or secrets are exposed
- authentication, authorization, tenant isolation, RLS, approvals, auditability, rollback, or release controls are weakened without explicit scoped authorization
- the change bypasses validation or converts a fail-closed control into fail-open behavior
- state-changing work lacks a rollback path or durable receipt
- current source truth conflicts materially with the implementation
- the reviewer cannot establish independent evidence

## Self-governance protection
Changes to these paths require separate human/operator review and must not receive autonomous approval solely from Copilot:
- `.github/agents/**`
- `.github/copilot-instructions.md`
- `.github/instructions/**`
- `.github/workflows/**`
- `AGENTS.md`
- `PRODUCTION_LOCK.md`
- validation/evaluation authority files

## Assessment vocabulary
Use:
- `PASS`
- `FAIL`
- `BLOCKED`
- `NOT_TESTED`

Recommend approval only when every applicable mandatory gate is `PASS` for the current head SHA.
