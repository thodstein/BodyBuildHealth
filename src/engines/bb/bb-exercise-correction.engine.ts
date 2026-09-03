/**
 * bb-exercise-correction.engine.ts — коррекция упражнения (что делать).
 * Типы: substitute | add | modifyPattern | modifyExecution | modifyTempo | modifyROM | modifyLoad | mobilitySwap | unilateral
 */
import { EXERCISE_CATALOG, canReplace, getSubstitutes } from '../../core/exercise-catalog';
import { getProfExecutionProfile } from './bb-execution-prof.engine';
import { tempoFor } from './bb-tempo-rest';
import { buildExerciseInstructions } from './bb-exercise-instructions.engine';
import type { ExerciseDiagnosis } from './bb-exercise-diagnosis.engine';
import { sfrOf } from './bb-sfr-db';
import { isMobilityRestricted } from './bb-mobility.engine';

export type CorrectionType =
  | 'substitute'
  | 'add'
  | 'modifyPattern'
  | 'modifyExecution'
  | 'modifyTempo'
  | 'modifyROM'
  | 'modifyLoad'
  | 'mobilitySwap'
  | 'unilateral';

export interface CorrectionAction {
  type: CorrectionType;
  targetId?: string; // для substitute/add/mobilitySwap
  targetName?: string;
  execCues?: string[]; // для modifyExecution
  tempo?: string; // для modifyTempo
  rom?: string; // для modifyROM
  reason: string;
  confidence: number; // 0-1
  deltaPreview?: string; // кратко что даст
}

function findCatalog(idOrName: string) {
  const low = idOrName.toLowerCase();
  return EXERCISE_CATALOG.find(c => c.id.toLowerCase() === low || c.name.toLowerCase() === low) || null;
}

