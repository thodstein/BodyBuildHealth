/**
 * Work Capacity & Individual MRV Estimator
 * Analyzes the relationship between weekly volume and readiness score.
 */

export interface VolumeReadinessPoint {
  date: string;
  weeklyVolume: number; // total sets per week
  readinessScore: number; // 0-100
}

export interface MRVEstimationResult {
  estimatedMRV: number;
  confidence: 'low' | 'medium' | 'high';
  trend: 'improving' | 'declining' | 'stable';
  analysis: string;
  criticalVolume: number | null; // Volume where readiness significantly dropped
}

/**
 * Estimates individual MRV based on the point where readiness begins to decline consistently
 * relative to increasing volume.
 */
export function estimateIndividualMRV(data: VolumeReadinessPoint[]): MRVEstimationResult {
  if (data.length < 3) {
    return {
      estimatedMRV: 0, confidence: 'low', trend: 'stable',
      analysis: 'Недостаточно данных для оценки (нужно минимум 3 недели записей)',
      criticalVolume: null,
    };
  }

  // Sort by date
  const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Calculate correlations
  let dropPoints = 0;
  let volumeAtDrop: number[] = [];
  
  for (let i = 1; i < sorted.length; i++) {
    const volDiff = sorted[i].weeklyVolume - sorted[i-1].weeklyVolume;
    const readDiff = sorted[i].readinessScore - sorted[i-1].readinessScore;
    
    // If volume increased and readiness dropped significantly
    if (volDiff > 0 && readDiff < -10) {
      dropPoints++;
      volumeAtDrop.push(sorted[i].weeklyVolume);
    }
  }

  if (dropPoints === 0) {
    const maxVol = Math.max(...sorted.map(p => p.weeklyVolume));
    return {
      estimatedMRV: maxVol,
      confidence: 'medium',
      trend: 'stable',
      analysis: 'Падение готовности не зафиксировано. Ваш текущий объём переносится хорошо.',
      criticalVolume: null,
    };
  }

  const avgCriticalVol = volumeAtDrop.reduce((a, b) => a + b, 0) / volumeAtDrop.length;
  
  // Individual MRV is usually slightly below the critical drop point
  const estimatedMRV = Math.round(avgCriticalVol * 0.9);

  return {
    estimatedMRV,
    confidence: dropPoints >= 3 ? 'high' : 'medium',
    trend: sorted[sorted.length-1].readinessScore < sorted[0].readinessScore ? 'declining' : 'improving',
    analysis: `Зафиксировано ${dropPoints} случаев падения готовности при объёме > ${avgCriticalVol.toFixed(1)} сетов.`,
    criticalVolume: avgCriticalVol,
  };
}
