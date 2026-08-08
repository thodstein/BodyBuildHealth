/**
 * injection-diary.engine.ts — Дневник инъекций
 *
 * Полноценный движок: CRUD, статистика, аномалии, ротация зон.
 * Хранилище: localStorage key `he_injection_diary`.
 */

const STORAGE_KEY = 'he_injection_diary';

export const INJECTION_ZONES = [
  { id: 'glute_dorsal', label: 'Ягодица (дорсальная)', side: 'any' as const },
  { id: 'glute_ventral', label: 'Вентро-ягодичная', side: 'any' as const },
  { id: 'quadriceps_l', label: 'Квадрицепс левый', side: 'left' as const },
  { id: 'quadriceps_r', label: 'Квадрицепс правый', side: 'right' as const },
  { id: 'deltoid_l', label: 'Дельтовидная левая', side: 'left' as const },
  { id: 'deltoid_r', label: 'Дельтовидная правая', side: 'right' as const },
  { id: 'pectoral_l', label: 'Грудная левая', side: 'left' as const },
  { id: 'pectoral_r', label: 'Грудная правая', side: 'right' as const },
  { id: 'triceps_l', label: 'Трицепс левый', side: 'left' as const },
  { id: 'triceps_r', label: 'Трицепс правый', side: 'right' as const },
  { id: 'biceps_l', label: 'Бицепс левый', side: 'left' as const },
  { id: 'biceps_r', label: 'Бицепс правый', side: 'right' as const },
  { id: 'calves_l', label: 'Икры левые', side: 'left' as const },
  { id: 'calves_r', label: 'Икры правые', side: 'right' as const },
  { id: 'abdominal', label: 'Живот (п/к)', side: 'any' as const },
] as const;

export const NEEDLE_GAUGES = ['21G', '22G', '23G', '25G', '27G', '29G', '30G', '31G'] as const;

export const TECHNIQUES = [
  { id: 'im', label: 'В/м (масло)' },
  { id: 'subq', label: 'П/к (водный)' },
  { id: 'im_water', label: 'В/м (водный)' },
  { id: 'subq_oil', label: 'П/к (масло, редко)' },
] as const;

export interface InjectionEntry {
  id: string;
  date: string;
  substance: string;
  dose: string;
  zone: string;
  side: 'left' | 'right';
  volumeMl: number;
  needleGauge: string;
  technique: string;
  painLevel: number;
  pipLevel: number;
  swelling: number;
  redness: boolean;
  lump: boolean;
  bruise: boolean;
  notes?: string;
}

export interface InjectionStats {
  totalInjections: number;
  avgPain: number | null;
  avgPip: number | null;
  lumpCount: number;
  bruiseCount: number;
  rednessCount: number;
  complicationRate: number;
  zoneStats: { zone: string; count: number; avgPain: number | null; avgPip: number | null; daysSinceLast: number | null }[];
  substanceStats: { substance: string; count: number; avgPain: number | null }[];
  last7: { count: number; avgPain: number | null; avgPip: number | null } | null;
}

export interface RotationWarning {
  zone: string;
  lastDate: string;
  daysSince: number;
  recommended: boolean;
  severity: 'warn' | 'danger';
}

export interface InjectionAnomaly {
  date: string;
  severity: 'warn' | 'danger';
  message: string;
  category: 'pip' | 'swelling' | 'pain' | 'infection' | 'rotation' | 'frequency';
}

/* ── localStorage helpers ── */

function readStorage(): InjectionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeStorage(data: InjectionEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.slice(-365)));
  } catch { /* quota exceeded — silent */ }
}

/* ── CRUD ── */

export function getInjectionDiary(): InjectionEntry[] {
  return readStorage();
}

