import { LabCheckpoint, LabPhaseType, UserContext } from '../core/types';
import { PHASE_SCHEDULE_RULES, REQUIRED_LABS_PER_PHASE } from '../core/constants';

export function generateCheckpoints(
  phaseType: LabPhaseType,
  startDate: string,
  totalWeeks: number,
  context: UserContext
): LabCheckpoint[] {
  const rules = PHASE_SCHEDULE_RULES[phaseType] || PHASE_SCHEDULE_RULES.course;
  const checkpoints: LabCheckpoint[] = [];
  const start = new Date(startDate);

  rules.checkpoints.forEach(rule => {
    if (rule.week > totalWeeks) return;
    const due = new Date(start.getTime() + rule.week * 7 * 24 * 60 * 60 * 1000);
    checkpoints.push({
      id: `${rule.type}_${rule.week}`,
      weekOffset: rule.week,
      type: rule.type as any,
      status: 'pending',
      dueDate: due.toISOString().slice(0, 10),
      requiredMarkers: rule.markers
    });
  });

  if (totalWeeks > 12) {
    const existingWeeks = new Set(checkpoints.map(c => c.weekOffset));
    if (!existingWeeks.has(8)) checkpoints.push({ id: 'extra_8', weekOffset: 8, type: 'mid_course', status: 'pending', dueDate: new Date(start.getTime() + 56*24*60*60*1000).toISOString().slice(0,10), requiredMarkers: REQUIRED_LABS_PER_PHASE.on_cycle });
    if (!existingWeeks.has(12)) checkpoints.push({ id: 'extra_12', weekOffset: 12, type: 'mid_course', status: 'pending', dueDate: new Date(start.getTime() + 84*24*60*60*1000).toISOString().slice(0,10), requiredMarkers: REQUIRED_LABS_PER_PHASE.on_cycle });
  }

  return checkpoints;
}