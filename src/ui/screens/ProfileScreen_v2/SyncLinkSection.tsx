/**
 * SyncLinkSection.tsx — привязка АПК к Telegram-аккаунту одноразовым кодом.
 * Без логинов/паролей: ТГ генерирует код на 10 мин, АПК вводит код один раз
 * и получает tg-токен для user_kv. Дальше оба устройства синкаются как одно.
 *
 * Видимость: секция общая (Профиль → Настройки), внутри — ветвление по платформе:
 * - telegram → генерация кода;
 * - native → ввод кода / статус / отвязка;
 * - web → подсказка.
 */
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { isNativeApp, isTelegramApp, getSyncIdentity } from '../../../core/app-platform';
import {
  initKvSync,
  onKvSyncStatus,
  getKvSyncState,
  getLinkedTgToken,
  saveLinkedTgToken,
  clearLinkedTgToken,
  deriveSyncToken,
} from '../../../core/cloud-kv';
import {
  generateLinkCode,
  normalizeLinkCode,
  isValidLinkCodeFormat,
  LINK_CODE_TTL_MS,
} from '../../../core/link-code';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

function tgUserId(): string | null {
  try {
    const u = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
    if (u && u.id !== undefined && u.id !== null) return String(u.id);
  } catch { /* no-op */ }
  return null;
}

function linkClient(tgToken?: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: tgToken ? { headers: { 'x-user-token': tgToken } } : undefined,
  });
}

export const SyncLinkSection: React.FC = () => {
  const [mode, setMode] = useState<'telegram' | 'native' | 'web'>(() =>
    isTelegramApp() ? 'telegram' : isNativeApp() ? 'native' : 'web',
  );
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [syncStatus, setSyncStatus] = useState(() => getKvSyncState().status);
  const [linked, setLinked] = useState(() => !!getLinkedTgToken());

  useEffect(() => {
    const off = onKvSyncStatus(s => setSyncStatus(s.status));
    return off;
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  useEffect(() => {
    setMode(isTelegramApp() ? 'telegram' : isNativeApp() ? 'native' : 'web');
  }, []);

  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return (
      <div style={box} aria-label="Синхронизация ТГ и АПК">
        <div style={title}>🔗 Синхронизация ТГ ↔ АПК</div>
        <div style={sub}>Облако не настроено (нет Supabase-ключей) — привязка недоступна.</div>
      </div>
    );
  }

  const createCode = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const tgId = tgUserId();
      if (!tgId) throw new Error('Откройте приложение через Telegram-бота');
      const tgToken = await deriveSyncToken(tgId);
      const c = generateLinkCode();
      const client = linkClient(tgToken);
      const expIso = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString();
      const { error } = await client.from('link_codes').insert({
        code: c,
        tg_token: tgToken,
        expires_at: expIso,
      });
      if (error) throw new Error(error.message);
      setCode(c);
      setExpiresAt(Date.now() + LINK_CODE_TTL_MS);
      setMsg('Код создан — введите его в АПК в течение 10 минут.');
    } catch (e) {
      setMsg('Не получилось: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revokeCode = async () => {
    if (!code) return;
    try {
      const client = linkClient();
      await client.from('link_codes').delete().eq('code', code);
    } catch { /* best-effort */ }
    setCode('');
    setExpiresAt(0);
    setMsg('Код отозван.');
  };

  const consumeCode = async () => {
    const c = normalizeLinkCode(input);
    if (!isValidLinkCodeFormat(c)) {
      setMsg('Код — 6 цифр (например 482-913).');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const client = linkClient();
      const { data, error } = await client.from('link_codes').select('code,tg_token,expires_at,used').eq('code', c).limit(1);
      if (error) throw new Error(error.message);
      const row = (data || [])[0] as any;
      if (!row) throw new Error('Код не найден — проверьте цифры или создайте новый в ТГ.');
      if (row.used) throw new Error('Код уже использован — создайте новый в ТГ.');
      if (Date.parse(row.expires_at) <= Date.now()) throw new Error('Код истёк — создайте новый в ТГ.');
      if (!row.tg_token || !String(row.tg_token).startsWith('tk_')) throw new Error('Битый код — создайте новый в ТГ.');
      saveLinkedTgToken(String(row.tg_token));
      // One-time: удаляем сразу после получения токена.
      try { await client.from('link_codes').delete().eq('code', c); } catch { /* no-op */ }
      const ident = getSyncIdentity();
      await initKvSync(ident.id, { token: String(row.tg_token) });
      setLinked(true);
      setInput('');
      setMsg('✅ Привязано — данные ТГ подтягиваются в АПК.');
    } catch (e) {
      setMsg('Не получилось: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const unlink = () => {
    clearLinkedTgToken();
    setLinked(false);
    setMsg('Отвязано — дальше АПК работает локально.');
  };

  const remainSec = expiresAt ? Math.max(0, Math.round((expiresAt - now) / 1000)) : 0;

  return (
    <div style={box} aria-label="Синхронизация ТГ и АПК">
      <div style={title}>🔗 Синхронизация ТГ ↔ АПК</div>
      <div style={sub}>
        {mode === 'telegram' && 'Создайте код — введите его в АПК один раз. Логин и пароль не нужны.'}
        {mode === 'native' && (linked ? `Привязано · облако: ${syncStatus}` : 'Введите код из Telegram — данные станут общими.')}
        {mode === 'web' && 'Привязка работает между Telegram Mini App и АПК (в браузере — только просмотр).'}
      </div>

      {mode === 'telegram' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!code ? (
            <button onClick={createCode} disabled={busy} style={btn}>
              {busy ? '…' : '🔗 Создать код для АПК'}
            </button>
          ) : (
            <>
              <div style={codeBox} role="status" aria-label={`Код привязки ${code}`}>
                {code}
              </div>
              <div style={hint}>⏳ Осталось {Math.floor(remainSec / 60)}:{String(remainSec % 60).padStart(2, '0')} · одноразовый</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createCode} disabled={busy} style={btnGhost}>🔄 Новый код</button>
                <button onClick={revokeCode} style={btnGhost}>✕ Отозвать</button>
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'native' && !linked && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(normalizeLinkCode(e.target.value))}
            placeholder="482-913"
            inputMode="numeric"
            maxLength={7}
            aria-label="Код привязки из Telegram"
            style={codeInput}
          />
          <button onClick={consumeCode} disabled={busy || !isValidLinkCodeFormat(normalizeLinkCode(input))} style={btn}>
            {busy ? '…' : '🔗 Привязать к Telegram'}
          </button>
          <div style={hint}>После привязки: общий профиль, дневники и планы. Переустановка лечится повторным кодом.</div>
        </div>
      )}

      {mode === 'native' && linked && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={hint}>✅ АПК привязан к ТГ-аккаунту · облако: {syncStatus}</div>
          <button onClick={unlink} style={btnGhost}>✕ Отвязать</button>
        </div>
      )}

      {msg && (
        <div style={msgBox} role="status">
          {msg}
        </div>
      )}
    </div>
  );
};

