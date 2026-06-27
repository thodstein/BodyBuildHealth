// ── Score Training Engine — оценка тренировочного процесса по ТЗ-логике ──
// Risk_total = Σ(Factor_i * Weight_i)

import type { ModuleSystemScore, ModuleResult } from './score-engine';

// ─── Types ───

export interface TrainingInput {
  workoutsPerWeek: number;
  avgMinutes: number;
  intensity: 'low' | 'moderate' | 'high' | 'very_high';
  goal: 'strength' | 'hypertrophy' | 'endurance' | 'recomposition';
  experience: 'beginner' | 'intermediate' | 'advanced';
  sleepHours: number;
  stressLevel: number;
  jointPain: string[];
  programType?: 'powerlifting' | 'bodybuilding' | 'mixed';
  deloadWeeksAgo: number;
  weight: number;
  age: number;
  sex: 'male' | 'female';
}

// ─── Dimensions ───

const DIMENSION_CONFIG: Record<string, { label: string; icon: string; weight: number }> = {
  volume_load: { label: 'Объём нагрузки', icon: '🏋️', weight: 1.3 },
  recovery: { label: 'Восстановление', icon: '😴', weight: 1.4 },
  joint_health: { label: 'Здоровье суставов', icon: '🦴', weight: 1.2 },
  cns_load: { label: 'Нагрузка на ЦНС', icon: '🧠', weight: 1.1 },
  program_balance: { label: 'Баланс программы', icon: '⚖️', weight: 1.0 },
  consistency: { label: 'Регулярность', icon: '📅', weight: 0.9 },
};

export function analyzeTraining(input: TrainingInput): ModuleResult {
  const { workoutsPerWeek, avgMinutes, intensity, goal, experience, sleepHours, stressLevel, jointPain, deloadWeeksAgo, weight, age, sex } = input;

  // Phase 1: Score each dimension (TZ: Factor_i)

  // Volume load score
  const weeklyVolume = workoutsPerWeek * avgMinutes;
  let volumeScore = 0;
  if (weeklyVolume < 150) volumeScore = 100 - (weeklyVolume / 150) * 100;
  else if (weeklyVolume <= 450) volumeScore = 0;
  else volumeScore = Math.min(100, (weeklyVolume - 450) / 5);
  const volScore = Math.round(Math.min(100, volumeScore));

  // Recovery score
  let recoveryScore = 0;
  const sleepScore = sleepHours < 6 ? 60 : sleepHours < 7 ? 30 : sleepHours < 8 ? 15 : 0;
  const stressScore = stressLevel > 7 ? 40 : stressLevel > 5 ? 20 : stressLevel > 3 ? 10 : 0;
  recoveryScore = Math.min(100, sleepScore + stressScore);
  const recScore = Math.round(recoveryScore);

  // Joint health score
  const jointScore = Math.round(Math.min(100, jointPain.length * 20));

  // CNS load score
  const intensityMap: Record<string, number> = { low: 0, moderate: 10, high: 25, very_high: 45 };
  let cnsScore = (intensityMap[intensity] || 0);
  if (deloadWeeksAgo > 8) cnsScore += 15;
  if (sleepHours < 6) cnsScore += 10;
  const cnsFinal = Math.round(Math.min(100, cnsScore));

  // Program balance
  let progScore = 0;
  if (workoutsPerWeek <= 3) progScore = 10;
  else if (workoutsPerWeek >= 6) progScore = 20;
  else progScore = 0;
  const progFinal = Math.round(Math.min(100, progScore));

  // Consistency
  let consScore = 0;
  if (workoutsPerWeek < 2) consScore = 50;
  else if (workoutsPerWeek < 3) consScore = 25;
  else if (workoutsPerWeek > 5) consScore = 10;
  const consFinal = Math.round(consScore);

  const dimensions: Array<{ id: string; deficit: number }> = [
    { id: 'volume_load', deficit: volScore },
    { id: 'recovery', deficit: recScore },
    { id: 'joint_health', deficit: jointScore },
    { id: 'cns_load', deficit: cnsFinal },
    { id: 'program_balance', deficit: progFinal },
    { id: 'consistency', deficit: consFinal },
  ];

  // Phase 2: Convert to systems (TZ: Σ(Factor_i * Weight_i))
  const systems: ModuleSystemScore[] = [];
  for (const dim of dimensions) {
    const config = DIMENSION_CONFIG[dim.id];
    if (!config) continue;
    const weightedScore = Math.min(100, Math.round(dim.deficit * config.weight));
    let level: 'low' | 'moderate' | 'high' = 'low';
    if (weightedScore >= 60) level = 'high';
    else if (weightedScore >= 30) level = 'moderate';
    systems.push({
      id: dim.id,
      label: config.label,
      icon: config.icon,
      rawScore: dim.deficit,
      weightedScore,
      level,
      coverage: 0, afterSupport: weightedScore, reduction: 0,
    });
  }

  systems.sort((a, b) => b.weightedScore - a.weightedScore);

  const overallRaw = systems.length > 0 ? Math.max(...systems.map(s => s.weightedScore)) : 0;

  // Phase 3: Recommendations
  const recommendations: string[] = [];
  const high = systems.filter(s => s.weightedScore >= 60);
  const moderate = systems.filter(s => s.weightedScore >= 30 && s.weightedScore < 60);

  if (high.length > 0) {
    recommendations.push(`⚠ Критические проблемы: ${high.map(s => s.label).join(', ')}.`);
  }
  if (moderate.length > 0) {
    recommendations.push(`⚡ Требуют внимания: ${moderate.map(s => s.label).join(', ')}.`);
  }
  if (recScore >= 30) {
    if (sleepHours < 7) recommendations.push(`😴 Увеличьте сон до 7-8 ч (сейчас ${sleepHours} ч).`);
    if (stressLevel > 5) recommendations.push(`🧘 Снизьте уровень стресса (${stressLevel}/10). Добавьте Mg, L-теанин, адаптогены.`);
    if (deloadWeeksAgo > 8) recommendations.push(`🔄 Запланируйте разгрузочную неделю (делауд) — прошло ${deloadWeeksAgo} нед без разгрузки.`);
  }
  if (jointScore >= 30) {
    recommendations.push(`🦴 Проблемные суставы: ${jointPain.join(', ')}. Рекомендованы НПВС, коллаген, хондроитин, коррекция техники.`);
  }
  if (volScore >= 30 && weeklyVolume > 450) {
    recommendations.push(`🏋️ Снизьте недельный объём до 300-420 мин (сейчас ${weeklyVolume} мин). Риск перетренированности.`);
  } else if (volScore >= 30 && weeklyVolume < 150) {
    recommendations.push(`🏋️ Увеличьте недельный объём до 200+ мин (сейчас ${weeklyVolume} мин). Недостаточно для прогресса.`);
  }
  if (overallRaw < 30) {
    recommendations.push('✅ Тренировочный процесс сбалансирован. Поддерживайте текущий режим.');
  }

  return {
    module: 'training',
    timestamp: new Date().toISOString(),
    profile: { weight, age, sex },
    systems,
    overallRaw,
    overallAfterSupport: overallRaw,
    recommendations,
    supportCount: 0,
    details: {
      weeklyVolume, workoutsPerWeek, avgMinutes, intensity,
      sleepHours, stressLevel, deloadWeeksAgo, jointPain,
      dimensions: dimensions.reduce((acc, d) => ({ ...acc, [d.id]: d.deficit }), {} as Record<string, number>),
    },
  };
}

