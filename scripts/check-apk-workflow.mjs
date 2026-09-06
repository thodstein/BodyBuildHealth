// check-apk-workflow.mjs — sanity workflow android-apk.yml без GitHub:
// нет secrets.* в `if` (Invalid workflow file), гейты release — по env,
// отступы — пробелы, секреты объявлены в env job'а ровно один раз.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const p = join(__dirname, '..', '.github', 'workflows', 'android-apk.yml');
const lines = readFileSync(p, 'utf-8').split('\n');
const fails = [];

lines.forEach((l, i) => {
  if (/^\s*if:.*secrets\./.test(l)) fails.push(`L${i + 1}: secrets в if: ${l.trim()}`);
  if (/\t/.test(l)) fails.push(`L${i + 1}: таб в YAML`);
});

const text = lines.join('\n');
const gates = (text.match(/if:\s*\$\{\{\s*env\.ANDROID_KEYSTORE_BASE64 != ''\s*\}\}/g) || []).length;
if (gates !== 4) fails.push(`гейтов release по env: ${gates}, ждали 4`);
const decl = (
  text.match(/ANDROID_KEYSTORE_BASE64:\s*\$\{\{\s*secrets\.ANDROID_KEYSTORE_BASE64\s*\}\}/g) || []
).length;
if (decl !== 1) fails.push(`объявлений секрета в env: ${decl}, ждали 1`);

// Контракт с android/app/build.gradle: workflow обязан класть keystore
// ровно туда, откуда gradle читает (rootProject = android/):
//   android/keystore.properties (ключи storeFile/storePassword/keyAlias/keyPassword)
//   + android/app/he-release.keystore (storeFile склеивается как app/<имя>).
const gradle = readFileSync(join(__dirname, '..', 'android', 'app', 'build.gradle'), 'utf-8');
if (!gradle.includes("rootProject.file('keystore.properties')")) {
  fails.push('build.gradle больше не читает android/keystore.properties');
}
if (!gradle.includes('rootProject.file("app/${ksProps[')) {
  fails.push('build.gradle больше не склеивает storeFile как app/<имя>');
}
for (const frag of [
  'android/app/he-release.keystore',
  'android/keystore.properties',
  'storeFile=he-release.keystore',
  'storePassword=%s',
  'keyAlias=%s',
  'keyPassword=%s',
]) {
  if (!text.includes(frag)) fails.push(`workflow не пишет ${frag}`);
}
if (!text.includes('timeout-minutes:')) fails.push('нет timeout-minutes у job’ов');

// Экшены установки SDK: официального actions/setup-android не существует
// (Invalid: "Unable to resolve action actions/setup-android, repository not found") —
// во всех job'ах обязан быть android-actions/setup-android.
{
  const bad = (text.match(/uses:\s*actions\/setup-android@[^\s]+/g) || []).length;
  if (bad > 0) fails.push(`actions/setup-android (не существует): ${bad} шт — нужен android-actions/setup-android`);
  const good = (text.match(/uses:\s*android-actions\/setup-android@[^\s]+/g) || []).length;
  if (good !== 2) fails.push(`android-actions/setup-android: ${good}, ждали 2 (build + release)`);
}

// Java: преждевременный конец блочного комментария (звездочка-слэш внутри,
// как было system_accent1_*/accent2_*) роняет compileDebugJavaWithJavac.
// Вырезаем строки, затем блочные комменты — остаток */ это баг.
{
  const javaRoot = join(__dirname, '..', 'android', 'app', 'src', 'main', 'java');
  const walk = (dir) => {
    let out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out = out.concat(walk(p));
      else if (e.name.endsWith('.java')) out.push(p);
    }
    return out;
  };
  for (const f of walk(javaRoot)) {
    const src = readFileSync(f, 'utf-8')
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    if (src.includes('*/')) fails.push(`stray */ в ${f} (комментарий закрыт досрочно)`);
  }
}

// mergeDebugResources падает на дублях: одно имя — один ресурс.
// Проверяем values/*.xml (color/string/style/...) — именно так словили
// дубль ic_launcher_background (colors.xml vs ic_launcher_background.xml).
{
  const seen = new Map();
  for (const f of readdirSync(join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values'))) {
    if (!f.endsWith('.xml')) continue;
    const body = readFileSync(
      join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values', f),
      'utf-8',
    );
    for (const m of body.matchAll(/<(color|string|style|dimen|bool|integer|array)\s+name="([^"]+)"/g)) {
      const key = `${m[1]}/${m[2]}`;
      if (seen.has(key)) fails.push(`duplicate resource ${key}: ${seen.get(key)} + ${f}`);
      else seen.set(key, f);
    }
  }
}

if (fails.length > 0) {
  console.error('[check-apk-workflow] FAIL:');
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('[check-apk-workflow] OK: гейты по env, пути keystore совпадают с gradle.');
