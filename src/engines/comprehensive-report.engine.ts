import { getWeightLog, getMeasurementsLog } from './profile-store';
import { loadEntries as loadBodyCompEntries } from './body-composition.engine';
import { getLabDiary, getMarkerHistory, getLabDiaryStats } from './lab-diary.engine';
import { strengthDiary } from './strength-diary.engine';
import { loadSessions as loadWorkoutSessions } from './workout-logger.engine';
import { getSymptomDiary, getSymptomDiaryStats, getSymptomDiarySummary, getSymptomChartData } from './symptom-diary.engine';
import { loadMetrics, getMetricsHistory, getRollingAverages, weightTrend } from './profile-settings.engine';
import { getBpEntries, getAvgBp } from '../core/bp-hr-data';
import { getProfile, updateProfile } from '../core/profile-manager';
import { loadReadinessHistory } from '../ui/screens/TrainingScreen_parts/readiness-history';
import { getScoreHistory } from './score-history';
import { analyzeMeasurements, loadMeasurements } from './log-analytics-progression.engine';
import type { BodyMeasurement } from './log-analytics-progression.engine';
import type { BodyCompEntry } from './body-composition.engine';
import type { UnifiedSettings } from '../core/types';

/* ─── Типы ─── */

export interface ReportMeta {
  type: 'weekly' | 'monthly';
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  userName: string;
  age?: number;
  sex?: string;
  period: 'mass' | 'cut' | 'maintenance';
  courseWeek?: number;
  coursePhase?: string;
}

export interface ReportMetric {
  label: string;
  unit: string;
  prev?: number | string | null | undefined;
  current?: number | string | null | undefined;
  refLow?: number | null | undefined;
  refHigh?: number | null | undefined;
  delta?: number | null;
  deltaPct?: number | null;
  trend?: 'up' | 'down' | 'stable' | 'new' | 'no_data';
  status?: 'normal' | 'warning' | 'critical' | 'info';
  sparkline?: number[];
  note?: string;
}

export interface ReportSection {
  id: string;
  title: string;
  icon: string;
  metrics: ReportMetric[];
}

export interface ProgressPhoto {
  date: string;
  dataUrl: string;
  angle: 'front' | 'side' | 'back' | 'other';
  label?: string;
}

export interface SupportScheduleSection {
  course: {
    isActive: boolean;
    startDate: string;
    weekCurrent: number;
    weekTotal: number;
    phase: string;
    substances: Array<{
      id: string;
      name: string;
      doseDisplay: string;
      route: 'inject' | 'oral';
      frequency: string;
      startWeek: number;
      endWeek: number;
      isAAS: boolean;
      potencyFactor?: number;
      className?: string;
    }>;
  };
  schedule: {
    morning: Array<{ id: string; name: string; dose: string; timing: string; mechanism?: string; warnings?: string[] }>;
    afternoon: Array<{ id: string; name: string; dose: string; timing: string; mechanism?: string; warnings?: string[] }>;
    evening: Array<{ id: string; name: string; dose: string; timing: string; mechanism?: string; warnings?: string[] }>;
  };
  supplements: Array<{ id: string; name: string; doseMg: number; unit: string; notes?: string; source: 'profile' | 'support_plan' | 'favorites' }>;
  medications: Array<{ id: string; name: string; doseMg: number; unit: string; frequency: string; notes?: string; source: 'profile' | 'support_plan' }>;
  monitoring: Array<{ marker: string; when: string; targetRange?: string }>;
  pillBurden: { totalSubstances: number; pillsPerDay: number; morning: number; afternoon: number; evening: number; feasibility: string };
  depletionWarnings: Array<{ depleter: string; depleted: string; recommendation: string }>;
  conflicts: Array<{ a: string; b: string; effect: string; severity: string; advice: string }>;
}

export interface ReportRecommendation {
  section: string;
  priority: 'critical' | 'warning' | 'info';
  text: string;
}

export interface ComprehensiveReport {
  meta: ReportMeta;
  sections: ReportSection[];
  support: SupportScheduleSection;
  userNotes: string;
  recommendations: ReportRecommendation[];
  trends?: {
    weightWeekly: { week: string; kg: number }[];
    hrvWeekly: { week: string; avg: number }[];
    volumeWeekly: { week: string; tonnes: number }[];
    riskWeekly: { week: string; score: number }[];
  };
  photos?: ProgressPhoto[];
}

/* ─── Утилиты ─── */

function todayIso(): string { return new Date().toISOString().slice(0, 10); }

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