export function generateTrainingReport(result: ModuleResult): string {
  let text = `🏋️ АНАЛИЗ ТРЕНИРОВОЧНОГО ПРОЦЕССА\n`;
  text += `${'═'.repeat(40)}\n`;
  text += `📅 ${new Date(result.timestamp).toLocaleString('ru-RU')}\n`;
  text += `👤 ${result.profile.weight}кг · ${result.profile.age}лет\n\n`;

  const d = result.details as any;
  text += `📊 ПАРАМЕТРЫ\n`;
  text += `  📅 ${d.workoutsPerWeek} тренировок/нед · ${d.avgMinutes} мин\n`;
  text += `  📦 Объём: ${d.weeklyVolume} мин/нед\n`;
  text += `  😴 Сон: ${d.sleepHours} ч · Стресс: ${d.stressLevel}/10\n`;
  text += `  🔄 Делауд: ${d.deloadWeeksAgo} нед назад\n`;
  if (d.jointPain?.length > 0) text += `  🦴 Суставы: ${d.jointPain.join(', ')}\n`;
  text += '\n';

  text += `📊 СИСТЕМЫ ТРЕНИРОВОК\n`;
  for (const s of result.systems) {
    const icon = s.level === 'high' ? '🔴' : s.level === 'moderate' ? '🟡' : '🟢';
    text += `  ${icon} ${s.icon} ${s.label}: ${s.weightedScore}%\n`;
  }
  text += '\n';

  text += `💡 РЕКОМЕНДАЦИИ\n`;
  for (const r of result.recommendations) text += `  • ${r}\n`;

  text += `\n${'═'.repeat(40)}\n✅ Score Training Engine v2`;
  return text;
}
