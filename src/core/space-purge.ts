/**
 * space-purge.ts — «удалил данные атлета» обязано означать удаление везде.
 *
 * Локальная очистка (ключи, черновики, базы IndexedDB) живёт в `data-space` и
 * `data-backup`, а облачная копия — в синхронизации (`cloud-kv`). Статически
 * тянуть `cloud-kv` к экрану профиля нельзя: он подключает supabase-js.
 * Поэтому здесь крошечный канал без зависимостей: синхронизация при старте
 * регистрирует обработчик, а удаление просит «убери эти пространства из облака».
 *
 * Если синхронизация не запущена (локальный режим, нет токена, выключен вход) —
 * обработчика нет, и запрос ничего не делает. Локальное удаление от этого не
 * зависит: оно уже выполнено к этому моменту.
 */
export type SpacePurgeHandler = (spaceIds: readonly string[]) => Promise<void> | void;

let handler: SpacePurgeHandler | null = null;

export function setSpacePurgeHandler(next: SpacePurgeHandler | null): void {
  handler = next;
}

/**
 * Попросить убрать пространства из облака. Никогда не бросает и не ждёт:
 * удаление не должно «висеть» из-за сети. Ошибку облака показывать нечем —
 * локальных данных уже нет, а повтор произойдёт при следующем удалении/синке.
 */
export function requestSpacePurge(spaceIds: readonly string[]): void {
  const ids = (spaceIds || []).filter(id => !!id);
  if (!handler || !ids.length) return;
  try {
    void Promise.resolve(handler(ids)).catch(() => undefined);
  } catch {
    /* обработчик упал синхронно — на локальное удаление это не влияет */
  }
}

/** Зарегистрирован ли обработчик (диагностика и тесты). */
export function hasSpacePurgeHandler(): boolean {
  return handler !== null;
}
