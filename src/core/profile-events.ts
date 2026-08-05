/**
 * profile-events.ts — единый event-bus для уведомления о подписчиках изменений профиля.
 *
 * Подписки можно установить:
 * - onProfileSectionChange(section, handler) — срабатывает ТОЛЬКО при изменении секции
 * - onAnyProfileChange(handler) — срабатывает при ЛЮБОМ изменении профиля
 *
 * broadcast вызывается из `notifyAll()` в profile-manager — централизованно,
 * нет необходимости вызывать его из updateProfile/updateSection вручную.
 */
import { getProfileVersion } from './profile-manager';

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
  const version = getProfileVersion();
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

/**
 * Получить количество активных подписчиков (для тестов и отладки).
 */
export function _getListenerCount(): { section: Record<string, number>; all: number } {
  const section: Record<string, number> = {};
  sectionListeners.forEach((set, key) => { section[key] = set.size; });
  return { section, all: allListeners.size };
}
