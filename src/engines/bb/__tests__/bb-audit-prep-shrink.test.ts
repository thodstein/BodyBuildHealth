/**
 * bb-audit-prep-shrink.test.ts — аудит UI (P2): «➖ неделя» подготовки сокращает и
 * тренировочный план, а не только prep-план.
 *
 * Было: `handleExtendPrep(-1)` вызывал `addPrepWeeks` (prep-план короче) и писал
 * «Подготовка сокращена до N нед», но тренировочный план оставался прежней длины —
 * недели подготовки продолжали в нём жить, их фазы расходились с подготовкой, и
 * «сокращение» видел только редактор подготовки. Теперь отрицательная дельта идёт
 * через `shrinkBBPlanPreparation` — зеркало `extendBBPlanPreparation`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyContestPrepToBBPlan,
  extendBBPlanPreparation,
  shrinkBBPlanPreparation,
  type BBContestPrepConfig,
  type BBPlanWithPrep,
} from '../bb-contest-prep.engine';
import type { BBPlan } from '../bb-builder.engine';

const TAPER_WEEKS = 2;

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function baseConfig(): BBContestPrepConfig {
  return {
    sex: 'male',
    category: 'mens_physique',
    weightKg: 80,
    bodyFatPct: 7,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 2,
    showDate: addDaysIso(todayIso(), 90),
    weeksOut: TAPER_WEEKS,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'minimal',
    sodiumStrategy: 'constant',
  };
}

function makeExercise(sets = 4, weight = 60, rir = 2, muscle = 'chest'): any {
  return {
    muscle,
    name: muscle === 'chest' ? 'Жим лёжа' : muscle === 'back' ? 'Тяга в наклоне' : 'Жим стоя',
    role: 'primary',
    character: 'тяж',
    sets,
    repsRange: [8, 12] as [number, number],
    rir,
    workSets: Array.from({ length: sets }, () => ({ reps: 10, rir, weight })),
    comment: '',
  };
}

function makeWeek(week: number, sets = 6): any {
  return {
    week,
    phase: 'accumulation',
    deload: false,
    sessions: Array.from({ length: 3 }, (_, i) => ({
      day: i + 1,
      weekOffset: week * 7 + i,
      character: 'тяж',
      exercises: [
        makeExercise(sets),
        makeExercise(sets, 40, 2, 'back'),
        makeExercise(sets, 20, 3, 'shoulders'),
      ],
    })),
  };
}

function makePlan(weeksCount: number): BBPlan {
  return {
    pattern: {} as any,
    weeks: Array.from({ length: weeksCount }, (_, i) => makeWeek(i + 1)),
    rotationMuscleVolume: {},
    rationale: ['Тестовый план'],
  };
}

/** План с уже наложенной подготовкой (та же длина — prepare не достраивает недели). */
function prepped(total: number, prepWeeks: number): BBPlanWithPrep {
  return applyContestPrepToBBPlan(makePlan(total), baseConfig(), {
    prepWeeks,
    taperWeeks: TAPER_WEEKS,
  }) as BBPlanWithPrep;
}

function countPhase(plan: BBPlanWithPrep, phase: string): number {
  return plan.weeks.filter((w: any) => w.contestPhase === phase).length;
}

function phasesOf(plan: BBPlanWithPrep): any[] {
  return ((plan as any).contestPrep?.phases ?? []) as any[];
}

describe('shrinkBBPlanPreparation — сокращение подготовки в плане', () => {
  it('убирает недели только из подготовки: тапер и пик не трогаются', () => {
    const plan = prepped(12, 9); // подготовка 9 / тапер 2 / пик 1
    const prepBefore = countPhase(plan, 'preparation') + countPhase(plan, 'final_preparation');
    const taperBefore = countPhase(plan, 'taper');

    const out = shrinkBBPlanPreparation(plan, 2);

    expect(out.weeks.length).toBe(10);
    expect(countPhase(out, 'taper')).toBe(taperBefore);
    expect(countPhase(out, 'peak_week')).toBe(1);
    expect(countPhase(out, 'preparation') + countPhase(out, 'final_preparation')).toBe(prepBefore - 2);
    expect(out.weeks[out.weeks.length - 1].contestPhase).toBe('peak_week');
    // недели перенумерованы без дыр
    out.weeks.forEach((w: any, i: number) => expect(w.week).toBe(i + 1));
  });

  it('диапазоны фаз пересчитываются от даты шоу (а не тянутся из старого плана)', () => {
    const plan = prepped(12, 9);
    const out = shrinkBBPlanPreparation(plan, 2);
    const phases = phasesOf(out);
    const taper = phases.find(p => p.key === 'taper');
    const peak = phases.find(p => p.key === 'peak_week');
    expect(taper?.weekStart).toBe(8);
    expect(taper?.weekEnd).toBe(9);
    expect(peak?.weekStart).toBe(10);
    expect(peak?.weekEnd).toBe(10);
    expect(phases).not.toBe(phasesOf(plan));
    // фазы покрывают все недели плана: подготовка идёт до тапера
    for (const w of out.weeks as any[]) {
      expect(w.contestPhase).toBeTruthy();
    }
  });

  it('оставляет минимум одну неделю подготовки и не режет больше, чем есть', () => {
    const plan = prepped(6, 3); // подготовка 3 / тапер 2 / пик 1
    const out = shrinkBBPlanPreparation(plan, 5); // просим больше, чем можно
    expect(out.weeks.length).toBe(4); // 1 подготовка + тапер 2 + пик 1
    expect(countPhase(out, 'preparation') + countPhase(out, 'final_preparation')).toBe(1);
    expect(countPhase(out, 'taper')).toBe(TAPER_WEEKS);
    expect(countPhase(out, 'peak_week')).toBe(1);
  });

  it('no-op, когда сокращать нечего (тапер + пик без запаса подготовки)', () => {
    const plan = prepped(3, 1); // подготовка уже минимальна
    expect(shrinkBBPlanPreparation(plan, 2)).toBe(plan);
  });

  it('симметрична extendBBPlanPreparation: +2 затем −2 возвращают длину', () => {
    const plan = prepped(10, 7);
    const extended = extendBBPlanPreparation(plan, 2);
    expect(extended.weeks.length).toBe(12);
    const back = shrinkBBPlanPreparation(extended, 2);
    expect(back.weeks.length).toBe(10);
    expect(back.weeks[back.weeks.length - 1].contestPhase).toBe('peak_week');
  });
});

describe('UI: «➖ неделя» сокращает тренировочный план', () => {
  it('отрицательная дельта идёт через shrinkBBPlanPreparation, флеш честный (source-guard)', () => {
    const src = readFileSync(
      resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'TrainingScreen_parts', 'BbAutoConstructor.tsx'),
      'utf8',
    );
    expect(src).toContain('shrinkBBPlanPreparation(base, -delta)');
    expect(src).toContain('extendBBPlanPreparation(base, delta)');
    expect(src).toContain('тапер и пик не тронуты');
    // Если плана/применения нет — про недели плана ничего не обещаем.
    expect(src).toContain('в плане нет свободных недель подготовки');
  });
});
