/**
 * arm-tradeoff.engine.ts — донорское перераспределение для арм-планировщика.
 * Зеркало bb-tradeoff.engine.ts — per-week снятие прямых изоляций донора до MEV.
 */
import type { ArmPlan } from './arm-types';
import { getArmLandmarks } from './arm-volume-landmarks.engine';

export interface ArmTradeoffPolicy {
  mode: 'none' | 'reduce_direct_to_floor' | 'remove_direct_when_indirect_covers_floor';
  donorMuscles: string[];
  preserveIndirect?: boolean;
}

export function normalizeArmTradeoff(policy: any): ArmTradeoffPolicy {
  if (!policy || !policy.donorMuscles || policy.donorMuscles.length === 0) return { mode: 'none', donorMuscles: [] };
  const mode = policy.mode === 'remove_direct_when_indirect_covers_floor' ? 'remove_direct_when_indirect_covers_floor'
    : policy.mode === 'reduce_direct_to_floor' ? 'reduce_direct_to_floor' : 'none';
  return { mode, donorMuscles: policy.donorMuscles.map((s: string) => s.toLowerCase()), preserveIndirect: !!policy.preserveIndirect };
}

export function applyArmTradeoffToPlan(
  plan: ArmPlan,
  schedule: { blocks: Array<{ weekStart: number; weekEnd: number; targets: string[]; tradeoff?: any }> },
  level: string,
): ArmPlan {
  if (!schedule || !schedule.blocks || schedule.blocks.length === 0) return plan;

  for (const block of schedule.blocks) {
    const policy = normalizeArmTradeoff(block.tradeoff);
    if (policy.mode === 'none' || policy.donorMuscles.length === 0) continue;
    const targets = (block.targets || []).map((s: string) => s.toLowerCase());
    if (targets.length === 0) continue;

    for (let w = block.weekStart; w <= block.weekEnd; w++) {
      const week = plan.weeks.find(x => x.week === w);
      if (!week) continue;

      for (const sess of week.sessions) {
        // Снимаем прямые изоляции доноров
        for (const ex of sess.exercises) {
          const mus = ex.muscle.toLowerCase();
          if (!policy.donorMuscles.includes(mus)) continue;
          if (ex.role !== 'primary' && ex.role !== 'accessory') continue;
          // Проверяем MEV floor
          const lm = getArmLandmarks(level, mus);
          // Считаем недельный объём донора
          const weeklySets = plan.weeks.find(x => x.week === w)?.sessions.reduce((s, ss) => s + ss.exercises.filter(e => e.muscle.toLowerCase() === mus).reduce((a, e) => a + e.sets, 0), 0) || 0;
          if (weeklySets <= lm.mev) continue; // уже на полу — не снимаем
          if (policy.mode === 'remove_direct_when_indirect_covers_floor') {
            // Если есть косвенная — снимаем
            // Упрощённо: если есть хотя бы один compound на неделе с indirect — снимаем 1 сет
            ex.sets = Math.max(1, ex.sets - 1);
            ex.workSets = ex.workSets.slice(0, ex.sets);
          } else if (policy.mode === 'reduce_direct_to_floor') {
            const toRemove = Math.min(ex.sets - 1, weeklySets - lm.mev);
            if (toRemove > 0) {
              ex.sets = Math.max(1, ex.sets - Math.min(1, toRemove));
              ex.workSets = ex.workSets.slice(0, ex.sets);
            }
          }
        }

        // Переносим освободившиеся сеты в цели (упрощённо: добавляем 1 сет к первому упражнению цели в сессии)
        for (const sess2 of week.sessions) {
          for (const t of targets) {
            const targetEx = sess2.exercises.find(e => e.muscle.toLowerCase() === t);
            if (targetEx) {
              const lm = getArmLandmarks(level, t);
              const weeklyT = week.sessions.reduce((s, ss) => s + ss.exercises.filter(e => e.muscle.toLowerCase() === t).reduce((a, e) => a + e.sets, 0), 0);
              if (weeklyT < lm.mrv) {
                targetEx.sets = Math.min(targetEx.sets + 1, 6);
                // Добавляем workSet копией последнего
                if (targetEx.workSets.length > 0) {
                  const last = targetEx.workSets[targetEx.workSets.length - 1];
                  targetEx.workSets.push({ ...last });
                }
                break;
              }
            }
          }
        }
      }
    }
  }
  return plan;
}
