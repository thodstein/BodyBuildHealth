export function initTelegramWebApp() {
  if (typeof window === 'undefined' || !(window as any).Telegram?.WebApp) return;

  const tg = (window as any).Telegram.WebApp;

  tg.ready?.();

  tg.expand?.();

  tg.setBackgroundColor?.('#000000');
  tg.setHeaderColor?.('#000000');
  tg.setBottomBarColor?.('#000000');
  tg.setSecondaryButtonColor?.('#00ff88');
  tg.enableVerticalSwipes?.();

  // tg.MainButton?.setText('Сохранить');
  // tg.MainButton?.onClick(() => tg.close());
  // tg.MainButton?.show();

  (window as any).__TELEGRAM_THEME__ = tg.themeParams || {};
}
/** Haptic-фидбек (AGENTS.md: обязательно использовать). Безопасен вне Telegram. */
export type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
export type HapticNotify = 'success' | 'warning' | 'error';
export function hapticImpact(style: HapticStyle = 'light'): void {
  try { (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred(style); } catch { /* no-op */ }
}
export function hapticNotify(type: HapticNotify = 'success'): void {
  try { (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type); } catch { /* no-op */ }
}
export function hapticSelection(): void {
  try { (window as any).Telegram?.WebApp?.HapticFeedback?.selectionChanged(); } catch { /* no-op */ }
}
/** Подписка на viewportChanged (AGENTS.md: перерасчёт высоты при открытии клавиатуры). */
export function onViewportChanged(cb: (height: number) => void): () => void {
  const tg = (window as any).Telegram?.WebApp;
  if (!tg?.onEvent) return () => {};
  const handler = (e: any) => cb(tg.viewportHeight || window.innerHeight);
  try { tg.onEvent('viewportChanged', handler); } catch { /* no-op */ }
  return () => { try { tg.offEvent('viewportChanged', handler); } catch { /* no-op */ } };
}

