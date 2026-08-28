/**
 * manual-progression.engine.ts — PRO-прогрессия для ручного конструктора.
 *
 * Фаза 3: double progression bulk, e1RM из дневника, VBT, 2-for-2, linear/wave/rpe_based.
 * Переиспользует bb-autocoach prescribeLoad + diary-autoreg findLastFact + estimate1rm consensus/VBT.
 */

import type { UserProgram, UserWeek, UserBlock, UserSet } from '../user-program/user-program.types';
import { prescribeLoad, type LoadStrategy } from '../bb/bb-autocoach.engine';
import { findLastFact } from '../pro/diary-autoreg.engine';
import { estimate1RMConsensus, estimate1RMFromVelocity } from '../pro/estimate1rm.engine';
import { loadForRPE } from '../pro/autoregulation-pro.engine';
import type { WorkoutLog } from '../../core/types';

/** 2-for-2 правило (NSCA): если последние 2 тренировки превысили цель на +2 reps → +weight. */
export interface TwoForTwoState {
  exerciseName: string;
  targetReps: number;
  history: Array<{ date: string; reps: number; weight: number }>;
  shouldBump: boolean;
}

/** Проверить 2-for-2 по истории последних сетов (последние 2 дня где reps >= target+2). */
export function checkTwoForTwo(targetReps: number, history: Array<{ reps: number }>): boolean {
  if (history.length < 2) return false;
  const last2 = history.slice(-2);
  return last2.every(h => h.reps >= targetReps + 2);
}

export interface BulkProgressOpts {
  strategy: LoadStrategy;
  totalWeeks: number;
  /** Фаза для repCap/growth (если не указана — берётся из UserWeek.phase). */
  phase?: string;
  /** Пропускать deload недели (по умолчанию true). */
  skipDeload?: boolean;
  /** workMax по мышцам для pct режима */
  workMax?: Record<string, number>;
  /** Тип нагрузки для прироста (для linear: compound/isolation) */
  exTypeByMuscle?: Record<string, string>;
}

export interface BulkProgressResult {
  program: UserProgram;
  changedBlocks: number;
  deloadSkipped: number;
  plateauDetected: string[];
}

/**
 * Применить прогрессию ко всем блокам в диапазоне недель [fromWeek, toWeek] включительно.
 * - double_progression: repCap изоляция 15/12 vs compound 12/8, +1 rep до капа иначе ×1.05 weight
 * - linear: +1.0-2.5кг/нед по типу
 * - wave/rpe_based: по формуле prescribeLoad
 * - deload недели пропускаются
 * - предыдущая deload неделя — база для прогрессии сбрасывается (не прогрессируем от заниженной)
 */
