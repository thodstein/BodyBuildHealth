/**
 * lab-slice-single-source.test.ts — проход 136: один бланк и одно имя анализа.
 *
 * Две вещи ломались молча:
 *  1) «какой бланк текущий» каждый контур решал сам. Риск-модель (`extractLabValues`),
 *     баннеры формы (единицы, границы) читали `fullPanel || midCourse || preCourse`,
 *     а план поддержки (`labSliceToValues`) — только `fullPanel`. Человек, заполнивший
 *     «середину курса», получал риск и находки, но ступени, мост механизмов и
 *     противопоказания — по пустой карте.
 *  2) один анализ приходил в лестницы под разными именами: форма отдаёт `HEMATOCRIT`,
 *     `TOTAL_CHOLESTEROL`, `PROTEIN` (моча), `ANTI_TPO`, `IL_6`, а `LAB_TIERS`/
 *     `TIER_RULES` знают `HCT`, `CHOLESTEROL_TOTAL`, `PROTEIN_URINE`, `TPO_AB`, `IL6`.
 *     `deriveTier('HEMATOCRIT', 58)` возвращал 0, хотя `deriveTier('HCT', 58)` — лечение.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { currentLabSlice } from '../lab-slice';
import { labFieldNumber } from '../lab-field-number';
import { buildMapperCtx } from '../mapper-ctx';
import { deriveTier, getLabEntry, TIER_MARKER_ALIAS } from '../../../data/lab-tier-ranges';
import { computeTierAdjustments } from '../../../data/lab-tier-recommendations';
import { DEFAULT_STATE } from '../../../ui/screens/Calculator/Calc.types';

const slice = (panel: string, values: Record<string, string>, units?: Record<string, string>) =>
  ({ [panel]: values, date: '2026-11-01', units: units ? { [panel]: units } : undefined } as never);

const stateWithLabs = (labs: Record<string, unknown>) =>
  ({ ...DEFAULT_STATE, labs: { preCourse: null, midCourse: null, postPCT: null, fullPanel: null, ...labs } } as never);

describe('проход 136: какой бланк текущий — одно правило', () => {
  it('полный бланк главнее, иначе середина курса, иначе до курса', () => {
    const full = { panelSex: { E2: '30' } } as never;
    const mid = { panelSex: { E2: '20' } } as never;
    const pre = { panelSex: { E2: '10' } } as never;
    expect(currentLabSlice({ fullPanel: full, midCourse: mid, preCourse: pre, postPCT: null })).toBe(full);
    expect(currentLabSlice({ fullPanel: null, midCourse: mid, preCourse: pre, postPCT: null })).toBe(mid);
    expect(currentLabSlice({ fullPanel: null, midCourse: null, preCourse: pre, postPCT: null })).toBe(pre);
  });

  it('нет бланка — null, а не пустые нули', () => {
    expect(currentLabSlice(null)).toBeNull();
    expect(currentLabSlice(undefined)).toBeNull();
    expect(currentLabSlice({ fullPanel: null, midCourse: null, preCourse: null, postPCT: null })).toBeNull();
    // «После ПКТ» — не текущий бланк: это прошлый цикл, а не данные сейчас.
    expect(currentLabSlice({ fullPanel: null, midCourse: null, preCourse: null, postPCT: slice('panelSex', { E2: '30' }) })).toBeNull();
  });

  it('план поддержки читает середину курса, а не пустую карту', () => {
    const state = stateWithLabs({ midCourse: slice('panelHematology', { HCT: '58' }) });
    const ctx = buildMapperCtx(state, 'base');
    expect(ctx.labs['HEMATOCRIT']).toBe(58);
    // И это сразу даёт ступень «лечение» (HCT 58 при блоке 54), т.е. совет появляется.
    const adj = computeTierAdjustments(ctx.labs, ctx.sex);
    const hct = adj.tierSummary.find((t) => t.marker === 'HEMATOCRIT');
    expect(hct?.tier).toBe(2);
    expect(adj.titrations.map((t) => t.id)).toContain('serrapeptase');
  });

  it('пустые анализы — пустая карта (нет записи ≠ в норме)', () => {
    const ctx = buildMapperCtx(stateWithLabs({}), 'base');
    expect(Object.keys(ctx.labs)).toHaveLength(0);
  });
});

describe('проход 136: число из поля — одно правило', () => {
  it('граница читается числом, полоска — нет, запятая — дробь', () => {
    expect(labFieldNumber('>1000')).toBe(1000);
    expect(labFieldNumber('<0.5')).toBe(0.5);
    expect(labFieldNumber('≥ 3')).toBe(3);
    expect(labFieldNumber('1+')).toBeUndefined();
    expect(labFieldNumber('++')).toBeUndefined();
    expect(labFieldNumber('5,4')).toBe(5.4);
    expect(labFieldNumber('')).toBeUndefined();
    expect(labFieldNumber(null)).toBeUndefined();
    expect(labFieldNumber('abc')).toBeUndefined();
    expect(labFieldNumber(12)).toBe(12);
    expect(labFieldNumber(0)).toBe(0);
  });

  it('копий разбора в контурах не осталось', () => {
    const root = resolve(__dirname, '..');
    const mapper = readFileSync(resolve(root, 'mapper-ctx.ts'), 'utf8');
    expect(mapper).toContain('labFieldNumber');
    expect(mapper).not.toContain('parseFloat');
    const helpers = readFileSync(resolve(root, 'engine-helpers.ts'), 'utf8');
    // Проход 206: чисел из полей движок больше не разбирает — карта приходит
    // из `labValuesForEngine`, а разбор один (`labFieldNumber` в `mapper-ctx`).
    expect(helpers).toContain('labValuesForEngine(');
    expect(helpers).not.toContain('labFieldNumber');
    // Разбор полей анализов больше не живёт внутри extractLabValues своей копией.
    expect(helpers).not.toContain("val.includes('+')");
  });
});

describe('проход 136: одно имя анализа в лестницах', () => {
  it('имена формы равны канону лестниц', () => {
    for (const [alias, canon] of Object.entries(TIER_MARKER_ALIAS)) {
      expect(getLabEntry(alias)?.marker).toBe(canon);
    }
  });

  it('гематокрит/холестерин/белок мочи больше не теряют ступень', () => {
    expect(deriveTier('HEMATOCRIT', 58, 'male')).toBe(deriveTier('HCT', 58, 'male'));
    expect(deriveTier('HEMATOCRIT', 58, 'male')).toBe(2);
    expect(deriveTier('TOTAL_CHOLESTEROL', 7, 'male')).toBe(deriveTier('CHOLESTEROL_TOTAL', 7, 'male'));
    expect(deriveTier('PROTEIN', 1.5)).toBe(deriveTier('PROTEIN_URINE', 1.5));
    expect(deriveTier('PROTEIN', 1.5)).toBe(3);
  });

  it('`TT` — тестостерон, а не протромбин; протромбин остался одним `INR`', () => {
    expect(getLabEntry('TT')?.label).toBe('Тестостерон');
    expect(getLabEntry('TT')?.unit).toBe('nmol/L');
    expect(deriveTier('TT', 8)).toBe(2);
    // МНО считается по своей шкале и не изменилось.
    expect(getLabEntry('INR')?.label).toBe('МНО');
    expect(deriveTier('INR', 1.6)).toBe(2);
  });

  it('ступени дают совет и на именах формы', () => {
    const hct = computeTierAdjustments({ HEMATOCRIT: 58 }, 'male');
    expect(hct.tierSummary.map((t) => t.marker)).toContain('HEMATOCRIT');
    expect(hct.addSubs.map((a) => a.id)).toContain('hesperidin');

    const chol = computeTierAdjustments({ TOTAL_CHOLESTEROL: 7 }, 'male');
    expect(chol.addSubs.map((a) => a.id)).toContain('bergamot');

    // Белок мочи 1.5 г/л — выраженная протеинурия: раньше не было ни находки, ни совета.
    const prot = computeTierAdjustments({ PROTEIN: 1.5 }, 'male');
    expect(prot.tierSummary[0]?.tier).toBe(3);
    expect(prot.alerts[0]?.message).toContain('Протеинурия');
    expect(prot.stopCourse).toBe(true);
  });

  it('каноническое имя главнее псевдонима: одна находка, не две', () => {
    const both = computeTierAdjustments({ HEMATOCRIT: 58, HCT: 58 }, 'male');
    expect(both.tierSummary.filter((t) => t.marker === 'HEMATOCRIT' || t.marker === 'HCT')).toHaveLength(1);
  });

  it('в TIER_RULES нет двух правил на один анализ', () => {
    const src = readFileSync(resolve(__dirname, '..', '..', '..', 'data', 'lab-tier-recommendations.ts'), 'utf8');
    const names = (src.match(/\{ marker: '([A-Z_0-9]+)'/g) || []).map((x) => x.slice(11, -1));
    expect(names.length).toBeGreaterThan(60);
    expect(names.length).toBe(new Set(names).size);
  });
});
