/**
 * coach-program-library.engine.ts — библиотека программ тренера.
 *
 * Хранится в устройственном ключе `he_coach_programs`: он начинается на
 * `he_coach_`, поэтому (а) не переключается вместе с атлетом, (б) синхронизируется
 * между устройствами тренера как обычный ключ. Атлет не видит библиотеку и не
 * может её изменить: в его пространстве этих данных нет.
 *
 * ЧЕСТНЫЕ ГРАНИЦЫ:
 *  • шаблон — это снимок сырых ключей (`CoachProgramBundle`), а не «умная» модель;
 *  • лимиты технические (50 шаблонов, 3 МБ на всю библиотеку) и объясняются в UI;
 *  • парсер терпимый: битый шаблон пропускается, остальные остаются.
 */
import {
  normalizeProgramBundle,
  type CoachProgramBundle,
} from './coach-program-bundle.engine';

/** Данные устройства: библиотека принадлежит тренеру, а не атлету. */
export const COACH_PROGRAMS_KEY = 'he_coach_programs';
export const COACH_PROGRAMS_MAX = 50;
/** Потолок всей библиотеки в localStorage: 3 МБ (технический, не продуктовый). */
export const COACH_PROGRAMS_TOTAL_MAX_CHARS = 3_000_000;
export const PROGRAM_NAME_MAX = 60;
export const PROGRAM_NOTE_MAX = 300;

export interface CoachProgramTemplate {
  id: string;
  name: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  /** Сколько раз программу выдавали — факт для списка, не оценка. */
  issuedCount: number;
  lastIssuedAt: string | null;
  /** С какого атлета сняли (имя на момент сохранения). */
  sourceLabel: string;
  bundle: CoachProgramBundle;
}

export interface CoachProgramsStore {
  version: 1;
  items: CoachProgramTemplate[];
}

export type CoachProgramError = 'name' | 'limit' | 'size' | 'empty' | 'duplicate' | null;

export interface CoachProgramResult {
  store: CoachProgramsStore;
  template: CoachProgramTemplate | null;
  error: CoachProgramError;
}

export function emptyCoachPrograms(): CoachProgramsStore {
  return { version: 1, items: [] };
}

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

function nextProgramId(items: CoachProgramTemplate[], now: string): string {
  const base = `p_${now.replace(/[^0-9]/g, '').slice(0, 14)}`;
  let id = base;
  let i = 1;
  while (items.some(t => t.id === id)) id = `${base}_${++i}`;
  return id;
}

export function parseCoachPrograms(raw: string | null | undefined): CoachProgramsStore {
  if (!raw) return emptyCoachPrograms();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return emptyCoachPrograms();
    const obj = parsed as Partial<CoachProgramsStore> & Record<string, unknown>;
    if (obj.version !== 1 || !Array.isArray(obj.items)) return emptyCoachPrograms();
    const seen = new Set<string>();
    const seenNames = new Set<string>();
    const items: CoachProgramTemplate[] = [];
    for (const row of obj.items) {
      if (!row || typeof row !== 'object') continue;
      const r = row as unknown as Record<string, unknown>;
      const id = clean(r.id, 80);
      const name = clean(r.name, PROGRAM_NAME_MAX);
      const bundle = normalizeProgramBundle(r.bundle).bundle;
      if (!id || !name || !bundle || seen.has(id) || seenNames.has(name.toLowerCase())) continue;
      seen.add(id);
      seenNames.add(name.toLowerCase());
      items.push({
        id,
        name,
        note: clean(r.note, PROGRAM_NOTE_MAX),
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
        updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
        issuedCount: Number.isFinite(Number(r.issuedCount)) ? Math.max(0, Math.trunc(Number(r.issuedCount))) : 0,
        lastIssuedAt: typeof r.lastIssuedAt === 'string' ? r.lastIssuedAt : null,
        sourceLabel: clean(r.sourceLabel, 60),
        bundle,
      });
      if (items.length >= COACH_PROGRAMS_MAX) break;
    }
    return { version: 1, items };
  } catch {
    return emptyCoachPrograms();
  }
}

export function serializeCoachPrograms(store: CoachProgramsStore): string {
  return JSON.stringify({ version: 1, items: store.items });
}

