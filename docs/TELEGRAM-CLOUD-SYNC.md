# Telegram Cloud Sync — привязка данных к аккаунту Telegram

Синхронизация localStorage (ключи `he_*`: профиль, дневники, планы, макроциклы, настройки,
включая фото в дневниках) через Supabase, привязанная к аккаунту Telegram.

**Результат:** открыл приложение через бота в Telegram на телефоне — данные с компьютера.
Открыл на компьютере — данные с телефона. Никаких логинов и паролей: Telegram сам
идентифицирует пользователя (Mini App).

## Как это работает

1. Приложение — Telegram Mini App: `Telegram.WebApp.initDataUnsafe.user.id` уже даёт
   стабильный id аккаунта (`tg_<id>`) — одинаковый на телефоне и ПК.
2. Sync-токен = `tk_<sha256(VITE_CRYPTO_KEY + ':' + tgId)>` — отправляется в заголовке
   `x-user-token` при каждом запросе к Supabase; RLS на сервере отдаёт пользователю
   только его строки (таблица `user_kv`).
3. **Загрузка (pull):** при входе в приложение скачиваются все ключи пользователя из
   облака; конфликт решается last-write-wins по времени изменения каждого ключа.
4. **Выгрузка (push):** перехватываются `setItem`/`removeItem` localStorage — изменённые
   ключи уезжают в облако через ~2.5 с; при уходе со страницы — keepalive-запрос;
   при возврате в сеть — повторная синхронизация.
5. Крупные значения (фото) режутся на чанки по 100k символов (без разрыва эмодзи);
   неполная запись в облаке пропускается и «залечивается» устройством с более свежими
   данными.

## Настройка (один раз)

### 1. Supabase-проект

Нужен живой проект (бесплатный тариф подходит). В `D:\BodyBuildHealth\.env` должны быть:
```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publish_...
```

### 2. Применить SQL

В дашборде Supabase → **SQL Editor** → New query → вставить содержимое
`supabase/migrations/20260818_user_kv.sql` → Run.

```sql
create table if not exists user_kv (
  id text not null,
  key text not null,
  chunk_index integer not null default 0,
  chunk_count integer not null default 1,
  value text not null,
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
```

### 3. Пересобрать и задеплоить приложение

`npm run build` + деплой (Vercel и т.п.). После деплоя открой бота в Telegram —
при первом входе данные подтянутся автоматически.

## Проверка

- Открой приложение в Telegram Desktop и на телефоне (один и тот же аккаунт).
- В Supabase → Table Editor → `user_kv` должны появляться строки при изменении данных.
- После входа с первого устройства, открой на втором: данные совпадают.

## Что синхронизируется

Все ключи `he_*` в localStorage, кроме:
- `he_session_v2` (сессия устройства), `he_crypto_key`, `he_last_active`
- `he_sync_meta_v1` / `he_sync_ts_*` (служебные)
- `he_draft_*` (черновики форм), `he_nav_*` (навигация), `he_admin_*`

## Ограничения и безопасность

- **Клиентский ключ**: `VITE_CRYPTO_KEY` попадает в бандл приложения, поэтому токен
  защищает от случайного доступа, но не от извлечения ключа из кода. Для
  много-пользовательской безопасности следующий шаг — edge function, верифицирующая
  Telegram initData серверным `TELEGRAM_BOT_TOKEN` (серверный секрет не уходит в бандл).
- **Вне Telegram**: в обычном браузере (PWA вне Telegram) синк выключен — данные
  остаются локальными. Для входа через браузер потребуется Telegram Login Widget
  (настройка домена бота через BotFather).
- **Конфликты**: last-write-wins по ключу с окном 500 мс; одновременное редактирование
  одного и того же ключа на двух устройствах — побеждает последняя запись.

## Файлы

- `src/core/cloud-kv.ts` — движок синхронизации (pull/push/чанки/конфликты)
- `src/ui/auth-module.ts` — авто-инициализация синка после входа через Telegram
- `supabase/migrations/20260818_user_kv.sql` — миграция БД
- `src/core/__tests__/cloud-kv.test.ts` — тесты движка (24)
