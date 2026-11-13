/**
 * calc-norm-fallbacks.test.ts — проход 44: запасные числа порогов в UI не
 * расходятся с единым резолвером норм.
 *
 * `normUln('CODE', state, N)` берёт ULN из `lab-norms.engine`, но если код не
 * найден — молча падает на литерал N. Литерал живёт годами и стареет отдельно от
 * `UCUM_MAP`: билирубин стоял как 21 мкмоль/л при каноне 17.1 (прохода 29/31),
 * то есть «Холестаз» включался на 20.9 — уже при отклонении.
 *
 * Гард читает исходники (не рендер): каждое запасное число обязано совпадать с
 * ULN канона в `UCUM_MAP`, а женские запасные ветки PDF — с `getLabNorm`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UCUM_MAP } from '../../../../core/constants';
import { getLabNorm } from '../../../../engines/lab-norms.engine';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('Calc.mapper: запасные ULN совпадают с UCUM_MAP', () => {
  it('normUln(CODE, state, N) — N равно канону', () => {
    const src = read('src/ui/screens/Calculator/Calc.mapper.tsx');
    const re = /normUln\(\s*'([A-Z_]+)'\s*,\s*state\s*,\s*([\d.]+)\s*\)/g;
    const found: string[] = [];
    const bad: string[] = [];
    for (const m of src.matchAll(re)) {
      const [, code, fallback] = m;
      found.push(code);
      const canon = (UCUM_MAP as Record<string, { uln?: number }>)[code]?.uln;
      if (canon === undefined) { bad.push(`${code}: нет в UCUM_MAP`); continue; }
      if (Number(fallback) !== canon) bad.push(`${code}: запасное ${fallback}, канон ${canon}`);
    }
    expect(found.length).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});

describe('ProtocolExport: женские запасные пороги совпадают с резолвером', () => {
  it('getLabNorm(code, sex)?.uln ?? N — N равно резолверу', () => {
    const src = read('src/ui/components/ProtocolExport.tsx');
    const re = /getLabNorm\('([A-Z_]+)',\s*sex\)\?\.uln\s*\?\?\s*\(isFemale\s*\?\s*([\d.]+)\s*:\s*([\d.]+)\)/g;
    const bad: string[] = [];
    let count = 0;
    for (const m of src.matchAll(re)) {
      count++;
      const [, code, femFallback, maleFallback] = m;
      const female = getLabNorm(code, 'female')?.uln;
      const male = getLabNorm(code, 'male')?.uln;
      if (female !== Number(femFallback)) bad.push(`${code} ♀: запасное ${femFallback}, резолвер ${female}`);
      if (male !== Number(maleFallback)) bad.push(`${code} ♂: запасное ${maleFallback}, резолвер ${male}`);
    }
    expect(count).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});
