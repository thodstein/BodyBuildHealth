/**
 * injection-diary.engine.ts — Дневник инъекций
 *
 * Полноценный движок: CRUD, статистика, аномалии, ротация зон, рекомендации.
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
  /** Повышенная температура после инъекции (признак инфекции). */
  fever?: boolean;
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
  zone: string;
}

/* ── localStorage helpers ── */

function readRawStorage(): any[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function readStorage(): InjectionEntry[] {
  return readRawStorage().filter((e: any): e is InjectionEntry => {
    if (!e?.date || !e?.substance || !e?.zone) return false;
    if (typeof e.painLevel !== 'number' || typeof e.pipLevel !== 'number') return false;
    return true;
  });
}

function writeStorage(data: InjectionEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.slice(-365)));
  } catch (error) {
    if ((error as Error)?.name === 'QuotaExceededError' || (error as any)?.code === 22) {
      try {
        const existing = readRawStorage();
        const cutoff = localDateDaysAgo(180);
        const trimmed = existing.filter((e: any) => e.date && e.date >= cutoff);
        const valid = trimmed.filter((e: any): e is InjectionEntry => !!e?.date && !!e?.substance && !!e?.zone);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(valid.length > 0 ? valid : []));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }
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

/** Полная замена дневника с сохранением id (используется для undo/импорта). */
export function replaceInjectionDiary(entries: InjectionEntry[]): InjectionEntry[] {
  const valid = entries.filter((e): e is InjectionEntry => !!e?.date && !!e?.substance && !!e?.zone);
  writeStorage(valid);
  return valid;
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

const ZONE_SAFETY_RANK = (zoneId: string): number => {
  const risk = ZONE_TECHNIQUE[zoneId]?.risk || 'Средний';
  return risk === 'Низкий' ? 0 : risk === 'Средний' ? 1 : risk === 'Высокий' ? 2 : 3;
};

/** Рекомендация пары «зона + сторона»: приоритет безопасным отдохнувшим зонам,
 *  неиспользованные — в конце очереди (не предлагаем бицепс/икры новичку). */
export function getSuggestedZoneSide(
  entries: InjectionEntry[],
): { zone: string; side: 'left' | 'right'; days: number } | null {
  const today = todayLocalStr();
  const usedToday = new Set(entries.filter(e => e.date === today).map(e => `${e.zone}_${e.side}`));
  const daysFor = (zoneId: string, side: 'left' | 'right'): number | null => {
    const pair = entries.filter(e => e.zone === zoneId && e.side === side);
    if (pair.length === 0) return null;
    const last = [...pair].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (last.date > today) return 0;
    return Math.max(0, Math.floor((Date.parse(`${today}T00:00:00`) - Date.parse(`${last.date}T00:00:00`)) / 86400000));
  };
  const sidesOf = (zone: (typeof INJECTION_ZONES)[number]): ('left' | 'right')[] =>
    zone.side === 'any' ? ['left', 'right'] : [zone.side];

  for (const zone of INJECTION_ZONES) {
    for (const side of sidesOf(zone)) {
      const key = `${zone.id}_${side}`;
      if (usedToday.has(key)) continue;
      const days = daysFor(zone.id, side);
      if (days === null || days >= 7) return { zone: zone.id, side, days: days ?? -1 };
    }
  }

  let best: { zone: string; side: 'left' | 'right'; days: number } | null = null;
  for (const zone of INJECTION_ZONES) {
    for (const side of sidesOf(zone)) {
      const key = `${zone.id}_${side}`;
      if (usedToday.has(key)) continue;
      const days = daysFor(zone.id, side);
      const d = days ?? -1;
      if (!best || d > best.days || (d === best.days && ZONE_SAFETY_RANK(zone.id) < ZONE_SAFETY_RANK(best.zone))) {
        best = { zone: zone.id, side, days: d };
      }
    }
  }
  return best;
}

/** Проверки совместимости зоны с техникой и объёмом (по справочнику ZONE_TECHNIQUE). */
export function getZoneCompatibilityIssues(zoneId: string, technique: string, volumeMl: number): string[] {
  const issues: string[] = [];
  const advice = getZoneTechniqueAdvice(zoneId);
  if (!advice) return issues;
  const zoneName = advice.zoneId === zoneId ? zoneLabel(zoneId) : zoneId;
  if (advice.solutionType === 'водный' && (technique === 'im' || technique === 'subq_oil')) {
    issues.push(`Зона «${zoneName}» — только водные растворы, масляный в/м не рекомендуется`);
  }
  if (volumeMl > 0 && volumeMl > advice.maxVolumeMl) {
    issues.push(`Объём ${volumeMl} мл превышает максимум ${advice.maxVolumeMl} мл для зоны «${zoneName}»`);
  }
  if (advice.risk === 'Очень высокий' && technique === 'im') {
    issues.push(`Зона «${zoneName}» — очень высокий риск, только для опытных (малый объём, водные препараты)`);
  }
  return issues;
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

  const weekAgo = localDateDaysAgo(7);
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
      issues.push({ date: e.date, zone: e.zone, severity: 'danger', message: `PIP ${e.pipLevel}/10 в зоне ${zoneLabel(e.zone)} (тяжёлый)`, category: 'pip' });
    } else if (e.pipLevel >= 4) {
      issues.push({ date: e.date, zone: e.zone, severity: 'warn', message: `PIP ${e.pipLevel}/10 в зоне ${zoneLabel(e.zone)}`, category: 'pip' });
    }

    if (e.swelling >= 7) {
      issues.push({ date: e.date, zone: e.zone, severity: 'danger', message: `Отёк ${e.swelling}/10 в зоне ${zoneLabel(e.zone)}`, category: 'swelling' });
    } else if (e.swelling >= 4) {
      issues.push({ date: e.date, zone: e.zone, severity: 'warn', message: `Отёк ${e.swelling}/10 в зоне ${zoneLabel(e.zone)}`, category: 'swelling' });
    }

    if (e.painLevel >= 7) {
      issues.push({ date: e.date, zone: e.zone, severity: 'danger', message: `Боль при введении ${e.painLevel}/10`, category: 'pain' });
    } else if (e.painLevel >= 4) {
      issues.push({ date: e.date, zone: e.zone, severity: 'warn', message: `Боль при введении ${e.painLevel}/10`, category: 'pain' });
    }

    if (e.fever && (e.redness || e.lump)) {
      issues.push({ date: e.date, zone: e.zone, severity: 'danger', message: `Температура + ${e.redness && e.lump ? 'покраснение и уплотнение' : e.redness ? 'покраснение' : 'уплотнение'} в ${zoneLabel(e.zone)} — высокая вероятность инфицирования`, category: 'infection' });
    } else if (e.fever) {
      issues.push({ date: e.date, zone: e.zone, severity: 'warn', message: `Отмечена повышенная температура после инъекции в ${zoneLabel(e.zone)} — следите за симптомами`, category: 'infection' });
    }

    if (e.redness && e.lump) {
      issues.push({ date: e.date, zone: e.zone, severity: 'danger', message: `Покраснение + уплотнение в ${zoneLabel(e.zone)} — возможно инфицирование`, category: 'infection' });
    } else if (e.redness && e.bruise) {
      issues.push({ date: e.date, zone: e.zone, severity: 'warn', message: `Покраснение + гематома в ${zoneLabel(e.zone)}`, category: 'infection' });
    } else if (e.lump && e.pipLevel >= 4) {
      issues.push({ date: e.date, zone: e.zone, severity: 'warn', message: `Уплотнение + PIP ≥4 в ${zoneLabel(e.zone)}`, category: 'infection' });
    }
  }

  for (const warning of getRotationWarnings(entries)) {
    if (warning.severity === 'danger') {
      issues.push({
        date: warning.lastDate,
        zone: warning.zone,
        severity: 'danger',
        message: `Зона ${zoneLabel(warning.zone)} не использовалась ${warning.daysSince} дней — риск фиброза/липома`,
        category: 'rotation',
      });
    }
  }

  const zoneFreq = new Map<string, number>();
  const weekAgo = localDateDaysAgo(7);
  for (const e of entries.filter(e => e.date >= weekAgo)) {
    zoneFreq.set(e.zone, (zoneFreq.get(e.zone) || 0) + 1);
  }
  for (const [zone, count] of zoneFreq) {
    if (count >= 3) {
      issues.push({
        date: today,
        zone,
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

export function localDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateKey(d);
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

export interface DoseSummaryRow {
  substance: string;
  unit: string;
  total: number;
  count: number;
  avg: number | null;
}

/** Суммарные дозы по препаратам за период (для контроля недельной нагрузки). */
export function getDoseSummary(entries: InjectionEntry[], days: number = 7): DoseSummaryRow[] {
  const cutoff = localDateDaysAgo(days);
  const map = new Map<string, { name: string; total: number; count: number; unit: string }>();
  for (const e of entries) {
    if (e.date < cutoff) continue;
    const parsed = parseDose(e.dose);
    if (!parsed) continue;
    const key = `${e.substance.trim().toLowerCase()}::${parsed.unit}`;
    const cur = map.get(key) || { name: e.substance.trim(), total: 0, count: 0, unit: parsed.unit };
    cur.total += parsed.value;
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([, d]) => ({
      substance: d.name,
      unit: d.unit,
      total: Math.round(d.total * 100) / 100,
      count: d.count,
      avg: d.count > 0 ? +(d.total / d.count).toFixed(1) : null,
    }))
    .sort((a, b) => b.total - a.total);
}

export interface InjectionTrend {
  period: string;
  avgPain: number | null;
  avgPip: number | null;
  count: number;
  direction: 'up' | 'down' | 'stable';
}

export interface ZoneTechniqueMatrix {
  zone: string;
  technique: string;
  count: number;
  avgPip: number | null;
  avgPain: number | null;
}

export interface RepeatLastSuggestion {
  substance: string;
  dose: string;
  zone: string;
  side: 'left' | 'right';
  volumeMl: number;
  needleGauge: string;
  technique: string;
  date: string;
}

/* ── Trend analysis ── */

export function getInjectionTrend(entries: InjectionEntry[], days: number = 7): InjectionTrend | null {
  if (entries.length < 2) return null;
  const recent = entries.filter(e => e.date >= localDateDaysAgo(days));
  const previous = entries.filter(e => {
    const end = localDateDaysAgo(days);
    const start = localDateDaysAgo(days * 2);
    return e.date >= start && e.date < end;
  });
  const recentAvgPip = recent.length ? recent.reduce((s, e) => s + e.pipLevel, 0) / recent.length : 0;
  const prevAvgPip = previous.length ? previous.reduce((s, e) => s + e.pipLevel, 0) / previous.length : 0;
  const delta = recentAvgPip - prevAvgPip;
  return {
    period: `${days}дн`,
    avgPain: recent.length ? +((recent.reduce((s, e) => s + e.painLevel, 0) / recent.length).toFixed(1)) : null,
    avgPip: recent.length ? +recentAvgPip.toFixed(1) : null,
    count: recent.length,
    direction: delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'stable',
  };
}

export function getZoneTechniqueMatrix(entries: InjectionEntry[]): ZoneTechniqueMatrix[] {
  const map = new Map<string, { pipSum: number; painSum: number; count: number }>();
  for (const e of entries) {
    const key = `${e.zone}::${e.technique}`;
    const existing = map.get(key) || { pipSum: 0, painSum: 0, count: 0 };
    existing.pipSum += e.pipLevel;
    existing.painSum += e.painLevel;
    existing.count++;
    map.set(key, existing);
  }
  return [...map.entries()]
    .map(([key, data]) => {
      const [zone, technique] = key.split('::');
      return {
        zone,
        technique,
        count: data.count,
        avgPip: data.count > 0 ? +(data.pipSum / data.count).toFixed(1) : null,
        avgPain: data.count > 0 ? +(data.painSum / data.count).toFixed(1) : null,
      };
    })
    .sort((a, b) => (b.avgPip ?? 0) - (a.avgPip ?? 0));
}

export function getLastInjection(entries: InjectionEntry[]): RepeatLastSuggestion | null {
  if (entries.length === 0) return null;
  const last = entries[entries.length - 1];
  return {
    substance: last.substance,
    dose: last.dose,
    zone: last.zone,
    side: last.side,
    volumeMl: last.volumeMl,
    needleGauge: last.needleGauge,
    technique: last.technique,
    date: last.date,
  };
}

export interface RotationRecommendation {
  zone: string;
  reason: 'rest' | 'overuse' | 'infection_risk' | 'pip_risk';
  message: string;
  suggestedZones: string[];
}

export function getRotationRecommendations(entries: InjectionEntry[], restDays: number = 7): RotationRecommendation[] {
  const recommendations: RotationRecommendation[] = [];
  const today = todayLocalStr();
  const usedToday = new Set(entries.filter(e => e.date === today).map(e => e.zone));
  const zoneEntriesMap = new Map<string, InjectionEntry[]>();
  for (const e of entries) {
    const list = zoneEntriesMap.get(e.zone) || [];
    list.push(e);
    zoneEntriesMap.set(e.zone, list);
  }

  for (const zone of INJECTION_ZONES) {
    const zoneEntries = zoneEntriesMap.get(zone.id) || [];
    if (zoneEntries.length === 0) continue;
    const daysSince = getDaysSinceLastInjection(zone.id, entries, today);
    if (daysSince === null) continue;

    if (daysSince >= 14) {
      const available = INJECTION_ZONES.filter(z => z.id !== zone.id && !usedToday.has(z.id));
      recommendations.push({
        zone: zone.id,
        reason: 'rest',
        message: `Зона ${zoneLabel(zone.id)} отдыхала ${daysSince} дней — риск фиброза/липома`,
        suggestedZones: available.slice(0, 3).map(z => z.id),
      });
    } else if (daysSince < restDays) {
      const recentPip = zoneEntries.filter(e => e.date >= localDateDaysAgo(7));
      const avgPip = recentPip.length ? recentPip.reduce((s, e) => s + e.pipLevel, 0) / recentPip.length : 0;
      if (avgPip >= 5) {
        const available = INJECTION_ZONES.filter(z => z.id !== zone.id && !usedToday.has(z.id));
        recommendations.push({
          zone: zone.id,
          reason: 'pip_risk',
          message: `Высокий PIP в ${zoneLabel(zone.id)} (${avgPip.toFixed(1)}/10) — рекомендую смену зоны`,
          suggestedZones: available.slice(0, 3).map(z => z.id),
        });
      }
    }

    const recentInfections = zoneEntries.filter(e => e.date >= localDateDaysAgo(14) && e.redness && e.lump);
    if (recentInfections.length >= 1) {
      recommendations.push({
        zone: zone.id,
        reason: 'infection_risk',
        message: `Признаки инфицирования в ${zoneLabel(zone.id)} — временно избегать`,
        suggestedZones: INJECTION_ZONES.filter(z => z.id !== zone.id && !usedToday.has(z.id)).slice(0, 3).map(z => z.id),
      });
    }
  }

  const weekAgo = localDateDaysAgo(7);
  const zoneFreq = new Map<string, number>();
  for (const e of entries.filter(e => e.date >= weekAgo)) {
    zoneFreq.set(e.zone, (zoneFreq.get(e.zone) || 0) + 1);
  }
  for (const [zone, count] of zoneFreq) {
    if (count >= 3) {
      const available = INJECTION_ZONES.filter(z => z.id !== zone && !usedToday.has(z.id));
      recommendations.push({
        zone,
        reason: 'overuse',
        message: `${count} инъекций в ${zoneLabel(zone)} за 7 дней — требуется ротация`,
        suggestedZones: available.slice(0, 3).map(z => z.id),
      });
    }
  }

  return recommendations.sort((a, b) => {
    const order = { infection_risk: 0, pip_risk: 1, rest: 2, overuse: 3 };
    return (order[a.reason] ?? 99) - (order[b.reason] ?? 99);
  });
}

export function suggestBetterTechnique(zone: string, technique: string, entries: InjectionEntry[]): string | null {
  const matrix = getZoneTechniqueMatrix(entries).filter(m => m.zone === zone);
  if (matrix.length <= 1) return null;
  const current = matrix.find(m => m.technique === technique);
  if (!current || current.count < 2) return null;
  const alternatives = matrix.filter(m => m.technique !== technique && m.count >= 2 && (m.avgPip ?? 10) < (current.avgPip ?? 0));
  if (alternatives.length === 0) return null;
  alternatives.sort((a, b) => (a.avgPip ?? 10) - (b.avgPip ?? 10));
  return alternatives[0].technique;
}

export interface InjectionRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'rotation' | 'technique' | 'schedule' | 'safety' | 'general';
  message: string;
  action?: string;
}

export function getInjectionRecommendations(entries: InjectionEntry[]): InjectionRecommendation[] {
  const recs: InjectionRecommendation[] = [];
  if (!entries.length) {
    recs.push({ priority: 'low', category: 'general', message: 'Начните вести дневник инъекций для персональных рекомендаций', action: 'Добавьте первую запись' });
    return recs;
  }

  const today = todayLocalStr();
  const stats = computeInjectionStats(entries);
  const anomalies = detectInjectionAnomalies(entries);
  const rotationRecs = getRotationRecommendations(entries);
  const trend = getInjectionTrend(entries, 14);

  const highPipZones = new Set<string>();
  const longRestZones = new Set<string>();
  const overusedZones = new Set<string>();
  const infectionZones = new Set<string>();

  for (const r of rotationRecs) {
    if (r.reason === 'pip_risk') highPipZones.add(r.zone);
    if (r.reason === 'rest') longRestZones.add(r.zone);
    if (r.reason === 'overuse') overusedZones.add(r.zone);
    if (r.reason === 'infection_risk') infectionZones.add(r.zone);
  }

  for (const a of anomalies) {
    if (a.category === 'infection') infectionZones.add(a.zone);
    if (a.category === 'pip' && a.severity === 'danger') highPipZones.add('general');
  }

  if (infectionZones.size > 0) {
    recs.push({ priority: 'high', category: 'safety', message: `Признаки инфицирования в ${[...infectionZones].map(z => zoneLabel(z)).join(', ')}`, action: 'Обратитесь к врачу, временно избегайте этих зон' });
  }

  if (stats.complicationRate >= 20) {
    recs.push({ priority: 'high', category: 'safety', message: `Высокий процент осложнений: ${stats.complicationRate}%`, action: 'Проверьте асептику, длину иглы и технику введения' });
  }

  if (highPipZones.size > 0) {
    const zones = [...highPipZones].filter(z => z !== 'general').map(z => zoneLabel(z)).join(', ');
    recs.push({ priority: 'high', category: 'technique', message: `Высокий PIP в зонах: ${zones || 'несколько зон'}`, action: 'Смените зону, используйте более тонкую иглу, рассмотрите subq' });
  }

  if (longRestZones.size > 0) {
    recs.push({ priority: 'medium', category: 'rotation', message: `${longRestZones.size} зон не использовались ≥14 дней`, action: 'Верните эти зоны в ротацию для предотвращения фиброза' });
  }

  if (overusedZones.size > 0) {
    recs.push({ priority: 'medium', category: 'rotation', message: `${overusedZones.size} зон переиспользуются (>3 инъекций/нед)`, action: 'Распределите нагрузку на реже используемые зоны' });
  }

  if (trend && trend.direction === 'up' && (trend.avgPip ?? 0) > 3) {
    recs.push({ priority: 'medium', category: 'technique', message: 'Тренд PIP растёт', action: 'Пересмотрите длину/калибр иглы, скорость введения, расположение' });
  }

  const zoneEntriesMap = new Map<string, InjectionEntry[]>();
  for (const e of entries) {
    const list = zoneEntriesMap.get(e.zone) || [];
    list.push(e);
    zoneEntriesMap.set(e.zone, list);
  }

  for (const zone of INJECTION_ZONES) {
    const zoneEntries = zoneEntriesMap.get(zone.id) || [];
    if (zoneEntries.length < 2) continue;
    const better = suggestBetterTechnique(zone.id, zoneEntries[0].technique, entries);
    if (better) {
      recs.push({ priority: 'low', category: 'technique', message: `В ${zoneLabel(zone.id)} техника ${techniqueLabel(zoneEntries[0].technique)} даёт высокий PIP`, action: `Попробуйте ${techniqueLabel(better)}` });
    }
  }

  const todayEntries = entries.filter(e => e.date === today);
  if (todayEntries.length >= 3) {
    recs.push({ priority: 'medium', category: 'schedule', message: `${todayEntries.length} инъекций сегодня — высокая нагрузка`, action: 'Рассмотрите распределение по нескольким дням' });
  }

  if (entries.length >= 30) {
    const uniqueZones = new Set(entries.map(e => e.zone)).size;
    if (uniqueZones < 4) {
      recs.push({ priority: 'low', category: 'rotation', message: `Используются только ${uniqueZones} зон из ${INJECTION_ZONES.length}`, action: 'Расширьте ротацию для равномерной нагрузки' });
    }
  }

  if (stats.avgPain && stats.avgPain >= 4) {
    recs.push({ priority: 'medium', category: 'technique', message: `Средняя боль при введении: ${stats.avgPain}/10`, action: 'Используйте более тонкую иглу, вводите медленнее, рассмотрите подкожный способ' });
  }

  if (recs.length === 0) {
    recs.push({ priority: 'low', category: 'general', message: 'Осложнений не выявлено, техника инъекций адекватная', action: 'Продолжайте следить за ротацией зон' });
  }

  return recs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] ?? 99) - (order[b.priority] ?? 99);
  });
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
    fever: false,
    notes: legacy.notes,
  };
}

