/**
 * NativeFeaturesCard.tsx — остальные возможности APK в одном месте. ТОЛЬКО native.
 * Уведомления, камера, шаринг: статус + кнопка проверки + короткая инструкция.
 */

import React, { useState } from 'react';
import { notifyLocal, pickPhoto, shareText } from '../../core/native-bridge';
import { getLocale } from '../../data/interactions-labels';

function strings() {
  if (getLocale() === 'en') {
    return {
      cardLabel: 'APK features',
      title: 'APK features',
      sub: 'One-tap check · permissions live in Android settings',
      notifName: 'Notifications',
      notifDesc: 'Reminders about workouts, water and meals',
      cameraName: 'Camera & gallery',
      cameraDesc: 'Body, receipt and lab photos straight into diaries',
      shareName: 'File sharing',
      shareDesc: 'Reports to the coach via the system dialog',
      check: 'Check',
      failPermissions: 'Failed — check the app permissions in Android settings',
      pushOk: '✅ Notification sent — if it never arrives, allow notifications for the app',
      pushFail:
        'Failed — allow notifications: Settings → Apps → Health Engine → Notifications',
      cameraCancel: 'Cancelled. When picking “Camera”, allow camera access once',
      cameraOk: (format: string) => `✅ Photo received (${format}) — camera and gallery work`,
      shareOk: '✅ Share dialog opened',
      shareCancel: 'Cancelled',
      detailsTitle: 'Where to enable permissions',
      details:
        'Android Settings → Apps → Health Engine → Permissions: camera, notifications, files. Biometrics: Settings → Security → fingerprint/face. Everything changes without reinstalling.',
      pushTitle: 'Health Engine',
      pushBody: 'Notifications work ✅',
      shareTitle: 'Health Engine',
      shareText: 'Sharing test from the APK',
    };
  }
  return {
    cardLabel: 'Возможности APK',
    title: 'Возможности APK',
    sub: 'Проверка в один тап · разрешения — в настройках Android',
    notifName: 'Уведомления',
    notifDesc: 'Напоминания о тренировках, воде и приёмах пищи',
    cameraName: 'Камера и галерея',
    cameraDesc: 'Фото тела, чеков и анализов прямо в дневники',
    shareName: 'Шаринг файлов',
    shareDesc: 'Отчёты тренеру через системный диалог',
    check: 'Проверить',
    failPermissions: 'Не получилось — проверьте разрешения приложения в настройках Android',
    pushOk: '✅ Уведомление отправлено — если не пришло, разрешите уведомления для приложения',
    pushFail:
      'Не получилось — разрешите уведомления: Настройки → Приложения → Health Engine → Уведомления',
    cameraCancel: 'Отменено. При выборе «Камера» разрешите доступ к камере один раз',
    cameraOk: (format: string) => `✅ Фото получено (${format}) — камера и галерея работают`,
    shareOk: '✅ Диалог шаринга открыт',
    shareCancel: 'Отменено',
    detailsTitle: 'Где включать разрешения',
    details:
      'Настройки Android → Приложения → Health Engine → Разрешения: камера, уведомления, файлы. Биометрия: Настройки → Безопасность → отпечаток/лицо. Всё меняется без переустановки.',
    pushTitle: 'Health Engine',
    pushBody: 'Уведомления работают ✅',
    shareTitle: 'Health Engine',
    shareText: 'Тест шаринга из APK',
  };
}

export const NativeFeaturesCard: React.FC = () => {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const T = strings();

  const run = async (id: string, fn: () => Promise<string>) => {
    setBusy(id);
    setMsg(null);
    try {
      setMsg(await fn());
    } catch {
      setMsg(T.failPermissions);
    } finally {
      setBusy(null);
    }
  };

  const testPush = () =>
    run('push', async () => {
      const ok = await notifyLocal(T.pushTitle, T.pushBody);
      return ok ? T.pushOk : T.pushFail;
    });

  const testCamera = () =>
    run('camera', async () => {
      const photo = await pickPhoto();
      if (!photo) return T.cameraCancel;
      return T.cameraOk(photo.format);
    });

  const testShare = () =>
    run('share', async () => {
      const ok = await shareText({ title: T.shareTitle, text: T.shareText });
      return ok ? T.shareOk : T.shareCancel;
    });

  return (
    <div className="native-feature-card" aria-label={T.cardLabel}>
      <div className="native-feature-head">
        <span className="native-feature-icon">⚡</span>
        <div>
          <div className="native-feature-title">{T.title}</div>
          <div className="native-feature-sub">{T.sub}</div>
        </div>
      </div>
      <div className="native-feature-list">
        <div className="native-feature-row">
          <span className="native-feature-row-icon">🔔</span>
          <div className="native-feature-row-body">
            <div className="native-feature-row-name">{T.notifName}</div>
            <div className="native-feature-row-desc">{T.notifDesc}</div>
          </div>
          <button className="native-feature-btn" disabled={busy === 'push'} onClick={testPush}>
            {busy === 'push' ? '…' : T.check}
          </button>
        </div>
        <div className="native-feature-row">
          <span className="native-feature-row-icon">📷</span>
          <div className="native-feature-row-body">
            <div className="native-feature-row-name">{T.cameraName}</div>
            <div className="native-feature-row-desc">{T.cameraDesc}</div>
          </div>
          <button className="native-feature-btn" disabled={busy === 'camera'} onClick={testCamera}>
            {busy === 'camera' ? '…' : T.check}
          </button>
        </div>
        <div className="native-feature-row">
          <span className="native-feature-row-icon">📤</span>
          <div className="native-feature-row-body">
            <div className="native-feature-row-name">{T.shareName}</div>
            <div className="native-feature-row-desc">{T.shareDesc}</div>
          </div>
          <button className="native-feature-btn" disabled={busy === 'share'} onClick={testShare}>
            {busy === 'share' ? '…' : T.check}
          </button>
        </div>
      </div>
      {msg && (
        <div className="native-feature-msg" role="status">
          {msg}
        </div>
      )}
      <details className="native-feature-details">
        <summary>{T.detailsTitle}</summary>
        <div className="native-feature-how">{T.details}</div>
      </details>
    </div>
  );
};
