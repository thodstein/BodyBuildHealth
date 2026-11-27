/**
 * arm-finalize.engine.ts — 12 пассов финализации арм-плана.
 * Зеркало bb-finalize.engine.ts.
 */
import type { ArmPlan } from './arm-types';
import { ARM_MUSCLES } from './arm-types';
import { ruCount, RU_EXERCISES } from '../ru-plural';
import { getArmLandmarks } from './arm-volume-landmarks.engine';
import { perExerciseCap, aggregateArmVolume, sessionLimitsForArm, armWeeklyVolumeFor } from './arm-volume.engine';
import { getArmCycle } from './arm-cycle-library.engine';
import { buildArmTaperCurve, applyArmTaperToWeeks, type ArmTaperMode } from './arm-taper.engine';
import { buildArmWarmupSets } from './arm-periodization.engine';
import {
  armInjuryRepsCap,
  armInjuryVolumeFactor,
  armInjuryWeightFactor,
  mobilityBlockReason,
} from './arm-injury-guard.engine';
import { isArmTendonMuscle } from './arm-tendon-sets.engine';
import { applyArmTradeoffToPlan } from './arm-tradeoff.engine';
import { ARM_MUSCLE_SG } from './arm-day-types';
import { ARM_EXERCISES } from '../../core/exercise-catalog-arm';
import { armEquipmentAllows } from './arm-builder.engine';

function ensurePronSupBalance(plan: ArmPlan): void {
  for (const wk of plan.weeks) {
    let pron = 0,
      sup = 0;
    for (const sess of wk.sessions)
      for (const ex of sess.exercises) {
        if (ex.muscle === 'pronators') pron += ex.sets;
        if (ex.muscle === 'supinators') sup += ex.sets;
      }
    if (pron > 0 && sup === 0) {
      // добавить супинацию в последнюю сессию
      const last = wk.sessions[wk.sessions.length - 1];
      if (last && last.exercises.length < 6) {
        last.exercises.push({
          muscle: 'supinators' as any,
          name: 'Супинация молотком',
          role: 'accessory',
          character: 'памп' as any,
          sets: 2,
          repsRange: [10, 15],
          rir: 2,
          workSets: [
            { reps: 12, rir: 2, weight: 0, restSeconds: 90 },
            { reps: 12, rir: 2, weight: 0, restSeconds: 90 },
          ],
          movementPattern: 'supination' as any,
          substitutionGroup: 'supination',
          loadMode: 'tool',
          provenance: 'finalizer',
          provenanceSource: 'arm-finalize:pron-sup-balance',
        });
      }
    } else if (sup > 0 && pron === 0) {
      const last = wk.sessions[wk.sessions.length - 1];
      if (last && last.exercises.length < 6) {
        last.exercises.push({
          muscle: 'pronators' as any,
          name: 'Пронация на блоке (90)',
          role: 'accessory',
          character: 'памп' as any,
          sets: 2,
          repsRange: [8, 12],
          rir: 2,
          workSets: [
            { reps: 10, rir: 2, weight: 0, restSeconds: 90 },
            { reps: 10, rir: 2, weight: 0, restSeconds: 90 },
          ],
          movementPattern: 'pronation' as any,
          substitutionGroup: 'pronation',
          loadMode: 'tool',
          provenance: 'finalizer',
          provenanceSource: 'arm-finalize:pron-sup-balance',
        });
      }
    }
    // баланс ≤1.5×
    if (pron > 0 && sup > 0 && Math.max(pron, sup) / Math.max(1, Math.min(pron, sup)) > 1.5) {
      // 26.10.2026: строка раньше утверждала «добавлен антагонист», хотя в этой
      // ветке ничего не добавлялось (антагонист ставится только при sup===0/pron===0).
      plan.rationale.push(
        `Н${wk.week}: баланс pron/sup ${pron}/${sup} >1.5× — проверьте распределение (добавление не выполнялось)`,
      );
    }
  }
}

