import { LabCheckpoint, LabPoint, PenaltyResult } from '../core/types';
import { PENALTY_THRESHOLDS } from '../core/constants';

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