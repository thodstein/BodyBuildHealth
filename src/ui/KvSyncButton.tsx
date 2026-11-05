import React, { useEffect, useState } from 'react';
import { onKvSyncStatus, syncKvNow, getKvSyncState } from '../core/cloud-kv';
import { toastStore } from '../core/toast';

/**
 * Кнопка «🔄» в шапке: принудительная синхронизация с облаком (выгрузка локальных
 * изменений + загрузка с другого устройства) без перезагрузки экрана. Показывается
 * только когда синк включён (Telegram-путь или своё пространство устройства).
 *
 * Состояние видно по иконке: 🔄 — всё синхронизировано, ⟳ — идёт обмен,
 * ⚠️ — облако не отвечает (данные копятся локально, нажатие повторяет попытку).
 */
export const KvSyncButton: React.FC = () => {
  const [state, setState] = useState(() => getKvSyncState());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onKvSyncStatus(s => setState(s));
    return unsub;
  }, []);

  if (state.status === 'off') return null;

  const failed = state.status === 'error';
  const working = busy || state.status === 'syncing';
  const accent = failed ? 'rgba(251,191,36,' : 'rgba(0,230,138,';

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
      title={
        failed
          ? `Облако недоступно: ${state.error || 'нет связи'}. Данные сохранены локально — нажмите, чтобы повторить`
          : 'Синхронизировать с облаком'
      }
      aria-label="Синхронизировать с облаком"
      disabled={busy}
      style={{
        padding: '6px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        background: working ? 'rgba(255,255,255,0.08)' : `${accent}0.12)`,
        border: working ? '1px solid rgba(255,255,255,0.15)' : `1px solid ${accent}0.35)`,
        color: working ? 'rgba(255,255,255,0.6)' : failed ? '#fbbf24' : '#00e68a',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        whiteSpace: 'nowrap',
        minHeight: 30,
        opacity: working ? 0.7 : 1,
      }}
    >
      {working ? '⟳' : failed ? '⚠️' : '🔄'}
    </button>
  );
};
