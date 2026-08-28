// Разовая правка опечаток порций coconut_oil в recipe-enrichment.ts (Aug 28 2026).
// 80-300 г кокосового масла — опечатки; реалистичная порция 10-15 г.
// ЗАПУСК: node scripts/fix-coconut-oil.mjs   (после запуска файл перечитать перед Edit!)
import { readFileSync, writeFileSync } from 'node:fs';

const p = 'D:/BodyBuildHealth/src/data/recipe-enrichment.ts';
const text = readFileSync(p, 'utf8');
let fixes = 0;
const out = text.replace(/coconut_oil:\s*(\d+)/g, (m, num) => {
  const v = Number(num);
  if (v > 30) { fixes++; return 'coconut_oil: 12'; }
  return m;
});
if (fixes > 0) {
  writeFileSync(p, out, 'utf8');
}
console.log('fixes:', fixes);
