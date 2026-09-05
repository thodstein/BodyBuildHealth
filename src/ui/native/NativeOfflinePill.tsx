/**
 * NativeOfflinePill.tsx — пилюля «нет сети». ТОЛЬКО APK (монтируется в
 * App.tsx внутри isNativeApp()-ветки). Telegram/web модуль не импортируют.
 *
 * Офлайн движки локальные, очередь синка (`sync-queue`) доберёт позже —
 * пилюля лишь честно объясняет, почему виджеты/облако молчат.
 */

import React, { useEffect, useState } from 'react';
import { isOnline, watchOnline } from '../../core/native-bridge';
import { getLocale } from '../../data/interactions-labels';

function readQueueCount(): number {
  try {
    const raw = localStorage.getItem('he_widget_fallback_queue');
    if (!raw) return 0;
    const q = JSON.parse(raw) as unknown;
    return Array.isArray(q) ? q.length : 0;
  } catch {
    return 0;
  }
}

export const NativeOfflinePill: React.FC = () => {
  const [online, setOnline] = useState<boolean>(() => {
    try {
      return isOnline();
    } catch {
      return true;
    }
  });
  const [queued, setQueued] = useState<number>(() => readQueueCount());

  useEffect(() => {
    let off: (() => void) | undefined;
    try {
      off = watchOnline((v) => {
        setOnline(v);
        if (!v) setQueued(readQueueCount());
      });
    } catch {
      /* ignore */
    }
    const refresh = () => {
      try {
        if (!isOnline()) setQueued(readQueueCount());
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      try {
        off?.();
      } catch {
        /* ignore */
      }
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  if (online) return null;
  const en = getLocale() === 'en';
  const text = en ? 'Offline — data is saved locally' : 'Офлайн — данные сохраняются локально';
  const tail = queued > 0 ? (en ? ` · ⏳ ${queued} queued` : ` · ⏳ в очереди: ${queued}`) : '';
  return (
    <div className="native-offline" role="status" aria-label={text + tail}>
      <span aria-hidden="true">📴</span>
      <span>{text + tail}</span>
    </div>
  );
};
