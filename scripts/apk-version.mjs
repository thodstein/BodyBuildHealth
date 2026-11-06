#!/usr/bin/env node
/**
 * apk-version.mjs — единая версия APK для CI (android-apk.yml).
 *
 * Зачем: APK и тег/релиз обязаны совпадать по версии. Установленное приложение
 * сравнивает versionName (App.getInfo) с tag_name последнего релиза, поэтому
 * расхождение = «обновления нет» даже при свежей сборке.
 *
 * Две команды:
 *
 *   resolve — посчитать version/tag/versionCode для текущего запуска:
 *     • push тега vX.Y.Z  → version = X.Y.Z (из тега), code = из build.gradle;
 *     • workflow_dispatch → version = --input-version или патч +1 от максимума
 *       (package.json / последний GitHub Release), code = текущий + 1.
 *     Ручной запуск обязан давать версию СТРОГО выше последнего релиза —
 *     иначе телефон не покажет баннер обновления. Печатает key=value для
 *     $GITHUB_OUTPUT, человекочитаемый итог — в stderr.
 *
 *   apply — записать версию в package.json и android/app/build.gradle,
 *     чтобы versionName внутри APK совпал с тегом релиза.
 *
 * Примеры:
 *   node scripts/apk-version.mjs resolve --event push --ref refs/tags/v3.0.6
 *   node scripts/apk-version.mjs resolve --event workflow_dispatch --input-version ""
 *   node scripts/apk-version.mjs apply --version 3.0.6 --code 8
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(root, 'package.json');
const GRADLE = join(root, 'android', 'app', 'build.gradle');
const DEFAULT_REPO = 'thodstein/BodyBuildHealth';

const die = (msg) => {
  console.error('[apk-version] ОШИБКА:', msg);
  process.exit(1);
};

const argv = process.argv.slice(2);
const command = argv[0];
const arg = (name, fallback = '') => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? String(argv[i + 1]).trim() : fallback;
};

function readPkgVersion() {
  const raw = readFileSync(PKG, 'utf8');
  const m = /^\s*"version":\s*"([^"]+)"/m.exec(raw);
  if (!m) die('в package.json нет поля version');
  return m[1];
}

function readGradleVersion() {
  const raw = readFileSync(GRADLE, 'utf8');
  const code = /^([ \t]*)versionCode[ \t]+(\d+)[ \t]*$/m.exec(raw);
  const name = /^([ \t]*)versionName[ \t]+"([^"]+)"[ \t]*$/m.exec(raw);
  if (!code || !name) die('в android/app/build.gradle нет versionCode/versionName');
  return { code: Number(code[2]), name: name[2] };
}

/** "v3.0.6 " → "3.0.6". */
const stripV = (v) => String(v || '').trim().replace(/^[vV]/, '');

const isSemver = (v) => /^\d+\.\d+\.\d+$/.test(v);

/** Числовое сравнение: 3.0.10 > 3.0.9 (строковое дало бы наоборот). */
function compareVersions(a, b) {
  const pa = stripV(a).split('.');
  const pb = stripV(b).split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = Number(pa[i]);
    const y = Number(pb[i]);
    const nx = Number.isFinite(x) ? x : 0;
    const ny = Number.isFinite(y) ? y : 0;
    if (nx !== ny) return nx > ny ? 1 : -1;
  }
  return 0;
}

