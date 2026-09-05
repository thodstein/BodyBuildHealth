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

## 12. TOP-оформление APK (hero остаются, TG 1-в-1)

Инварианты раунда (проверяются тестом `apk-top-pack.test.tsx`):

- **Hero не тронуты**: все `<img>` (`hero-main`, `articles-hero`,
  `risk-hero`…) и TG-ветка `DashboardScreen` — без изменений; меняется
  только подача поверх (shade, пилюли, FAB). CSS-тест гарантирует отсутствие
  `display:none` на hero-селекторах.
- **TG 1-в-1**: каждый селектор `styles-native.css` / `styles-native-pro.css`
  начинается с `html.app-native` (тест падает иначе); правки `App.tsx` /
  `main.tsx` — аддитивные и за `isNativeApp()`-гейтом.

Что вошло:

- **Токены** (`styles-native.css §58`): шкала типов display→caption,
  спейсинги, press-scale, FAB/badge/focus-переменные. Расхождений палитры
  с `colors.xml` больше нет (navy `#050b16`/`#0a1424`, лайм `#c9f73a`).
- **Подложка**: `bg-profile.png` в APK — `cover` + `opacity 0.22`
  (CSS-оверрайд; в TG остался `fill` как был).
- **Навбар**: 7 табов сохранены (паритет с TG — «5+Ещё» отклонено именно
  ради него); премиум за счёт active-пилюли, `data-tab`/`aria-current`,
  бейдж-точек (`data-badge`, workflows выставляют позже), компакта ≤380px.
- **FAB** (`ui/native/NativeFab.tsx`): «＋» → дневник тренинга + haptic
  medium; свайпы его игнорируют (fixed-оверлей в `useSwipeTabs`).
- **Темы** (`ui/native/appearance.ts`, ключ `he_apk_theme_v1`): dark
  (дефолт), amoled (`#000`), light. Применение — `initApkAppearance()`
  в `main.tsx` (в TG no-op). UI-переключатель — следующим шагом в Профиле.
- **Нативный хром**: `StatusBar overlaysWebView` (API 35+ edge-to-edge,
  safe-area уже в CSS), SplashScreen API 31+ (фон/иконка/600мс,
  fallback — старый `@drawable/splash`), светлые иконки баров.
- **Виджеты**: фон/кнопка в токенах (`#0A1424`/`#0F2417`); App Shortcuts
  (тренировка/питание/таймер → тот же `WIDGET_OPEN`-интент, что у виджетов);
  именованные каналы уведомлений (тренировки/вода/таймер) в `MainActivity`.
- **Perf**: preload `hero-main.png`; скелетон-shimmer, тосты над пилюлей,
  планшетный центр ≤600px (hero остаётся fullscreen).

Волна 2 — остатки закрыты (тест `apk-top-pack` 9/9, `tsc` 0, `vite build` OK,
native-CSS — отдельными чанками `styles-native-*.css`, в TG-старт не грузятся):

- **Hero WebP**: `scripts/sync-hero-webp.mjs` (`npm run sync-hero-webp`, без новых
  зависимостей — `@napi-rs/canvas`): PNG 1.2–2МБ → WebP 6–15% (hero-main 14%,
  bg-profile 10%); компонент `ui/HeroImg.tsx` (`picture` + `display:contents` —
  селекторы `… img`, классы и тесты экранов не меняются) вшит в 10 точек
  (Dashboard TG+APK, тренинг, фарма, риски, статьи, профиль, питание, анализы,
  фон App); preload в `index.html` — на WebP. `support-hero.jpg` сознательно
  оставлен JPG: замеры показали WebP больше (197КБ → 246КБ), скрипт такие
  случаи пропускает сам.
- **Переключатель темы**: `ui/native/AppearanceSetupCard.tsx` в Профиле
  §4.4 (тёмная/AMOLED/светлая + 5 акцентов, применяется мгновенно).
- **Dynamic color**: слой var-изирован (`--accent/--accent-2/--accent-rgb…`,
  hex остался только в 3 определениях — тест следит); палитры
  lime/mint/sky/violet/amber (§59). Системная палитра Material You без
  нативного плагина из WebView недоступна — пользовательский акцент её
  закрывает; инлайн-TSX мелочи (NativeEmpty SVG, экран AppLock) акцент
  не подхватывают (честный остаток, ~5 строк).
- **Живые бейджи**: `ui/native/nav-badges.ts` + `data-badge` в `App.tsx`
  (рекомпут при смене таба/фокусе): красный дот на БАДах при критических
  взаимодействиях (`he_drug_warnings.highCount`, кап 99+). Точка расширения
  задокументирована в файле.
