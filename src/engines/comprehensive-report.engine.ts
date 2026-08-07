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
import { getExerciseById } from '../core/exercise-catalog';
import { readRiskBridge } from './risk-bridge';
import type { BodyMeasurement } from './log-analytics-progression.engine';
import type { BodyCompEntry } from './body-composition.engine';
import type { UnifiedSettings } from '../core/types';
import type { RiskBridgeData } from './risk-bridge';

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
  pedRisk?: RiskBridgeData;
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
  const cur = typeof metric.current === 'number' ? metric.current : parseFloat(String(metric.current));
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

function readJsonSafe<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
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
    { title: 'Свертываемость', markers: [
      { code: 'Д-Димер', name: 'Д-Димер', refLow: 0, refHigh: 0.5, unit: 'mg/L' },
      { code: 'Фибриноген', name: 'Фибриноген', refLow: 2, refHigh: 4, unit: 'g/L' },
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

  return { id: 'labs', title: 'Лаборатории', icon: '🧪', metrics };
}

function gatherRisks(dateFrom: string, dateTo: string): ReportSection {
  const scoreHistory = getScoreHistory();
  const recent = scoreHistory.filter(s => s.date >= dateFrom && s.date <= dateTo);
  const prev = scoreHistory.filter(s => s.date < dateFrom).sort((a, b) => b.date.localeCompare(a.date));

  const latest = recent.length > 0 ? recent[0] : (scoreHistory.length > 0 ? scoreHistory[0] : null);
  const prevScore = prev.length > 0 ? prev[0] : null;

  const metrics: ReportMetric[] = [
    {
      label: 'Общий риск', unit: '', prev: prevScore?.modules?.overall?.overallRaw, current: latest?.modules?.overall?.overallRaw ?? 'Нет данных',
      delta: latest && prevScore ? (latest.modules?.overall?.overallRaw ?? 0) - (prevScore.modules?.overall?.overallRaw ?? 0) : undefined,
      deltaPct: latest && prevScore && prevScore.modules?.overall?.overallRaw ? ((latest.modules?.overall?.overallRaw - prevScore.modules?.overall?.overallRaw) / prevScore.modules?.overall?.overallRaw) * 100 : undefined,
      status: latest && (latest.modules?.overall?.overallRaw ?? 0) > 600 ? 'critical' : latest && (latest.modules?.overall?.overallRaw ?? 0) > 300 ? 'warning' : 'normal',
    },
  ];

  if (latest?.modules) {
    const mods = latest.modules as Record<string, any>;
    Object.keys(mods).forEach(key => {
      if (key === 'overall') return;
      const mod = mods[key];
      if (mod?.overallRaw != null) {
        const prevMod = prevScore?.modules?.[key] as any;
        const { delta, deltaPct } = computeDelta(prevMod?.overallRaw, mod.overallRaw);
        metrics.push({
          label: key, unit: '', current: mod.overallRaw, delta, deltaPct,
          status: mod.overallRaw > 100 ? 'warning' : 'normal',
        });
      }
    });
  }

  return { id: 'risks', title: 'Риски', icon: '⚠️', metrics };
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

  const prevLogs = logs.filter(l => l.date < dateFrom).sort((a, b) => b.date.localeCompare(a.date));
  const prevEnriched = prevLogs.slice(0, recent.length).map(l => ({
    ...l,
    totalVolume: l.exercises.reduce((s, e) => s + (e.totalVolume || 0), 0),
  }));
  const prevTotalVolume = prevEnriched.reduce((sum, l) => sum + l.totalVolume, 0);

  const muscleVolume: Record<string, number> = {};
  recent.forEach(l => {
    l.exercises.forEach(ex => {
      const cat = getExerciseById(ex.exerciseId);
      const group = cat?.group || 'other';
      muscleVolume[group] = (muscleVolume[group] || 0) + (ex.totalVolume || 0);
    });
  });

  let prCount = 0;
  const exBestPrev: Record<string, number> = {};
  prevLogs.forEach(l => {
    l.exercises.forEach(ex => {
      if (ex.estimated1RM > 0) {
        const key = ex.exerciseName || ex.exerciseId;
        exBestPrev[key] = Math.max(exBestPrev[key] || 0, ex.estimated1RM);
      }
    });
  });
  recent.forEach(l => {
    l.exercises.forEach(ex => {
      if (ex.estimated1RM > 0) {
        const key = ex.exerciseName || ex.exerciseId;
        if (ex.estimated1RM > (exBestPrev[key] || 0)) prCount++;
      }
    });
  });

  const metrics: ReportMetric[] = [
    { label: 'Сессий', unit: 'шт', prev: planned, current: recent.length, status: recent.length >= planned ? 'normal' : 'warning' },
    { label: 'Adherence', unit: '%', current: planned > 0 ? Math.round((recent.length / planned) * 100) : 0, status: planned > 0 && recent.length >= planned ? 'normal' : 'warning' },
    { label: 'Объём', unit: 'т', prev: prevTotalVolume > 0 ? Number((prevTotalVolume / 1000).toFixed(1)) : undefined,
      current: Number((totalVolume / 1000).toFixed(1)), sparkline: computeSparkline(enriched, 'totalVolume', dateFrom, dateTo) },
    { label: 'Avg RPE', unit: '', prev: avgRpe ? Number(avgRpe.toFixed(1)) : undefined, current: avgRpe ? Number(avgRpe.toFixed(1)) : undefined },
    { label: 'Avg длительность', unit: 'мин', prev: avgDuration ? Math.round(avgDuration) : undefined, current: avgDuration ? Math.round(avgDuration) : undefined },
    { label: 'PR за период', unit: 'шт', current: prCount, status: prCount > 0 ? 'normal' : 'info' },
  ];

  const topMuscles = Object.entries(muscleVolume).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (topMuscles.length > 0) {
    metrics.push({ label: 'Топ мышцы (объём)', unit: 'кг', current: topMuscles.map(([g, v]) => `${g} ${(v / 1000).toFixed(1)}т`).join(', ') });
  }

  return { id: 'training', title: 'Тренировки', icon: '🏋️', metrics };
}

function gatherNutrition(dateFrom: string, dateTo: string): ReportSection {
  const profile = getProfile();
  const settings = (profile?.settings || {}) as any;
  const nutrition = settings.nutrition || {};
  const dailyMetrics = loadMetrics();
  const recentMetrics = dailyMetrics.filter(m => m.date >= dateFrom && m.date <= dateTo);

  const avgWater = recentMetrics.length > 0 ? recentMetrics.reduce((s, m) => s + (m.waterLiters || 0), 0) / recentMetrics.length : undefined;

  const metrics: ReportMetric[] = [
    { label: 'Средние kcal/день', unit: 'ккал', current: nutrition.manualTargets?.kcal || 'Нет данных' },
    { label: 'Белок', unit: 'г', current: nutrition.manualTargets?.protein },
    { label: 'Жиры', unit: 'г', current: nutrition.manualTargets?.fat },
    { label: 'Углеводы', unit: 'г', current: nutrition.manualTargets?.carbs },
    { label: 'Белок/кг', unit: 'г/кг', current: nutrition.proteinPerKg },
    { label: 'Вода', unit: 'л', current: avgWater ? Number(avgWater.toFixed(1)) : undefined, sparkline: computeSparkline(recentMetrics, 'waterLiters', dateFrom, dateTo) },
    { label: 'Приёмов пищи', unit: 'шт', current: nutrition.mealsPerDay },
  ];

  return { id: 'nutrition', title: 'Питание', icon: '🍽️', metrics };
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
    { label: 'Сон', unit: 'ч', prev: lifestyle.sleepHours, current: avgSleep ? Number(avgSleep.toFixed(1)) : undefined, sparkline: computeSparkline(recent, 'sleepHours', dateFrom, dateTo) },
    { label: 'Качество сна', unit: '1-5', current: avgSleepQ ? Number(avgSleepQ.toFixed(1)) : undefined },
    { label: 'HRV', unit: 'мс', prev: lifestyle.morningHRV, current: avgHrv ? Math.round(avgHrv) : undefined, sparkline: computeSparkline(recent, 'hrvMs', dateFrom, dateTo) },
    { label: 'ЧСС покоя', unit: 'bpm', current: avgRestHr ? Math.round(avgRestHr) : undefined, sparkline: computeSparkline(recent, 'restingHR', dateFrom, dateTo) },
    { label: 'Шаги/день', unit: 'шт', current: avgSteps ? Math.round(avgSteps) : undefined, sparkline: computeSparkline(recent, 'steps', dateFrom, dateTo) },
    { label: 'Стресс', unit: '1-10', prev: lifestyle.stressLevel, current: avgStress ? Number(avgStress.toFixed(1)) : undefined, sparkline: computeSparkline(recent, 'subjectiveStress', dateFrom, dateTo) },
  ];

  return { id: 'recovery', title: 'Восстановление', icon: '😴', metrics };
}

