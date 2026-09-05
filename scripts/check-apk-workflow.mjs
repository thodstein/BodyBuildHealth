// check-apk-workflow.mjs — sanity workflow android-apk.yml без GitHub:
// нет secrets.* в `if` (Invalid workflow file), гейты release — по env,
// отступы — пробелы, секреты объявлены в env job'а ровно один раз.
import { readFileSync } from 'node:fs';
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

if (fails.length > 0) {
  console.error('[check-apk-workflow] FAIL:');
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('[check-apk-workflow] OK: release гейтится по env, YAML без табов.');