export function bulkProgressWeeks(
  program: UserProgram,
  fromWeek: number,
  toWeek: number,
  opts: BulkProgressOpts,
): BulkProgressResult {
  const skipDeload = opts.skipDeload ?? true;
  const weeks = program.bb?.weeks ?? (program.hybrid?.bbWeeks as UserWeek[] | undefined);
  if (!weeks) return { program, changedBlocks: 0, deloadSkipped: 0, plateauDetected: [] };
  let changedBlocks = 0;
  let deloadSkipped = 0;
  const plateauDetected: string[] = [];

  const clonedWeeks = JSON.parse(JSON.stringify(weeks)) as UserWeek[];

  // Найти deload недели для сброса базы
  const isDeloadWeek = (w: UserWeek) => !!w.deload || w.phase === 'deload';

  for (const w of clonedWeeks) {
    if (w.week < fromWeek || w.week > toWeek) continue;
    if (skipDeload && isDeloadWeek(w)) { deloadSkipped++; continue; }
    const prevWeek = clonedWeeks.find(pw => pw.week === w.week - 1);
    const prevIsDeload = prevWeek ? isDeloadWeek(prevWeek) : false;
    if (prevIsDeload) {
      // Сброс базы — не прогрессируем веса от заниженной deload (как в bb-builder prescribeLoad)
      // Оставляем веса недели как есть, но обновляем RIR по фазе
      // Для простоты — пропускаем прогрессию веса на неделе после deload, только RIR/tempo уже фазовые
      continue;
    }
    const phase = (opts.phase || w.phase || 'accumulation') as string;
    for (const s of w.sessions) {
      for (const b of s.blocks) {
        const isCompound = b.type === 'compound' || b.type === 'power_main';
        const exType = isCompound ? 'compound' : (opts.exTypeByMuscle?.[b.muscle] || (b.type === 'isolation' ? 'isolation' : 'accessory'));
        const role = b.role || (isCompound ? 'primary' : 'accessory');
        // Берём последний сет как базу для прогрессии (как в bb-builder)
        if (!b.sets || b.sets.length === 0) continue;
        const baseSet = b.sets[b.sets.length - 1];
        const curWeight = typeof baseSet.weight === 'number' ? baseSet.weight : 0;
        if (curWeight <= 0) continue; // bodyweight — не прогрессируем вес
        const curReps = typeof baseSet.reps === 'number' ? baseSet.reps : parseInt(String(baseSet.reps), 10) || 8;
        const curRir = typeof baseSet.rir === 'number' ? baseSet.rir : 2;
        const maxW = opts.workMax?.[b.muscle] || curWeight * 1.5 + 20; // fallback
        const prescr = prescribeLoad(opts.strategy, curWeight, curReps, curRir, maxW, w.week, opts.totalWeeks, phase, exType, role as any);
        // Применяем ко всем сетам блока
        for (const st of b.sets) {
          // repCap логика уже внутри prescribeLoad — здесь просто применяем nextWeight/nextReps/nextRIR
          if (typeof st.weight === 'number') st.weight = prescr.nextWeight;
          // nextReps только если double_progression и reps < repCap — иначе оставляем план
          if (opts.strategy === 'double_progression') {
            if (curReps < (exType === 'isolation' ? 15 : 12)) {
              if (typeof st.reps === 'number') st.reps = prescr.nextReps;
            } else {
              // weight jump — reps сбрасывается к repCap-4
              if (typeof st.reps === 'number') st.reps = prescr.nextReps;
            }
          }
          if (typeof st.rir === 'number') st.rir = prescr.nextRIR;
        }
        changedBlocks++;
      }
    }
  }

  const newProgram: UserProgram = JSON.parse(JSON.stringify(program));
  if (newProgram.bb) newProgram.bb.weeks = clonedWeeks as UserWeek[];
  else if (newProgram.hybrid) (newProgram.hybrid as any).bbWeeks = clonedWeeks;

  return { program: newProgram, changedBlocks, deloadSkipped, plateauDetected };
}

/** e1RM из дневника по упражнению — suggest вес для плана. */
export function suggestWeightFromDiary(
  exerciseName: string,
  historyWorkouts: WorkoutLog[],
  planned: { reps: number; rir: number },
): { suggestedWeight: number; e1RM: number; fact: ReturnType<typeof findLastFact>; note: string } | null {
  const fact = findLastFact(historyWorkouts, exerciseName);
  if (!fact) return null;
  const targetRpe = 10 - planned.rir;
  // Используем consensus e1RM если есть несколько формул — более стабильно чем один epley
  const consensus = estimate1RMConsensus(fact.lastSet.weight, fact.lastSet.reps);
  const e1RM = consensus.value || fact.e1RM;
  if (e1RM <= 0) return null;
  // loadForRPE через rpeFromLoad inverse — используем простую таблицу: weight = e1RM * pctForRir
  // Упрощённо: e1RM * (1 - (10 - targetRpe)*0.033) ??? Но точнее — через autoreg loadForRPE
  // Используем rpe прокси: PCT_FOR_RIR[rir] — но здесь без импорта, делаем via estimate
  // Для планового RIR и reps: weight = e1RM / (1 + reps/30) * (1 - rir*0.025) approx
  // Сделаем через consensus inverse: brute force search weight that gives targetRpe close to planned
  // Упростим: suggested = e1RM * 0.75 для RIR2/8reps — эмпирика: 8 reps RIR2 ≈ 75% 1RM (Epley)
  // Точнее — используем epley inverse: weight = e1RM / (1 + reps/30) * (1 - (5 - rir)*0.02) ?
  // Для PRO — используем loadForRPE если доступен, иначе Epley прямой
  let suggested = 0;
  try {
    suggested = loadForRPE(e1RM, targetRpe, planned.reps);
  } catch {
    // fallback Epley
    suggested = Math.round((e1RM / (1 + planned.reps / 30)) * 10) / 10;
  }
  const pct = Math.round((suggested / e1RM) * 100);
  const note = `e1RM ${e1RM}кг (по ${fact.lastSet.weight}×${fact.lastSet.reps} ${fact.date}) → ${suggested}кг @ ${planned.reps}×RIR${planned.rir} (${pct}% 1RM)`;
  return { suggestedWeight: Math.round(suggested * 10) / 10, e1RM, fact, note };
}

