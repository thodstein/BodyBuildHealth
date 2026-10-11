/**
 * pl-meet-registry.engine.ts — единый реестр соревнований ПЛ (Фаза 2-слияние).
 *
 * Проблема: старты жили в ДВУХ хранилищах — `he_pl_session.plMeetList`
 * (вкладка «🏁 Соревнования» → сезон по микроциклам) и `he_pl_macro.competitions`
 * (годовой план). Добавил старт в одном — второй о нём не знал.
 *
 * Решение: КАНОН — `he_pl_macro.competitions` (события года: id/день/приоритет);
 * `plMeetList` остаётся «надстройкой» (федерация/заявленные ПМ/стратегия ПЛ) и
 * переносится в события при слиянии. Миграция lossless: легаси-старт без события
 * года создаёт событие (week/date/priority), событие без старта получает старт
 * со значениями по умолчанию. Чистые функции — без UI/стораджа.
 */
import type { CompetitionEvent } from './macrocycle.engine';
import type { MeetStrategy } from './competition-attempts';
import { isoAddDays } from './lms-taper.engine';

/** ПЛ-надстройка старта (не хранится в событии года — живёт в he_pl_session). */
export interface PLMeetExtras {
  fed: string;
  plannedPm: Record<string, number>;
  strategy: MeetStrategy;
}

