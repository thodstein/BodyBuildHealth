declare global {
  interface Window { Telegram: { WebApp: any }; }
}

export class TelegramSDK {
  private tg: any;
  private isReady: boolean = false;

  init(): boolean {
    if (!window.Telegram?.WebApp) {
      console.warn('Запущено вне Telegram Web App');
      return false;
    }
    this.tg = window.Telegram.WebApp;
    this.tg.ready();
    this.tg.expand();
    this.isReady = true;
    this.syncTheme();
    return true;
  }

  private syncTheme(): void {
    if (!this.tg) return;
    const root = document.documentElement;
    const params = this.tg.themeParams || {};
    root.style.setProperty('--tg-bg', params.bg_color || '#1c1c1e');
    root.style.setProperty('--tg-text', params.text_color || '#ffffff');
    root.style.setProperty('--tg-button', params.button_color || '#2481cc');
    root.style.setProperty('--tg-button-text', params.button_text_color || '#ffffff');
  }

  showMainButton(text: string, onClick: () => void): void {
    if (!this.isReady) return;
    this.tg.MainButton.setText(text);
    this.tg.MainButton.show();
    this.tg.MainButton.offClick();
    this.tg.MainButton.onClick(onClick);
  }

  hideMainButton(): void {
    if (!this.isReady) return;
    this.tg.MainButton.hide();
    this.tg.MainButton.offClick();
  }

  showBackButton(onClick: () => void): void {
    if (!this.isReady) return;
    this.tg.BackButton.show();
    this.tg.BackButton.onClick(onClick);
  }

  close(): void {
    this.tg?.close();
  }
}

export const tgSDK = new TelegramSDK();