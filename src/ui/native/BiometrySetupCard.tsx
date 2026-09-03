/**
 * BiometrySetupCard.tsx — включение биометрии в APK. ТОЛЬКО native.
 * Telegram/web этот компонент не импортируют.
 *
 * Механика (native-bridge): WebAuthn platform authenticator, без новых
 * native-зависимостей. Первое включение = регистрация ключа, дальше — проверка.
 */

import React, { useEffect, useState } from 'react';
import {
  isBiometricAvailable,
  authenticateWithBiometrics,
  disableBiometrics,
} from '../../core/native-bridge';

const ENABLED_KEY = 'he_biometry_enabled';
const LOCK_KEY = 'he_biometry_lock';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export const BiometrySetupCard: React.FC = () => {
  const [checking, setChecking] = useState(true);
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(() => readFlag(ENABLED_KEY));
  const [locked, setLocked] = useState(() => readFlag(LOCK_KEY));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    isBiometricAvailable()
      .then((v) => {
        if (alive) setSupported(v);
      })
      .catch(() => {
        if (alive) setSupported(false);
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const save = (key: string, v: boolean) => {
    try {
      if (v) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  };

  const enable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const ok = await authenticateWithBiometrics('Включение входа по биометрии');
      if (ok) {
        setEnabled(true);
        save(ENABLED_KEY, true);
        setMsg('✅ Биометрия включена — теперь можно заблокировать вход в приложение');
      } else {
        setMsg('Отменено или недоступно. Проверьте: блокировка экрана + отпечаток/лицо в настройках Android');
      }
    } catch {
      setMsg('Не получилось. Проверьте настройки экрана блокировки Android');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const ok = await authenticateWithBiometrics('Проверка биометрии');
      setMsg(ok ? '✅ Подтверждено — всё работает' : 'Отменено');
    } catch {
      setMsg('Не получилось');
    } finally {
      setBusy(false);
    }
  };

  const disable = () => {
    try {
      disableBiometrics();
    } catch {
      /* ignore */
    }
    save(ENABLED_KEY, false);
    save(LOCK_KEY, false);
    setEnabled(false);
    setLocked(false);
    setMsg('Биометрия выключена, ключ удалён с устройства');
  };

  const toggleLock = () => {
    const next = !locked;
    setLocked(next);
    save(LOCK_KEY, next);
    setMsg(
      next
        ? '🔒 Блокировка входа включена — приложение спросит отпечаток при запуске'
        : 'Блокировка входа выключена',
    );
  };

  return (
    <div className="native-feature-card" aria-label="Биометрия">
      <div className="native-feature-head">
        <span className="native-feature-icon">🔐</span>
        <div>
          <div className="native-feature-title">Биометрия</div>
          <div className="native-feature-sub">
            {checking ? 'Проверка устройства…' : supported ? 'Отпечаток / лицо доступны' : 'На этом устройстве недоступна'}
          </div>
        </div>
        <span className={`native-dot ${checking ? '' : supported ? 'native-dot--ok' : 'native-dot--bad'}`} />
      </div>
      {!checking && !supported && (
        <div className="native-feature-how">
          Чтобы включить: Настройки Android → Безопасность → Блокировка экрана (PIN/пароль) → добавьте отпечаток или лицо. Затем вернитесь сюда.
        </div>
      )}
      <div className="native-feature-actions">
        {!enabled ? (
          <button className="native-feature-wide" disabled={busy || checking || !supported} onClick={enable}>
            {busy ? 'Ждите…' : '🖐️ Включить вход по биометрии'}
          </button>
        ) : (
          <>
            <button className="native-feature-btn" disabled={busy} onClick={test}>
              Проверить
            </button>
            <button
              className="native-feature-btn"
              disabled={busy || !supported}
              onClick={toggleLock}
              aria-pressed={locked}
            >
              {locked ? '🔒 Блок входа: вкл' : '🔓 Блок входа: выкл'}
            </button>
            <button className="native-feature-btn native-feature-btn--danger" disabled={busy} onClick={disable}>
              Выключить
            </button>
          </>
        )}
      </div>
      {msg && (
        <div className="native-feature-msg" role="status">
          {msg}
        </div>
      )}
    </div>
  );
};