export function computeDelta(prev: number | null | undefined, current: number | null | undefined): { delta: number | null; deltaPct: number | null; trend: 'up' | 'down' | 'stable' | 'new' | 'no_data' } {
  if (prev == null || current == null || isNaN(prev as number) || isNaN(current as number)) {
    return { delta: null, deltaPct: null, trend: 'no_data' };
  }
  const d = current - prev;
  const pct = prev !== 0 ? (d / Math.abs(prev)) * 100 : 0;
  if (Math.abs(pct) < 1) {
    return { delta: d, deltaPct: pct, trend: 'stable' };
  }
  return { delta: d, deltaPct: pct, trend: d > 0 ? 'up' : 'down' };
}

function computeSparkline<T>(entries: T[], field: keyof T, dateFrom: string, dateTo: string): number[] {
  const filtered = entries
    .filter(e => (e as any).date >= dateFrom && (e as any).date <= dateTo)
    .sort((a, b) => ((a as any).date as string).localeCompare((b as any).date as string));
  return filtered.map(e => Number((e as any)[field])).filter(v => !isNaN(v));
}

export function assignStatus(metric: ReportMetric): void {
  if (metric.current == null || (typeof metric.current === 'number' && isNaN(metric.current))) {
    metric.status = 'info';
    return;
  }
  const cur = typeof metric.current === 'number' ? metric.current : parseFloat(metric.current);
  if (!isNaN(cur) && metric.refLow != null && metric.refHigh != null) {
    if (cur < metric.refLow || cur > metric.refHigh) {
      metric.status = (cur < metric.refLow * 0.7 || cur > metric.refHigh * 1.3) ? 'critical' : 'warning';
    } else {
      metric.status = 'normal';
    }
  }
  if (metric.status == null && metric.deltaPct != null) {
    metric.status = Math.abs(metric.deltaPct) > 20 ? 'warning' : 'normal';
  }
}

function formatNum(v: number | string | undefined): string {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'number') return v % 1 === 0 ? String(v) : v.toFixed(1);
  return String(v);
}

/* ─── Gather-функции ─── */

function gatherAnthropometry(dateFrom: string, dateTo: string): ReportSection {
  const bodyComp = loadBodyCompEntries();
  const measurements = loadMeasurements();
  const weightLog = getWeightLog();

  const recentComp = bodyComp.filter(e => e.date >= dateFrom && e.date <= dateTo);
  const prevComp = bodyComp.filter(e => e.date < dateFrom).sort((a, b) => b.date.localeCompare(a.date));

  const prevWeight = prevComp.length > 0 ? prevComp[0].weightKg : (weightLog.length > 0 ? weightLog[0].weight : null);
  const curWeight = recentComp.length > 0 ? recentComp[recentComp.length - 1].weightKg : (weightLog.length > 0 ? weightLog[weightLog.length - 1].weight : null);

  const metrics: ReportMetric[] = [
    {
      label: 'Вес', unit: 'кг', prev: prevWeight, current: curWeight,
      sparkline: computeSparkline(bodyComp, 'weightKg', dateFrom, dateTo),
      note: curWeight && prevWeight ? `Δ: ${(curWeight - prevWeight).toFixed(1)} кг` : undefined,
    },
    {
      label: '% жира', unit: '%', prev: prevComp.length > 0 ? prevComp[0].bodyFatPercent : undefined,
      current: recentComp.length > 0 ? recentComp[recentComp.length - 1].bodyFatPercent : undefined,
      sparkline: computeSparkline(bodyComp, 'bodyFatPercent', dateFrom, dateTo),
    },
  ];

  if (recentComp.length > 0 || prevComp.length > 0) {
    const prevEntry = prevComp[0] || recentComp[0];
    const curEntry = recentComp[recentComp.length - 1];
    const lbmPrev = prevEntry.weightKg && prevEntry.bodyFatPercent ? prevEntry.weightKg * (1 - prevEntry.bodyFatPercent / 100) : undefined;
    const lbmCur = curEntry.weightKg && curEntry.bodyFatPercent ? curEntry.weightKg * (1 - curEntry.bodyFatPercent / 100) : undefined;
    metrics.push({ label: 'Мышечная масса (LBM)', unit: 'кг', prev: lbmPrev, current: lbmCur });
  }

  const measFields: Array<{ key: keyof BodyMeasurement; label: string }> = [
    { key: 'waistCm', label: 'Талия' }, { key: 'hipCm', label: 'Бёдра' }, { key: 'chestCm', label: 'Грудь' },
    { key: 'shoulderCm', label: 'Плечо' }, { key: 'neckCm', label: 'Шея' },
    { key: 'armLeftCm', label: 'Бицепс L' }, { key: 'armRightCm', label: 'Бицепс R' },
    { key: 'forearmLeftCm', label: 'Предплечье L' }, { key: 'forearmRightCm', label: 'Предплечье R' },
    { key: 'thighLeftCm', label: 'Бедро L' }, { key: 'thighRightCm', label: 'Бедро R' },
    { key: 'calfLeftCm', label: 'Голень L' }, { key: 'calfRightCm', label: 'Голень R' },
  ];

  const recentMeas = measurements.filter(e => e.date >= dateFrom && e.date <= dateTo);
  const prevMeas = measurements.filter(e => e.date < dateFrom).sort((a, b) => b.date.localeCompare(a.date));

  measFields.forEach(({ key, label }) => {
    const prevVal = prevMeas.length > 0 ? prevMeas[0][key] : undefined;
    const curVal = recentMeas.length > 0 ? recentMeas[recentMeas.length - 1][key] : undefined;
    if (prevVal !== undefined || curVal !== undefined) {
      metrics.push({
        label, unit: 'см', prev: prevVal ?? undefined, current: curVal ?? undefined,
        sparkline: computeSparkline(measurements, key, dateFrom, dateTo),
      });
    }
  });

  return {
    id: 'anthropometry', title: 'Антропометрия', icon: '📐', metrics };
}

