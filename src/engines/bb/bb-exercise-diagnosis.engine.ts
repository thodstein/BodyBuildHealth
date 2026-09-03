/**
 * bb-exercise-diagnosis.engine.ts — диагностика одного упражнения (ББ-проработка).
 * 12 флагов: sfr/профиль/сустав/подрегион/строгая/угол/unilateral + паттерн/темп/ROM/техника/mindMuscle + profGap.
 */
import { calcExerciseEffect, type BBExerciseEffect } from './bb-exercise-effect.engine';
import { getResistanceProfile } from '../../ui/screens/TrainingScreen_parts/ExerciseLabShared';
import { calcTechniqueScore } from '../../ui/screens/TrainingScreen_parts/ExerciseLabShared';
import { isMobilityRestricted } from './bb-mobility.engine';
import { getProfExecutionProfile, diagnoseExecutionProf } from './bb-execution-prof.engine';
import { derivePattern } from '../movement-pattern';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { getExerciseBio } from '../../data/exercise-biomechanics-db';

export type DiagnosisFlag =
  | 'lowSFRHighFatigue'
  | 'wrongProfileForGoal'
  | 'jointRisk'
  | 'uncoveredSubregion'
  | 'missingStrict'
  | 'singleAngle'
  | 'unilateralGap'
  | 'patternMismatch'
  | 'tempoMismatch'
  | 'romGap'
  | 'executionGap'
  | 'mindMuscleGap'
  | 'tutGap'
  | 'profGap';

export interface DiagnosisCtx {
  goal?: string; // hypertrophy | strength | endurance
  level?: string;
  weakZones?: string[];
  weakMusclesCanonical?: string[];
  muscle?: string; // каноническая мышца упражнения
  mobilityFails?: number;
  asymPct?: number | null;
  planTempo?: string | null;
  planPauseSeconds?: number | null;
  planReps?: number | null;
  singleAngleMuscle?: string | null; // если мышца имеет 1 угол при ≥6 сетов
  uncoveredSubregions?: string[]; // из аудита
  strictMissing?: string[]; // строгие группы мышцы, отсутствующие в плане
}

export interface ExerciseDiagnosis {
  effect: BBExerciseEffect;
  flags: DiagnosisFlag[];
  issues: string[];
  score: number; // 0-100
  profGaps: ReturnType<typeof diagnoseExecutionProf>;
}

function isWeakFor(muscle: string, weakZones?: string[], weakCanon?: string[]): boolean {
  const m = String(muscle || '').toLowerCase();
  if (weakCanon && weakCanon.map(s => String(s).toLowerCase()).includes(m)) return true;
  if (weakZones && weakZones.map(s => String(s).toLowerCase()).includes(m)) return true;
  // гранулярные зоны мапятся через includes
  if (weakZones && weakZones.some(z => String(z).toLowerCase().includes(m) || m.includes(String(z).toLowerCase()))) return true;
  return false;
}

