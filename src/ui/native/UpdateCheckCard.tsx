/**
 * UpdateCheckCard — ручная проверка обновлений в настройках APK.
 *
 * Зачем: фоновая проверка бывает раз в сутки (`shouldCheckNow`), и её баннер
 * легко пропустить. Кнопка «Проверить» даёт однозначный ответ: уже последняя
 * версия или есть новая. Само скачивание/установка живут в `AppUpdateBanner` —
 * здесь только запрос проверки, без дублирования потока.
 *
 * Здесь же виден ИТОГ последней проверки: баннер и тост можно пропустить
 * (свернули приложение, не смотрели вниз экрана) — а карточка всегда отвечает
 * на вопрос «почему обновлений нет»: нет связи / версия не определилась /
 * всё актуально.
 */
import React, { useEffect, useState } from 'react';
import { NativeIcon } from './NativeIcons';
import { getDeviceInfo } from '../../core/native-bridge';
import { withTimeoutOr } from '../../core/async-timeout';
import { readUpdateState, requestUpdateCheck, UPDATE_STATE_EVENT } from '../../core/app-updater';

const VERSION_TIMEOUT_MS = 5000;

/** 21.11, 18:42 — коротко, без локалей и зависимостей. */
function formatWhen(ts: number): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}, ${hh}:${mi}`;
  } catch {
    return '';
  }
}

export const UpdateCheckCard: React.FC = () => {
  const [version, setVersion] = useState('');
  const [state, setState] = useState(() => readUpdateState());

  useEffect(() => {
    let alive = true;
    // Ядро Capacitor может не ответить — версия не должна держать карточку
    // в вечном «Версия определяется…».
    void withTimeoutOr(getDeviceInfo(), VERSION_TIMEOUT_MS, null)
      .then((info) => {
        if (alive && info) setVersion((info.appVersion || '').trim());
      })
      .catch(() => {
        /* версия не критична для кнопки */
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onState = () => setState(readUpdateState());
    try {
      window.addEventListener(UPDATE_STATE_EVENT, onState);
    } catch {
      /* SSR */
    }
    return () => {
      try {
        window.removeEventListener(UPDATE_STATE_EVENT, onState);
      } catch {
        /* SSR */
      }
    };
  }, []);

  const checkedAt = formatWhen(state.lastCheck);
  const lastResult = state.lastResult || 'Ещё не проверялось';

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
          <span className="native-feature-row-icon">
            <NativeIcon name="activity" size={15} />
          </span>
          <div className="native-feature-row-body">
            <div className="native-feature-row-name">Проверить обновления</div>
            <div className="native-feature-row-desc">Если есть новая версия — появится баннер с кнопкой «Обновить»</div>
          </div>
          <button className="native-feature-btn" onClick={() => requestUpdateCheck()} aria-label="Проверить обновления">
            Проверить
          </button>
        </div>
        <div className="native-feature-row">
          <span className="native-feature-row-icon">
            <NativeIcon name="clock" size={15} />
          </span>
          <div className="native-feature-row-body">
            <div className="native-feature-row-name">Последняя проверка</div>
            <div className="native-feature-row-desc">{lastResult}</div>
          </div>
          {checkedAt && <span style={{ fontSize: 11, opacity: 0.6, whiteSpace: 'nowrap' }}>{checkedAt}</span>}
        </div>
      </div>
    </div>
  );
};
