/**
 * coach-athlete-snapshot.engine.ts — что тренер видит об атлете, не заходя в его данные.
 *
 * ЗАЧЕМ. Раньше «сводка» на карточке строилась по ручному журналу тренера, а
 * реальные тренировки лежали в базе атлета. Тренер узнавал «тренировался ли он»,
 * только зайдя в чужое пространство и полистав дневник.
 *
 * ОТКУДА ДАННЫЕ (только существующие источники, без выдумок):
 *  • IndexedDB пространства: `training_log` (подходы/даты) и `workout_log`;
 *  • localStorage пространства: `he_weight_log`, `he_checkin_latest`, ключи программ.
 *
 * ЧЕГО ЗДЕСЬ НЕТ: медицинских норм, «плохих» и «хороших» значений, порогов
 * «мало/много». Только факты: сколько, когда, сколько дней назад, есть ли план.
 * Единственный вывод «требует внимания» — тоже факт: нет плана или нет ни одной
 * записи (тогда тренеру нечего смотреть, и это надо сказать, а не показать нули).
 */
import { MANUAL_STORAGE_KEYS } from '../manual-constructor/manual-storage';

/** Ключи localStorage пространства, которые нужны сводке. */
export const SNAPSHOT_LOCAL_KEYS = [
  'he_weight_log',
  'he_checkin_latest',
  MANUAL_STORAGE_KEYS.PL_MACRO,
  MANUAL_STORAGE_KEYS.BB_MACRO,
  MANUAL_STORAGE_KEYS.MACROCYCLE_DESIGNS,
  MANUAL_STORAGE_KEYS.USER_PROGRAMS,
  MANUAL_STORAGE_KEYS.PROGRAM_FAV,
] as const;

export interface AthleteSnapshot {
  spaceId: string;
  /** Дата последней тренировки `YYYY-MM-DD` (по дневнику) или null. */
  lastTrainingDate: string | null;
  /** Сколько дней назад была последняя тренировка; null — тренировок в дневнике нет. */
  daysSinceTraining: number | null;
  sessions7: number;
  sessions28: number;
  /**
   * Уникальные даты тренировок по возрастанию (`YYYY-MM-DD`). Нужны выполнению
   * недели и отчётам; ограничены последними 400, чтобы карточка не таскала всю
   * историю за годы.
   */
  sessionDates: string[];
  /** Тоннаж за окно, кг (сумма вес × повторы). 0 — записи есть, чисел нет. */
  tonnage7: number;
  tonnage28: number;
  lastWeight: { date: string; kg: number } | null;
  /** Разница с предыдущим взвешиванием, кг. Факт, не оценка. */
  weightTrendKg: number | null;
  lastCheckin: string | null;
  /** Какие программные ключи реально заполнены. */
  planKeys: string[];
  hasPlan: boolean;
  /** Есть ли в пространстве хоть какие-то данные (иначе честное «нет данных»). */
  hasAnyData: boolean;
  /** Причины, по которым тренеру стоит посмотреть карточку. Только факты. */
  attention: string[];
  needsAttention: boolean;
}

export interface SnapshotInput {
  spaceId: string;
  /** Сторы базы пространства (`readSpaceStores`); отсутствие ключа = пусто. */
  stores: Record<string, unknown[]>;
  /** Чтение логического ключа пространства. */
  readKey: (logicalKey: string) => string | null;
  /** Сегодняшняя дата `YYYY-MM-DD` (передаётся, чтобы тесты были детерминированными). */
  today: string;
}

const DAY_MS = 86_400_000;

const isoDay = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
};

const dayNumber = (iso: string): number | null => {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(t) ? Math.floor(t / DAY_MS) : null;
};

const daysBetween = (from: string, to: string): number | null => {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a == null || b == null ? null : b - a;
};

const finite = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

interface SessionFact {
  date: string;
  tonnage: number;
}

/** Тренировки из `training_log` (по упражнениям) или `workout_log` (по сессиям). */
export function readSessions(stores: Record<string, unknown[]>): SessionFact[] {
  const rows = Array.isArray(stores.training_log) ? stores.training_log : [];
  const out: SessionFact[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const date = isoDay(row.date);
    if (!date) continue;
    let tonnage = finite(row.totalVolume) ?? 0;
    if (!tonnage && Array.isArray(row.sets)) {
      for (const s of row.sets) {
        const set = (s ?? {}) as Record<string, unknown>;
        const w = finite(set.weight);
        const r = finite(set.reps);
        if (w != null && r != null && w > 0 && r > 0) tonnage += w * r;
      }
    }
    out.push({ date, tonnage: Math.max(0, Math.round(tonnage)) });
  }
  if (out.length) return out;

  // Старый формат: сессия целиком с вложенными упражнениями.
  const workouts = Array.isArray(stores.workout_log) ? stores.workout_log : [];
  for (const raw of workouts) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const date = isoDay(row.date);
    if (!date) continue;
    let tonnage = 0;
    const exercises = Array.isArray(row.exercises) ? row.exercises : [];
    for (const e of exercises) {
      const ex = (e ?? {}) as Record<string, unknown>;
      const vol = finite(ex.totalVolume);
      if (vol != null && vol > 0) {
        tonnage += vol;
        continue;
      }
      if (!Array.isArray(ex.sets)) continue;
      for (const s of ex.sets) {
        const set = (s ?? {}) as Record<string, unknown>;
        const w = finite(set.weight);
        const r = finite(set.reps);
        if (w != null && r != null && w > 0 && r > 0) tonnage += w * r;
      }
    }
    out.push({ date, tonnage: Math.max(0, Math.round(tonnage)) });
  }
  return out;
}

