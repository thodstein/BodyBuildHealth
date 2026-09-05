/**
 * AppearanceSetupCard.tsx — тема и акцент APK. ТОЛЬКО native
 * (монтируется в ProfileSettingsTab §4.4 за isNativeApp()-гейтом).
 * Telegram/web этот компонент не импортируют.
 */

import React, { useState } from 'react';
import { haptics, initNativeChrome } from '../../core/native-bridge';
import { getLocale } from '../../data/interactions-labels';
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

const THEMES_RU: { id: ApkTheme; label: string; hint: string }[] = [
  { id: '', label: '🌙 Тёмная', hint: 'фирменный navy' },
  { id: 'amoled', label: '⬛ AMOLED', hint: 'чистый чёрный' },
  { id: 'light', label: '☀️ Светлая', hint: 'бумага' },
];

const THEMES_EN: { id: ApkTheme; label: string; hint: string }[] = [
  { id: '', label: '🌙 Dark', hint: 'signature navy' },
  { id: 'amoled', label: '⬛ AMOLED', hint: 'pure black' },
  { id: 'light', label: '☀️ Light', hint: 'paper' },
];

const ACCENT_EN: Record<string, string> = {
  '': 'Lime',
  mint: 'Mint',
  sky: 'Sky',
  violet: 'Violet',
  amber: 'Amber',
  system: 'System',
};

function strings() {
  if (getLocale() === 'en') {
    return {
      themes: THEMES_EN,
      cardLabel: 'APK appearance',
      title: 'Appearance',
      sub: 'Theme & accent · applied instantly',
      themeSection: 'Theme',
      themeGroup: 'Theme',
      accentSection: 'Accent',
      accentGroup: 'Accent',
      systemTitle: 'Wallpaper color (Android 12+)',
      sysOk: '✅ System accent applied',
      sysFail: 'System unavailable — Android 12+ with Material You needed. Kept previous accent',
      sysErr: 'Could not read system palette',
      systemChip: '🤖 System',
    };
  }
  return {
    themes: THEMES_RU,
    cardLabel: 'Оформление APK',
    title: 'Оформление',
    sub: 'Тема и акцент · применяются мгновенно',
    themeSection: 'Тема',
    themeGroup: 'Тема',
    accentSection: 'Акцент',
    accentGroup: 'Акцент',
    systemTitle: 'Цвет из обоев (Android 12+)',
    sysOk: '✅ Системный акцент применён',
    sysFail: 'Система недоступна — нужен Android 12+ с Material You. Остался прежний акцент',
    sysErr: 'Не получилось прочитать палитру системы',
    systemChip: '🤖 Системный',
  };
}

function accentLabel(id: ApkAccent, fallback: string): string {
  try {
    if (getLocale() !== 'en') return fallback;
  } catch {
    return fallback;
  }
  return ACCENT_EN[id] ?? fallback;
}

export const AppearanceSetupCard: React.FC = () => {
  const [theme, setTheme] = useState<ApkTheme>(() => getApkTheme());
  const [accent, setAccent] = useState<ApkAccent>(() => getApkAccent());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const T = strings();

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
    // Статус-бар следует за темой (флагманская деталь): светлая — тёмные
    // иконки на бумаге, тёмные — наоборот. Вне APK — no-op внутри моста.
    try {
      if (t === 'light') void initNativeChrome('#eef2f6', 'light');
      else if (t === 'amoled') void initNativeChrome('#000000', 'dark');
      else void initNativeChrome('#050b16', 'dark');
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
        setMsg(T.sysOk);
      } else {
        setMsg(T.sysFail);
      }
    } catch {
      setMsg(T.sysErr);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="native-feature-card" aria-label={T.cardLabel}>
      <div className="native-feature-head">
        <span className="native-feature-icon">🎨</span>
        <div>
          <div className="native-feature-title">{T.title}</div>
          <div className="native-feature-sub">{T.sub}</div>
        </div>
      </div>
      <div className="native-section">{T.themeSection}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label={T.themeGroup}>
        {T.themes.map((t) => (
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
      <div className="native-section">{T.accentSection}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label={T.accentGroup}>
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
            title={a.id === 'system' ? T.systemTitle : accentLabel(a.id, a.label)}
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
            {a.id === 'system' ? T.systemChip : accentLabel(a.id, a.label)}
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
