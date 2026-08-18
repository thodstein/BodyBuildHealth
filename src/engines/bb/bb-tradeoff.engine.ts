/**
 * bb-tradeoff.engine.ts — донорское перераспределение ресурса специализации.
 *
 * Режим «цель за счёт доноров»: прямые изоляции мышц-доноров снижаются или
 * убираются, косвенная нагрузка (тяги → бицепс, жимы → трицепс) сохраняется,
 * effective volume донора не опускается ниже его MEV (floor). Освобождённый
 * ресурс направляется в паттерн-совпадающие упражнения целевой зоны в
 * пределах adapted MRV, per-exercise cap 5 и лимитов сессии.
 *
 * Базовая объёмная модель (MEV/MAV/MRV, level, PED, recovery, nutrition, lab)
 * здесь НЕ меняется: это слой поверх уже рассчитанного плана.
 */

import type { BBPlan, BBWeek, BBExercise } from './bb-builder.engine';
import { aggregateBBVolume } from './bb-volume.engine';
import { canonicalMuscle, expandDonorMuscles, type VolumeTradeoffPolicy } from './bb-specialization.engine';
import { matchesAnyZonePattern } from './bb-specialization-registry';
import { getVolumeLandmarks } from '../volume-landmarks.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { trueMuscleOf } from '../movement-pattern';

export interface TradeoffApplyOptions {
  level: string;
  mrvByMuscle: Record<string, number>;
  workMax: Record<string, number>;
  equipment: string[];
  maxExercisesPerSession: number;
  maxWorkingSetsPerSession: number;
}

export interface TradeoffWeekReport {
  week: number;
  removedSets: number;
  transferredSets: number;
  unusedSets: number;
  donors: string[];
  mode: VolumeTradeoffPolicy['mode'];
  notes: string[];
}

/** Убрать прямую работу донора, включая primary compounds, сохраняя
 *  effective ≥ адаптированный MEV.
 *  Floor масштабируется тем же соотношением, что и MRV-кап (PED, стаж,
 *  recovery, nutrition, lab, spec-факторы) — без новых коэффициентов. */
function trimDonorIsolations(
  week: BBWeek,
  donorCanonical: Set<string>,
  mode: VolumeTradeoffPolicy['mode'],
  opts: TradeoffApplyOptions,
): number {
  const volume = aggregateBBVolume(week.sessions);
  const removed: number[] = [0];
  const directNow = (m: string) => volume[m]?.directSets ?? 0;
  const effectiveNow = (m: string) => volume[m]?.effectiveSets ?? 0;
  const adaptedMev = (m: string): number => {
    const lm = getVolumeLandmarks(opts.level, m);
    if (!lm) return 4;
    const adaptedMrv = opts.mrvByMuscle[m] ?? lm.mrv;
    if (lm.mrv <= 0) return lm.mev;
    return Math.max(1, Math.round(lm.mev * (adaptedMrv / lm.mrv)));
  };

  for (const session of week.sessions) {
    for (const ex of session.exercises as BBExercise[]) {
      if ((ex as any).warmupActivator) continue;
      const m = canonicalMuscle(ex.muscle);
      if (!donorCanonical.has(m)) continue;
      const floor = adaptedMev(m);
      const indirect = effectiveNow(m) - directNow(m);
      const targetDirect = mode === 'remove_direct_when_indirect_covers_floor' && indirect >= floor
        ? 0
        : Math.max(0, floor - indirect);
      // Снимаем сеты с упражнения, пока direct выше целевого.
      while ((ex.sets ?? 0) > 0 && directNow(m) > targetDirect) {
        ex.sets -= 1;
        if (Array.isArray(ex.workSets) && ex.workSets.length > ex.sets) {
          ex.workSets = ex.workSets.slice(0, ex.sets);
        }
        volume[m].directSets -= 1;
        volume[m].effectiveSets = Math.max(volume[m].directSets, (volume[m].effectiveSets ?? 0) - 1);
        removed[0] += 1;
      }
      // Упражнение без сетов удаляем из сессии целиком.
      if ((ex.sets ?? 0) <= 0) {
        session.exercises = session.exercises.filter(e => e !== ex);
      }
    }
  }
  return removed[0];
}

