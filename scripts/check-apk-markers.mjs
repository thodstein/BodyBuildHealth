// check-apk-markers.mjs — быстрый guard APK-оформления (без vitest).
// Ловит молчаливые откаты в shared-worktree (чужой checkout/revert):
// HeroImg-использования, CSS-изоляция, монтаж native-узлов, манифест.
// Запуск: `npm run verify:apk-design`. Падает (exit 1) со списком проблем.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const fails = [];

function mustContain(file, needle, label) {
  const p = join(root, file);
  if (!existsSync(p)) {
    fails.push(`MISS file ${file} (${label})`);
    return;
  }
  const text = readFileSync(p, 'utf-8');
  if (!text.includes(needle)) fails.push(`MISS ${label} in ${file}`);
}

function mustExist(file, label) {
  if (!existsSync(join(root, file))) fails.push(`MISS file ${file} (${label})`);
}

// 1. HeroImg в 10 точках (импорт + использование).
const heroSites = [
  'src/App.tsx',
  'src/ui/screens/DashboardScreen.tsx',
  'src/ui/screens/DashboardScreen.native.tsx',
  'src/ui/screens/TrainingScreen.tsx',
  'src/ui/screens/RiskScreen.tsx',
  'src/ui/screens/ArticlesScreen.tsx',
  'src/ui/screens/ProfileScreen_v2/ProfileHero.tsx',
  'src/ui/screens/PharmaScreen_parts/index.tsx',
  'src/ui/screens/NutritionScreen.tsx',
  'src/ui/screens/LabsScreen.tsx',
];
for (const f of heroSites) mustContain(f, '<HeroImg', `HeroImg usage ${f}`);

// 2. WebP-дериваты рядом с исходниками.
for (const w of [
  'hero-main.webp', 'training-hero.webp', 'pharma-hero.webp', 'risk-hero.webp',
  'articles-hero.webp', 'profile-hero.webp', 'nutrition-hero.webp',
  'lab-hero.webp', 'bg-profile.webp',
]) mustExist(`public/${w}`, `webp ${w}`);

