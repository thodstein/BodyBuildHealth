/**
 * NativeFab.tsx — FAB быстрой записи. ТОЛЬКО APK (монтируется в App.tsx
 * внутри isNativeApp()-ветки). Telegram/web этот модуль не импортируют.
 *
 * Одно действие: «＋» → дневник тренинга (быстрый лог). Hero и таб-бар
 * не меняются; свайпы хук useSwipeTabs игнорирует (кнопка — fixed-оверлей).
 */

import React from 'react';
import { haptics } from '../../core/native-bridge';

interface Props {
  /** Куда ведёт FAB: по умолчанию — дневник тренинга. */
  onQuickLog?: () => void;
  /** Скрыть (экран блокировки, незавершённый boot). */
  hidden?: boolean;
  /** Доступная подпись для TalkBack. */
  label?: string;
}

export const NativeFab: React.FC<Props> = ({
  onQuickLog,
  hidden = false,
  label = 'Быстрая запись тренировки',
}) => {
  if (hidden) return null;
  const press = () => {
    try {
      void haptics('medium');
    } catch {
      /* ignore */
    }
    try {
      onQuickLog?.();
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      type="button"
      className="native-fab"
      aria-label={label}
      title={label}
      onClick={press}
    >
      <span aria-hidden="true">＋</span>
    </button>
  );
};
