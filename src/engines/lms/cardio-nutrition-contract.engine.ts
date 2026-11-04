/**
 * cardio-nutrition-contract.engine.ts — РЕАЛЬНЫЙ контракт «кардио → питание».
 *
 * Аудит 2026-11 (P1): TrainingScreen писал `he_cardio_kcal_note`
 * (`cycleId`, `avgKcalPerWeek`, `avgMinutesPerWeek`), но НИКТО не читал ключ —
 * заметка была мёртвой записью, а питание считало «расход» по грубому
 * `trainType`. Здесь один источник контракта:
 *
 *   weeklyKcal  — средний расход плана за рабочую неделю (ккал);
 *   todayKcal   — факт из журнала за сегодня (0, если не записано);
 *   confidence  — 0..1, насколько верить цифре (журнал > план);
 *   include     — переключатель пользователя «учитывать кардио в питании»;
 *   text        — человекочитаемая строка для вставки.
 *
 * Пишет `saveCardioKcalContract`, читает `loadCardioKcalContract`. Модуль
 * питания обязан вызывать читатель и подписывать «включая кардио (оценка)»,
 * а не выводить расход из типа тренировки.
 */
import { cardioToNutritionPayload, type CardioCycle } from './cardio.engine';
import { loadCardioLog, cardioLogStats, type CardioLogEntry } from './cardio-diary.engine';
import { todayLocalIso } from './cardio-date-utils.engine';

export const CARDIO_KCAL_NOTE_KEY = 'he_cardio_kcal_note';

export interface CardioKcalContract {
  cycleId: string;
  /** Средний расход плана за неделю, ккал (по рабочим неделям). */
  weeklyKcal: number;
  /** Средний плановый объём, мин/нед. */
  weeklyMinutes: number;
  /** Факт за сегодня из журнала, ккал. */
  todayKcal: number;
  /** Факт за сегодня, мин. */
  todayMinutes: number;
  /** 0..1: насколько верить оценке. */
  confidence: number;
  /** На чём посчитано: план цикла или фактический журнал. */
  basis: 'plan' | 'log';
  /** Пользователь может выключить учёт кардио в питании. */
  include: boolean;
  updatedAt: string;
  text: string;
  /**
   * @deprecated Легаси-имена (до контракта ноябрь-2026). Оставляем в записи,
   * чтобы уже написанный код питания не потерял цифру после перехода.
   */
  avgKcalPerWeek?: number;
  /** @deprecated см. avgKcalPerWeek. */
  avgMinutesPerWeek?: number;
}

