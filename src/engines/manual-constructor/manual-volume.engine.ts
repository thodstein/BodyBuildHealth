/**
 * manual-volume.engine.ts — PRO-объём для ручного конструктора.
 *
 * Единственное место где ручной план считает effective объём (direct + indirect),
 * per-head дельты, пер-упражнение кап 5/8, сессионные капы 24/40/60 и недельный бюджет 112/220.
 * Повторяет логику bb-volume / bb-builder чтобы ручник не расходился с авто.
 */

import { getVolumeLandmarks } from '../volume-landmarks.engine';
import {
  normalizeBBMuscle,
  indirectMuscleContributions,
  perExerciseCap,
  sessionLimitsFor,
  computeBBWeeklyBudget,
  IGNORE_BUDGET_MUSCLES,
} from '../bb/bb-volume.engine';
import type { UserProgram, UserWeek, UserSession, UserBlock } from '../user-program/user-program.types';

/** Какие мышцы считаем per-head (не агрегатом). */
const PER_HEAD_MUSCLES = new Set(['delt_front', 'delt_mid', 'delt_rear', 'chest_upper', 'chest_lower', 'back_width', 'back_thickness', 'quads', 'hamstrings', 'glutes']);

function normMuscle(m: string): string {
  const v = (m || '').toLowerCase().trim();
  // Не коллапсируем delt_* — per-head
  if (v.startsWith('delt_')) return v;
  if (v === 'delt') return 'delt_mid';
  // Остальные коллапсы минимальны
  if (v === 'forearms' || v === 'forearm') return 'forearms';
  if (v === 'traps') return 'traps';
  if (v === 'calves' || v === 'calf') return 'calves';
  if (v === 'abs' || v === 'core') return 'abs';
  return normalizeBBMuscle(v);
}

function contributionForBlock(block: UserBlock): Array<{ muscle: string; effective: number; direct: number; coeff: number }> {
  const sets = block.sets?.length || 0;
  if (!sets) return [];
  const directRaw = normMuscle(block.muscle || 'other');
  const direct = directRaw || 'other';
  const rir = block.sets?.[0]?.rir ?? 2;
  // fatigueWeighted не нужен для MEV/MRV cap, но учитываем rir для effective?
  const result: Array<{ muscle: string; effective: number; direct: number; coeff: number }> = [
    { muscle: direct, effective: sets, direct: sets, coeff: 1 },
  ];
  // indirect через bb-volume (использует имя упражнения и тип)
  const fakeEx: any = { name: block.exerciseName, type: block.type === 'compound' ? 'compound' : block.type === 'isolation' ? 'isolation' : 'accessory', muscle: direct, rir };
  const isIsolation = /разгибан|сгибан|curl|raise|fly|мах|развод|шраг|pushdown|crunch|скручив/i.test((block.exerciseName || '').toLowerCase());
  if (isIsolation && block.type === 'isolation') {
    // изоляция не даёт indirect (как в bb-volume)
  } else {
    for (const sec of indirectMuscleContributions(fakeEx)) {
      const mu = normMuscle(sec.muscle);
      if (!mu || mu === direct) continue;
      result.push({ muscle: mu, effective: sets * sec.coefficient, direct: 0, coeff: sec.coefficient });
    }
    // Особый: для дельт per-head — перераспределяем shoulders indirect по головкам если block мышца shoulders
    if (direct === 'shoulders') {
      // уже обработано в indirect; direct остаётся shoulders но пер-head анализ покажет shoulders как aggregate
      // Для детального — разбиваем shoulders direct по головкам эвристикой имени
      const nm = (block.exerciseName || '').toLowerCase();
      let head = 'shoulders';
      if (/задн|rear|обратн|лиц.*тяга|face.*pull/i.test(nm)) head = 'delt_rear';
      else if (/жим|press|армей|overhead|военный/i.test(nm) && !/мах|lateral/i.test(nm)) head = 'delt_front';
      else if (/мах|lateral|отведен|raise/i.test(nm)) head = 'delt_mid';
      if (head !== 'shoulders') {
        result[0].muscle = head;
      }
    }
  }
  return result;
}

export interface ManualVolumeWeek {
  week: number;
  phase: string;
  deload: boolean;
  sessions: Array<{
    sessionIdx: number;
    name: string;
    directSets: number;
    effectiveSets: number;
    exerciseCount: number;
  }>;
  totals: Record<string, { direct: number; effective: number }>;
}

