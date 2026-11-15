/**
 * female-cycle-phase.engine.ts — день цикла → фаза → гормональные коридоры.
 *
 * Зачем отдельный файл. «♀ — по фазе, не подавлять» — честная формулировка, но
 * она не отвечает на вопрос «какая норма сейчас». Дата последней менструации и
 * длина цикла уже лежат в профиле (`settings.lifestyle.lastPeriodStart`,
 * `cycleLengthDays` — их читают кардио-автотюн и пик-неделя), а коридоры уже
 * лежат в `FEMALE_HORMONE_BANDS` (те же числа, что в женском протоколе, бэндах
 * мониторинга и карточках фаз). Значит фаза вычисляема — и норма может быть
 * конкретной, а не «по фазе».
 *
 * Правила (одно на все поверхности):
 *  - фолликулярная / лютеиновая — свой коридор из `FEMALE_HORMONE_BANDS`;
 *  - менструальная — ориентир фолликулярной: E2 в начале цикла низкий, отдельного
 *    коридора ни один источник приложения не содержит, а подставлять лютеиновый
 *    нельзя;
 *  - овуляторная — `null`: пик E2 и выброс ЛГ шире любого фазового коридора,
 *    поэтому числом не отвечаем (вызывающая сторона печатает объединение фаз и
 *    подпись «овуляторная»);
 *  - данных нет / не женщина / дата в будущем — `null`, поведение прежнее.
 *
 * Пролактин фазовой моделью НЕ управляется: его норма от дня цикла не зависит
 * (женский бэнд 100–500 мМЕ/л один на весь цикл). «По фазе» к PRL не применяем —
 * иначе пользователь ждёт фазовых чисел, которых нет ни в одном источнике.
 */
import { localIsoDate, parseLocalIsoDate } from '../core/local-date';
import { cyclePhaseForDay, cyclePhaseLabel, type CyclePhase } from './bb/bb-cycle.engine';
import { FEMALE_HORMONE_BANDS } from './lab-norms.engine';

export interface CycleState {
  phase: CyclePhase;
  /** День цикла 1..cycleLength. */
  cycleDay: number;
  cycleLength: number;
  /** Подпись фазы по-русски: «Лютеиновая». */
  label: string;
}

export interface CycleInput {
  sex?: string;
  lastPeriodStart?: string | null;
  cycleLengthDays?: number | null;
}

/** Длина цикла в физиологичном коридоре 21–35; мусор и пустое — 28. */
export function clampCycleLength(length?: number | null): number {
  const n = Math.round(Number(length));
  if (!Number.isFinite(n) || n <= 0) return 28;
  return Math.min(35, Math.max(21, n));
}

/**
 * Фаза цикла на дату (`onIso`, по умолчанию — сегодня).
 * `null` — пол не женский, даты нет, дата неверна или лежит в будущем: гадать
 * о фазе нельзя, вызывающая сторона продолжает с объединением коридоров.
 */
export function cycleState(input: CycleInput, onIso?: string): CycleState | null {
  if (!input || input.sex !== 'female') return null;
  const start = parseLocalIsoDate(String(input.lastPeriodStart ?? ''));
  const on = parseLocalIsoDate(onIso ?? localIsoDate());
  if (!start || !on) return null;
  const diff = Math.round((on.getTime() - start.getTime()) / 86400000);
  if (!Number.isFinite(diff) || diff < 0) return null;
  const cycleLength = clampCycleLength(input.cycleLengthDays);
  const cycleDay = (diff % cycleLength) + 1;
  const phase = cyclePhaseForDay(cycleDay, cycleLength);
  return { phase, cycleDay, cycleLength, label: cyclePhaseLabel(phase) };
}

/**
 * Минимальная форма профиля для чтения цикла: и `profile-manager`, и тестовые
 * заглушки подходят структурно, тащить сюда весь тип профиля не нужно.
 */
export interface ProfileLike {
  settings?: {
    personal?: { sex?: string } | null;
    lifestyle?: { lastPeriodStart?: string | null; cycleLengthDays?: number | null } | null;
  } | null;
}

/**
 * Фаза цикла из профиля приложения (`settings.lifestyle`) — один вызов для UI и
 * движков, чтобы каждый не собирал поля руками. `null` — профиля нет, пол не
 * женский или дата менструации не заполнена.
 */
export function cycleStateFromProfile(profile: ProfileLike | null | undefined, onIso?: string): CycleState | null {
  const personal = profile?.settings?.personal ?? {};
  const lifestyle = profile?.settings?.lifestyle ?? {};
  return cycleState({
    sex: personal.sex,
    lastPeriodStart: lifestyle.lastPeriodStart,
    cycleLengthDays: lifestyle.cycleLengthDays,
  }, onIso);
}

/** Гормоны, у которых есть фазовые коридоры (PRL — намеренно нет). */
export type PhaseHormone = 'E2' | 'LH' | 'FSH';

/** Единица фазового коридора: бэнды хранятся в пг/мл и МЕ/л. */
const PHASE_UNIT: Record<PhaseHormone, string> = { E2: 'пг/мл', LH: 'МЕ/л', FSH: 'МЕ/л' };

/** Единица фазового коридора — для пересчёта в единицы отчёта/бланка. */
export function phaseHormoneUnit(marker: PhaseHormone): string {
  return PHASE_UNIT[marker];
}

/** Коридор гормона для фазы; `null` — фазового коридора нет (овуляторная/нет фазы). */
export function phaseHormoneBand(
  marker: PhaseHormone,
  phase: CyclePhase | null | undefined,
): { low: number; high: number } | null {
  if (!phase) return null;
  const phases = FEMALE_HORMONE_BANDS[marker].phases;
  if (phase === 'follicular' || phase === 'menstrual') return { low: phases.follicular.low, high: phases.follicular.high };
  if (phase === 'luteal') return { low: phases.luteal.low, high: phases.luteal.high };
  return null;
}

/** Объединение фазовых коридоров — фолбэк, когда фаза неизвестна или пиковая. */
export function phaseUnionBand(marker: PhaseHormone): { low: number; high: number } {
  const phases = FEMALE_HORMONE_BANDS[marker].phases;
  return {
    low: Math.min(phases.follicular.low, phases.luteal.low),
    high: Math.max(phases.follicular.high, phases.luteal.high),
  };
}

/**
 * Подпись коридора: «40–200 пг/мл (фолликулярная)», «70–500 пг/мл (лютеиновая)».
 * `null` — числа для этой фазы нет (см. овуляторную выше).
 */
export function phaseHormoneText(marker: PhaseHormone, phase: CyclePhase | null | undefined): string | null {
  const band = phaseHormoneBand(marker, phase);
  if (!band || !phase) return null;
  return `${band.low}–${band.high} ${PHASE_UNIT[marker]} (${cyclePhaseLabel(phase).toLowerCase()})`;
}
