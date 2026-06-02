/// <reference types="vite/client" />

interface Window {
  Telegram: {
    WebApp: {
      ready: () => void;
      expand: () => void;
      close: () => void;
      themeParams?: Record<string, string>;
      MainButton?: {
        show: () => void;
        hide: () => void;
        setText: (text: string) => void;
        onClick: (callback: () => void) => void;
        offClick: () => void;
      };
      BackButton?: {
        show: () => void;
        hide: () => void;
        onClick: (callback: () => void) => void;
        offClick: () => void;
      };
      initDataUnsafe?: {
        query_id?: string;
        user?: { id: number; first_name: string; last_name?: string; username?: string };
      };
    };
  };
}