function gatherLabs(dateFrom: string, dateTo: string): ReportSection {
  const diary = getLabDiary();
  const recentDiary = diary.filter(e => e.date >= dateFrom && e.date <= dateTo);
  const prevDiary = diary.filter(e => e.date < dateFrom).sort((a, b) => b.date.localeCompare(a.date));

  const groups: Array<{ title: string; markers: Array<{ code: string; name: string; refLow?: number; refHigh?: number; unit: string }> }> = [
    { title: 'Печень', markers: [
      { code: 'АЛТ', name: 'АЛТ', refLow: 0, refHigh: 40, unit: 'U/L' },
      { code: 'АСТ', name: 'АСТ', refLow: 0, refHigh: 40, unit: 'U/L' },
      { code: 'ГГТ', name: 'ГГТ', refLow: 0, refHigh: 60, unit: 'U/L' },
      { code: 'Билирубин общий', name: 'Билирубин общий', refLow: 3, refHigh: 21, unit: 'µmol/L' },
    ]},
    { title: 'Почки', markers: [
      { code: 'Креатинин', name: 'Креатинин', refLow: 60, refHigh: 110, unit: 'µmol/L' },
      { code: 'Мочевина', name: 'Мочевина', refLow: 2.5, refHigh: 8.3, unit: 'mmol/L' },
      { code: 'СКФ', name: 'СКФ (GFR)', refLow: 90, refHigh: 120, unit: 'ml/min' },
    ]},
    { title: 'Липиды', markers: [
      { code: 'Холестерин общий', name: 'Холестерин общий', refHigh: 5.2, unit: 'mmol/L' },
      { code: 'ЛПНП', name: 'ЛПНП', refLow: 0, refHigh: 3.0, unit: 'mmol/L' },
      { code: 'ЛПВП', name: 'ЛПВП', refLow: 1.0, refHigh: 2.5, unit: 'mmol/L' },
      { code: 'Триглицериды', name: 'Триглицериды', refLow: 0.3, refHigh: 1.7, unit: 'mmol/L' },
    ]},
    { title: 'Гормоны', markers: [
      { code: 'Тестостерон', name: 'Тестостерон', refLow: 10, refHigh: 35, unit: 'nmol/L' },
      { code: 'Эстрадиол', name: 'Эстрадиол', refLow: 40, refHigh: 160, unit: 'pmol/L' },
      { code: 'Пролактин', name: 'Пролактин', refLow: 80, refHigh: 400, unit: 'mIU/L' },
      { code: 'ЛГ', name: 'ЛГ', refLow: 1.5, refHigh: 9.3, unit: 'IU/L' },
      { code: 'ФСГ', name: 'ФСГ', refLow: 1.4, refHigh: 18.1, unit: 'IU/L' },
      { code: 'ТТГ', name: 'ТТГ', refLow: 0.4, refHigh: 4.0, unit: 'mIU/L' },
      { code: 'Свободный T4', name: 'Свободный T4', refLow: 10, refHigh: 22, unit: 'pmol/L' },
    ]},
    { title: 'Кровь', markers: [
      { code: 'Гемоглобин', name: 'Гемоглобин', refLow: 120, refHigh: 160, unit: 'g/L' },
      { code: 'Гематокрит', name: 'Гематокрит', refLow: 36, refHigh: 50, unit: '%' },
      { code: 'Лейкоциты', name: 'Лейкоциты', refLow: 4, refHigh: 10, unit: '10⁹/L' },
      { code: 'Тромбоциты', name: 'Тромбоциты', refLow: 150, refHigh: 400, unit: '10⁹/L' },
    ]},
    { title: 'Воспаление', markers: [
      { code: 'СРБ', name: 'СРБ', refLow: 0, refHigh: 5, unit: 'mg/L' },
    ]},
    { title: 'Метаболизм', markers: [
      { code: 'Глюкоза', name: 'Глюкоза', refLow: 3.5, refHigh: 5.5, unit: 'mmol/L' },
      { code: 'Инсулин', name: 'Инсулин', refLow: 2.6, refHigh: 24.9, unit: 'µIU/mL' },
      { code: 'Мочевая кислота', name: 'Мочевая кислота', refLow: 210, refHigh: 420, unit: 'µmol/L' },
    ]},
    { title: 'Электролиты', markers: [
      { code: 'Натрий', name: 'Натрий', refLow: 136, refHigh: 145, unit: 'mmol/L' },
      { code: 'Калий', name: 'Калий', refLow: 3.5, refHigh: 5.1, unit: 'mmol/L' },
      { code: 'Магний', name: 'Магний', refLow: 0.66, refHigh: 1.07, unit: 'mmol/L' },
      { code: 'Кальций', name: 'Кальций', refLow: 2.1, refHigh: 2.55, unit: 'mmol/L' },
    ]},
  ];

  const metrics: ReportMetric[] = [];

  groups.forEach(group => {
    group.markers.forEach(marker => {
      const hist = getMarkerHistory(diary, marker.code);
      const recent = hist.filter(h => h.date >= dateFrom && h.date <= dateTo);
      const prev = hist.filter(h => h.date < dateFrom).sort((a, b) => b.date.localeCompare(a.date));

      const current = recent.length > 0 ? recent[recent.length - 1].value : null;
      const prevVal = prev.length > 0 ? prev[0].value : null;
      const { delta, deltaPct, trend } = computeDelta(prevVal, current);

      const m: ReportMetric = {
        label: marker.name, unit: marker.unit, prev: prevVal, current: current ?? 'Нет данных',
        refLow: marker.refLow, refHigh: marker.refHigh, delta, deltaPct, trend,
        sparkline: computeSparkline(hist, 'value', dateFrom, dateTo),
      };
      assignStatus(m);
      metrics.push(m);
    });
  });

  return {
    id: 'labs', title: 'Лаборатории', icon: '🧪', metrics };
}

