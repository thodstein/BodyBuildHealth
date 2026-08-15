/**
 * hr-diary.engine.ts — Дневник ЧСС (he_hr_diary).
 * Записи: одна на (дата + время суток) — максимум 2 в день (утро/вечер).
 * Используется в утреннем/вечернем рутинге профиля.
 */
import { readDiaryEntries, saveDiaryEntries } from './diary-storage';

export const HR_DIARY_KEY = 'he_hr_diary';
export const HR_CAP = 730;

export interface HREntry {
  id: string;
  date: string;
  timeOfDay: 'morning' | 'evening';
  bpm: number;
  notes?: string;
  createdAt?: string;
}

export function todayLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalize(raw: unknown): HREntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.date !== 'string' || !e.date) return null;
  const bpm = Number(e.bpm);
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 250) return null;
  const timeOfDay = e.timeOfDay === 'evening' ? 'evening' : 'morning';
  return {
    id: typeof e.id === 'string' && e.id ? e.id : `hr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: e.date,
    timeOfDay,
    bpm: Math.round(bpm),
    notes: typeof e.notes === 'string' && e.notes ? e.notes : undefined,
    createdAt: typeof e.createdAt === 'string' ? e.createdAt : undefined,
  };
}

export function getHREntries(): HREntry[] {
  return readDiaryEntries<HREntry>(HR_DIARY_KEY)
    .map(normalize)
    .filter((e): e is HREntry => e !== null)
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate !== 0) return byDate;
      // В один день утро идёт первым (DESC-порядок «новейшее сверху»).
      return (a.timeOfDay === 'morning' ? 0 : 1) - (b.timeOfDay === 'morning' ? 0 : 1);
    });
}

export interface HRSaveInput {
  date: string;
  timeOfDay: 'morning' | 'evening';
  bpm: number;
  notes?: string;
}

function write(entries: HREntry[]): HREntry[] {
  saveDiaryEntries(HR_DIARY_KEY, entries, HR_CAP);
  return getHREntries();
}

/** Добавление/обновление записи (дедуп по date+timeOfDay). */
export function saveHREntry(input: HRSaveInput): HREntry[] {
  const entries = getHREntries();
  const clean: HREntry = {
    id: '',
    date: input.date,
    timeOfDay: input.timeOfDay,
    bpm: Math.round(input.bpm),
    notes: input.notes?.trim() || undefined,
  };
  const existing = entries.find((e) => e.date === input.date && e.timeOfDay === input.timeOfDay);
  clean.id = existing?.id || `hr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  clean.createdAt = existing?.createdAt || new Date().toISOString();
  const rest = entries.filter((e) => !(e.date === input.date && e.timeOfDay === input.timeOfDay));
  return write([clean, ...rest]);
}

export function updateHREntry(id: string, patch: Partial<HRSaveInput>): HREntry[] {
  const entries = getHREntries();
  const target = entries.find((e) => e.id === id);
  if (!target) return entries;
  const updated: HREntry = { ...target, ...patch, bpm: Math.round(Number(patch.bpm) || target.bpm) };
  // Смена времени суток/даты может пересечься с существующей записью — удаляем её.
  const rest = entries.filter((e) => !(e.id === id) && !(e.date === updated.date && e.timeOfDay === updated.timeOfDay));
  return write([updated, ...rest]);
}

export function deleteHREntry(id: string): HREntry[] {
  return write(getHREntries().filter((e) => e.id !== id));
}

export function clearHRDiary(): HREntry[] {
  return write([]);
}

export function replaceHRDiary(entries: HREntry[]): HREntry[] {
  return write(entries);
}

/** Запись за дату+время суток (для баннера «уже есть»). */
export function findByDateAndTimeOfDay(entries: HREntry[], date: string, timeOfDay: 'morning' | 'evening'): HREntry | undefined {
  return entries.find((e) => e.date === date && e.timeOfDay === timeOfDay);
}

/** Средние ЧСС за период (отдельно утро/вечер). */
export function getHRAverages(entries: HREntry[], days = 7): {
  morning: { avg: number | null; count: number };
  evening: { avg: number | null; count: number };
  resting: { avg: number | null; count: number };
} {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  const inWindow = entries.filter((e) => e.date >= cutoffStr);
  const avg = (list: HREntry[]) => {
    if (!list.length) return null;
    return Math.round(list.reduce((s, e) => s + e.bpm, 0) / list.length);
  };
  const morning = inWindow.filter((e) => e.timeOfDay === 'morning');
  const evening = inWindow.filter((e) => e.timeOfDay === 'evening');
  return {
    morning: { avg: avg(morning), count: morning.length },
    evening: { avg: avg(evening), count: evening.length },
    resting: { avg: avg(inWindow), count: inWindow.length },
  };
}

/** Аномалии: тахикардия/брадикардия относительно порогов. */
export function detectHRAnomalies(entries: HREntry[]): { date: string; severity: 'warn' | 'danger'; message: string }[] {
  const issues: { date: string; severity: 'warn' | 'danger'; message: string }[] = [];
  for (const e of entries) {
    if (e.bpm >= 120) issues.push({ date: e.date, severity: 'danger', message: `ЧСС ${e.bpm} (${e.timeOfDay === 'morning' ? 'утро' : 'вечер'}) — тахикардия, проверьте состояние` });
    else if (e.bpm >= 100) issues.push({ date: e.date, severity: 'warn', message: `ЧСС ${e.bpm} (${e.timeOfDay === 'morning' ? 'утро' : 'вечер'}) — выше нормы` });
    if (e.bpm <= 40) issues.push({ date: e.date, severity: 'warn', message: `ЧСС ${e.bpm} (${e.timeOfDay === 'morning' ? 'утро' : 'вечер'}) — брадикардия (у спортсменов может быть нормой)` });
  }
  return issues.sort((a, b) => b.date.localeCompare(a.date));
}

/** Тренд утреннего ЧСС: последние 7 дней vs предыдущие 7. */
export function getHRTrend(entries: HREntry[]): { direction: 'up' | 'down' | 'stable'; delta: number | null } | null {
  const mornings = entries.filter((e) => e.timeOfDay === 'morning').sort((a, b) => a.date.localeCompare(b.date));
  if (mornings.length < 2) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  const recent = mornings.filter((e) => e.date >= cutoffStr);
  const older = mornings.filter((e) => e.date < cutoffStr).slice(-7);
  if (!recent.length || !older.length) return null;
  const avg = (list: HREntry[]) => list.reduce((s, e) => s + e.bpm, 0) / list.length;
  const delta = avg(recent) - avg(older);
  return { direction: delta > 2 ? 'up' : delta < -2 ? 'down' : 'stable', delta: Math.round(delta * 10) / 10 };
}
