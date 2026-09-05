/**
 * NativeFab.tsx — FAB speed-dial быстрой записи. ТОЛЬКО APK (монтируется
 * в App.tsx внутри isNativeApp()-ветки). Telegram/web модуль не импортируют.
 *
 * Тап по «＋» раскрывает два мини-действия: 💧 +250 мл (в очередь виджета —
 * разберётся при входе на Главную) и 🏋️ дневник тренинга. Свайпы хук
 * useSwipeTabs игнорирует (кнопка — fixed-оверлей).
 */

import React, { useState } from 'react';
import { haptics } from '../../core/native-bridge';
import { toastStore } from '../../core/toast';
import { getLocale } from '../../data/interactions-labels';

interface Props {
  /** Быстрый переход в дневник тренинга. */
  onQuickLog?: () => void;
  /** Скрыть (экран блокировки, незавершённый boot). */
  hidden?: boolean;
  /** Доступная подпись для TalkBack. */
  label?: string;
}

const WATER_ML = 250;

function strings() {
  if (getLocale() === 'en') {
    return {
      quickActions: 'Quick actions',
      logWater: 'Log 250 ml of water',
      logTraining: 'Quick training log',
      waterOk: (ml: number) => `💧 +${ml} ml — will count on Home`,
      waterFail: 'Could not log water',
    };
  }
  return {
    quickActions: 'Быстрые действия',
    logWater: 'Записать 250 мл воды',
    logTraining: 'Быстрая запись тренировки',
    waterOk: (ml: number) => `💧 +${ml} мл — учтём при входе на Главную`,
    waterFail: 'Не получилось записать воду',
  };
}

export const NativeFab: React.FC<Props> = ({ onQuickLog, hidden = false, label }) => {
  const [open, setOpen] = useState(false);
  const [busyWater, setBusyWater] = useState(false);
  if (hidden) return null;
  const T = strings();
  const mainLabel = label ?? T.quickActions;

  const toggle = () => {
    try {
      void haptics('light');
    } catch {
      /* ignore */
    }
    setOpen((v) => !v);
  };

  const quickTraining = () => {
    try {
      void haptics('medium');
    } catch {
      /* ignore */
    }
    setOpen(false);
    try {
      onQuickLog?.();
    } catch {
      /* ignore */
    }
  };

  const quickWater = async () => {
    try {
      void haptics('medium');
    } catch {
      /* ignore */
    }
    if (busyWater) return;
    setBusyWater(true);
    try {
      // Ленивый импорт: TG/web-бандл виджет-мост статически не тянет.
      const { queueWaterMl } = await import('../../core/widget-bridge');
      await queueWaterMl(WATER_ML);
      toastStore.success(T.waterOk(WATER_ML));
    } catch {
      toastStore.error(T.waterFail);
    } finally {
      setBusyWater(false);
      setOpen(false);
    }
  };

  return (
    <div className={'native-fab-wrap' + (open ? ' open' : '')}>
      {open && (
        <>
          <button
            type="button"
            className="native-fab-mini"
            aria-label={T.logWater}
            title="💧 +250 мл"
            disabled={busyWater}
            onClick={() => void quickWater()}
          >
            <span aria-hidden="true">💧</span>
          </button>
          <button
            type="button"
            className="native-fab-mini"
            aria-label={T.logTraining}
            title={T.logTraining}
            onClick={quickTraining}
          >
            <span aria-hidden="true">🏋️</span>
          </button>
        </>
      )}
      <button
        type="button"
        className="native-fab"
        aria-label={mainLabel}
        aria-expanded={open}
        title={mainLabel}
        onClick={toggle}
      >
        <span aria-hidden="true" className="native-fab-plus">
          ＋
        </span>
      </button>
    </div>
  );
};
