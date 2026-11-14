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
 * ULN канона в `UCUM_MAP`, а PDF не держит своей таблицы порогов — он печатает
 * карточки фаз и стоп-пороги из единой шкалы (проход 56).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UCUM_MAP } from '../../../../core/constants';

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

describe('ProtocolExport: пороги — из резолвера и карточек, не литералами', () => {
  it('собственной таблицы лабораторных порогов больше нет (fallback удалён)', () => {
    const src = read('src/ui/components/ProtocolExport.tsx');
    expect(src).not.toContain('FALLBACK_LAB_SCHEDULE');
    expect(src).not.toContain("getLabNorm('");
    // Единственный перечень анализов — карточки фаз.
    expect(src).toContain('phaseCardsFor(');
  });

  it('стоп-пороги — из единой шкалы (HCT по полу, женская АЛТ 2.5×ULN)', () => {
    const src = read('src/ui/components/ProtocolExport.tsx');
    expect(src).toContain('HCT_THRESHOLDS.female.block');
    expect(src).toContain('HCT_THRESHOLDS.male.block');
    expect(src).toContain('FEMALE_ALT_2_5_ULN');
  });
});
