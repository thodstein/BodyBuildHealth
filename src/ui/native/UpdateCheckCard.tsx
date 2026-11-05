/**
 * UpdateCheckCard — ручная проверка обновлений в настройках APK.
 *
 * Зачем: фоновая проверка бывает раз в сутки (`shouldCheckNow`), и её баннер
 * легко пропустить. Кнопка «Проверить» даёт однозначный ответ: уже последняя
 * версия или есть новая. Само скачивание/установка живут в `AppUpdateBanner` —
 * здесь только запрос проверки, без дублирования потока.
 */
import React, { useEffect, useState } from 'react';
import { NativeIcon } from './NativeIcons';
import { getDeviceInfo } from '../../core/native-bridge';
import { requestUpdateCheck } from '../../core/app-updater';

export const UpdateCheckCard: React.FC = () => {
  const [version, setVersion] = useState('');

  useEffect(() => {
    let alive = true;
    void getDeviceInfo()
      .then(info => {
        if (alive) setVersion((info.appVersion || '').trim());
      })
      .catch(() => { /* версия не критична для кнопки */ });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="native-feature-card" aria-label="Обновление приложения">
      <div className="native-feature-head">
        <span className="native-feature-icon" style={{ color: 'var(--accent-contrast)' }}>
          <NativeIcon name="zap" size={20} />
        </span>
        <div>
          <div className="native-feature-title">Обновление приложения</div>
          <div className="native-feature-sub">
            {version ? `Установлено: ${version}` : 'Версия определяется…'} · без Play Market
          </div>
        </div>
      </div>
      <div className="native-feature-list">
        <div className="native-feature-row">
          <span className="native-feature-row-icon"><NativeIcon name="activity" size={15} /></span>
          <div className="native-feature-row-body">
            <div className="native-feature-row-name">Проверить обновления</div>
            <div className="native-feature-row-desc">
              Если есть новая версия — появится баннер с кнопкой «Обновить»
            </div>
          </div>
          <button
            className="native-feature-btn"
            onClick={() => requestUpdateCheck()}
            aria-label="Проверить обновления"
          >
            Проверить
          </button>
        </div>
      </div>
    </div>
  );
};
