// check-apk-markers.mjs — быстрый guard APK-оформления (без vitest).
// Ловит молчаливые откаты в shared-worktree (чужой checkout/revert):
// HeroImg-использования, CSS-изоляция, монтаж native-узлов, манифест.
// Запуск: `npm run verify:apk-design`. Падает (exit 1) со списком проблем.
import { existsSync, readFileSync } from 'node:fs';
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

// 7b. Единоборства: APK-хуки боёв, 44px на тапах, никаких нативных <select>/checkbox.
const COMBAT_SRC = 'src/ui/screens/combat/';
for (const [file, hooks] of [
  ['CombatUI.tsx', ['cb-chip', 'cb-pop-trig', 'cb-pop-sheet', 'cb-pop-opt', 'cb-pop-done', 'cb-pop-ok', 'cb-switch']],
  ['CombatConstructor.tsx', ['cb-steps', 'cb-pane', 'cb-split-card', 'cb-build', 'cb-next', 'cb-profile', 'cb-empty', 'cb-msg', 'cb-sec-head', 'cb-cycle-card']],
  ['CombatPlanView.tsx', ['cb-plan-actions', 'cb-plan-weeks', 'cb-plan-week', 'cb-plan-weekhead', 'cb-plan-sess', 'cb-plan-ex', 'cb-plan-export']],
  ['combat-annual-card.tsx', ['cb-plan-annual', 'annual-dday']],
  ['cb-camp-intel.tsx', ['cb-camp-intel']],
]) {
  for (const hook of hooks) {
    mustContain(COMBAT_SRC + file, hook, `combat hook ${hook} in ${file}`);
  }
}
// Шаги конструктора: хук data-cb="step" + APK-правило 44px по нему.
mustContain(COMBAT_SRC + 'CombatConstructor.tsx', `data-cb="step"`, 'combat step hook');
mustContain('src/styles-native.css', `[data-cb='step']`, 'combat step css hook');
// 44px на тап-таргеты (guard на регресс к 40px — было .cb-chip).
mustContain('src/styles-native.css', '.cb-chip {\n  min-height: 44px !important', 'combat cb-chip 44px');
// a11y: aria-current на шагах + live-region на тосте.
mustContain(COMBAT_SRC + 'CombatConstructor.tsx', `aria-current={active ? 'step' : undefined}`, 'combat step aria-current');
mustContain(COMBAT_SRC + 'CombatConstructor.tsx', 'role="status" aria-live="polite"', 'combat toast live region');
// …и ни одного нативного <select>/checkbox в боевом UI.
for (const f of ['CombatConstructor.tsx', 'CombatPlanView.tsx', 'CombatUI.tsx', 'combat-annual-card.tsx', 'cb-camp-intel.tsx']) {
  const p = COMBAT_SRC + f;
  const native = readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .filter(l => (/<select[\s>]/.test(l) || /type=["']checkbox["']/.test(l)) && !/^\s*(\*|\/\/)/.test(l));
  if (native.length) mustContain(p, 'NO_NATIVE_SELECT', `нативный контрол в ${f}: ${native[0].trim().slice(0, 60)}`);
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
