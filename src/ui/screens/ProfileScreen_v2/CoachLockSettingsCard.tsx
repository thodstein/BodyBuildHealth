/**
 * CoachLockSettingsCard — PIN и автовыход в режиме тренера.
 *
 * Настройки устройства, а не атлета: ключ `he_coach_lock` не переключается
 * вместе с пространством. Здесь же — короткий журнал действий (только виды
 * событий, без имён и текстов).
 *
 * Честные границы прямо на экране:
 *  • PIN защищает вход в профиль от «случайного взгляда», а не шифрует базу;
 *  • на старых WebView без WebCrypto используется слабый хэш — это написано;
 *  • забытый PIN нельзя «подобрать обратно»: данные на месте, но вход закрыт.
 */
import React, { useState } from 'react';
import { colors, withAlpha } from './ui';
import {
  COACH_PIN_MAX,
  COACH_PIN_MIN,
  clampAutoLock,
  createCoachLock,
  disableCoachLock,
  pinPolicyError,
  pinPolicyErrorText,
  verifyCoachPin,
  type CoachLockSettings,
} from '../../../engines/coach/coach-lock.engine';
import {
  COACH_AUDIT_MAX,
  auditLabel,
  recentAudit,
  type CoachAuditStore,
} from '../../../engines/coach/coach-audit.engine';

const ACCENT = '#22d3ee';

interface Props {
  settings: CoachLockSettings;
  audit: CoachAuditStore;
  onChange: (next: CoachLockSettings) => void;
  onEvent: (kind: 'pin-enabled' | 'pin-disabled') => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 14,
  color: '#fff',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  outline: 'none',
  boxSizing: 'border-box',
  letterSpacing: 2,
};

const btn = (tone: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
  minHeight: 40,
  padding: '8px 12px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  border:
    tone === 'primary'
      ? '1px solid transparent'
      : `1px solid ${tone === 'danger' ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.14)'}`,
  color: tone === 'primary' ? '#04222a' : tone === 'danger' ? '#fca5a5' : 'rgba(255,255,255,0.82)',
  background:
    tone === 'primary'
      ? `linear-gradient(135deg, ${ACCENT}, #0ea5e9)`
      : tone === 'danger'
        ? 'rgba(239,68,68,0.14)'
        : 'rgba(255,255,255,0.05)',
});

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  padding: 14,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: colors.textMuted,
  marginBottom: 4,
};

const AUTO_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'через 1 минуту' },
  { value: 5, label: 'через 5 минут' },
  { value: 15, label: 'через 15 минут' },
  { value: 30, label: 'через 30 минут' },
  { value: 60, label: 'через час' },
  { value: 0, label: 'не выходить автоматически' },
];

/** Возврат из данных атлета — отдельная настройка, работает и без PIN. */
const SPACE_EXIT_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'не возвращать' },
  { value: 5, label: 'через 5 минут без действий' },
  { value: 15, label: 'через 15 минут без действий' },
  { value: 30, label: 'через 30 минут без действий' },
  { value: 60, label: 'через час без действий' },
];

