// fix-kcal.mjs — разовый пересчёт kcal = round5(4p + 9f + 4c) в шардах рецептов.
// Запуск: node scripts/fix-kcal.mjs
import fs from 'node:fs';

const files = ['src/data/recipe-db-p26.ts', 'src/data/recipe-db-p27.ts', 'src/data/recipe-db-p28.ts'];
const re = /kcal: (\d+), protein: (\d+(?:\.\d+)?), fat: (\d+(?:\.\d+)?), carbs: (\d+(?:\.\d+)?),/g;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let fixed = 0;
  const out = src.replace(re, (_m, kcal, p, fat, c) => {
    const formula = Math.round((4 * parseFloat(p) + 9 * parseFloat(fat) + 4 * parseFloat(c)) / 5) * 5;
    if (Number(kcal) === formula) return _m;
    fixed++;
    return `kcal: ${formula}, protein: ${p}, fat: ${fat}, carbs: ${c},`;
  });
  fs.writeFileSync(f, out, 'utf8');
  console.log(`${f}: исправлено ${fixed}`);
}
