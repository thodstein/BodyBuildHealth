/**
 * unit-factors-single-source.test.ts — проход 100: множитель единицы гормона
 * живёт в одном месте.
 *
 * Было: `normalizeLabValue` (core/constants) делил E2 на 3.67, а резолвер норм
 * (`lab-norms.engine`) объявлял `E2_PG_TO_PMOL = 3.671`. Один и тот же пересчёт
 * шёл с разными числами в двух файлах: строка отчёта и чтение бланка расходились
 * в третьем знаке, а при 1468.4 пмоль/л это уже 400.1 против 400.0 пг/мл — то есть
 * значение на самой границе женского коридора получало разный вердикт.
 * Пролактин (21.2) и тестостерон (28.84) тоже были выписаны дважды — в
 * `normalizeLabValue` и в `labs-mapping`.
 *
 * Стало: шесть множителей объявлены в `core/constants` рядом с `normalizeLabValue`
 * (`E2_PG_TO_PMOL`, `PRL_NG_TO_MIU`, `PROG_NG_TO_NMOL`, `TT_NMOL_TO_NG_DL`,
 * `CORTISOL_UG_DL_TO_NMOL`, `DHEAS_UMOL_TO_UG_DL`), резолвер их ре-экспортирует,
 * `labs-mapping` берёт `TT_NMOL_TO_NG_DL` оттуда же. Эвристика порогов
 * («>300 — значит пмоль/л») не тронута — она про распознавание единицы, а не про
 * сам пересчёт.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  normalizeLabValue,
  E2_PG_TO_PMOL,
  PRL_NG_TO_MIU,
  PROG_NG_TO_NMOL,
  TT_NMOL_TO_NG_DL,
  CORTISOL_UG_DL_TO_NMOL,
  DHEAS_UMOL_TO_UG_DL,
} from '../constants';
import {
  E2_PG_TO_PMOL as E2_FROM_NORMS,
  PRL_NG_TO_MIU as PRL_FROM_NORMS,
  PROG_NG_TO_NMOL as PROG_FROM_NORMS,
} from '../../engines/lab-norms.engine';

describe('проход 100: множители единиц — один дом', () => {
  it('канонические числа: E2 3.671, PRL 21.2, прогестерон 3.18, ТТ 28.84', () => {
    expect(E2_PG_TO_PMOL).toBe(3.671);
    expect(PRL_NG_TO_MIU).toBe(21.2);
    expect(PROG_NG_TO_NMOL).toBe(3.18);
    expect(TT_NMOL_TO_NG_DL).toBe(28.84);
    expect(CORTISOL_UG_DL_TO_NMOL).toBe(27.59);
    expect(DHEAS_UMOL_TO_UG_DL).toBe(36.9);
  });

  it('резолвер ре-экспортирует те же числа, а не свои копии', () => {
    expect(E2_FROM_NORMS).toBe(E2_PG_TO_PMOL);
    expect(PRL_FROM_NORMS).toBe(PRL_NG_TO_MIU);
    expect(PROG_FROM_NORMS).toBe(PROG_NG_TO_NMOL);
  });

  it('пересчёт: 1468.4 пмоль/л — ровно 400 пг/мл на границе женского коридора', () => {
    // Старый делитель 3.67 давал 400.1 — значение «на границе» уезжало за неё.
    expect(normalizeLabValue('E2', 1468.4)).toBe(400);
  });

  it('пролактин, тестостерон, кортизол, ДГЕА-С переводятся теми же множителями', () => {
    expect(normalizeLabValue('Prolactin', 848)).toBe(40);
    expect(normalizeLabValue('Total T', 2884)).toBe(100);
    expect(normalizeLabValue('Cortisol', 2)).toBe(55.2);
    expect(normalizeLabValue('DHEA-S', 1)).toBe(36.9);
  });

  it('пороги распознавания единицы не сдвинулись (эвристика на месте)', () => {
    expect(normalizeLabValue('E2', 300)).toBe(300);      // ещё pg/mL
    expect(normalizeLabValue('Prolactin', 100)).toBe(100); // ещё ng/mL
    expect(normalizeLabValue('Total T', 100)).toBe(100);   // ещё nmol/L
    expect(normalizeLabValue('Cortisol', 5)).toBe(5);      // ещё nmol/L
    expect(normalizeLabValue('DHEA-S', 2)).toBe(2);        // ещё µg/dL
  });

  it('источник: в теле normalizeLabValue нет числовых копий, а в labs-mapping нет 28.84', () => {
    const constants = readFileSync(resolve(process.cwd(), 'src/core/constants.ts'), 'utf8');
    const body = constants.slice(constants.indexOf('export function normalizeLabValue('));
    expect(body).not.toContain('3.67');
    expect(body).not.toContain('21.2');
    expect(body).not.toContain('0.0347');
    expect(body).not.toContain('27.59');
    expect(body).not.toContain('36.9');
    expect(body).toContain('E2_PG_TO_PMOL');
    expect(body).toContain('PRL_NG_TO_MIU');
    expect(body).toContain('TT_NMOL_TO_NG_DL');
    expect(body).toContain('CORTISOL_UG_DL_TO_NMOL');
    expect(body).toContain('DHEAS_UMOL_TO_UG_DL');

    const norms = readFileSync(resolve(process.cwd(), 'src/engines/lab-norms.engine.ts'), 'utf8');
    expect(norms).toContain('export { E2_PG_TO_PMOL, PRL_NG_TO_MIU, PROG_NG_TO_NMOL };');
    expect(norms).not.toContain('export const E2_PG_TO_PMOL');

    const mapping = readFileSync(resolve(process.cwd(), 'src/core/labs-mapping.ts'), 'utf8');
    expect(mapping).not.toContain('factor = 28.84');
    expect(mapping).toContain('factor = TT_NMOL_TO_NG_DL');
  });
});
