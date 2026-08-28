// Разовая правка: удаление вырожденного легаси-рецепта (100 ккал завтрак — артефакт).
// ЗАПУСК: node scripts/fix-degenerate-recipe.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'D:/BodyBuildHealth/src/data';
const TARGET = 'Белок яичный омлет со шпинатом и рикоттой';
for (const f of readdirSync(dir)) {
  if (!/^recipe-db-p\d+\.ts$/.test(f)) continue;
  const p = join(dir, f);
  const text = readFileSync(p, 'utf8');
  const idx = text.indexOf(TARGET);
  if (idx < 0) continue;
  // Найдём границы объекта рецепта: назад до '{', вперёд до '},'
  const start = text.lastIndexOf('{', idx);
  const end = text.indexOf('},', idx);
  if (start < 0 || end < 0) { console.log(`${f}: границы не найдены`); continue; }
  const out = text.slice(0, start) + text.slice(end + 3);
  writeFileSync(p, out, 'utf8');
  console.log(`${f}: удалён «${TARGET}»`);
}
