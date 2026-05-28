export const tgSDK = {
  init() {
    if (!window.Telegram?.WebApp) return false;
    window.Telegram.WebApp.ready?.();
    window.Telegram.WebApp.expand?.();
    this.syncTheme();
    return true;
  },
  syncTheme() {
    if (!window.Telegram?.WebApp?.themeParams) return;
    const r = document.documentElement;
    const p = window.Telegram.WebApp.themeParams;
    if (p.bg_color) r.style.setProperty('--bg', p.bg_color);
    if (p.text_color) r.style.setProperty('--text', p.text_color);
    if (p.button_color) r.style.setProperty('--btn', p.button_color);
  },
  showMain(text: string, fn: () => void) {
    if (!window.Telegram?.WebApp?.MainButton) return;
    window.Telegram.WebApp.MainButton.setText(text);
    window.Telegram.WebApp.MainButton.show();
    window.Telegram.WebApp.MainButton.offClick?.();
    window.Telegram.WebApp.MainButton.onClick?.(fn);
  },
  close() {
    window.Telegram?.WebApp?.close?.();
  }
};