function gatherBloodPressure(dateFrom: string, dateTo: string): ReportSection {
  const entries = getBpEntries();
  const recent = entries.filter(e => e.date >= dateFrom && e.date <= dateTo);

  const morning = recent.filter(e => e.hr && e.hr < 70);
  const evening = recent.filter(e => e.hr && e.hr >= 70);
  const unclassified = recent.filter(e => !e.hr);
  const allForAvg = [...morning, ...evening, ...unclassified];

  const avgSys = allForAvg.length > 0 ? Math.round(allForAvg.reduce((s, e) => s + e.systolic, 0) / allForAvg.length) : undefined;
  const avgDia = allForAvg.length > 0 ? Math.round(allForAvg.reduce((s, e) => s + e.diastolic, 0) / allForAvg.length) : undefined;
  const avgHr = allForAvg.length > 0 ? Math.round(allForAvg.reduce((s, e) => s + (e.hr || 0), 0) / allForAvg.length) : undefined;
  const avgMorningSys = morning.length > 0 ? Math.round(morning.reduce((s, e) => s + e.systolic, 0) / morning.length) : undefined;
  const avgMorningDia = morning.length > 0 ? Math.round(morning.reduce((s, e) => s + e.diastolic, 0) / morning.length) : undefined;
  const avgEveningSys = evening.length > 0 ? Math.round(evening.reduce((s, e) => s + e.systolic, 0) / evening.length) : undefined;
  const avgEveningDia = evening.length > 0 ? Math.round(evening.reduce((s, e) => s + e.diastolic, 0) / evening.length) : undefined;
  const maxSys = recent.length > 0 ? Math.max(...recent.map(e => e.systolic)) : undefined;
  const maxDia = recent.length > 0 ? Math.max(...recent.map(e => e.diastolic)) : undefined;

  const bpSysStatus = maxSys != null ? (maxSys >= 160 ? 'critical' : maxSys >= 140 ? 'warning' : 'normal') : undefined;
  const bpDiaStatus = maxDia != null ? (maxDia >= 100 ? 'critical' : maxDia >= 90 ? 'warning' : 'normal') : undefined;

  const metrics: ReportMetric[] = [
    { label: 'Все замеры: систолическое', unit: 'мм рт.ст.', current: avgSys ?? 'Нет данных', status: bpSysStatus },
    { label: 'Все замеры: диастолическое', unit: 'мм рт.ст.', current: avgDia ?? 'Нет данных', status: bpDiaStatus },
    { label: 'ЧСС', unit: 'bpm', current: avgHr ?? 'Нет данных' },
  ];

  if (morning.length > 0) {
    metrics.push({ label: 'Утро (ЧСС<70): систолическое', unit: 'мм рт.ст.', current: avgMorningSys });
    metrics.push({ label: 'Утро (ЧСС<70): диастолическое', unit: 'мм рт.ст.', current: avgMorningDia });
  }
  if (evening.length > 0) {
    metrics.push({ label: 'Вечер (ЧСС≥70): систолическое', unit: 'мм рт.ст.', current: avgEveningSys });
    metrics.push({ label: 'Вечер (ЧСС≥70): диастолическое', unit: 'мм рт.ст.', current: avgEveningDia });
  }
  metrics.push({ label: 'Макс. систолическое', unit: 'мм рт.ст.', current: maxSys ?? 'Нет данных', status: bpSysStatus });
  metrics.push({ label: 'Макс. диастолическое', unit: 'мм рт.ст.', current: maxDia ?? 'Нет данных', status: bpDiaStatus });
  metrics.push({ label: 'Замеров', unit: 'шт', current: recent.length });

  return { id: 'blood_pressure', title: 'Артериальное давление', icon: '🩸', metrics };
}