export function addInjection(entry: Omit<InjectionEntry, 'id'>): InjectionEntry[] {
  const diary = readStorage();
  const newEntry: InjectionEntry = {
    ...entry,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  const updated = [...diary, newEntry].sort((a, b) => a.date.localeCompare(b.date));
  writeStorage(updated);
  return updated;
}

export function updateInjection(id: string, patch: Partial<InjectionEntry>): InjectionEntry[] {
  const diary = readStorage();
  const updated = diary.map(e => e.id === id ? { ...e, ...patch } : e)
    .sort((a, b) => a.date.localeCompare(b.date));
  writeStorage(updated);
  return updated;
}

export function deleteInjection(id: string): InjectionEntry[] {
  const diary = readStorage();
  const updated = diary.filter(e => e.id !== id);
  writeStorage(updated);
  return updated;
}

export function clearInjectionDiary(): InjectionEntry[] {
  writeStorage([]);
  return [];
}

/* ── Helpers ── */

export function todayLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function zoneLabel(zoneId: string): string {
  return INJECTION_ZONES.find(z => z.id === zoneId)?.label || zoneId;
}

export function techniqueLabel(techId: string): string {
  return TECHNIQUES.find(t => t.id === techId)?.label || techId;
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

export function getEntriesForZone(zoneId: string, entries: InjectionEntry[]): InjectionEntry[] {
  return entries.filter(e => e.zone === zoneId).sort((a, b) => b.date.localeCompare(a.date));
}

export function getDaysSinceLastInjection(zoneId: string, entries: InjectionEntry[], fromDate?: string): number | null {
  const zoneEntries = getEntriesForZone(zoneId, entries);
  if (zoneEntries.length === 0) return null;
  const ref = fromDate || todayLocalStr();
  const last = zoneEntries[0];
  if (last.date > ref) return 0;
  return Math.max(0, Math.floor((Date.parse(`${ref}T00:00:00`) - Date.parse(`${last.date}T00:00:00`)) / 86400000));
}

export function getRotationWarnings(entries: InjectionEntry[], restDays: number = 7): RotationWarning[] {
  const warnings: RotationWarning[] = [];
  const today = todayLocalStr();
  for (const zone of INJECTION_ZONES) {
    const zoneEntries = getEntriesForZone(zone.id, entries);
    if (zoneEntries.length === 0) continue;
    const daysSince = getDaysSinceLastInjection(zone.id, entries, today);
    if (daysSince === null) continue;
    const recommended = daysSince >= restDays;
    const severity: 'warn' | 'danger' | 'ok' = daysSince >= 14 ? 'danger' : daysSince >= restDays ? 'warn' : 'ok';
    if (severity !== 'ok') {
      warnings.push({ zone: zone.id, lastDate: zoneEntries[0].date, daysSince, recommended, severity });
    }
  }
  return warnings.sort((a, b) => b.daysSince - a.daysSince);
}

export function getSuggestedZone(currentEntries: InjectionEntry[]): string {
  const today = todayLocalStr();
  const usedToday = new Set(currentEntries.filter(e => e.date === today).map(e => e.zone));
  for (const zone of INJECTION_ZONES) {
    if (usedToday.has(zone.id)) continue;
    const daysSince = getDaysSinceLastInjection(zone.id, currentEntries, today);
    if (daysSince === null || daysSince >= 7) return zone.id;
  }
  const sortedByRest = [...INJECTION_ZONES]
    .map(z => ({ zone: z.id, days: getDaysSinceLastInjection(z.id, currentEntries, today) ?? -1 }))
    .sort((a, b) => b.days - a.days);
  return sortedByRest[0]?.zone || INJECTION_ZONES[0].id;
}

/* ── Statistics ── */

export function computeInjectionStats(entries: InjectionEntry[]): InjectionStats {
  const total = entries.length;
  if (total === 0) {
    return { totalInjections: 0, avgPain: null, avgPip: null, lumpCount: 0, bruiseCount: 0, rednessCount: 0, complicationRate: 0, zoneStats: [], substanceStats: [], last7: null };
  }

  const avgPain = entries.reduce((s, e) => s + e.painLevel, 0) / total;
  const avgPip = entries.reduce((s, e) => s + e.pipLevel, 0) / total;
  const lumpCount = entries.filter(e => e.lump).length;
  const bruiseCount = entries.filter(e => e.bruise).length;
  const rednessCount = entries.filter(e => e.redness).length;
  const complications = entries.filter(e => e.lump || e.bruise || e.redness || e.pipLevel >= 4 || e.swelling >= 4).length;

  const zoneMap = new Map<string, { count: number; painSum: number; pipSum: number }>();
  const substanceMap = new Map<string, { count: number; painSum: number }>();
  for (const e of entries) {
    const z = zoneMap.get(e.zone) || { count: 0, painSum: 0, pipSum: 0 };
    z.count++;
    z.painSum += e.painLevel;
    z.pipSum += e.pipLevel;
    zoneMap.set(e.zone, z);
    const s = substanceMap.get(e.substance) || { count: 0, painSum: 0 };
    s.count++;
    s.painSum += e.painLevel;
    substanceMap.set(e.substance, s);
  }

  const zoneStats = [...zoneMap.entries()]
    .map(([zone, data]) => ({
      zone,
      count: data.count,
      avgPain: data.count > 0 ? +(data.painSum / data.count).toFixed(1) : null,
      avgPip: data.count > 0 ? +(data.pipSum / data.count).toFixed(1) : null,
      daysSinceLast: getDaysSinceLastInjection(zone, entries),
    }))
    .sort((a, b) => b.count - a.count);

  const substanceStats = [...substanceMap.entries()]
    .map(([substance, data]) => ({
      substance,
      count: data.count,
      avgPain: data.count > 0 ? +(data.painSum / data.count).toFixed(1) : null,
    }))
    .sort((a, b) => b.count - a.count);

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const last7Entries = entries.filter(e => e.date >= weekAgo);
  const last7 = last7Entries.length > 0
    ? {
        count: last7Entries.length,
        avgPain: +(last7Entries.reduce((s, e) => s + e.painLevel, 0) / last7Entries.length).toFixed(1),
        avgPip: +(last7Entries.reduce((s, e) => s + e.pipLevel, 0) / last7Entries.length).toFixed(1),
      }
    : null;

  return {
    totalInjections: total,
    avgPain: +avgPain.toFixed(1),
    avgPip: +avgPip.toFixed(1),
    lumpCount,
    bruiseCount,
    rednessCount,
    complicationRate: +(complications / total * 100).toFixed(0),
    zoneStats,
    substanceStats,
    last7,
  };
}

/* ── Anomaly detection ── */

export function detectInjectionAnomalies(entries: InjectionEntry[]): InjectionAnomaly[] {
  const issues: InjectionAnomaly[] = [];
  if (entries.length === 0) return issues;

  const today = todayLocalStr();

  for (const e of entries) {
    if (e.pipLevel >= 7) {
      issues.push({ date: e.date, severity: 'danger', message: `PIP ${e.pipLevel}/10 в зоне ${zoneLabel(e.zone)} (тяжёлый)`, category: 'pip' });
    } else if (e.pipLevel >= 4) {
      issues.push({ date: e.date, severity: 'warn', message: `PIP ${e.pipLevel}/10 в зоне ${zoneLabel(e.zone)}`, category: 'pip' });
    }

    if (e.swelling >= 7) {
      issues.push({ date: e.date, severity: 'danger', message: `Отёк ${e.swelling}/10 в зоне ${zoneLabel(e.zone)}`, category: 'swelling' });
    } else if (e.swelling >= 4) {
      issues.push({ date: e.date, severity: 'warn', message: `Отёк ${e.swelling}/10 в зоне ${zoneLabel(e.zone)}`, category: 'swelling' });
    }

    if (e.painLevel >= 7) {
      issues.push({ date: e.date, severity: 'danger', message: `Боль при введении ${e.painLevel}/10`, category: 'pain' });
    } else if (e.painLevel >= 4) {
      issues.push({ date: e.date, severity: 'warn', message: `Боль при введении ${e.painLevel}/10`, category: 'pain' });
    }

    if (e.redness && e.lump) {
      issues.push({ date: e.date, severity: 'danger', message: `Покраснение + уплотнение в ${zoneLabel(e.zone)} — возможно инфицирование`, category: 'infection' });
    } else if (e.redness && e.bruise) {
      issues.push({ date: e.date, severity: 'warn', message: `Покраснение + гематома в ${zoneLabel(e.zone)}`, category: 'infection' });
    } else if (e.lump && e.pipLevel >= 4) {
      issues.push({ date: e.date, severity: 'warn', message: `Уплотнение + PIP ≥4 в ${zoneLabel(e.zone)}`, category: 'infection' });
    }
  }

  for (const warning of getRotationWarnings(entries)) {
    if (warning.severity === 'danger') {
      issues.push({
        date: warning.lastDate,
        severity: 'danger',
        message: `Зона ${zoneLabel(warning.zone)} не использовалась ${warning.daysSince} дней — риск фиброза/липома`,
        category: 'rotation',
      });
    }
  }

  const zoneFreq = new Map<string, number>();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  for (const e of entries.filter(e => e.date >= weekAgo)) {
    zoneFreq.set(e.zone, (zoneFreq.get(e.zone) || 0) + 1);
  }
  for (const [zone, count] of zoneFreq) {
    if (count >= 3) {
      issues.push({
        date: today,
        severity: 'warn',
        message: `Зона ${zoneLabel(zone)}: ${count} инъекций за 7 дней — рекомендуется ротация`,
        category: 'frequency',
      });
    }
  }

  return issues.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'danger' ? -1 : 1;
    return b.date.localeCompare(a.date);
  });
}

