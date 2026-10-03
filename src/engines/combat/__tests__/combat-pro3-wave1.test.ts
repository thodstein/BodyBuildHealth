/**
 * combat-pro3-wave1.test.ts — мутационные локи волны В1 плана
 * docs/COMBAT-PLANNER-PRO-3-PLAN.md (P0-1…P0-14).
 * Каждый тест падает при возврате старого поведения.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { TEEN_BANNED_EXERCISES } from '../combat-safety.engine';
import { conditioningSessionsForWeek } from '../combat-conditioning.engine';
import {
  buildAnnualATR, addCompetitionToAnnual, buildAnnualIcs, loadAnnualCB, isAnnualCBShape,
} from '../combat-annual';
import { buildCombatXlsxBuffer } from '../combat-xlsx.engine';
import { parseHoldSeconds } from '../combat-core.engine';

function base(extra: Record<string, unknown> = {}) {
  return {
    discipline: 'mma', goal: 'power', level: 'intermediate',
    weeks: 6, daysPerWeek: 3, bodyweight: 80, age: 28,
    ...extra,
  } as any;
}
function allEx(plan: any) {
  return plan.weeksData.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises));
}

describe('В1 · P0-1/P0-2/P0-3/P0-4 — единый safety-пайплайн', () => {
  it('P0-1: подросток 14 лет не получает teen-banned шею даже в full_conditioning', () => {
    const plan = buildCombatPlan(base({ patternId: 'combat_3', age: 14 }));
    const ids = allEx(plan).map((e: any) => e.id);
    const banned = ids.filter((id: string) => TEEN_BANNED_EXERCISES.includes(id));
    expect(banned).toEqual([]);
  });

  it('P0-1b: исключённый neck_harness_ext не вставляется в full_conditioning', () => {
    const plan = buildCombatPlan(base({ patternId: 'combat_3', excludedExercises: ['neck_harness_ext'] }));
    const ids = allEx(plan).map((e: any) => e.id);
    expect(ids).not.toContain('neck_harness_ext');
  });

  it('P0-2: травма шеи (exclude) — авто-добавка не возвращает шею', () => {
    const plan = buildCombatPlan(base({ patternId: 'combat_3', injuries: [{ location: 'neck', exclude: true }] }));
    const ids = allEx(plan).map((e: any) => e.id);
    expect(ids.filter((id: string) => id.includes('neck'))).toEqual([]);
  });

  it('P0-3: травма спины (exclude) — авто-core не возвращает deadbug/ab_wheel', () => {
    const plan = buildCombatPlan(base({ patternId: 'combat_2a', daysPerWeek: 2, level: 'beginner', injuries: [{ location: 'back', exclude: true }] }));
    const ids = allEx(plan).map((e: any) => e.id);
    expect(ids.filter((id: string) => ['deadbug', 'ab_wheel'].includes(id))).toEqual([]);
  });

  it('P0-4: fallback не возвращает исключённое (pullup при beginner без кабеля)', () => {
    const plan = buildCombatPlan(base({ patternId: 'combat_3', level: 'beginner', equipment: ['barbell'], excludedExercises: ['pullup'] }));
    const ids = allEx(plan).map((e: any) => e.id);
    expect(ids).not.toContain('pullup');
  });
});

describe('В1 · P0-13 — holdSeconds вместо детекта по «с»', () => {
  it('parseHoldSeconds: холды распознаются, «/сторону» — нет', () => {
    expect(parseHoldSeconds('30с')).toBe(30);
    expect(parseHoldSeconds('20-30с/сторону')).toBe(30);
    expect(parseHoldSeconds('30с + 40м')).toBe(30);
    expect(parseHoldSeconds('15с/стор')).toBe(15);
    expect(parseHoldSeconds('8-10/сторону')).toBeNull();
    expect(parseHoldSeconds('12/стор')).toBeNull();
    expect(parseHoldSeconds('8-12')).toBeNull();
  });

  it('динамический core (deadbug 8-10/сторону) получает reps=8, а не 1', () => {
    const plan = buildCombatPlan(base({ patternId: 'combat_2a', daysPerWeek: 2, level: 'beginner' }));
    const deadbug = allEx(plan).find((e: any) => e.id === 'deadbug');
    expect(deadbug).toBeDefined();
    expect(deadbug.holdSeconds).toBeUndefined();
    expect(deadbug.workSets[0].reps).toBe(8);
  });

  it('изометрический core (hollow_hold 30с) получает holdSeconds=30 и reps=1', () => {
    const plan = buildCombatPlan(base({ patternId: 'combat_2a', daysPerWeek: 2, level: 'intermediate' }));
    const hollow = allEx(plan).find((e: any) => e.id === 'hollow_hold');
    expect(hollow).toBeDefined();
    expect(hollow.holdSeconds).toBe(30);
    expect(hollow.workSets[0].reps).toBe(1);
    expect(hollow.workSets[0].holdSeconds).toBe(30);
  });
});

describe('В1 · P0-14 — изометрии шеи без 50 кг', () => {
  it('neck_isometric_front получает вес 0 (а не дефолт 50)', () => {
    const plan = buildCombatPlan(base({
      patternId: 'combat_2a', daysPerWeek: 2,
      excludedExercises: ['neck_harness_ext', 'neck_lateral_flex', 'neck_flexion', 'neck_rotation'],
    }));
    const iso = allEx(plan).find((e: any) => e.id === 'neck_isometric_front');
    expect(iso).toBeDefined();
    expect(iso.weight).toBe(0);
  });
});

describe('В1 · P0-9 — camp+taper кондиция не пустая', () => {
  it('тапер кэмпа сохраняет кондицию (поддержание), а не обнуляет', () => {
    const out = conditioningSessionsForWeek(8, 'taper', 'camp', 3);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('В1 · P0-10 — год: сумма недель = totalWeeks', () => {
  it('52 нед × 2 цикла даёт ровно 52 недели', () => {
    const ann = buildAnnualATR('mma', 52, null, { cycles: 2 });
    const sum = ann.blocks.reduce((a, b) => a + b.weeks, 0);
    expect(sum).toBe(52);
  });

  it('12 нед × 4 цикла: циклы клампятся (≥8 нед/цикл), сумма = 12', () => {
    const ann = buildAnnualATR('mma', 12, null, { cycles: 4 });
    expect(ann.blocks.reduce((a, b) => a + b.weeks, 0)).toBe(12);
  });
});

describe('В1 · P0-11 — валидация дат года', () => {
  it('addCompetitionToAnnual не добавляет бой с невалидной датой', () => {
    const ann = buildAnnualATR('mma', 52);
    const next = addCompetitionToAnnual(ann, { id: 'x', name: 'Test', date: 'мусор' } as any);
    expect(next.competitions.length).toBe(0);
  });

  it('buildAnnualIcs не падает на битой дате соревнования (пропускает)', () => {
    const ann = buildAnnualATR('mma', 52);
    ann.competitions.push({ id: 'bad', name: 'Broken', date: 'не-дата' });
    expect(() => buildAnnualIcs(ann, '2026-01-01')).not.toThrow();
    const ics = buildAnnualIcs(ann, '2026-01-01');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('Broken');
  });

  it('loadAnnualCB отбрасывает битую форму', () => {
    localStorage.setItem('he_combat_annual_v1', JSON.stringify({ blocks: 'nope' }));
    expect(loadAnnualCB()).toBeNull();
    expect(isAnnualCBShape({ blocks: 'nope' })).toBe(false);
  });
});

describe('В1 · P0-12 — XLSX реальный файл, не pad-муляж', () => {
  it('buildCombatXlsxBuffer возвращает настоящий zip (PK, >1000 байт)', () => {
    const plan = buildCombatPlan(base());
    const buf = buildCombatXlsxBuffer(plan);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4B);
  });
});

beforeEach(() => {
  localStorage.removeItem('he_combat_annual_v1');
});