export function migrateAllLegacyEntries(): InjectionEntry[] {
  let raw: any[];
  try {
    const rawJson = localStorage.getItem(STORAGE_KEY);
    raw = rawJson ? JSON.parse(rawJson) : [];
    if (!Array.isArray(raw)) raw = [];
  } catch { raw = []; }
  const migrated: InjectionEntry[] = [];
  for (const entry of raw) {
    if ((entry as any).zone && (entry as any).painLevel !== undefined) {
      migrated.push(entry as InjectionEntry);
    } else {
      migrated.push(migrateLegacyEntry(entry as any));
    }
  }
  if (migrated.some((e, i) => e !== raw[i])) {
    writeStorage(migrated);
  }
  return migrated;
}

export interface InjectionTechniqueAdvice {
  zoneId: string;
  needleGauge: string;
  needleLength: string;
  angle: string;
  maxVolumeMl: number;
  solutionType: string;
  difficulty: string;
  risk: string;
  warnings: string[];
  tips: string[];
}

const ZONE_TECHNIQUE: Record<string, InjectionTechniqueAdvice> = {
  glute_dorsal: {
    zoneId: 'glute_dorsal',
    needleGauge: '21-23G',
    needleLength: '1.5" (38 мм)',
    angle: '90°',
    maxVolumeMl: 5,
    solutionType: 'любой',
    difficulty: '⭐',
    risk: 'Низкий',
    warnings: ['Только верхне-наружный квадрант', 'Нижние квадранты опасны (седалищный нерв)'],
    tips: ['Лягте на бок, верхнюю ногу согните', 'Если объём >3 мл — разделите на 2 инъекции'],
  },
  glute_ventral: {
    zoneId: 'glute_ventral',
    needleGauge: '21-23G',
    needleLength: '1.5" (38 мм)',
    angle: '90°',
    maxVolumeMl: 4,
    solutionType: 'любой',
    difficulty: '⭐⭐',
    risk: 'Низкий',
    warnings: ['V-метод: сместите кожу в сторону перед вколом'],
    tips: ['Меньше жировой прослойки чем дорсальная', 'При боли >2 дней — проверьте технику'],
  },
  quadriceps_l: {
    zoneId: 'quadriceps_l',
    needleGauge: '23-25G',
    needleLength: '1" (25 мм)',
    angle: '90°',
    maxVolumeMl: 3,
    solutionType: 'любой',
    difficulty: '⭐',
    risk: 'Средний',
    warnings: ['Только латеральная поверхность', 'Передняя — бедренный нерв', 'Внутренняя — бедренная артерия'],
    tips: ['Сядьте, вытяните ногу, средняя треть латеральной поверхности', 'Не колоть в день тренировки ног'],
  },
  quadriceps_r: {
    zoneId: 'quadriceps_r',
    needleGauge: '23-25G',
    needleLength: '1" (25 мм)',
    angle: '90°',
    maxVolumeMl: 3,
    solutionType: 'любой',
    difficulty: '⭐',
    risk: 'Средний',
    warnings: ['Только латеральная поверхность', 'Передняя — бедренный нерв', 'Внутренняя — бедренная артерия'],
    tips: ['Сядьте, вытяните ногу, средняя треть латеральной поверхности', 'Не колоть в день тренировки ног'],
  },
  deltoid_l: {
    zoneId: 'deltoid_l',
    needleGauge: '25-27G',
    needleLength: '5/8"-1" (16-25 мм)',
    angle: '90°',
    maxVolumeMl: 2,
    solutionType: 'любой',
    difficulty: '⭐',
    risk: 'Средний',
    warnings: ['2-3 пальца ниже акромиона', 'Тонкая игла обязательна'],
    tips: ['Не колоть в день тренировки плеч', 'При перекачанных дельтах可能需要 игла 1"'],
  },
  deltoid_r: {
    zoneId: 'deltoid_r',
    needleGauge: '25-27G',
    needleLength: '5/8"-1" (16-25 мм)',
    angle: '90°',
    maxVolumeMl: 2,
    solutionType: 'любой',
    difficulty: '⭐',
    risk: 'Средний',
    warnings: ['2-3 пальца ниже акромиона', 'Тонкая игла обязательна'],
    tips: ['Не колоть в день тренировки плеч', 'При перекачанных дельтах可能需要 игла 1"'],
  },
  pectoral_l: {
    zoneId: 'pectoral_l',
    needleGauge: '25-27G',
    needleLength: '5/8" (16 мм)',
    angle: '90°',
    maxVolumeMl: 1.5,
    solutionType: 'водный',
    difficulty: '⭐⭐',
    risk: 'Высокий',
    warnings: ['Только верхне-наружная часть', 'Не нижняя треть (гинекомастия)', 'Не средняя линия (сердце)', 'Не глубже 1.5 см'],
    tips: ['Только водные растворы', 'Локальная инъекция, не для системных курсов', 'Высокий риск гематом'],
  },
  pectoral_r: {
    zoneId: 'pectoral_r',
    needleGauge: '25-27G',
    needleLength: '5/8" (16 мм)',
    angle: '90°',
    maxVolumeMl: 1.5,
    solutionType: 'водный',
    difficulty: '⭐⭐',
    risk: 'Высокий',
    warnings: ['Только верхне-наружная часть', 'Не нижняя треть (гинекомастия)', 'Не средняя линия (сердце)', 'Не глубже 1.5 см'],
    tips: ['Только водные растворы', 'Локальная инъекция, не для системных курсов', 'Высокий риск гематом'],
  },
  triceps_l: {
    zoneId: 'triceps_l',
    needleGauge: '25-27G',
    needleLength: '5/8" (16 мм)',
    angle: '90°',
    maxVolumeMl: 1.5,
    solutionType: 'водный',
    difficulty: '⭐⭐',
    risk: 'Средний',
    warnings: ['Строго наружная поверхность', 'Лучевой нерв проходит внутри'],
    tips: ['Согните руку в локте 90°, упритесь локтем в колено', 'Масляные растворы — осторожно, склонность к PIP'],
  },
  triceps_r: {
    zoneId: 'triceps_r',
    needleGauge: '25-27G',
    needleLength: '5/8" (16 мм)',
    angle: '90°',
    maxVolumeMl: 1.5,
    solutionType: 'водный',
    difficulty: '⭐⭐',
    risk: 'Средний',
    warnings: ['Строго наружная поверхность', 'Лучевой нерв проходит внутри'],
    tips: ['Согните руку в локте 90°, упритесь локтем в колено', 'Масляные растворы — осторожно, склонность к PIP'],
  },
  biceps_l: {
    zoneId: 'biceps_l',
    needleGauge: '27-29G',
    needleLength: '1/2" (13 мм)',
    angle: '90°',
    maxVolumeMl: 1,
    solutionType: 'водный',
    difficulty: '⭐⭐⭐',
    risk: 'Очень высокий',
    warnings: ['ОЧЕНЬ ОПАСНО', 'Маленький объём мышцы, много нервов и сосудов', 'Попадание в срединный нерв = паралич'],
    tips: ['ТОЛЬКО водные препараты', 'НЕ ДЛЯ НАЧИНАЮЩИХ', 'При онемении — немедленно извлечь'],
  },
  biceps_r: {
    zoneId: 'biceps_r',
    needleGauge: '27-29G',
    needleLength: '1/2" (13 мм)',
    angle: '90°',
    maxVolumeMl: 1,
    solutionType: 'водный',
    difficulty: '⭐⭐⭐',
    risk: 'Очень высокий',
    warnings: ['ОЧЕНЬ ОПАСНО', 'Маленький объём мышцы, много нервов и сосудов', 'Попадание в срединный нерв = паралич'],
    tips: ['ТОЛЬКО водные препараты', 'НЕ ДЛЯ НАЧИНАЮЩИХ', 'При онемении — немедленно извлечь'],
  },
  calves_l: {
    zoneId: 'calves_l',
    needleGauge: '25-27G',
    needleLength: '5/8" (16 мм)',
    angle: '90°',
    maxVolumeMl: 1,
    solutionType: 'водный',
    difficulty: '⭐⭐⭐',
    risk: 'Очень высокий',
    warnings: ['Самая болезненная зона', 'Масляные растворы ВЫЗЫВАЮТ СИЛЬНУЮ БОЛЬ', 'Риск компартмент-синдрома'],
    tips: ['ТОЛЬКО водные препараты', 'При нарастающей боли — немедленно к врачу', 'Никогда не используйте масляные в икры'],
  },
  calves_r: {
    zoneId: 'calves_r',
    needleGauge: '25-27G',
    needleLength: '5/8" (16 мм)',
    angle: '90°',
    maxVolumeMl: 1,
    solutionType: 'водный',
    difficulty: '⭐⭐⭐',
    risk: 'Очень высокий',
    warnings: ['Самая болезненная зона', 'Масляные растворы ВЫЗЫВАЮТ СИЛЬНУЮ БОЛЬ', 'Риск компартмент-синдрома'],
    tips: ['ТОЛЬКО водные препараты', 'При нарастающей боли — немедленно к врачу', 'Никогда не используйте масляные в икры'],
  },
  abdominal: {
    zoneId: 'abdominal',
    needleGauge: '29-31G',
    needleLength: '5/16"-1/2" (8-13 мм)',
    angle: '45° (кожная складка) или 90° (короткая игла)',
    maxVolumeMl: 1.5,
    solutionType: 'водный',
    difficulty: '⭐',
    risk: 'Низкий',
    warnings: ['5 см от пупка', 'Не в области пупка', 'Ротация: минимум 4 зоны, расстояние >2 см'],
    tips: ['Соберите кожу в складку', 'Идеально для самостоятельных инъекций', 'Идеально для пептидов/HCG/инсулина'],
  },
};