export function CoachLockSettingsCard({ settings, audit, onChange, onEvent }: Props) {
  const [mode, setMode] = useState<'idle' | 'enable' | 'disable'>('idle');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [auditNotice, setAuditNotice] = useState<string | null>(null);

  /** Выгрузка журнала: человек должен мочь показать его, а не только листать. */
  const exportAudit = async () => {
    setAuditNotice(null);
    try {
      const mod = await import('../../../core/apk-share');
      const lines = recentAudit(audit, COACH_AUDIT_MAX).map(e => {
        const at = e.at ? e.at.replace('T', ' ').slice(0, 19) : '—';
        return `${at}\t${auditLabel(e.kind)}${e.athleteId ? `\t${e.athleteId}` : ''}`;
      });
      const text = [
        'Журнал действий тренера',
        'Только вид события, время и id атлета. Без имён, программ и текстов заметок.',
        '',
        ...lines,
      ].join('\n');
      const res = await mod.saveTextFileApk(
        `coach-audit-${new Date().toISOString().slice(0, 10)}.txt`,
        text,
        'text/plain;charset=utf-8',
      );
      setAuditNotice(mod.shareOutcomeLabel(res));
    } catch {
      setAuditNotice('Не удалось сохранить журнал.');
    }
  };

  const reset = () => {
    setPin('');
    setConfirmPin('');
    setError(null);
    setMode('idle');
  };

  const enable = async () => {
    setError(null);
    const policy = pinPolicyError(pin);
    if (policy) {
      setError(pinPolicyErrorText(policy));
      return;
    }
    if (pin !== confirmPin) {
      setError('PIN и подтверждение не совпадают.');
      return;
    }
    setBusy(true);
    try {
      const res = await createCoachLock(pin, {
        autoLockMin: settings.autoLockMin,
        autoExitSpaceMin: settings.autoExitSpaceMin,
      });
      if (res.error || !res.settings) {
        setError(pinPolicyErrorText(res.error));
        return;
      }
      onChange(res.settings);
      onEvent('pin-enabled');
      reset();
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setError(null);
    setBusy(true);
    try {
      const ok = await verifyCoachPin(settings, pin);
      if (!ok) {
        setError('PIN не подошёл — выключение отменено.');
        return;
      }
      onChange(disableCoachLock(settings, { now: new Date().toISOString() }));
      onEvent('pin-disabled');
      reset();
    } finally {
      setBusy(false);
    }
  };

  const changeAutoLock = (value: number) => {
    const next = { ...settings, autoLockMin: clampAutoLock(value), updatedAt: new Date().toISOString() };
    onChange(next);
  };

  const changeSpaceExit = (value: number) => {
    const next = { ...settings, autoExitSpaceMin: clampAutoLock(value), updatedAt: new Date().toISOString() };
    onChange(next);
  };

  return (
    <div data-coach="lock-card" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>Доступ к профилю тренера</div>
          <div style={{ fontSize: 11, color: colors.textSubtle, lineHeight: 1.45 }}>
            {settings.enabled
              ? `PIN включён · ${AUTO_OPTIONS.find(o => o.value === settings.autoLockMin)?.label ?? 'автовыход настроен'}`
              : 'PIN по желанию — по умолчанию профиль открыт без кода.'}
          </div>
        </div>
        {settings.enabled ? (
          <button
            type="button"
            data-coach="lock-disable-open"
            onClick={() => {
              setMode(mode === 'disable' ? 'idle' : 'disable');
              setPin('');
              setError(null);
            }}
            style={{ ...btn('ghost'), fontSize: 11.5 }}
          >
            Выключить PIN
          </button>
        ) : (
          <button
            type="button"
            data-coach="lock-enable-open"
            onClick={() => {
              setMode(mode === 'enable' ? 'idle' : 'enable');
              setPin('');
              setConfirmPin('');
              setError(null);
            }}
            style={{ ...btn('primary'), fontSize: 11.5 }}
          >
            Включить PIN
          </button>
        )}
      </div>

      {settings.enabled && (
        <div style={{ marginTop: 10 }}>
          <label style={labelStyle} htmlFor="coach-auto-lock">
            Выходить без действий
          </label>
          <select
            id="coach-auto-lock"
            data-coach="lock-auto"
            value={settings.autoLockMin}
            onChange={e => changeAutoLock(Number(e.target.value))}
            style={{ ...inputStyle, letterSpacing: 0, fontSize: 12.5, appearance: 'none' }}
          >
            {AUTO_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <label style={labelStyle} htmlFor="coach-space-exit">
          Возвращать к своим данным из данных атлета
        </label>
        <select
          id="coach-space-exit"
          data-coach="space-exit"
          value={settings.autoExitSpaceMin}
          onChange={e => changeSpaceExit(Number(e.target.value))}
          style={{ ...inputStyle, letterSpacing: 0, fontSize: 12.5, appearance: 'none' }}
        >
          {SPACE_EXIT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div style={{ marginTop: 4, fontSize: 10.5, color: colors.textSubtle, lineHeight: 1.45 }}>
          Работает и без PIN: телефон вернули владельцу — чужие дневники не остаются на экране.
        </div>
      </div>

      {mode === 'enable' && (
        <div data-coach="lock-enable" style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <div>
            <label style={labelStyle} htmlFor="coach-pin">
              PIN ({COACH_PIN_MIN}–{COACH_PIN_MAX} цифр)
            </label>
            <input
              id="coach-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={COACH_PIN_MAX}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              data-coach="lock-pin"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="coach-pin-confirm">
              Повторите PIN
            </label>
            <input
              id="coach-pin-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={COACH_PIN_MAX}
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              data-coach="lock-pin-confirm"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              data-coach="lock-enable-save"
              onClick={() => void enable()}
              disabled={busy}
              style={{ ...btn('primary'), opacity: busy ? 0.6 : 1 }}
            >
              {busy ? 'Сохраняем…' : 'Включить'}
            </button>
            <button type="button" data-coach="lock-cancel" onClick={reset} style={btn('ghost')}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {mode === 'disable' && (
        <div data-coach="lock-disable" style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <div>
            <label style={labelStyle} htmlFor="coach-pin-off">
              Текущий PIN
            </label>
            <input
              id="coach-pin-off"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={COACH_PIN_MAX}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              data-coach="lock-disable-pin"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              data-coach="lock-disable-save"
              onClick={() => void disable()}
              disabled={busy}
              style={{ ...btn('danger'), opacity: busy ? 0.6 : 1 }}
            >
              {busy ? 'Проверяем…' : 'Выключить PIN'}
            </button>
            <button type="button" data-coach="lock-cancel" onClick={reset} style={btn('ghost')}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {error && (
        <div data-coach="lock-error" role="alert" style={{ marginTop: 8, fontSize: 11.5, color: colors.danger, lineHeight: 1.45 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 10.5, color: colors.textSubtle, lineHeight: 1.45 }}>
        PIN защищает вход в профиль на этом устройстве, но не шифрует базу. Забытый PIN не
        восстанавливается: данные остаются на месте, вход закрыт.
        {settings.enabled && settings.algo === 'fnv1a'
          ? ' На этом устройстве нет WebCrypto — используется слабый хэш.'
          : ''}
      </div>

      <details data-coach="audit" style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 11, color: colors.textMuted, cursor: 'pointer' }}>
          Журнал действий (последние {recentAudit(audit, 10).length})
        </summary>
        {audit.items.length === 0 ? (
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>Пока пусто.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
            {recentAudit(audit, 10).map(e => (
              <div key={e.id} style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.72)' }}>
                <span style={{ color: colors.textSubtle, fontVariantNumeric: 'tabular-nums' }}>
                  {e.at ? `${e.at.slice(8, 10)}.${e.at.slice(5, 7)} ${e.at.slice(11, 16)}` : '—'}
                </span>{' '}
                {auditLabel(e.kind)}
                {e.athleteId ? ` · ${e.athleteId}` : ''}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 4, fontSize: 10, color: colors.textSubtle }}>
          Без имён и содержимого: только вид события, время и id.
        </div>
        <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            data-coach="audit-export"
            onClick={() => void exportAudit()}
            style={{ ...btn('ghost'), minHeight: 34, fontSize: 11 }}
          >
            Выгрузить журнал
          </button>
          {auditNotice && (
            <span data-coach="audit-notice" style={{ fontSize: 10.5, color: colors.textMuted }}>
              {auditNotice}
            </span>
          )}
        </div>
      </details>

      <div aria-hidden="true" style={{ height: 1, background: withAlpha(ACCENT, '22'), marginTop: 10 }} />
    </div>
  );
}