function gatherRisks(dateFrom: string, dateTo: string): ReportSection {
  const scoreHistory = getScoreHistory();
  const recent = scoreHistory.filter(s => s.date >= dateFrom && s.date <= dateTo);
  const prev = scoreHistory.filter(s => s.date < dateFrom).sort((a, b) => b.date.localeCompare(a.date));

  const latest = recent.length > 0 ? recent[0] : (scoreHistory.length > 0 ? scoreHistory[0] : null);
  const prevScore = prev.length > 0 ? prev[0] : null;

  const metrics: ReportMetric[] = [
    {
      label: 'Overall risk score', unit: '', prev: prevScore?.modules?.overall?.overallRaw, current: latest?.modules?.overall?.overallRaw ?? 'Нет данных',
      delta: latest && prevScore ? (latest.modules?.overall?.overallRaw ?? 0) - (prevScore.modules?.overall?.overallRaw ?? 0) : undefined,
      deltaPct: latest && prevScore && prevScore.modules?.overall?.overallRaw ? ((latest.modules?.overall?.overallRaw - prevScore.modules?.overall?.overallRaw) / prevScore.modules?.overall?.overallRaw) * 100 : undefined,
      status: latest && (latest.modules?.overall?.overallRaw ?? 0) > 600 ? 'critical' : latest && (latest.modules?.overall?.overallRaw ?? 0) > 300 ? 'warning' : 'normal',
    },
  ];

  return {
    id: 'risks', title: 'Риски', icon: '⚠️', metrics };
}

