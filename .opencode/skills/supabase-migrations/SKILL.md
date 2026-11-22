---
name: Supabase Migrations
description: Safely inspect and change the Supabase schema (migrations, edge functions, RLS) in this repo
---

# Supabase in this repo

## Layout

- `supabase/migrations/YYYYMMDD_snake_name.sql` — additive, one concern per file, dated by authoring day.
- `supabase/functions/` — edge functions (Deno).
- `supabase/config.toml`, `supabase/schema.sql`, `supabase/bootstrap.sql` — reference snapshots.
- The app talks to Supabase only through `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (`.env`, never edited).

## Access rules

- The `supabase` MCP server is configured **read-only** (`read_only=true`,
  `features=database,debugging,docs`). Use it for: `list_tables`, `list_migrations`, `execute_sql` (SELECT),
  `get_advisors`, `query_logs`, `generate_typescript_types`, `search_docs`.
- Any schema change (`apply_migration`, `ALTER`, `DROP`, policy changes) requires: (1) a migration file in the
  repo, (2) explicit user approval, (3) the change applied to a non-production project first. Never run
  destructive SQL against production.
- Prefer writing the migration file and letting the user apply it, unless they explicitly ask you to apply it.

## Checklist for a new table or column

1. Migration file with the `CREATE TABLE` / `ALTER TABLE`, indexes, and `ENABLE ROW LEVEL SECURITY`.
2. RLS policies for `select` / `insert` / `update` / `delete` scoped to `auth.uid()`.
3. Re-check `get_advisors` for security/performance findings.
4. Regenerate TypeScript types (`generate_typescript_types`) if the app consumes the new shape.
5. Run `npm run type-check` and the relevant vitest suite.
