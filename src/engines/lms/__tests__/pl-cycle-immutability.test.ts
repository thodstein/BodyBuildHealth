/**
 * pl-cycle-immutability.test.ts — Фаза 0 (ОРИГИНАЛ ЦИКЛА неприкосновенен).
 *
 * Контракт:
 *  1. Реестр LMS_CYCLES глубоко заморожен — мутация оригинала бросает TypeError.
 *  2. cloneCycleTemplate даёт полностью независимую копию (meta/дни/сеты).
 *  3. buildLMSPlan возвращает КЛОН шаблона (выход не ссылается на реестр).
 *  4. fitCycleToWeeks отдаёт производные копии (без ссылок на недели оригинала),
 *     включая exact — и не меняет оригинал ни при одном режиме.
 */
import { describe, it, expect } from 'vitest';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { cloneCycleTemplate } from '../../../data/lms-cycles/lms-cycle-clone';
import { buildLMSPlan, originalCycleWeeks } from '../lms-builder.engine';
import { fitCycleToWeeks, applyFitConsent } from '../lms-season.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { CYCLE_09K } from '../../../data/lms-cycles/cycle-09k';

const pmMap = { 'Присед': 150, 'Жим лежа': 110, 'Становая тяга': 180 };
const snap = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('ОРИГИНАЛ ЦИКЛА: реестр глубоко заморожен', () => {
  it('LMS_CYCLES и все вложенные данные заморожены', () => {
    expect(Object.isFrozen(LMS_CYCLES)).toBe(true);
    for (const cycle of LMS_CYCLES) {
      expect(Object.isFrozen(cycle), cycle.meta.id).toBe(true);
      expect(Object.isFrozen(cycle.meta), `${cycle.meta.id}.meta`).toBe(true);
      expect(Object.isFrozen(cycle.week1), `${cycle.meta.id}.week1`).toBe(true);
      const firstDay = cycle.week1[0];
      expect(Object.isFrozen(firstDay), `${cycle.meta.id}.week1[0]`).toBe(true);
      expect(Object.isFrozen(firstDay.exercises), `${cycle.meta.id}.week1[0].exercises`).toBe(true);
      const firstEx = firstDay.exercises[0];
      expect(Object.isFrozen(firstEx.sets), `${cycle.meta.id} set-блоки`).toBe(true);
      if (cycle.weeks) {
        expect(Object.isFrozen(cycle.weeks), `${cycle.meta.id}.weeks`).toBe(true);
        expect(Object.isFrozen(cycle.weeks[0]), `${cycle.meta.id}.weeks[0]`).toBe(true);
      }
      if (cycle.meta.deloadWeeks) expect(Object.isFrozen(cycle.meta.deloadWeeks)).toBe(true);
    }
  });

  it('попытка изменить оригинал бросает и не портит канон', () => {
    const before = snap(CYCLE_01);
    expect(() => { (CYCLE_01.meta as { weeks: number }).weeks = 99; }).toThrow();
    expect(() => { (CYCLE_01.week1[0].exercises[0].sets[0] as { reps: number }).reps = 99; }).toThrow();
    expect(() => { CYCLE_01.week1[0].exercises.push({ name: 'X', group: '', coef: 1, mnosz: 1, sets: [] }); }).toThrow();
    expect(CYCLE_01).toEqual(before);
  });
});

describe('cloneCycleTemplate: полная независимость копии', () => {
  it('мутация клона (meta/день/сет) не трогает оригинал', () => {
    const before = snap(CYCLE_01);
    const clone = cloneCycleTemplate(CYCLE_01);
    expect(clone).not.toBe(CYCLE_01);
    clone.meta.weeks = 1;
    clone.meta.title = 'Изменённый';
    clone.meta.conditions.push('x');
    clone.week1[0].exercises[0].name = 'Подменённое';
    clone.week1[0].exercises[0].sets[0].reps = 99;
    if (clone.weeks) clone.weeks[0][0].exercises[0].sets[0].reps = 77;
    expect(CYCLE_01).toEqual(before);
    // Клон изменяемый (не заморожен).
    expect(Object.isFrozen(clone)).toBe(false);
    expect(() => { clone.week1[0].exercises[0].sets[0].reps = 55; }).not.toThrow();
  });
});