async function gatherTraining(dateFrom: string, dateTo: string): Promise<ReportSection> {
  const logs = await strengthDiary.getWorkoutLogs();
  const recent = logs.filter(l => l.date >= dateFrom && l.date <= dateTo);
  const planned = 5;

  const enriched = recent.map(l => ({
    ...l,
    totalVolume: l.exercises.reduce((s, e) => s + (e.totalVolume || 0), 0),
  }));

  const totalVolume = enriched.reduce((sum, l) => sum + l.totalVolume, 0);
  const avgRpe = recent.length > 0 ? recent.reduce((sum, l) => sum + (l.overallRPE || 0), 0) / recent.length : null;
  const avgDuration = recent.length > 0 ? recent.reduce((sum, l) => sum + (l.duration || 0), 0) / recent.length : null;
  const totalPR = enriched.filter(l => l.exercises.some(e => (e.estimated1RM || 0) > 0)).length;

  const metrics: ReportMetric[] = [
    { label: 'Сессий', unit: 'шт', prev: planned, current: recent.length, status: recent.length >= planned ? 'normal' : 'warning' },
    { label: 'Adherence', unit: '%', current: planned > 0 ? Math.round((recent.length / planned) * 100) : 0, status: planned > 0 && recent.length >= planned ? 'normal' : 'warning' },
    { label: 'Объём', unit: 'т', current: Number((totalVolume / 1000).toFixed(1)), sparkline: computeSparkline(enriched, 'totalVolume', dateFrom, dateTo) },
    { label: 'Avg RPE', unit: '', prev: avgRpe, current: avgRpe },
    { label: 'Avg длительность', unit: 'мин', prev: avgDuration, current: avgDuration },
    { label: 'PR за период', unit: 'шт', current: totalPR },
  ];

  return {
    id: 'training', title: 'Тренировки', icon: '🏋️', metrics };
}

function gatherNutrition(dateFrom: string, dateTo: string): ReportSection {
  const profile = getProfile();
  const settings = (profile?.settings || {}) as any;
  const nutrition = settings.nutrition || {};
  const dailyMetrics = loadMetrics();
  const recentMetrics = dailyMetrics.filter(m => m.date >= dateFrom && m.date <= dateTo);

  const avgWater = recentMetrics.length > 0 ? recentMetrics.reduce((s, m) => s + (m.waterLiters || 0), 0) / recentMetrics.length : undefined;

  const metrics: ReportMetric[] = [
    { label: 'Средние kcal/день', unit: 'ккал', prev: nutrition.manualTargets?.kcal || undefined, current: nutrition.manualTargets?.kcal || 'Нет данных' },
    { label: 'Белок', unit: 'г', prev: nutrition.manualTargets?.protein, current: nutrition.manualTargets?.protein },
    { label: 'Жиры', unit: 'г', prev: nutrition.manualTargets?.fat, current: nutrition.manualTargets?.fat },
    { label: 'Углеводы', unit: 'г', prev: nutrition.manualTargets?.carbs, current: nutrition.manualTargets?.carbs },
    { label: 'Белок/кг', unit: 'г/кг', current: nutrition.proteinPerKg },
    { label: 'Вода', unit: 'л', prev: avgWater, current: avgWater },
    { label: 'Приёмов пищи', unit: 'шт', current: nutrition.mealsPerDay },
  ];

  return {
    id: 'nutrition', title: 'Питание', icon: '🍽️', metrics };
}

function gatherRecovery(dateFrom: string, dateTo: string): ReportSection {
  const dailyMetrics = loadMetrics();
  const recent = dailyMetrics.filter(m => m.date >= dateFrom && m.date <= dateTo);
  const profile = getProfile();
  const lifestyle = (profile?.settings || {}).lifestyle || {};

  const avgSleep = recent.length > 0 ? recent.reduce((s, m) => s + (m.sleepHours || 0), 0) / recent.length : lifestyle.sleepHours;
  const avgSleepQ = recent.length > 0 ? recent.reduce((s, m) => s + (m.sleepQuality || 0), 0) / recent.length : undefined;
  const avgHrv = recent.length > 0 ? recent.reduce((s, m) => s + (m.hrvMs || 0), 0) / recent.length : lifestyle.morningHRV;
  const avgRestHr = recent.length > 0 ? recent.reduce((s, m) => s + (m.restingHR || 0), 0) / recent.length : lifestyle.restingHR;
  const avgSteps = recent.length > 0 ? recent.reduce((s, m) => s + (m.steps || 0), 0) / recent.length : lifestyle.dailySteps;
  const avgStress = recent.length > 0 ? recent.reduce((s, m) => s + (m.subjectiveStress || 0), 0) / recent.length : lifestyle.stressLevel;

  const metrics: ReportMetric[] = [
    { label: 'Сон', unit: 'ч', prev: lifestyle.sleepHours, current: avgSleep, sparkline: computeSparkline(recent, 'sleepHours', dateFrom, dateTo) },
    { label: 'Качество сна', unit: '1-5', current: avgSleepQ },
    { label: 'HRV', unit: 'мс', prev: lifestyle.morningHRV, current: avgHrv, sparkline: computeSparkline(recent, 'hrvMs', dateFrom, dateTo) },
    { label: 'ЧСС покоя', unit: 'bpm', current: avgRestHr, sparkline: computeSparkline(recent, 'restingHR', dateFrom, dateTo) },
    { label: 'Шаги/день', unit: 'шт', current: avgSteps, sparkline: computeSparkline(recent, 'steps', dateFrom, dateTo) },
    { label: 'Стресс', unit: '1-10', prev: lifestyle.stressLevel, current: avgStress, sparkline: computeSparkline(recent, 'subjectiveStress', dateFrom, dateTo) },
  ];

  return {
    id: 'recovery', title: 'Восстановление', icon: '😴', metrics };
}

