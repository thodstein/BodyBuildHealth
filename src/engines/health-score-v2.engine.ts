/**
 * Health Score Engine — Aggregate wellness score from all domains.
 *
 * Combines:
 *  - Pharmacology risk (from risk engine)
 *  - Lab compliance (weeks since last labs)
 *  - Nutrition adherence (% of targets met)
 *  - Training consistency (sessions/week vs planned)
 *  - Recovery quality (sleep + HRV + subjective)
 *  - Body composition (trend toward goal)
 *
 * Produces a single 0-100 health score with breakdown.
 *
 * @module health-score-v2
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface HealthScoreInput {
  pharmaRisk: number;        // 0-100 from risk engine
  weeksSinceLab: number;     // 0-52
  nutritionAdherence: number; // 0-100
  trainingConsistency: number; // 0-100
  sleepScore: number;        // 0-100
  hrvScore: number;          // 0-100
  weightTrend: number;       // kg/week toward goal (positive = good)
  subjectiveEnergy: number;  // 1-5
  subjectiveStress: number;  // 1-5 (lower = better)
}

export interface HealthScoreOutput {
  overallScore: number;
  label: 'Отлично' | 'Хорошо' | 'Удовлетворительно' | 'Требует внимания' | 'Критично';
  breakdown: {
    pharma: { score: number; weight: number; message: string };
    labs: { score: number; weight: number; message: string };
    nutrition: { score: number; weight: number; message: string };
    training: { score: number; weight: number; message: string };
    recovery: { score: number; weight: number; message: string };
    bodyComp: { score: number; weight: number; message: string };
  };
  topIssues: string[];
  topWins: string[];
  trend: 'improving' | 'stable' | 'declining';
}

// ═══════════════════════════════════════════════════════════════════════════
// Scoring
// ═══════════════════════════════════════════════════════════════════════════

function scorePharma(risk: number): { score: number; message: string } {
  if (risk <= 20) return { score: 90, message: 'Риски минимальны' };
  if (risk <= 40) return { score: 70, message: 'Умеренные риски — мониторинг' };
  if (risk <= 60) return { score: 45, message: 'Повышенные риски — требуется коррекция' };
  if (risk <= 80) return { score: 20, message: 'Высокие риски — необходима коррекция курса' };
  return { score: 5, message: 'Критические риски — немедленное внимание' };
}

function scoreLabs(weeksSinceLab: number): { score: number; message: string } {
  if (weeksSinceLab <= 4) return { score: 90, message: 'Анализы актуальны' };
  if (weeksSinceLab <= 8) return { score: 65, message: 'Анализы просрочены' };
  if (weeksSinceLab <= 12) return { score: 35, message: 'Анализы сильно просрочены' };
  return { score: 10, message: 'Анализов нет / критическая просрочка' };
}

function scoreNutrition(adherence: number): { score: number; message: string } {
  if (adherence >= 85) return { score: 90, message: 'Отличное соблюдение' };
  if (adherence >= 70) return { score: 70, message: 'Хорошее соблюдение' };
  if (adherence >= 50) return { score: 45, message: 'Среднее соблюдение' };
  return { score: 20, message: 'Плохое соблюдение диеты' };
}

function scoreTraining(consistency: number): { score: number; message: string } {
  if (consistency >= 90) return { score: 90, message: 'Отличная дисциплина' };
  if (consistency >= 75) return { score: 70, message: 'Хорошая дисциплина' };
  if (consistency >= 50) return { score: 45, message: 'Пропуски тренировок' };
  return { score: 15, message: 'Нерегулярные тренировки' };
}

function scoreRecovery(sleep: number, hrv: number, stress: number, energy: number): { score: number; message: string } {
  const energyScore = Math.max(20, Math.min(100, energy * 20)); // 1-5 → 20-100
  const avg = sleep * 0.30 + hrv * 0.30 + (100 - stress * 20) * 0.25 + energyScore * 0.15;
  if (avg >= 75) return { score: 85, message: 'Отличное восстановление' };
  if (avg >= 55) return { score: 60, message: 'Нормальное восстановление' };
  if (avg >= 35) return { score: 35, message: 'Недостаточное восстановление' };
  return { score: 10, message: 'Критически низкое восстановление' };
}

function scoreBodyComp(weightTrend: number): { score: number; message: string } {
  if (Math.abs(weightTrend) < 0.1) return { score: 75, message: 'Вес стабилен' };
  if (weightTrend > 0.5) return { score: 85, message: 'Хороший набор массы' };
  if (weightTrend < -0.5) return { score: 85, message: 'Хорошая сушка' };
  if (weightTrend > 0.2) return { score: 70, message: 'Медленный набор' };
  return { score: 70, message: 'Медленная сушка' };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Engine
// ═══════════════════════════════════════════════════════════════════════════

export function computeHealthScore(input: HealthScoreInput): HealthScoreOutput {
  const pharma = scorePharma(input.pharmaRisk);
  const labs = scoreLabs(input.weeksSinceLab);
  const nutrition = scoreNutrition(input.nutritionAdherence);
  const training = scoreTraining(input.trainingConsistency);
  const recovery = scoreRecovery(input.sleepScore, input.hrvScore, input.subjectiveStress, input.subjectiveEnergy);
  const bodyComp = scoreBodyComp(input.weightTrend);

  const components = [
    { ...pharma, weight: 0.20, key: 'pharma' },
    { ...labs, weight: 0.15, key: 'labs' },
    { ...nutrition, weight: 0.15, key: 'nutrition' },
    { ...training, weight: 0.15, key: 'training' },
    { ...recovery, weight: 0.20, key: 'recovery' },
    { ...bodyComp, weight: 0.15, key: 'bodyComp' },
  ];

  const overall = Math.round(components.reduce((s, c) => s + c.score * c.weight, 0));

  let label: HealthScoreOutput['label'] = 'Удовлетворительно';
  if (overall >= 80) label = 'Отлично';
  else if (overall >= 65) label = 'Хорошо';
  else if (overall >= 45) label = 'Удовлетворительно';
  else if (overall >= 25) label = 'Требует внимания';
  else label = 'Критично';

  const topIssues = components.filter(c => c.score < 50).sort((a, b) => a.score - b.score).map(c => c.message);
  const topWins = components.filter(c => c.score >= 80).sort((a, b) => b.score - a.score).map(c => c.message);

  return {
    overallScore: overall,
    label,
    breakdown: {
      pharma: { score: pharma.score, weight: 0.20, message: pharma.message },
      labs: { score: labs.score, weight: 0.15, message: labs.message },
      nutrition: { score: nutrition.score, weight: 0.15, message: nutrition.message },
      training: { score: training.score, weight: 0.15, message: training.message },
      recovery: { score: recovery.score, weight: 0.20, message: recovery.message },
      bodyComp: { score: bodyComp.score, weight: 0.15, message: bodyComp.message },
    },
    topIssues,
    topWins,
    trend: overall >= 65 ? 'improving' : overall >= 45 ? 'stable' : 'declining',
  };
}
