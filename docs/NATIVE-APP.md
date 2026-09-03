# Нативное приложение (APK) + Telegram Mini App из одного кода

Один репозиторий, один `src/`, два артефакта:

| Артефакт | Что это | Откуда берётся |
|---|---|---|
| Telegram Mini App | `dist/`, открытый внутри Telegram | `npm run build` → Vercel (как сейчас, без изменений) |
| APK | тот же `dist/` в нативном WebView | `npm run build:native` → Capacitor → `android/` → Gradle/CI |

Любая доработка в `src/` автоматически попадает **в обе версии** следующим билдом.
Различия версий — только через platform-слой (§3), форков кода нет.

## 1. Без Studio получится такое же приложение?

Да. Android Studio для сборки **не нужна**. Studio — это IDE (редактор + эмулятор
+ визуальный отладчик). Сама сборка — это Gradle (`./gradlew assembleDebug`),
он одинаково работает локально в терминале и в GitHub Actions. CI собирает
байт-в-байт такое же полноценное APK: те же 12 Capacitor-плагинов, тот же `dist/`.
Studio понадобится, только если захотите гонять эмулятор или копаться в нативном
слое руками.

## 2. Быстрый старт

```bash
npm ci
npm run build:native        # web-билд + npx cap sync android
```

APK без Studio — два пути:

**A. GitHub Actions (рекомендуется).**
Actions → `android-apk` → Run workflow (или push тега `v*`).
Артефакт `he-debug-apk` (`app-debug.apk`) — устанавливается на телефон напрямую
(разрешить «установку из неизвестных источников»). Ни JDK, ни SDK, ни Studio
на вашем ПК не нужны.

**B. Локально терминалом (без Studio).**
Нужны только JDK 21 + Android SDK command-line tools:

```bash
# разово: поставить platform-tools, platforms;android-35, build-tools;35.0.0
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## 3. Как устроены отличия версий (platform-слой)

Три файла ядра, всё остальное их потребляет:

- `src/core/app-platform.ts` — детекция `telegram | native | web`.
  Порядок: Capacitor → строгий Telegram (непустой `initData`/`user`, а не просто
  наличие скрипта) → web. Плюс `getSyncIdentity()` и `getOrCreateDeviceId()`.
- `src/core/app-config.ts` — параметры версий. Общее в `BASE_CONFIG`,
  отличия только в `PLATFORM_OVERRIDES`. Код читает итог через `getAppConfig()`.
- `src/core/native-bridge.ts` — единый фасад нативных возможностей.
  Каждый метод безопасен везде: native → Capacitor, telegram → Telegram API,
  web → Web API, иначе graceful no-op. Telegram-ветки поведения не меняют.

Три способа развести версии (по нарастанию инвазивности):

**3.1. Параметр** — добавить поле в `AppConfig` + значение в `PLATFORM_OVERRIDES`:

```ts
// app-config.ts
features: { ..., coachExportPdf: true }
PLATFORM_OVERRIDES = {
  telegram: { features: { coachExportPdf: false } }, // в Mini App скрыть
  native: {},
  web: {},
};
// в коде: if (getAppConfig().features.coachExportPdf) { ... }
```

**3.2. Файл** — `Foo.telegram.tsx` / `Foo.native.tsx` + выбор без if'ов:

```tsx
import { resolvePlatformModule } from '@/core/app-config';
import { FooTelegram } from './Foo.telegram';
import { FooNative } from './Foo.native';
export const Foo = resolvePlatformModule({
  telegram: FooTelegram, native: FooNative, default: FooTelegram,
});
```

**3.3. Дизайн** — CSS под класс платформы (`applyPlatformAttributes()` ставит
`html.app-telegram / .app-native / .app-web`):

```css
html.app-native .my-block { /* только APK: расширенный PRO-дизайн */ }
html.app-telegram .my-block { /* только Mini App */ }
```

Готовый PRO-пресет APK уже задан в `src/styles.css` (`html.app-native`:
тёмно-синяя палитра, увеличенный nav). Telegram Mini App стилями не затронут.

## 4. Расширенный функционал APK (что уже встроено)

Все методы — `src/core/native-bridge.ts`:

| Возможность | APK (native) | Telegram / web |
|---|---|---|
| Хаптика `haptics()` | Capacitor Haptics | Telegram HapticFeedback → `navigator.vibrate` |
| Локальные уведомления `notifyLocal()` | LocalNotifications | ServiceWorker (`push-manager`) |
| Push с токеном `initNativePush(onToken)` | PushNotifications (FCM) | no-op (свои механики) |
| Шаринг `shareText()` | Capacitor Share | `navigator.share` → clipboard |
| Файлы `saveTextFile()` | Filesystem (Documents) + Share | скачивание `<a download>` |
| Фото `pickPhoto()` | камера/галерея (системный диалог) | `<input type=file>` |
| Устройство `getDeviceInfo()` | Device-плагин | userAgent-fallback |
| Кнопка «назад» | `setupNativeBackButton()` (подключена в `App.tsx`) | Telegram BackButton как раньше |
| Статус-бар/сплэш | `initNativeChrome()` (вызван в `main.tsx`) | no-op |
| Биометрия `authenticateWithBiometrics()` | WebAuthn platform authenticator | там же, где доступен |

Что сознательно отключено в APK (`main.tsx`): PWA-баннер и ServiceWorker —
в Capacitor WebView за сплэш/статус/пуши отвечают нативные плагины, SW там
ненадёжен. На Telegram-ветку это не влияет.

Офлайн: движки уже локальные (IndexedDB/localStorage), `watchOnline()`/`isOnline()`
из моста + очередь `sync-queue`/`processQueue()` продолжают работать; в APK к ним
добавляется нативный Network-статус при необходимости.

## 5. Auth и синк в APK

- Входа через Telegram в APK нет (неоткуда взять `initData`) — работает
  существующий fallback `auth-module.ts`: локальный профиль в IndexedDB.
- `getSyncIdentity()` отдаёт `tg_<id>` в Mini App и стабильный `dev_<uuid>`
  (`he_device_id_v1`) в APK.
- `cloud-kv.initKvSync()` намеренно не менялся: с `tg_*` работает как раньше,
  с `dev_*` переходит в `off` (локальный режим, без ошибок). Серверная поддержка
  device-токенов (`user_kv` RLS под device id) — следующий шаг на бэкенде,
  клиент к нему уже готов.

## 6. Push (FCM) — что доделать для рассылок

Уже готово: запрос прав, регистрация, `onToken` в `initNativePush()`.
Осталось (только когда понадобятся серверные рассылки):

1. Firebase-проект → `google-services.json` положить в `android/app/`
   (в git не коммитить, для CI — секрет; сборка без него работает, пуши просто
   не инициализируются — в `build.gradle` уже есть guard).
2. Сохранять токен из `onToken` на своём бэкенде.
3. Отправлять через FCM HTTP v1. Локальные напоминания (`notifyLocal`)
   работают уже сейчас без всего этого.

## 7. Подпись release и публикация

Debug-APK из CI ставится на устройство сразу. Для RuStore/Google Play нужен
подписанный release:

```bash
# разово: создать keystore (хранить ВНЕ репозитория!)
keytool -genkeypair -v -keystore he-release.keystore -alias he -keyalg RSA -keysize 2048 -validity 10000
```

Секреты репозитория (Settings → Secrets → Actions):
`ANDROID_KEYSTORE_BASE64` (base64 файла), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Когда keystore будет готов —
скажите, добавлю release-шаги в workflow (приёмная сторона уже есть:
`android/app/build.gradle` читает `android/keystore.properties`, которого нет
в git; текущий workflow собирает только debug и секретов не касается).

Перед публикацией: поднять `versionCode`/`versionName` в `android/app/build.gradle`,
проверить `applicationId` (`com.healthengine.app`), иконку (`android/app/src/main/res`),
разрешения (камера/уведомления уже задекларированы плагинами), privacy policy.

## 8. Проверка, что Telegram-версия не сломалась

- `npm run dev` в обычном браузере → платформа `web`;
- открыть через Telegram → платформа `telegram`, поведение 1-в-1;
- принудительно: `VITE_APP_PLATFORM=telegram npm run dev` / `=native` / `=web`.
- Тесты: `npx vitest run src/core/__tests__/app-platform.test.ts` (14 шт.).
- `main.tsx`/`App.tsx` правки аддитивные: новые ветки выполняются только при
  `platform === 'native'`; TG BackButton, viewport, auth, синк — без изменений.

## 9. Файлы, добавленные этим раундом

- `capacitor.config.ts` — appId `com.healthengine.app`, `webDir: dist`, пресеты плагинов;
- `android/` — сгенерирован `npx cap add android` (12 плагинов), плюс ручная правка
  `android/app/build.gradle` (подпись через `keystore.properties`; повторить при
  пересоздании каталога);
- `src/core/app-platform.ts`, `src/core/app-config.ts`, `src/core/native-bridge.ts`;
- `src/core/__tests__/app-platform.test.ts`;
- `.github/workflows/android-apk.yml` — сборка debug/release без Studio;
- правки: `package.json` (скрипты `build:native`/`cap:*`), `src/main.tsx`
  (платформа + `initNativeChrome`, SW/PWA только для web), `src/App.tsx`
  (нативная кнопка «назад»), `src/styles.css` (`html.app-native` тема),
  `.gitignore` (секреты подписи, `*.apk/*.aab`).