describe('buildLMSPlan: выходной template — клон, не ссылка на реестр', () => {
  it('plan.template независим от оригинала и изменяем', () => {
    const before = snap(CYCLE_01);
    const plan = buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, faithful: true, weeksOverride: originalCycleWeeks(CYCLE_01) });
    expect(plan.template).not.toBe(CYCLE_01);
    expect(plan.template.meta.id).toBe(CYCLE_01.meta.id);
    // Потребитель может править копию — оригинал цел.
    expect(() => { plan.template.meta.weeks = 42; plan.template.week1[0].exercises[0].name = 'X'; }).not.toThrow();
    expect(CYCLE_01).toEqual(before);
  });
});

describe('fitCycleToWeeks: производные без ссылок на оригинал + согласие', () => {
  it('shrink: недели клонированы глубоко, оригинал не тронут', () => {
    const before = snap(CYCLE_01);
    const orig = originalCycleWeeks(CYCLE_01);
    const res = fitCycleToWeeks(CYCLE_01, Math.max(4, orig - 4));
    expect(res.mode).toBe('proposed_shrink');
    expect(res.needsConsent).toBe(true);
    expect(res.cycle).not.toBe(CYCLE_01);
    expect(res.cycle.weeks).toBeTruthy();
    expect(res.cycle.weeks![0]).not.toBe(CYCLE_01.weeks![0]);
    expect(res.cycle.weeks![0][0]).not.toBe(CYCLE_01.weeks![0][0]);
    expect(res.cycle.weeks![0][0].exercises[0]).not.toBe(CYCLE_01.weeks![0][0].exercises[0]);
    // Копия изменяема — и это не задевает канон.
    expect(() => { res.cycle.weeks![0][0].exercises[0].sets[0].reps = 3; }).not.toThrow();
    expect(CYCLE_01).toEqual(before);
  });

  it('shrink без явных недель: meta-копия независима', () => {
    // CYCLE_09K имеет явные недели; берём цикл только с week1 для этой ветки.
    const weekOnly = { meta: { ...CYCLE_01.meta, weeks: 12 }, week1: CYCLE_01.week1 } as typeof CYCLE_01;
    const before = snap(weekOnly);
    const res = fitCycleToWeeks(weekOnly, 8);
    expect(res.mode).toBe('proposed_shrink');
    expect(res.needsConsent).toBe(true);
    expect(res.cycle.meta).not.toBe(weekOnly.meta);
    expect(res.cycle.meta.correctionPct).not.toBe(weekOnly.meta.correctionPct);
    expect(weekOnly).toEqual(before);
  });

  it('extend: meta.weeks меняется у копии, weeks источника не тронуты', () => {
    const before = snap(CYCLE_09K);
    const orig = originalCycleWeeks(CYCLE_09K);
    const res = fitCycleToWeeks(CYCLE_09K, orig + 2);
    expect(res.mode).toBe('proposed_extend');
    expect(res.needsConsent).toBe(true);
    expect(res.cycle.meta.weeks).toBe(orig + 2);
    expect(res.cycle.weeks).toBeUndefined();
    expect(CYCLE_09K).toEqual(before);
  });

  it('exact: тоже копия (не ссылка), согласие не требуется', () => {
    const orig = originalCycleWeeks(CYCLE_01);
    const res = fitCycleToWeeks(CYCLE_01, orig);
    expect(res.mode).toBe('exact');
    expect(res.needsConsent).toBe(false);
    expect(res.cycle).not.toBe(CYCLE_01);
    expect(res.cycle.meta).not.toBe(CYCLE_01.meta);
  });

  it('applyFitConsent(false) не меняет оригинал и не применяет fit', () => {
    const before = snap(CYCLE_01);
    const orig = originalCycleWeeks(CYCLE_01);
    const res = fitCycleToWeeks(CYCLE_01, Math.max(4, orig - 3));
    const declined = applyFitConsent(res, false);
    expect(declined.mode).toBe('strict_skip');
    expect(declined.weeks).toBe(0);
    expect(CYCLE_01).toEqual(before);
  });
});
