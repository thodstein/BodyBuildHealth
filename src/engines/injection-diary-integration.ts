/**
 * injection-diary-integration.ts — интеграция дневника инъекций с другими модулями.
 *
 * Предоставляет данные для:
 * - Support Calculator (PED-risk анализ по фактическим зонам)
 * - Pharma модуль (сравнение плановых vs фактических инъекций)
 * - Risk Engine (отслеживание осложнений по зонам)
 * - Reports (сводка по инъекциям за период)
 */

import { getInjectionDiary, computeInjectionStats, detectInjectionAnomalies, getRotationWarnings, getWeeklyFrequency, parseDose, getInjectionTrend, getZoneTechniqueMatrix, getLastInjection, localDateDaysAgo, getInjectionRecommendations } from './injection-diary.engine';

export interface InjectionDiarySummary {
  totalInjections: number;
  recentInjections: { date: string; substance: string; dose: string; zone: string }[];
  stats: ReturnType<typeof computeInjectionStats>;
  anomalies: ReturnType<typeof detectInjectionAnomalies>;
  rotationWarnings: ReturnType<typeof getRotationWarnings>;
  weeklyFrequency: ReturnType<typeof getWeeklyFrequency>;
  recommendations: ReturnType<typeof getInjectionRecommendations>;
}

export function getInjectionDiarySummary(days: number = 30): InjectionDiarySummary {
  const entries = getInjectionDiary();
  const cutoff = localDateDaysAgo(days);
  const recent = entries.filter(e => e.date >= cutoff);
  
  return {
    totalInjections: entries.length,
    recentInjections: recent.slice(-10).map(e => ({
      date: e.date,
      substance: e.substance,
      dose: e.dose,
      zone: e.zone,
    })),
    stats: computeInjectionStats(entries),
    anomalies: detectInjectionAnomalies(entries),
    rotationWarnings: getRotationWarnings(entries),
    weeklyFrequency: getWeeklyFrequency(entries, 4),
    recommendations: getInjectionRecommendations(entries),
  };
}

export function getInjectionDiaryForSupportCalc() {
  const entries = getInjectionDiary();
  const stats = computeInjectionStats(entries);
  
  const substances = entries.map(e => ({
    name: e.substance,
    dose: parseDose(e.dose)?.value || 0,
    unit: parseDose(e.dose)?.unit || '',
    zone: e.zone,
    date: e.date,
  }));
  
  const substanceCounts = new Map<string, number>();
  for (const s of substances) {
    substanceCounts.set(s.name, (substanceCounts.get(s.name) || 0) + 1);
  }
  
  return {
    totalInjections: entries.length,
    substances: [...substanceCounts.entries()].map(([name, count]) => ({ name, count })),
    complicationRate: stats.complicationRate,
    avgPain: stats.avgPain,
    avgPip: stats.avgPip,
    zoneStats: stats.zoneStats,
    recentSubstances: substances.slice(-5),
  };
}

export function getInjectionDiaryForPharma() {
  const entries = getInjectionDiary();
  const today = localDateDaysAgo(0);
  const last30 = entries.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d >= new Date(localDateDaysAgo(30) + 'T00:00:00');
  });
  
  const substanceDoses = new Map<string, { totalDose: number; count: number; unit: string }>();
  for (const e of last30) {
    const parsed = parseDose(e.dose);
    const existing = substanceDoses.get(e.substance) || { totalDose: 0, count: 0, unit: parsed?.unit || '' };
    existing.totalDose += parsed?.value || 0;
    existing.count += 1;
    substanceDoses.set(e.substance, existing);
  }
  
  return {
    entries: last30.map(e => ({
      date: e.date,
      substance: e.substance,
      dose: e.dose,
      zone: e.zone,
      technique: e.technique,
      volumeMl: e.volumeMl,
    })),
    substanceSummary: [...substanceDoses.entries()].map(([name, data]) => ({
      name,
      totalDose: Math.round(data.totalDose * 100) / 100,
      count: data.count,
      unit: data.unit,
      avgDose: data.count > 0 ? Math.round((data.totalDose / data.count) * 100) / 100 : 0,
    })),
    totalEntries: last30.length,
  };
}

export function getInjectionDiaryForRiskEngine() {
  const entries = getInjectionDiary();
  const anomalies = detectInjectionAnomalies(entries);
  const rotationWarnings = getRotationWarnings(entries);
  const stats = computeInjectionStats(entries);
  
  const riskFactors: string[] = [];
  if (stats.complicationRate >= 20) riskFactors.push(`Высокий процент осложнений: ${stats.complicationRate}%`);
  if (stats.avgPip && stats.avgPip >= 4) riskFactors.push(`Средний PIP ${stats.avgPip}/10`);
  if (rotationWarnings.some(w => w.severity === 'danger')) riskFactors.push('Зоны не использовались ≥14 дней (риск фиброза)');
  if (anomalies.filter(a => a.category === 'infection').length >= 2) riskFactors.push('Множественные признаки инфицирования');
  
  return {
    riskFactors,
    anomalies: anomalies.slice(-5),
    rotationWarnings: rotationWarnings.slice(0, 5),
    stats,
    recommendation: riskFactors.length > 0
      ? 'Рекомендуется обратиться к специалисту для оценки техники инъекций и ротации зон'
      : 'Осложнений не выявлено, техника инъекций адекватная',
  };
}
