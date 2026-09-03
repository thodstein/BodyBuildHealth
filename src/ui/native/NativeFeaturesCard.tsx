/**
 * NativeFeaturesCard.tsx — остальные возможности APK в одном месте. ТОЛЬКО native.
 * Уведомления, камера, шаринг: статус + кнопка проверки + короткая инструкция.
 */

import React, { useState } from 'react';
import { notifyLocal, pickPhoto, shareText } from '../../core/native-bridge';

export const NativeFeaturesCard: React.FC = () => {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<string>) => {
    setBusy(id);
    setMsg(null);
    try {
      setMsg(await fn());
    } catch {
      setMsg('Не получилось — проверьте разрешения приложения в настройках Android');
    } finally {
      setBusy(null);
    }
  };

  const testPush = () =>
    run('push', async () => {
      const ok = await notifyLocal('Health Engine', 'Уведомления работают ✅');
      return ok
        ? '✅ Уведомление отправлено — если не пришло, разрешите уведомления для приложения'
        : 'Не получилось — разрешите уведомления: Настройки → Приложения → Health Engine → Уведомления';
    });

  const testCamera = () =>
    run('camera', async () => {
      const photo = await pickPhoto();
      if (!photo) return 'Отменено. При выборе «Камера» разрешите доступ к камере один раз';
      return `✅ Фото получено (${photo.format}) — камера и галерея работают`;
    });

  const testShare = () =>
    run('share', async () => {
      const ok = await shareText({ title: 'Health Engine', text: 'Тест шаринга из APK' });
      return ok ? '✅ Диалог шаринга открыт' : 'Отменено';
    });

  return (
    <div className="native-feature-card" aria-label="Возможности APK">
      <div className="native-feature-head">
        <span className="native-feature-icon">⚡</span>
        <div>
          <div className="native-feature-title">Возможности APK</div>
          <div className="native-feature-sub">Проверка в один тап · разрешения — в настройках Android</div>
        </div>
      </div>
      <div className="native-feature-list">
        <div className="native-feature-row">
          <span className="native-feature-row-icon">🔔</span>
          <div className="native-feature-row-body">
            <div className="native-feature-row-name">Уведомления</div>
            <div className="native-feature-row-desc">Напоминания о тренировках, воде и приёмах пищи</div>
          </div>
          <button className="native-feature-btn" disabled={busy === 'push'} onClick={testPush}>
            {busy === 'push' ? '…' : 'Проверить'}
          </button>
        </div>
        <div className="native-feature-row">
          <span className="native-feature-row-icon">📷</span>
          <div className="native-feature-row-body">
            <div className="native-feature-row-name">Камера и галерея</div>
            <div className="native-feature-row-desc">Фото тела, чеков и анализов прямо в дневники</div>
          </div>
          <button className="native-feature-btn" disabled={busy === 'camera'} onClick={testCamera}>
            {busy === 'camera' ? '…' : 'Проверить'}
          </button>
        </div>
        <div className="native-feature-row">
          <span className="native-feature-row-icon">📤</span>
          <div className="native-feature-row-body">
            <div className="native-feature-row-name">Шаринг файлов</div>
            <div className="native-feature-row-desc">Отчёты тренеру через системный диалог</div>
          </div>
          <button className="native-feature-btn" disabled={busy === 'share'} onClick={testShare}>
            {busy === 'share' ? '…' : 'Проверить'}
          </button>
        </div>
      </div>
      {msg && (
        <div className="native-feature-msg" role="status">
          {msg}
        </div>
      )}
      <details className="native-feature-details">
        <summary>Где включать разрешения</summary>
        <div className="native-feature-how">
          Настройки Android → Приложения → Health Engine → Разрешения: камера, уведомления, файлы. Биометрия: Настройки → Безопасность → отпечаток/лицо. Всё меняется без переустановки.
        </div>
      </details>
    </div>
  );
};
