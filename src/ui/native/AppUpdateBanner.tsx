/**
 * AppUpdateBanner.tsx — самообновление APK без сторов. ТОЛЬКО native.
 * В Telegram/web возвращает null (там обновления прилетают с сервера сами).
 *
 * Поток: версия из App.getInfo → фид GitHub Releases → баннер →
 * DownloadManager (плагин AppUpdater) → системный установщик.
 * Стили инлайн: styles-native.css — зона блочного агента, не трогаем.
 */

import React, { useEffect, useRef, useState } from 'react';
import { getAppPlatform } from '../../core/app-platform';
import {
  fetchLatestRelease,
  isNewerVersion,
  readUpdateState,
  shouldCheckNow,
  writeUpdateState,
  type UpdateRelease,
} from '../../core/app-updater';
import {
  getDeviceInfo,
  installDownloadedApk,
  openUnknownSourcesSettings,
  pollApkDownload,
  startApkDownload,
} from '../../core/native-bridge';
import {
  getLiveBundleId,
  isBundleCompatible,
  reloadToLiveBundle,
  stageLiveBundle,
} from '../../core/live-update';

type Phase = 'idle' | 'available' | 'downloading' | 'ready' | 'staged' | 'error';

function strings(en: boolean) {
  return en
    ? {
        title: (v: string) => `Update ${v} available`,
        sub: 'Without Play Market — download and install in one tap',
        update: 'Update',
        fastUpdate: 'Fast update (no reinstall)',
        apkInstead: 'Full APK instead',
        staged: 'Ready — restart the app to apply',
        restartNow: 'Restart now',
        later: 'Later',
        skip: 'Skip version',
        installing: (p: number) => `Downloading… ${Math.round(p * 100)}%`,
        install: 'Install',
        allowUnknown:
          'Installation is blocked — allow it: Settings → Apps → Health Engine → Install unknown apps, then tap Install again.',
        openSettings: 'Open settings',
        failed:
          'Failed. Check the connection and free space, then try again.',
        retry: 'Retry',
      }
    : {
        title: (v: string) => `Доступно обновление ${v}`,
        sub: 'Без Play Market — скачать и поставить в один тап',
        update: 'Обновить',
        fastUpdate: 'Быстрое обновление (без переустановки)',
        apkInstead: 'Полный APK вместо',
        staged: 'Готово — перезапустите приложение',
        restartNow: 'Перезапустить сейчас',
        later: 'Позже',
        skip: 'Пропустить версию',
        installing: (p: number) => `Скачивание… ${Math.round(p * 100)}%`,
        install: 'Установить',
        allowUnknown:
          'Установка заблокирована — разрешите: Настройки → Приложения → Health Engine → Установка неизвестных приложений, затем нажмите «Установить» ещё раз.',
        openSettings: 'Открыть настройки',
        failed: 'Не получилось. Проверьте сеть и свободное место, попробуйте ещё раз.',
        retry: 'Повторить',
      };
}

const cardStyle: React.CSSProperties = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
  left: 12,
  right: 12,
  zIndex: 9999,
  borderRadius: 18,
  padding: '12px 14px',
  background: 'rgba(9, 18, 34, 0.96)',
  border: '1px solid rgba(var(--accent-rgb, 201, 247, 58), 0.35)',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.55)',
  color: '#f4f7ff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif",
};

const btnPrimary: React.CSSProperties = {
  minHeight: 44,
  padding: '10px 16px',
  borderRadius: 12,
  border: 'none',
  fontWeight: 700,
  background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
  color: 'var(--accent-contrast)',
};

const btnGhost: React.CSSProperties = {
  minHeight: 44,
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid rgba(140, 190, 255, 0.25)',
  background: 'transparent',
  color: '#e2ecff',
};

