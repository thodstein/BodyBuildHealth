/**
 * Body Composition Tracker — Weight, measurements, trends, projections.
 *
 * Tracks:
 *  - Body weight (daily weigh-ins)
 *  - Body measurements (chest, waist, hips, arms, thighs, calves, neck)
 *  - Body fat % estimates (Navy method, 3-site/7-site caliper)
 *  - 7-day and 30-day trends
 *  - Weight goal projection
 *  - FFMI (Fat-Free Mass Index) calculation
 *
 * Data stored in localStorage under 'he_body_comp'.
 *
 * @module body-composition-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface BodyCompEntry {
  date: string;           // YYYY-MM-DD
  weightKg: number;
  bodyFatPercent?: number;
  measurements?: {
    chestCm?: number;
    waistCm?: number;
    hipCm?: number;
    armCm?: number;
    thighCm?: number;
    calfCm?: number;
    neckCm?: number;
  };
  notes?: string;
}

export interface BodyCompStats {
  currentWeight: number;
  startWeight: number;
  weightChange: number;
  weightChangePercent: number;
  trend7Day: number;      // kg/week
  trend30Day: number;
  avgWeight7Day: number;
  minWeight: number;
  maxWeight: number;
  entries: number;
  firstDate: string;
  lastDate: string;
  currentBF: number;
  bfChange: number;
  ffmi: number;
  bmi: number;
  goalWeight: number;
  goalProgress: number;   // 0-100%
  estimatedWeeksToGoal: number;
}

export interface BodyCompProjection {
  date: string;
  weight: number;
  isProjected: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'he_body_comp';

export function loadEntries(): BodyCompEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveEntry(entry: BodyCompEntry): BodyCompEntry[] {
  const entries = loadEntries();
  const idx = entries.findIndex(e => e.date === entry.date);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-365)));
  return entries;
}

export function deleteEntry(date: string): BodyCompEntry[] {
  const entries = loadEntries().filter(e => e.date !== date);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return entries;
}

// ═══════════════════════════════════════════════════════════════════════════
// Body fat estimation (Navy method — male)
// ═══════════════════════════════════════════════════════════════════════════

export function estimateBF_Navy(
  heightCm: number,
  waistCm: number,
  neckCm: number,
  hipCm?: number,
  sex: 'male' | 'female' = 'male',
): number {
  if (sex === 'male') {
    const logVal = Math.log10(waistCm - neckCm) - Math.log10(heightCm);
    return Math.round((86.010 * Math.pow(10, logVal) - 70.041) * 10) / 10;
  }
  const logVal = Math.log10(waistCm + (hipCm || 0) - neckCm) - Math.log10(heightCm);
  return Math.round((163.205 * Math.pow(10, logVal) - 97.684) * 10) / 10;
}

// ═══════════════════════════════════════════════════════════════════════════
// FFMI — Fat-Free Mass Index
// ═══════════════════════════════════════════════════════════════════════════

export function calcFFMI(weightKg: number, heightCm: number, bfPercent: number): number {
  const ffm = weightKg * (1 - bfPercent / 100);
  return Math.round((ffm / Math.pow(heightCm / 100, 2)) * 10) / 10;
}

export function ffmiLabel(ffmi: number): string {
  if (ffmi < 18) return 'Ниже среднего';
  if (ffmi < 20) return 'Среднее';
  if (ffmi < 22) return 'Выше среднего';
  if (ffmi < 24) return 'Отличное';
  if (ffmi < 26) return 'Элитное (вероятно фарма)';
  return 'За пределами естественного';
}

export function calcBMI(weightKg: number, heightCm: number): number {
  return Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10;
}

// ═══════════════════════════════════════════════════════════════════════════
// Stats calculator
// ═══════════════════════════════════════════════════════════════════════════

export function computeStats(
  entries: BodyCompEntry[],
  goalWeight?: number,
  heightCm?: number,
): BodyCompStats | null {
  if (entries.length < 2) return null;

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const weightChange = last.weightKg - first.weightKg;

  // 7-day trend (linear regression on last 7 days)
  const recent7 = sorted.slice(-7);
  const trend7Day = recent7.length >= 2
    ? (recent7[recent7.length - 1].weightKg - recent7[0].weightKg) / recent7.length * 7
    : 0;

  // 30-day trend
  const recent30 = sorted.slice(-30);
  const trend30Day = recent30.length >= 2
    ? (recent30[recent30.length - 1].weightKg - recent30[0].weightKg) / recent30.length * 30
    : 0;

  const avg7Day = recent7.length > 0 ? recent7.reduce((s, e) => s + e.weightKg, 0) / recent7.length : 0;
  const weights = sorted.map(e => e.weightKg);
  if (weights.length === 0) return null;
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);

  const currentBF = last.bodyFatPercent || 0;
  const firstBF = first.bodyFatPercent || 0;

  const ffmi = heightCm ? calcFFMI(last.weightKg, heightCm, currentBF) : 0;
  const bmi = heightCm ? calcBMI(last.weightKg, heightCm) : 0;

  let goalProgress = 0;
  let weeksToGoal = 0;
  if (goalWeight && Math.abs(goalWeight - first.weightKg) > 0.1) {
    goalProgress = Math.round(
      Math.min(100, Math.max(0,
        (first.weightKg - last.weightKg) / (first.weightKg - goalWeight) * 100
      ))
    );
    const weeklyRate = Math.abs(trend30Day) > 0.05 ? Math.abs(trend30Day) : 0.3;
    weeksToGoal = Math.round(Math.abs(last.weightKg - goalWeight) / weeklyRate);
  }

  return {
    currentWeight: Math.round(last.weightKg * 100) / 100,
    startWeight: first.weightKg,
    weightChange: Math.round(weightChange * 100) / 100,
    weightChangePercent: Math.round((weightChange / first.weightKg) * 1000) / 10,
    trend7Day: Math.round(trend7Day * 100) / 100,
    trend30Day: Math.round(trend30Day * 100) / 100,
    avgWeight7Day: Math.round(avg7Day * 100) / 100,
    minWeight, maxWeight,
    entries: entries.length,
    firstDate: first.date,
    lastDate: last.date,
    currentBF: Math.round(currentBF * 10) / 10,
    bfChange: Math.round((currentBF - firstBF) * 10) / 10,
    ffmi: Math.round(ffmi * 10) / 10,
    bmi: Math.round(bmi * 10) / 10,
    goalWeight: goalWeight || 0,
    goalProgress,
    estimatedWeeksToGoal: weeksToGoal,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Projection
// ═══════════════════════════════════════════════════════════════════════════

export function projectWeight(
  currentWeight: number,
  weeklyRate: number,
  goalWeight: number,
  weeks: number = 12,
): BodyCompProjection[] {
  const projections: BodyCompProjection[] = [];
  const today = new Date();

  for (let w = 0; w <= weeks; w++) {
    const d = new Date(today);
    d.setDate(d.getDate() + w * 7);
    const weight = currentWeight + weeklyRate * w;

    // Stop if we've reached goal
    if ((weeklyRate > 0 && weight >= goalWeight) || (weeklyRate < 0 && weight <= goalWeight)) {
      projections.push({ date: d.toISOString().slice(0, 10), weight: goalWeight, isProjected: false });
      break;
    }

    projections.push({
      date: d.toISOString().slice(0, 10),
      weight: Math.round(weight * 100) / 100,
      isProjected: w > 0,
    });
  }

  return projections;
}
