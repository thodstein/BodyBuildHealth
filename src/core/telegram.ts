export function initTelegramWebApp() {
  if (typeof window === 'undefined' || !(window as any).Telegram?.WebApp) return;

  const tg = (window as any).Telegram.WebApp;

  tg.ready?.();

  tg.expand?.();

  tg.setBackgroundColor?.('#000000');
  tg.setHeaderColor?.('#000000');
  tg.setBottomBarColor?.('#000000');
  tg.setSecondaryButtonColor?.('#00ff88');
  // AGENTS.md: enableVerticalSwipes на Android перехватывает touch (детектор свайпа
  // «закрыть свайпом») — на части версий Telegram кнопки перестают реагировать.
  // Включаем только по явному opt-in (he_tg_swipes=1).
  try {
    if (localStorage.getItem('he_tg_swipes') === '1') tg.enableVerticalSwipes?.();
  } catch { /* no-op */ }

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

/** Пере-расширение WebView после закрытия клавиатуры (AGENTS.md: на Android
 * после ввода в input WebView не возвращает полную высоту → нижняя зона экрана
 * перестаёт реагировать на тапы; паттерн как в resumeTelegramViewport). */
export function onKeyboardClose(cb: () => void): () => void {
  const tg = (window as any).Telegram?.WebApp;
  const reexpand = () => {
    try {
      tg?.ready?.();
      tg?.expand?.();
      tg?.viewportStable?.();
      if (typeof cb === 'function') cb();
    } catch { /* no-op */ }
  };
  const isOpen = () => {
    try { return document.activeElement && /input|textarea|select/i.test(document.activeElement.tagName); } catch { return false; }
  };
  const onFocusOut = () => {
    if (!isOpen()) setTimeout(reexpand, 150);
  };
  const onFocusIn = () => { try { tg?.expand?.(); } catch { /* no-op */ } };
  document.addEventListener('focusout', onFocusOut);
  document.addEventListener('focusin', onFocusIn);
  const onResize = () => {
    try { if (!isOpen() && window.innerHeight > 0) setTimeout(reexpand, 100); } catch { /* no-op */ }
  };
  window.addEventListener('resize', onResize);
  return () => {
    document.removeEventListener('focusout', onFocusOut);
    document.removeEventListener('focusin', onFocusIn);
    window.removeEventListener('resize', onResize);
  };
}