function gatherBloodPressure(dateFrom: string, dateTo: string): ReportSection {
  const entries = getBpEntries();
  const recent = entries.filter(e => e.date >= dateFrom && e.date <= dateTo);

  const morning = recent.filter(e => {
    const h = new Date(e.date).getHours();
    return h < 14 || (e.hr && e.hr < 70);
  });
  const evening = recent.filter(e => {
    const h = new Date(e.date).getHours();
    return h >= 14 || (e.hr && e.hr >= 70);
  });

  const avgMorningSys = morning.length > 0 ? Math.round(morning.reduce((s, e) => s + e.systolic, 0) / morning.length) : undefined;
  const avgMorningDia = morning.length > 0 ? Math.round(morning.reduce((s, e) => s + e.diastolic, 0) / morning.length) : undefined;
  const avgEveningSys = evening.length > 0 ? Math.round(evening.reduce((s, e) => s + e.systolic, 0) / evening.length) : undefined;
  const avgEveningDia = evening.length > 0 ? Math.round(evening.reduce((s, e) => s + e.diastolic, 0) / evening.length) : undefined;
  const maxSys = recent.length > 0 ? Math.max(...recent.map(e => e.systolic)) : undefined;
  const maxDia = recent.length > 0 ? Math.max(...recent.map(e => e.diastolic)) : undefined;

  const metrics: ReportMetric[] = [
    { label: 'Утро: систолическое', unit: 'мм рт.ст.', current: avgMorningSys ?? 'Нет данных' },
    { label: 'Утро: диастолическое', unit: 'мм рт.ст.', current: avgMorningDia ?? 'Нет данных' },
    { label: 'Вечер: систолическое', unit: 'мм рт.ст.', current: avgEveningSys ?? 'Нет данных' },
    { label: 'Вечер: диастолическое', unit: 'мм рт.ст.', current: avgEveningDia ?? 'Нет данных' },
    { label: 'Максимум систолическое', unit: 'мм рт.ст.', current: maxSys ?? 'Нет данных', status: maxSys && maxSys > 140 ? 'warning' : maxSys && maxSys > 160 ? 'critical' : 'normal' },
    { label: 'Максимум диастолическое', unit: 'мм рт.ст.', current: maxDia ?? 'Нет данных', status: maxDia && maxDia > 90 ? 'warning' : maxDia && maxDia > 100 ? 'critical' : 'normal' },
  ];

  return {
    id: 'blood_pressure', title: 'Артериальное давление', icon: '🩸', metrics };
}

function gatherCourse(dateFrom: string, dateTo: string): ReportSection {
  const profile = getProfile();
  const settings = (profile?.settings || {}) as any;
  const pharma = settings.pharma || {};
  const substances = pharma.currentSubstances || [];
  const courseData: any[] = [];

  if (pharma.courseStartDate) {
    const start = new Date(pharma.courseStartDate);
    const now = new Date();
    const diffDays = Math.max(1, daysBetween(pharma.courseStartDate, todayIso()));
    const weekCurrent = Math.floor(diffDays / 7) + 1;
    courseData.push({ label: 'Дата старта курса', current: pharma.courseStartDate });
    courseData.push({ label: 'Текущая неделя', current: weekCurrent, unit: 'нед' });
    courseData.push({ label: 'Фаза', current: pharma.phase || 'course' });
    courseData.push({ label: 'Тип курса', current: pharma.trainingCycleType || 'mass' });
  }

  const metrics: ReportMetric[] = courseData;

  return {
    id: 'course', title: 'Курс', icon: '💉', metrics };
}

