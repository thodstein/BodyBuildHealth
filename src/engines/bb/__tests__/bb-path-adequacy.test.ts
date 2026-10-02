import { describe, expect, it } from 'vitest';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';
import { cycleTemplateToFullProgram, programToBBPlan } from '../cycle-to-plan';
import { buildBBPlan } from '../bb-builder.engine';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import { perExerciseCap, sessionLimitsFor, aggregateBBVolume } from '../bb-volume.engine';

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
      // Дубли имён в сессии (аудит 2026-10): 0 повторов одного имени.
      const names = working.map((e: any) => String(e.exerciseName || e.name || '').toLowerCase());
      expect(new Set(names).size, `${label} W${w.week} ${s.sessionTag}: дубли имён`).toBe(names.length);
      // Разминка-активатор не дублирует рабочее упражнение той же сессии.
      const warmNames = s.exercises.filter((e: any) => e.warmupActivator).map((e: any) => String(e.exerciseName || e.name || '').toLowerCase());
      for (const wn of warmNames) {
        expect(working.some((e: any) => String(e.exerciseName || e.name || '').toLowerCase() === wn), `${label} W${w.week} ${s.sessionTag}: разминка дублирует рабочее «${wn}»`).toBe(false);
      }
      // Порядок: изоляция мышцы не идёт ДО её compound-primary.
      const seenPrimary = new Set<string>();
      for (let i = 0; i < working.length; i++) {
        const e: any = working[i];
        const isIso = e.role === 'accessory' && /разгибан|сгибан|curl|raise|fly|мах|развод|шраг|pushdown|подъем|подъём|отведен|сведен/i.test(String(e.name || ''));
        if (isIso && !seenPrimary.has(e.muscle)) {
          const laterCompound = working.slice(i + 1).some((x: any) => x.muscle === e.muscle && x.role === 'primary');
          expect(laterCompound, `${label} W${w.week} ${s.sessionTag}: изоляция ${e.name} (${e.muscle}) до compound`).toBe(false);
        }
        if (e.role === 'primary') seenPrimary.add(e.muscle);
      }
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
    // Объём мышцы проверяем на ПИКЕ рабочих недель (в отдельном assertPeakTargets):
    // accumulation-недели ниже пика, а taper/deload — назначенно снижены.
  }
}

/** Пиковый effective за рабочие недели ≥ 90% цели (или цель уже реконсилирована). */
function assertPeakTargets(plan: any, label: string): void {
  const peak: Record<string, number> = {};
  for (const w of plan.weeks) {
    const isDeload = w.phase === 'deload' || w.deload === true || w.taper === true || w.taperApplied === true;
    if (isDeload) continue;
    const vol = aggregateBBVolume(w.sessions) as any;
    for (const [m, x] of Object.entries(vol)) peak[m] = Math.max(peak[m] || 0, (x as any).effectiveSets || 0);
  }
  // Все недели taper/deload — цель намеренно снижена, проверять нечего.
  if (Object.keys(peak).length === 0) return;
  for (const [m, t] of Object.entries((plan.volumeTargets || {}) as Record<string, { targetSets: number }>)) {
    const target = Number(t?.targetSets) || 0;
    if (target <= 0) continue;
    const got = peak[m] || 0;
    expect(got, `${label} ${m}: peak effective ${got} < 90% target ${target}`).toBeGreaterThanOrEqual(target * 0.9 - 0.01);
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
      assertPeakTargets(plan, `cycle ${id}`);
    }
  });

  it('generic (все сплиты, enhanced+PED): упражнение ≤ cap, сессия ≤ лимитов', () => {
    expect(SPLIT_PATTERNS.length).toBeGreaterThanOrEqual(25);
    for (const sp of SPLIT_PATTERNS) {
      const plan = buildBBPlan({ patternId: sp.id, weeks: 4, level: LEVEL, trainingYears: YEARS, goal: 'mass', sex: 'male', workMax: WORKMAX, ...PED } as never);
      assertAdequate(plan, `split ${sp.id}`);
      assertPeakTargets(plan, `split ${sp.id}`);
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