export function diagnoseExercise(
  ex: { id?: string; name?: string; muscle?: string; group?: string; sets?: number; rir?: number; tempo?: string; pauseSeconds?: number; stretchPhase?: boolean },
  ctx: DiagnosisCtx = {},
): ExerciseDiagnosis {
  const muscle = String(ctx.muscle || ex.muscle || '').toLowerCase() || null;
  const effect = calcExerciseEffect(ex as any, { muscle: muscle || undefined, goal: ctx.goal as any, level: ctx.level });
  const flags: DiagnosisFlag[] = [];
  const issues: string[] = [];

  // 1 lowSFRHighFatigue: SFR≤3 + fatigueCost≥7
  if (effect.sfr != null && effect.sfr <= 3 && effect.fatigueCost != null && effect.fatigueCost >= 7) {
    flags.push('lowSFRHighFatigue');
    issues.push(`Низкий SFR ${effect.sfr}/5 при усталости ${effect.fatigueCost}/10 — дорого для ББ`);
  } else if (effect.sfr != null && effect.sfr <= 3 && effect.jointStress === 'high') {
    flags.push('lowSFRHighFatigue');
    issues.push(`SFR ${effect.sfr}/5 + сустав high — низкая отдача`);
  }

  // 2 wrongProfileForGoal: hypertrophy хочет stretch_mediated
  const goal = String(ctx.goal || 'hypertrophy').toLowerCase();
  const prof = effect.profile;
  if (goal.includes('hypertroph') || goal.includes('mass') || goal === 'bulk') {
    // проверяем что упражнение могло бы быть lengthened (профиль mid/short вместо lengthened)
    const isChestBackLegs = ['chest', 'back', 'chest_upper', 'back_width', 'quads', 'hamstrings', 'glutes'].includes(muscle || '');
    if (isChestBackLegs && prof && prof !== 'lengthened') {
      flags.push('wrongProfileForGoal');
      issues.push(`Профиль ${prof} — для гипертрофии нужен lengthened (растянутая)`);
    }
  }

  // 3 jointRisk: high jointStress + mobilityFails ≥1
  if (effect.jointStress === 'high' && (ctx.mobilityFails ?? 0) >= 1) {
    flags.push('jointRisk');
    issues.push(`Сустав high + OHS fail ${ctx.mobilityFails} — риск, нужна замена`);
  } else if (effect.jointStress === 'high' && muscle && isMobilityRestricted(muscle)) {
    flags.push('jointRisk');
    issues.push(`Сустав high + ограничение мобильности ${muscle}`);
  }

  // 4 uncoveredSubregion — только если упражнение реально не закрывает missing (по имени/углу)
  if (ctx.uncoveredSubregions && ctx.uncoveredSubregions.length && muscle) {
    const nm = String(effect.name || '').toLowerCase();
    const closes = ctx.uncoveredSubregions.some((r) => nm.includes(String(r).toLowerCase()) || String(effect.angleClass || '').toLowerCase().includes(String(r).toLowerCase()));
    if (!closes) {
      flags.push('uncoveredSubregion');
      issues.push(`Подрегионы не покрыты: ${ctx.uncoveredSubregions.slice(0, 3).join(', ')}`);
    }
  }

  // 5 missingStrict — только если у мышцы есть missing и упражнение не из missing-группы
  if (muscle) {
    const hasStrict = ['chest', 'back', 'hamstrings', 'quads'].includes(muscle);
    const missing = ctx.strictMissing || [];
    if (missing.length > 0 && (!effect.strictGroup || !missing.map((s) => s.toLowerCase()).includes(String(effect.strictGroup.key).toLowerCase()))) {
      flags.push('missingStrict');
      issues.push(`Нет строгой группы: ${missing.slice(0, 2).join(', ')} — ротация внутри группы обязательна`);
    } else if (missing.length === 0 && effect.strictGroup === null && hasStrict) {
      flags.push('missingStrict');
      issues.push(`Вне строгой группы ${muscle} — ротация внутри группы обязательна`);
    }
  }

  // 6 singleAngle
  if (ctx.singleAngleMuscle && ctx.singleAngleMuscle === muscle) {
    flags.push('singleAngle');
    issues.push(`1 угол при ≥6 сетов у ${muscle} — нужен второй угол`);
  }

  // 7 unilateralGap: asym≥7% + не unilateral
  if (ctx.asymPct != null && ctx.asymPct >= 7 && !effect.unilateral) {
    flags.push('unilateralGap');
    issues.push(`Асимметрия ${ctx.asymPct}% — нужно unilateral`);
  }

  // 8 patternMismatch: derivePattern vs muscle
  try {
    const pat = derivePattern({ name: effect.name, group: muscle || effect.muscle || 'other' } as any);
    const isPush = String(pat).includes('push') || String(pat).includes('press');
    const isPull = String(pat).includes('pull');
    const isLeg = String(pat).includes('squat') || String(pat).includes('hinge') || String(pat).includes('lunge');
    if (muscle) {
      if (['delt_mid', 'delt_rear', 'delt_front', 'shoulders'].includes(muscle) && !(String(pat).includes('shoulder') || String(pat).includes('lateral') || isPush)) {
        // delt должен быть shoulder pattern
      }
      if (['chest', 'chest_upper', 'chest_lower'].includes(muscle) && isPull) {
        flags.push('patternMismatch');
        issues.push(`Паттерн ${pat} — тяга на грудь (ожидается жим)`);
      }
      if (['back', 'back_width', 'back_thickness'].includes(muscle) && isPush && !isPull) {
        flags.push('patternMismatch');
        issues.push(`Паттерн ${pat} — жим на спину (ожидается тяга)`);
      }
      if (['quads', 'hamstrings', 'glutes', 'calves'].includes(muscle) && !isLeg && !String(pat).includes('leg')) {
        // ноги без ног-паттерна
        if (isPush || isPull) {
          flags.push('patternMismatch');
          issues.push(`Паттерн ${pat} на ноги — не нагружает целевую`);
        }
      }
    }
  } catch {}

  // 9 tempoMismatch
  const expectedTempo = (() => {
    if (goal.includes('hypertroph') || goal.includes('mass')) return '3-1-1-0';
    if (goal.includes('strength')) return '2-0-1-0';
    if (goal.includes('endurance')) return '2-1-2-0';
    return null;
  })();
  const actualTempo = String(ex.tempo || ctx.planTempo || '').trim();
  if (expectedTempo && actualTempo && actualTempo !== expectedTempo) {
    // только если оба заданы и проф требует паузу а факта нет
    if (expectedTempo.includes('1') && !actualTempo.includes('1')) {
      flags.push('tempoMismatch');
      issues.push(`Темп ${actualTempo} → ${expectedTempo} (пауза в растянутой для TUT)`);
    }
  } else if (expectedTempo && !actualTempo && effect.profile === 'lengthened') {
    flags.push('tempoMismatch');
    issues.push(`Нет темпа — для lengthened нужен ${expectedTempo} с паузой`);
  }

  // 10 romGap
  const hasPause = Number(ex.pauseSeconds ?? ctx.planPauseSeconds ?? 0) > 0;
  const needPause = effect.profile === 'lengthened';
  if (needPause && !hasPause && !ex.stretchPhase) {
    flags.push('romGap');
    issues.push('Нет паузы в растянутой — теряется stretch-mediated гипертрофия');
  }

  // 11 executionGap: техника score low или ошибки
  try {
    const cat = EXERCISE_CATALOG.find(c => c.id === effect.id || c.name === effect.name);
    if (cat) {
      const score = calcTechniqueScore(cat as any);
      if (score.level === 'high' && score.total >= 60) {
        flags.push('executionGap');
        issues.push(`Техника сложная ${score.total}/100 — риск без базы`);
      }
    }
    const bio = effect.id ? getExerciseBio(effect.id) : null;
    if (bio && bio.techniqueCues && bio.techniqueCues.length) {
      // флаг если упражнение в weakZone но нет mindMuscle cue в плане — упростим не флаг
    }
  } catch {}

  // 12 mindMuscleGap: weakZone есть а упражнение не из weakZone angle
  if (muscle && isWeakFor(muscle, ctx.weakZones, ctx.weakMusclesCanonical)) {
    // если эффект не lengthened и не unilateral при weak — считаем gap
    if (effect.profile !== 'lengthened' && !effect.unilateral) {
      // не всегда флаг — только если weak и sfr low
      if (effect.sfr != null && effect.sfr <= 3) {
        flags.push('mindMuscleGap');
        issues.push(`Слабая зона ${muscle} — упражнение не даёт изолированный стимул (SFR ${effect.sfr})`);
      }
    }
  }

  // 13 tutGap: TUT подхода вне 30-70с (Schoenfeld 2015: >10с/повт хуже; Wilk 2021: эксцентрик 2-4с)
  try {
    const reps = Number((ex as any).reps ?? ctx.planReps ?? 10);
    const tt = String(actualTempo || '').trim();
    if (tt && tt.includes('-') && Number.isFinite(reps) && reps > 0) {
      const per = tt.split('-').map((p) => Number(p.trim())).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
      const tut = per * reps;
      if (tut > 0 && (tut < 30 || tut > 70)) {
        flags.push('tutGap');
        issues.push(`TUT ${tut}с вне 30-70с — ${tut < 30 ? 'добавь паузу/эксцентрику' : 'снизь темп/повторы'}`);
      }
    }
  } catch { /* noop */ }

  // prof gaps
  const profGaps = diagnoseExecutionProf(ex as any, muscle || '', { tempo: actualTempo || undefined, pauseSeconds: Number(ex.pauseSeconds ?? ctx.planPauseSeconds ?? 0) || 0 } as any);
  if (profGaps.length) {
    flags.push('profGap');
    for (const g of profGaps) issues.push(g.issue);
  }

  // score 0-100: взвешенный (критичные тяжелее шума)
  const WEIGHTS: Record<string, number> = {
    lowSFRHighFatigue: 12, jointRisk: 12, patternMismatch: 10, unilateralGap: 8,
    wrongProfileForGoal: 8, singleAngle: 7, missingStrict: 6, tempoMismatch: 6,
    romGap: 6, mindMuscleGap: 7, executionGap: 6, profGap: 6, tutGap: 4, uncoveredSubregion: 4,
  };
  const uniq = [...new Set(flags)];
  let score = 100;
  for (const f of uniq) score -= WEIGHTS[f] ?? 6;
  if (effect.jointStress === 'high') score -= 6;
  if (effect.sfr != null && effect.sfr <= 2) score -= 8;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { effect, flags: uniq, issues: [...new Set(issues)].slice(0, 8), score, profGaps };
}
