import { describe, it, expect } from 'vitest';
import { convertCycleToBBPlan } from '../bb/cycle-to-plan';
import { validateBBPlan } from '../bb/bb-validator.engine';
import { buildLMSPlan } from '../lms/lms-builder.engine';
import { LMS_CYCLES } from '../../data/lms-cycles/lms-cycle-index';

/**
 * Ф4 (CYCLE-SYSTEM-FULL-AUDIT): вторая волна — 5 женских (glute-adv-12,
 * maint-8, upper-8, glute-2d-6, pl-f-base-12) + 6 мужских (beginner-ul-8,
 * cut-ul-8, pec-8, back-10, maint-4, dumbbell-8). Инварианты: форма, делоды,
 * валидатор без error, женские — гендерные объёмы.
 */

const workMax = {
  chest: 100, back: 120, shoulders: 60, arms: 50, quads: 140, hamstrings: 100,
  glutes: 120, calves: 80, abs: 60, traps: 80, forearms: 40,
};

const FEMALE_IDS = ['cycle-bb-f-glute-adv-12', 'cycle-bb-f-maint-8', 'cycle-bb-f-upper-8', 'cycle-bb-f-glute-2d-6', 'cycle-pl-f-base-12', 'cycle-bb-f-glute-pump-4', 'cycle-bb-f-bikini-base-12', 'cycle-bb-f-bikini-prep-12', 'cycle-bb-f-bodyfitness-12', 'cycle-bb-f-delt-8', 'cycle-bb-f-wellness-12'];
const MALE_IDS = ['cycle-bb-m-beginner-ul-8', 'cycle-bb-m-cut-ul-8', 'cycle-bb-m-pec-8', 'cycle-bb-m-back-10', 'cycle-bb-m-maint-4', 'cycle-bb-m-dumbbell-8', 'cycle-bb-m-arms-8', 'cycle-bb-m-shoulders-8', 'cycle-bb-m-legs-10', 'cycle-bb-m-strength-8', 'cycle-bb-m-hotel-4'];
const NEW_IDS = [...FEMALE_IDS, ...MALE_IDS];

describe('Ф4: вторая волна циклов (5 женских + 6 мужских) + сцена (5 сценических)', () => {
  it('все 22 зарегистрированы в каталоге с правильными тегами', () => {
    for (const id of NEW_IDS) {
      const c = LMS_CYCLES.find(x => x.meta.id === id);
      expect(c, `${id}: нет в каталоге`).toBeDefined();
      expect((c!.meta as any).tags?.includes('lms'), `${id}: tags lms`).toBe(true);
    }
    for (const id of FEMALE_IDS) {
      expect(LMS_CYCLES.find(x => x.meta.id === id)!.meta.tags.includes('female'), `${id}: tags female`).toBe(true);
    }
    expect(LMS_CYCLES.length).toBe(132);
  });

  it('все 22 собираются через конвертер: 0 ошибок валидатора, делоды присутствуют', () => {
    for (const id of NEW_IDS) {
      const c = LMS_CYCLES.find(x => x.meta.id === id)!;
      const isPl = c.meta.direction === 'powerlifting';
      if (isPl) {
        const plan = buildLMSPlan({ template: c, pmMap: {}, fallbackPm: 100 });
        expect(plan.weeks.length, `${id}: weeks`).toBe(c.meta.weeks);
        const deloads = plan.weeks.filter(w => w.deload).map(w => w.week);
        expect(deloads, `${id}: делоды ${JSON.stringify(deloads)}`).toEqual((c.meta as any).deloadWeeks);
      } else {
        const sex = id.includes('-f-') || id.startsWith('cycle-pl-f') ? 'female' : 'male';
        const plan: any = convertCycleToBBPlan({ cycle: c, workMax, level: c.meta.level === 'novice' ? 'beginner' : 'intermediate', mode: 'adapt', sex, goal: 'mass' });
        expect(plan.weeks.length, `${id}: weeks`).toBe(c.meta.weeks);
        const deloads = plan.weeks.filter((w: any) => w.deload).map((w: any) => w.week);
        expect(deloads, `${id}: делоды ${JSON.stringify(deloads)}`).toEqual((c.meta as any).deloadWeeks);
        const v = validateBBPlan(plan);
        const errs = (v.issues as any[]).filter(i => i.level === 'error');
        expect(errs.length, `${id}: errors ${JSON.stringify(errs)}`).toBe(0);
        expect(v.valid, `${id}: valid`).toBe(true);
      }
    }
  });

  it('женские циклы: задняя цепь присутствует, пол передаётся в движок', () => {
    for (const id of FEMALE_IDS.filter(x => !x.startsWith('cycle-pl-f'))) {
      const c = LMS_CYCLES.find(x => x.meta.id === id)!;
      const plan: any = convertCycleToBBPlan({ cycle: c, workMax, level: c.meta.level === 'novice' ? 'beginner' : 'intermediate', mode: 'adapt', sex: 'female', goal: 'mass' });
      const glutesOrHams = plan.weeks.some((w: any) => w.sessions.some((s: any) => s.exercises.some((e: any) => ['glutes', 'hamstrings'].includes(e.muscle))));
      expect(glutesOrHams, `${id}: задняя цепь отсутствует`).toBe(true);
      // RIR-лестница: недели несут rir в сетах (первичная неделя — старт лестницы)
      const rirW1 = plan.weeks[0].sessions.flatMap((s: any) => s.exercises.flatMap((e: any) => e.workSets.map((ws: any) => ws.rir)));
      expect(rirW1.filter((r: any) => Number.isFinite(r)).length, `${id}: rir в сетах`).toBeGreaterThan(0);
    }
  });
});