function gatherCourse(dateFrom: string, dateTo: string): ReportSection {
  const profile = getProfile();
  const settings = (profile?.settings || {}) as any;
  const pharma = settings.pharma || {};
  const substances = pharma.currentSubstances || [];

  const metrics: ReportMetric[] = [];

  if (pharma.courseStartDate) {
    const diffDays = Math.max(1, daysBetween(pharma.courseStartDate, todayIso()));
    const weekCurrent = Math.floor(diffDays / 7) + 1;
    metrics.push({ label: 'Дата старта', unit: '', current: pharma.courseStartDate });
    metrics.push({ label: 'Текущая неделя', current: weekCurrent, unit: 'нед' });
    metrics.push({ label: 'Фаза', unit: '', current: pharma.phase || 'course' });
    metrics.push({ label: 'Тип курса', unit: '', current: pharma.trainingCycleType || 'mass' });
    metrics.push({ label: 'Длительность', unit: '', current: pharma.trainingCycleWeeks ? `${pharma.trainingCycleWeeks} нед` : '—' });
  }

  if (substances.length > 0) {
    metrics.push({ label: 'Веществ в стеке', current: substances.length, unit: 'шт' });
    const aasCount = substances.filter((s: any) => s.isAAS).length;
    if (aasCount > 0) metrics.push({ label: 'ААС', current: aasCount, unit: 'шт', status: 'warning' });
  }

  return { id: 'course', title: 'Курс', icon: '💉', metrics };
}