export function getZoneTechniqueAdvice(zoneId: string): InjectionTechniqueAdvice | null {
  return ZONE_TECHNIQUE[zoneId] || null;
}

export function getSubstanceInjectionAdvice(substance: string): { technique: string; needle: string; notes: string } | null {
  const s = substance.toLowerCase();
  if (s.includes('bpc') || s.includes('tb-500') || s.includes('tb500') || s.includes('ghrp') || s.includes('ipamorelin') || s.includes('cjc') || s.includes('tesamorelin') || s.includes('sermorelin') || s.includes('грип') || s.includes('грипа')) {
    return { technique: 'п/к', needle: '29-31G × 5/16"-1/2" (8-13 мм)', notes: 'Пептиды/GHRP — подкожно. Живот или бедро. 45° угол или 90° с короткой иглой.' };
  }
  if (s.includes('somatropin') || s.includes('гормон роста') || s.includes('gh ') || s.includes('hgh')) {
    return { technique: 'п/к или в/м', needle: '29-31G × 5/16"-1/2"', notes: 'GH — подкожно или внутримышечно. Утро натощак или перед сном. Разделить на 2 инъекции при >3 МЕ.' };
  }
  if (s.includes('hcgon') || s.includes('hcg')) {
    return { technique: 'п/к или в/м', needle: '25-27G × 5/8"', notes: 'HCG — подкожно или внутримышечно. 2×/нед во время ПКТ или на курсе.' };
  }
  if (s.includes('igf') || s.includes('лр3') || s.includes('lr3')) {
    return { technique: 'п/к или в/м', needle: '29-31G × 5/16"-1/2"', notes: 'IGF-1 LR3 — подкожно или внутримышечно. 2-3 инъекции в день. Контроль глюкозы!' };
  }
  if (s.includes('peg-mgf') || s.includes('мгф')) {
    return { technique: 'в/м', needle: '25-27G × 5/8"', notes: 'PEG-MGF — внутримышечно. 1-2×/нед. После тренировки в целевую мышцу.' };
  }
  if (s.includes('cerebrolysin') || s.includes('церебролизин')) {
    return { technique: 'в/в капельно', needle: 'по назначению врача', notes: 'Только в стационаре. 10-30 мл в/в капельно 10-20 дней.' };
  }
  if (s.includes('pinealon') || s.includes('пинеалон')) {
    return { technique: 'в/м', needle: '27-29G × 1/2"', notes: '1-2 мл в/м ×10 дней. Курс 10-20 дней.' };
  }
  if (s.includes('epitalon') || s.includes('эпиталон')) {
    return { technique: 'в/м', needle: '27-29G × 1/2"', notes: '5-10 мг в/м 10-20 дней. Курс 10-20 дней.' };
  }
  if (s.includes('thymalin') || s.includes('тимлин') || s.includes('thymogen')) {
    return { technique: 'в/м', needle: '27-29G × 1/2"', notes: '5-10 мг в/м 5-10 дней. 1-2×/год.' };
  }
  if (s.includes('ta-1') || s.includes('та-1') || s.includes('thymosin')) {
    return { technique: 'п/к', needle: '29-31G × 5/16"-1/2"', notes: '1.6 мг п/к 2-4 нед. Противовирусный + противоопухолевый.' };
  }
  if (s.includes('semax') || s.includes('семакс')) {
    return { technique: 'интраназально', needle: 'капли', notes: '200-600 мкг интраназально 1-2/сут. Курс 10-14 дней.' };
  }
  if (s.includes('адреналин') || s.includes('epinephrine')) {
    return { technique: 'в/м', needle: 'по назначению', notes: '0.3-0.5 мг в/м (1:1000) в передне-боковую поверхность бедра. Через одежду. При анафилаксии.' };
  }
  if (s.includes('глюкагон')) {
    return { technique: 'в/м', needle: 'по назначению', notes: '1 мг в/м. При гипогликемии без сознания.' };
  }
  if (s.includes('эссенциале') || s.includes('фосфатидилхолин')) {
    return { technique: 'в/в', needle: 'по назначению', notes: '5-10 мл/день в/в. Курс 10-14 дней. При АЛТ >5x ВГН.' };
  }
  if (s.includes('гептрал') || s.includes('ademetionine') || s.includes('s-аденозилметионин')) {
    return { technique: 'в/в', needle: 'по назначению', notes: '400-800 мг/день в/в. Курс 14-21 день. При холестазе.' };
  }
  if (s.includes('витамин c') || s.includes('аскорбат')) {
    return { technique: 'в/в капельно', needle: 'по назначению', notes: '10-15 г в/в капельно. При пневмонии/тяжёлой инфекции.' };
  }
  if (s.includes('магний') && (s.includes('в/в') || s.includes('infusion') || s.includes('капельно'))) {
    return { technique: 'в/в', needle: 'по назначению', notes: 'MgSO₄ в/в. При гипомагниемии <0.65 ммоль/л.' };
  }
  if (s.includes('омепразол') || s.includes('ипп')) {
    return { technique: 'в/в болюс', needle: 'по назначению', notes: '40-80 мг в/в болюс. При кровотечении из ЖКТ.' };
  }
  if (s.includes('фуросемид') || s.includes('лазикс')) {
    return { technique: 'в/в', needle: 'по назначению', notes: '40-80 мг в/в. При отёке лёгких.' };
  }
  if (s.includes('эноксапарин') || s.includes('нмг') || s.includes('клексан')) {
    return { technique: 'п/к', needle: 'по назначению', notes: '1 мг/кг 2×/день п/к. При ТЭЛА.' };
  }
  if (s.includes('триамцинолон') || s.includes('кеналог')) {
    return { technique: 'внутриочагово', needle: 'по назначению', notes: 'Только дерматолог. В кисты/узлы акне.' };
  }
  if (s.includes('семаглутид') || s.includes('семagl') || s.includes('лираглутид') || s.includes('оземпик') || s.includes('виктоза') || s.includes('саксенда')) {
    return { technique: 'п/к', needle: '29-31G × 5/16"-1/2"', notes: 'GLP-1 агонисты — подкожно. Живот или бедро. 1×/нед или ежедневно.' };
  }
  if (s.includes('инсулин')) {
    return { technique: 'п/к', needle: '29-31G × 5/16"-1/2"', notes: 'Подкожно. Живот, бедро, плечо. Ротация критична. 45° или 90° с короткой иглой.' };
  }
  return null;
}
