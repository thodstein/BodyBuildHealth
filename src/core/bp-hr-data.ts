const STORAGE_KEY = 'he_bp_diary';

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
  'Головная боль', 'Головокружение', 'Шум в ушах', 'Боль в груди',
  'Одышка', 'Тошнота', 'Мелькание мушек', 'Слабость', 'Отёки',
  'Потливость', 'Учащённое сердцебиение', 'Нарушение зрения',
] as const;

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
    return raw.map(normalizeBpEntry).filter(e => Number.isFinite(e.systolic) && Number.isFinite(e.diastolic) && Number.isFinite(e.hr));
  } catch { return []; }
}

export function saveBpEntry(entry: BPEntry) {
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
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
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
