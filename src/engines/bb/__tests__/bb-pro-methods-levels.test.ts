import { describe, expect, it } from 'vitest';
import { buildBBPlan, buildBBPlanWithDUP } from '../bb-builder.engine';

/**
 * Матрица проф-методик по уровням (как настроено в проекте):
 * beginner / intermediate / advanced / enhanced (2 и 8 лет) × ключевые сплиты.
 *
 * Политика (audit 2026-08): проф-методики (DUP/суперсеты/GVT/негативы) —
 * для intermediate и выше. Новичку они не нужны: блочная периодизация
 * (накопление → интенсификация → разгрузка) проще и безопаснее, а
 * метаболические схемы поверх базового объёма дают MRV-overflow.
 * Для beginner методики НЕ применяются, но инварианты (cap 5, нет
 * single-set, 0 MRV-overflow) обязаны быть чистыми.
 */
const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };
const LEVELS: Array<[string, string, number]> = [
  ['beginner', 'beginner', 1],
  ['intermediate', 'intermediate', 3],
  ['advanced', 'advanced', 5],
  ['enhanced-2y', 'enhanced', 2],
  ['enhanced-8y', 'enhanced', 8],
];
const SPLITS = ['ppl_6', 'upper_lower_4', 'fullbody_3'] as const;

function invariants(plan: any, allowDeloadSingles = true): { over5: number; single: number; ovf: number } {
  let over5 = 0, single = 0, ovf = 0;
  for (const w of plan.weeks) {
    const isDeload = w.phase === 'deload';
    for (const s of w.sessions) for (const e of s.exercises) {
      if (e.warmupActivator) continue;
      if (e.sets > 5) over5++;
      if (!isDeload && e.sets < 2) single++;
    }
  }
  for (const wi of Object.keys(plan.weeklyVolume || {})) {
    const wv = plan.weeklyVolume[wi];
    for (const m of Object.keys(wv)) {
      const cap = plan.mrvByMuscle?.[m];
      if (cap && wv[m].effectiveSets > cap * 1.15) ovf++;
    }
  }
  return { over5, single, ovf };
}

describe('Проф-методики × уровни (матрица)', () => {
  for (const [name, level, years] of LEVELS) {
    for (const split of SPLITS) {
      const base = { patternId: split, level, trainingYears: years, goal: 'mass', weeks: 4, workMax: WM };
      const isBeginner = level === 'beginner';

      it(`${name} × ${split}: DUP full_dup — инварианты, характеры меняются, deload чист`, () => {
        const plan = buildBBPlanWithDUP(base, { mode: 'full_dup', cycleDays: 3 });
        const inv = invariants(plan);
        expect(inv).toEqual({ over5: 0, single: 0, ovf: 0 });
        const workingChars = new Set(plan.weeks.filter((w: any) => w.phase !== 'deload').flatMap((w: any) => w.sessions.map((s: any) => s.character)));
        if (isBeginner) {
          // Новичку DUP не применяется — характеры из сплит-паттерна.
          expect(plan.rationale.some((r: string) => r.includes('DUP:'))).toBe(false);
        } else {
          expect(workingChars.size).toBeGreaterThanOrEqual(2);
        }
        const deloadDup = plan.weeks.filter((w: any) => w.phase === 'deload')
          .flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises)
          .filter((e: any) => (e.comment || '').includes('DUP:'));
        expect(deloadDup.length).toBe(0);
      });

      it(`${name} × ${split}: суперсеты-антагонисты — пары есть, ≤3/сессию, не в deload`, () => {
        const plan = buildBBPlan({ ...base, supersetMode: 'antagonist' });
        const inv = invariants(plan);
        expect(inv).toEqual({ over5: 0, single: 0, ovf: 0 });
        let totalPairs = 0;
        for (const w of plan.weeks) {
          const isDeload = w.phase === 'deload';
          for (const s of w.sessions) {
            const pairs = s.exercises.filter((e: any) => e.supersetWith).length;
            totalPairs += pairs;
            if (!isDeload) expect(pairs).toBeLessThanOrEqual(6); // 3 пары = 6 помеченных
            else expect(pairs).toBe(0);
          }
        }
        if (isBeginner) {
          // Новичку суперсеты не применяются.
          expect(totalPairs).toBe(0);
        } else {
          expect(totalPairs).toBeGreaterThan(0);
        }
      });

      it(`${name} × ${split}: схема объёма gvt — применена (5×10, 75с), кап-аджуст может срезать; инварианты чисты`, () => {
        const plan = buildBBPlan({ ...base, volumeScheme: 'gvt' });
        const inv = invariants(plan);
        expect(inv).toEqual({ over5: 0, single: 0, ovf: 0 });
        const applied = plan.weeks.filter((w: any) => w.phase !== 'deload').flatMap((w: any) => w.sessions)
          .flatMap((s: any) => s.exercises).filter((e: any) => (e.comment || '').includes('GVT'));
        if (isBeginner) {
          // Новичку GVT не применяется.
          expect(applied.length).toBe(0);
        } else if (applied.length > 0) {
          // Полное применение: минимум одно упражнение с 5×10@75с
          expect(applied.some((e: any) => e.sets === 5)).toBe(true);
          for (const e of applied) {
            expect(e.sets).toBeLessThanOrEqual(5);
            expect(e.sets).toBeGreaterThanOrEqual(2);
            expect(e.repsRange[0]).toBe(10);
            expect(e.restSeconds).toBe(75);
          }
        }
      });

      it(`${name} × ${split}: негативы — применяются к primary (темп 4-2-1-0), инварианты чисты`, () => {
        const plan = buildBBPlan({ ...base, intensityTechnique: 'negative' as any });
        const inv = invariants(plan);
        expect(inv).toEqual({ over5: 0, single: 0, ovf: 0 });
        const neg = plan.weeks.flatMap((w: any) => w.sessions).flatMap((s: any) => s.exercises)
          .filter((e: any) => (e.comment || '').includes('Негативы') || e.workSets?.some((ws: any) => ws.tempo === '4-2-1-0'));
        if (isBeginner) {
          // Новичку интенсив-техники не применяются.
          expect(neg.length).toBe(0);
        } else {
          expect(neg.length).toBeGreaterThan(0);
        }
      });
    }
  }

  it('комбо (DUP + суперсеты + GVT) — все инварианты чисты на ключевых уровнях', () => {
    for (const [name, level, years] of LEVELS) {
      const base = { patternId: 'upper_lower_4', level, trainingYears: years, goal: 'mass', weeks: 4, workMax: WM };
      const dup = buildBBPlanWithDUP(base, { mode: 'heavy_light', cycleDays: 2 });
      const combo = buildBBPlan({ ...base, supersetMode: 'antagonist', volumeScheme: 'gvt' });
      for (const p of [dup, combo]) {
        expect(invariants(p)).toEqual({ over5: 0, single: 0, ovf: 0 });
      }
    }
  });
});
