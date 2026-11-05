/**
 * CoachPinDialog — PIN спрашивается там, где действие открывает ЧУЖИЕ данные.
 *
 * ПОЧЕМУ НЕ ТОЛЬКО НА ВКЛАДКЕ ТРЕНЕРА. PIN, который проверяется лишь при
 * открытии профиля, обходится одним движением: тренер (или тот, кому передали
 * телефон) жмёт «Войти в его данные» в полосе пространства — и приложение
 * перезагружается уже в дневниках и анализах атлета. Поэтому проверка стоит на
 * самом переключении в пространство атлета; возврат к своим данным PIN не
 * требует — это не чужие данные.
 *
 * ЧЕСТНАЯ ГРАНИЦА: диалог проверяет PIN и закрывается. Он не прячет данные,
 * которые уже открыты, и не заменяет шифрование базы.
 */
import React, { useState } from 'react';
import { colors } from './screens/ProfileScreen_v2/ui';
import { HOME_SPACE_ID } from '../core/data-space';
import {
  readCoachLock,
  verifyCoachPin,
  type CoachLockSettings,
} from '../engines/coach/coach-lock.engine';
import { authenticateWithBiometrics, isBiometricAvailable } from '../core/native-bridge';

const ACCENT = '#22d3ee';

/** Нужен ли PIN для входа в это пространство (сейчас, а не «когда включали»). */
export function coachPinRequiredForSpace(targetSpaceId: string): boolean {
  if (targetSpaceId === HOME_SPACE_ID) return false;
  try {
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    const lock = readCoachLock(storage);
    return lock.enabled;
  } catch {
    return false;
  }
}

interface Props {
  purpose: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Настройки можно передать из вызывающего кода; иначе читаем с устройства. */
  settings?: CoachLockSettings;
}

export function CoachPinDialog({ purpose, onConfirm, onCancel, settings }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  const actual = settings ?? readCoachLock(typeof localStorage !== 'undefined' ? localStorage : null);

  React.useEffect(() => {
    if (!actual.biometry) return;
    let alive = true;
    void isBiometricAvailable().then(ok => {
      if (alive) setBioAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, [actual.biometry]);

  const unlockWithBiometrics = async () => {
    setError(null);
    setBusy(true);
    try {
      const ok = await authenticateWithBiometrics('Вход в данные атлета');
      if (!ok) {
        setError('Биометрия не подтвердила вход. Введите PIN.');
        return;
      }
      onConfirm();
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const ok = await verifyCoachPin(actual, pin);
      if (!ok) {
        setError('PIN не подошёл. Данные не открыты.');
        return;
      }
      setPin('');
      onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-coach="pin-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Подтвердите PIN"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(2,6,23,0.72)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 16,
          borderRadius: 16,
          background: 'linear-gradient(160deg, #0f172a, #0b1220)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>Подтвердите PIN</div>
        <div style={{ fontSize: 11.5, color: colors.textMuted, lineHeight: 1.45 }}>{purpose}</div>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          maxLength={8}
          value={pin}
          aria-label="PIN"
          data-coach="pin-dialog-input"
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => {
            if (e.key === 'Enter') void submit();
            if (e.key === 'Escape') onCancel();
          }}
          style={{
            width: '100%',
            minHeight: 48,
            borderRadius: 12,
            padding: '10px 12px',
            fontSize: 18,
            letterSpacing: 4,
            textAlign: 'center',
            color: '#fff',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {error && (
          <div data-coach="pin-dialog-error" role="alert" style={{ fontSize: 11.5, color: colors.danger }}>
            {error}
          </div>
        )}
        {actual.biometry && bioAvailable && (
          <button
            type="button"
            data-coach="pin-dialog-bio"
            onClick={() => void unlockWithBiometrics()}
            disabled={busy}
            style={{
              minHeight: 44,
              borderRadius: 12,
              fontSize: 12.5,
              fontWeight: 800,
              cursor: busy ? 'default' : 'pointer',
              color: ACCENT,
              background: 'rgba(34,211,238,0.10)',
              border: '1px solid rgba(34,211,238,0.38)',
            }}
          >
            Отпечаток или Face
          </button>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            data-coach="pin-dialog-cancel"
            onClick={onCancel}
            style={{
              minHeight: 44,
              padding: '8px 14px',
              borderRadius: 12,
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.82)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.14)',
            }}
          >
            Отмена
          </button>
          <button
            type="button"
            data-coach="pin-dialog-ok"
            onClick={() => void submit()}
            disabled={busy || pin.length < 4}
            style={{
              minHeight: 44,
              padding: '8px 16px',
              borderRadius: 12,
              fontSize: 12.5,
              fontWeight: 800,
              cursor: busy || pin.length < 4 ? 'default' : 'pointer',
              opacity: busy || pin.length < 4 ? 0.6 : 1,
              color: '#04222a',
              background: `linear-gradient(135deg, ${ACCENT}, #0ea5e9)`,
              border: 'none',
            }}
          >
            {busy ? 'Проверяем…' : 'Открыть'}
          </button>
        </div>
      </div>
    </div>
  );
}