/* ── Frequency ── */

export function getWeeklyFrequency(entries: InjectionEntry[], weeks: number = 4): { week: string; count: number }[] {
  const result: { week: string; count: number }[] = [];
  const now = new Date();
  for (let w = weeks - 1; w >= 0; w--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - w * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);
    const startStr = localDateKey(weekStart);
    const endStr = localDateKey(weekEnd);
    const count = entries.filter(e => e.date >= startStr && e.date <= endStr).length;
    const label = `${weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
    result.push({ week: label, count });
  }
  return result;
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ── Dose parsing ── */

export function parseDose(doseStr: string): { value: number; unit: string } | null {
  if (!doseStr || typeof doseStr !== 'string') return null;
  const cleaned = doseStr.replace(',', '.').replace(/[^0-9.]/g, '').trim();
  if (!cleaned) return null;
  const value = parseFloat(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = doseStr.toLowerCase().includes('мл') || doseStr.toLowerCase().includes('ml')
    ? 'мл'
    : doseStr.toLowerCase().includes('мг') || doseStr.toLowerCase().includes('mg')
      ? 'мг'
      : doseStr.toLowerCase().includes('iu') || doseStr.toLowerCase().includes('МЕ')
        ? 'IU'
        : '';
  return { value: Math.round(value * 100) / 100, unit };
}

/* ── Migration: old 5-field → new full entry ── */

export function migrateLegacyEntry(legacy: { date: string; substance: string; dose: string; site: string; notes?: string }): InjectionEntry {
  const normalizedSite = INJECTION_ZONES.find(z => z.label === legacy.site || z.id === legacy.site)?.id || 'glute_dorsal';
  const zoneData = INJECTION_ZONES.find(z => z.id === normalizedSite);
  return {
    id: `legacy_${legacy.date}_${legacy.substance}_${Math.random().toString(36).slice(2, 6)}`,
    date: legacy.date,
    substance: legacy.substance,
    dose: legacy.dose,
    zone: normalizedSite,
    side: zoneData?.side === 'left' ? 'left' : zoneData?.side === 'right' ? 'right' : 'left',
    volumeMl: 1,
    needleGauge: '23G',
    technique: 'im',
    painLevel: 0,
    pipLevel: 0,
    swelling: 0,
    redness: false,
    lump: false,
    bruise: false,
    notes: legacy.notes,
  };
}

export function migrateAllLegacyEntries(): InjectionEntry[] {
  const diary = readStorage();
  const migrated: InjectionEntry[] = [];
  for (const entry of diary) {
    if ((entry as any).zone && (entry as any).painLevel !== undefined) {
      migrated.push(entry as InjectionEntry);
    } else {
      migrated.push(migrateLegacyEntry(entry as any));
    }
  }
  if (migrated.some((e, i) => e !== diary[i])) {
    writeStorage(migrated);
  }
  return migrated;
}
