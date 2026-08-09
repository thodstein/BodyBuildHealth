import { BPEntry } from '../../../../../core/bp-hr-data';

interface TrendResult {
  slope: number; // наклон (изменение АД в день)
  intercept: number; // пересечение
  r2: number; // коэффициент детерминации
  prediction7d: number; // прогноз через 7 дней
  prediction14d: number; // прогноз через 14 дней
  trend: 'rising' | 'falling' | 'stable';
}

/**
 * Простая линейная регрессия для прогноза АД
 * На вход: массив записей BPEntry (отсортированных по дате)
 * Возвращает параметры тренда и прогноз
 */
export function calculateTrend(entries: BPEntry[], key: 'systolic' | 'diastolic'): TrendResult {
  if (entries.length < 3) {
    return {
      slope: 0, intercept: 0, r2: 0,
      prediction7d: entries[0]?.[key] || 0,
      prediction14d: entries[0]?.[key] || 0,
      trend: 'stable',
    };
  }

  // Преобразуем даты в числа (дни от первого измерения)
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = new Date(sorted[0].date).getTime();
  const points = sorted.map(e => ({
    x: (new Date(e.date).getTime() - firstDate) / (1000 * 60 * 60 * 24), // дни
    y: e[key],
  }));

  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R²
  const yMean = sumY / n;
  const ssTotal = points.reduce((sum, p) => sum + (p.y - yMean) ** 2, 0);
  const ssResidual = points.reduce((sum, p) => sum + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = 1 - ssResidual / ssTotal;

  const lastX = points[points.length - 1].x;
  const prediction7d = slope * (lastX + 7) + intercept;
  const prediction14d = slope * (lastX + 14) + intercept;

  const trend = Math.abs(slope) < 0.5 ? 'stable' : slope > 0 ? 'rising' : 'falling';

  return { slope, intercept, r2, prediction7d: Math.round(prediction7d), prediction14d: Math.round(prediction14d), trend };
}
