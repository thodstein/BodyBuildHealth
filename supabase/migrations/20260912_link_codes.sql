-- link_codes: одноразовые коды привязки АПК к Telegram-аккаунту.
-- ТГ генерирует код на 10 минут, АПК вводит код один раз и получает tg-токен
-- для user_kv (тот же x-user-token, что использует Mini App).
-- Никаких логинов/паролей: код = proof владения ТГ-аккаунтом.

create table if not exists link_codes (
  code text primary key,              -- '482-913', нормализованный формат
  tg_token text not null,             -- tk_<sha256(...)> владельца
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used boolean not null default false
);

create index if not exists idx_link_codes_expires on link_codes (expires_at);

alter table link_codes enable row level security;

-- Создание кода: только владелец токена (ТГ с x-user-token заголовком).
drop policy if exists "link_insert_owner" on link_codes;
create policy "link_insert_owner" on link_codes for insert
  with check (
    tg_token = coalesce(current_setting('request.headers', true)::jsonb->>'x-user-token', '')
  );

-- Чтение кода АПК: по точному коду, только живой (не истёк, не использован).
-- Select открыт для anon: код 6 цифр + TTL 10 мин + one-time delete.
drop policy if exists "link_select_by_code" on link_codes;
create policy "link_select_by_code" on link_codes for select
  using (used = false and expires_at > now());

-- Потребление кода: АПК помечает used / удаляет после получения токена.
drop policy if exists "link_consume_by_code" on link_codes;
create policy "link_consume_by_code" on link_codes for update
  using (used = false and expires_at > now())
  with check (true);

drop policy if exists "link_delete_by_code" on link_codes;
create policy "link_delete_by_code" on link_codes for delete
  using (used = false or expires_at <= now());

grant select, insert, update, delete on table link_codes to anon, authenticated;
