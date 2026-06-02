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