/** `he_weight_log` = [{ date, weight }]. Терпимо к мусору. */
export function readWeights(readKey: SnapshotInput['readKey']): { date: string; kg: number }[] {
  const raw = readKey('he_weight_log');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: { date: string; kg: number }[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const date = isoDay(r.date);
      const kg = finite(r.weight);
      if (!date || kg == null || kg <= 0) continue;
      out.push({ date, kg: Math.round(kg * 10) / 10 });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  } catch {
    return [];
  }
}

/** Заполнен ли ключ программы: `{}`/`[]`/`null` — не программа. */
function filledJson(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null) return false;
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (typeof parsed === 'object') return Object.keys(parsed as object).length > 0;
    return false;
  } catch {
    return false;
  }
}

export function buildAthleteSnapshot(input: SnapshotInput): AthleteSnapshot {
  const { stores, readKey, today, spaceId } = input;
  const sessions = readSessions(stores);
  const weights = readWeights(readKey);
  const lastWeight = weights.length ? weights[weights.length - 1] : null;
  const prevWeight = weights.length > 1 ? weights[weights.length - 2] : null;

  const days = [...new Set(sessions.map(s => s.date))].sort();
  const lastTrainingDate = days.length ? days[days.length - 1] : null;
  const daysSinceTraining = lastTrainingDate ? Math.max(0, daysBetween(lastTrainingDate, today) ?? 0) : null;

  let sessions7 = 0;
  let sessions28 = 0;
  let tonnage7 = 0;
  let tonnage28 = 0;
  const seen7 = new Set<string>();
  const seen28 = new Set<string>();
  for (const s of sessions) {
    const back = daysBetween(s.date, today);
    if (back == null || back < 0) continue; // будущее не считаем за факт
    if (back < 7) {
      if (!seen7.has(s.date)) { seen7.add(s.date); sessions7++; }
      tonnage7 += s.tonnage;
    }
    if (back < 28) {
      if (!seen28.has(s.date)) { seen28.add(s.date); sessions28++; }
      tonnage28 += s.tonnage;
    }
  }

  const planKeys = SNAPSHOT_LOCAL_KEYS.filter(k => {
    if (k === 'he_weight_log' || k === 'he_checkin_latest') return false;
    return filledJson(readKey(k));
  });

  let lastCheckin: string | null = null;
  const checkinRaw = readKey('he_checkin_latest');
  if (checkinRaw) {
    try {
      const c = JSON.parse(checkinRaw) as Record<string, unknown>;
      lastCheckin = isoDay(c?.date);
    } catch {
      lastCheckin = null;
    }
  }

  const hasPlan = planKeys.length > 0;
  const hasTraining = sessions.length > 0;
  const hasAnyData = hasTraining || weights.length > 0 || lastCheckin != null || hasPlan;

  const attention: string[] = [];
  if (!hasPlan) attention.push('нет сохранённой программы');
  if (!hasTraining) attention.push('нет тренировок в дневнике');

  return {
    spaceId,
    lastTrainingDate,
    daysSinceTraining,
    sessions7,
    sessions28,
    sessionDates: days.slice(-400),
    tonnage7: Math.round(tonnage7),
    tonnage28: Math.round(tonnage28),
    lastWeight,
    weightTrendKg:
      lastWeight && prevWeight ? Math.round((lastWeight.kg - prevWeight.kg) * 10) / 10 : null,
    lastCheckin,
    planKeys,
    hasPlan,
    hasAnyData,
    attention,
    needsAttention: attention.length > 0,
  };
}

/** Числа для карточки: без «норм», только читаемые факты. */
export function snapshotLine(s: AthleteSnapshot | undefined): string {
  if (!s) return '';
  if (!s.hasAnyData) return 'нет данных в приложении';
  const parts: string[] = [];
  if (s.daysSinceTraining == null) parts.push('тренировок нет');
  else if (s.daysSinceTraining === 0) parts.push('тренировка сегодня');
  else parts.push(`последняя ${s.daysSinceTraining} дн. назад`);
  if (s.sessions28 > 0) parts.push(`${s.sessions7} за 7 дн. / ${s.sessions28} за 28 дн.`);
  if (s.tonnage7 > 0) parts.push(`объём 7 дн.: ${formatKg(s.tonnage7)}`);
  if (s.lastWeight) {
    const trend = s.weightTrendKg == null ? '' : ` (${s.weightTrendKg > 0 ? '+' : ''}${s.weightTrendKg})`;
    parts.push(`вес ${String(s.lastWeight.kg).replace('.', ',')} кг${trend}`);
  }
  parts.push(s.hasPlan ? 'план есть' : 'плана нет');
  return parts.join(' · ');
}

/** 12 400 кг → «12,4 т». Тонны — чтобы строка на телефоне не распухала. */
export function formatKg(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return '0';
  if (kg < 1000) return `${Math.round(kg)} кг`;
  return `${(kg / 1000).toFixed(1).replace('.', ',')} т`;
}
