/**
 * arm-finalize.engine.ts — 12 пассов финализации арм-плана.
 * Зеркало bb-finalize.engine.ts.
 */
import type { ArmPlan } from './arm-types';
import { getArmLandmarks } from './arm-volume-landmarks.engine';
import { perExerciseCap } from './arm-volume.engine';

function ensurePronSupBalance(plan: ArmPlan): void {
  for (const wk of plan.weeks) {
    let pron = 0, sup = 0;
    for (const sess of wk.sessions) for (const ex of sess.exercises) {
      if (ex.muscle === 'pronators') pron += ex.sets;
      if (ex.muscle === 'supinators') sup += ex.sets;
    }
    if (pron > 0 && sup === 0) {
      // добавить супинацию в последнюю сессию
      const last = wk.sessions[wk.sessions.length - 1];
      if (last && last.exercises.length < 6) {
        last.exercises.push({
          muscle: 'supinators' as any, name: 'Супинация молотком', role: 'accessory', character: 'памп' as any,
          sets: 2, repsRange: [10,15], rir: 2,
          workSets: [{ reps: 12, rir: 2, weight: 0, restSeconds: 90 }],
          movementPattern: 'supination' as any, substitutionGroup: 'supination',
        });
      }
    } else if (sup > 0 && pron === 0) {
      const last = wk.sessions[wk.sessions.length - 1];
      if (last && last.exercises.length < 6) {
        last.exercises.push({
          muscle: 'pronators' as any, name: 'Пронация на блоке (90)', role: 'accessory', character: 'памп' as any,
          sets: 2, repsRange: [8,12], rir: 2,
          workSets: [{ reps: 10, rir: 2, weight: 0, restSeconds: 90 }],
          movementPattern: 'pronation' as any, substitutionGroup: 'pronation',
        });
      }
    }
    // баланс ≤1.5×
    if (pron > 0 && sup > 0 && Math.max(pron, sup) / Math.max(1, Math.min(pron, sup)) > 1.5) {
      plan.rationale.push(`Н${wk.week}: баланс pron/sup ${pron}/${sup} >1.5× — добавлен антагонист`);
    }
  }
}

function ensureFlexExtBalance(plan: ArmPlan): void {
  for (const wk of plan.weeks) {
    let flex = 0, ext = 0;
    for (const sess of wk.sessions) for (const ex of sess.exercises) {
      if (ex.muscle === 'wrist_flexors') flex += ex.sets;
      if (ex.muscle === 'wrist_extensors') ext += ex.sets;
    }
    if (flex > 0 && ext === 0 && flex >= 6) {
      const last = wk.sessions[wk.sessions.length - 1];
      if (last) {
        last.exercises.push({
          muscle: 'wrist_extensors' as any, name: 'Разгибание кисти со штангой', role: 'accessory', character: 'памп' as any,
          sets: 2, repsRange: [12,20], rir: 2,
          workSets: [{ reps: 15, rir: 2, weight: 0, restSeconds: 60 }],
        });
      }
    }
  }
}

function ensureSidePressureGuard(plan: ArmPlan): void {
  for (const wk of plan.weeks) {
    if (wk.week <= 4) {
      for (const sess of wk.sessions) {
        for (const ex of sess.exercises) {
          if (ex.muscle === 'side_pressure' && ex.sets > 3) {
            ex.sets = 3;
            ex.workSets = ex.workSets.slice(0, 3);
            ex.rir = Math.max(ex.rir, 2);
          }
        }
      }
    }
    // RIR≥2 на side
    for (const sess of wk.sessions) for (const ex of sess.exercises) {
      if (ex.muscle === 'side_pressure' && ex.rir < 2) ex.rir = 2;
    }
  }
}

function ensureTableTime(plan: ArmPlan, targetRatio: number): void {
  for (const wk of plan.weeks) {
    const tableSess = wk.sessions.filter(s => s.tableTime).length;
    const ratio = tableSess / Math.max(1, wk.sessions.length);
    if (ratio < 0.3 && targetRatio >= 0.5) {
      // пометить warning, не ломаем структуру
      plan.rationale.push(`Н${wk.week}: table time ${(ratio*100).toFixed(0)}% <30% при цели 50% — добавить стол`);
    }
  }
}

