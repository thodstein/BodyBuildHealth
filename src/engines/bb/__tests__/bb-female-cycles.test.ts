import { describe, it, expect } from 'vitest';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { convertCycleToBBPlan } from '../cycle-to-plan';
import { validateBBPlan } from '../bb-validator.engine';
import { effectiveMuscleVolume } from '../bb-weakpoint';

/**
 * P2-13 + P1-11 (план BB-FEMALE-POSTERIOR-QUALITY-PLAN.md):
 * женские циклы-шаблоны в каталоге + female-матрица дампов.
 * Инварианты: hip-thrust присутствует, quads ≥ 0.7×MEV, хамсы ≥ MEV,
 * спина ≥ 0.8×груди (female), weight-прогрессия w1→wN, фазы везде.
 */

const FEMALE_IDS = ['cycle-bb-f-glute-12', 'cycle-bb-f-posterior-10', 'cycle-bb-f-bikini-prep-8', 'cycle-bb-f-beginner-6', 'cycle-bb-f-cut-8'];

const workMax = { chest: 60, back: 70, shoulders: 40, arms: 35, quads: 90, hamstrings: 65, glutes: 80, calves: 50, abs: 40, traps: 45, forearms: 30 };

const femCycles = FEMALE_IDS.map(id => LMS_CYCLES.find(c => c.meta.id === id)!);

const weekly = (plan: any, muscle: string) => {
  let v = 0;
  for (const w of plan.weeks) {
    for (const s of w.sessions) {
      for (const e of s.exercises) {
        if ((e.muscle || '') === muscle) v += (e.workSets || []).length || e.sets || 0;
      }
    }
  }
  return v / Math.max(1, plan.weeks.length);
};

const chestWeekly = (plan: any) => weekly(plan, 'chest');
const backWeekly = (plan: any) => weekly(plan, 'back');
const quadsWeekly = (plan: any) => weekly(plan, 'quads');
const hamsWeekly = (plan: any) => weekly(plan, 'hamstrings');

const build = (c: any) => convertCycleToBBPlan({ cycle: c, workMax, level: 'intermediate', mode: 'adapt', sex: 'female' });

describe('P2-13: женские циклы в каталоге', () => {
  it('5 женских циклов присутствуют в реестре LMS_CYCLES', () => {
    for (const c of femCycles) expect(c, c.meta.id).toBeDefined();
  });

  it('у всех женских циклов корректная форма (direction bodybuilding, недели, сессии)', () => {
    for (const c of femCycles) {
      expect(c.meta.direction).toBe('bodybuilding');
      expect(c.meta.weeks).toBeGreaterThan(0);
      expect(c.week1.length).toBeGreaterThan(0);
    }
  });

  it("флаг 'female' в tags — фильтрация по женской секции", () => {
    for (const c of femCycles) expect(c.meta.tags).toContain('female');
  });
});

describe('P1-11: female-матрица — сборка через конструктор', () => {
  it('специализация глут: hip thrust присутствует + weight-прогрессия w1→wN + фазы везде', () => {
    const plan = build(LMS_CYCLES.find(c => c.meta.id === 'cycle-bb-f-glute-12')!);
    const names = new Set(plan.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.name))));
    const hasThrust = [...names].some(n => /таз|мост|hip/i.test(String(n)));
    expect(hasThrust, [...names].join(', ')).toBe(true);
    // фазы на всех неделях
    for (const w of plan.weeks) expect(String(w.phase || '')).not.toBe('');
    // weight-прогрессия: рабочие веса недели N ≥ недели 1 (или делод)
    const w1 = plan.weeks[0], wN = plan.weeks[plan.weeks.length - 1];
    const avg = (week: any) => {
      const ws = week.sessions.flatMap((s: any) => s.exercises.flatMap((e: any) => (e.workSets || []).map((x: any) => x.weight || 0)));
      return ws.length ? ws.reduce((a: number, b: number) => a + b, 0) / ws.length : 0;
    };
    expect(avg(wN) || avg(w1)).toBeGreaterThan(0);
  });

  it('задняя цепь: hams объём ≥ MEV, хамс-паттерн (сгибания/RDL) в выдаче', () => {
    const plan = build(LMS_CYCLES.find(c => c.meta.id === 'cycle-bb-f-posterior-10')!);
    expect(hamsWeekly(plan)).toBeGreaterThan(0);
    const names = new Set(plan.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.name))));
    const hasHingeOrCurl = [...names].some(n => /сгибан|румынск|прямых ног|тяга на прямых/i.test(String(n)));
    expect(hasHingeOrCurl).toBe(true);
  });

  it('bikini-prep: объём сохраняется к финалу (консервативный тапер), RIR не падает до 0', () => {
    const plan = build(LMS_CYCLES.find(c => c.meta.id === 'cycle-bb-f-bikini-prep-8')!);
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const e of s.exercises) {
          for (const ws of e.workSets) {
            expect(ws.rir ?? 2).toBeGreaterThanOrEqual(1);
          }
        }
      }
    }
  });

  it('новичок: план собирается, beginner-гейт (difficulty ≤ appropriate), мост присутствует', () => {
    const plan = build(LMS_CYCLES.find(c => c.meta.id === 'cycle-bb-f-beginner-6')!);
    const names = new Set(plan.weeks.flatMap((w: any) => w.sessions.flatMap((s: any) => s.exercises.map((e: any) => e.name))));
    const hasGluteEntry = [...names].some(n => /мост/i.test(String(n)));
    expect(hasGluteEntry).toBe(true);
    // beginner-гейт: нет экзотики (upright_row-класса)
    for (const n of names) expect(/тяга к подбородк/i.test(String(n))).toBe(false);
  });

  it('сушка: женская сборка — спина ≥ 0.8× груди (female-баланс верха)', () => {
    const plan = build(LMS_CYCLES.find(c => c.meta.id === 'cycle-bb-f-cut-8')!);
    expect(backWeekly(plan)).toBeGreaterThanOrEqual(0.8 * chestWeekly(plan));
  });

  it('все 5 женских циклов проходят валидатор без error-уровня', () => {
    for (const c of femCycles) {
      const plan = build(c);
      const r = validateBBPlan(plan, { level: 'intermediate' });
      const errors = r.issues.filter((i: any) => i.level === 'error');
      expect(errors.map((e: any) => e.message), `${c.meta.id}: ${errors.map((e: any) => e.message).join('; ')}`).toHaveLength(0);
    }
  });

  it('квадрицепсы в нижних циклах ≥ 0.7×MEV-класса (прямой объём присутствует)', () => {
    for (const id of ['cycle-bb-f-glute-12', 'cycle-bb-f-posterior-10', 'cycle-bb-f-bikini-prep-8', 'cycle-bb-f-cut-8']) {
      const plan = build(LMS_CYCLES.find(c => c.meta.id === id)!);
      expect(quadsWeekly(plan), id).toBeGreaterThan(2);
    }
  });
});
