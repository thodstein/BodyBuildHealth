/**
 * space-return.ts — куда вернуть пользователя после перезагрузки при смене
 * пространства данных (режим тренера).
 *
 * Переключение атлета — это `location.reload()`: в памяти остались бы данные
 * прежнего человека. Но после перезагрузки приложение открывалось на главной, и
 * тренер заново искал профиль атлета — то есть каждый вход начинался с потери
 * места. Лучшие приложения возвращают туда, где человек был.
 *
 * Почему не «запоминать вкладку на каждой смене экрана»: тогда обычная
 * перезагрузка (или холодный старт через день) открывала бы вчерашний экран —
 * это уже не возврат, а сюрприз. Поэтому экран запоминается ровно в момент
 * перезагрузки и живёт две минуты: смена пространства — да, вчерашний экран —
 * нет. Ключ данные устройства (`he_data_space_*`), к атлетам не относится и в
 * облако не уезжает.
 */

/** `he_data_space_*` — префикс данных устройства, синк его не трогает. */
export const SPACE_RETURN_KEY = 'he_data_space_return_v1';

/** Дольше этого возврат не считается «тем же действием». */
export const SPACE_RETURN_MAX_AGE_MS = 2 * 60 * 1000;

export interface SpaceReturnTarget {
  tab: string;
  subTab: string | null;
}

interface StoredTarget extends SpaceReturnTarget {
  at: number;
}

/**
 * Текущий экран, каким его видит App. Не пишется в хранилище на каждой смене
 * вкладки — только сохраняется в памяти, чтобы взять его в момент перезагрузки.
 */
let currentScreen: SpaceReturnTarget | null = null;

/** App сообщает текущий экран (вызывается при смене вкладки). */
export function rememberScreen(tab: string, subTab: string | null): void {
  currentScreen = { tab, subTab: subTab ?? null };
}

/**
 * Перед `location.reload()`: запомнить, куда вернуться.
 * Ничего не пишет, если App ещё не сказал, где он (вызов из тестов, ранний
 * вызов) — лучше открыть главную, чем выдуманный экран.
 */
export function markSpaceReturn(now: number = Date.now()): void {
  const screen = currentScreen;
  if (!screen) return;
  const stored: StoredTarget = { tab: screen.tab, subTab: screen.subTab, at: now };
  try {
    localStorage.setItem(SPACE_RETURN_KEY, JSON.stringify(stored));
  } catch {
    /* приватный режим/переполнение — не повод падать при перезагрузке */
  }
}

/**
 * После загрузки: забрать точку возврата (один раз). Устаревшую или битую —
 * не отдаём и стираем, чтобы она не сработала через неделю.
 */
export function takeSpaceReturn(now: number = Date.now()): SpaceReturnTarget | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SPACE_RETURN_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    localStorage.removeItem(SPACE_RETURN_KEY);
  } catch {
    /* ignore */
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTarget> | null;
    if (!parsed || typeof parsed.tab !== 'string' || !parsed.tab) return null;
    const at = typeof parsed.at === 'number' ? parsed.at : 0;
    if (!at || now - at > SPACE_RETURN_MAX_AGE_MS) return null;
    // Время «из будущего» (часы переставили) — тоже не доверяем.
    if (at > now + 60000) return null;
    return {
      tab: parsed.tab,
      subTab: typeof parsed.subTab === 'string' && parsed.subTab ? parsed.subTab : null,
    };
  } catch {
    return null;
  }
}

/** Только для тестов: сбросить запомненный экран. */
export function _resetSpaceReturnCache(): void {
  currentScreen = null;
}

/**
 * Забрать точку возврата, но только если это НАСТОЯЩИЙ экран приложения.
 * Список вкладок передаёт App: модуль не должен знать про его разделы, а
 * выдуманный/устаревший id не должен открывать пустую вкладку.
 */
export function restoreScreen(knownTabs: readonly string[]): SpaceReturnTarget | null {
  const target = takeSpaceReturn();
  if (!target) return null;
  if (!knownTabs.includes(target.tab)) return null;
  return target;
}
