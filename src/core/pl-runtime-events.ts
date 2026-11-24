/**
 * pl-runtime-events.ts — единый сигнал «план отправлен в выполнение».
 *
 * ЗАЧЕМ. `storage`-событие браузер присылает только ДРУГИМ вкладкам. Поэтому
 * после `localStorage.setItem('he_pl_runtime', …)` в том же окне экран
 * тренировок и календарь держали старый план: плановый слой календаря оставался
 * пустым до смены месяца/перемонтирования, а плеер открывался на прошлом дне.
 *
 * КАК. Продюсеры плана (`BbAutoConstructor`, `ProgramEditorView`,
 * `SRCBBScreen`, `PLPlanView`) после успешной записи зовут
 * `notifyPlRuntimeSaved()`. Потребители подписываются `onPlRuntimeSaved()` и
 * получают и своё событие этого окна, и `storage` из других вкладок — один
 * обработчик вместо двух подписок в каждом экране.
 */
import { isIsoDate, localIsoDate } from './local-date';

export const PL_RUNTIME_KEY = 'he_pl_runtime';
export const PL_RUNTIME_EVENT = 'he-pl-runtime-updated';

/** Минимум, который нужен потребителям записи плана. */
export interface PlRuntimeLike {
  days?: unknown;
  startDate?: unknown;
  track?: unknown;
}

/** Текущий `he_pl_runtime` (null — нет записи или она битая). */
export function readPlRuntime(): PlRuntimeLike | null {
  try {
    const raw = localStorage.getItem(PL_RUNTIME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as PlRuntimeLike) : null;
  } catch {
    return null;
  }
}

/**
 * Якорь для перезаписи `he_pl_runtime`.
 *
 * ЗАЧЕМ. Экран-конструктор (`SRCBBScreen`) зеркалит собранный план в
 * `he_pl_runtime` при каждом монтировании/перерисовке. Если писать туда
 * `startDate = сегодня` безусловно, то любой проход по конструктору сдвигал
 * старт уже отправленного плана: плеер снова открывался на первом дне,
 * календарь уезжал вперёд, а фаза `pattern` переключалась.
 *
 * КАК. Тот же массив дней — сохраняем прежний якорь; другой план (новый набор
 * дней) — новый якорь «сегодня».
 */
export function anchorForWrite(prev: PlRuntimeLike | null | undefined, nextDays: unknown): string {
  const fallback = localIsoDate();
  const prevStart = typeof prev?.startDate === 'string' ? prev.startDate.slice(0, 10) : '';
  if (!isIsoDate(prevStart)) return fallback;
  try {
    return JSON.stringify(prev?.days) === JSON.stringify(nextDays) ? prevStart : fallback;
  } catch {
    return fallback;
  }
}

/** Сообщить подписчикам этого окна, что `he_pl_runtime` перезаписан. */
export function notifyPlRuntimeSaved(): void {
  try {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(PL_RUNTIME_EVENT));
  } catch {
    /* среда без window (SSR/тест) — сигнал не нужен */
  }
}

/**
 * Подписка на изменение `he_pl_runtime`: событие этого окна и `storage` из
 * других вкладок (`key === null` — `localStorage.clear()`). Возвращает отписку.
 */
export function onPlRuntimeSaved(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PL_RUNTIME_KEY && event.key !== null) return;
    handler();
  };
  window.addEventListener(PL_RUNTIME_EVENT, handler);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PL_RUNTIME_EVENT, handler);
    window.removeEventListener('storage', onStorage);
  };
}