export interface ManualVolumeAnalysis {
  weeks: ManualVolumeWeek[];
  /** Пиковый effective по мышце за весь мезоцикл */
  peakEffective: Record<string, number>;
  peakDirect: Record<string, number>;
  avgEffective: Record<string, number>;
  avgDirect: Record<string, number>;
  weeklyBudget: number;
  sessionLimits: { weeklyWorkingSets: number; maxWorkingSets: number; maxExercises: number };
  /** issues для валидации */
  issues: { level: 'error'|'warning'|'info'; code: string; message: string; muscle?: string; week?: number }[];
  perExerciseCaps: Array<{ exercise: string; muscle: string; sets: number; cap: number; week: number }>;
}

/**
 * Главный анализатор объёма ручного плана.
 * Считает effective (direct + indirect) per-head, чекает капы.
 */
export function analyzeManualVolume(
  program: UserProgram,
  level: string,
  opts?: {
    onCourse?: boolean;
    courseIntensity?: string;
    recoveryScore?: number;
    calorieSurplus?: number;
    proteinPerKg?: number;
    labMrvMultiplier?: number;
    trainingYears?: number;
    trainingVolumeMode?: 'standard'|'high';
    patternId?: string;
  },
): ManualVolumeAnalysis {
  const weeksSrc: UserWeek[] = program.bb?.weeks ?? (program.hybrid?.bbWeeks as UserWeek[] | undefined) ?? [];
  const weeklyBudget = computeBBWeeklyBudget({
    onCourse: opts?.onCourse,
    courseIntensity: opts?.courseIntensity,
    recoveryScore: opts?.recoveryScore ?? 80,
    calorieSurplus: opts?.calorieSurplus,
    proteinPerKg: opts?.proteinPerKg,
    labMrvMultiplier: opts?.labMrvMultiplier,
  });
  const sessionLimits = sessionLimitsFor({
    onCourse: opts?.onCourse,
    courseIntensity: opts?.courseIntensity,
    recoveryScore: opts?.recoveryScore ?? 80,
    calorieSurplus: opts?.calorieSurplus,
    proteinPerKg: opts?.proteinPerKg,
    labMrvMultiplier: opts?.labMrvMultiplier,
    level,
    trainingYears: opts?.trainingYears,
    trainingVolumeMode: opts?.trainingVolumeMode,
  }, { id: opts?.patternId });

  const weeks: ManualVolumeWeek[] = [];
  const peakEffective: Record<string, number> = {};
  const peakDirect: Record<string, number> = {};
  const sumEffective: Record<string, number> = {};
  const sumDirect: Record<string, number> = {};
  const issues: ManualVolumeAnalysis['issues'] = [];
  const perExerciseCaps: ManualVolumeAnalysis['perExerciseCaps'] = [];

  for (const w of weeksSrc) {
    const totals: Record<string, { direct: number; effective: number }> = {};
    const sessions: ManualVolumeWeek['sessions'] = [];
    let weekTotalEffective = 0;
    for (let si = 0; si < (w.sessions?.length ?? 0); si++) {
      const s = w.sessions[si];
      let sessDirect = 0;
      let sessEffective = 0;
      for (const b of (s.blocks ?? [])) {
        const contribs = contributionForBlock(b);
        for (const c of contribs) {
          if (!totals[c.muscle]) totals[c.muscle] = { direct: 0, effective: 0 };
          if (c.coeff === 1) {
            totals[c.muscle].direct += c.direct;
            totals[c.muscle].effective += c.effective;
          } else {
            // indirect: только effective
            if (!totals[c.muscle]) totals[c.muscle] = { direct: 0, effective: 0 };
            totals[c.muscle].effective += c.effective;
          }
        }
        const directSets = b.sets?.length || 0;
        sessDirect += directSets;
        // indirect для сессии: сумма effective по всем contributes / direct? приближённо sessEffective = direct + indirect
        // Для простоты: считаем sessEffective как сумма effective всех contributes где coeff===1 + 0.4*остальных
        // Но contributionForBlock уже отдаёт effective, так что sessEffective += sum(c.effective) где direct muscle? Для сессии общий — берём direct + 0.3* indirect условно
        // Более точно: sessEffective = directSets + сумма indirect effective*0.2 — но для капа сессии используем directSets (как в BB: maxWorkingSets считает direct)
        sessEffective += directSets; // капа считаем по direct (как BB)
        // per-exercise cap
        const cap = perExerciseCap(level, b.muscle, opts?.trainingYears);
        if (directSets > cap) {
          perExerciseCaps.push({ exercise: b.exerciseName, muscle: b.muscle, sets: directSets, cap, week: w.week });
          // не пушим issue здесь — соберём после цикла weeks
        }
      }
      sessions.push({ sessionIdx: si, name: s.name, directSets: sessDirect, effectiveSets: sessEffective, exerciseCount: s.blocks.length });
      // session cap check
      if (sessDirect > sessionLimits.maxWorkingSets) {
        issues.push({ level: 'warning', code: 'SESSION_SETS_EXCEED', message: `Нед ${w.week} ${s.name}: ${sessDirect} сетов > лимита ${sessionLimits.maxWorkingSets}`, week: w.week });
      }
      if (s.blocks.length > sessionLimits.maxExercises) {
        issues.push({ level: 'warning', code: 'SESSION_EX_EXCEED', message: `Нед ${w.week} ${s.name}: ${s.blocks.length} упр > лимита ${sessionLimits.maxExercises}`, week: w.week });
      }
    }
    // weekly budget: сумма effective по muscles вне IGNORE
    for (const [mu, val] of Object.entries(totals)) {
      if (IGNORE_BUDGET_MUSCLES.has(mu)) continue;
      weekTotalEffective += val.effective;
      sumEffective[mu] = (sumEffective[mu] || 0) + val.effective;
      sumDirect[mu] = (sumDirect[mu] || 0) + val.direct;
      peakEffective[mu] = Math.max(peakEffective[mu] || 0, val.effective);
      peakDirect[mu] = Math.max(peakDirect[mu] || 0, val.direct);
    }
    // недельный бюджет — общий кап (warning)
    if (weekTotalEffective > weeklyBudget) {
      issues.push({ level: 'warning', code: 'WEEKLY_BUDGET_EXCEED', message: `Нед ${w.week}: effective ${Math.round(weekTotalEffective)} > недельного бюджета ${weeklyBudget}`, week: w.week });
    }
    weeks.push({ week: w.week, phase: w.phase, deload: !!w.deload, sessions, totals });
  }

  const nWeeks = Math.max(1, weeks.length);
  const avgEffective: Record<string, number> = {};
  const avgDirect: Record<string, number> = {};
  for (const k of new Set([...Object.keys(sumEffective), ...Object.keys(sumDirect)])) {
    avgEffective[k] = Math.round((sumEffective[k] || 0) / nWeeks);
    avgDirect[k] = Math.round((sumDirect[k] || 0) / nWeeks);
  }

  // per-exercise cap issues
  for (const c of perExerciseCaps) {
    issues.push({ level: 'warning', code: 'EXERCISE_CAP_EXCEED', message: `${c.exercise} (${c.muscle}): ${c.sets} сетов > капа ${c.cap} (нед ${c.week})`, muscle: c.muscle, week: c.week });
  }

  return { weeks, peakEffective, peakDirect, avgEffective, avgDirect, weeklyBudget, sessionLimits, issues, perExerciseCaps };
}

