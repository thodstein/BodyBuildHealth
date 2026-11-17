import { useEffect, useState } from 'react';
import { localIsoDate } from './local-date';

/**
 * useTodayIso — «сегодня» (локальный календарь YYYY-MM-DD) как СОСТОЯНИЕ,
 * а не как вычисление в рендере.
 *
 * Зачем: приложение живёт открытым через полночь (а на телефоне сворачивается
 * на дни и возвращается). Если дату считать только в рендере, дневные экраны
 * остаются на вчерашней дате до перезапуска — отсюда жалобы «цифры не
 * обновляются каждый день». Хук пересчитывает дату по таймеру (раз в минуту),
 * при возврате фокуса и при смене видимости вкладки.
 *
 * Дату берём из `localIsoDate` (местные геттеры), НЕ через `toISOString()`:
 * в UTC+3…+12 UTC-дата вечером/утром отличается на сутки.
 */
export function useTodayIso(): string {
  const [today, setToday] = useState(() => localIsoDate());

  useEffect(() => {
    const sync = () => {
      const now = localIsoDate();
      setToday(prev => (prev === now ? prev : now));
    };
    sync();
    const id = window.setInterval(sync, 60_000);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  return today;
}
