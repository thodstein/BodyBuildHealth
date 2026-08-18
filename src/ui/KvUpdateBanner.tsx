import React, { useEffect, useState } from 'react';
import { onKvSyncStatus, clearKvPendingUpdate, reloadKvView, getKvSyncState } from '../core/cloud-kv';

/**
 * Баннер «🔄 Новые данные с другого устройства» — появляется, когда фоновый синк
 * применил данные (профиль/анализы/курс/дневник) с телефона/ПК. Авто-перезагрузки нет:
 * пользователь нажимает «Обновить» (или ✕, чтобы отложить).
 */
export const KvUpdateBanner: React.FC = () => {
  const [pending, setPending] = useState(getKvSyncState().pendingUpdate);

  useEffect(() => {
    const unsub = onKvSyncStatus(s => setPending(s.pendingUpdate));
    return unsub;
  }, []);

  if (!pending) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 74,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 12,
        background: 'rgba(0, 230, 138, 0.14)',
        border: '1px solid rgba(0, 230, 138, 0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        color: '#eafff5',
        fontSize: 12,
        fontWeight: 600,
        boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
        maxWidth: '92vw',
        whiteSpace: 'nowrap',
      }}
    >
      <span>🔄 Новые данные с другого устройства</span>
      <button
        onClick={() => reloadKvView()}
        aria-label="Перезагрузить приложение для применения данных"
        style={{
          padding: '8px 14px',
          borderRadius: 9,
          border: 'none',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, #00e68a, #00c46f)',
          color: '#00281a',
          fontWeight: 800,
          fontSize: 12,
          minHeight: 38,
          flexShrink: 0,
        }}
      >
        Обновить
      </button>
      <button
        onClick={() => clearKvPendingUpdate()}
        aria-label="Скрыть уведомление"
        title="Скрыть"
        style={{
          padding: '6px 9px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.15)',
          cursor: 'pointer',
          background: 'transparent',
          color: 'rgba(255,255,255,0.65)',
          fontSize: 12,
          minHeight: 30,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
};