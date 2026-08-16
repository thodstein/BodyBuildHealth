import { classifyMovement, assessSafety, getJointStress } from './movement-engines';
import { computeOrthopedicConstraints } from './orthopedic-load-engines';
import type {
  ExerciseSafetyResult, SafetyIssue, TrainingSafetyExercise, TrainingSafetyInput,
  TrainingSafetyPlan, TrainingSafetyReport,
} from './training-safety.types';

const PATTERN_ALIASES: Record<string, string> = {
  back_squat: 'back_squat', squat: 'back_squat', deadlift: 'deadlift', romanian_deadlift: 'romanian_deadlift',
  hip_thrust: 'hip_thrust', bench_press: 'bench_press', overhead_press: 'overhead_press',
  barbell_row: 'barbell_row', pull_up: 'pull_up', lat_pulldown: 'lat_pulldown', leg_press: 'leg_press',
};

function norm(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/ё/g, 'е').replace(/[\s-]+/g, '_');
}

function exerciseId(exercise: TrainingSafetyExercise): string {
  const raw = norm(exercise.id || exercise.name);
  if (PATTERN_ALIASES[raw]) return PATTERN_ALIASES[raw];
  if (/присед|squat/.test(raw)) return 'back_squat';
  if (/румын|romanian|rdl/.test(raw)) return 'romanian_deadlift';
  if (/станов|deadlift|тяга_с_пола/.test(raw)) return 'deadlift';
  if (/жим_лежа|bench/.test(raw)) return 'bench_press';
  if (/жим_стоя|армей|overhead|ohp/.test(raw)) return 'overhead_press';
  if (/подтяг|pull_up|pullup/.test(raw)) return 'pull_up';
  if (/тяга_штанг|barbell_row/.test(raw)) return 'barbell_row';
  return raw;
}

function profileInjuries(input: TrainingSafetyInput): string[] {
  const profile = input.profile || {};
  const records = (profile.injuries || []).flatMap(injury => [injury.muscle, injury.type]).filter(Boolean) as string[];
  return [...new Set([...records, ...(profile.currentPain || [])])];
}

function planExercises(plan?: TrainingSafetyPlan): TrainingSafetyExercise[] {
  if (!plan) return [];
  if (plan.exercises?.length) return plan.exercises;
  return (plan.weeks || []).flatMap(week => (week.sessions || []).flatMap(session => session.exercises || []));
}