/** Добавить сеты получателю в паттерн-совпадающие упражнения (cap 5). */
function addToRecipient(
  week: BBWeek,
  targetCanonical: Set<string>,
  targets: string[],
  opts: TradeoffApplyOptions,
  budget: number,
): { transferred: number; notes: string[] } {
  const notes: string[] = [];
  let transferred = 0;
  const usedNames = new Set(week.sessions.flatMap(s => s.exercises.map(e => e.exerciseName || e.name)));
  const volume = () => aggregateBBVolume(week.sessions);

  for (const session of week.sessions) {
    if (transferred >= budget) break;
    // Сначала поднимаем существующие паттерн-совпадающие упражнения.
    for (const ex of session.exercises as BBExercise[]) {
      if (transferred >= budget) break;
      if ((ex as any).warmupActivator) continue;
      const m = canonicalMuscle(ex.muscle);
      if (!targetCanonical.has(m)) continue;
      if (!matchesAnyZonePattern(ex.exerciseName || ex.name || '', targets)) continue;
      const cap = opts.mrvByMuscle[m] ?? getVolumeLandmarks(opts.level, m)?.mrv ?? 16;
      while (transferred < budget && (ex.sets ?? 0) < 5) {
        // Пересчитываем после КАЖДОГО добавленного сета: stale eff раньше
        // позволял пройти несколько сетов по одной и той же проверке MRV.
        const eff = volume()[m]?.effectiveSets ?? 0;
        const workingSets = session.exercises.filter(e => !(e as any).warmupActivator).reduce((a, e) => a + (e.sets || 0), 0);
        if (eff + 1 > cap || workingSets + 1 > opts.maxWorkingSetsPerSession) break;
        ex.sets += 1;
        const template = (ex.workSets && ex.workSets[ex.workSets.length - 1]) || { reps: 10, rir: 2, weight: 0, restSeconds: 90 };
        ex.workSets = [...(ex.workSets || []), { ...template }];
        transferred += 1;
      }
    }
    // Если бюджета не хватило на существующие — пробуем добавить новое
    // паттерн-совпадающее упражнение целевой мышцы.
    if (transferred < budget && session.exercises.filter(e => !(e as any).warmupActivator).length < opts.maxExercisesPerSession) {
      for (const m of targetCanonical) {
        if (transferred >= budget) break;
        const cap = opts.mrvByMuscle[m] ?? getVolumeLandmarks(opts.level, m)?.mrv ?? 16;
        const eff = volume()[m]?.effectiveSets ?? 0;
        if (eff + 3 > cap) continue;
        const workingSets = session.exercises.filter(e => !(e as any).warmupActivator).reduce((a, e) => a + (e.sets || 0), 0);
        if (workingSets + 3 > opts.maxWorkingSetsPerSession) continue;
        const candidate = EXERCISE_CATALOG.find((c: any) => {
          if (trueMuscleOf(c) !== m) return false;
          if (usedNames.has(c.name)) return false;
          if (!matchesAnyZonePattern(c.name || '', targets)) return false;
          if (opts.equipment.length > 0) {
            const eq = Array.isArray(c.equipment) ? c.equipment : [String(c.equipment || '')];
            if (eq.length > 0 && !eq.some((x: string) => opts.equipment.includes(x))) return false;
          }
          return true;
        });
        if (!candidate) continue;
        const baseWeight = Math.max(5, Math.round((opts.workMax[m] || 50) * 0.55 * 10) / 10);
        const template = session.exercises[0];
        session.exercises.push({
          ...(template || {}),
          muscle: m,
          name: candidate.name,
          exerciseName: candidate.name,
          role: 'accessory',
          character: 'памп',
          sets: Math.min(3, budget - transferred),
          repsRange: [10, 12],
          rir: 2,
          restSeconds: 75,
          workSets: Array.from({ length: Math.min(3, budget - transferred) }, () => ({ reps: 12, rir: 2, weight: baseWeight, restSeconds: 75 })),
          comment: `🔁 Перенос ресурса специализации: ${candidate.name} (целевая зона ${targets.join(', ')})`,
          warmupSets: [],
          rationale: 'Donor-transfer: ресурс доноров направлен в целевую зону.',
        } as any);
        usedNames.add(candidate.name);
        transferred += Math.min(3, budget - transferred);
      }
    }
  }
  if (transferred < budget) {
    notes.push(`Не перенесено ${budget - transferred} сетов: нет room (MRV/session cap) в целевой зоне`);
  }
  return { transferred, notes };
}

/** Применить донорскую политику к одной неделе плана. */
export function applyTradeoffToWeek(
  week: BBWeek,
  targets: string[],
  policy: VolumeTradeoffPolicy,
  opts: TradeoffApplyOptions,
): TradeoffWeekReport {
  const donorCanonical = new Set(expandDonorMuscles(policy.donorMuscles).map(canonicalMuscle));
  const targetCanonical = new Set(targets.map(canonicalMuscle));
  const removedSets = trimDonorIsolations(week, donorCanonical, policy.mode, opts);
  const { transferred, notes } = addToRecipient(week, targetCanonical, targets, opts, removedSets);
  return {
    week: week.week,
    removedSets,
    transferredSets: transferred,
    unusedSets: Math.max(0, removedSets - transferred),
    donors: policy.donorMuscles,
    mode: policy.mode,
    notes,
  };
}

/** Применить политики всех недель плана по расписанию специализации. */
export function applyTradeoffToPlan(
  plan: BBPlan,
  policyForWeek: (week: number) => VolumeTradeoffPolicy | null,
  targetsForWeek: (week: number) => string[],
  opts: TradeoffApplyOptions,
): TradeoffWeekReport[] {
  const reports: TradeoffWeekReport[] = [];
  for (const week of plan.weeks) {
    const policy = policyForWeek(week.week);
    if (!policy || policy.mode === 'none' || policy.donorMuscles.length === 0) continue;
    if ((week as any).phase === 'deload' || week.deload) continue;
    const targets = targetsForWeek(week.week);
    if (targets.length === 0) continue;
    const report = applyTradeoffToWeek(week, targets, policy, opts);
    reports.push(report);
  }
  return reports;
}