function ensureFlexExtBalance(plan: ArmPlan): void {
  for (const wk of plan.weeks) {
    let flex = 0,
      ext = 0;
    for (const sess of wk.sessions)
      for (const ex of sess.exercises) {
        if (ex.muscle === 'wrist_flexors') flex += ex.sets;
        if (ex.muscle === 'wrist_extensors') ext += ex.sets;
      }
    if (flex > 0 && ext === 0 && flex >= 6) {
      const last = wk.sessions[wk.sessions.length - 1];
      if (last) {
        last.exercises.push({
          muscle: 'wrist_extensors' as any,
          name: 'Разгибание кисти со штангой',
          role: 'accessory',
          character: 'памп' as any,
          sets: 2,
          repsRange: [12, 20],
          rir: 2,
          workSets: [
            { reps: 15, rir: 2, weight: 0, restSeconds: 60 },
            { reps: 15, rir: 2, weight: 0, restSeconds: 60 },
          ],
          movementPattern: 'wrist_extension' as any,
          substitutionGroup: 'wrist_ext',
          loadMode: 'bodyweight',
          provenance: 'finalizer',
          provenanceSource: 'arm-finalize:flex-ext-balance',
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
    for (const sess of wk.sessions)
      for (const ex of sess.exercises) {
        if (ex.muscle === 'side_pressure' && ex.rir < 2) ex.rir = 2;
      }
  }
}

function tryTableSwap(plan: ArmPlan, wkIdx: number, why: string): boolean {
  const wk = plan.weeks[wkIdx];
  const supportIdx = wk.sessions.findIndex((s) => !s.tableTime && s.sessionTag === 'Support');
  if (supportIdx >= 0 && wk.sessions[supportIdx].exercises.length < 6) {
    wk.sessions[supportIdx].tableTime = true;
    wk.sessions[supportIdx].sessionTag = 'TableTech';
    wk.sessions[supportIdx].exercises.unshift({
      muscle: 'pronators' as any,
      name: 'Пронация на блоке (90)',
      role: 'primary',
      character: 'техника' as any,
      sets: 2,
      repsRange: [8, 12],
      rir: 3,
      workSets: [
        { reps: 10, rir: 3, weight: 0, restSeconds: 90 },
        { reps: 10, rir: 3, weight: 0, restSeconds: 90 },
      ],
      movementPattern: 'pronation' as any,
      substitutionGroup: 'pronation',
      isTable: true,
      loadMode: 'tool',
      provenance: 'finalizer',
      provenanceSource: 'arm-finalize:table-time',
    });
    plan.rationale.push(`Н${wk.week}: ${why} — автозамена Support→TableTech (Кузнецов VIII ≥50%)`);
    return true;
  }
  plan.rationale.push(`Н${wk.week}: ${why} — нет места под TableTech, добавьте стол вручную`);
  return false;
}

function ensureTableTime(plan: ArmPlan, targetRatio: number): void {
  // R8: минимум столовых сессий из именного цикла — только с cycleId и кроме
  // чистого армлифтинга (там стол другой природы; маппинг мутный — см. R7).
  // Без цикла — поведение байт-в-байт как раньше.
  let cycleTableFloor = 0;
  let cycleName = '';
  try {
    const cid = String((plan.inputSnapshot as any)?.cycleId || '');
    const c = cid ? getArmCycle(cid) : undefined;
    if (c && c.tablePerWeek > 0 && plan.discipline !== 'armlifting') {
      cycleTableFloor = c.tablePerWeek;
      cycleName = c.name;
    }
  } catch {
    cycleTableFloor = 0;
  }
  for (const wk of plan.weeks) {
    const tableSess = wk.sessions.filter((s) => s.tableTime).length;
    const ratio = tableSess / Math.max(1, wk.sessions.length);
    if (ratio < 0.3 && targetRatio >= 0.5) {
      // PRO: не только warning, но и swap одной Support сессии на TableTech если есть место
      tryTableSwap(plan, plan.weeks.indexOf(wk), `table time ${(ratio * 100).toFixed(0)}% <30% при цели 50%`);
    } else if (tableSess < cycleTableFloor) {
      tryTableSwap(
        plan,
        plan.weeks.indexOf(wk),
        `цикл ${cycleName} просит стол ${cycleTableFloor}×/нед, в плане ${tableSess}`,
      );
    }
  }
}

function capEnforcement(plan: ArmPlan, level: string): void {
  for (const wk of plan.weeks) {
    const weekly: Record<string, number> = {};
    for (const sess of wk.sessions)
      for (const ex of sess.exercises) {
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
          for (const sess of wk.sessions)
            for (const ex of sess.exercises) {
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
  // 26.10.2026 было→стало: кап сессии был хардкодом 6 (enhanced 8) — он отменял
  // исключение билдера sessionLimitsForArm (TableTech armwrestling = 7, armlifting 5/6,
  // recoveryMult<0.8 −1) и резал сессию слепым splice без гарда «не удалять
  // единственное упражнение мышцы». Теперь единый источник + тот же гард, что в билдере.
  for (const wk of plan.weeks)
    for (const sess of wk.sessions) {
      const disc = String(plan.discipline || 'armwrestling');
      const limits = sessionLimitsForArm({ level, discipline: disc, sessionTag: sess.sessionTag });
      if (sess.exercises.length > limits.maxExercises) {
        const toRemove = sess.exercises.length - limits.maxExercises;
        const priCount = sess.exercises.filter((e) => e.role !== 'accessory').length;
        let removed = 0;
        for (let i = sess.exercises.length - 1; i >= 0 && removed < toRemove; i--) {
          const ex = sess.exercises[i];
          if (
            ex.role === 'accessory' ||
            priCount + (sess.exercises.length - removed - priCount) > limits.maxExercises
          ) {
            const othersSameMus = sess.exercises.filter((e, idx) => e.muscle === ex.muscle && idx !== i).length;
            if (ex.role !== 'accessory' && othersSameMus === 0) continue;
            sess.exercises.splice(i, 1);
            removed++;
          }
        }
        if (sess.exercises.length > limits.maxExercises) sess.exercises.splice(limits.maxExercises);
      }
      // Потолок по времени сессии: режем сеты (accessory → самый объёмный),
      // не ниже 1 сета на упражнение. Объём мышцы и так ограничен MRV.
      let totalSets = sess.exercises.reduce((a, e) => a + (Number(e.sets) || 0), 0);
      if (totalSets > limits.maxSets) {
        const order = [...sess.exercises].sort((a, b) => {
          const ra = a.role === 'accessory' ? 0 : 1;
          const rb = b.role === 'accessory' ? 0 : 1;
          if (ra !== rb) return ra - rb;
          return (Number(b.sets) || 0) - (Number(a.sets) || 0);
        });
        for (const ex of order) {
          if (totalSets <= limits.maxSets) break;
          const canCut = Math.max(0, Number(ex.sets) - 1);
          if (canCut <= 0) continue;
          const cut = Math.min(canCut, totalSets - limits.maxSets);
          ex.sets = Number(ex.sets) - cut;
          ex.workSets = ex.workSets.slice(0, ex.sets);
          totalSets -= cut;
        }
      }
    }
}

function orderSessionExercises(plan: ArmPlan): void {
  for (const wk of plan.weeks)
    for (const sess of wk.sessions) {
      sess.exercises.sort((a, b) => {
        const aScore = a.isTable ? 0 : a.muscle === 'pronators' ? 1 : a.muscle === 'supinators' ? 1 : 2;
        const bScore = b.isTable ? 0 : b.muscle === 'pronators' ? 1 : b.muscle === 'supinators' ? 1 : 2;
        return aScore - bScore;
      });
    }
}

function assignHoldsAndStatics(plan: ArmPlan): void {
  for (const wk of plan.weeks)
    for (const sess of wk.sessions) {
      if (sess.character === 'техника' || sess.character === 'лёг') {
        for (const ex of sess.exercises) {
          if (['grip_support', 'grip_pinch', 'grip_crush'].includes(ex.muscle)) {
            ex.holdSeconds = 10;
            ex.workSets.forEach((ws) => (ws.holdSeconds = 10));
          }
          if (ex.muscle === 'wrist_flexors' && sess.character === 'техника') {
            ex.isStatic = true;
            ex.workSets.forEach((ws) => {
              ws.technique = 'isometric';
              ws.holdSeconds = 10;
            });
          }
        }
      }
    }
}

function dedupeAngles(plan: ArmPlan): void {
  // Не повторять один workingAngle два дня подряд — помечаем, но не ломаем.
  // Сет `seen` сбрасывается на каждой неделе: раньше он жил на весь план, и
  // проверка внутри недели 2 была слепой к повторам первой недели.
  for (const wk of plan.weeks) {
    const seen = new Set<string>();
    for (const sess of wk.sessions)
      for (const ex of sess.exercises) {
        if (!ex.workingAngle) continue;
        const key = `${ex.muscle}-${ex.workingAngle.elbowDeg}-${ex.workingAngle.direction}`;
        if (seen.has(key) && wk.week <= 2) {
          // rotate direction
          const dirs: Array<'to_little' | 'to_middle' | 'to_thumb'> = ['to_little', 'to_middle', 'to_thumb'];
          const curIdx = dirs.indexOf(ex.workingAngle.direction);
          ex.workingAngle.direction = dirs[(curIdx + 1) % 3];
        }
        seen.add(key);
      }
  }
}

function injectTendonConditioning(plan: ArmPlan, level: string): void {
  // PRO: tendon conditioning для всех уровней первые 2 недели (beginner — обязательно 3с eccentric)
  const isBeginner = level === 'beginner';
  const limitWeek = isBeginner ? 4 : 2;
  for (const wk of plan.weeks) {
    if (wk.week > limitWeek) continue;
    for (const sess of wk.sessions) {
      const hasTendon = sess.exercises.some((e) => isArmTendonMuscle(e.muscle));
      if (!hasTendon) continue;
      for (const ex of sess.exercises) {
        if (isArmTendonMuscle(ex.muscle)) {
          // GripStrength F1: 3с negative для tendon, high-rep 15-20, RPE 5-6
          if (ex.sets <= 4) {
            ex.repsRange = [15, 20];
            ex.workSets.forEach((ws) => {
              ws.reps = 15;
              if (isBeginner) ws.tempo = '3-1-1-0';
            });
          }
          // extensor band — обязателен как антагонист (3×20-25)
          if (ex.muscle === 'wrist_flexors' && isBeginner) {
            ex.comment = (ex.comment || '') + ' | 3с эксцентрик — tendon remodeling (GripStrength F1)';
          }
        }
      }
    }
  }
  // Новички: 3 месяца без 100% спарринга — предупреждение если side_pressure в первые 4н >0
  if (isBeginner) {
    for (const wk of plan.weeks.slice(0, 4)) {
      for (const sess of wk.sessions) {
        for (const ex of sess.exercises) {
          if (ex.muscle === 'side_pressure' && ex.sets > 2) {
            plan.rationale.push(`Н${wk.week}: новичкам side_pressure ≤2 первые 4н (humerus, 3 мес без 100% спарринга)`);
          }
        }
      }
    }
  }
}

function ensureGripCoverage(plan: ArmPlan): void {
  // если grip специализация — обеспечить support+pinch
  const hasGripSpec = plan.specializationSchedule?.blocks.some((b) => b.targets.some((t) => t.includes('grip')));
  if (!hasGripSpec) return;
  for (const wk of plan.weeks) {
    let hasSupport = false,
      hasPinch = false;
    for (const sess of wk.sessions)
      for (const ex of sess.exercises) {
        if (ex.muscle === 'grip_support') hasSupport = true;
        if (ex.muscle === 'grip_pinch') hasPinch = true;
      }
    if (!hasSupport) {
      const last = wk.sessions[wk.sessions.length - 1];
      // Лимит сессии: без проверки упражнение добавлялось в полную сессию и тут же
      // вылетало в enforceSessionLimits (работа впустую + мусор в rationale).
      const supportLimit = last
        ? sessionLimitsForArm({
            level: String(plan.level || 'intermediate'),
            discipline: plan.discipline,
            sessionTag: last.sessionTag,
          })
        : null;
      if (last && (!supportLimit || last.exercises.length < supportLimit.maxExercises))
        last.exercises.push({
          muscle: 'grip_support' as any,
          name: 'Rolling Thunder (вращающаяся ручка)',
          role: 'accessory',
          character: 'памп' as any,
          sets: 2,
          repsRange: [5, 8],
          rir: 2,
          workSets: [
            { reps: 5, rir: 2, weight: 0 },
            { reps: 5, rir: 2, weight: 0 },
          ],
          movementPattern: 'grip_support' as any,
          substitutionGroup: 'grip_support',
          loadMode: 'tool',
          provenance: 'finalizer',
          provenanceSource: 'arm-finalize:grip-coverage',
        });
    }
    if (!hasPinch) {
      const last = wk.sessions[wk.sessions.length - 1];
      if (last && last.exercises.length < 6)
        last.exercises.push({
          muscle: 'grip_pinch' as any,
          name: 'Щипок блинов (удержание)',
          role: 'accessory',
          character: 'памп' as any,
          sets: 2,
          repsRange: [1, 1],
          rir: 2,
          workSets: [
            { reps: 1, rir: 2, weight: 0, holdSeconds: 10 },
            { reps: 1, rir: 2, weight: 0, holdSeconds: 10 },
          ],
          movementPattern: 'grip_pinch' as any,
          substitutionGroup: 'grip_pinch',
          loadMode: 'tool',
          provenance: 'finalizer',
          provenanceSource: 'arm-finalize:grip-coverage',
        });
    }
  }
}

function ensureCocCoverage(plan: ArmPlan): void {
  // CoC-режим (cocWorking задан): crush-эспандер обязан быть в каждой неделе.
  // IronMind: crush без work-сетов не растёт; extensor-баланс уже закрыт гардами.
  const coc = String((plan.inputSnapshot as any)?.cocWorking || '');
  if (!coc) return;
  for (const wk of plan.weeks) {
    let hasCrush = false;
    for (const sess of wk.sessions)
      for (const ex of sess.exercises) {
        if (ex.muscle === 'grip_crush') {
          hasCrush = true;
          break;
        }
      }
    if (hasCrush) continue;
    const last = wk.sessions[wk.sessions.length - 1];
    if (last && last.exercises.length < 6) {
      last.exercises.push({
        muscle: 'grip_crush' as any,
        name: 'Эспандер CoC (дробление)',
        role: 'accessory',
        character: 'памп' as any,
        sets: 2,
        repsRange: [5, 7],
        rir: 2,
        workSets: [
          { reps: 6, rir: 2, weight: 0 },
          { reps: 6, rir: 2, weight: 0 },
        ],
        movementPattern: 'grip_crush' as any,
        substitutionGroup: 'grip_crush',
        comment: 'CoC work 1–3×5–7 в отказ (тройка warm/work/challenge — см. rationale)',
        loadMode: 'tool',
        provenance: 'finalizer',
        provenanceSource: 'arm-finalize:coc-coverage',
      });
      plan.rationale.push(`Н${wk.week}: CoC — добавлен work-эспандер 2×5–7 (режим ${coc})`);
    }
  }
}

function enforceInputSafety(plan: ArmPlan): void {
  const snap = (plan.inputSnapshot as any) || {};
  const injuries = Array.isArray(snap.injuries) ? snap.injuries : [];
  const restrictions = Array.isArray(snap.mobilityRestrictions) ? snap.mobilityRestrictions : [];
  for (const wk of plan.weeks) {
    for (const sess of wk.sessions) {
      const before = sess.exercises.length;
      sess.exercises = sess.exercises.filter((ex) => {
        if (armInjuryVolumeFactor(injuries, ex.muscle) <= 0) return false;
        if (mobilityBlockReason(ex, restrictions)) return false;
        return true;
      });
      for (const ex of sess.exercises) {
        // Билдер уже применил травму к 'catalog'; добавленное пассами
        // (finalizer/diagnostic/manual) масштабируем здесь ОДИН раз.
        // MEV-floor уже учёл травму в дозе и весе — повторно не трогаем.
        const alreadyDosed = ex.provenance === 'catalog' || ex.provenanceSource === 'arm-finalize:mev-floor';
        const factor = alreadyDosed ? 1 : armInjuryVolumeFactor(injuries, ex.muscle);
        const weightFactor = alreadyDosed ? 1 : armInjuryWeightFactor(injuries, ex.muscle);
        const repsCap = armInjuryRepsCap(injuries, ex.muscle);
        ex.sets = Math.max(1, Math.round(ex.sets * factor));
        ex.workSets = ex.workSets.slice(0, ex.sets).map((ws) => ({
          ...ws,
          weight: Math.round(ws.weight * weightFactor * 2) / 2,
          reps: repsCap == null || ws.reps === 'AMRAP' ? ws.reps : Math.min(Number(ws.reps) || 1, repsCap),
        }));
        if (repsCap != null) ex.repsRange = [Math.min(ex.repsRange[0], repsCap), Math.min(ex.repsRange[1], repsCap)];
      }
      if (sess.exercises.length !== before) {
        plan.rationale.push(
          `Н${wk.week} ${sess.sessionTag}: safety-фильтр снял ${ruCount(before - sess.exercises.length, RU_EXERCISES)} по травме/мобильности.`,
        );
      }
    }
  }
}

function applyCycleTaperPreset(plan: ArmPlan): void {
  // Единственный тейпер-путь для non-classic пресетов: кривая библиотеки на
  // хвостовые делоад/пик-недели. Билдер их заранее не резал (weekMult 1.0).
  // applyArmTaperToWeeks идемпотентен по маркеру [arm-taper:].
  const cid = String((plan.inputSnapshot as any)?.cycleId || '');
  if (!cid) return;
  const preset = getArmCycle(cid)?.taperPreset;
  if (!preset || preset === 'classic' || preset === 'none') return;
  // Хвост = непрерывный run делоад/пик с конца (паритет с билдером).
  const tailRev: typeof plan.weeks = [];
  for (let i = plan.weeks.length - 1; i >= 0; i--) {
    const wk = plan.weeks[i];
    if ((wk as any).deload || (wk as any).taper || wk.phase === 'peaking') tailRev.unshift(wk);
    else break;
  }
  if (tailRev.length === 0) return;
  const curve = buildArmTaperCurve({ taperWeeks: Math.min(4, tailRev.length), mode: preset as ArmTaperMode });
  if (curve.length === 0) return;
  // Передаём ссылки хвоста: движок режет последние N переданного массива.
  applyArmTaperToWeeks(tailRev as any, curve);
  plan.rationale.push(
    `Тейпер-пресет ${preset}: кривая ${curve.map((p) => `${p.volumePct}`).join('/')} на ${curve.length} нед хвоста.`,
  );
}

/**
 * P1-6: косвенный объём в MRV-контроле — эффективные (прямые+косвенные) сеты
 * больше MRV×1.15 → честный warning (не срез; поведение плана не меняется).
 */
export function armIndirectOverflowWarnings(plan: ArmPlan, level: string): string[] {
  // Одна строка на мышцу (пиковая неделя), а не 8–12 дублей — иначе отчёт
  // утопает в повторах и пользователь учится игнорировать предупреждения.
  const worst: Record<string, { week: number; effective: number; mrv: number }> = {};
  for (const wk of plan.weeks) {
    const agg = aggregateArmVolume([wk as any]);
    for (const [muscle, v] of Object.entries(agg)) {
      const mrv = plan.mrvByMuscle?.[muscle] ?? getArmLandmarks(level, muscle).mrv;
      if (!Number.isFinite(mrv) || mrv <= 0) continue;
      if (v.effectiveSets > mrv * 1.15 + 0.001) {
        if (!worst[muscle] || v.effectiveSets > worst[muscle].effective) {
          worst[muscle] = { week: wk.week, effective: v.effectiveSets, mrv };
        }
      }
    }
  }
  return Object.entries(worst).map(
    ([muscle, w]) =>
      `Н${w.week}: ${muscle} эффективный объём ${Math.round(w.effective * 10) / 10} > MRV ${w.mrv}×1.15 (косвенная нагрузка учтена) — проверьте баланс.`,
  );
}

/**
 * MEV-floor: недельный объём мышцы не должен оставаться ниже её же MEV.
 *
 * 26.10.2026 — новый пасс. Билдер выдаёт один слот на мышцу за сессию, а
 * per-exercise cap (5, для side 3) физически меньше MEV у 7–8 мышц: brachialis,
 * brachioradialis, risers, supinators, grip_support, core_anchor, extensors
 * НИКОГДА не добирали свой MEV ни в одном плане (проверено дампом 5 профилей:
 * brachialis 5 при MEV 8, grip_support 5 при MEV 6, ext 2 при MEV 6). Валидатор
 * честно печатал «мало стимула» каждую неделю — 100–200 предупреждений на план,
 * которые пользователь учится игнорировать.
 *
 * Пасс добирает дефицит до min(MEV, targetSets, MRV): сначала расширяет уже
 * стоящее упражнение до cap, затем добавляет ВТОРОЕ упражнение той же группы
 * замены в сессию, где есть место по лимиту. Делод/тейпер/пик не трогаются
 * (низкий объём там — цель, а не дефицит).
 */
function ensureMevFloor(plan: ArmPlan, level: string): void {
  if ((plan as any)._mevFloorApplied) return;
  (plan as any)._mevFloorApplied = true;
  const snap: any = plan.inputSnapshot || {};
  const restrictions: string[] = Array.isArray(snap.mobilityRestrictions) ? snap.mobilityRestrictions : [];
  const equipment: string[] = Array.isArray(snap.equipment) ? snap.equipment : [];
  const injuries = snap.injuries;
  let addedSets = 0;

  for (const wk of plan.weeks) {
    if (wk.deload || wk.taper || wk.phase === 'deload' || wk.phase === 'peaking') continue;
    // Stress-неделя (0.55) намеренно ниже MEV — добивка «до минимума» вернула бы
    // её к MEV и стёрла волну 3/2/1 (нашёл аудит: floor брался без weekMult).
    const weekScale = Number((wk as any).weekMult);
    const scale = Number.isFinite(weekScale) && weekScale > 0 ? weekScale : 1;
    if (scale < 0.7) continue;
    const totals: Record<string, number> = {};
    for (const sess of wk.sessions)
      for (const ex of sess.exercises) totals[ex.muscle] = (totals[ex.muscle] || 0) + ex.sets;
    // Сухожильный бюджет недели: если он уже выше внутреннего ориентира (18),
    // MEV-floor не добавляет сухожильным мышцам — иначе добор «до минимума»
    // раздувает tendon-нагрузку и блокирует инъекции диагностики. Бюджет
    // сухожилий связывающий: он и есть ограничение, а не MEV.
    const weekTendon = Object.entries(totals)
      .filter(([m]) => isArmTendonMuscle(m))
      .reduce((a, [, v]) => a + v, 0);
    const tendonBudgetExceeded = weekTendon >= 18;
    for (const mus of ARM_MUSCLES) {
      if (tendonBudgetExceeded && isArmTendonMuscle(mus)) continue;
      const lm = getArmLandmarks(level, mus);
      const target = Number(plan.volumeTargets?.[mus]?.targetSets ?? 0);
      const mrv = Number(plan.mrvByMuscle?.[mus] ?? lm.mrv);
      const floor = Math.round(Math.min(lm.mev, target > 0 ? target : lm.mev, mrv) * scale);
      const cur = totals[mus] || 0;
      if (floor <= 0 || cur <= 0 || cur >= floor) continue;
      if (armInjuryVolumeFactor(injuries, mus) <= 0) continue;
      // Травма — тот же множитель, что в enforceInputSafety: иначе «добивка до
      // MEV» возвращала бы травмированной мышце полный минимум.
      const injuryFloor = armInjuryVolumeFactor(injuries, mus);
      let need = Math.round(floor * injuryFloor) - cur;
      if (need <= 0) continue;
      // 1) расширяем существующие упражнения мышцы до per-exercise cap
      for (const sess of wk.sessions) {
        const limits = sessionLimitsForArm({ level, discipline: plan.discipline, sessionTag: sess.sessionTag });
        let sessionSets = sess.exercises.reduce((a, e) => a + (Number(e.sets) || 0), 0);
        for (const ex of sess.exercises) {
          if (need <= 0) break;
          if (ex.muscle !== mus) continue;
          const cap = perExerciseCap(mus, level);
          if (ex.sets >= cap) continue;
          const add = Math.min(need, cap - ex.sets, Math.max(0, limits.maxSets - sessionSets));
          if (add <= 0) continue;
          const last = ex.workSets[ex.workSets.length - 1];
          for (let i = 0; i < add; i++) {
            ex.workSets.push(
              last
                ? { ...last, rir: Math.min(5, (Number(last.rir) || 0) + 1) }
                : { reps: ex.repsRange[0], rir: 3, weight: 0 },
            );
          }
          ex.sets += add;
          totals[mus] += add;
          addedSets += add;
          sessionSets += add;
          need -= add;
        }
        if (need <= 0) break;
      }
      if (need <= 0) continue;
      // 2) второе упражнение той же группы замены — в самую короткую сессию с местом
      const groups = ARM_MUSCLE_SG[mus] || [];
      for (const sess of [...wk.sessions].sort((a, b) => a.exercises.length - b.exercises.length)) {
        if (need <= 0) break;
        const limits = sessionLimitsForArm({ level, discipline: plan.discipline, sessionTag: sess.sessionTag });
        if (sess.exercises.length >= limits.maxExercises) continue;
        const sessionSets = sess.exercises.reduce((a, e) => a + (Number(e.sets) || 0), 0);
        if (sessionSets >= limits.maxSets) continue;
        const usedHere = new Set(sess.exercises.map((e) => e.exerciseId).filter(Boolean) as string[]);
        // Стабильный выбор внутри недели: не первый попавшийся, а позиция по
        // номеру недели — иначе одна и та же мышца получала НОВОЕ упражнение
        // каждую неделю (12 недель → 7 разных молотов).
        const pool = ARM_EXERCISES.filter((e) => {
          if (usedHere.has(e.id)) return false;
          const sg = String(e.substitutionGroup || '').toLowerCase();
          const mp = String(e.movementPattern || '').toLowerCase();
          if (!groups.some((g) => sg === g || sg.includes(g) || mp.includes(g))) return false;
          if (mobilityBlockReason(e, restrictions)) return false;
          if (!armEquipmentAllows(String(e.equipment || ''), equipment)) return false;
          return true;
        });
        const tpl = pool[wk.week % Math.max(1, pool.length)];
        if (!tpl) continue;
        const cap = perExerciseCap(mus, level);
        const sets = Math.max(1, Math.min(need, cap, limits.maxSets - sessionSets));
        const donor = wk.sessions.flatMap((s) => s.exercises).find((e) => e.muscle === mus);
        const baseSet = donor?.workSets?.[0];
        const character = (donor?.character || 'памп') as any;
        const workSets = Array.from({ length: sets }, () =>
          baseSet ? { ...baseSet, rir: Math.min(5, (Number(baseSet.rir) || 0) + 1) } : { reps: 12, rir: 3, weight: 0 },
        );
        // Тяжёлое упражнение с весом получает такую же разминочную рампу, как в
        // билдере: иначе добавка MEV ломает контракт «у всех тяжёлых есть разминка».
        const topW = Math.max(0, ...workSets.map((x) => Number(x.weight) || 0));
        const warmup = character === 'тяж' && topW > 0 ? buildArmWarmupSets(topW) : [];
        sess.exercises.push({
          muscle: mus as any,
          name: tpl.name,
          role: 'accessory',
          character,
          sets,
          repsRange: donor?.repsRange || [10, 15],
          rir: Math.max(2, donor?.rir ?? 3),
          workSets,
          ...(warmup.length ? { warmupSets: warmup } : {}),
          movementPattern: tpl.movementPattern as any,
          substitutionGroup: tpl.substitutionGroup,
          exerciseId: tpl.id,
          equipment: tpl.equipment,
          loadMode: tpl.equipment === 'bodyweight' ? 'bodyweight' : tpl.equipment === 'band' ? 'band' : 'tool',
          provenance: 'finalizer',
          provenanceSource: 'arm-finalize:mev-floor',
          comment: 'добивка до MEV (второе упражнение группы)',
        });
        totals[mus] += sets;
        addedSets += sets;
        need -= sets;
      }
    }
  }
  if (addedSets > 0) {
    plan.rationale.push(
      `MEV-floor: +${ruCount(addedSets, RU_EXERCISES)} — добор мышц, которым per-exercise cap не давал дойти до минимума (не в делоде/тейпере).`,
    );
  }
}

export function finalizeArmPlan(plan: ArmPlan, opts?: { level?: string; tableRatio?: number }): ArmPlan {
  const level = opts?.level || plan.level || 'intermediate';
  // 26.10.2026: ratio брался хардкодом 0.55 — для армлифтинга билдер ставит 0.2,
  // но финализатор снова требовал стол и мог добавить TableTech с пронацией.
  const snapRatio = Number((plan.inputSnapshot as any)?.tableTimeRatio);
  const tableRatio =
    opts?.tableRatio ??
    (Number.isFinite(snapRatio) && snapRatio > 0 ? snapRatio : plan.discipline === 'armlifting' ? 0.2 : 0.55);

  ensurePronSupBalance(plan);
  ensureFlexExtBalance(plan);
  ensureSidePressureGuard(plan);
  ensureGripCoverage(plan);
  ensureCocCoverage(plan);
  // Стол — ДО кривой тейпера: иначе добавка 2 сетов пронации ложится
  // в уже срезанную хвостовую неделю мимо кривой (нашёл аудит).
  ensureTableTime(plan, tableRatio);
  applyCycleTaperPreset(plan);
  // PRO-PLAN P0-3: донорское перераспределение явных блоков специализации
  // (legacy-блоки без tradeoff — no-op; повторная финализация защищена флагом).
  try {
    const sched = plan.specializationSchedule;
    const hasTradeoff = !!(sched?.active && sched.blocks?.some((b: any) => b.tradeoff));
    if (hasTradeoff && !(plan as any)._tradeoffApplied) {
      applyArmTradeoffToPlan(plan, sched as any, level);
      (plan as any)._tradeoffApplied = true;
      plan.rationale.push(
        `Донорское перераспределение: снятие прямых изоляций доноров до MEV в блоке(ах) специализации.`,
      );
    }
  } catch {
    plan.rationale.push('⚠ Донорское перераспределение недоступно — специализация без снятия доноров.');
  }
  capEnforcement(plan, level);
  ensureMevFloor(plan, level);
  enforceSessionLimits(plan, level);
  orderSessionExercises(plan);
  assignHoldsAndStatics(plan);
  dedupeAngles(plan);
  injectTendonConditioning(plan, level);
  enforceInputSafety(plan);
  // P1-6: эффективный объём (прямой+косвенный) в MRV-контроле — warning (идемпотентно).
  try {
    if (!(plan as any)._indirectChecked) {
      const lines = armIndirectOverflowWarnings(plan, level);
      if (lines.length) {
        if (!plan.safetyWarnings) plan.safetyWarnings = [];
        const seen = new Set(plan.safetyWarnings);
        for (const l of lines)
          if (!seen.has(l)) {
            plan.safetyWarnings.push(l);
            seen.add(l);
          }
      }
      (plan as any)._indirectChecked = true;
    }
  } catch {
    /* опционально */
  }

  // Итоговый пересчёт weeklyVolume (прямой + косвенный — единый источник)
  const weeklyVolume: Record<number, any> = {};
  for (const wk of plan.weeks) weeklyVolume[wk.week] = armWeeklyVolumeFor([wk as any]);
  plan.weeklyVolume = weeklyVolume;
  return plan;
}
