# X1 AI Browser

Strategic Minds AI's governed browser automation and execution system for autonomous agents, deterministic web operations, data extraction, sandboxed testing, and CloudBrowser services.

## Canonical authority

- Organization: **Strategic Minds AI**
- Repository: `Strategic-Minds-AI/x1-ai-browser`
- Public identity: [strategicmindsai.com](https://strategicmindsai.com)
- Source lineage: `XTREME-SYSTEMS/cloudbrowser-control`
- Production status: **LOCKED**

The `main` branch preserves the validated source clone. Strategic Minds AI configuration is introduced through reviewed feature branches and receipted pull requests.

## Local development

```bash
cp .env.example .env.local
npm ci
npm run dev
```

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Environment contract

See `.env.example` and [`docs/STRATEGIC_MINDS_AI_CONFIGURATION.md`](docs/STRATEGIC_MINDS_AI_CONFIGURATION.md). Never commit tokens, service-role credentials, browser session cookies, production URLs containing credentials, or private keys.

## System components

- React/Vite operator interface
- Browser engine and session manager
- Operator service
- Base44-compatible app definitions and backend functions
- MCP/browser execution surfaces
- Fortress security and tenancy controls
- Railway and Vercel staging contracts

## Governance

All mutations require a WorkPacket. Implementers do not validate their own work. Production releases, migrations, secrets, payments, DNS, privilege grants, and live communications require owner approval.