function uniqueIssues(issues: SafetyIssue[]): SafetyIssue[] {
  const seen = new Set<string>();
  return issues.filter(issue => {
    const key = `${issue.code}:${issue.exerciseId || ''}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function analyzeExercise(exercise: TrainingSafetyExercise, input: TrainingSafetyInput, blockedPatterns: Set<string>): ExerciseSafetyResult {
  const id = exerciseId(exercise);
  const name = exercise.name || exercise.id || id || 'Упражнение';
  const cls = classifyMovement(id);
  const stress = getJointStress(id);
  const issues: SafetyIssue[] = [];
  const technique = Math.max(0, Math.min(1, exercise.techniqueScore ?? 0.8));
  const assessment = assessSafety(id, profileInjuries(input), technique);

  if (blockedPatterns.has(cls.pattern)) {
    issues.push({ code: 'blocked_pattern', severity: 'critical', source: 'orthopedic', exerciseId: id, message: `${name}: паттерн «${cls.pattern}» ограничен профилем безопасности`, recommendation: 'Заменить на упражнение с разрешённым паттерном' });
  }
  if (input.profile?.avoidAxialLoad && cls.loadType === 'axial') {
    issues.push({ code: 'axial_load', severity: 'critical', source: 'profile', exerciseId: id, message: `${name}: осевая нагрузка запрещена профилем`, recommendation: 'Выбрать тренажёрную, сидячую или изолирующую альтернативу' });
  }
  if (assessment.precautions.length && technique < 0.6) {
    issues.push({ code: 'technique', severity: 'warning', source: 'technique', exerciseId: id, message: `${name}: техника недостаточна для текущей сложности`, recommendation: 'Снизить вес и оставить 3-4 RIR до стабилизации техники' });
  }
  if (stress.spine.level === 'high' || stress.shoulder.level === 'high' || stress.knee.level === 'high') {
    issues.push({ code: 'joint_stress', severity: assessment.score < 50 ? 'critical' : 'warning', source: 'biomechanics', exerciseId: id, message: `${name}: высокий суставной стресс`, recommendation: 'Проверить технику, объём и безопасную замену' });
  }

  const score = Math.max(0, Math.min(100, assessment.score - issues.filter(i => i.severity === 'critical').length * 25 - issues.filter(i => i.severity === 'warning').length * 10));
  return { exerciseId: id, name, score, blocked: issues.some(i => i.severity === 'critical'), issues };
}

export function analyzeTrainingSafety(input: TrainingSafetyInput): TrainingSafetyReport {
  const profile = input.profile || {};
  const injuries = profileInjuries(input);
  const orthopedic = computeOrthopedicConstraints({
    injuryHistory: injuries,
    jointLimitations: profile.jointLimitations || {},
    techniqueIssues: profile.techniqueIssues || [],
    currentPain: profile.currentPain || [],
  });
  const exercises = [...(input.exercises || []), ...planExercises(input.plan)].filter(Boolean);
  const exerciseResults = exercises.map(exercise => analyzeExercise(exercise, input, new Set(orthopedic.blockedPatterns)));
  const issues: SafetyIssue[] = [];
  const adjustments = [] as TrainingSafetyReport['adjustments'];
  issues.push(...orthopedic.recommendations.map<SafetyIssue>(message => ({ code: 'orthopedic', severity: orthopedic.phase === 'acute' ? 'critical' : 'warning', source: 'orthopedic', message })));
  exerciseResults.forEach(result => { issues.push(...result.issues); if (result.blocked) adjustments.push({ kind: 'exclude_exercise', value: result.exerciseId, exerciseId: result.exerciseId, reason: result.issues[0]?.message || 'Противопоказание' }); });

  const workload = input.workload || {};
  const acwr = workload.acwrRatio ?? 1;
  let volumeMultiplier = 1;
  if (acwr > 1.5) { issues.push({ code: 'acwr_dangerous', severity: 'critical', source: 'acwr', message: `ACWR ${acwr.toFixed(2)}: опасная зона`, recommendation: 'Снизить объём на 20-30% и рассмотреть deload' }); volumeMultiplier = 0.7; }
  else if (acwr > 1.3) { issues.push({ code: 'acwr_caution', severity: 'warning', source: 'acwr', message: `ACWR ${acwr.toFixed(2)}: зона осторожности`, recommendation: 'Снизить объём примерно на 10%' }); volumeMultiplier = 0.9; }
  if (workload.monotony != null && workload.monotony > 2) issues.push({ code: 'monotony', severity: 'warning', source: 'load', message: `Монотонность ${workload.monotony.toFixed(2)} выше 2`, recommendation: 'Добавить вариативность и восстановительный день' });
  if (profile.sleepHours != null && profile.sleepHours < 6) issues.push({ code: 'sleep', severity: 'warning', source: 'recovery', message: `Сон ${profile.sleepHours} ч: восстановление снижено`, recommendation: 'Снизить интенсивность до восстановления сна' });
  if (profile.hrvMs != null && profile.hrvMs < 50) issues.push({ code: 'hrv', severity: 'warning', source: 'recovery', message: `HRV ${profile.hrvMs} мс: низкая готовность`, recommendation: 'Оставить запас 2-3 RIR и сократить объём' });
  if (profile.stressLevel != null && profile.stressLevel > 7) issues.push({ code: 'stress', severity: 'warning', source: 'recovery', message: `Стресс ${profile.stressLevel}/10: восстановление ограничено` });

  if (input.cardio) {
    const cardio = input.cardio;
    if (cardio.type === 'hiit' && (acwr > 1.3 || profile.recovery != null && profile.recovery < 5)) {
      issues.push({ code: 'cardio_conflict', severity: 'critical', source: 'cardio', message: 'HIIT конфликтует с текущей нагрузкой/восстановлением', recommendation: 'Заменить на Zone 2 или recovery-кардио' });
      adjustments.push({ kind: 'cardio_limit', value: 'zone2', reason: 'Высокая общая нагрузка или низкое восстановление' });
    }
    if (cardio.daysPerWeek > 5 || cardio.durationMin > 90) issues.push({ code: 'cardio_dose', severity: 'warning', source: 'cardio', message: 'Кардио-доза выше безопасного базового диапазона', recommendation: 'Снизить длительность или количество дней' });
  }
  if (volumeMultiplier < 1) adjustments.push({ kind: 'volume_multiplier', value: volumeMultiplier, reason: 'ACWR/восстановление' });

  const finalIssues = uniqueIssues(issues);
  const critical = finalIssues.filter(issue => issue.severity === 'critical').length;
  const warning = finalIssues.filter(issue => issue.severity === 'warning').length;
  const score = Math.max(0, Math.min(100, 100 - critical * 28 - warning * 8));
  const level = critical > 0 && (finalIssues.some(i => i.code === 'blocked_pattern' || i.code === 'axial_load') || input.cardio?.type === 'hiit' && finalIssues.some(i => i.code === 'cardio_conflict'))
    ? 'blocked' : critical > 0 || score < 60 ? 'dangerous' : score < 80 ? 'caution' : 'safe';
  return {
    score, level,
    factors: { acwr: acwr, orthopedic: orthopedic.blockedPatterns.length, exerciseRisk: exerciseResults.filter(e => e.blocked).length, warnings: warning, critical },
    issues: finalIssues,
    recommendations: [...new Set(finalIssues.map(issue => issue.recommendation).filter(Boolean) as string[])],
    adjustments,
    exercises: exerciseResults,
    generatedAt: new Date().toISOString(),
  };
}
