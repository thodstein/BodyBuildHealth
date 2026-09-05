/**
 * NativeOfflinePill.tsx — пилюля «нет сети». ТОЛЬКО APK (монтируется в
 * App.tsx внутри isNativeApp()-ветки). Telegram/web модуль не импортируют.
 *
 * Офлайн движки локальные, очередь синка (`sync-queue`) доберёт позже —
 * пилюля лишь честно объясняет, почему виджеты/облако молчат.
 */

import React, { useEffect, useState } from 'react';
import { isOnline, watchOnline } from '../../core/native-bridge';

export const NativeOfflinePill: React.FC = () => {
  const [online, setOnline] = useState<boolean>(() => {
    try {
      return isOnline();
    } catch {
      return true;
    }
  });

  useEffect(() => {
    let off: (() => void) | undefined;
    try {
      off = watchOnline(setOnline);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        off?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  if (online) return null;
  return (
    <div className="native-offline" role="status" aria-label="Нет подключения к сети">
      <span aria-hidden="true">📴</span>
      <span>Офлайн — данные сохраняются локально</span>
    </div>
  );
};
