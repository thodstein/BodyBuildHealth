import React, { useEffect, useState } from 'react';
import { onKvSyncStatus, syncKvNow, getKvSyncState } from '../core/cloud-kv';
import { toastStore } from '../core/toast';

/**
 * Кнопка «🔄» в шапке: принудительная синхронизация с облаком (выгрузка локальных
 * изменений + загрузка с другого устройства) без перезагрузки экрана. Показывается
 * только когда синк включён (Telegram-путь).
 */
export const KvSyncButton: React.FC = () => {
  const [status, setStatus] = useState(getKvSyncState().status);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onKvSyncStatus(s => setStatus(s.status));
    return unsub;
  }, []);

  if (status === 'off') return null;

  return (
    <button
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          const applied = await syncKvNow();
          if (applied > 0) {
            toastStore.success('🔄 Новые данные с другого устройства получены');
          } else {
            toastStore.success('✅ Данные синхронизированы');
          }
        } catch {
          toastStore.error('Не удалось синхронизировать');
        } finally {
          setBusy(false);
        }
      }}
      title="Синхронизировать с облаком"
      aria-label="Синхронизировать с облаком"
      disabled={busy}
      style={{
        padding: '6px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        background: busy ? 'rgba(255,255,255,0.08)' : 'rgba(0,230,138,0.12)',
        border: busy ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,230,138,0.35)',
        color: busy ? 'rgba(255,255,255,0.6)' : '#00e68a',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        whiteSpace: 'nowrap',
        minHeight: 30,
        opacity: busy ? 0.7 : 1,
      }}
    >
      {busy ? '⟳' : '🔄'}
    </button>
  );
};