function gatherSymptoms(dateFrom: string, dateTo: string): ReportSection {
  const stats = getSymptomDiaryStats();
  const diary = getSymptomDiary();
  const recent = diary.filter(d => d.date >= dateFrom && d.date <= dateTo);

  const recentSymptoms = new Set<string>();
  recent.forEach(d => { if (d.entries) d.entries.forEach((s: any) => recentSymptoms.add(typeof s === 'string' ? s : s.symptomId || '')); });

  const metrics: ReportMetric[] = [
    { label: 'Активные симптомы', unit: 'шт', current: stats.activeSymptoms, status: stats.activeSymptoms > 3 ? 'warning' : 'normal' },
    { label: 'Улучшившиеся', unit: 'шт', current: stats.improving },
    { label: 'Ухудшившиеся', unit: 'шт', current: stats.worsening, status: stats.worsening > 0 ? 'warning' : 'normal' },
    { label: 'Разрешённые', unit: 'шт', current: stats.resolved },
    { label: 'Уникальных за период', unit: 'шт', current: recentSymptoms.size },
  ];

  return { id: 'symptoms', title: 'Симптомы', icon: '📋', metrics };
}

function gatherSupportSchedule(): SupportScheduleSection {
  const profile = getProfile();
  const settings = (profile?.settings || {}) as any;
  const pharma = settings.pharma || {};
  const nutrition = settings.nutrition || {};
  const substances = pharma.currentSubstances || [];

  const planResult: string[] = readJsonSafe('he_support_plan_result', []);
  const riskBridge = readRiskBridge();

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
      route: s.route === 'inject' ? 'inject' : 'oral' as const,
      frequency: s.frequency || '1 р/нед',
      startWeek: s.startWeek || 1,
      endWeek: s.endWeek || 16,
      isAAS: s.isAAS || false,
      potencyFactor: s.potencyFactor,
      className: s.className || s.pClass || '',
    })),
  };

  const schedule = {
    morning: [] as SupportScheduleSection['schedule']['morning'],
    afternoon: [] as SupportScheduleSection['schedule']['afternoon'],
    evening: [] as SupportScheduleSection['schedule']['evening'],
  };

  const profileSupps = (nutrition.currentSupplements || []) as any[];
  const planSupps = planResult.map(id => ({ id, name: id, doseMg: 0, unit: 'мг', source: 'support_plan' as const }));
  const suppMap = new Map<string, SupportScheduleSection['supplements'][0]>();
  profileSupps.forEach((s: any) => { suppMap.set(s.id, { id: s.id, name: s.name, doseMg: s.doseMg || 0, unit: s.doseUnit || 'мг', notes: s.notes, source: 'profile' }); });
  planSupps.forEach(s => { if (!suppMap.has(s.id)) suppMap.set(s.id, s); });
  const supplements = Array.from(suppMap.values());

  const medications = ((nutrition as any).currentMedications || []).map((m: any) => ({
    id: m.id, name: m.name, doseMg: m.doseMg || 0, unit: m.doseUnit || 'мг',
    frequency: m.frequency || 'daily', notes: m.notes, source: 'profile' as const,
  }));

  const totalSubstances = supplements.length + medications.length + course.substances.length;
  const pillsPerDay = supplements.length + medications.length;

  const monitoring = [
    { marker: 'Липидный профиль', when: course.isActive ? 'Каждые 4 недели на курсе' : 'Каждые 3 мес', targetRange: 'ЛПНП < 3.0 ммоль/л' },
    { marker: 'АЛТ/АСТ/ГГТ', when: course.isActive ? 'Каждые 4 недели' : 'Каждые 6 мес', targetRange: 'АЛТ < 40 U/L' },
    { marker: 'Гормональный профиль', when: course.isActive ? 'Перед курсом + через 4 нед' : 'Каждые 6 мес', targetRange: 'Т 10-35, E2 40-160' },
    { marker: 'Гематокрит', when: course.isActive ? 'Каждые 4 недели' : 'Каждые 6 мес', targetRange: 'HCT < 50%' },
    { marker: 'Глюкоза + инсулин', when: 'Каждые 6 недель', targetRange: 'Глюкоза 3.5-5.5' },
    { marker: 'Пролактин', when: course.isActive ? 'Каждые 6 недель' : 'Каждые 12 мес', targetRange: 'Прл 80-400 mIU/L' },
    { marker: 'СКФ + креатинин', when: course.isActive ? 'Каждые 8 недель' : 'Каждые 12 мес', targetRange: 'СКФ > 90 ml/min' },
  ];

  return {
    course, schedule, supplements, medications, monitoring,
    pillBurden: { totalSubstances, pillsPerDay, morning: Math.ceil(pillsPerDay * 0.4), afternoon: Math.ceil(pillsPerDay * 0.3), evening: Math.ceil(pillsPerDay * 0.3), feasibility: pillsPerDay > 10 ? 'Высокая' : pillsPerDay > 5 ? 'Умеренная' : 'Низкая' },
    depletionWarnings: [],
    conflicts: [],
  };
}

