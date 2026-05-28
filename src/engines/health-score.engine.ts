export interface HealthMetrics {
  kcal: number;
  p: number;
  f: number;
  c: number;
  fiber: number;
  water: number;
  steps: number;
}

export function calculateHealthScore(metrics: HealthMetrics): number {
  const { kcal, p, f, c, fiber, water, steps } = metrics;
  
  // Простая формула для демонстрации
  let score = 100;
  
  // Штрафы за отклонения
  if (kcal < 1500 || kcal > 4000) score -= 10;
  if (p < 100) score -= 15;
  if (fiber < 25) score -= 10;
  if (water < 2) score -= 10;
  if (steps < 5000) score -= 10;
  
  return Math.max(0, Math.min(100, score));
}
