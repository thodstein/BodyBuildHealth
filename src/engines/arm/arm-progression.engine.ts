/**
 * arm-progression.engine.ts — прогрессия для арм-упражнений (как bb-progression).
 * Double progression + e1RM.
 */

export function epley1RM(weight: number, reps: number): number {
  if (!weight || !reps) return weight || 0;
  return weight * (1 + reps / 30);
}

export function prescribeArmLoad(input: {
  currentWeight: number;
  currentReps: number;
  rir: number;
  targetRir: number;
  repCap: number;
}): { nextWeight: number; nextReps: number } {
  const { currentWeight, currentReps, rir, targetRir, repCap } = input;
  const delta = rir - targetRir;
  if (delta >= 2 && currentReps < repCap) {
    return { nextWeight: currentWeight, nextReps: Math.min(repCap, currentReps + 1) };
  }
  if (delta <= -2) {
    return { nextWeight: Math.max(1, Math.round(currentWeight * 0.95 * 2) / 2), nextReps: currentReps };
  }
  if (currentReps >= repCap) {
    return { nextWeight: Math.round((currentWeight + 1) * 2) / 2, nextReps: Math.max(5, repCap - 2) };
  }
  return { nextWeight: currentWeight, nextReps: currentReps };
}

export function armWorkMaxFor(muscle: string, workMax: Record<string, number>): number {
  const low = muscle.toLowerCase();
  if (workMax[low] != null) return workMax[low];
  // alias
  if (workMax['wrist'] != null && low.includes('wrist')) return workMax['wrist'];
  if (workMax['grip'] != null && low.includes('grip')) return workMax['grip'];
  return workMax['default'] || 50;
}
