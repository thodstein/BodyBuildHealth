/**
 * KvErrorBanner — «облако не отвечает».
 *
 * Зачем: сбой синхронизации раньше жил только в памяти (`KvSyncState.error`).
 * Человек видел зелёный интерфейс и думал, что данные в облаке, а они оставались
 * в одном телефоне. Молчаливый сбой — самый дорогой вид сбоя.
 *
 * Показываем не мгновенно (короткий обрыв сети — норма), а после 15 секунд
 * непрерывной ошибки. Убирается вручную до конца сессии или автоматически,
 * когда синк снова заработал.
 */
import React, { useEffect, useState } from 'react';
import { getKvSyncState, isKvCloudConfigured, onKvSyncStatus, syncKvNow } from '../core/cloud-kv';

const SHOW_DELAY_MS = 15_000;
const AMBER = '#fbbf24';

export const KvErrorBanner: React.FC = () => {
  const [state, setState] = useState(() => getKvSyncState());
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => onKvSyncStatus(s => setState(s)), []);

  useEffect(() => {
    if (state.status !== 'error' || dismissed) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [state.status, dismissed]);

  // Ошибка ушла — баннер больше не нужен, и следующая ошибка снова покажется.
  useEffect(() => {
    if (state.status !== 'error') setDismissed(false);
  }, [state.status]);

  if (!isKvCloudConfigured() || !visible || state.status !== 'error') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Облако недоступно"
      style={{
        position: 'relative',
        zIndex: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '8px 12px',
        margin: '6px 8px 0',
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(251,191,36,0.16), rgba(251,191,36,0.06))',
        border: '1px solid rgba(251,191,36,0.4)',
        color: '#fff',
        fontSize: 12,
        lineHeight: 1.35,
      }}
    >
      <div style={{ paddingRight: 84 }}>
        <div style={{ fontWeight: 800 }}>⚠️ Облако недоступно</div>
        <div style={{ opacity: 0.78, fontSize: 11 }}>
          Изменения сохранены в телефоне и уйдут в облако, как только появится связь.
          {state.error ? ` (${state.error})` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{
            minHeight: 32,
            padding: '5px 10px',
            borderRadius: 10,
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer',
            color: '#fff',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.22)',
          }}
        >
          Скрыть
        </button>
        <button
          type="button"
          disabled={retrying}
          onClick={async () => {
            if (retrying) return;
            setRetrying(true);
            try {
              await syncKvNow();
            } catch { /* состояние придёт через onKvSyncStatus */ }
            finally { setRetrying(false); }
          }}
          style={{
            minHeight: 32,
            padding: '5px 12px',
            borderRadius: 10,
            fontSize: 11.5,
            fontWeight: 800,
            cursor: retrying ? 'default' : 'pointer',
            color: '#1b1033',
            background: AMBER,
            border: 'none',
            opacity: retrying ? 0.7 : 1,
          }}
        >
          {retrying ? '⟳ Повторяю…' : 'Повторить'}
        </button>
      </div>
    </div>
  );
};
