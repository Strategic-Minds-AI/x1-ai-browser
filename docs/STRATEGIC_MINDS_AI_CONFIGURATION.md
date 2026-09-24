# Strategic Minds AI Configuration

## Canonical identity

- Product: **X1 AI Browser**
- Organization: **Strategic Minds AI**
- Canonical repository: `Strategic-Minds-AI/x1-ai-browser`
- Public identity: `https://strategicmindsai.com`
- Source lineage: `XTREME-SYSTEMS/cloudbrowser-control` at commit `6b91a4753fd9be379cd92f864b5622b868d24ca0`

## Authority and environment

`main` preserves the exact source clone. Strategic Minds AI configuration is developed on `configure/strategic-minds-ai` and may merge only after independent validation. Staging credentials are injected at runtime and never committed. Production deployment, DNS, secrets, billing, and external communications remain owner-gated.

Copy `.env.example` to `.env.local` for local development. Populate only staging-safe values.

## Validation commands

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```