function bumpPatch(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(stripV(v));
  if (!m) die(`версия не похожа на x.y.z: "${v}"`);
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

/** Тег последнего опубликованного релиза (gh api; нет сети/gh → пусто). */
function latestReleaseVersion() {
  const repo = process.env.GH_REPO || DEFAULT_REPO;
  try {
    const out = execFileSync(
      'gh',
      ['api', `repos/${repo}/releases/latest`, '--jq', '.tag_name'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env },
    );
    const v = stripV(out);
    return isSemver(v) ? v : '';
  } catch {
    return '';
  }
}

/** Теги vX.Y.Z на origin (checkout в CI всегда знает origin; локально — тоже). */
function remoteTagVersions() {
  try {
    const out = execFileSync('git', ['ls-remote', '--tags', 'origin', 'refs/tags/v*'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out
      .split('\n')
      .map((line) => line.split('refs/tags/')[1] || '')
      .map((t) => t.replace(/\^\{\}$/, ''))
      .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))
      .map((t) => t.slice(1));
  } catch {
    return [];
  }
}

/**
 * Последняя известная версия: max(последний релиз, теги на origin).
 * Тег без релиза (упавшая публикация) тоже учитывается — иначе ручной
 * запуск повторно возьмёт занятый номер.
 */
function latestKnownVersion() {
  const candidates = [latestReleaseVersion(), ...remoteTagVersions()].filter(isSemver);
  return candidates.sort(compareVersions).pop() || '';
}

function resolve() {
  const event = arg('--event', process.env.GITHUB_EVENT_NAME || '');
  const ref = arg('--ref', process.env.GITHUB_REF || '');
  const inputVersion = stripV(arg('--input-version', process.env.INPUT_VERSION || ''));
  const inputPublish = arg('--input-publish', process.env.INPUT_PUBLISH || 'true');
  const gradle = readGradleVersion();
  const tagPush = event === 'push' && ref.startsWith('refs/tags/');

  let version;
  let code;
  let publish;

  if (tagPush) {
    // Тег-пуш: версию диктует тег, versionCode — из build.gradle (его поднял
    // scripts/release-apk.mjs в том же коммите). Нестандартный тег (rc/beta)
    // лучше уронить, чем молча опубликовать другую версию.
    version = stripV(ref.split('/').pop());
    if (!isSemver(version)) {
      die(`тег ${ref} не в формате vX.Y.Z — APK/релиз требуют числовую версию`);
    }
    code = gradle.code;
    publish = true;
  } else {
    // Ручной запуск: новая версия обязана быть выше последнего релиза,
    // иначе App.getInfo() == tag_name и баннер обновления не появится.
    const latest = latestKnownVersion();
    const pkg = readPkgVersion();
    const base = latest && compareVersions(latest, pkg) > 0 ? latest : pkg;
    version = inputVersion || bumpPatch(base);

    if (!isSemver(version)) die(`версия должна быть x.y.z, получено "${version}"`);
    if (latest && compareVersions(version, latest) <= 0) {
      die(
        `версия ${version} не новее последнего релиза v${latest}. ` +
          'Укажите version выше или оставьте поле пустым (авто +1 патч).',
      );
    }
    code = gradle.code + 1;
    publish = String(inputPublish || 'true').toLowerCase() !== 'false';
    // Ручная публикация с ветки выпустила бы WIP-код «последним релизом»
    // всем установленным приложениям. Сборка с ветки — только артефакт.
    if (publish && ref && ref !== 'refs/heads/main') {
      die(
        `публикация ручной сборки разрешена только с main (сейчас ${ref}). ` +
          'Для сборки с ветки поставьте publish=false.',
      );
    }
  }

  const tag = `v${version}`;
  console.error(
    `[apk-version] ${event}${tagPush ? ' (тег)' : ''}: ` +
      `version=${version} tag=${tag} versionCode=${code} publish=${publish} ` +
      `(было ${gradle.name}/${gradle.code})`,
  );
  // Формат для `>> "$GITHUB_OUTPUT"`.
  console.log(`version=${version}`);
  console.log(`tag=${tag}`);
  console.log(`code=${code}`);
  console.log(`publish=${publish}`);
}

function apply() {
  const version = stripV(arg('--version'));
  const codeRaw = arg('--code');
  if (!isSemver(version)) die(`--version должен быть x.y.z, получено "${version}"`);
  const code = Number(codeRaw);
  if (!Number.isInteger(code) || code <= 0) die(`--code должен быть целым > 0, получено "${codeRaw}"`);

  const pkgRaw = readFileSync(PKG, 'utf8');
  if (!/^\s*"version":\s*"[^"]+"/m.test(pkgRaw)) die('в package.json нет поля version');
  writeFileSync(
    PKG,
    pkgRaw.replace(/^(\s*"version":\s*")[^"]+(")/m, `$1${version}$2`),
    'utf8',
  );

  const gradleRaw = readFileSync(GRADLE, 'utf8');
  const patched = gradleRaw
    .replace(/^([ \t]*)versionCode[ \t]+\d+([ \t]*)$/m, `$1versionCode ${code}$2`)
    .replace(/^([ \t]*)versionName[ \t]+"[^"]+"([ \t]*)$/m, `$1versionName "${version}"$2`);
  if (patched === gradleRaw && !gradleRaw.includes(`versionName "${version}"`)) {
    die('не удалось обновить versionCode/versionName в android/app/build.gradle');
  }
  writeFileSync(GRADLE, patched, 'utf8');

  console.error(`[apk-version] apply: versionName=${version} versionCode=${code}`);
}

if (command === 'resolve') resolve();
else if (command === 'apply') apply();
else die('команда: resolve | apply (см. шапку файла)');
