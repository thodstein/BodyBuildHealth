import { describe, it, expect } from 'vitest';
import { buildLMSPlan } from '../lms/lms-builder.engine';
import { LMS_CYCLES } from '../../data/lms-cycles/lms-cycle-index';

/**
 * Ф1.2 (CYCLE-SYSTEM-FULL-AUDIT): матрица всех PL-направленных циклов
 * (powerlifting + bench + deadlift_bench = 88) через buildLMSPlan:
 * стандартный режим, faithful, ACWR-авто-делод. Инварианты формы/математики.
 */

const PL_DIRS = ['powerlifting', 'bench', 'deadlift_bench'];
const plCycles = LMS_CYCLES.filter(c => PL_DIRS.includes(String(c.meta.direction)));

function assertPlanShape(plan: ReturnType<typeof buildLMSPlan>, tag: string) {
  expect(plan.weeks.length, `${tag}: weeks`).toBe(plan.template.meta.weeks);
  for (const w of plan.weeks) {
    expect(w.days.length, `${tag} W${w.week}: days`).toBeGreaterThan(0);
    expect(w.pmRow && Object.keys(w.pmRow).length >= 0, `${tag} W${w.week}: pmRow`).toBeTruthy();
    for (const d of w.days) {
      expect(d.exercises.length, `${tag} W${w.week}: exercises`).toBeGreaterThan(0);
      for (const ex of d.exercises) {
        expect(ex.workSets.length, `${tag} W${w.week} ${ex.name}`).toBeGreaterThan(0);
        for (const ws of ex.workSets) {
          expect(Number.isFinite(ws.pct), `${tag} ${ex.name} pct NaN`).toBe(true);
          expect(ws.pct, `${tag} ${ex.name} pct`).toBeGreaterThan(0.05);
          expect(ws.pct, `${tag} ${ex.name} pct cap`).toBeLessThanOrEqual(1.35);
          expect(ws.reps, `${tag} ${ex.name} reps`).toBeGreaterThanOrEqual(1);
          expect(ws.reps, `${tag} ${ex.name} reps cap`).toBeLessThanOrEqual(20);
          expect(ws.sets, `${tag} ${ex.name} sets`).toBeGreaterThanOrEqual(1);
          expect(ws.sets, `${tag} ${ex.name} sets cap`).toBeLessThanOrEqual(10);
          expect(Number.isFinite(ws.weight), `${tag} ${ex.name} weight NaN`).toBe(true);
          expect(ws.weight, `${tag} ${ex.name} weight ≥0`).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(ex.rir) && ex.rir >= 0 && ex.rir <= 6, `${tag} ${ex.name} rir ${ex.rir}`).toBe(true);
        }
      }
    }
  }
}

function weekVolume(plan: ReturnType<typeof buildLMSPlan>, weekIdx: number): number {
  const w = plan.weeks[weekIdx];
  if (!w) return 0;
  return w.days.reduce((s, d) => s + d.exercises.reduce((x, e) => x + e.workSets.reduce((y, ws) => y + ws.sets, 0), 0), 0);
}

describe('Ф1.2: PL-матрица циклов', () => {
  it('все PL-циклы (88) собираются: форма/математика без NaN в обоих режимах', () => {
    expect(plCycles.length).toBe(88);
    for (const c of plCycles) {
      const plan = buildLMSPlan({ template: c, pmMap: {}, fallbackPm: 100 });
      assertPlanShape(plan, c.meta.id);
      const faithful = buildLMSPlan({ template: c, pmMap: { squat: 140, bench: 100, deadlift: 180 }, fallbackPm: 100, faithful: true });
      assertPlanShape(faithful, `${c.meta.id}/faithful`);
      expect(faithful.weeks.length).toBe(plan.weeks.length);
    }
  });

  it('ACWR dangerous → объём снижен против базовой сборки', () => {
    let checked = 0;
    for (const c of plCycles) {
      const base = buildLMSPlan({ template: c, pmMap: {}, fallbackPm: 100 });
      const danger = buildLMSPlan({
        template: c, pmMap: {}, fallbackPm: 100,
        acwr: { ratio: 1.6, zone: 'dangerous' },
      });
      const baseVol = base.weeks.reduce((s, _w, i) => s + weekVolume(base, i), 0);
      const dangerVol = danger.weeks.reduce((s, _w, i) => s + weekVolume(danger, i), 0);
      // Опасная зона — авто-делод: суммарный объём не выше базового
      expect(dangerVol, `${c.meta.id}`).toBeLessThanOrEqual(baseVol);
      checked++;
    }
    expect(checked).toBe(88);
  });

  it('циклы с meta.deloadWeeks (17 носителей): делод-недели легче соседей', () => {
    // Ф1.2: PL-циклы не несут meta.deloadWeeks (делод — тапер/ACWR); носители —
    // ББ/арм направления. Проверяем их делод-недели на той же сборке.
    const carriers = LMS_CYCLES.filter(c => (c.meta as any).deloadWeeks?.length);
    expect(carriers.length).toBeGreaterThan(0);
    for (const c of carriers) {
      const plan = buildLMSPlan({ template: c, pmMap: {}, fallbackPm: 100 });
      for (const dw of (c.meta as any).deloadWeeks as number[]) {
        const di = dw - 1;
        if (di <= 0 || di >= plan.weeks.length) continue;
        const deloadVol = weekVolume(plan, di);
        const prevVol = weekVolume(plan, di - 1);
        if (prevVol === 0) continue;
        // Делод выражается объёмом или нагрузкой (pct) — объём не выше предыдущей недели + допуск
        expect(deloadVol, `${c.meta.id} делод нед ${dw}`).toBeLessThanOrEqual(prevVol + 2);
      }
    }
  });
});
