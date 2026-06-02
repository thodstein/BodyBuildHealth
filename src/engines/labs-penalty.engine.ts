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
  courseEntries?: import('../core/types').CourseEntry[]
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
  const recentLabs = submittedLabs.filter(l => {
    const d = new Date(l.date);
    return (now.getTime() - d.getTime()) < 8 * 7 * 24 * 60 * 60 * 1000;
  });
  const labCodes = new Set(recentLabs.map(l => l.code));
  const diagSet = new Set(submittedDiagnostics);

  const missingLabs = requiredLabs.filter(code => !labCodes.has(code));
  const missingDiags = requiredDiags.filter(d => !diagSet.has(d));

  const labRatio = requiredLabs.length > 0 ? missingLabs.length / requiredLabs.length : 0;
  const diagRatio = requiredDiags.length > 0 ? missingDiags.length / requiredDiags.length : 0;

  const noLabs = labRatio >= 0.9;
  const noDiags = diagRatio >= 0.9;

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
  if (p.includes('course-bridge')) return 'course_bridge_course';
  if (p.includes('course') && !p.includes('bridge')) return 'on_cycle';
  if (p.includes('bridge')) return 'bridge';
  if (p.includes('pct') && p.includes('post')) return 'post_pct';
  if (p.includes('pct')) return 'pct';
  return 'baseline';
}