/** Уверенность в цифре: журнал за 28 дней важнее плана. */
function confidenceOf(log: CardioLogEntry[], nowIso: string): { confidence: number; basis: 'plan' | 'log' } {
  const stats = cardioLogStats(log, 28, nowIso);
  if (stats.sessions === 0) return { confidence: 0.35, basis: 'plan' };
  // 4+ записи и охват >= 14 дней — статистика уже информативна.
  const dates = log
    .filter(e => e.completed && e.durationMin > 0 && e.date <= nowIso)
    .map(e => e.date)
    .sort();
  const spanDays = dates.length > 1
    ? Math.round((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000)
    : 0;
  if (stats.sessions >= 4 && spanDays >= 14) return { confidence: 0.85, basis: 'log' };
  return { confidence: 0.6, basis: 'log' };
}

export function buildCardioKcalContract(
  cycle: CardioCycle,
  log: CardioLogEntry[] = loadCardioLog(),
  referenceIso?: string,
): CardioKcalContract {
  const nowIso = referenceIso ?? todayLocalIso();
  const payload = cardioToNutritionPayload(cycle, log, nowIso);
  const { confidence, basis } = confidenceOf(log, nowIso);
  const include = loadCardioKcalContract()?.include ?? true;
  const text = [
    `❤️ Кардио: ${payload.avgKcalPerWeek} ккал/нед (${payload.avgMinutesPerWeek} мин/нед, уверенность ${Math.round(confidence * 100)}%)`,
    payload.todayKcal > 0
      ? `🔥 Сегодня: ${payload.todayMinutes} мин · ${payload.todayKcal} ккал (факт)`
      : '🔥 Сегодня: кардио не записано — в дневной цели учтён только план',
    include ? '🍽 Питание: расход кардио ВКЛЮЧЁН (оценка)' : '🍽 Питание: расход кардио НЕ учитывается (выключено)',
  ].join('\n');
  return {
    cycleId: cycle.id,
    weeklyKcal: payload.avgKcalPerWeek,
    weeklyMinutes: payload.avgMinutesPerWeek,
    todayKcal: payload.todayKcal,
    todayMinutes: payload.todayMinutes,
    confidence,
    basis,
    include,
    updatedAt: new Date().toISOString(),
    text,
    // Легаси-алиасы: питание, написанное до контракта, читает эти имена.
    avgKcalPerWeek: payload.avgKcalPerWeek,
    avgMinutesPerWeek: payload.avgMinutesPerWeek,
  };
}

export function saveCardioKcalContract(c: CardioKcalContract): void {
  try { localStorage.setItem(CARDIO_KCAL_NOTE_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}

/** Запись контракта по циклу (пишет handler моста и кнопка «🍽 В питание»). */
export function publishCardioKcalContract(cycle: CardioCycle, log?: CardioLogEntry[]): CardioKcalContract {
  const c = buildCardioKcalContract(cycle, log);
  saveCardioKcalContract(c);
  return c;
}

/** Читатель контракта. Устаревшая запись (>14 дней) — confidence снижается. */
export function loadCardioKcalContract(referenceIso?: string): CardioKcalContract | null {
  try {
    const raw = JSON.parse(localStorage.getItem(CARDIO_KCAL_NOTE_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    // Совместимость: запись, сделанная до контракта, хранит avgKcalPerWeek.
    const weeklyRaw = Number.isFinite(raw.weeklyKcal) ? raw.weeklyKcal : raw.avgKcalPerWeek;
    if (typeof weeklyRaw !== 'number' || !Number.isFinite(weeklyRaw)) return null;
    const nowIso = referenceIso ?? todayLocalIso();
    const ageDays = raw.updatedAt
      ? Math.round((new Date(nowIso).getTime() - new Date(String(raw.updatedAt).slice(0, 10)).getTime()) / 86400000)
      : 0;
    const stale = ageDays > 14;
    return {
      cycleId: String(raw.cycleId ?? ''),
      weeklyKcal: Math.max(0, Math.round(weeklyRaw)),
      weeklyMinutes: Math.max(0, Math.round(Number(raw.weeklyMinutes ?? raw.avgMinutesPerWeek) || 0)),
      todayKcal: Math.max(0, Math.round(Number(raw.todayKcal) || 0)),
      todayMinutes: Math.max(0, Math.round(Number(raw.todayMinutes) || 0)),
      confidence: Math.max(0, Math.min(1, Number(raw.confidence) || (stale ? 0.2 : 0.35))),
      basis: raw.basis === 'log' ? 'log' : 'plan',
      include: raw.include !== false,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
      text: typeof raw.text === 'string' ? raw.text : '',
    };
  } catch { return null; }
}

/** Переключатель «учитывать кардио в питании». */
export function setCardioKcalInclude(include: boolean): CardioKcalContract | null {
  const cur = loadCardioKcalContract();
  if (!cur) return null;
  const next: CardioKcalContract = {
    ...cur,
    include,
    text: cur.text.replace(
      /🍽 Питание:.*$/m,
      include ? '🍽 Питание: расход кардио ВКЛЮЧЁН (оценка)' : '🍽 Питание: расход кардио НЕ учитывается (выключено)',
    ),
    updatedAt: new Date().toISOString(),
  };
  saveCardioKcalContract(next);
  return next;
}

/**
 * Текст для планировщика питания: что именно питание «видит» из кардио.
 *
 * Решение по модели (ноябрь 2026): цели КБЖУ НЕ меняются от кардио-расхода —
 * PAL уже учитывает дни/минуты/тип тренировок, и прибавка «сверху» была бы
 * двойным счётом. Поэтому кардио показывается справочно и явно об этом
 * предупреждает: честная цифра без скрытой подмены калорий.
 */
export interface CardioPlannerNote {
  headline: string;
  lines: string[];
  tone: 'ok' | 'muted';
}

export function cardioKcalPlannerNote(c: CardioKcalContract | null): CardioPlannerNote | null {
  if (!c) return null;
  const pct = Math.round(Math.max(0, Math.min(1, c.confidence)) * 100);
  const basis = c.basis === 'log' ? 'по журналу сессий' : 'по плану — журнала мало';
  return {
    headline: `❤️ Кардио: ${c.weeklyKcal} ккал/нед · ${c.weeklyMinutes} мин/нед · уверенность ${pct}% (${basis})`,
    lines: [
      c.todayKcal > 0
        ? `Сегодня: ${c.todayMinutes} мин · ${c.todayKcal} ккал (факт из дневника)`
        : 'Сегодня кардио не записано',
      c.include ? 'Учёт кардио включён (переключатель в кардио-дневнике).' : 'Учёт кардио выключен в кардио-дневнике.',
      'Цели КБЖУ считаются через PAL (дни/минуты/тип тренировок) — расход кардио показан справочно и второй раз не добавляется.',
    ],
    tone: c.include ? 'ok' : 'muted',
  };
}