- **CSS-сплит**: `main.tsx` грузит `styles-native*.css` динамическим import
  до первого рендера только при `platform === 'native'` (FOUC нет —
  `createRoot` позже); TG/web — только `styles.css`.

Волна 3 — остатки волны 2 закрыты (`apk-top-pack` 13/13, `tsc` 0):

- **Инлайн-TSX под акцентом**: `NativeEmpty` (stroke/fill через CSS `var()`
  в `style` — SVG-атрибуты `var()` не понимают, статичный `DIM` остался
  атрибутом), кнопка `NativeAppLock` (`var(--accent-gradient)` +
  `var(--accent-contrast)`; в TG те же значения из `styles.css` — 1-в-1).
- **Material You из системы**: локальный плагин `DynamicColorPlugin.java`
  (`system_accent1/2/3_*` через `getIdentifier` — без compile-зависимостей,
  ниже Android 12 → `{available:false}`) + `ui/native/dynamic-color.ts`
  (вне APK всегда null) + выбор «Системный» в карточке оформления
  (палитра кэшируется в `he_apk_system_hex_v1` для boot без опроса ОС,
  контраст текста — по luminance). Недоступность объясняется честным
  сообщением, прежний акцент сохраняется.

Волна 4 — покрытие и валидация (`ui/__tests__` 17 файлов / 157 тестов, `tsc` 0):

- **Тест §4.4** (`profile-settings-apk.test.tsx`): в web/TG секции нет вообще;
  в APK (стаб `window.Capacitor`) — карточка оформления на месте, тема
  и акцент персистятся мгновенно. Аккордеон по умолчанию свёрнут — тест
  раскрывает его явно.
- **Бейдж №2 отклонён осознанно**: кандидат (`labs_overdue`) требует сборки
  `NotificationState` (fullPanel + фаза) — дорого для точки навбара и врёт
  без активной фазы. Остаётся один драйвер interactions.
- **`cap sync` проверен**: отрабатывает без ошибок с новым конфигом
  (`overlaysWebView`), WebP доезжают в `android/assets` (директория в
  `.gitignore` — CI регенерирует, в коммит не тянем).

Волна 5 — уровень флагманов (Strava/NTC/Strong): kit внедрён в поверхности,
иконки/уведомления починены (`ui/__tests__` 17/157 + точечные 31/31, `tsc` 0):

- **Entrance-анимация**: `native-fade-up` на rail/grid/last в `DashboardNative`
  и на карточках hero-хабов (тренинг/риски/фарма) — аддитивные классы,
  TG 1-в-1 (стили только под `html.app-native`).
- **Баг уведомлений**: `capacitor.config` ссылался на несуществующий
  `ic_stat_icon_default` — создан белый вектор-ринг; пуши больше не могут
  молча не показаться.
- **Themed icons** (Android 13+): `ic_launcher_monochrome` (силуэт 1-в-1
  с foreground-глифом) подключён в оба `mipmap-anydpi-v26`; сплэш получил
  `windowSplashScreenIconBackgroundColor`. XML проверены парсером
  (SDK локально нет — финальная сборка за CI).

Волна 6 — флагманские мелочи (`tsc` 0 по своим; единственные ошибки проекта —
чужой незакоммиченный `arm-longevity.engine.ts`, не тронут):

- **Predictive back** (Android 14+): `android:enableOnBackInvokedCallback`
  в манифесте — старые версии игнорируют, жестовый возврат анимируется.
- **First-run Главной**: нулевая история → `NativeEmpty`-карточка «Первая
  тренировка ждёт» с CTA в тренинг (исчезает после первой сессии, остальное
  без изменений; тест `dashboard-first-run` 2/2).
- **Хаптика оформления**: лёгкий отклик на выбор темы/акцента.

Волна 7 — живые детали (`apk-top-pack` 14/14 + §4.4 3/3, `tsc` 0 по своим;
параллельные WIP `arm-longevity`/`mountain_dog` чужие, не тронуты):

- **FAB speed-dial**: тап раскрывает 💧 +250 мл (в очередь виджета через
  `queueWaterMl` + тост-подтверждение, разберётся на Главной) и 🏋️ дневник;
  плюс поворачивается в крестик, `aria-expanded`, хаптика light/medium.
- **Статус-бар за темой**: светлая — бумага + тёмные иконки, AMOLED —
  чёрный, тёмная — navy (тест проверяет аргументы `initNativeChrome`).

Осознанные остатки (не баги): бейдж-драйверы кроме interactions;
Gradle-сборка Java-слоя — только CI (локально нет SDK).
