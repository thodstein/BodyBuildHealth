import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';

const ROOT = path.resolve('src/ui/screens');
const FILES = [
  'NutritionScreen.tsx',
  'NutritionScreen_parts/IndividualPlan/IndividualPlanResults.tsx',
  'NutritionScreen_parts/DailyDietDashboard.tsx',
  'NutritionScreen_parts/ProductUsefulnessPlanner.tsx',
  'NutritionScreen_parts/ProgressTracker.tsx',
  'NutritionScreen_parts/HealthAnalytics.tsx',
];

const MOJIBAKE_RE = /(?:%|\+ )?(?:[РС][\u0400-\u04FF\u2000-\u20FF\u0080-\u00FF]){2,}/g;

function tryFixMojibake(text) {
  try {
    const fixed = iconv.decode(iconv.encode(text, 'win1251'), 'utf8');
    if (!fixed || fixed.includes('\uFFFD')) return null;
    if (!/[\u0400-\u04FF]/.test(fixed)) return null;
    if (fixed === text) return null;
    return fixed;
  } catch {
    return null;
  }
}

function fixMojibake(str) {
  return str.replace(MOJIBAKE_RE, (match) => tryFixMojibake(match) ?? match);
}

const REPLACEMENTS = [
  ['вљ\xa0пёЏ', '⚠️'],
  ['вљ пёЏ', '⚠️'],
  ['вљ–пёЏ', '⚖️'],
  ['вљ™пёЏ', '⚙️'],
  ['вљ\xa0 ', '⚠ '],
  ['вљ ', '⚠ '],
  ['вљ–', '⚖'],
  ['вљЎ', '⚡'],
  ['вљ™', '⚙'],
  ['вњ…', '✅'],
  ['вњ•', '✕'],
  ['вњ“', '✓'],
  ['в—‹', '○'],
];

function fixContent(content) {
  let result = content;
  for (const [from, to] of REPLACEMENTS) {
    result = result.split(from).join(to);
  }
  result = fixMojibake(result);
  return result;
}

function countBad(text) {
  return (text.match(/(?:[РС][\u0400-\u04FF\u2000-\u20FF\u0080-\u00FF]){2,}|вљ|пёЏ|вњ/g) || []).length;
}

let totalFixed = 0;
for (const rel of FILES) {
  const filePath = path.join(ROOT, rel);
  if (!fs.existsSync(filePath)) {
    console.log('SKIP (not found):', rel);
    continue;
  }
  const original = fs.readFileSync(filePath, 'utf8');
  const fixed = fixContent(original);
  if (fixed !== original) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`FIXED: ${rel} (bad: ${countBad(original)} -> ${countBad(fixed)})`);
    totalFixed++;
  } else {
    console.log(`OK (no changes): ${rel}`);
  }
}
console.log(`\nDone. ${totalFixed} files updated.`);
