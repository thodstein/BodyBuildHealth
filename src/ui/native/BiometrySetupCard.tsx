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
import { getLocale } from '../../data/interactions-labels';

const ENABLED_KEY = 'he_biometry_enabled';
const LOCK_KEY = 'he_biometry_lock';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function strings() {
  if (getLocale() === 'en') {
    return {
      cardLabel: 'Biometrics',
      title: 'Biometrics',
      checking: 'Checking the device…',
      supported: 'Fingerprint / face available',
      unsupported: 'Not available on this device',
      how: 'To enable: Android Settings → Security → Screen lock (PIN/password) → add a fingerprint or face. Then come back here.',
      enableCta: '🖐️ Enable biometric login',
      enableReason: 'Enabling biometric login',
      enabledOk: '✅ Biometrics enabled — you can now lock app entry',
      enableFail: 'Cancelled or unavailable. Check: screen lock + fingerprint/face in Android settings',
      enableErr: 'Failed. Check the Android screen-lock settings',
      checkCta: 'Check',
      checkReason: 'Checking biometrics',
      checkOk: '✅ Confirmed — everything works',
      checkCancel: 'Cancelled',
      checkErr: 'Failed',
      lockOn: '🔒 Entry lock: on',
      lockOff: '🔓 Entry lock: off',
      lockOnMsg: '🔒 Entry lock enabled — the app will ask for a fingerprint on launch',
      lockOffMsg: 'Entry lock disabled',
      disableCta: 'Disable',
      disableMsg: 'Biometrics disabled, key removed from the device',
      wait: 'Wait…',
    };
  }
  return {
    cardLabel: 'Биометрия',
    title: 'Биометрия',
    checking: 'Проверка устройства…',
    supported: 'Отпечаток / лицо доступны',
    unsupported: 'На этом устройстве недоступна',
    how: 'Чтобы включить: Настройки Android → Безопасность → Блокировка экрана (PIN/пароль) → добавьте отпечаток или лицо. Затем вернитесь сюда.',
    enableCta: '🖐️ Включить вход по биометрии',
    enableReason: 'Включение входа по биометрии',
    enabledOk: '✅ Биометрия включена — теперь можно заблокировать вход в приложение',
    enableFail: 'Отменено или недоступно. Проверьте: блокировка экрана + отпечаток/лицо в настройках Android',
    enableErr: 'Не получилось. Проверьте настройки экрана блокировки Android',
    checkCta: 'Проверить',
    checkReason: 'Проверка биометрии',
    checkOk: '✅ Подтверждено — всё работает',
    checkCancel: 'Отменено',
    checkErr: 'Не получилось',
    lockOn: '🔒 Блок входа: вкл',
    lockOff: '🔓 Блок входа: выкл',
    lockOnMsg: '🔒 Блокировка входа включена — приложение спросит отпечаток при запуске',
    lockOffMsg: 'Блокировка входа выключена',
    disableCta: 'Выключить',
    disableMsg: 'Биометрия выключена, ключ удалён с устройства',
    wait: 'Ждите…',
  };
}

export const BiometrySetupCard: React.FC = () => {
  const [checking, setChecking] = useState(true);
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(() => readFlag(ENABLED_KEY));
  const [locked, setLocked] = useState(() => readFlag(LOCK_KEY));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const T = strings();

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
      const ok = await authenticateWithBiometrics(T.enableReason);
      if (ok) {
        setEnabled(true);
        save(ENABLED_KEY, true);
        setMsg(T.enabledOk);
      } else {
        setMsg(T.enableFail);
      }
    } catch {
      setMsg(T.enableErr);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const ok = await authenticateWithBiometrics(T.checkReason);
      setMsg(ok ? T.checkOk : T.checkCancel);
    } catch {
      setMsg(T.checkErr);
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
    setMsg(T.disableMsg);
  };

  const toggleLock = () => {
    const next = !locked;
    setLocked(next);
    save(LOCK_KEY, next);
    setMsg(next ? T.lockOnMsg : T.lockOffMsg);
  };

  return (
    <div className="native-feature-card" aria-label={T.cardLabel}>
      <div className="native-feature-head">
        <span className="native-feature-icon">🔐</span>
        <div>
          <div className="native-feature-title">{T.title}</div>
          <div className="native-feature-sub">
            {checking ? T.checking : supported ? T.supported : T.unsupported}
          </div>
        </div>
        <span className={`native-dot ${checking ? '' : supported ? 'native-dot--ok' : 'native-dot--bad'}`} />
      </div>
      {!checking && !supported && (
        <div className="native-feature-how">{T.how}</div>
      )}
      <div className="native-feature-actions">
        {!enabled ? (
          <button className="native-feature-wide" disabled={busy || checking || !supported} onClick={enable}>
            {busy ? T.wait : T.enableCta}
          </button>
        ) : (
          <>
            <button className="native-feature-btn" disabled={busy} onClick={test}>
              {T.checkCta}
            </button>
            <button
              className="native-feature-btn"
              disabled={busy || !supported}
              onClick={toggleLock}
              aria-pressed={locked}
            >
              {locked ? T.lockOn : T.lockOff}
            </button>
            <button className="native-feature-btn native-feature-btn--danger" disabled={busy} onClick={disable}>
              {T.disableCta}
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