function capEnforcement(plan: ArmPlan, level: string): void {
  for (const wk of plan.weeks) {
    const weekly: Record<string, number> = {};
    for (const sess of wk.sessions) for (const ex of sess.exercises) {
      weekly[ex.muscle] = (weekly[ex.muscle] || 0) + ex.sets;
    }
    for (const [mus, sets] of Object.entries(weekly)) {
      const mrv = plan.mrvByMuscle?.[mus] || getArmLandmarks(level, mus).mrv;
      if (sets > mrv) {
        // режем accessory первым
        let over = sets - mrv;
        for (const sess of wk.sessions) {
          for (const ex of sess.exercises) {
            if (over <= 0) break;
            if (ex.muscle !== mus) continue;
            if (ex.role === 'accessory' && ex.sets > 1) {
              const cut = Math.min(over, ex.sets - 1);
              ex.sets -= cut;
              ex.workSets = ex.workSets.slice(0, ex.sets);
              over -= cut;
            }
          }
        }
        // если still over — режем primary до cap
        if (over > 0) {
          for (const sess of wk.sessions) for (const ex of sess.exercises) {
            if (over <= 0) break;
            if (ex.muscle !== mus) continue;
            const cap = perExerciseCap(mus, level);
            if (ex.sets > cap) {
              const cut = Math.min(over, ex.sets - cap);
              ex.sets -= cut;
              ex.workSets = ex.workSets.slice(0, ex.sets);
              over -= cut;
            }
          }
        }
      }
    }
  }
}

function enforceSessionLimits(plan: ArmPlan, level: string): void {
  const maxEx = level === 'enhanced' ? 8 : 6;
  for (const wk of plan.weeks) for (const sess of wk.sessions) {
    if (sess.exercises.length > maxEx) {
      // удаляем accessory последними
      const toRemove = sess.exercises.length - maxEx;
      const accessoryIdx: number[] = [];
      sess.exercises.forEach((ex, i) => { if (ex.role === 'accessory') accessoryIdx.push(i); });
      // удаляем с конца
      let removed = 0;
      for (let i = sess.exercises.length - 1; i >= 0 && removed < toRemove; i--) {
        if (sess.exercises[i].role === 'accessory' || removed >= accessoryIdx.length) {
          sess.exercises.splice(i, 1);
          removed++;
        }
      }
    }
  }
}

function orderSessionExercises(plan: ArmPlan): void {
  for (const wk of plan.weeks) for (const sess of wk.sessions) {
    sess.exercises.sort((a,b) => {
      const aScore = a.isTable ? 0 : a.muscle === 'pronators' ? 1 : a.muscle === 'supinators' ? 1 : 2;
      const bScore = b.isTable ? 0 : b.muscle === 'pronators' ? 1 : b.muscle === 'supinators' ? 1 : 2;
      return aScore - bScore;
    });
  }
}

function assignHoldsAndStatics(plan: ArmPlan): void {
  for (const wk of plan.weeks) for (const sess of wk.sessions) {
    if (sess.character === 'техника' || sess.character === 'лёг') {
      for (const ex of sess.exercises) {
        if (['grip_support','grip_pinch','grip_crush'].includes(ex.muscle)) {
          ex.holdSeconds = 10;
          ex.workSets.forEach(ws => ws.holdSeconds = 10);
        }
        if (ex.muscle === 'wrist_flexors' && sess.character === 'техника') {
          ex.isStatic = true;
          ex.workSets.forEach(ws => { ws.technique = 'isometric'; ws.holdSeconds = 10; });
        }
      }
    }
  }
}

