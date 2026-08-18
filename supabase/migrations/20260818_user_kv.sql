-- cloud-kv: key-value хранилище для синхронизации localStorage (ключи he_*)
-- между устройствами через Telegram Mini App (одни и те же данные на телефоне и ПК).
--
-- Привязка к Telegram-аккаунту: id строки = sync-токен, производный от id Telegram
-- (tk_<sha256(VITE_CRYPTO_KEY + ':' + tgId)>). Токен клиент передаёт в заголовке
-- x-user-token; RLS разрешает доступ только к своим строкам.
--
-- Значения крупных ключей (фото в дневниках и т.п.) режутся на чанки по ~100k
-- символов; chunk_count реальный пишется ТОЛЬКО в чанке 0 (остальные = 0),
-- поэтому неполная запись не «портит» ключ — pull пропустит ключ без чанка 0,
-- а устройство, у которого данные новее, перезапишет его.

create table if not exists user_kv (
  id text not null,                -- sync-токен пользователя
  key text not null,               -- localStorage-ключ (he_*)
  chunk_index integer not null default 0,
  chunk_count integer not null default 1,
  value text not null,             -- содержимое чанка
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