const box: React.CSSProperties = {
  border: '1px solid rgba(52,211,153,0.35)',
  borderRadius: 16,
  padding: '12px 14px',
  background: 'linear-gradient(135deg, rgba(52,211,153,0.12), rgba(52,211,153,0.03))',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const title: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: '#fff' };
const sub: React.CSSProperties = { fontSize: 12, color: '#fff', opacity: 0.85, lineHeight: 1.5 };
const hint: React.CSSProperties = { fontSize: 11.5, color: '#fff', opacity: 0.75, lineHeight: 1.5 };

const btn: React.CSSProperties = {
  minHeight: 48,
  borderRadius: 14,
  border: '1px solid rgba(52,211,153,0.5)',
  background: 'linear-gradient(135deg, rgba(52,211,153,0.3), rgba(52,211,153,0.1))',
  color: '#fff',
  fontSize: 13.5,
  fontWeight: 800,
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(255,255,255,0.05)',
  color: '#fff',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '0 14px',
};

const codeBox: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  letterSpacing: 4,
  textAlign: 'center',
  color: '#fff',
  fontVariantNumeric: 'tabular-nums',
  padding: '10px 0',
  border: '1px dashed rgba(52,211,153,0.5)',
  borderRadius: 14,
  background: 'rgba(0,0,0,0.25)',
};

const codeInput: React.CSSProperties = {
  minHeight: 52,
  borderRadius: 14,
  border: '1px solid rgba(52,211,153,0.5)',
  background: 'rgba(0,0,0,0.3)',
  color: '#fff',
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: 3,
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
};

const msgBox: React.CSSProperties = {
  fontSize: 12,
  color: '#fff',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '8px 10px',
  lineHeight: 1.5,
};