export const AppUpdateBanner: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [release, setRelease] = useState<UpdateRelease | null>(null);
  const [progress, setProgress] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Быстрый путь (OTA-бандл) доступен: есть .zip + мажор совпал + ещё не стоит. */
  const [ota, setOta] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const en =
    typeof navigator !== 'undefined' && (navigator.language || '').startsWith('en');

  useEffect(() => {
    if (getAppPlatform() !== 'native') return;
    let cancelled = false;
    (async () => {
      try {
        if (!shouldCheckNow()) return;
        const info = await getDeviceInfo();
        const installed = (info.appVersion || '').trim();
        // Без версии сборки сравнивать не с чем — тихо выходим.
        if (!installed) {
          writeUpdateState({ lastCheck: Date.now() });
          return;
        }
        const latest = await fetchLatestRelease();
        writeUpdateState({ lastCheck: Date.now() });
        if (cancelled || !latest) return;
        if (!isNewerVersion(latest.version, installed)) return;
        if (readUpdateState().skippedVersion === latest.version) return;
        // Быстрый путь — только при совместимом мажоре и не установленном бандле.
        try {
          const liveId = await getLiveBundleId();
          if (cancelled) return;
          if (
            latest.bundleUrl &&
            isBundleCompatible(latest.version, installed) &&
            liveId !== latest.version
          ) {
            setOta(true);
          }
        } catch {
          /* без OTA — остаётся полный APK */
        }
        setRelease(latest);
        setPhase('available');
      } catch {
        /* тишина: обновление — не повод шуметь */
      }
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (getAppPlatform() !== 'native') return null;
  if (phase === 'idle' || !release) return null;
  const T = strings(en);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startDownload = async () => {
    setFailed(false);
    setBlocked(false);
    setOta(false);
    setPhase('downloading');
    setProgress(0);
    const id = await startApkDownload(release.apkUrl);
    if (id === null) {
      setFailed(true);
      setPhase('error');
      return;
    }
    pollRef.current = setInterval(async () => {
      const st = await pollApkDownload(id);
      setProgress(st.progress);
      if (st.status === 'done') {
        stopPoll();
        setPhase('ready');
      } else if (st.status === 'failed') {
        stopPoll();
        setFailed(true);
        setPhase('error');
      }
    }, 1000);
  };

  const doInstall = async () => {
    setBlocked(false);
    const res = await installDownloadedApk();
    if (res === 'blocked') {
      setBlocked(true);
      return;
    }
    if (res === false) {
      setFailed(true);
      setPhase('error');
    }
    // true = системный установщик открыт, дальше ведёт Android.
  };

  /** Быстрый путь: скачать web-бандл и назначить следующим (без переустановки). */
  const startFastUpdate = async () => {
    if (!release?.bundleUrl) return;
    setFailed(false);
    setPhase('downloading');
    setProgress(0);
    const ok = await stageLiveBundle(release.version, release.bundleUrl, setProgress);
    if (ok) {
      setProgress(1);
      setPhase('staged');
    } else {
      setFailed(true);
      setPhase('error');
    }
  };

  return (
    <div style={cardStyle} role="alert" aria-label="app-update">
      <div style={{ fontWeight: 800, fontSize: 15 }}>{T.title(release.version)}</div>
      <div style={{ opacity: 0.75, fontSize: 12.5, marginTop: 2 }}>{T.sub}</div>
      {phase === 'downloading' && (
        <div
          style={{
            height: 8,
            borderRadius: 99,
            background: 'rgba(140,190,255,0.15)',
            marginTop: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.round(progress * 100)}%`,
              height: '100%',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            }}
          />
        </div>
      )}
      {phase === 'available' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {ota ? (
            <button style={btnPrimary} onClick={startFastUpdate}>
              {T.fastUpdate}
            </button>
          ) : (
            <button style={btnPrimary} onClick={startDownload}>
              {T.update}
            </button>
          )}
          {ota && (
            <button style={btnGhost} onClick={startDownload}>
              {T.apkInstead}
            </button>
          )}
          <button
            style={btnGhost}
            onClick={() => {
              setPhase('idle');
            }}
          >
            {T.later}
          </button>
          <button
            style={btnGhost}
            onClick={() => {
              writeUpdateState({ skippedVersion: release.version });
              setPhase('idle');
            }}
          >
            {T.skip}
          </button>
        </div>
      )}
      {phase === 'downloading' && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
          {T.installing(progress)}
        </div>
      )}
      {phase === 'ready' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button style={btnPrimary} onClick={doInstall}>
            {T.install}
          </button>
        </div>
      )}
      {phase === 'staged' && (
        <div style={{ marginTop: 10 }}>
          <div style={{ opacity: 0.9, fontSize: 13 }}>{T.staged}</div>
          <button
            style={{ ...btnPrimary, marginTop: 8 }}
            onClick={() => {
              void reloadToLiveBundle();
            }}
          >
            {T.restartNow}
          </button>
        </div>
      )}
      {blocked && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          <div style={{ opacity: 0.9 }}>{T.allowUnknown}</div>
          <button
            style={{ ...btnGhost, marginTop: 8 }}
            onClick={() => {
              void openUnknownSourcesSettings();
            }}
          >
            {T.openSettings}
          </button>
        </div>
      )}
      {phase === 'error' && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          <div style={{ opacity: 0.9 }}>{T.failed}</div>
          <button style={{ ...btnGhost, marginTop: 8 }} onClick={startDownload}>
            {T.retry}
          </button>
        </div>
      )}
    </div>
  );
};