function gatherPedRisk(): ReportSection | null {
  const bridge = readRiskBridge();
  if (!bridge) return null;

  const metrics: ReportMetric[] = [
    { label: 'Риск до поддержки', unit: 'баллов', current: bridge.riskBefore,
      status: bridge.riskBefore > 600 ? 'critical' : bridge.riskBefore > 300 ? 'warning' : 'normal' },
    { label: 'Риск после поддержки', unit: 'баллов', current: bridge.riskAfter,
      status: bridge.riskAfter > 400 ? 'critical' : bridge.riskAfter > 200 ? 'warning' : 'normal' },
    { label: 'Эффективность поддержки', unit: '%',
      current: bridge.riskBefore > 0 ? Math.round((1 - bridge.riskAfter / bridge.riskBefore) * 100) : 0,
      status: bridge.riskBefore > 0 && bridge.riskAfter < bridge.riskBefore * 0.5 ? 'normal' : 'warning' },
  ];

  if (bridge.systemBreakdown) {
    Object.entries(bridge.systemBreakdown).forEach(([sys, data]) => {
      metrics.push({
        label: sys, unit: 'баллов', current: data.net,
        delta: data.raw - data.net, deltaPct: data.raw > 0 ? ((data.raw - data.net) / data.raw) * 100 : undefined,
        note: `Базовый: ${data.raw}, после поддержки: ${data.net}`,
      });
    });
  }

  if (bridge.subs && bridge.subs.length > 0) {
    metrics.push({ label: 'Активные БАД', unit: 'шт', current: bridge.subs.length });
  }

  return { id: 'ped_risk', title: 'Риск-оценка PED', icon: '🛡️', metrics };
}

