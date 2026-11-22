---
description: Full environment and project health check
---

Run these in order and report a compact table (step, result, duration, first error):

1. `git status --short` and `git log --oneline -3`
2. `node --version` and `npm --version`
3. `npm run type-check`
4. `npm test`
5. `npm run verify:apk-design`
6. `npm run verify:apk-ci`

Then check integrations and say exactly what the user must do for anything not ready:

- MCP servers: `browse` (browser), `supabase` (read-only), `context7`, `github`, `pubmed` + `openalex` (keyless research).
- If a remote MCP needs sign-in, tell the user to open `/mcps` and authenticate (never run interactive auth flows).

Do not fix anything in this command unless the user asks; report only.
