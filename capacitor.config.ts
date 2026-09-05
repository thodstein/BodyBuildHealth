import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor-обёртка для APK.
 * Web-актив общий: webDir = dist (тот же билд, что уезжает в Telegram Mini App / Vercel).
 * Ничего платформозависимого в конфиге движка нет — отличия версий живут
 * в src/core/app-config.ts + src/core/native-bridge.ts.
 */
const config: CapacitorConfig = {
  appId: 'com.healthengine.app',
  appName: 'Health Engine',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#050b16',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#050b16',
      // API 35+ принудительно edge-to-edge: контент идёт под системные бары,
      // отступы закрывают safe-area в styles-native(-pro).css. На старых API
      // поведение прежнее — плашка фирменного navy.
      overlaysWebView: true,
    },
    Keyboard: {
      // WebView не схлопывается под клавиатуру (проблема известна по TG WebView).
      resize: 'body',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_default',
      iconColor: '#00e68a',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LiveUpdate: {
      // Self-hosted OTA без облаков: бандлы тянем из GitHub Releases
      // (см. docs/NATIVE-APP.md §12). appId для self-hosted не нужен.
      // readyTimeout + ready() в main.tsx = авто-откат на встроенный dist,
      // если новый бандл не загрузился за 10с.
      readyTimeout: 10000,
      autoDeleteBundles: true,
    },
  },
};

export default config;