function generateRecommendations(sections: ReportSection[], pedRisk: RiskBridgeData | null): ReportRecommendation[] {
  const recs: ReportRecommendation[] = [];
  const findMetric = (label: string): ReportMetric | undefined => {
    for (const s of sections) { const m = s.metrics.find(m => m.label === label); if (m) return m; }
    return undefined;
  };
  const numVal = (m: ReportMetric | undefined): number | null => {
    if (!m || m.current == null) return null;
    const v = typeof m.current === 'number' ? m.current : parseFloat(String(m.current));
    return isNaN(v) ? null : v;
  };

  const hct = numVal(findMetric('Гематокрит'));
  if (hct != null && hct > 54) recs.push({ section: 'Кровь', priority: 'critical', text: `Гематокрит ${hct}% — полицитемия. Кровопускание (флеботомия 450-500мл). Увеличить потребление воды до 3-4 л/день.` });
  else if (hct != null && hct > 50) recs.push({ section: 'Кровь', priority: 'warning', text: `Гематокрит ${hct}% — приближается к границе. Контроль каждые 2 недели. Донаторы оксида азота (L-аргинин, чеснок).` });

  const ldl = numVal(findMetric('ЛПНП'));
  if (ldl != null && ldl > 4.9) recs.push({ section: 'Липиды', priority: 'critical', text: `ЛПНП ${ldl} ммоль/л —极高 риск. Статин (аторвастатин 20-40мг). Рассмотреть отмену 17α-алкилированных ААС.` });
  else if (ldl != null && ldl > 3.0) recs.push({ section: 'Липиды', priority: 'warning', text: `ЛПНП ${ldl} ммоль/л — выше целевого. Омега-3 3-4г/день, красный дрожжевой рис, коэнзим Q10.` });

  const hdl = numVal(findMetric('ЛПВП'));
  if (hdl != null && hdl < 1.0) recs.push({ section: 'Липиды', priority: 'warning', text: `ЛПВП ${hdl} ммоль/л — низкий кардиопротекторный эффект. Аэробная нагрузка 150+ мин/нед, омега-3, ниацин.` });

  const tg = numVal(findMetric('Триглицериды'));
  if (tg != null && tg > 2.3) recs.push({ section: 'Липиды', priority: 'warning', text: `Триглицериды ${tg} ммоль/л. Ограничение простых углеводов, омега-3 2-4г/день, контроль алкоголя.` });

  const prolactin = numVal(findMetric('Пролактин'));
  if (prolactin != null && prolactin > 600) recs.push({ section: 'Гормоны', priority: 'critical', text: `Пролактин ${prolactin} mIU/L — значительно выше нормы. Каберголин 0.5мг 2×/нед + МРТ гипофиза.` });
  else if (prolactin != null && prolactin > 400) recs.push({ section: 'Гормоны', priority: 'warning', text: `Пролактин ${prolactin} mIU/L. Каберголин 0.25мг 2×/нед. Исключить пролактиному.` });

  const alt = numVal(findMetric('АЛТ'));
  const ast = numVal(findMetric('АСТ'));
  if (alt != null && alt > 80) recs.push({ section: 'Печень', priority: 'critical', text: `АЛТ ${alt} U/L — гепатотоксичность. Отмена оральных ААС и гепатотоксичных препаратов. УДХК 300-600мг/день.` });
  else if (alt != null && alt > 40) recs.push({ section: 'Печень', priority: 'warning', text: `АЛТ ${alt} U/L — выше нормы. ТUDCA 250-500мг/день, NAC 600-1200мг/день. Контроль через 4 нед.` });
  if (ast != null && alt != null && alt > 0 && ast / alt > 2) recs.push({ section: 'Печень', priority: 'warning', text: `АСТ/АЛТ > 2 — мышечное повреждение или алкоголь. Дифференциальная диагностика.` });

  const gfr = numVal(findMetric('СКФ (GFR)'));
  if (gfr != null && gfr < 45) recs.push({ section: 'Почки', priority: 'critical', text: `СКФ ${gfr} — ХБП 3b-4 ст. Нефролог. Отмена нефротоксичных препаратов. Контроль каждые 4 нед.` });
  else if (gfr != null && gfr < 60) recs.push({ section: 'Почки', priority: 'warning', text: `СКФ ${gfr} — ХБП 3 ст. Ограничение белка до 0.8г/кг, гидратация, контроль креатинина.` });
  else if (gfr != null && gfr < 90) recs.push({ section: 'Почки', priority: 'info', text: `СКФ ${gfr} — нижняя граница нормы. Поддерживать гидратацию 2.5-3 л/день.` });

  const creatinine = numVal(findMetric('Креатинин'));
  if (creatinine != null && creatinine > 130) recs.push({ section: 'Почки', priority: 'warning', text: `Креатинин ${creatinine} µmol/L — повышен. Может быть следствием креатина/белка. Оценить СКФ.` });

  const glucose = numVal(findMetric('Глюкоза'));
  if (glucose != null && glucose > 6.1) recs.push({ section: 'Метаболизм', priority: 'critical', text: `Глюкоза ${glucose} ммоль/л — гипергликемия. ОГТТ, HbA1c. Метформин 500-1000мг.` });
  else if (glucose != null && glucose > 5.5) recs.push({ section: 'Метаболизм', priority: 'warning', text: `Глюкоза ${glucose} ммоль/л — на границе. Ограничение быстрых углеводов, контроль инсулинорезистентности.` });

  const uric = numVal(findMetric('Мочевая кислота'));
  if (uric != null && uric > 420) recs.push({ section: 'Метаболизм', priority: 'warning', text: `Мочевая кислота ${uric} µmol/L — гиперурикемия. Ограничение пуринов, гидратация, аллопуринол при подагре.` });

  const tsh = numVal(findMetric('ТТГ'));
  if (tsh != null && tsh > 4.0) recs.push({ section: 'Гормоны', priority: 'warning', text: `ТТГ ${tsh} mIU/L — гипотиреоз. Консультация эндокринолога, Т3/Т4, анти-ТПО/ТГ.` });
  else if (tsh != null && tsh < 0.4) recs.push({ section: 'Гормоны', priority: 'warning', text: `ТТГ ${tsh} mIU/L — гипертиреоз. Консультация эндокринолога, Т3/Т4 свободный.` });

  const hb = numVal(findMetric('Гемоглобин'));
  if (hb != null && hb > 180) recs.push({ section: 'Кровь', priority: 'critical', text: `Гемоглобин ${hb} г/Л — риск тромбоза. Флеботомия, антиагреганты (аспирин 75-100мг).` });
  else if (hb != null && hb < 120) recs.push({ section: 'Кровь', priority: 'warning', text: `Гемоглобин ${hb} г/Л — анемия. Ферритин, сывороточное железо, B12/фолат.` });

  const wbc = numVal(findMetric('Лейкоциты'));
  if (wbc != null && wbc > 11) recs.push({ section: 'Кровь', priority: 'warning', text: `Лейкоциты ${wbc} — лейкоцитоз. Исключить инфекцию, стресс, глюкокортикоиды.` });
  else if (wbc != null && wbc < 4) recs.push({ section: 'Кровь', priority: 'warning', text: `Лейкоциты ${wbc} — лейкопения. ГКС-терапия, вирусные инфекции, угнетение костного мозга.` });

  const crp = numVal(findMetric('СРБ'));
  if (crp != null && crp > 10) recs.push({ section: 'Воспаление', priority: 'critical', text: `СРБ ${crp} мг/л — острое воспаление. Исключить инфекцию, аутоиммунные заболевания.` });
  else if (crp != null && crp > 5) recs.push({ section: 'Воспаление', priority: 'warning', text: `СРБ ${crp} мг/л — хроническое воспаление. Омега-3, куркумин, контроль ИМТ и сна.` });

  const na = numVal(findMetric('Натрий'));
  if (na != null && na > 147) recs.push({ section: 'Электролиты', priority: 'warning', text: `Натрий ${na} ммоль/л — гипернатриемия. Увеличить воду, ограничить натрий до 2г/день.` });
  else if (na != null && na < 136) recs.push({ section: 'Электролиты', priority: 'warning', text: `Натрий ${na} ммоль/л — гипонатриемия. Рассмотреть SAID (спиронолактон) при ААС.` });

  const k = numVal(findMetric('Калий'));
  if (k != null && k > 5.5) recs.push({ section: 'Электролиты', priority: 'critical', text: `Калий ${k} ммоль/л — гиперкалиемия! Риск аритмии. Контроль ЭКГ, бикарбонат калия.` });
  else if (k != null && k < 3.5) recs.push({ section: 'Электролиты', priority: 'warning', text: `Калий ${k} ммоль/л — гипокалиемия. Калийсберегающие диуретики при ААС, бананы, авокадо.` });

  const mg = numVal(findMetric('Магний'));
  if (mg != null && mg < 0.66) recs.push({ section: 'Электролиты', priority: 'warning', text: `Магний ${mg} ммоль/л — дефицит. Mg-цитрат/глицинат 400-600мг/день перед сном.` });

  const bun = numVal(findMetric('Мочевина'));
  if (bun != null && bun > 10) recs.push({ section: 'Почки', priority: 'warning', text: `Мочевина ${bun} ммоль/л — повышенная. Снизить белок до 1.6г/кг, увеличить гидратацию.` });

  if (pedRisk) {
    if (pedRisk.riskBefore > 600 && pedRisk.riskAfter >= pedRisk.riskBefore * 0.8) {
      recs.push({ section: 'PED', priority: 'critical', text: `Поддержка снижает риск недостаточно (${pedRisk.riskBefore} → ${pedRisk.riskAfter}). Рассмотреть добавки/дозировки.` });
    }
  }

  const symptoms = findMetric('Ухудшившиеся');
  if (symptoms && typeof symptoms.current === 'number' && symptoms.current > 0) {
    recs.push({ section: 'Симптомы', priority: 'warning', text: `${symptoms.current} симптом(ов) ухудшились за период. Обсудить с врачом на следующем приёме.` });
  }

  const bpMaxSys = findMetric('Макс. систолическое');
  if (bpMaxSys && typeof bpMaxSys.current === 'number' && bpMaxSys.current >= 160) {
    recs.push({ section: 'Давление', priority: 'critical', text: `Систолическое давление ${bpMaxSys.current} мм рт.ст. — гипертонический криз. Немедленно: лизиноприл 10-20мг или небиволол 5мг.` });
  } else if (bpMaxSys && typeof bpMaxSys.current === 'number' && bpMaxSys.current >= 140) {
    recs.push({ section: 'Давление', priority: 'warning', text: `Систолическое давление ${bpMaxSys.current} мм рт.ст. — АГ 1 ст. Небиволол 5мг/день, телмисартан 40мг/день.` });
  }

  const adh = findMetric('Adherence');
  if (adh && typeof adh.current === 'number' && adh.current < 60) {
    recs.push({ section: 'Тренировки', priority: 'warning', text: `Adherence ${adh.current}% — пропуск тренировок. Рассмотреть снижение частоты или смену сплита.` });
  }

  if (recs.length === 0) {
    recs.push({ section: 'Общее', priority: 'info', text: 'Все показатели в пределах нормы. Продолжить текущий протокол. Плановые анализы — согласно календарю мониторинга.' });
  }

  return recs;
}

