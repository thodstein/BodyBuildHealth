/** useIsMobile — адаптивный хук для мобильной оптимизации тренировочного блока.
 * true на узких экранах (< 480px). Используется для сворачивания широких grid
 * (6-8 колонок → 2-3) и переключения плотных таблиц в горизонтальный скролл. */
import { useState, useEffect } from 'react';

export function useIsMobile(breakpoint = 480): boolean {
  const get = () => typeof window !== 'undefined' && window.innerWidth <= breakpoint;
  const [isMobile, setIsMobile] = useState<boolean>(get);
  useEffect(() => {
    const onResize = () => setIsMobile(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}