function gatherSymptoms(dateFrom: string, dateTo: string): ReportSection {
  const diary = getSymptomDiary();
  const stats = getSymptomDiaryStats();
  const recent = diary.filter(d => d.date >= dateFrom && d.date <= dateTo);

  const activeCount = stats.activeSymptoms;
  const improved = stats.improving;
  const worsening = stats.worsening;
  const resolved = stats.resolved;

  const metrics: ReportMetric[] = [
    { label: 'Активные симптомы', unit: 'шт', current: activeCount },
    { label: 'Улучшившиеся', unit: 'шт', current: improved },
    { label: 'Ухудшившиеся', unit: 'шт', current: worsening, status: worsening > 0 ? 'warning' : 'normal' },
    { label: 'Разрешённые', unit: 'шт', current: resolved },
  ];

  return {
    id: 'symptoms', title: 'Симптомы', icon: '📋', metrics };
}

function gatherSupportSchedule(): SupportScheduleSection {
  const profile = getProfile();
  const settings = (profile?.settings || {}) as any;
  const pharma = settings.pharma || {};
  const nutrition = settings.nutrition || {};
  const substances = pharma.currentSubstances || [];

  const course = {
    isActive: !!pharma.courseStartDate,
    startDate: pharma.courseStartDate || '',
    weekCurrent: pharma.courseStartDate ? Math.floor(Math.max(1, daysBetween(pharma.courseStartDate, todayIso())) / 7) + 1 : 0,
    weekTotal: pharma.trainingCycleWeeks || 0,
    phase: pharma.phase || 'course',
    substances: substances.map((s: any) => ({
      id: s.id || s.substanceId || '',
      name: s.name || s.substance || s.id || '',
      doseDisplay: s.doseMg ? `${s.doseMg} мг` : s.doseMgWeek ? `${s.doseMgWeek} мг/нед` : '—',
      route: s.route === 'inject' ? 'inject' : 'oral',
      frequency: s.frequency || '1 р/нед',
      startWeek: s.startWeek || 1,
      endWeek: s.endWeek || 16,
      isAAS: s.isAAS || false,
      potencyFactor: s.potencyFactor,
      className: s.className || s.pClass || '',
    })),
  };

  const schedule = {
    morning: [] as any[],
    afternoon: [] as any[],
    evening: [] as any[],
  };

  const supplements = (nutrition.currentSupplements || []).map((s: any) => ({
    id: s.id, name: s.name, doseMg: s.doseMg || 0, unit: s.doseUnit || 'мг',
    notes: s.notes, source: 'profile' as const,
  }));

  const medications = (nutrition.currentMedications || []).map((m: any) => ({
    id: m.id, name: m.name, doseMg: m.doseMg || 0, unit: m.doseUnit || 'мг',
    frequency: m.frequency || 'daily', notes: m.notes, source: 'profile' as const,
  }));

  return {
    
    course,
    schedule,
    supplements,
    medications,
    monitoring: [
      { marker: 'Липидный профиль', when: 'Каждые 4 недели на курсе', targetRange: 'ЛПНП < 3.0 ммоль/л' },
      { marker: 'АЛТ/АСТ/ГГТ', when: 'Каждые 4 недели', targetRange: 'АЛТ < 40 U/L' },
      { marker: 'Гормональный профиль', when: 'Перед курсом + через 4 нед', targetRange: 'Т 10-35, E2 40-160' },
      { marker: 'Гематокрит', when: 'Каждые 4 недели', targetRange: 'HCT < 50%' },
      { marker: 'Глюкоза + инсулин', when: 'Каждые 6 недель', targetRange: 'Глюкоза 3.5-5.5' },
      { marker: 'Пролактин', when: 'Каждые 6 недель (трендон)', targetRange: 'Прл 80-400 mIU/L' },
      { marker: 'СКФ + креатинин', when: 'Каждые 8 недель', targetRange: 'СКФ > 90 ml/min' },
    ],
    pillBurden: { totalSubstances: 0, pillsPerDay: 0, morning: 0, afternoon: 0, evening: 0, feasibility: 'Умеренная' },
    depletionWarnings: [],
    conflicts: [],
  };
}