/** RIR drift: floor((phaseWeek-1)/2) — каждые 2 недели -1 RIR (как bb-builder). */
export function rirDriftForPhaseWeek(phaseWeek: number): number {
  return Math.floor(Math.max(0, phaseWeek - 1) / 2);
}

/** Phase rep shift: -1 каждые 2 недели внутри accumulation/intensification. */
export function phaseRepShift(phase: string, phaseWeek: number, isDeload: boolean): number {
  if (isDeload) return 0;
  if (phase === 'accumulation' || phase === 'intensification') return -Math.floor((phaseWeek - 1) / 2);
  return 0;
}

/** Tempo с учётом фазы — делегат в bb-tempo-rest. */
export { tempoFor } from '../bb/bb-tempo-rest';

/** Прогнозируемая пирамида разминки: bar×15→50%×10→70%×5→80%×3→90%×1 (как bb-builder buildWarmup). */
export function warmupPyramidFor(weight: number): Array<{ load: number; reps: number }> {
  if (!Number.isFinite(weight) || weight <= 0) return [];
  const out: Array<{ load: number; reps: number }> = [];
  out.push({ load: Math.round(20 * 10) / 10, reps: 15 }); // bar 20кг условно, но если weight<30 — просто % от weight
  // Если weight < 60 — упрощённая пирамида из % веса (как bb-builder)
  if (weight < 30) return [{ load: Math.round(weight * 0.5), reps: 10 }];
  const steps: Array<[number, number]> = [
    [0.5, 10],
    [0.7, 5],
    [0.8, 3],
  ];
  for (const [pct, reps] of steps) {
    if (weight * pct < 30) continue;
    out.push({ load: Math.round(weight * pct * 10) / 10, reps });
  }
  if (weight >= 100) out.push({ load: Math.round(weight * 0.9 * 10) / 10, reps: 1 });
  // Убрать bar если weight маленький и bar 20 > 50%
  if (out.length > 1 && out[0].load >= out[1].load) out.shift();
  return out;
}
