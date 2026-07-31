import type { BBPlan } from './bb-builder.engine';

export interface BBPlanReport {
  pattern: string;
  weeks: number;
  sessionsPerWeek: number;
  totalDirectSets: number;
  peakDirectSets: number;
  peakWeek: number;
  peakVolume: Record<string, { directSets: number; effectiveSets: number; fatigueWeightedSets: number }>;
  rotationWarnings: number;
  maxSessionMinutes: number;
  maxAxialCost: number;
  validationValid: boolean;
  validationErrors: number;
  validationWarnings: number;
  sessionLeakWarnings: number;
}

export function buildBBPlanReport(plan: BBPlan): BBPlanReport {
  const weekly = plan.weeklyVolume || {};
  const peak = Object.entries(weekly).reduce((best, [week, volume]) => {
    const total = Object.values(volume).reduce((sum, item) => sum + item.directSets, 0);
    return total > best.total ? { total, week: Number(week), volume } : best;
  }, { total: -1, week: 1, volume: {} as Record<string, { directSets: number; effectiveSets: number; fatigueWeightedSets: number }> });
  const fatigue = plan.fatigueReport || [];
  return {
    pattern: plan.pattern.name,
    weeks: plan.weeks.length,
    sessionsPerWeek: plan.pattern.sessionsPerRotation,
    totalDirectSets: Object.values(weekly).reduce((sum, volume) => sum + Object.values(volume).reduce((s, item) => s + item.directSets, 0), 0),
    peakDirectSets: peak.total,
    peakWeek: peak.week,
    peakVolume: peak.volume,
    rotationWarnings: plan.rotationReport?.issues.length || 0,
    maxSessionMinutes: Math.round(Math.max(0, ...fatigue.flatMap(item => item.sessions.map(session => session.timeSeconds))) / 60),
    maxAxialCost: Math.round(Math.max(0, ...fatigue.flatMap(item => item.sessions.map(session => session.axial))) * 10) / 10,
    validationValid: plan.validation?.valid ?? true,
    validationErrors: plan.validation?.issues.filter(issue => issue.level === 'error').length || 0,
    validationWarnings: plan.validation?.issues.filter(issue => issue.level === 'warning').length || 0,
    sessionLeakWarnings: plan.validation?.issues.filter(issue => issue.code === 'session_muscle_leak').length || 0,
  };
}
