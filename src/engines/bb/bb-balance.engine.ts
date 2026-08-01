import type { BBPlan } from './bb-builder.engine';
import { derivePattern } from '../movement-pattern';

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
  const report: BBBalanceReport = { press: 0, pull: 0, raise: 0, upperPress: 0, upperPull: 0, pullPressRatio: 0, compound: 0, isolation: 0, lengthened: 0, midRange: 0, shortened: 0, patterns: {}, issues: [] };
  const workWeeks = plan.weeks.filter(week => String((week as any).phase || '').toLowerCase() !== 'deload' && !(week as any).taper);
  const sessions = (workWeeks.length > 0 ? workWeeks : plan.weeks).flatMap(week => week.sessions);
  for (const session of sessions) for (const exercise of session.exercises) {
    const sets = exercise.sets;
    const name = exercise.name.toLowerCase();
    const pattern = derivePattern(exercise);
    report.patterns[pattern] = (report.patterns[pattern] || 0) + sets;
    if (/жим|press|bench|push|отжим/i.test(name)) report.press += sets;
    if (/тяга|row|pull|подтяг|pulldown/i.test(name)) report.pull += sets;
    if (/мах|raise|отведен|развод|fly/i.test(name)) report.raise += sets;
    if (exercise.role === 'primary' || /присед|squat|жим|press|row|тяга|pull|lunge|hip.?thrust|rdl/i.test(name)) report.compound += sets;
    else report.isolation += sets;
    report[position(name)] += sets;
    const upper = !['quads', 'hamstrings', 'glutes', 'calves', 'legs'].includes(exercise.muscle);
    if (upper && /жим|press|bench|push|отжим/i.test(name)) report.upperPress += sets;
    if (upper && /тяга|row|pull|подтяг|pulldown/i.test(name)) report.upperPull += sets;
  }
  report.pullPressRatio = report.upperPress > 0 ? Math.round((report.upperPull / report.upperPress) * 100) / 100 : 0;
  report.peakWork = { press: report.upperPress, pull: report.upperPull, pullPressRatio: report.pullPressRatio };
  if (report.upperPress > 0 && report.upperPull < report.upperPress * 0.75) report.issues.push(`Перекос верхней части: тяги ${report.upperPull} против жимов ${report.upperPress} сетов (ratio ${report.pullPressRatio}).`);
  if (report.upperPull > 0 && report.upperPress < report.upperPull * 0.4) report.issues.push(`Перекос верхней части: жимы ${report.upperPress} против тяг ${report.upperPull} сетов.`);
  if (report.press > 0 && report.pull === 0) report.issues.push('Нет тягового объёма при наличии жимов.');
  if (report.pull > 0 && report.press === 0) report.issues.push('Нет жимового объёма при наличии тяг.');
  if (report.lengthened === 0 && report.midRange > 0) report.issues.push('Нет упражнений в растянутой позиции.');
  if (report.shortened === 0 && report.midRange > 0) report.issues.push('Нет упражнений в сокращённой позиции.');
  return report;
}
