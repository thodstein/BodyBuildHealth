---
name: Backend & API
description: Work on Vercel handlers in api/, local services in server/, the Supabase edge function and the auth/env model
---

# Backend in this repo

There are three separate runtime surfaces — do not mix them.

| Path                            | Runtime                                                                       | Deployed               |
| ------------------------------- | ----------------------------------------------------------------------------- | ---------------------- |
| `api/*.ts`                      | Vercel **Node** serverless (`@vercel/node`, `VercelRequest`/`VercelResponse`) | yes, via `vercel.json` |
| `server/*`                      | standalone Node services with their own `package.json`/`tsconfig.json`        | no (local tools)       |
| `supabase/functions/*/index.ts` | Deno edge function (`Deno.serve`)                                             | via Supabase CLI       |

## `api/` conventions

- Route = file name: `api/ocr-image.ts`, `api/ocr-scanned-pdf.ts`, `api/verify-telegram-user.ts`. No router layer.
- Default-export `handler`, guard the method first: `if (req.method !== 'POST') return res.status(405)...`, validate
  the body before doing work.
- `vercel.json` sets `maxDuration: 300`, `memory: 2048` and `includeFiles` for the Tesseract/PDF workers — if a new
  handler needs native assets, add them there too.
- `vercel.json` also does the SPA rewrite `/(.*) → /index.html` and `no-store` headers for `index.html`, `sw.js`,
  `/tesseract`, `/pdfjs`. Do not "fix" those headers.

## Supabase edge function

- `supabase/functions/retail-search/index.ts` scrapes vkusvill / pyaterochka / magnit and clamps macros
  (`clampMacros`, `kcal ≤ 950`). It currently has **no JWT check** and `Access-Control-Allow-Origin: *`.
  Treat it as public: no secrets, no admin writes, no user data in requests or logs.
- Schema changes are covered by the `supabase-migrations` skill — the `supabase` MCP is read-only.

## Auth and identity (not Supabase Auth)

- Local app auth: `src/core/auth-manager.ts` — salted `crypto.subtle` SHA-256, session key `he_session_v2`, 24 h TTL.
- Cloud sync is a **header token**, not a Supabase session: RLS matches `x-user-token` where
  `id = 'tk_' || sha256(VITE_CRYPTO_KEY + ':' + tgId)` (`supabase/migrations/20260818_user_kv.sql`), implemented in
  `src/core/cloud-kv.ts` and `src/core/space-tokens.ts`. See `docs/TELEGRAM-CLOUD-SYNC.md`.
- Never put a service-role key or bot token in client code (`VITE_*` is public).

## Env

| Scope                             | Variables                                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| client (`.env`, denied for edits) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ADMIN_EMAIL`, `VITE_ADMIN_PASSWORD`, `VITE_CRYPTO_KEY`, `VITE_APP_PLATFORM` |
| Vercel function                   | `TELEGRAM_BOT_TOKEN` (`api/verify-telegram-user.ts`)                                                                             |
| local services                    | `PORT`                                                                                                                           |
| CI                                | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (`.github/workflows/ci.yml`)                                                      |

## Checklist for a new endpoint

1. Handler file in `api/`, method guard, JSON validation, explicit status codes, typed response.
2. Read secrets from `process.env` with a clear 500 when missing — never a fallback to a hardcoded value.
3. Timeouts/limits in `vercel.json` if it does OCR/PDF work.
4. Call it from the client through one module (not inline `fetch` in a screen) so retries/errors are testable.
5. `npm run type-check`; add a test only if the logic is pure and can be extracted from the handler.