// 3. CSS-изоляция: каждый селектор native-слоёв — только html.app-native.
for (const name of ['src/styles-native.css', 'src/styles-native-pro.css', 'src/styles-native-labs.css']) {
  const p = join(root, name);
  if (!existsSync(p)) {
    fails.push(`MISS file ${name}`);
    continue;
  }
  for (const rawLine of readFileSync(p, 'utf-8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('/*') || line.startsWith('*') || line.startsWith('//')) continue;
    if (!line.endsWith('{')) continue;
    const sel = line.slice(0, -1).trim();
    if (!sel || sel.startsWith('@') || sel.startsWith('from') || sel.startsWith('to')) continue;
    for (const part of sel.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!part.startsWith('html.app-native') && !part.startsWith('@')) {
        fails.push(`UNSCOPED ${part} in ${name}`);
      }
    }
  }
}

// 4. var-изация: hex только в определениях переменных.
{
  const css = readFileSync(join(root, 'src/styles-native.css'), 'utf-8');
  for (const l of css.split('\n')) {
    if (/#c9f73a|#00e68a/i.test(l) && !l.trimStart().startsWith('--accent')) {
      fails.push(`RAWHEX ${l.trim().slice(0, 80)}`);
    }
  }
}

// 5. Монтаж native-узлов в App/main.
mustContain('src/App.tsx', 'data-tab={item.id}', 'nav data-tab');
mustContain('src/App.tsx', 'data-badge={navBadges[item.id]', 'nav data-badge');
mustContain('src/App.tsx', '<NativeFab', 'FAB mount');
mustContain('src/App.tsx', '<NativeOfflinePill', 'offline pill mount');
mustContain('src/main.tsx', "import('./styles-native.css')", 'CSS split');
mustContain('src/main.tsx', 'initApkAppearance()', 'appearance boot');

// 6. Манифест и нативные ресурсы.
mustContain('android/app/src/main/AndroidManifest.xml', '.WaterTileService', 'QS tile');
mustContain('android/app/src/main/AndroidManifest.xml', 'android.app.shortcuts', 'shortcuts');
mustContain('android/app/src/main/AndroidManifest.xml', 'backup_rules', 'backup rules');
mustContain('android/app/src/main/AndroidManifest.xml', 'enableOnBackInvokedCallback', 'predictive back');
mustContain('android/app/src/main/AndroidManifest.xml', 'localeConfig', 'locales');
mustContain(
  'android/app/src/main/java/com/healthengine/app/MainActivity.java',
  'DynamicColorPlugin.class',
  'dynamic-color register',
);
mustContain(
  'android/app/src/main/java/com/healthengine/app/MainActivity.java',
  'ensureNotificationChannels',
  'notif channels',
);
for (const f of [
  'android/app/src/main/res/drawable/ic_stat_icon_default.xml',
  'android/app/src/main/res/drawable/ic_launcher_monochrome.xml',
  'android/app/src/main/res/xml/shortcuts.xml',
  'android/app/src/main/res/xml/backup_rules.xml',
  'android/app/src/main/res/xml/data_extraction_rules.xml',
  'android/app/src/main/res/xml/locales_config.xml',
]) mustExist(f, 'native res');

// 7. index.html: boot anti-flash + webp preload.
mustContain('index.html', 'he_apk_theme_v1', 'boot theme key');
mustContain('index.html', "html[data-boot-theme='light']", 'boot override');
mustContain('index.html', 'hero-main.webp', 'webp preload');

// 7b. Кардио-слой АПК на месте (молчаливый откат подсистемы).
// Кардио-оформление построено на классах `.train-cardio*` (не data-хуков),
// поэтому без этого гейда откат кардио-слоя проходил молча.
for (const sel of [
  '.train-cardioimport',
  '.train-cardiodiary',
  '.train-cardioparams',
  '.train-cardiopreview',
  '.train-cardiomanage',
  '.train-cardiostats',  '.train-cardiolink',
  '.train-cardiovol',
  '.train-cardiocomps',
  '.train-cardioday',
  '.train-cardiotimer',
]) mustContain('src/styles-native.css', `html.app-native ${sel}`, `cardio apk layer ${sel}`);
// Блоки-предупреждения кардио (мед-гейт HIIT, заблок. интенсив, ошибка моста).
for (const hook of ['hiit-block', 'week-intense-block', 'manage-program-error']) {
  mustContain('src/styles-native.css', `[data-cardio="${hook}"]`, `cardio alert hook ${hook}`);
}
// Спринт 5/P2: нативные <select> заменены попап-шитом — гейдим и хуки,
// иначе молчаливый возврат к <select> (крошечный в WebView/АПК) проходит.
for (const hook of ['select-trigger', 'select-backdrop', 'select-option', 'select-done']) {
  mustContain('src/ui/screens/TrainingScreen_parts/CardioUI.tsx', `data-cardio="${hook}"`, `cardio select sheet ${hook}`);
  mustContain('src/styles-native.css', `[data-cardio="${hook}"]`, `cardio select sheet css ${hook}`);
}
// …и ни одного нативного <select> в кардио-UI (кроме комментария-упоминания).
for (const f of ['CardioUI', 'CardioWeekEditor', 'CardioCatalogSection', 'CardioCompsStep', 'CardioHiitSection', 'CardioRecordsSection']) {
  const p = `src/ui/screens/TrainingScreen_parts/${f}.tsx`;
  const native = readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .filter(l => /<select[\s>]/.test(l) && !/^\s*(\*|\/\/)/.test(l));
  if (native.length) mustContain(p, 'NO_NATIVE_SELECT', `native <select> в ${f}: ${native[0].trim().slice(0, 60)}`);
}

// 7b-2. Кардио-UI: АПК-каналы выдачи, тач-норма и app-style диалоги.
// Молчаливый откат этого блока уже случался (shared-worktree): «копировать»
// снова уходило в navigator.clipboard без фолбэка, экспорт — в <a download>,
// удаление цикла — в window.confirm. Гейдим ВСЕ кардио-файлы, не список.
const CARDIO_UI_DIR = 'src/ui/screens/TrainingScreen_parts';
const CARDIO_DIARY_UI = 'src/ui/screens/ProfileScreen_v2/diaries/CardioDiary/CardioDiary.tsx';
// Читатель контракта на стороне питания — тот же АПК-слой (тап-норма, никаких
// нативных браузерных путей), поэтому гейдим и его.
const CARDIO_NUTRITION_UI = 'src/ui/screens/NutritionScreen_parts/IndividualPlan/CardioKcalNote.tsx';
const cardioUiFiles = readdirSync(join(root, CARDIO_UI_DIR))
  .filter(f => f.endsWith('.tsx') && /^cardio/i.test(f))
  .map(f => `${CARDIO_UI_DIR}/${f}`)
  .concat([CARDIO_DIARY_UI, CARDIO_NUTRITION_UI]);

const CARDIO_HOSTILE = [
  [/a\.download\s*=/, '<a download> (в WebView файл не сохраняется)'],
  [/window\.open\s*\(/, 'window.open (заблокирован в WebView)'],
  [/window\.print\s*\(/, 'window.print (заблокирован в WebView)'],
  [/<select[\s>]/, 'нативный <select>'],
  [/type=\{?["']checkbox["']/, 'нативный checkbox'],
  [/navigator\.clipboard\.writeText/, 'clipboard без АПК-фолбэка (copyOrShareText)'],
  [/window\.confirm\s*\(/, 'window.confirm вместо useConfirmDialog'],
];
const isCommentLine = l => /^\s*(\*|\/\/|\/\*)/.test(l);
for (const f of cardioUiFiles) {
  const lines = readFileSync(join(root, f), 'utf8').split(/\r?\n/);
  for (const [re, label] of CARDIO_HOSTILE) {
    const i = lines.findIndex(l => re.test(l) && !isCommentLine(l));
    if (i >= 0) fails.push(`HOSTILE ${label} → ${f}:${i + 1}: ${lines[i].trim().slice(0, 70)}`);
  }
  // Тач-норма 44px: minHeight 1x/2x/3x у button/input режет тап в АПК.
  const small = lines.findIndex((l, i) => {
    if (!/minHeight:\s*(1\d|2\d|3\d)\b/.test(l)) return false;
    return lines.slice(Math.max(0, i - 5), i + 1).some(w => /<(button|input)\b/.test(w));
  });
  if (small >= 0) fails.push(`TAP<44 → ${f}:${small + 1}: ${lines[small].trim().slice(0, 70)}`);
}

// АПК-пути кардио, которые нельзя терять молча.
const CARDIO_APK_MARKERS = [
  [`${CARDIO_UI_DIR}/CardioManageStep.tsx`, 'saveTextFileApk', 'экспорт файлов через Documents+Share'],
  [`${CARDIO_UI_DIR}/CardioManageStep.tsx`, 'publishCardioKcalContract', 'контракт «кардио → питание»'],
  [`${CARDIO_UI_DIR}/CardioManageStep.tsx`, 'copyOrShareText', 'выдача текста через Share'],
  [`${CARDIO_UI_DIR}/CardioDiaryPanel.tsx`, 'saveCsvApk', 'CSV через Share'],
  [`${CARDIO_UI_DIR}/CardioDiaryPanel.tsx`, 'KcalContractCard', 'карточка «питание видит кардио»'],
  [`${CARDIO_UI_DIR}/CardioSessionTimer.tsx`, 'plannedMin', 'факт-минуты сессии'],
  [`${CARDIO_UI_DIR}/CardioSessionTimer.tsx`, 'wakeLock', 'экран не гаснет на сессии'],
  [`${CARDIO_UI_DIR}/CardioSessionTimer.tsx`, 'ffmKg', 'ккал по тощей массе'],
  [`${CARDIO_UI_DIR}/CardioConstructor.tsx`, 'assembleInput', 'единая сборка цикла'],
  [`${CARDIO_UI_DIR}/CardioConstructor.tsx`, 'printHtmlApk', 'печать через файл+Share'],
  [`${CARDIO_UI_DIR}/CardioConstructor.tsx`, 'useConfirmDialog', 'app-style подтверждение'],
  [CARDIO_DIARY_UI, 'importCardioEntries', 'импорт с дедупом'],
  [CARDIO_DIARY_UI, 'replaceCardioLog([])', 'очистка одной транзакцией'],
  [CARDIO_DIARY_UI, 'useConfirmDialog', 'app-style подтверждение'],
];
for (const [file, needle, label] of CARDIO_APK_MARKERS) mustContain(file, needle, `cardio apk ${label}`);

// 7b. Единоборства: APK-хуки боёв, 44px на тапах, никаких нативных <select>/checkbox.
const COMBAT_SRC = 'src/ui/screens/combat/';
for (const [file, hooks] of [
  ['CombatUI.tsx', ['cb-chip', 'cb-pop-trig', 'cb-pop-sheet', 'cb-pop-opt', 'cb-pop-done', 'cb-pop-ok', 'cb-switch']],
  ['CombatConstructor.tsx', ['cb-steps', 'cb-pane', 'cb-split-card', 'cb-build', 'cb-next', 'cb-profile', 'cb-empty', 'cb-msg', 'cb-sec-head', 'cb-cycle-card']],
  ['CombatPlanView.tsx', ['cb-plan-actions', 'cb-plan-week', 'cb-plan-weekhead', 'cb-plan-sess', 'cb-plan-ex', 'cb-plan-export']],
  ['combat-annual-card.tsx', ['cb-plan-annual', 'annual-dday', 'annual-phase']],
  ['cb-camp-intel.tsx', ['cb-camp-intel']],
  ['cb-camp-strip.tsx', ['cb-camp-strip', 'camp-week', 'cb-plan-weeks']],
  ['cb-camp-charts.tsx', ['cb-camp-charts', 'chart']],
  ['cb-camp-measurements.tsx', ['measure-weigh', 'weigh-add', 'measure-sparring', 'spar-add', 'measure-lea', 'measure-sleep', 'measure-heat']],
  ['cb-variants.tsx', ['variants', 'variant-save', 'variant-compare', 'variant-restore', 'variant-remove', 'variant-diff']],
]) {
  for (const hook of hooks) {
    mustContain(COMBAT_SRC + file, hook, `combat hook ${hook} in ${file}`);
  }
}
// Шаги конструктора: хук data-cb="step" + APK-правило 44px по нему.
// Лента шагов с 2026-09-27 — общий компонент кита (как в ББ-авто), поэтому
// хук приходит через pillAttrs, а aria-current/data-step — из training-ui.
mustContain(COMBAT_SRC + 'CombatConstructor.tsx', `'data-cb': 'step'`, 'combat step hook');
mustContain('src/styles-native.css', `[data-cb='step']`, 'combat step css hook');
// 44px на тап-таргеты (guard на регресс к 40px — было .cb-chip).
mustContain('src/styles-native.css', '.cb-chip {\n  min-height: 44px !important', 'combat cb-chip 44px');
// a11y: aria-current на шагах (в общем ките) + live-region на тосте.
mustContain('src/ui/screens/TrainingScreen_parts/training-ui.tsx', `aria-current={isActive ? 'step' : undefined}`, 'planner step aria-current');
mustContain(COMBAT_SRC + 'CombatConstructor.tsx', 'role="status" aria-live="polite"', 'combat toast live region');
// …и ни одного нативного <select>/checkbox в боевом UI.
for (const f of ['CombatConstructor.tsx', 'CombatPlanView.tsx', 'CombatUI.tsx', 'combat-annual-card.tsx', 'cb-camp-intel.tsx', 'cb-camp-strip.tsx', 'cb-camp-charts.tsx', 'cb-variants.tsx', 'cb-camp-measurements.tsx']) {
  const p = COMBAT_SRC + f;
  const native = readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .filter(l => (/<select[\s>]/.test(l) || /type=["']checkbox["']/.test(l)) && !/^\s*(\*|\/\/)/.test(l));
  if (native.length) mustContain(p, 'NO_NATIVE_SELECT', `нативный контрол в ${f}: ${native[0].trim().slice(0, 60)}`);
}

// 7c. Хаб «Мастер движений» (LiftMasterCard): APK-хуки, дефолт-коллапс и честный VBT.
// Без гейда молчаливый откат ломал всё: навигация вела не в те секции, а «лучший»
// замер VBT фабриковался (+0.15 м/с) и уезжал в персист/диагностику/экспорт.
const LIFT_HUB = 'src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx';
for (const hook of [
  'data-lift="safety"', 'data-lift="red-flag"', 'data-lift="red-block-banner"',
  'data-lift="apply-all"', 'data-lift="nav-jump"', 'data-lift="phase-option"',
  'data-lift="vbt-metric"', 'data-lift="lvp-add"', 'data-lift="lvp-clear"',
  'data-lift="import-kinovea"', 'data-lift="parse-kinovea"', 'data-lift="kinovea-tilt"',
  'data-lift="export-html"', 'data-lift="export-csv"', 'data-lift="share"',
  'data-lift="video-not-measured"',
  'data-lift="rep-overlay"',
  'data-lift="rep-series-add"', 'data-lift="rep-series-clear"', 'data-lift="rep-series"',
  'data-lift="capture-quality"', 'data-lift="capture-height"', 'data-lift="capture-dist"',
  'data-lift="angle-check"', 'data-lift="angle-drift"', 'data-lift="angle-skew"', 'data-lift="angle-basis"', 'data-lift="angle-vs-meta"',
  'data-lift="angle-azimuth"', 'data-lift="ref-block"', 'data-lift="ref-length"',
  'data-lift="ref-grab"', 'data-lift="ref-grab-calib"', 'data-lift="ref-no-video"', 'data-lift="ref-frame"',
  'data-lift="ref-result"', 'data-lift="ref-save"', 'data-lift="ref-saved"',
  'data-lift="ref-clear"', 'data-lift="ref-msg"', 'data-lift="ref-xloop-fix"',
  'data-lift="ref-vs-meta"', 'data-lift="ref-vs-meta-fix-left"',
  'data-lift="ref-vs-meta-fix-right"', 'data-lift="ref-vs-meta-fix-front"',
  // Ось эталона — половина формулы угла (cos φ против sin φ), а не подпись.
  'data-lift="ref-axis-across"', 'data-lift="ref-axis-along"', 'data-lift="ref-axis-hint"',
  // Точность замера и расхождение с сохранённым: число без этого читается как точное.
  'data-lift="ref-precision"', 'data-lift="ref-vs-saved"',
  // Сравнение сессий: разные углы — это разная шкала горизонтали, а не техника.
  'data-lift="angle-mismatch"',
  'data-lift="export-svg"', 'data-lift="export-overlay-png"', 'data-lift="export-overlay-video"',
  'data-lift="series-save"', 'data-lift="session-compare"', 'data-lift="bar-heat"',
  'data-lift="quick-start"', 'data-lift="quick-start-hide"',
  'data-lift="hub-search"', 'data-lift="hub-search-hit"', 'data-lift="heat-summary"',
  'data-lift="rep-set-next"', 'data-lift="set-compare"', 'data-lift="kinovea-scale"',
  'series-copy-', 'data-lift="weight-mismatch"', 'data-lift="video-overlay-file"',
  'data-lift="video-calib"', 'data-lift="video-calib-file"', 'data-lift="video-calib-frame"',
  'data-lift="video-calib-save"', 'data-lift="video-calib-state"', 'data-lift="video-calib-clear"',
  'data-lift="video-calib-fit"', 'data-lift="heat-trend"', 'data-lift="heat-trend-row"', 'data-lift="heat-trend-verdict"',
  'data-lift="export-heat-trend"',
  'data-lift="video-persp"', 'data-lift="video-persp-state"', 'data-lift="persp-file"',
  'data-lift="persp-mirror"', 'data-lift="persp-reset"', 'persp-grab-', 'data-lift="persp-save"',
  'data-lift="persp-clear"', 'data-lift="persp-msg"',
  'data-lift="persp-preview-img"', 'persp-preview-tab-',
  'data-lift="persp-player"', 'data-lift="persp-player-unavailable"', 'persp-grab-player-',
  'data-lift="video-calib-preview"', 'data-lift="video-calib-preview-img"',
  'data-lift="video-offset"', 'data-lift="vbt-weight"', 'data-lift="vbt-weight-from-diary"',
  'data-lift-nav=',
]) mustContain(LIFT_HUB, hook, `lift hub hook ${hook}`);
// Дефолт-коллапс: 14 раскрытых блоков давали ~214 КБ HTML и ~500 кнопок за рендер.
mustContain(LIFT_HUB, 'DEFAULT_COLLAPSED', 'lift hub default collapse');
// Карта блоков — единый источник для ленты и поиска: 14 пунктов (антропометрия + 1…13).
mustContain(LIFT_HUB, 'HUB_SECTIONS', 'lift hub sections map');
mustContain(LIFT_HUB, 'export function weeklyHeatTrend', 'heat weekly trend');
mustContain(LIFT_HUB, 'export function heatTrendVerdict', 'heat trend verdict');
mustContain(LIFT_HUB, "'sec-13'", 'lift hub nav 13');
mustContain(LIFT_HUB, "'13 Старт'", 'lift hub nav 13 label');
{
  const hub = readFileSync(join(root, LIFT_HUB), 'utf-8');
  if (/\(\s*v\s*\+\s*0\.15\s*\)/.test(hub) || /vbtBest\s*\(\s*\(?\s*v\s*\+\s*0\.15/.test(hub)) {
    fails.push(`SYNTH-VBT в ${LIFT_HUB}: «лучший» замер фабрикуется прибавкой 0.15`);
  }
  // Кнопки применения/экспорта должны быть 44px (APK-тап).
  if (/data-lift="apply-all"[^>]*minHeight:3\d/.test(hub)) {
    fails.push(`TAP-44 в ${LIFT_HUB}: apply-all меньше 44px`);
  }
  // Все интерактивные элементы хаба — не меньше 44px (WCAG 2.5.5):
  // раньше кнопки серии/съёмки были 22–32px и на телефоне не нажимались.
  const small = hub.split(/\r?\n/)
    .map((l, i) => ({ l, i: i + 1 }))
    .filter(({ l }) => /<(button|input)\b/.test(l) && /minHeight:(2\d|3\d)\b/.test(l));
  if (small.length) fails.push(`TAP-44 в ${LIFT_HUB}:${small[0].i} — тап-таргет ${/minHeight:(\d+)/.exec(small[0].l)?.[1]}px`);
}

// Видео-оверлей: калибровка «см → пиксель» и контейнер mp4/webm — ядро новой фичи.
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function mapTrackToVideo', 'video calibration map');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function preferredVideoMime', 'video mp4 preference');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function calibrationFrameFit', 'video calibration fit');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function calibrationFrameFitOf', 'video calibration frame fit');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function perspectiveFromAnchors', 'video perspective fit');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function mapTrackToVideoPerspective', 'video perspective map');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function perspectiveFrameFit', 'video perspective frame fit');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function drawFrameWithMapping', 'frame preview draw');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export async function renderFrameWithMapping', 'frame preview render');
// Одна сессия кадров на файл: четыре кадра перспективы не должны декодировать видео четыре раза.
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export async function openVideoFramesFrom', 'video frame session from element');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export async function openVideoFrames', 'video frame session');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'export function buildHeatTrendCsv', 'heat trend csv export');
// Отчёт обязан фиксировать, чем нанесена линия на видео (иначе его не воспроизвести).
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Наложение линии на видео', 'overlay mode in report');
// Ракурс проверяется по замеру: вердикт и горизонтальный ход — в отчёте, иначе цифры не с чем сверить.
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Проверка ракурса', 'angle check in report');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'export function angleDriftLabel', 'angle drift label by view');
mustContain('src/engines/strength-sport/strength-sport-video.engine.ts', 'export function cameraAngleCheck', 'angle check by measurement');
mustContain('src/engines/strength-sport/strength-sport-video.engine.ts', 'export function cameraAngleShortLine', 'short angle line for shared image');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'angleText', 'angle line in trajectory image');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function trajectoryPngLayout', 'png text layout like svg');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function trajectoryPngLines', 'png annotations list');
// Эталон в кадре: угол камеры считается из укорочения известного отрезка, а не угадывается.
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function referenceAngleCheck', 'camera angle from reference span');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function perspectiveTrackYForVideoY', 'local scale at reference height');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Угол камеры по эталону', 'measured azimuth in report');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'referenceAngleCheck(', 'hub measures angle by reference');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'azimuthDeg: curRefAngle', 'measured azimuth reaches verdict');
// Поправка горизонтали на ракурс: измеренное делится на cos φ, но помечается как оценка.
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function referenceHorizontalCorrection', 'horizontal metric fix by measured angle');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'xLoop с поправкой на ракурс', 'corrected horizontal in report');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'referenceHorizontalCorrection(', 'hub applies horizontal fix');
// Параметры съёмки и замер спорят о ракурсе — спор обязан быть назван, а не спрятан.
mustContain('src/engines/strength-sport/strength-sport-video.engine.ts', 'export function sideConflictCheck', 'metadata vs measured view conflict');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Ракурс: параметры и замер', 'conflict in report');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'sideConflictCheck(', 'hub names the conflict');
// Ось эталона: поперёк движения — cos φ, вдоль штанги — sin φ. Перепутать нельзя.
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export type ReferenceAxis', 'reference axis in the formula');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'Math.sqrt(Math.max(0, 1 - Math.min(1, ratio * ratio)))', 'sin-mode uses cos phi');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Эталон: ось', 'axis in report');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'axis: refAxis', 'hub passes axis to the check');
// Точность замера и защита сохранённого замера от молчаливого перекрытия.
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function referencePrecisionNote', 'precision stated in words');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function referenceMeasurementDrift', 'saved vs fresh measurement');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'referenceMeasurementDrift(', 'hub warns on drift');
// Сравнение сессий: ракурс хранится в снимке повтора и не даёт спутать его с техникой.
mustContain('src/engines/strength-sport/strength-sport-video.engine.ts', 'export function sessionAngleMismatch', 'session camera mismatch');
mustContain('src/engines/strength-sport/strength-sport-video.engine.ts', 'export interface BarRepCamera', 'camera travels with the snapshot');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'snapshotBarRep(r, 24, cameraRef)', 'hub snapshots camera');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'sessionAngleMismatch(', 'hub names angle mismatch');
// Сравнение с прошлой сессией: дельта едет в отчёт вместе с оговорками (другой вес/ракурс),
// иначе отчёт пересылают как «прогресс техники», хотя это разница условий съёмки.
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Δvmax к прошлой сессии, %', 'session delta in report');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Сравнение сессий', 'session caveats in report');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'sessionNote: sessionCompare', 'hub fills session comparison');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'sessionCaveat,', 'caveats reach the picture');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function wrapCaptionLines', 'long captions wrapped, not cut');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'wrapCaptionLines(', 'svg captions wrapped too');
// Направление ухода: «+0.5 см» в отчёте — это «вправо в кадре», а не «к голове».
// Перевод в тело словами, и с оговоркой, что он взят из параметров, а не измерен.
mustContain('src/engines/strength-sport/strength-sport-video.engine.ts', 'export function barDriftDirection', 'drift direction in words');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Направление ухода', 'drift direction in report');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'barDriftDirection(', 'hub names drift direction');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'data-lift="drift-dir"', 'drift direction line in hub');
// Второй эталон: cos² + sin² = 1 — проверка разметки, а не доверие пользователю.
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function referenceAngleCrossCheck', 'two references cross-check');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Эталоны: сверка', 'cross-check in report');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'referenceAngleCrossCheck(', 'hub cross-checks the axis');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'data-lift="ref-cross-toggle"', 'second reference toggle');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'data-lift="ref-alt-length"', 'second reference length');
// Модель поворота: пересчёт по cos φ, названный моделью (третьего измерения в данных нет).
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Модель поворота', 'rotation model in report');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'modelXScale', 'rotation model in svg');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'data-lift="export-model"', 'rotation model toggle in hub');
// Звук подхода не теряется при перекодировании: дорожка берётся из исходного файла,
// а контейнер называется тем, что реально записан (mp4 есть не во всех WebView).
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function sourceAudioTrack', 'source audio into composite');
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'audio: audioTrack != null', 'composite reports audio');
// Сторона камеры по кадру: длина эталона даёт только |φ|, а порядок концов — знак.
// Один бит «какой конец у головы» + один «кадр зеркальный» — и слово о направлении
// опирается на замер, а не на память пользователя.
mustContain('src/engines/pro/trajectory-overlay.engine.ts', 'export function referenceSideCheck', 'camera side measured from frame');
mustContain('src/engines/strength-sport/strength-sport-video.engine.ts', 'sideSource', 'drift direction says where the side came from');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Сторона камеры по кадру', 'measured side in report');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'referenceSideCheck(', 'hub measures the side');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'data-lift="ref-head-first"', 'which end is the head');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'data-lift="ref-mirror"', 'mirrored frame bit');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'data-lift="ref-side"', 'measured side line in hub');
// Средняя скорость концентрической фазы: MVT/LVP считаются по ней, а пиковая всегда
// выше — значит это два разных числа, и путать их в отчёте нельзя.
mustContain('src/engines/strength-sport/strength-sport-video.engine.ts', 'export function meanVelocitySummary', 'mean concentric velocity');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Средняя скорость (концентрическая), м/с', 'mean velocity in report');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Средняя или пиковая', 'mean vs peak caveat');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'data-lift="kinovea-vmean"', 'mean velocity line in hub');
// Пересчёт «пиковая → средняя» раньше был молчаливым ×0.9: число менялось без
// объяснения. Теперь рядом обязана быть подпись, чем именно пересчитано.
mustContain('src/engines/strength-sport/strength-sport-video.engine.ts', 'export function sideFrameConflict', 'side vs capture params check');
mustContain('src/engines/pro/vbt.engine.ts', 'export function metricConversion', 'peak→mean conversion with basis');
mustContain('src/engines/pro/movement-diagnostics-export.engine.ts', 'Пересчёт пиковой в среднюю', 'conversion basis in report');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'data-lift="vbt-metric-note"', 'conversion basis line in hub');
// Настройки VBT, от которых зависит шкала и вердикт, не должны сбрасываться при
// перезагрузке: иначе зона MVT/e1RM и вывод о потере скорости считаются иначе.
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'vbtThreshold: cleanVbtThreshold', 'VL threshold persisted');
mustContain('src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx', 'data-lift="vbt-threshold"', 'VL threshold control');

// 7d. Mojibake-бан: битые символы (U+FFFD) в файлах хаба — признак порванной кодировки.
// В LiftMasterCard их было 11 (тексты VBT/LVP/Kinovea), и это попадало в UI АПК.
// (Остальной репозиторий исторически содержит такие символы — чистим адресно.)
for (const rel of [
  'src/ui/screens/TrainingScreen_parts/LiftMasterCard.tsx',
  'src/ui/screens/TrainingScreen_parts/DiagnosticsHub.tsx',
  'src/ui/screens/TrainingScreen_parts/MesoCorrectionCard.tsx',
  'src/ui/screens/TrainingScreen_parts/planner-bridge-handlers.ts',
]) {
  const p = join(root, rel);
  if (!existsSync(p)) { fails.push(`MISS file ${rel}`); continue; }
  const line = readFileSync(p, 'utf-8').split(/\r?\n/).findIndex(l => l.includes('\uFFFD'));
  if (line >= 0) fails.push(`MOJIBAKE ${rel}:${line + 1}`);
}

// 7e. Голосовые заметки (2026-11): без RECORD_AUDIO запись голоса в WebView
// молча падает, а без проверки возможностей UI показывал бы кнопку-пустышку.
// Вторая половина секции — нативный HeSpeech: в WebView нечего распознавать,
// поэтому диктовка/озвучка идут через системные SpeechRecognizer/TextToSpeech.
mustContain(
  'android/app/src/main/AndroidManifest.xml',
  'android.permission.RECORD_AUDIO',
  'voice notes: microphone permission',
);
mustContain(
  'src/engines/note-media.engine.ts',
  'export function isVoiceRecordingSupported',
  'voice notes: honest recording probe',
);
mustContain(
  'src/engines/note-media.engine.ts',
  'export function isDictationSupported',
  'voice notes: honest dictation probe',
);
mustContain(
  'src/engines/coach/coach-notes.engine.ts',
  'export interface CoachNoteAttachment',
  'voice notes: attachment metadata model',
);
mustContain(
  'src/engines/note-media-store.ts',
  'export async function cleanupNoteMedia',
  'voice notes: orphan media cleanup',
);
mustContain(
  'src/ui/screens/ProfileScreen_v2/ProfileNotesTab.tsx',
  'data-notes="add-voice"',
  'voice notes: record button',
);
mustContain(
  'src/ui/screens/ProfileScreen_v2/ProfileNotesTab.tsx',
  'data-notes="dictate"',
  'voice notes: dictation button',
);
mustContain(
  'src/ui/screens/ProfileScreen_v2/ProfileNotesTab.tsx',
  'data-notes="attach-remove"',
  'voice notes: remove attachment',
);
// Нативный мост: без него голосовые кнопки в WebView — «недоступно».
mustContain(
  'android/app/src/main/java/com/healthengine/app/HeSpeechPlugin.java',
  'name = "HeSpeech"',
  'voice notes: native speech plugin',
);
mustContain(
  'android/app/src/main/AndroidManifest.xml',
  'android.speech.RecognitionService',
  'voice notes: recognition service visibility',
);
mustContain(
  'src/core/speech-native.ts',
  'export function nativeSpeechCaps',
  'voice notes: native capability probe',
);
mustContain(
  'src/engines/note-speech.ts',
  'export async function startDictation',
  'voice notes: one speech entry point',
);
// Вложения в резервной копии: без этого перенос терял фото/голос.
mustContain(
  'src/core/data-backup.ts',
  'noteMediaOmitted',
  'voice notes: media in backup',
);
// Файл можно забрать из приложения (Документы/шаринг).
mustContain(
  'src/ui/screens/ProfileScreen_v2/ProfileNotesTab.tsx',
  'data-notes="share"',
  'voice notes: share attachment',
);

// 7f. Заметки профиля: хитбоксы 44px и хуки в духе TickTick: вид/сортировка/теги/корзина.
// Тихий откат в shared-worktree уже возвращал 24-26px оверлеи на фото и 32px чек-лист:
// снаружи это выглядело как рабочая кнопка, а в WebView по ним не попасть.
const NOTES_UI = 'src/ui/screens/ProfileScreen_v2/ProfileNotesTab.tsx';
for (const hook of [
  'data-notes="view"',
  'data-notes="sort"',
  'data-notes="note-tag"',
  'data-notes="restore"',
  'data-notes="purge-trash"',
  'data-notes="checklist-toggle"',
  'data-notes="due"',
  'data-notes="priority"',
  'data-notes="select-mode"',
  'data-notes="row-select"',
  'data-notes="batch-bar"',
  'data-notes="note-duplicate"',
  'data-notes="share-note"',
  'data-notes="due-quick"',
  'data-notes="due-menu"',
  'data-notes="due-quick-clear"',
  'data-notes="editor-due-presets"',
  'data-notes="editor-due-clear"',
])
  mustContain(NOTES_UI, hook, `notes hook ${hook}`);

// Диапазоны JSX-комментариев {/* ... */}. Нужны, чтобы закомментированную кнопку
// не считать рабочей, и при этом не спотыкаться о "audio/*" внутри атрибутов
// (наивный поиск /* делал «в комментарии» весь остаток файла).
function jsxCommentRanges(text) {
  const ranges = [];
  let from = text.indexOf('{/*');
  while (from >= 0) {
    const close = text.indexOf('*/}', from + 3);
    const to = close < 0 ? text.length : close + 3;
    ranges.push([from, to]);
    from = text.indexOf('{/*', to);
  }
  return ranges;
}

// Сканер тап-таргетов по открывающему тегу <button>/<input>. Тег разбирается
// целиком (с учётом {} и кавычек), иначе `=>` в onClick обрывает поиск.
// Размеры — числом или строкой ('32px'): minHeight < 44, height < 44, либо
// width < 44 при авто-высоте (иконка без паддинга). Чекбокс/радио пропускаем:
// цель — <label> в 44px вокруг.
function tapTargetViolations(text) {
  const violations = [];
  const comments = jsxCommentRanges(text);
  for (const m of text.matchAll(/<(button|input)\b/g)) {
    const before = text.slice(0, m.index);
    const lineStart = before.lastIndexOf('\n') + 1;
    const inComment =
      comments.some(([from, to]) => m.index >= from && m.index < to) ||
      before.slice(lineStart).trimStart().startsWith('//');
    if (inComment) continue;
    let curly = 0;
    let quote = null;
    let end = -1;
    for (let i = m.index + m[0].length; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === quote && text[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      else if (ch === '{') curly++;
      else if (ch === '}') curly--;
      else if (ch === '>' && curly === 0) {
        end = i;
        break;
      }
    }
    const at = before.split('\n').length;
    if (end < 0) {
      violations.push(`${at}: тег не разобран`);
      continue;
    }
    const tag = text.slice(m.index, end);
    if (/type=["'](checkbox|radio)["']/.test(tag)) continue;
    const px = (name) => {
      const found = new RegExp(`${name}:\\s*['"]?(\\d+)(?:px)?['"]?`).exec(tag);
      return found ? Number(found[1]) : 0;
    };
    const minH = px('minHeight');
    const h = px('height');
    const w = px('width');
    if (minH && minH < 44) violations.push(`${at}: minHeight ${minH}px`);
    else if (h && h < 44) violations.push(`${at}: height ${h}px`);
    else if (!h && w && w < 44) violations.push(`${at}: width ${w}px`);
  }
  return violations;
}

// Самопроверка: одна строка в парсере не должна тихо отключать гейд, поэтому
// прогоняем известные регрессы. Последний образец — тот баг, который уже был:
// "audio/*" в атрибуте выключал весь остаток файла.
for (const [sample, expectBad, label] of [
  ['<button style={{ minHeight: 24 }}>x</button>', true, 'minHeight 24'],
  ["<button style={{ minHeight: '32px' }}>x</button>", true, "minHeight '32px'"],
  ['<button style={{ width: 44, height: 24 }}>x</button>', true, 'width 44 + height 24'],
  ["<button style={{ width: '36px', height: '36px' }}>x</button>", true, "width/height '36px'"],
  ['<button style={{ height: 34 }}>x</button>', true, 'height 34 без width'],
  ['<button style={{ width: 24 }}>x</button>', true, 'width 24 без height'],
  ["<button onClick={() => go('x')}>x</button>", false, 'стрелка без размеров'],
  ["<button style={{ ...btn('ghost'), minHeight: 44 }}>x</button>", false, 'btn + 44'],
  ['<input type="checkbox" style={{ width: 18, height: 18 }} />', false, 'чекбокс в label'],
  ['// <button style={{ minHeight: 24 }}>x</button>', false, 'закомментированная кнопка'],
  ['{/* <button style={{ minHeight: 24 }}>x</button> */}', false, 'JSX-комментарий'],
  ['<button style={{ width: 44, height: 44 }}>x</button>', false, '44×44'],
  [
    '<input accept="audio/*" /><button style={{ minHeight: 24 }}>x</button>',
    true,
    'кнопка после "audio/*"',
  ],
]) {
  const flagged = tapTargetViolations(sample).length > 0;
  if (flagged !== expectBad) {
    fails.push(`SELFTEST сканера заметок: "${label}" → ${flagged ? 'флаг' : 'пропуск'}`);
  }
}

if (!existsSync(join(root, NOTES_UI))) {
  fails.push(`MISS file ${NOTES_UI}`);
} else {
  const notesViolations = tapTargetViolations(readFileSync(join(root, NOTES_UI), 'utf8'));
  if (notesViolations.length) {
    fails.push(`TAP-44 в ${NOTES_UI} — ${notesViolations.slice(0, 3).join('; ')}`);
  }
}


// 8. Секции native-слоя на месте (молчаливый откат хвоста файла).
for (const sec of [
  '67. SUPPORT + SECONDARY HEADS',
  '68. TRAIN INTEL NAV',
  '69. STICKY INNER NAV',
  '70. SECONDARY CONTENT PRO',
  '71. CONTENT STATES PRO',
  '72. NUTRITION SECTIONS',
  '73. MOBILE FIT',
  '74. BOTTOM FIT',
  '75. ANCHORED BOTTOMS',
  '92. COMBAT CONSTRUCTOR PRO',
  '93. COMBAT PLAN PRO',
  '98. COMBAT POPUPS PRO',
  '114. COMBAT BB-STYLE',
  '115. COMBAT CARDS/BUTTONS',
]) mustContain('src/styles-native.css', sec, `css section ${sec}`);

// 9. Главная: картинка целиком (contain), без своих надписей поверх верха.
mustContain('src/styles-native.css', 'object-fit: contain', 'home hero contain');

if (fails.length > 0) {
  console.error(`[check-apk-markers] FAIL (${fails.length}):`);
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('[check-apk-markers] OK: all APK design markers in place.');