export function readCoachPrograms(
  storage: { getItem: (k: string) => string | null } | null | undefined,
): CoachProgramsStore {
  if (!storage) return emptyCoachPrograms();
  try {
    return parseCoachPrograms(storage.getItem(COACH_PROGRAMS_KEY));
  } catch {
    return emptyCoachPrograms();
  }
}

export function writeCoachPrograms(storage: { setItem: (k: string, v: string) => void } | null | undefined, store: CoachProgramsStore): void {
  if (!storage) return;
  try {
    storage.setItem(COACH_PROGRAMS_KEY, serializeCoachPrograms(store));
  } catch {
    /* квота: вызывающий увидит неизменённый store по факту перечитывания */
  }
}

/** Сохранить программу как шаблон. */
export function addCoachProgram(
  store: CoachProgramsStore,
  input: { name: string; note?: string; bundle: unknown; sourceLabel?: string },
  opts: { id?: string; now?: string } = {},
): CoachProgramResult {
  const name = clean(input.name, PROGRAM_NAME_MAX);
  if (!name) return { store, template: null, error: 'name' };
  if (store.items.length >= COACH_PROGRAMS_MAX) return { store, template: null, error: 'limit' };
  if (store.items.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    return { store, template: null, error: 'duplicate' };
  }
  const bundle = normalizeProgramBundle(input.bundle).bundle;
  if (!bundle) return { store, template: null, error: 'empty' };
  const now = opts.now ?? new Date().toISOString();
  const template: CoachProgramTemplate = {
    id: opts.id ?? nextProgramId(store.items, now),
    name,
    note: clean(input.note, PROGRAM_NOTE_MAX),
    createdAt: now,
    updatedAt: now,
    issuedCount: 0,
    lastIssuedAt: null,
    sourceLabel: clean(input.sourceLabel, 60),
    bundle,
  };
  const next: CoachProgramsStore = { version: 1, items: [...store.items, template] };
  if (serializeCoachPrograms(next).length > COACH_PROGRAMS_TOTAL_MAX_CHARS) {
    return { store, template: null, error: 'size' };
  }
  return { store: next, template, error: null };
}

export function renameCoachProgram(
  store: CoachProgramsStore,
  id: string,
  name: string,
  opts: { now?: string } = {},
): CoachProgramResult {
  const cleanName = clean(name, PROGRAM_NAME_MAX);
  if (!cleanName) return { store, template: null, error: 'name' };
  if (store.items.some(t => t.id !== id && t.name.toLowerCase() === cleanName.toLowerCase())) {
    return { store, template: null, error: 'duplicate' };
  }
  const idx = store.items.findIndex(t => t.id === id);
  if (idx < 0) return { store, template: null, error: 'empty' };
  const items = [...store.items];
  const template = { ...items[idx], name: cleanName, updatedAt: opts.now ?? new Date().toISOString() };
  items[idx] = template;
  return { store: { version: 1, items }, template, error: null };
}

export function removeCoachProgram(store: CoachProgramsStore, id: string): CoachProgramsStore {
  const items = store.items.filter(t => t.id !== id);
  return items.length === store.items.length ? store : { version: 1, items };
}

/** Отметить выдачу (счётчик и дата). Вызывается только после успешной записи. */
export function markCoachProgramIssued(
  store: CoachProgramsStore,
  id: string,
  opts: { now?: string } = {},
): CoachProgramsStore {
  const idx = store.items.findIndex(t => t.id === id);
  if (idx < 0) return store;
  const now = opts.now ?? new Date().toISOString();
  const items = [...store.items];
  items[idx] = { ...items[idx], issuedCount: items[idx].issuedCount + 1, lastIssuedAt: now, updatedAt: now };
  return { version: 1, items };
}

export function findCoachProgram(store: CoachProgramsStore, id: string): CoachProgramTemplate | null {
  return store.items.find(t => t.id === id) ?? null;
}

export function coachProgramErrorText(error: CoachProgramError): string {
  switch (error) {
    case 'name':
      return 'Название программы обязательно.';
    case 'limit':
      return `В библиотеке уже ${COACH_PROGRAMS_MAX} программ — удалите ненужную.`;
    case 'size':
      return 'Программа слишком большая для библиотеки.';
    case 'duplicate':
      return 'Программа с таким названием уже есть — назовите иначе.';
    case 'empty':
      return 'В программе нет ни одного плана.';
    default:
      return '';
  }
}
