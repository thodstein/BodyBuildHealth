/**
 * AppearanceSetupCard.tsx — тема и акцент APK. ТОЛЬКО native
 * (монтируется в ProfileSettingsTab §4.4 за isNativeApp()-гейтом).
 * Telegram/web этот компонент не импортируют.
 */

import React, { useState } from 'react';
import { haptics } from '../../core/native-bridge';
import {
  getApkTheme,
  setApkTheme,
  getApkAccent,
  setApkAccent,
  applySystemAccentFromDevice,
  APK_ACCENTS,
  type ApkTheme,
  type ApkAccent,
} from './appearance';

const THEMES: { id: ApkTheme; label: string; hint: string }[] = [
  { id: '', label: '🌙 Тёмная', hint: 'фирменный navy' },
  { id: 'amoled', label: '⬛ AMOLED', hint: 'чистый чёрный' },
  { id: 'light', label: '☀️ Светлая', hint: 'бумага' },
];

export const AppearanceSetupCard: React.FC = () => {
  const [theme, setTheme] = useState<ApkTheme>(() => getApkTheme());
  const [accent, setAccent] = useState<ApkAccent>(() => getApkAccent());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const tap = () => {
    try {
      void haptics('light');
    } catch {
      /* ignore */
    }
  };

  const pickTheme = (t: ApkTheme) => {
    tap();
    setTheme(t);
    try {
      setApkTheme(t);
    } catch {
      /* ignore */
    }
  };
  const pickAccent = (a: ApkAccent) => {
    tap();
    if (a === 'system') {
      void pickSystem();
      return;
    }
    setAccent(a);
    setMsg(null);
    try {
      setApkAccent(a);
    } catch {
      /* ignore */
    }
  };
  const pickSystem = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const ok = await applySystemAccentFromDevice();
      if (ok) {
        setAccent('system');
        setMsg('✅ Системный акцент применён');
      } else {
        setMsg('Система недоступна — нужен Android 12+ с Material You. Остался прежний акцент');
      }
    } catch {
      setMsg('Не получилось прочитать палитру системы');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="native-feature-card" aria-label="Оформление APK">
      <div className="native-feature-head">
        <span className="native-feature-icon">🎨</span>
        <div>
          <div className="native-feature-title">Оформление</div>
          <div className="native-feature-sub">Тема и акцент · применяются мгновенно</div>
        </div>
      </div>
      <div className="native-section">Тема</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label="Тема">
        {THEMES.map((t) => (
          <button
            key={t.id || 'dark'}
            type="button"
            role="radio"
            aria-checked={theme === t.id}
            className="native-chip"
            data-active={theme === t.id ? 'true' : 'false'}
            onClick={() => pickTheme(t.id)}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="native-section">Акцент</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label="Акцент">
        {APK_ACCENTS.map((a) => (
          <button
            key={a.id || 'lime'}
            type="button"
            role="radio"
            aria-checked={accent === a.id}
            className="native-chip"
            data-active={accent === a.id ? 'true' : 'false'}
            onClick={() => pickAccent(a.id)}
            disabled={busy}
            title={a.id === 'system' ? 'Цвет из обоев (Android 12+)' : a.label}
          >
            <span
              aria-hidden="true"
              style={{
                width: 12,
                height: 12,
                borderRadius: 99,
                background: a.swatch,
                boxShadow: '0 0 6px rgba(0,0,0,0.4)',
                flexShrink: 0,
              }}
            />
            {a.id === 'system' ? '🤖 Системный' : a.label}
          </button>
        ))}
      </div>
      {msg && (
        <div className="native-feature-msg" role="status">
          {msg}
        </div>
      )}
    </div>
  );
};
