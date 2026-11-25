/**
 * profile-events.ts — единый event-bus для уведомления о подписчиках изменений профиля.
 *
 * Подписки можно установить:
 * - onProfileSectionChange(section, handler) — срабатывает ТОЛЬКО при изменении секции
 * - onAnyProfileChange(handler) — срабатывает при ЛЮБОМ изменении профиля
 *
 * broadcast вызывается из `notifyAll()` в profile-manager — централизованно,
 * нет необходимости вызывать его из updateProfile/updateSection вручную.
 *
 * Этот модуль НЕ импортирует из profile-manager (избегаем circular deps).
 */

type ProfileEventHandler = (payload: { section: string; version: number }) => void;

const sectionListeners: Map<string, Set<ProfileEventHandler>> = new Map();
const allListeners: Set<() => void> = new Set();

/**
 * Подписка на изменение конкретной секции профиля.
 * Срабатывает когда sectionVersions[section] инкрементируется.
 */
export function onProfileSectionChange(section: string, handler: ProfileEventHandler): () => void {
  if (!sectionListeners.has(section)) sectionListeners.set(section, new Set());
  sectionListeners.get(section)!.add(handler);
  return () => {
    sectionListeners.get(section)?.delete(handler);
  };
}

/**
 * Подписка на ЛЮБОЕ изменение профиля.
 * Срабатывает на каждом updateProfile/updateSection.
 */
export function onAnyProfileChange(handler: () => void): () => void {
  allListeners.add(handler);
  return () => { allListeners.delete(handler); };
}

/**
 * Рассылает события подписчикам. Вызывается централизованно из notifyAll().
 * @param changedSections список изменённых секций (если известен).
 */
export function broadcastProfileChange(changedSections?: string[]): void {
  // version — текущее время; используется только для идентификации события.
  const version = Date.now();
  // Уведомляем слушателей конкретных секций
  if (changedSections && changedSections.length > 0) {
    for (const sec of changedSections) {
      const set = sectionListeners.get(sec);
      if (set) set.forEach(h => { try { h({ section: sec, version }); } catch {} });
    }
  }
  // Универсальное уведомление
  allListeners.forEach(h => { try { h(); } catch {} });
}

/** Ключ, под которым живёт профиль (`he_profile_v2` и его варианты). */
const PROFILE_STORAGE_PREFIX = 'he_profile';

/**
 * Подписка на изменение профиля, включая ДРУГИЕ вкладки/окна.
 *
 * `broadcastProfileChange` живёт в памяти окна, поэтому вкладка, которая сама
 * ничего не записывала, о правке профиля не узнает — а `storage` в окно-писатель
 * не приходит. Нужны оба источника. Свой хендлер в каждом экране — то, из-за
 * чего календарь держал даты по старому графику: делаем это здесь, один раз.
 */
export function onAnyProfileChangeCrossTab(handler: () => void): () => void {
  const offBus = onAnyProfileChange(handler);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.includes(PROFILE_STORAGE_PREFIX)) handler();
  };
  try {
    window.addEventListener('storage', onStorage);
  } catch {
    /* не браузерное окружение — остаётся подписка на шину */
  }
  return () => {
    offBus();
    try {
      window.removeEventListener('storage', onStorage);
    } catch {
      /* ignore */
    }
  };
}

/**
 * Получить количество активных подписчиков (для тестов и отладки).
 */
export function _getListenerCount(): { section: Record<string, number>; all: number } {
  const section: Record<string, number> = {};
  sectionListeners.forEach((set, key) => { section[key] = set.size; });
  return { section, all: allListeners.size };
}