function generateRecommendations(sections: ReportSection[]): ReportRecommendation[] {
  const recs: ReportRecommendation[] = [];

  sections.forEach(section => {
    section.metrics.forEach(m => {
      if (m.label === 'Гематокрит' && typeof m.current === 'number' && m.current > 50) {
        recs.push({ section: 'Кровь', priority: 'critical', text: 'Гематокрит выше нормы — риск полицитемии. Кровопускание при HCT > 54%.' });
      }
      if (m.label === 'ЛПНП' && typeof m.current === 'number' && m.current > 4.0) {
        recs.push({ section: 'Липиды', priority: 'warning', text: 'ЛПНП значительно выше целевого для ААС — рассмотреть статин.' });
      }
      if (m.label === 'Пролактин' && typeof m.current === 'number' && m.current > 400) {
        recs.push({ section: 'Гормоны', priority: 'warning', text: 'Пролактин выше нормы — каберголин 0.25 мг 2×/нед.' });
      }
      if (m.label === 'АЛТ' && typeof m.current === 'number' && m.refHigh && m.current > m.refHigh * 2) {
        recs.push({ section: 'Печень', priority: 'critical', text: 'АЛТ в 2× выше нормы — гепатотоксичность. Отмена оральных ААС.' });
      }
      if (m.label === 'СКФ' && typeof m.current === 'number' && m.current < 60) {
        recs.push({ section: 'Почки', priority: 'critical', text: 'СКФ < 60 — ХБП 3 ст. Консультация нефролога.' });
      }
    });
  });

  if (recs.length === 0) {
    recs.push({ section: 'Общее', priority: 'info', text: 'Все показатели в пределах нормы. Продолжить текущий протокол.' });
  }

  return recs;
}

async function gatherMonthlyTrends(dateFrom: string, dateTo: string): Promise<ComprehensiveReport['trends']> {
  const weightLog = getWeightLog();
  const dailyMetrics = loadMetrics();
  const workoutLogs = await strengthDiary.getWorkoutLogs();
  const scoreHistory = getScoreHistory();

  const weeks = ['W1','W2','W3','W4'];
  const weightWeekly = weeks.map((w,i) => ({ week: w, kg: weightLog.length > 0 ? weightLog[Math.min(i, weightLog.length-1)].weight : 0 }));
  const hrvWeekly = weeks.map((w,i) => ({ week: w, avg: dailyMetrics.length > 0 ? dailyMetrics[Math.min(i, dailyMetrics.length-1)].hrvMs || 0 : 0 }));
  const enrichedLogs = workoutLogs.map(l => ({ ...l, totalVolume: l.exercises.reduce((s, e) => s + (e.totalVolume || 0), 0) }));
  const volumeWeekly = weeks.map((w,i) => ({ week: w, tonnes: enrichedLogs.length > 0 ? enrichedLogs[Math.min(i, enrichedLogs.length-1)].totalVolume / 1000 : 0 }));
  const riskWeekly = weeks.map((w,i) => ({ week: w, score: scoreHistory.length > 0 ? scoreHistory[Math.min(i, scoreHistory.length-1)].modules?.overall?.overallRaw || 0 : 0 }));

  return { weightWeekly, hrvWeekly, volumeWeekly, riskWeekly };
}
/* ─── Точка входа ─── */

export async function generateComprehensiveReport(input: {
  type: 'weekly' | 'monthly';
  dateFrom?: string;
  dateTo?: string;
}): Promise<ComprehensiveReport> {
  const now = todayIso();
  const dateTo = input.dateTo || now;
  const dateFrom = input.dateFrom || (input.type === 'weekly' ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

  const profile = getProfile();
  const settings = (profile?.settings || {}) as UnifiedSettings;
  const pharma = settings.pharma || {};
  const goals = settings.goals || {};
  const personal = settings.personal || {};

  const courseWeek = pharma.courseStartDate ? Math.floor(Math.max(1, daysBetween(pharma.courseStartDate, dateTo)) / 7) + 1 : undefined;

  const meta: ReportMeta = {
    type: input.type,
    dateFrom, dateTo,
    generatedAt: new Date().toISOString(),
    userName: profile?.name || 'Пользователь',
    age: personal.age, sex: personal.sex,
    period: (goals.primaryGoal as any) || 'maintenance',
    courseWeek, coursePhase: pharma.phase,
  };

  const sections = await Promise.all([
    gatherAnthropometry(dateFrom, dateTo),
    gatherLabs(dateFrom, dateTo),
    gatherRisks(dateFrom, dateTo),
    gatherCourse(dateFrom, dateTo),
    gatherTraining(dateFrom, dateTo),
    gatherNutrition(dateFrom, dateTo),
    gatherRecovery(dateFrom, dateTo),
    gatherBloodPressure(dateFrom, dateTo),
    gatherSymptoms(dateFrom, dateTo),
  ]);

  const support = gatherSupportSchedule();
  const trends = input.type === 'monthly' ? await gatherMonthlyTrends(dateFrom, dateTo) : undefined;
  const recommendations = generateRecommendations(sections);

  return {
    trends,
    meta,
    sections,
    support,
    userNotes: '',
    recommendations,
    photos: [],
  };
}





