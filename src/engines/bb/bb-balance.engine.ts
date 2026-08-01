import type { BBPlan } from './bb-builder.engine';
import { derivePattern } from '../movement-pattern';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';

export interface BBBalanceReport {
  press: number;
  pull: number;
  raise: number;
  upperPress: number;
  upperPull: number;
  pullPressRatio: number;
  compound: number;
  isolation: number;
  lengthened: number;
  midRange: number;
  shortened: number;
  patterns: Record<string, number>;
  byMuscle: Record<string, { patterns: Record<string, number>; lengthened: number; midRange: number; shortened: number }>;
  issues: string[];
  peakWork?: { press: number; pull: number; pullPressRatio: number };
}

function position(name: string): 'lengthened' | 'midRange' | 'shortened' {
  const n = name.toLowerCase();
  if (/наклон|incline|rdl|румын|overhead|француз|french|seated.*curl|stretch|растяж/i.test(n)) return 'lengthened';
  if (/кроссовер|crossover|kickback|концентр|concentration|пик|peak|сокращ/i.test(n)) return 'shortened';
  return 'midRange';
}

export function analyzeBBBalance(plan: BBPlan): BBBalanceReport {
  const report: BBBalanceReport = { press: 0, pull: 0, raise: 0, upperPress: 0, upperPull: 0, pullPressRatio: 0, compound: 0, isolation: 0, lengthened: 0, midRange: 0, shortened: 0, patterns: {}, byMuscle: {}, issues: [] };
  const workWeeks = plan.weeks.filter(week => String((week as any).phase || '').toLowerCase() !== 'deload' && !(week as any).taper);
  const sessions = (workWeeks.length > 0 ? workWeeks : plan.weeks).flatMap(week => week.sessions);
  for (const session of sessions) for (const exercise of session.exercises) {
    const sets = exercise.sets;
    const name = exercise.name.toLowerCase();
    const catalog = EXERCISE_CATALOG.find(item => item.name === exercise.name || item.id === exercise.exerciseName);
    const movement = String(catalog?.movementPattern || '').toLowerCase();
    const pattern = derivePattern(exercise);
    const muscle = report.byMuscle[exercise.muscle] || (report.byMuscle[exercise.muscle] = { patterns: {}, lengthened: 0, midRange: 0, shortened: 0 });
    muscle.patterns[pattern] = (muscle.patterns[pattern] || 0) + sets;
    report.patterns[pattern] = (report.patterns[pattern] || 0) + sets;
    const isPress = movement.includes('push') || /жим|press|bench|push|отжим/i.test(name);
    const isPull = movement.includes('pull') || /тяга|row|pull|подтяг|pulldown/i.test(name);
    const isRaise = catalog?.type === 'isolation' && (/мах|raise|отведен|развод|fly/i.test(name) || movement.includes('isolation_shoulders'));
    if (isPress) report.press += sets;
    if (isPull) report.pull += sets;
    if (isRaise) report.raise += sets;
    if (exercise.role === 'primary' || /присед|squat|жим|press|row|тяга|pull|lunge|hip.?thrust|rdl/i.test(name)) report.compound += sets;
    else report.isolation += sets;
    const positionName = position(name);
    report[positionName] += sets;
    muscle[positionName] += sets;
    const upper = !['quads', 'hamstrings', 'glutes', 'calves', 'legs'].includes(exercise.muscle);
    if (upper && isPress) report.upperPress += sets;
    if (upper && isPull) report.upperPull += sets;
  }
  report.pullPressRatio = report.upperPress > 0 ? Math.round((report.upperPull / report.upperPress) * 100) / 100 : 0;
  report.peakWork = { press: report.upperPress, pull: report.upperPull, pullPressRatio: report.pullPressRatio };
  if (report.upperPress > 0 && report.upperPull < report.upperPress * 0.75) report.issues.push(`Перекос верхней части: тяги ${report.upperPull} против жимов ${report.upperPress} сетов (ratio ${report.pullPressRatio}).`);
  if (report.upperPull > 0 && report.upperPress < report.upperPull * 0.4) report.issues.push(`Перекос верхней части: жимы ${report.upperPress} против тяг ${report.upperPull} сетов.`);
  if (report.press > 0 && report.pull === 0) report.issues.push('Нет тягового объёма при наличии жимов.');
  if (report.pull > 0 && report.press === 0) report.issues.push('Нет жимового объёма при наличии тяг.');
  if (report.lengthened === 0 && report.midRange > 0) report.issues.push('Нет упражнений в растянутой позиции.');
  if (report.shortened === 0 && report.midRange > 0) report.issues.push('Нет упражнений в сокращённой позиции.');
  for (const [muscle, coverage] of Object.entries(report.byMuscle)) {
    if (coverage.lengthened === 0 && coverage.midRange > 0) report.issues.push(`${muscle}: нет растянутой позиции.`);
    if (coverage.shortened === 0 && coverage.midRange > 0) report.issues.push(`${muscle}: нет сокращённой позиции.`);
    if (Object.keys(coverage.patterns).length === 1 && Object.values(coverage.patterns)[0] >= 4) report.issues.push(`${muscle}: один movement pattern доминирует в объёме.`);
  }
  return report;
}