function dedupeAngles(plan: ArmPlan): void {
  // Не повторять один workingAngle два дня подряд — помечаем, но не ломаем
  const seen = new Set<string>();
  for (const wk of plan.weeks) for (const sess of wk.sessions) for (const ex of sess.exercises) {
    if (!ex.workingAngle) continue;
    const key = `${ex.muscle}-${ex.workingAngle.elbowDeg}-${ex.workingAngle.direction}`;
    if (seen.has(key) && wk.week <= 2) {
      // rotate direction
      const dirs: Array<'to_little'|'to_middle'|'to_thumb'> = ['to_little','to_middle','to_thumb'];
      const curIdx = dirs.indexOf(ex.workingAngle.direction);
      ex.workingAngle.direction = dirs[(curIdx + 1) % 3];
    }
    seen.add(key);
  }
}

function injectTendonConditioning(plan: ArmPlan, level: string): void {
  if (level !== 'beginner') return;
  for (const wk of plan.weeks) {
    if (wk.week > 2) continue;
    for (const sess of wk.sessions) {
      const hasTendon = sess.exercises.some(e => ['wrist_flexors','pronators'].includes(e.muscle));
      if (!hasTendon) continue;
      for (const ex of sess.exercises) {
        if (['wrist_flexors','pronators','supinators'].includes(ex.muscle) && ex.sets < 4) {
          // tendon high-rep
          ex.repsRange = [15,20];
          ex.workSets.forEach(ws => ws.reps = 15);
        }
      }
    }
  }
}

function ensureGripCoverage(plan: ArmPlan): void {
  // если grip специализация — обеспечить support+pinch
  const hasGripSpec = plan.specializationSchedule?.blocks.some(b => b.targets.some(t => t.includes('grip')));
  if (!hasGripSpec) return;
  for (const wk of plan.weeks) {
    let hasSupport = false, hasPinch = false;
    for (const sess of wk.sessions) for (const ex of sess.exercises) {
      if (ex.muscle === 'grip_support') hasSupport = true;
      if (ex.muscle === 'grip_pinch') hasPinch = true;
    }
    if (!hasSupport) {
      const last = wk.sessions[wk.sessions.length-1];
      if (last) last.exercises.push({
        muscle: 'grip_support' as any, name: 'Rolling Thunder (вращающаяся ручка)', role: 'accessory', character: 'памп' as any,
        sets: 2, repsRange: [5,8], rir: 2, workSets: [{ reps: 5, rir: 2, weight: 0 }],
      });
    }
    if (!hasPinch) {
      const last = wk.sessions[wk.sessions.length-1];
      if (last && last.exercises.length < 6) last.exercises.push({
        muscle: 'grip_pinch' as any, name: 'Щипок блинов (удержание)', role: 'accessory', character: 'памп' as any,
        sets: 2, repsRange: [1,1], rir: 2, workSets: [{ reps: 1, rir: 2, weight: 0, holdSeconds: 10 }],
      });
    }
  }
}

export function finalizeArmPlan(plan: ArmPlan, opts?: { level?: string; tableRatio?: number }): ArmPlan {
  const level = opts?.level || plan.level || 'intermediate';
  const tableRatio = opts?.tableRatio ?? 0.55;

  ensurePronSupBalance(plan);
  ensureFlexExtBalance(plan);
  ensureSidePressureGuard(plan);
  ensureGripCoverage(plan);
  ensureTableTime(plan, tableRatio);
  capEnforcement(plan, level);
  enforceSessionLimits(plan, level);
  orderSessionExercises(plan);
  assignHoldsAndStatics(plan);
  dedupeAngles(plan);
  injectTendonConditioning(plan, level);

  // Итоговый пересчёт weeklyVolume
  const weeklyVolume: Record<number, any> = {};
  for (const wk of plan.weeks) {
    const vol: Record<string, any> = {};
    for (const sess of wk.sessions) for (const ex of sess.exercises) {
      if (!vol[ex.muscle]) vol[ex.muscle] = { directSets: 0, effectiveSets: 0, tendonSets: 0, fatigueWeightedSets: 0 };
      vol[ex.muscle].directSets += ex.sets;
      vol[ex.muscle].effectiveSets += ex.sets;
      vol[ex.muscle].fatigueWeightedSets += ex.sets;
    }
    weeklyVolume[wk.week] = vol;
  }
  plan.weeklyVolume = weeklyVolume;
  return plan;
}
