/**
 * arm-redflags.store.ts — персистентность red-flags скрининга (PRO-3 P4).
 * Было: 5 чипов в локальном useState HubP0Panel — история терялась.
 * Стало: `he_arm_diag_redflags` (кап 20 записей {date, ids}), битой стор → [].
 * Скрининг, не диагноз — стоп-правило решает UI/мост, не стор.
 */

export interface ArmRedFlagDef {
  id: string;
  label: string;
  /** true → стоп-тесты + к врачу (острая боль/отёк/онемение/перелом-подозрение). */
  stop: boolean;
}

export const ARM_RED_FLAG_DEFS: ArmRedFlagDef[] = [
  { id: 'pain', label: 'Острая боль', stop: true },
  { id: 'swell', label: 'Отёк', stop: true },
  { id: 'click', label: 'Щелчки в локте', stop: false },
  { id: 'numb', label: 'Онемение пальцев', stop: true },
  { id: 'fract', label: 'Перелом <6 мес', stop: true },
];

export interface ArmRedFlagEntry {
  date: string;
  ids: string[];
}

const KEY = 'he_arm_diag_redflags';
const CAP = 20;

function today(): string {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export function redFlagLabel(id: string): string {
  return ARM_RED_FLAG_DEFS.find((d) => d.id === id)?.label || id;
}

export function redFlagLabels(ids: string[]): string[] {
  return (ids || []).map(redFlagLabel);
}

/** Есть ли стоп-флаг (тесты запрещены до врача). */
export function hasStopFlag(ids: string[]): boolean {
  return (ids || []).some((id) => ARM_RED_FLAG_DEFS.some((d) => d.id === id && d.stop));
}

export function loadRedFlagLog(): ArmRedFlagEntry[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const j = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(j)) return [];
    return j
      .filter((e: unknown) => e && typeof e === 'object' && Array.isArray((e as ArmRedFlagEntry).ids))
      .map((e: ArmRedFlagEntry) => ({ date: String(e.date || ''), ids: e.ids.filter((x) => typeof x === 'string') }))
      .slice(-CAP);
  } catch {
    return [];
  }
}

/** Текущий выбор = ids последней записи (пусто → []). */
export function loadRedFlags(): string[] {
  const log = loadRedFlagLog();
  return log.length ? [...log[log.length - 1].ids] : [];
}

function persist(log: ArmRedFlagEntry[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(log.slice(-CAP)));
  } catch {
    /* noop */
  }
}

/** Сохранить текущий выбор (пустой выбор тоже пишется — это осознанный «чисто»). */
export function saveRedFlags(ids: string[]): ArmRedFlagEntry[] {
  const clean = (ids || []).filter((x) => typeof x === 'string');
  const next = [...loadRedFlagLog(), { date: today(), ids: clean }].slice(-CAP);
  persist(next);
  return next;
}