function rankSubstituteCandidates(
  ex: { id?: string | null; name: string; muscle?: string | null },
  diagnosis: ExerciseDiagnosis,
  ctx: { goal?: string; level?: string; equipment?: string[]; muscle?: string | null },
): Array<{ id: string; name: string; score: number; reason: string }> {
  const muscle = String(ctx.muscle || ex.muscle || '').toLowerCase();
  const curId = ex.id || '';
  const pool = EXERCISE_CATALOG.filter(c => {
    if (muscle && c.group !== muscle) return false;
    if (c.id === curId) return false;
    if (ctx.equipment && ctx.equipment.length && !ctx.equipment.includes(c.equipment) && c.equipment !== 'bodyweight' && c.equipment !== 'machine') {
      // фильтр оборудования мягкий — не отсекаем bodyweight
    }
    if (isMobilityRestricted(muscle || c.group)) {
      // если мышца ограничена, отсекаем compound с высокой нагрузкой — упростим не отсекаем
    }
    return true;
  });
  const scored = pool.map(c => {
    let score = 0;
    const sfr = sfrOf(c as any);
    if (sfr != null) score += sfr >= 5 ? 12 : sfr >= 4 ? 8 : sfr === 3 ? 4 : 0;
    if (c.stretchPhase) score += 6;
    if (c.jointStress === 'low') score += 4;
    else if (c.jointStress === 'high') score -= 6;
    // bonus если canReplace
    try {
      if (curId && canReplace(curId, c.id)) score += 6;
    } catch {}
    // bonus если профиль lengthened для hypertrophy
    const goal = String(ctx.goal || 'hypertrophy').toLowerCase();
    if ((goal.includes('hypertroph') || goal.includes('mass')) && c.stretchPhase) score += 4;
    return { id: c.id, name: c.name, score, reason: c.stretchPhase ? 'lengthened+высокий SFR' : sfr != null ? `SFR ${sfr}` : 'альтернатива' };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8);
}

export function prescribeCorrections(
  diagnosis: ExerciseDiagnosis,
  ex: { id?: string | null; name: string; muscle?: string | null; tempo?: string; pauseSeconds?: number },
  ctx: { goal?: string; level?: string; muscle?: string | null; equipment?: string[] } = {},
): CorrectionAction[] {
  const out: CorrectionAction[] = [];
  const muscle = String(ctx.muscle || ex.muscle || diagnosis.effect.muscle || '').toLowerCase();
  const flags = new Set(diagnosis.flags);
  const prof = getProfExecutionProfile(muscle);

  // 1 substitute — если lowSFRHighFatigue или jointRisk или profGap
  if (flags.has('lowSFRHighFatigue') || flags.has('jointRisk') || flags.has('profGap') || flags.has('patternMismatch')) {
    const cands = rankSubstituteCandidates({ id: ex.id || diagnosis.effect.id, name: ex.name, muscle }, diagnosis, { ...ctx, muscle });
    if (cands[0]) {
      out.push({
        type: flags.has('jointRisk') ? 'mobilitySwap' : 'substitute',
        targetId: cands[0].id, targetName: cands[0].name,
        reason: flags.has('jointRisk')
          ? `Сустав high + OHS fail — замена на ${cands[0].name} (${cands[0].reason}, сустав low)`
          : `Замена ${ex.name} → ${cands[0].name} — ${cands[0].reason}, -усталость, +стимул`,
        confidence: 0.88,
        deltaPreview: `SFR↑, усталость↓, lengthened ${cands[0].reason.includes('lengthened') ? 'да' : '—'}`,
      });
      if (cands[1]) out.push({
        type: 'substitute', targetId: cands[1].id, targetName: cands[1].name,
        reason: `Альтернатива: ${cands[1].name} — ${cands[1].reason}`,
        confidence: 0.72,
        deltaPreview: `Альтернативный угол`,
      });
    }
  }

  // 2 modifyExecution — если executionGap или profGap или mindMuscleGap
  if (flags.has('executionGap') || flags.has('profGap') || flags.has('mindMuscleGap') || flags.has('patternMismatch')) {
    let cues: string[] = [];
    if (prof) cues = prof.cues.slice(0, 3);
    else {
      try {
        const instr = buildExerciseInstructions({ exerciseId: ex.id || undefined, exerciseName: ex.name, muscle: muscle || undefined } as any);
        cues = (instr.cues || []).slice(0, 3);
      } catch { cues = ['Контролируй эксцентрику 3с', 'Пауза 1с внизу в растянутой', 'Локти/колени по технике']; }
    }
    out.push({
      type: 'modifyExecution', execCues: cues,
      reason: prof ? `Техника для ${prof.label}: ${cues[0]}` : `Исправь выполнение: ${cues[0]}`,
      confidence: 0.82, deltaPreview: `Техника → +стимул в целевую, -травма`,
    });
  }

  // 3 modifyTempo — если tempoMismatch (интернет: эксцентрик 2-4с оптимум, Wilk 2021; >6с хуже)
  if (flags.has('tempoMismatch')) {
    const goal = String(ctx.goal || 'hypertrophy').toLowerCase();
    const character = (goal.includes('strength') || goal.includes('сила')) ? 'тяж' : (goal.includes('endurance') || goal.includes('вынос')) ? 'лёг' : 'памп';
    let expected = goal.includes('hypertroph') || goal.includes('mass') ? '3-1-1-0' : goal.includes('strength') ? '2-0-1-0' : '2-1-2-0';
    try {
      const spec = tempoFor(character as any, undefined, undefined, ex.name);
      if (spec && typeof spec.notation === 'string' && spec.notation) expected = spec.notation;
    } catch {}
    out.push({
      type: 'modifyTempo', tempo: expected,
      reason: `Темп ${ex.tempo || '—'} → ${expected} (TUT + пауза для гипертрофии)`,
      confidence: 0.78, deltaPreview: `TUT↑, метаболический стресс↑`,
    });
  }

  // 4 modifyROM — если romGap
  if (flags.has('romGap')) {
    const profTempo = prof?.tempo || '3-1-1-0';
    out.push({
      type: 'modifyROM', rom: prof ? prof.rom : 'Пауза 1с внизу в растянутой, полная амплитуда',
      reason: `Добавь паузу в растянутой — stretch-mediated (Schoenfeld 2021)`,
      confidence: 0.80, deltaPreview: `Длина мышцы↑, механонапряжение↑`,
      tempo: profTempo,
    });
  }

  // 5 unilateral — если unilateralGap
  if (flags.has('unilateralGap')) {
    // найдём unilateral кандидата в той же мышце
    const pool = EXERCISE_CATALOG.filter(c => c.group === muscle && /одно|single|болгар|выпад|lunge|одной/i.test(c.name));
    const cand = pool[0];
    if (cand) out.push({
      type: 'unilateral', targetId: cand.id, targetName: cand.name,
      reason: `Асимметрия ≥7% — добавь unilateral ${cand.name}`,
      confidence: 0.75, deltaPreview: `Симметрия↑, L/R баланс`,
    });
    else out.push({
      type: 'unilateral',
      reason: `Асимметрия ≥7% — делай по одной стороне/ноге (болгарские, тяга одной рукой)`,
      confidence: 0.70, deltaPreview: `Симметрия↑`,
    });
  }

  // 6 add — если uncoveredSubregion или missingStrict или singleAngle
  if (flags.has('uncoveredSubregion') || flags.has('missingStrict') || flags.has('singleAngle')) {
    // предложить добавку из stretchLeaders — упростим: второй кандидат из ranked
    const cands = rankSubstituteCandidates({ id: ex.id || diagnosis.effect.id, name: ex.name, muscle }, diagnosis, { ...ctx, muscle });
    const addCand = cands.find(c => c.id !== out.find(o => o.targetId === c.id)?.targetId) || cands[0];
    if (addCand) out.push({
      type: 'add', targetId: addCand.id, targetName: addCand.name,
      reason: flags.has('singleAngle') ? `Один угол при ≥6 сетах — добавь ${addCand.name}` : `Закрой подрегион/строгую группу: ${addCand.name}`,
      confidence: 0.68, deltaPreview: `Покрытие углов↑, стимул↑`,
    });
  }

  // дедуп по type+target
  const seen = new Set<string>();
  const dedup: CorrectionAction[] = [];
  for (const a of out) {
    const k = `${a.type}:${a.targetId || a.tempo || a.execCues?.[0] || a.reason}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(a);
  }
  // сортировка по confidence
  dedup.sort((a, b) => b.confidence - a.confidence);
  return dedup.slice(0, 6);
}
