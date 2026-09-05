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
  const en = getLocale() === 'en';
  const text = en ? 'Offline — data is saved locally' : 'Офлайн — данные сохраняются локально';
  return (
    <div className="native-offline" role="status" aria-label={text}>
      <span aria-hidden="true">📴</span>
      <span>{text}</span>
    </div>
  );
};
