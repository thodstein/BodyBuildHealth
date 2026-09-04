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
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Release-шаги уже в workflow
(`android-apk.yml` job `release`: keystore из секретов → `keystore.properties`
→ `bundleRelease` + `assembleRelease`, артефакты `he-release-aab`/`he-release-apk`;
без секретов job пропускается, debug не страдает; приёмная сторона:
`android/app/build.gradle` читает `android/keystore.properties`, которого нет
в git).

Версии: `package.json` (3.0.0) и `android/app/build.gradle`
(`versionCode 2` / `versionName "3.0.0"`) сведены; дальше поднимать парой.
PRO-палитра натива: `android/.../res/values/colors.xml` 1-в-1 с токенами
`styles-native.css` + `capacitor.config.ts` (#0a1628/#050b16).

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

## 10. Виджеты рабочего стола (только APK)

В Telegram Mini App виджетов нет и быть не может (ограничение Telegram).
В APK — 4 нативных виджета (`android/app/src/main/java/com/healthengine/app/widgets/`):

| Виджет | Что показывает | Работает без открытия приложения |
|---|---|---|
| HE · Тренировка | последняя сессия, тоннаж, счётчик недели | нет (тап открывает Тренинг) |
| HE · Таймер | таймер отдыха, пресеты 0:30/1:00/1:30/3:00 | **да** (старт/пауза/сброс, тики через AlarmManager) |
| HE · Комплаенс | % выполнения (БАДы 7д или тренировки недели) | нет (тап открывает раздел) |
| HE · Питание | ккал/белок/вода дня, очередь | **частично** (вода +250/+500 пишет в очередь, еда — через дневник) |

Как это устроено:

- WebView и виджеты не видят общий localStorage → обмен через
  SharedPreferences `he_widgets` (`WidgetStore.java`).
- JS-мост `src/core/widget-bridge.ts` (безопасен везде, вне native —
  localStorage-фолбэк): `syncTrainingWidget` / `syncComplianceWidget` /
  `syncNutritionWidget` / `queueWaterMl` / `drainWidgetQueue` /
  `widgetTimerCommand` / `consumeWidgetLaunchTarget` / `requestPinWidget`.
- Сборка снапшотов и разбор очереди — `src/ui/native/widget-sync.ts`:
  тренировка из `workout-logger`, комплаенс из приверженности/недели,
  питание из `diary-storage-v2` + `he_water_log`; очередь применяется
  (`applyWidgetQueue`) при каждом входе на Главную.
- Тап по виджету открывает `MainActivity` с `WIDGET_OPEN`-intent →
  one-shot target в `WidgetStore` → JS забирает через `getLaunchTarget()`
  и ведёт в раздел (`DashboardScreen.native`).
- Таймер полностью автономный: состояние + `endAt` в `WidgetStore`,
  тики каждую секунду через `AlarmManager` (`setExactAndAllowWhileIdle`,
  permission `SCHEDULE_EXACT_ALARM`; без гранта тикает неточно, но
  самокорректируется по `endAt`).

Как установить (для пользователя):

1. Главная → «Телефон · APK» → «Виджеты» → «📌 На стол»
   (системный диалог закрепления, Android 8+). Если лаунчер не поддерживает —
2. вручную: долгое нажатие по пустому месту стола → «Виджеты» →
   «Health Engine» → перетащить нужный.
3. Данные подтягиваются при каждом открытии Главной; кнопка
   «🔄 Обновить данные виджетов» — принудительно.

## 11. Биометрия и другие функции (как включить)

Всё включается из APK: Главная → «Телефон · APK». В Telegram эти карточки
не отображаются.

**Биометрия** (`BiometrySetupCard`, механика `native-bridge.ts`,
без новых native-зависимостей — WebAuthn platform authenticator):

1. Сначала в самом Android: Настройки → Безопасность → Блокировка экрана
   (PIN/пароль) → добавить отпечаток или лицо.
2. В приложении: «🔐 Биометрия» → «Включить вход по биометрии» →
   подтвердить отпечатком (первый вызов регистрирует ключ
   `he_webauthn_cred_v1`, дальше — проверка им).
3. Опционально: «🔒 Блок входа» — приложение показывает экран
   разблокировки при запуске и при возврате из фона (`App.tsx`,
   только native; если биометрия стала недоступна — вход не блокируется).
4. «Проверить» — тест без изменения настроек; «Выключить» — удаляет ключ.

**Остальное** (`NativeFeaturesCard`, все методы уже были в `native-bridge.ts`):

- Уведомления: кнопка «Проверить» шлёт тестовое через `notifyLocal()`
  (там же запрашивается разрешение). Нет пуша — Настройки Android →
  Приложения → Health Engine → Уведомления. Серверные FCM-рассылки —
  по §6 (нужен `google-services.json` + бэкенд).
- Камера/галерея: кнопка «Проверить» открывает системный диалог
  `pickPhoto()` (камера/галерея). Используется в дневниках (фото тела,
  чеков, анализов).
- Шаринг: кнопка «Проверить» открывает системный диалог `shareText()`;
  файлы (`saveTextFile`) уходят через Filesystem + Share.

Что НЕ требует включения: хаптика, статус-бар/сплэш, кнопка «назад»,
офлайн-режим — работают из коробки в APK.