/** Минимальная форма старта ПЛ (совместима с PLMeetListItem). */
export interface PLMeetLike extends PLMeetExtras {
  id: string;
  name: string;
  weeksToStart: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toLocalNoonUtc(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}

/** Целых дней от todayIso до dateIso (может быть отрицательным). null при битой дате. */
export function daysBetweenIso(dateIso: string, todayIso: string): number | null {
  const a = toLocalNoonUtc(dateIso);
  const b = toLocalNoonUtc(todayIso);
  if (a == null || b == null) return null;
  return Math.round((a - b) / DAY_MS);
}

/** Неделя макроцикла для даты (неделя 1 = today), ≥1. */
export function macroWeekForDateIso(dateIso: string, todayIso: string): number {
  const d = daysBetweenIso(dateIso, todayIso);
  if (d == null) return 1;
  return Math.max(1, Math.floor(d / 7) + 1);
}

/** Обратное к macroWeekForDateIso: недель до старта = номер недели старта.
 *  Для даты-начала недели N возвращает N — контракт сезона ПЛ (старт в неделе N).
 *  Аудит P1: было round(дни/7) — реестр и buildPLSeasonPeaks расходились на неделю. */
export function weeksToStartFromDate(dateIso: string, todayIso: string): number {
  return macroWeekForDateIso(dateIso, todayIso);
}

/**
 * Дата старта из «недель до старта» (неделя 1 = today).
 * Канон недель: `weeksToStart = N` ⇔ старт в НЕДЕЛЕ N плана (её начало = today +
 * (N-1)×7). Ровно та же разметка, что у buildPLSeasonPeaks (compIdx = N-1) —
 * раньше годовой план и сезон ПЛ расходились ровно на неделю.
 */
export function dateFromWeeksToStart(weeksToStart: number, todayIso: string): string {
  const w = Number.isFinite(weeksToStart) ? Math.max(0, Math.round(weeksToStart)) : 0;
  return isoAddDays(todayIso, Math.max(0, w - 1) * 7) ?? todayIso;
}

/** Дата события: явная `date`, иначе из `week` (неделя 1 = today). null — нет данных. */
export function dateForCompetition(ev: CompetitionEvent, todayIso: string): string | null {
  if (ev.date && toLocalNoonUtc(ev.date) != null) return ev.date.slice(0, 10);
  if (Number.isFinite(ev.week) && ev.week >= 1) return dateFromWeeksToStart(ev.week, todayIso);
  return null;
}

const DEFAULT_EXTRAS: PLMeetExtras = { fed: 'fpr', plannedPm: {}, strategy: 'balanced' };

export interface MergeMeetRegistryInput {
  competitions: CompetitionEvent[];
  legacyMeets: PLMeetLike[];
  mainMeetId: string;
  todayIso: string;
}

export interface MergeMeetRegistryResult {
  meets: PLMeetLike[];
  competitions: CompetitionEvent[];
  mainMeetId: string;
  /** true — события года изменились (нужна запись he_pl_macro). */
  changed: boolean;
  notes: string[];
}

/**
 * Слияние двух реестров: события года — канон (id/неделя/дата/приоритет),
 * старты ПЛ — надстройка (федерация/ПМ/стратегия) + миграция недостающих.
 */
export function mergeMeetRegistry(input: MergeMeetRegistryInput): MergeMeetRegistryResult {
  const { todayIso } = input;
  const competitions = input.competitions.map(c => ({ ...c }));
  const legacyMeets = Array.isArray(input.legacyMeets) ? input.legacyMeets : [];
  const notes: string[] = [];
  let changed = false;

  const byId = new Map(competitions.map(c => [c.id, c] as const));
  const byName = new Map(competitions.map(c => [c.name.trim().toLowerCase(), c] as const));
  const usedEventIds = new Set<string>();
  const meets: PLMeetLike[] = [];

  for (const legacy of legacyMeets) {
    const ev = byId.get(legacy.id) ?? byName.get((legacy.name || '').trim().toLowerCase());
    if (ev) {
      usedEventIds.add(ev.id);
      // Гармонизация канона со стартом ПЛ (имя/дата/приоритет).
      const date = dateForCompetition(ev, todayIso) ?? dateFromWeeksToStart(legacy.weeksToStart, todayIso);
      const week = macroWeekForDateIso(date, todayIso);
      const priority: CompetitionEvent['priority'] = legacy.id === input.mainMeetId || ev.id === input.mainMeetId ? 'A' : (ev.priority ?? 'B');
      const nextName = legacy.name || ev.name;
      if (ev.name !== nextName || ev.date !== date || ev.week !== week || ev.priority !== priority) {
        ev.name = nextName; ev.date = date; ev.week = week; ev.priority = priority;
        changed = true;
      }
      meets.push({
        id: ev.id, name: nextName, weeksToStart: weeksToStartFromDate(date, todayIso),
        fed: legacy.fed ?? DEFAULT_EXTRAS.fed,
        plannedPm: legacy.plannedPm ?? {},
        strategy: legacy.strategy ?? DEFAULT_EXTRAS.strategy,
      });
    } else {
      // Легаси-старт без события года → создаём событие (миграция).
      // Контракт недель: weeksToStart = N ⇔ старт в неделе N (как в сезоне ПЛ).
      const date = dateFromWeeksToStart(legacy.weeksToStart, todayIso);
      const ev: CompetitionEvent = {
        id: legacy.id,
        name: legacy.name || 'Соревнование',
        week: Math.max(1, Math.round(legacy.weeksToStart)),
        date,
        priority: legacy.id === input.mainMeetId ? 'A' : 'B',
      };
      competitions.push(ev);
      usedEventIds.add(ev.id);
      notes.push(`➕ «${ev.name}» перенесён в годовой план`);
      changed = true;
      meets.push({ ...legacy, name: ev.name });
    }
  }

  for (const ev of competitions) {
    if (usedEventIds.has(ev.id)) continue;
    const date = dateForCompetition(ev, todayIso);
    // Контракт недель: старт в неделе ev.week ⇔ ev.week недель до старта.
    const weeksToStart = date ? weeksToStartFromDate(date, todayIso) : (Number.isFinite(ev.week) ? Math.max(1, Math.round(ev.week)) : 1);
    meets.push({ id: ev.id, name: ev.name, weeksToStart, ...DEFAULT_EXTRAS, plannedPm: {}, strategy: 'balanced' });
    usedEventIds.add(ev.id);
  }

  meets.sort((a, b) => a.weeksToStart - b.weeksToStart || a.name.localeCompare(b.name));

  let mainMeetId = input.mainMeetId;
  if (!meets.some(m => m.id === mainMeetId)) {
    const mainEvent = competitions.find(c => c.priority === 'A' && usedEventIds.has(c.id));
    mainMeetId = mainEvent?.id ?? meets[0]?.id ?? '';
  }

  return { meets, competitions, mainMeetId, changed, notes };
}

/**
 * Обратная синхронизация: старты ПЛ → события года (upsert + удаление выбывших).
 * Поля года, не хранящиеся в старте (notes/cycleId/cycleIds), сохраняются.
 */
export function syncCompetitionsFromMeets(
  competitions: CompetitionEvent[],
  meets: PLMeetLike[],
  opts: { mainMeetId: string; todayIso: string },
): CompetitionEvent[] {
  const byId = new Map(competitions.map(c => [c.id, c] as const));
  const result: CompetitionEvent[] = [];
  for (const meet of meets) {
    const prev = byId.get(meet.id);
    const weeks = Math.max(1, Math.round(meet.weeksToStart));
    const date = dateFromWeeksToStart(weeks, opts.todayIso);
    const priority: CompetitionEvent['priority'] = meet.id === opts.mainMeetId
      ? 'A'
      : (prev?.priority === 'A' ? 'B' : (prev?.priority ?? 'B'));
    result.push({
      ...(prev ?? {}),
      id: meet.id,
      name: meet.name || prev?.name || 'Соревнование',
      week: weeks,
      date,
      priority,
    });
  }
  return result;
}