function weekStart(d: Date): Date { const r = new Date(d); r.setDate(r.getDate() - r.getDay() + 1); r.setHours(0, 0, 0, 0); return r; }
function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }

async function gatherMonthlyTrends(dateFrom: string, dateTo: string): Promise<ComprehensiveReport['trends']> {
  const weightLog = getWeightLog();
  const dailyMetrics = loadMetrics();
  const workoutLogs = await strengthDiary.getWorkoutLogs();
  const scoreHistory = getScoreHistory();

  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const totalDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
  const numWeeks = Math.min(4, Math.max(1, Math.ceil(totalDays / 7)));
  const weekLabels = Array.from({ length: numWeeks }, (_, i) => `W${i + 1}`);

  const weekRanges = Array.from({ length: numWeeks }, (_, i) => {
    const ws = new Date(from);
    ws.setDate(ws.getDate() + i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    return { start: isoDate(ws), end: isoDate(we > to ? to : we) };
  });

  const inRange = (date: string, range: { start: string; end: string }) => date >= range.start && date <= range.end;

  const weightWeekly = weekLabels.map((w, i) => {
    const range = weekRanges[i];
    const inWeek = weightLog.filter(e => inRange(e.date, range));
    return { week: w, kg: inWeek.length > 0 ? inWeek.reduce((s, e) => s + e.weight, 0) / inWeek.length : 0 };
  });

  const hrvWeekly = weekLabels.map((w, i) => {
    const range = weekRanges[i];
    const inWeek = dailyMetrics.filter(m => inRange(m.date, range));
    return { week: w, avg: inWeek.length > 0 ? inWeek.reduce((s, m) => s + (m.hrvMs || 0), 0) / inWeek.length : 0 };
  });

  const enrichedLogs = workoutLogs.map(l => ({ ...l, totalVolume: l.exercises.reduce((s, e) => s + (e.totalVolume || 0), 0) }));
  const volumeWeekly = weekLabels.map((w, i) => {
    const range = weekRanges[i];
    const inWeek = enrichedLogs.filter(l => inRange(l.date, range));
    return { week: w, tonnes: inWeek.length > 0 ? inWeek.reduce((s, l) => s + l.totalVolume, 0) / 1000 : 0 };
  });

  const riskWeekly = weekLabels.map((w, i) => {
    const range = weekRanges[i];
    const inWeek = scoreHistory.filter(s => inRange(s.date, range));
    return { week: w, score: inWeek.length > 0 ? inWeek.reduce((s, sc) => s + (sc.modules?.overall?.overallRaw || 0), 0) / inWeek.length : 0 };
  });

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
  const pedRiskSection = gatherPedRisk();
  const pedRisk = readRiskBridge();

  if (pedRiskSection) sections.push(pedRiskSection);

  const trends = input.type === 'monthly' ? await gatherMonthlyTrends(dateFrom, dateTo) : undefined;
  const recommendations = generateRecommendations(sections, pedRisk);

  return {
    trends,
    meta,
    sections,
    support,
    userNotes: '',
    recommendations,
    pedRisk: pedRisk || undefined,
    photos: [],
  };
}
