/**
 * symptom-solver-dose-ul.test.ts — рекомендации «Что беспокоит» не обещают
 * доз выше UL без пометки.
 *
 * Аудит 2026-11 (проход 23): у solver'а симптомов был свой набор доз, не
 * связанный с реестром пределов: D3 5000–10000 МЕ (UL 4000), витамин E
 * 400–800 МЕ (~536 мг при UL 300 мг), цинк 30–50/50–100 мг (UL 40),
 * B6/P5P 50–400 мг (UL 12). Пользователь видел на соседних экранах разные
 * «базовые» дозы одного вещества.
 *
 * Правило: основная доза в строке — в границах UL; дозы выше UL допустимы
 * только как коррекция/протокол и обязаны быть подписаны («дефицит»,
 * «под контролем врача», «UL B6»).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NUTRIENT_LIMITS_V2 } from '../support-limits';

const FILES = ['symptom-solver.data-part1.ts', 'symptom-solver.data-part2.ts', 'symptom-solver.data-part3.ts'];
const LINES = FILES.flatMap((f) =>
  readFileSync(resolve(process.cwd(), 'src/engines', f), 'utf8').split('\n'),
);

interface Row {
  id: string;
  dose: string;
  line: string;
}

const ROWS: Row[] = LINES.map((raw) => raw.trim())
  .filter((l) => l.includes("type: 'supplement'") && l.includes('dose:'))
  .map((line) => ({
    id: (line.match(/substanceId: '([^']+)'/) || [])[1] || '',
    dose: (line.match(/dose: '([^']+)'/) || [])[1] || '',
    line,
  }));

function rowsOf(...ids: string[]): Row[] {
  return ROWS.filter((r) => ids.includes(r.id));
}

/** Верхняя граница ОСНОВНОГО диапазона (до скобок с пояснением). */
function maxOf(dose: string, unit: RegExp): number | null {
  const main = dose.split('(')[0];
  const m = main.match(new RegExp(`(\\d+(?:[.,]\\d+)?)(?:\\s*[-–]\\s*(\\d+(?:[.,]\\d+)?))?\\s*${unit.source}`));
  if (!m) return null;
  const num = (x: string) => parseFloat(x.replace(',', '.'));
  return Math.max(num(m[1]), m[2] ? num(m[2]) : 0);
}

describe('symptom-solver: дозы в границах UL', () => {
  it('находит записи solver\'а (защита от пустого прогона)', () => {
    expect(ROWS.length).toBeGreaterThan(20);
    expect(rowsOf('zinc').length).toBeGreaterThan(3);
    expect(rowsOf('vitamin_d', 'vitamin_d3').length).toBeGreaterThan(2);
    expect(rowsOf('vitamin_b6', 'p5p').length).toBeGreaterThan(2);
  });

  it('цинк: основная доза ≤ UL', () => {
    const ul = NUTRIENT_LIMITS_V2.zinc.value;
    for (const r of rowsOf('zinc')) {
      const max = maxOf(r.dose, /мг/);
      if (max === null) continue;
      expect(max, r.dose).toBeLessThanOrEqual(ul);
    }
  });

  it('витамин D: основная доза ≤ UL, выше — только коррекция дефицита', () => {
    const ul = NUTRIENT_LIMITS_V2.vitamin_d.value;
    for (const r of rowsOf('vitamin_d', 'vitamin_d3')) {
      const max = maxOf(r.dose, /МЕ/);
      if (max === null) continue;
      expect(max, r.dose).toBeLessThanOrEqual(ul);
    }
  });

  it('витамин E: ≤ UL 300 мг (МЕ пересчитываются ×0.67)', () => {
    const ul = NUTRIENT_LIMITS_V2.vitamin_e.value;
    for (const r of rowsOf('vitamin_e')) {
      const iu = maxOf(r.dose, /МЕ/);
      const mg = maxOf(r.dose, /мг/);
      const value = iu !== null && /МЕ/.test(r.dose.split('(')[0]) ? iu * 0.67 : mg;
      if (value === null) continue;
      expect(value, r.dose).toBeLessThanOrEqual(ul + 0.5);
    }
  });

  it('B6/P5P: дозы выше UL подписаны предупреждением', () => {
    const ul = NUTRIENT_LIMITS_V2.vitamin_b6.value;
    for (const r of rowsOf('vitamin_b6', 'p5p')) {
      const max = maxOf(r.dose, /мг/);
      if (max === null) continue;
      if (max > ul) expect(r.line, r.dose).toContain('UL B6');
    }
  });

  it('старые дозы выше UL не вернулись в основные диапазоны', () => {
    for (const r of ROWS) {
      expect(r.dose.startsWith('5000-10000 МЕ'), r.line).toBe(false);
      expect(r.dose.startsWith('2000-5000 МЕ'), r.line).toBe(false);
      expect(r.dose.startsWith('400-800 МЕ'), r.line).toBe(false);
      if (r.id === 'zinc') expect(r.dose.startsWith('30-50 мг') || r.dose.startsWith('50-100 мг'), r.line).toBe(false);
    }
  });
});
