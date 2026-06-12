import { LabPoint, CourseEntry } from '../core/types';
import { calculateMultiSubstancePKPD } from './pkpd-superposition.engine';
import { calculateIndices } from './clinical-indices.engine';
import { calcAdherence } from './nutrition-tracker.engine';

export interface HealthScoreResult {
  score: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  vector: string;
  breakdown: { pharma: number; labs: number; nutrition: number };
  recommendations: string[];
}

function clamp(v: number, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }

export function calculateHealthScore(
  labs: LabPoint[],
  course: CourseEntry[],
  nutritionLog: Array<{ date: string; total: { kcal: number; p: number; f: number; c: number; fiber: number; water: number; steps: number } }>,
  targetKcal: number,
  targetProtein: number
): HealthScoreResult {
  // 1. Фарма-нагрузка (обратно пропорциональна: меньше токсичность = выше скор)
  const pkpd = calculateMultiSubstancePKPD(course, 4);
  const avgCp = pkpd.length ? pkpd.reduce((s, w) => s + w.cp, 0) / pkpd.length : 0;
  const avgTol = pkpd.length ? pkpd.reduce((s, w) => s + w.tol, 0) / pkpd.length : 0;
  const pharmaScore = pkpd.length ? clamp(100 - (avgCp / 500 * 60) - (avgTol * 40)) : 50;

  // 2. Лабораторный статус (на базе индексов и отклонений)
  const indices = calculateIndices(labs);
  let labDeviations = 0;
  Object.values(indices).forEach(idx => {
    if ('status' in idx && idx.status !== 'normal' && idx.status !== 'optimal') labDeviations++;
  });
  const labsScore = clamp(100 - (labDeviations * 15));

  // 3. Нутритивный adherence (среднее за последние 7 дней)
  const recentLogs = nutritionLog.slice(-7);
  const adherenceScores = recentLogs.map(l => {
    const target = { bmr: 0, tdee: 0, kcal: targetKcal, protein: targetProtein, fats: 0, carbs: 0, water: 0, fiber: 0, micros: {} };
    return calcAdherence(l.total, target).score;
  });
  const nutritionScore = recentLogs.length ? clamp(Math.round(adherenceScores.reduce((a,b)=>a+b,0)/recentLogs.length)) : 50;

  // Итог
  const score = Math.round(pharmaScore * 0.35 + labsScore * 0.45 + nutritionScore * 0.20);
  const trend = score > 65 ? 'improving' : score > 45 ? 'stable' : 'declining';
  const vector = trend === 'improving' ? '🟢 Курс переносится хорошо. Продолжать мониторинг.' : trend === 'stable' ? '🟡 Стабильный профиль. Усилить поддержку печени/липидов.' : '🔴 Прогрессирующая нагрузка. Рассмотреть снижение доз или паузу.';

  const recommendations: string[] = [];
  if (pharmaScore < 60) recommendations.push('⚠️ Высокая концентрация/толерантность. Рассмотреть делод или снижение дозы.');
  if (labsScore < 70) recommendations.push('🩸 Отклонения в маркерах. Сверьтесь с клиническими индексами во вкладке "Лабы".');
  if (nutritionScore < 60) recommendations.push('🥗 Низкий adherence. Скорректируйте БЖУ и водный баланс по планировщику.');
  if (recommendations.length === 0) recommendations.push('✅ Все системы в пределах целевых диапазонов.');

  return { score, trend, vector, breakdown: { pharma: Math.round(pharmaScore), labs: Math.round(labsScore), nutrition: Math.round(nutritionScore) }, recommendations };
}
