import { LabCheckpoint, LabPoint, PenaltyResult } from '../core/types';
import { PENALTY_THRESHOLDS, REQUIRED_LABS_PER_PHASE, REQUIRED_DIAGNOSTICS_PER_PHASE } from '../core/constants';
import { getDrugSpecificLabs } from './labs-schedule.engine';

export interface PenaltyCoefficients {
  labPenalty: number;
  diagnosticPenalty: number;
  totalMultiplier: number;
  missingLabsForPhase: string[];
  missingDiagnosticsForPhase: string[];
  noLabsPenalty: boolean;
  noDiagnosticsPenalty: boolean;
}

export function calculateDynamicPenalty(
  checkpoints: LabCheckpoint[],
  submittedLabs: LabPoint[],
  currentDate: Date = new Date()
): PenaltyResult {
  let totalScore = 0;
  const missedCheckpoints: string[] = [];
  let affectsTrust = false;

  checkpoints.forEach(cp => {
    const due = new Date(cp.dueDate);
    const gracePeriod = 3 * 24 * 60 * 60 * 1000;
    const isOverdue = currentDate.getTime() > due.getTime() + gracePeriod;
    
    const hasLabs = submittedLabs.some(l => {
      const labDate = new Date(l.date).getTime();
      const dueTime = due.getTime();
      return l.phase.includes(cp.type) && labDate >= dueTime - 7*24*60*60*1000;
    });

    if (isOverdue && !hasLabs) {
      cp.status = 'overdue';
      totalScore += 25;
      missedCheckpoints.push(`${cp.type} (неделя ${cp.weekOffset})`);
      affectsTrust = true;
    } else if (!hasLabs && !isOverdue) {
      cp.status = 'pending';
    } else {
      cp.status = 'completed';
    }
  });

  const finalScore = Math.min(100, totalScore);
  const action = finalScore >= PENALTY_THRESHOLDS.critical
    ? '⛔ Курс приостановлен. Требуется актуальный чек-ап.'
    : finalScore >= PENALTY_THRESHOLDS.warning
      ? '⚠️ Штраф за просроченные анализы. Рекомендуется сдать в течение 48ч.'
      : '';

  return {
    score: finalScore,
    missingLabs: missedCheckpoints,
    missingDiagnostics: [],
    action,
    affectsTrust
  };
}

export function calculatePenaltyCoefficients(
  phase: string,
  submittedLabs: LabPoint[],
  submittedDiagnostics: string[],
  courseWeek: number,
  courseEntries?: import('../core/types').CourseEntry[],
  forceNoLabsPenalty?: boolean
): PenaltyCoefficients {
  const phaseKey = resolvePhaseKey(phase);
  let requiredLabs = [...(REQUIRED_LABS_PER_PHASE[phaseKey] ?? [])];
  const requiredDiags = [...(REQUIRED_DIAGNOSTICS_PER_PHASE[phaseKey] ?? [])];

  if (courseEntries && courseEntries.length > 0) {
    const drugSpecific = getDrugSpecificLabs(courseEntries);
    drugSpecific.labs.forEach(l => { if (!requiredLabs.includes(l)) requiredLabs.push(l); });
    drugSpecific.diagnostics.forEach(d => { if (!requiredDiags.includes(d)) requiredDiags.push(d); });
  }

  const now = new Date();
  // P0 fix: baseline — разовый чекап, не протухает за 8 нед; on_cycle — 4 нед актуальности
  const isBaseline = phaseKey === 'baseline';
  const windowMs = isBaseline ? Infinity : 8 * 7 * 24 * 60 * 60 * 1000;
  const recentLabs = submittedLabs.filter(l => {
    const d = new Date(l.date);
    return isBaseline || (now.getTime() - d.getTime()) < windowMs;
  });
  const labCodes = new Set(recentLabs.map(l => String(l.code).toUpperCase()));
  const diagSet = new Set(submittedDiagnostics.map(d => String(d).toLowerCase()));
  // P0 fix: требуемые коды — в верхнем регистре, сравнение кейс-инсенс
  const requiredUpper = requiredLabs.map(c => String(c).toUpperCase());
  const requiredDiagLower = requiredDiags.map(d => String(d).toLowerCase());
  const missingLabs = requiredUpper.filter(code => !labCodes.has(code));
  const missingDiags = requiredDiagLower.filter(d => !diagSet.has(d));

  const labRatio = requiredUpper.length > 0 ? missingLabs.length / requiredUpper.length : 0;
  // P0 fix: диагностика не трекается в LabsScreen (всегда []), не штрафуем за неё
  const diagRatio = submittedDiagnostics.length === 0 ? 0 : (requiredDiagLower.length > 0 ? missingDiags.length / requiredDiagLower.length : 0);

  const noLabs = forceNoLabsPenalty || labRatio >= 0.9;
  const noDiags = submittedDiagnostics.length > 0 && diagRatio >= 0.9;

  const labPenalty = noLabs ? 0.50 : labRatio * 0.40;
  const diagnosticPenalty = noDiags ? 0.35 : diagRatio * 0.25;

  const totalMultiplier = 1.0 + labPenalty + diagnosticPenalty;

  return {
    labPenalty,
    diagnosticPenalty,
    totalMultiplier: Math.min(2.0, totalMultiplier),
    missingLabsForPhase: missingLabs,
    missingDiagnosticsForPhase: missingDiags,
    noLabsPenalty: noLabs,
    noDiagnosticsPenalty: noDiags
  };
}

function resolvePhaseKey(phase: string): string {
  const p = phase.toLowerCase();
  if (p === 'on_cycle' || p.includes('on_cycle') || (p.includes('course') && !p.includes('bridge'))) return 'on_cycle';
  if (p.includes('bridge')) return 'bridge';
  if (p.includes('pct') && p.includes('post')) return 'post_pct';
  if (p.includes('pct')) return 'pct';
  return 'baseline';
}