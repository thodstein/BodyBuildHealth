const STORAGE_KEY = 'he_bp_diary';

/** Локальная дата YYYY-MM-DD (в записях используется локальная, не UTC). */
function localIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface BPEntry {
  id?: string;
  date: string;
  timestamp?: number;
  systolic: number;
  diastolic: number;
  hr: number;
  notes?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night' | string;
  position?: 'sitting' | 'standing' | 'lying' | string;
  arm?: 'left' | 'right' | string;
  symptoms?: string[];
  medicationTaken?: boolean;
}

export const BP_SYMPTOMS = [
  'Головная боль', 'Головокружение', 'Шум в ушах',
  'Боль в груди', 'Одышка', 'Тошнота', 'Мелькание мушек',
  'Слабость', 'Отёки', 'Потливость', 'Учащённое сердцебиение',
  'Нарушение зрения', 'Боль в спине', 'Чувство тревоги',
] as const;

export type BPSymptom = typeof BP_SYMPTOMS[number];

export function generateEntryId(): string {
  return `bp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function sortEntriesByTimestamp(entries: BPEntry[]): BPEntry[] {
  return [...entries].sort((a, b) => {
    const bt = b.timestamp ?? (Date.parse(b.date) || 0);
    const at = a.timestamp ?? (Date.parse(a.date) || 0);
    return bt - at || b.date.localeCompare(a.date);
  });
}

export interface BPValidationError { field: string; message: string; }

export function validateBpEntry(s: number, d: number, p: number, date: string): BPValidationError[] {
  const errors: BPValidationError[] = [];
  if (!date) errors.push({ field: 'date', message: 'Дата обязательна' });
  if (!Number.isFinite(s) || s < 50 || s > 250) errors.push({ field: 'systolic', message: 'Систола: 50–250 мм рт.ст.' });
  if (!Number.isFinite(d) || d < 30 || d > 180) errors.push({ field: 'diastolic', message: 'Диастола: 30–180 мм рт.ст.' });
  if (!Number.isFinite(p) || p < 20 || p > 250) errors.push({ field: 'pulse', message: 'Пульс: 20–250 уд/мин' });
  if (Number.isFinite(s) && Number.isFinite(d) && d >= s) errors.push({ field: 'diastolic', message: 'Диастола должна быть меньше систолы' });
  return errors;
}

export type BPClassification = 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis';

export function classifyBP(systolic: number, diastolic: number): BPClassification {
  if (systolic >= 180 || diastolic >= 120) return 'crisis';
  if (systolic >= 140 || diastolic >= 90) return 'stage2';
  if (systolic >= 130 || diastolic >= 80) return 'stage1';
  if (systolic >= 120 && diastolic < 80) return 'elevated';
  return 'normal';
}

export function calcMAP(systolic: number, diastolic: number): number {
  return Math.round((systolic + 2 * diastolic) / 3);
}

export function calcPulsePressure(systolic: number, diastolic: number): number {
  return systolic - diastolic;
}

export function calcBPLoad(entries: BPEntry[]): number {
  if (!entries.length) return 0;
  return Math.round(entries.filter(e => e.systolic > 130 || e.diastolic > 80).length / entries.length * 100);
}

export function calcVariability(entries: BPEntry[]): { sysSD: number; diaSD: number } {
  if (entries.length < 2) return { sysSD: 0, diaSD: 0 };
  const sd = (values: number[]) => {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  };
  return { sysSD: sd(entries.map(e => e.systolic)), diaSD: sd(entries.map(e => e.diastolic)) };
}

export function getBpClassificationLabel(value: BPClassification): string {
  return { normal: 'Норма', elevated: 'Повышенное', stage1: 'Гипертензия 1 ст.', stage2: 'Гипертензия 2 ст.', crisis: 'Кризис' }[value];
}

export function getBpClassificationColor(value: BPClassification): string {
  return { normal: '#4caf50', elevated: '#f59e0b', stage1: '#ff9800', stage2: '#ef4444', crisis: '#b91c1c' }[value];
}

export function normalizeBpEntry(raw: Partial<BPEntry>): BPEntry {
  const date = raw.date || '';
  return {
    id: raw.id || generateEntryId(), date,
    timestamp: raw.timestamp ?? (Date.parse(date) || Date.now()),
    systolic: Number(raw.systolic) || 0, diastolic: Number(raw.diastolic) || 0,
    hr: Number(raw.hr ?? (raw as any).pulse) || 0, notes: raw.notes,
    timeOfDay: raw.timeOfDay, position: raw.position, arm: raw.arm,
    symptoms: Array.isArray(raw.symptoms) ? raw.symptoms : [], medicationTaken: raw.medicationTaken,
  };
}

export function checkOrthostatic(entries: BPEntry[]) {
  const sitting = entries.find(e => e.position === 'sitting');
  const standing = entries.find(e => e.position === 'standing');
  if (!sitting || !standing) return { detected: false, dropS: 0, dropD: 0 };
  const dropS = sitting.systolic - standing.systolic;
  const dropD = sitting.diastolic - standing.diastolic;
  return { detected: dropS >= 20 || dropD >= 10, dropS, dropD };
}

const average = (entries: BPEntry[]) => ({
  count: entries.length,
  avgS: entries.length ? Math.round(entries.reduce((s, e) => s + e.systolic, 0) / entries.length) : 0,
  avgD: entries.length ? Math.round(entries.reduce((s, e) => s + e.diastolic, 0) / entries.length) : 0,
  avgHR: entries.length ? Math.round(entries.reduce((s, e) => s + e.hr, 0) / entries.length) : 0,
});

export function compareMedsVsNoMeds(entries: BPEntry[]) {
  const onMeds = average(entries.filter(e => e.medicationTaken));
  const offMeds = average(entries.filter(e => e.medicationTaken === false));
  return { onMeds, offMeds, diffS: offMeds.avgS - onMeds.avgS, diffD: offMeds.avgD - onMeds.avgD };
}

export function getCircadianPattern(entries: BPEntry[]) {
  const groups = (['morning', 'afternoon', 'evening', 'night'] as const).reduce((out, key) => { out[key] = average(entries.filter(e => e.timeOfDay === key)); return out; }, {} as Record<'morning' | 'afternoon' | 'evening' | 'night', ReturnType<typeof average>>);
  const morning = groups.morning.avgS;
  const night = groups.night.avgS;
  return { ...groups, isNonDipper: morning > 0 && night > 0 && (morning - night) / morning < 0.1 };
}

export function calculateGoalAchievement(entries: BPEntry[], goals: { systolicTarget: number; diastolicTarget: number; hrTarget: number }) {
  if (!entries.length) return { totalReadings: 0, systolicAchieved: 0, diastolicAchieved: 0, hrAchieved: 0 };
  const pct = (count: number) => Math.round(count / entries.length * 100);
  return { totalReadings: entries.length, systolicAchieved: pct(entries.filter(e => e.systolic <= goals.systolicTarget).length), diastolicAchieved: pct(entries.filter(e => e.diastolic <= goals.diastolicTarget).length), hrAchieved: pct(entries.filter(e => e.hr <= goals.hrTarget).length) };
}

export function getDefaultGoals(classification: BPClassification) {
  const systolicTarget = { normal: 120, elevated: 120, stage1: 130, stage2: 140, crisis: 160 }[classification];
  return { systolicTarget, diastolicTarget: classification === 'normal' ? 80 : 85, hrTarget: 72 };
}

function correlate(a: number[], b: number[]) {
  if (a.length < 2 || a.length !== b.length) return null;
  const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
  const numerator = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
  const denominator = Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, x) => s + (x - mb) ** 2, 0));
  return denominator ? numerator / denominator : 0;
}

export function calculateWeightCorrelation(entries: BPEntry[], weights: { date: string; weight: number }[]) {
  const map = new Map(weights.map(x => [x.date, x.weight])); const pairs = entries.filter(e => map.has(e.date));
  const r = correlate(pairs.map(e => e.systolic), pairs.map(e => map.get(e.date)!));
  return r === null || pairs.length < 2 ? null : { r, n: pairs.length, positive: r > 0 };
}

export function calculateSleepCorrelation(entries: BPEntry[], sleep: { date: string; quality: number }[]) {
  const map = new Map(sleep.map(x => [x.date, x.quality])); const pairs = entries.filter(e => map.has(e.date));
  const r = correlate(pairs.map(e => e.systolic), pairs.map(e => map.get(e.date)!));
  return r === null || pairs.length < 2 ? null : { r, n: pairs.length, positive: r > 0 };
}

export async function exportBPData(): Promise<string> {
  return JSON.stringify({ version: '1.0', exportDate: new Date().toISOString(), entryCount: getBpEntries().length, entries: getBpEntries() });
}

export async function importBPData(json: string): Promise<{ success: boolean; message: string; importedCount?: number }> {
  try { const parsed = JSON.parse(json); if (!Array.isArray(parsed.entries)) return { success: false, message: 'отсутствует массив entries' }; const entries = parsed.entries.map(normalizeBpEntry); localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); return { success: true, message: 'Импорт выполнен', importedCount: entries.length }; } catch { return { success: false, message: 'Ошибка при разборе JSON' }; }
}

export function getBpEntries(): BPEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const list = raw.map(normalizeBpEntry).filter(e => Number.isFinite(e.systolic) && Number.isFinite(e.diastolic) && Number.isFinite(e.hr));
    return sortEntriesByTimestamp(list);
  } catch { return []; }
}

export function saveBpEntry(entry: BPEntry): void {
  const entries = getBpEntries();
  const normalized = normalizeBpEntry(entry);
  entries.push(normalized);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sortEntriesByTimestamp(entries).slice(0, 1000))); } catch {}
}

export function commitBpEntries(entries: BPEntry[]): BPEntry[] {
  const normalized = entries.map(normalizeBpEntry);
  const ordered = sortEntriesByTimestamp(normalized).slice(0, 1000);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered)); } catch {}
  return ordered;
}

export function updateBpEntry(entry: BPEntry): void {
  const normalized = normalizeBpEntry(entry);
  commitBpEntries(getBpEntries().map(x => x.id === normalized.id ? normalized : x));
}

export function deleteBpEntry(id: string): void {
  commitBpEntries(getBpEntries().filter(x => x.id !== id));
}

export function getLatestBp(): { systolic: number; diastolic: number; hr: number } | null {
  const entries = getBpEntries();
  if (entries.length === 0) return null;
  const sorted = sortEntriesByTimestamp(entries);
  const latest = sorted[0];
  return { systolic: latest.systolic, diastolic: latest.diastolic, hr: latest.hr };
}

export function getAvgBp(days: number = 7): { systolic: number; diastolic: number; hr: number } | null {
  const entries = getBpEntries();
  if (entries.length === 0) return null;
  const cutoffDate = new Date();
  cutoffDate.setHours(0, 0, 0, 0);
  cutoffDate.setDate(cutoffDate.getDate() - (days - 1));
  const cutoff = localIso(cutoffDate);
  const recent = entries.filter(e => e.date >= cutoff);
  if (recent.length === 0) return null;
  return {
    systolic: Math.round(recent.reduce((s, e) => s + e.systolic, 0) / recent.length),
    diastolic: Math.round(recent.reduce((s, e) => s + e.diastolic, 0) / recent.length),
    hr: Math.round(recent.reduce((s, e) => s + e.hr, 0) / recent.length),
  };
}

export function getBpRiskLevel(): 'low' | 'medium' | 'high' {
  const avg = getAvgBp(7);
  if (!avg) return 'low';
  if (avg.systolic > 140 || avg.diastolic > 90) return 'high';
  if (avg.systolic > 130 || avg.diastolic > 80) return 'medium';
  return 'low';
}

/* ── ЧСС (утро/вечер) — ведётся в записях АД (поле hr) ── */

export interface PulseDaypartStats {
  morning: { avg: number | null; count: number };
  evening: { avg: number | null; count: number };
}

/** Средний пульс в покое по времени суток за период (в окне days дней). */
export function getPulseDaypartAverages(entries: BPEntry[], days = 7): PulseDaypartStats {
  const cutoffDate = new Date();
  cutoffDate.setHours(0, 0, 0, 0);
  cutoffDate.setDate(cutoffDate.getDate() - (days - 1));
  const cutoff = localIso(cutoffDate);
  const inWindow = entries.filter((e) => e.date >= cutoff);
  const avg = (list: BPEntry[]) => {
    const vals = list.map((e) => Number(e.hr) || 0).filter((v) => v > 0);
    if (!vals.length) return null;
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  };
  return {
    morning: { avg: avg(inWindow.filter((e) => e.timeOfDay === 'morning')), count: inWindow.filter((e) => e.timeOfDay === 'morning').length },
    evening: { avg: avg(inWindow.filter((e) => e.timeOfDay === 'evening')), count: inWindow.filter((e) => e.timeOfDay === 'evening').length },
  };
}

/** Тренд утреннего пульса: последние 7 дней vs предыдущие 7 (только утренние замеры). */
export function getPulseTrend(entries: BPEntry[]): { direction: 'up' | 'down' | 'stable'; delta: number | null } | null {
  const mornings = entries
    .filter((e) => e.timeOfDay === 'morning' && (Number(e.hr) || 0) > 0)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (mornings.length < 2) return null;
  const cutoffDate = new Date();
  cutoffDate.setHours(0, 0, 0, 0);
  cutoffDate.setDate(cutoffDate.getDate() - 7);
  const cutoff = localIso(cutoffDate);
  const recent = mornings.filter((e) => e.date >= cutoff);
  const older = mornings.filter((e) => e.date < cutoff).slice(-7);
  if (!recent.length || !older.length) return null;
  const avg = (list: BPEntry[]) => list.reduce((s, e) => s + (Number(e.hr) || 0), 0) / list.length;
  const delta = avg(recent) - avg(older);
  return { direction: delta > 2 ? 'up' : delta < -2 ? 'down' : 'stable', delta: Math.round(delta * 10) / 10 };
}

/* ════════════════════════════════════════════════════════════════════
   ПРОФ-АНАЛИТИКА ДНЕВНИКА АД (домашний мониторинг по ESC/ISH)
   ════════════════════════════════════════════════════════════════════ */

export interface OrthostaticPair {
  date: string;
  sitting: BPEntry;
  standing: BPEntry;
  dropS: number;
  dropD: number;
  isOrthostatic: boolean;
}

/**
 * Парные ортостатические замеры «сидя → стоя» в ОДНОМ дне.
 * В отличие от старого `checkOrthostatic` (который брал произвольные сидя/стоя
 * из разных дней), здесь пары группируются по дате — это корректный протокол.
 */
export function getOrthostaticPairs(entries: BPEntry[]): OrthostaticPair[] {
  const byDay = new Map<string, { sitting?: BPEntry; standing?: BPEntry }>();
  for (const e of entries) {
    if (e.position !== 'sitting' && e.position !== 'standing') continue;
    const day = byDay.get(e.date) || {};
    if (e.position === 'sitting') day.sitting = e;
    else day.standing = e;
    byDay.set(e.date, day);
  }
  const pairs: OrthostaticPair[] = [];
  for (const [date, { sitting, standing }] of byDay) {
    if (!sitting || !standing) continue;
    const dropS = sitting.systolic - standing.systolic;
    const dropD = sitting.diastolic - standing.diastolic;
    pairs.push({ date, sitting, standing, dropS, dropD, isOrthostatic: dropS >= 20 || dropD >= 10 });
  }
  return pairs.sort((a, b) => b.date.localeCompare(a.date));
}

export interface HomeBPDay {
  date: string;
  morning: BPEntry | null;
  evening: BPEntry | null;
  readings: BPEntry[];
  dailyAvgS: number;
  dailyAvgD: number;
}

export interface HomeBPAdherence {
  daysWindow: number;
  days: HomeBPDay[];
  completeDays: number;      // дни с утренним И вечерним замером
  morningOnlyDays: number;
  eveningOnlyDays: number;
  anyDays: number;
  completenessPct: number;   // доля дней с полной парой замеров
  homeMeanS: number;         // среднее АД по ВСЕМ замерам окна
  homeMeanD: number;
  homeMeanHr: number;
}

/**
 * Соблюдение протокола домашнего мониторинга АД (ESC/ISH):
 * 7 дней × утро + вечер по 2–3 измерения, 1-й день отбрасывается.
 * Возвращает по-дневную структуру и метрики полноты протокола.
 */
export function getHomeBPAdherence(entries: BPEntry[], daysWindow = 7): HomeBPAdherence {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (daysWindow - 1));

  const byDay = new Map<string, BPEntry[]>();
  for (const e of entries) {
    if (e.date >= localIso(start)) {
      const list = byDay.get(e.date) || [];
      list.push(e);
      byDay.set(e.date, list);
    }
  }

  const days: HomeBPDay[] = [];
  for (let i = 0; i < daysWindow; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = localIso(d);
    const list = byDay.get(iso) || [];
    const morning = list.find((e) => e.timeOfDay === 'morning') || null;
    const evening = list.find((e) => e.timeOfDay === 'evening') || null;
    days.push({
      date: iso, morning, evening, readings: list,
      dailyAvgS: list.length ? Math.round(list.reduce((a, b) => a + b.systolic, 0) / list.length) : 0,
      dailyAvgD: list.length ? Math.round(list.reduce((a, b) => a + b.diastolic, 0) / list.length) : 0,
    });
  }

  const completeDays = days.filter((x) => x.morning && x.evening).length;
  const morningOnlyDays = days.filter((x) => x.morning && !x.evening).length;
  const eveningOnlyDays = days.filter((x) => !x.morning && x.evening).length;
  const anyDays = days.filter((x) => x.readings.length > 0).length;
  const allReadings = days.flatMap((x) => x.readings);

  const mean = (k: 'systolic' | 'diastolic' | 'hr') =>
    allReadings.length ? Math.round(allReadings.reduce((a, b) => a + Number(b[k] || 0), 0) / allReadings.length) : 0;

  return {
    daysWindow, days,
    completeDays, morningOnlyDays, eveningOnlyDays, anyDays,
    completenessPct: Math.round((completeDays / daysWindow) * 100),
    homeMeanS: mean('systolic'), homeMeanD: mean('diastolic'), homeMeanHr: mean('hr'),
  };
}

/**
 * Классификация по ПОРОГАМ ДОМАШНЕГО измерения (ESC/ISH):
 * дома АД в среднем ниже, чем в кабинете → пороги сдвинуты вниз (≥135/85).
 */
export function classifyHomeBP(systolic: number, diastolic: number): BPClassification {
  if (systolic >= 180 || diastolic >= 120) return 'crisis';
  if (systolic >= 135 || diastolic >= 85) return 'stage1';
  if (systolic >= 130 || diastolic >= 80) return 'elevated';
  return 'normal';
}

export type MorningEveningPattern = 'morning_surge' | 'evening_higher' | 'similar' | 'insufficient';

export interface MorningEveningComparison {
  morningS: number; morningD: number; morningCount: number;
  eveningS: number; eveningD: number; eveningCount: number;
  diffS: number;
  pattern: MorningEveningPattern;
}

/** Сравнение утренних и вечерних средних — выявляет «утренний подъём» (morning surge). */
export function getMorningEveningComparison(entries: BPEntry[], days = 7): MorningEveningComparison {
  const cutoffDate = new Date();
  cutoffDate.setHours(0, 0, 0, 0);
  cutoffDate.setDate(cutoffDate.getDate() - (days - 1));
  const cutoff = localIso(cutoffDate);
  const morning = entries.filter((e) => e.date >= cutoff && e.timeOfDay === 'morning');
  const evening = entries.filter((e) => e.date >= cutoff && e.timeOfDay === 'evening');
  const avg = (l: BPEntry[], k: 'systolic' | 'diastolic') => (l.length ? Math.round(l.reduce((a, b) => a + b[k], 0) / l.length) : 0);
  const morningS = avg(morning, 'systolic');
  const morningD = avg(morning, 'diastolic');
  const eveningS = avg(evening, 'systolic');
  const eveningD = avg(evening, 'diastolic');
  const diffS = morningS - eveningS;
  if (!morning.length || !evening.length) {
    return { morningS, morningD, morningCount: morning.length, eveningS, eveningD, eveningCount: evening.length, diffS, pattern: 'insufficient' };
  }
  const pattern: MorningEveningPattern = diffS >= 10 ? 'morning_surge' : diffS <= -10 ? 'evening_higher' : 'similar';
  return { morningS, morningD, morningCount: morning.length, eveningS, eveningD, eveningCount: evening.length, diffS, pattern };
}

function meanOver(entries: BPEntry[], days: number, k: 'systolic' | 'diastolic' | 'hr'): number {
  const cutoffDate = new Date();
  cutoffDate.setHours(0, 0, 0, 0);
  cutoffDate.setDate(cutoffDate.getDate() - (days - 1));
  const cutoff = localIso(cutoffDate);
  const recent = entries.filter((e) => e.date >= cutoff);
  if (!recent.length) return 0;
  return Math.round(recent.reduce((s, e) => s + Number(e[k] || 0), 0) / recent.length);
}

export interface CardioRiskFactor {
  label: string;
  active: boolean;
  detail?: string;
}

export interface CardioRiskProfile {
  level: 'low' | 'moderate' | 'high';
  points: number;
  factors: CardioRiskFactor[];
  summary: string;
}

/**
 * Лёгкий ОЦЕНОЧНЫЙ профиль сердечно-сосудистого риска на основе дневника АД.
 * Учитывает среднее АД (7д), вариабельность, BP Load, ЧСС покоя и возраст.
 * Это НЕ диагноз и НЕ медицинский скрининг — инструмент самоконтроля.
 */
export function estimateCardioRisk(
  entries: BPEntry[],
  profile?: { age?: number; sex?: 'male' | 'female' | string; smoking?: boolean },
): CardioRiskProfile | null {
  if (!entries.length) return null;
  const avgS = meanOver(entries, 7, 'systolic');
  const avgD = meanOver(entries, 7, 'diastolic');
  const avgHr = meanOver(entries, 7, 'hr');
  if (!avgS && !avgD) return null;

  const cls = classifyBP(avgS, avgD);
  const variability = calcVariability(entries);
  const load = calcBPLoad(entries);
  const age = profile?.age ?? 0;
  const smoking = profile?.smoking;

  const factors: CardioRiskFactor[] = [];
  let points = 0;
  const add = (label: string, active: boolean, detail: string | undefined, w = 1) => {
    factors.push({ label, active, detail });
    if (active) points += w;
  };

  add(`Среднее АД (7д): ${avgS}/${avgD}`, cls === 'stage1' || cls === 'stage2' || cls === 'crisis', 'цель < 130/80 мм рт.ст.', 2);
  add(`Вариабельность (SD систолы ${variability.sysSD.toFixed(1)})`, variability.sysSD > 15 || variability.diaSD > 10, 'высокая вариабельность связана с риском событий', 1);
  add(`BP Load ${load}%`, load > 50, 'больше половины измерений выше цели', 1);
  if (avgHr > 90) add(`ЧСС в покое ${avgHr}`, true, 'тахикардия покоя', 1);
  if (age >= 55) add(`Возраст ${age} лет`, true, 'возрастной фактор риска', 1);
  if (smoking) add('Курение', true, 'активное курение', 1);

  const level: CardioRiskProfile['level'] = points >= 4 ? 'high' : points >= 2 ? 'moderate' : 'low';
  const summary =
    level === 'high'
      ? 'Сочетание факторов — риск выше среднего. Рекомендуется регулярный контроль и консультация врача.'
      : level === 'moderate'
        ? 'Есть факторы риска. Рекомендуется их коррекция и регулярный контроль АД.'
        : 'Выраженных факторов риска мало. Поддерживайте текущий контроль.';

  return { level, points, factors, summary };
}
