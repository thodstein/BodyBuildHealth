#!/usr/bin/env node
/**
 * release-apk.mjs — релиз APK одной командой, без Studio и без локальной сборки.
 *
 * Что делает:
 *   1) поднимает версию (patch по умолчанию) в package.json и
 *      android/app/build.gradle (versionCode +1, versionName = новая версия);
 *   2) коммитит ТОЛЬКО эти два файла (чужой WIP в дереве не попадает);
 *   3) ставит аннотированный тег vX.Y.Z;
 *   4) пушит ветку и тег.
 *
 * Дальше всё делает GitHub (workflow android-apk.yml по тегу v*):
 *   - собирает веб (npm run build:native) и APK;
 *   - подписывает ТОТ ЖЕ сборки release-ключом из секретов (build.gradle:
 *     debug тоже берёт signingConfigs.release, когда есть keystore.properties);
 *   - публикует GitHub Release: app-release.apk/app-debug.apk + web-bundle-<tag>.zip.
 *
 * На телефоне: баннер «⬇ Обновить» (полный APK) или «⚡ Быстрое обновление»
 * (OTA-файлы, без переустановки) — см. docs/NATIVE-APP.md §12, §12.1.
 *
 * Примеры:
 *   npm run release:apk                # 3.0.0 -> 3.0.1
 *   npm run release:apk -- --version 3.1.0
 *   npm run release:apk -- --dry-run   # показать план, ничего не менять и не пушить
 *   npm run release:apk -- --no-push   # версию и тег поставить локально, push вручную
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(root, 'package.json');
const GRADLE = join(root, 'android', 'app', 'build.gradle');
const REPO = 'https://github.com/thodstein/BodyBuildHealth';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const noPush = argv.includes('--no-push');
const versionArgIdx = argv.indexOf('--version');
const versionArg = versionArgIdx >= 0 ? String(argv[versionArgIdx + 1] || '').trim() : '';

const log = (...a) => console.log('[release]', ...a);
const die = (msg) => {
  console.error('[release] ОШИБКА:', msg);
  process.exit(1);
};

function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: opts.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function nextVersion(current) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!m) die(`версия в package.json не похожа на x.y.z: "${current}"`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

// ── 0. Проверки окружения ────────────────────────────────────────────────────
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') die(`релиз только с main (сейчас "${branch}")`);

const dirty = git(['status', '--porcelain']).split('\n').filter(Boolean);
const foreign = dirty.filter((l) => !/ (package\.json|android\/app\/build\.gradle)$/.test(l));
if (foreign.length > 0) {
  log(`в дереве есть чужие правки (${foreign.length}) — в релиз они НЕ попадут, коммитятся только версии:`);
  for (const l of foreign.slice(0, 5)) log('   ', l.trim());
  if (foreign.length > 5) log(`    … и ещё ${foreign.length - 5}`);
}

// ── 1. Версии ────────────────────────────────────────────────────────────────
const pkgRaw = readFileSync(PKG, 'utf8');
const pkgVersion = (/^\s*"version":\s*"([^"]+)"/m.exec(pkgRaw) || [])[1];
if (!pkgVersion) die('в package.json нет поля version');

const gradleRaw = readFileSync(GRADLE, 'utf8');
const codeMatch = /^([ \t]*)versionCode[ \t]+(\d+)[ \t]*$/m.exec(gradleRaw);
const nameMatch = /^([ \t]*)versionName[ \t]+"([^"]+)"[ \t]*$/m.exec(gradleRaw);
if (!codeMatch || !nameMatch) die('в android/app/build.gradle нет versionCode/versionName');

const version = versionArg || nextVersion(pkgVersion);
if (!/^\d+\.\d+\.\d+$/.test(version)) die(`--version должен быть x.y.z, получено "${version}"`);
if (version === pkgVersion && !versionArg) die('версия не изменилась');
if (git(['tag', '-l', `v${version}`])) die(`тег v${version} уже существует`);

const nextCode = Number(codeMatch[2]) + 1;
const tag = `v${version}`;

log(`версия: ${pkgVersion} → ${version}   versionCode: ${codeMatch[2]} → ${nextCode}   тег: ${tag}`);

if (dryRun) {
  log('--dry-run: файлы не меняю, тег не ставлю, push не делаю.');
  log(`после релиза: ${REPO}/releases/tag/${tag}`);
  process.exit(0);
}

// ── 2. Правки файлов ─────────────────────────────────────────────────────────
writeFileSync(
  PKG,
  pkgRaw.replace(/^(\s*"version":\s*")[^"]+(")/m, `$1${version}$2`),
  'utf8',
);
writeFileSync(
  GRADLE,
  gradleRaw
    .replace(
      /^([ \t]*)versionCode[ \t]+\d+([ \t]*)$/m,
      `$1versionCode ${nextCode}$2`,
    )
    .replace(
      /^([ \t]*)versionName[ \t]+"[^"]+"([ \t]*)$/m,
      `$1versionName "${version}"$2`,
    ),
  'utf8',
);

// ── 3. Коммит только версий, тег, push ───────────────────────────────────────
git(['add', 'package.json', 'android/app/build.gradle'], { stdio: 'inherit' });
// Чужие правки в индекс не тянем: add указывает файлы явно.
let hasStaged = true;
try {
  git(['diff', '--cached', '--quiet']);
  hasStaged = false;
} catch {
  hasStaged = true;
}
if (!hasStaged) die('нечего коммитить — версия не изменилась?');

git(['commit', '-m', `chore(release): ${tag}`], { stdio: 'inherit' });
git(['tag', '-a', tag, '-m', `Health Engine ${tag}`], { stdio: 'inherit' });
log(`коммит и тег созданы локально`);

if (noPush) {
  log('--no-push: дальше вручную:');
  log(`   git push origin main && git push origin ${tag}`);
  process.exit(0);
}

git(['push', 'origin', 'HEAD'], { stdio: 'inherit' });
git(['push', 'origin', tag], { stdio: 'inherit' });

log('готово. CI собирает APK + web-bundle и публикует Release:');
log(`   ${REPO}/releases/tag/${tag}`);
log('на телефоне появится баннер обновления (полный APK или «⚡ Быстрое обновление»).');
