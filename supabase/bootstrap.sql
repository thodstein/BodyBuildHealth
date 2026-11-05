-- bootstrap.sql — минимальная схема облачной синхронизации с нуля.
--
-- Зачем: в новом/восстановленном проекте Supabase таблиц ещё нет, и приложение
-- получает `PGRST205 Could not find the table 'public.user_kv'`. Выполните этот
-- файл целиком в Supabase → SQL Editor → Run. Он идемпотентен (if not exists /
-- drop policy if exists), повторный запуск безопасен.
--
-- Доступа к данным вне вашего токена нет: RLS сверяет строку `id` с заголовком
-- `x-user-token`, который клиент выводит из Telegram-аккаунта или id устройства.
-- Подробности: supabase/migrations/20260818_user_kv.sql и 20260912_link_codes.sql.

-- ─── user_kv: key-value хранилище localStorage (ключи he_*) ───────────────────
create table if not exists user_kv (
  id text not null,                -- sync-токен пользователя (tk_<sha256>)
  key text not null,               -- localStorage-ключ (he_*)
  chunk_index integer not null default 0,
  chunk_count integer not null default 1,
  value text not null,             -- содержимое чанка (~100k символов)
  updated_at timestamptz not null default now(),
  primary key (id, key, chunk_index)
);

create index if not exists idx_user_kv_id_key on user_kv (id, key);

alter table user_kv enable row level security;

drop policy if exists "kv_self_all" on user_kv;
create policy "kv_self_all" on user_kv for all
  using (id = coalesce(current_setting('request.headers', true)::jsonb->>'x-user-token', ''))
  with check (id = coalesce(current_setting('request.headers', true)::jsonb->>'x-user-token', ''));

grant select, insert, update, delete on table user_kv to anon, authenticated;

-- ─── link_codes: одноразовые коды привязки АПК к Telegram ────────────────────
create table if not exists link_codes (
  code text primary key,              -- '482-913', нормализованный формат
  tg_token text not null,             -- tk_<sha256(...)> владельца
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used boolean not null default false
);

create index if not exists idx_link_codes_expires on link_codes (expires_at);

alter table link_codes enable row level security;

drop policy if exists "link_insert_owner" on link_codes;
create policy "link_insert_owner" on link_codes for insert
  with check (
    tg_token = coalesce(current_setting('request.headers', true)::jsonb->>'x-user-token', '')
  );

drop policy if exists "link_select_by_code" on link_codes;
create policy "link_select_by_code" on link_codes for select
  using (used = false and expires_at > now());

drop policy if exists "link_consume_by_code" on link_codes;
create policy "link_consume_by_code" on link_codes for update
  using (used = false and expires_at > now())
  with check (true);

drop policy if exists "link_delete_by_code" on link_codes;
create policy "link_delete_by_code" on link_codes for delete
  using (used = false or expires_at <= now());

grant select, insert, update, delete on table link_codes to anon, authenticated;
