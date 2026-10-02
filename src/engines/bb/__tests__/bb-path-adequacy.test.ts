import { describe, expect, it } from 'vitest';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { cycleTemplateToFullProgram, programToBBPlan } from '../cycle-to-plan';
import { buildBBPlan } from '../bb-builder.engine';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import { perExerciseCap, sessionLimitsFor } from '../bb-volume.engine';

/**
 * Адекватность объёма во ВСЕХ путях генерации (аудит 2026-10, требование
 * владельца «и проф-цикл, и generic»):
 *  — ни одно упражнение не выше perExerciseCap своего уровня/мышцы
 *    (регресс циклового пути: 20–28 сетов на одно упражнение — calves,
 *    подтягивания, жимы);
 *  — сессия не выше лимитов (maxExercises/maxWorkingSets);
 *  — сессия не пустая, все сеты целые.
 * Полный перебор всех 53 циклов идёт в тяжёлом аудите
 * (BB_CYCLE_AUDIT_FULL=1, бакет exerciseCap); здесь — репрезентативная
 * выборка обоих путей, включая проблемные в прошлом циклы.
 */

const WORKMAX = {
  chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7,
  glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7,
};
const PED = {
  peds: ['AAS', 'GH', 'insulin'],
  pedDoses: { AAS: 500, GH: 4, insulin: 10 },
  courseIntensity: 'moderate' as const,
};
const LEVEL = 'enhanced';
const YEARS = 9;
const LIMITS = sessionLimitsFor({ level: LEVEL, trainingYears: YEARS, peds: PED.peds, onCourse: true, courseIntensity: PED.courseIntensity });

const CYCLE_SAMPLE = [
  'cycle-bb-m-ppl-6', 'cycle-bb-m-bro-5', 'cycle-bb-m-back-10', 'cycle-bb-m-dc-6',
  'cycle-08', 'cycle-bb-05', 'cycle-bb-f-delt-8', 'cycle-bb-f-bodyfitness-12',
];
const SPLIT_SAMPLE = ['ppl_6', 'upper_lower_4', 'fullbody_3', 'bro_5', 'arnold_6', 'glute_focus_4', 'phul_4', 'ppl_3'];

function assertAdequate(plan: any, label: string): void {
  expect(plan.weeks.length, `${label}: нет недель`).toBeGreaterThan(0);
  for (const w of plan.weeks) {
    const isDeload = w.phase === 'deload' || w.deload === true || w.taper === true || w.taperApplied === true;
    for (const s of w.sessions) {
      const working = s.exercises.filter((e: any) => !e.warmupActivator);
      expect(working.length, `${label} W${w.week} ${s.sessionTag}: пустая сессия`).toBeGreaterThan(0);
      expect(working.length, `${label} W${w.week} ${s.sessionTag}: упражнений`).toBeLessThanOrEqual(LIMITS.maxExercises);
      const sets = working.reduce((a: number, e: any) => a + (e.sets || 0), 0);
      expect(sets, `${label} W${w.week} ${s.sessionTag}: сетов сессии`).toBeLessThanOrEqual(LIMITS.maxWorkingSets);
      for (const e of working) {
        const cap = perExerciseCap(LEVEL, e.muscle, YEARS, true);
        expect(e.sets, `${label} W${w.week} ${s.sessionTag}: ${e.name} (${e.muscle})`).toBeLessThanOrEqual(cap);
        // Пол 2 сетов — рабочие недели. Пропускаем техники-схемы (DC Rest-Pause =
        // «1 сет 7+4+3», Myo-reps, FST-7, дроп-сеты): у них мини-сеты внутри
        // одного слота, это назначенный протокол, а не single-set-регресс.
        const technique = ((e.workSets || []) as any[]).some(x => x.technique)
          || /Rest-Pause|Myo-reps|FST-7|GVT|Gironda|DoggCrapp|дроп|кластер|21s|негатив|lengthened/i.test(String(e.comment || '') + ' ' + String(e.rationale || ''));
        if (!isDeload && !technique) expect(e.sets, `${label}: ${e.name}`).toBeGreaterThanOrEqual(2);
        expect((e.workSets || []).length, `${label}: ${e.name} sets vs workSets`).toBe(e.sets);
      }
    }
  }
}

describe('ББ-авто: адекватность объёма — все пути генерации', () => {
  it('проф-циклы (выборка циклового UI-пути, enhanced+PED): упражнение ≤ cap, сессия ≤ лимитов', () => {
    for (const id of CYCLE_SAMPLE) {
      const cycle = LMS_CYCLES.find(c => c.meta.id === id);
      expect(cycle, `cycle not found: ${id}`).toBeTruthy();
      const plan = programToBBPlan(cycleTemplateToFullProgram(cycle!), {
        workMax: WORKMAX, level: LEVEL, trainingYears: YEARS, mode: 'adapt', sex: 'male', goal: 'mass', ...PED,
      } as never);
      assertAdequate(plan, `cycle ${id}`);
    }
  });

  it('generic (все сплиты, enhanced+PED): упражнение ≤ cap, сессия ≤ лимитов', () => {
    expect(SPLIT_PATTERNS.length).toBeGreaterThanOrEqual(25);
    for (const sp of SPLIT_PATTERNS) {
      const plan = buildBBPlan({ patternId: sp.id, weeks: 4, level: LEVEL, trainingYears: YEARS, goal: 'mass', sex: 'male', workMax: WORKMAX, ...PED } as never);
      assertAdequate(plan, `split ${sp.id}`);
    }
  });

  it('цикловой путь без курса: потолки не раздуты (perExerciseCap legacy)', () => {
    const cycle = LMS_CYCLES.find(c => c.meta.id === 'cycle-08');
    expect(cycle).toBeTruthy();
    const plan = programToBBPlan(cycleTemplateToFullProgram(cycle!), {
      workMax: WORKMAX, level: 'enhanced', trainingYears: 6, mode: 'adapt', sex: 'male', goal: 'mass',
    } as never);
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const e of s.exercises.filter((x: any) => !x.warmupActivator)) {
          const cap = perExerciseCap('enhanced', e.muscle, 6, false);
          expect(e.sets, `no-PED ${e.name} (${e.muscle})`).toBeLessThanOrEqual(cap);
        }
      }
    }
  });
});