/** VBT: скорость штанги → e1RM → suggested вес для целевого RIR/reps. */
export function suggestWeightFromVelocity(
  exerciseName: string,
  velocityMs: number,
  currentWeight: number,
  target: { reps: number; rir: number },
): { e1RM: number; pct1RM: number; suggested: number; note: string } | null {
  if (!velocityMs || velocityMs <= 0 || currentWeight <= 0) return null;
  // Определяем лифт по имени (squat/bench/deadlift fallback squat)
  const name = (exerciseName || '').toLowerCase();
  let lift = 'squat';
  if (/жим.*лёжа|bench/i.test(name)) lift = 'bench';
  else if (/станов|deadlift|тяга.*стан/i.test(name)) lift = 'deadlift';
  const { e1RM, pct1RM } = estimate1RMFromVelocity(lift, velocityMs, currentWeight);
  if (e1RM <= 0) return null;
  let suggested = currentWeight;
  try {
    suggested = loadForRPE(e1RM, 10 - target.rir, target.reps);
  } catch {
    suggested = Math.round((e1RM / (1 + target.reps / 30)) * 10) / 10;
  }
  const note = `VBT ${velocityMs} м/с @ ${currentWeight}кг → e1RM ${e1RM}кг (${Math.round(pct1RM*100)}% ) → ${Math.round(suggested*10)/10}кг @ ${target.reps}×RIR${target.rir}`;
  return { e1RM, pct1RM, suggested: Math.round(suggested*10)/10, note };
}

/** Групповой прогресс: применить к выделенному диапазону недель и вернуть diff-отчёт. */
export function diffBulkProgress(
  before: UserProgram,
  after: UserProgram,
): Array<{ week: number; exercise: string; before: string; after: string }> {
  const out: Array<{ week: number; exercise: string; before: string; after: string }> = [];
  const bWeeks = before.bb?.weeks ?? (before.hybrid?.bbWeeks as any[]) ?? [];
  const aWeeks = after.bb?.weeks ?? (after.hybrid?.bbWeeks as any[]) ?? [];
  for (let i = 0; i < Math.min(bWeeks.length, aWeeks.length); i++) {
    const bw = bWeeks[i] as UserWeek, aw = aWeeks[i] as UserWeek;
    for (let si = 0; si < Math.min(bw.sessions.length, aw.sessions.length); si++) {
      const bs = bw.sessions[si], as = aw.sessions[si];
      for (let bi = 0; bi < Math.min(bs.blocks.length, as.blocks.length); bi++) {
        const bb = bs.blocks[bi], ab = as.blocks[bi];
        const bSet = bb.sets[0], aSet = ab.sets[0];
        if (!bSet || !aSet) continue;
        const bStr = `${bSet.weight ?? 0}кг×${bSet.reps} RIR${bSet.rir}`;
        const aStr = `${aSet.weight ?? 0}кг×${aSet.reps} RIR${aSet.rir}`;
        if (bStr !== aStr) out.push({ week: aw.week, exercise: ab.exerciseName, before: bStr, after: aStr });
      }
    }
  }
  return out;
}
