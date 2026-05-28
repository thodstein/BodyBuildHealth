import { LAB_PHASES } from '../core/constants';
import type { LabPhaseType } from '../core/types';

export interface ScheduledCheckpoint {
  type: string;
  week: number;
  markers: string[];
}

export function getLabSchedule(phase: LabPhaseType): ScheduledCheckpoint[] {
  const phaseConfig = LAB_PHASES[phase];
  return phaseConfig.checkpoints;
}

export function getNextCheckpoint(phase: LabPhaseType, currentWeek: number): ScheduledCheckpoint | null {
  const checkpoints = getLabSchedule(phase);
  const upcoming = checkpoints.filter(cp => cp.week > currentWeek);
  return upcoming.length > 0 ? upcoming[0] : null;
}
