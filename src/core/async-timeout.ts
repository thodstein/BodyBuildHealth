/**
 * async-timeout.ts — «обещание не вечно».
 *
 * Зачем отдельный модуль: в APK часть вызовов идёт через Capacitor-мост
 * (`LiveUpdate.getCurrentBundle`, `Device.*`, `App.getInfo`). В редких случаях
 * мост не отвечает ВООБЩЕ — ни resolve, ни reject (плагин ещё не поднят,
 * WebView перезапущен, нативный вызов потерян). Любая цепочка, где такой вызов
 * стоит ДО показа результата, зависает навсегда: авто-проверка обновлений не
 * доходит ни до баннера, ни до тоста, ни до записи `lastCheck` — снаружи это
 * выглядит как «автообновление не работает».
 *
 * Правило проекта: каждый вызов плагина на пути к пользовательскому результату
 * оборачивается таймаутом, а не «надеждой, что ответит».
 */

/** Таймаут как отдельная ошибка: вызывающий может отличить его от сбоя плагина. */
export class TimeoutError extends Error {
  readonly ms: number;

  constructor(label: string, ms: number) {
    super(`${label}: timeout ${ms}ms`);
    this.name = 'TimeoutError';
    this.ms = ms;
  }
}

/**
 * Ждём `p` не дольше `ms`. Позже таймаута — reject с TimeoutError.
 *
 * Отклонение «проигравшего» промиса гасится: иначе, если `p` упадёт уже
 * после таймаута, браузер/Node получит unhandledrejection и запишет шум в
 * отчёты о крашах.
 */
export function withTimeout<T>(p: Promise<T>, ms: number, label = 'promise'): Promise<T> {
  // Гасим поздние отклонения: результат уже не нужен.
  try {
    p.catch(() => {
      /* no-op: гонка уже решена таймаутом */
    });
  } catch {
    /* не-промис в catch не превращается — ниже всё равно Promise.race */
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    try {
      if (timer) clearTimeout(timer);
    } catch {
      /* ignore */
    }
  });
}

/**
 * То же, но сбоем и таймаутом не бросаемся: отдаём `fallback`.
 * Для необязательных данных (версия OTA-бандла, инфо об устройстве):
 * без них проверка обновлений обязана продолжиться.
 */
export async function withTimeoutOr<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  try {
    return await withTimeout(p, ms);
  } catch {
    return fallback;
  }
}
