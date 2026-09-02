/**
 * bb-diagnostics-hub.engine.ts — оркестратор ББ-диагностики (тонкий, без дублей).
 * Собирает 3 уникальных движка + чипы канонов (quality/volume/ACWR) в один отчёт.
 */
import { detectBBWeakByVolume, detectBBWeakByE1rm, detectBBWeakByCircumf, mergeBBWeakCandidates, type BBWeakCandidate } from './bb-weak-detection.engine';
import { scoreBBSymmetry, type BBSymmetryResult } from './bb-symmetry.engine';
import { analyzeBBStimulus, type BBStimulusResult } from './bb-stimulus.engine';
import { scoreBB, type BBScoreResult } from './bb-scoring.engine';
import { normalizeSpecializationTargets, isSpecializationTargetConflict } from './bb-specialization.engine';
import { canonicalMuscle } from './bb-specialization.engine';

export interface BBDiagnosticsHubInput {
  level: string;
  factVolume?: Record<string, { directSets?: number; effectiveSets?: number }> | null;
  sessions?: Array<{ date: string; exercises: Array<{ exerciseName?: string; name?: string; muscleGroup?: string; muscle?: string; sets: Array<{ weightKg: number; reps: number }> }> }>;
  meas?: Record<string, number>; // chest, waist, hips, bicepL/R и т.д.
  heightCm?: number | null;
  plan?: import('./bb-builder.engine').BBPlan | null;
  balance?: import('./bb-balance.engine').BBBalanceReport | null;
  perMuscleAcwr?: Record<string, { ratio: number; zone: string }> | null;
  mobilityFails?: number;
  vbtLossPct?: number | null;
  hasDiary?: boolean;
  hasCircumf?: boolean;
  hasVbt?: boolean;
  manualWeak?: string[]; // гранулярные ручные 1-2
}

export interface BBDiagnosticsReport {
  weakCandidates: BBWeakCandidate[];
  weakMusclesCanonical: string[]; // 1-2 канонич для apply
  weakZonesGranular: string[]; // 1-2 гранулярные для bonus
  symmetry: BBSymmetryResult;
  stimulus: BBStimulusResult;
  score: BBScoreResult;
  findings: string[];
  priorities: string[];
}

export function buildBBDiagnosticsReport(input: BBDiagnosticsHubInput): BBDiagnosticsReport {
  const level = input.level || 'intermediate';
  // weak detection
  const byVol = input.factVolume ? detectBBWeakByVolume(input.factVolume, level) : [];
  const byE1rm = input.sessions ? detectBBWeakByE1rm(input.sessions as any) : [];
  const byCirc = input.meas && input.heightCm ? detectBBWeakByCircumf(input.meas as any, Number(input.heightCm)) : [];
  const merged = mergeBBWeakCandidates(byVol, byE1rm, byCirc);

  // manualWeak приоритетнее — добавляем в начало, дедуп
  let candidates: BBWeakCandidate[] = merged;
  if (Array.isArray(input.manualWeak) && input.manualWeak.length) {
    const manual: BBWeakCandidate[] = normalizeSpecializationTargets(input.manualWeak).map(m => ({
      muscle: canonicalMuscle(m),
      granular: m,
      reason: 'Ручной выбор',
      deltaPct: -15,
      source: 'volume' as const,
    }));
    // manual first — granular zones считаются разными ключами, чтобы delt_mid+delt_rear не схлопнулись в shoulders
    const map = new Map<string, BBWeakCandidate>();
    for (const c of [...manual, ...merged]) {
      const k = c.granular || c.muscle;
      if (!map.has(k)) {
        map.set(k, c);
      }
    }
    candidates = Array.from(map.values());
  }

  // валидация конфликта shoulders+delt_mid: если есть конфликт — оставляем первый
  const filtered: BBWeakCandidate[] = [];
  for (const c of candidates) {
    const g = c.granular || c.muscle;
    if (filtered.some(f => isSpecializationTargetConflict(f.granular || f.muscle, g))) continue;
    filtered.push(c);
    if (filtered.length >= 2) break;
  }
  candidates = filtered;

  const weakMusclesCanonical = candidates.slice(0, 2).map(c => c.muscle);
  const weakZonesGranular = candidates.slice(0, 2).map(c => c.granular || c.muscle);

  const symmetry = scoreBBSymmetry(
    (input.meas || {}) as any,
    input.balance || null,
    input.factVolume || null,
  );
  const stimulus = analyzeBBStimulus(input.plan || null);

  // volume issues для scoring
  let volumeIssues = 0;
  let volumeExceeding = 0;
  if (input.factVolume) {
    // грубая оценка: count exceeding — не пересчитываем landmarks, используем candidates volume source
    const volCands = byVol.length;
    volumeIssues = volCands;
    // exceeding отдельно — если delta очень негатив и sets >> MAV? Упростим: volCands с delta < -40 как exceeding
    volumeExceeding = byVol.filter(c => c.deltaPct < -40).length;
  }

  const acwrDanger = input.perMuscleAcwr ? Object.values(input.perMuscleAcwr).filter(v => v.zone === 'dangerous').length : 0;
  const acwrCaution = input.perMuscleAcwr ? Object.values(input.perMuscleAcwr).filter(v => v.zone === 'caution').length : 0;
  const maxAsym = (() => {
    const vals = Object.entries(symmetry.ratios).filter(([k]) => k.endsWith('_asym')).map(([, v]) => Number(v));
    return vals.length ? Math.max(...vals) : null;
  })();

  const score = scoreBB({
    weakCount: candidates.length,
    volumeIssues,
    volumeExceeding,
    symmetryAsymPct: maxAsym,
    symmetryIssues: symmetry.issues.length,
    stimulusPenalty: stimulus.scorePenalty,
    acwrDanger,
    acwrCaution,
    mobilityFails: input.mobilityFails ?? 0,
    vbtLossPct: input.vbtLossPct ?? null,
    hasDiary: !!input.hasDiary,
    hasCircumf: !!input.hasCircumf,
    hasVbt: !!input.hasVbt,
  });

  const findings: string[] = [];
  if (candidates.length) findings.push(`Слабые: ${candidates.map(c => `${c.muscle}${c.granular ? `(${c.granular})` : ''} ${c.deltaPct}% [${c.source}]`).join(', ')}`);
  if (symmetry.issues.length) findings.push(...symmetry.issues.slice(0, 2));
  if (stimulus.issues.length) findings.push(...stimulus.issues.slice(0, 2));
  if (score.floors.length) findings.push(...score.floors.map(f => `Floor: ${f}`));

  const priorities: string[] = [];
  if (candidates.length) priorities.push(`Специализация: ${weakZonesGranular.join(', ')} — ×1.15 объём, первым в сессии`);
  if (symmetry.issues.some(s => s.includes('асимметрия'))) priorities.push('Унилатеральная работа слабой стороны первой');
  if (stimulus.issues.some(s => s.includes('растянутой'))) priorities.push('Добавьте lengthened (наклон 30°, RDL, разводка с паузой)');
  if (acwrDanger > 0) priorities.push('ACWR danger — снизьте объём на 25% для перегруженных мышц');

  return { weakCandidates: candidates, weakMusclesCanonical, weakZonesGranular, symmetry, stimulus, score, findings, priorities };
}
