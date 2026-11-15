/**
 * coach-assignment-library.engine.ts — библиотека назначений тренера (рацион, БАДы).
 *
 * Устройственный ключ `he_coach_assignments`: начинается на `he_coach_`, поэтому
 * (а) не переключается вместе с атлетом, (б) синхронизируется между телефонами
 * тренера как обычный ключ. Атлет библиотеку не видит — в его пространстве её нет.
 *
 * ЧЕСТНЫЕ ГРАНИЦЫ:
 *  • шаблон — снимок сырых ключей (`CoachAssignmentBundle`), а не «умная» модель;
 *  • лимиты технические (40 шаблонов, 3 МБ) и объясняются в интерфейсе;
 *  • парсер терпимый: битый шаблон пропускается, остальные остаются.
 */
import {
  normalizeAssignmentBundle,
  type AssignmentKind,
  type CoachAssignmentBundle,
} from './coach-assignment-bundle.engine';

export const COACH_ASSIGNMENTS_KEY = 'he_coach_assignments';
export const COACH_ASSIGNMENTS_MAX = 40;
/** Потолок всей библиотеки в localStorage: 3 МБ (технический предохранитель). */
export const COACH_ASSIGNMENTS_TOTAL_MAX_CHARS = 3_000_000;
export const ASSIGNMENT_NAME_MAX = 60;
export const ASSIGNMENT_NOTE_MAX = 300;

export interface CoachAssignmentTemplate {
  id: string;
  kind: AssignmentKind;
  name: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  /** Сколько раз выдавали — факт для списка, не оценка. */
  issuedCount: number;
  lastIssuedAt: string | null;
  /** С какого атлета сняли (имя на момент сохранения). */
  sourceLabel: string;
  bundle: CoachAssignmentBundle;
}

export interface CoachAssignmentsStore {
  version: 1;
  items: CoachAssignmentTemplate[];
}

export type CoachAssignmentError = 'name' | 'limit' | 'size' | 'empty' | 'duplicate' | null;

export interface CoachAssignmentResult {
  store: CoachAssignmentsStore;
  template: CoachAssignmentTemplate | null;
  error: CoachAssignmentError;
}

export function emptyCoachAssignments(): CoachAssignmentsStore {
  return { version: 1, items: [] };
}

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

function nextId(items: CoachAssignmentTemplate[], now: string): string {
  const base = `a_${now.replace(/[^0-9]/g, '').slice(0, 14)}`;
  let id = base;
  let i = 1;
  while (items.some(t => t.id === id)) id = `${base}_${++i}`;
  return id;
}

export function parseCoachAssignments(raw: string | null | undefined): CoachAssignmentsStore {
  if (!raw) return emptyCoachAssignments();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return emptyCoachAssignments();
    const obj = parsed as Partial<CoachAssignmentsStore> & Record<string, unknown>;
    if (obj.version !== 1 || !Array.isArray(obj.items)) return emptyCoachAssignments();
    const seen = new Set<string>();
    const seenNames = new Set<string>();
    const items: CoachAssignmentTemplate[] = [];
    for (const row of obj.items) {
      if (!row || typeof row !== 'object') continue;
      const r = row as unknown as Record<string, unknown>;
      const id = clean(r.id, 80);
      const name = clean(r.name, ASSIGNMENT_NAME_MAX);
      const bundle = normalizeAssignmentBundle(r.bundle).bundle;
      if (!id || !name || !bundle || seen.has(id)) continue;
      const nameKey = `${bundle.assignmentKind}:${name.toLowerCase()}`;
      if (seenNames.has(nameKey)) continue;
      seen.add(id);
      seenNames.add(nameKey);
      items.push({
        id,
        kind: bundle.assignmentKind,
        name,
        note: clean(r.note, ASSIGNMENT_NOTE_MAX),
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
        updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
        issuedCount: Number.isFinite(Number(r.issuedCount)) ? Math.max(0, Math.trunc(Number(r.issuedCount))) : 0,
        lastIssuedAt: typeof r.lastIssuedAt === 'string' ? r.lastIssuedAt : null,
        sourceLabel: clean(r.sourceLabel, 60),
        bundle,
      });
      if (items.length >= COACH_ASSIGNMENTS_MAX) break;
    }
    return { version: 1, items };
  } catch {
    return emptyCoachAssignments();
  }
}

export function serializeCoachAssignments(store: CoachAssignmentsStore): string {
  return JSON.stringify({ version: 1, items: store.items });
}

export function readCoachAssignments(
  storage: { getItem: (k: string) => string | null } | null | undefined,
): CoachAssignmentsStore {
  if (!storage) return emptyCoachAssignments();
  try {
    return parseCoachAssignments(storage.getItem(COACH_ASSIGNMENTS_KEY));
  } catch {
    return emptyCoachAssignments();
  }
}

export function writeCoachAssignments(
  storage: { setItem: (k: string, v: string) => void } | null | undefined,
  store: CoachAssignmentsStore,
): void {
  if (!storage) return;
  try {
    storage.setItem(COACH_ASSIGNMENTS_KEY, serializeCoachAssignments(store));
  } catch {
    /* квота: вызывающий увидит неизменённый store по факту перечитывания */
  }
}

/** Сохранить назначение как шаблон. Имя уникально внутри своего типа. */
export function addCoachAssignment(
  store: CoachAssignmentsStore,
  input: { name: string; note?: string; bundle: unknown; sourceLabel?: string },
  opts: { id?: string; now?: string } = {},
): CoachAssignmentResult {
  const name = clean(input.name, ASSIGNMENT_NAME_MAX);
  if (!name) return { store, template: null, error: 'name' };
  if (store.items.length >= COACH_ASSIGNMENTS_MAX) return { store, template: null, error: 'limit' };
  const bundle = normalizeAssignmentBundle(input.bundle).bundle;
  if (!bundle) return { store, template: null, error: 'empty' };
  if (store.items.some(t => t.kind === bundle.assignmentKind && t.name.toLowerCase() === name.toLowerCase())) {
    return { store, template: null, error: 'duplicate' };
  }
  const now = opts.now ?? new Date().toISOString();
  const template: CoachAssignmentTemplate = {
    id: opts.id ?? nextId(store.items, now),
    kind: bundle.assignmentKind,
    name,
    note: clean(input.note, ASSIGNMENT_NOTE_MAX),
    createdAt: now,
    updatedAt: now,
    issuedCount: 0,
    lastIssuedAt: null,
    sourceLabel: clean(input.sourceLabel, 60),
    bundle,
  };
  const next: CoachAssignmentsStore = { version: 1, items: [...store.items, template] };
  if (serializeCoachAssignments(next).length > COACH_ASSIGNMENTS_TOTAL_MAX_CHARS) {
    return { store, template: null, error: 'size' };
  }
  return { store: next, template, error: null };
}

export function renameCoachAssignment(
  store: CoachAssignmentsStore,
  id: string,
  name: string,
  opts: { now?: string } = {},
): CoachAssignmentResult {
  const cleanName = clean(name, ASSIGNMENT_NAME_MAX);
  if (!cleanName) return { store, template: null, error: 'name' };
  const idx = store.items.findIndex(t => t.id === id);
  if (idx < 0) return { store, template: null, error: 'empty' };
  const kind = store.items[idx].kind;
  if (store.items.some(t => t.id !== id && t.kind === kind && t.name.toLowerCase() === cleanName.toLowerCase())) {
    return { store, template: null, error: 'duplicate' };
  }
  const items = [...store.items];
  const template = { ...items[idx], name: cleanName, updatedAt: opts.now ?? new Date().toISOString() };
  items[idx] = template;
  return { store: { version: 1, items }, template, error: null };
}

export function removeCoachAssignment(store: CoachAssignmentsStore, id: string): CoachAssignmentsStore {
  const items = store.items.filter(t => t.id !== id);
  return items.length === store.items.length ? store : { version: 1, items };
}

/** Отметить выдачу (счётчик и дата). Вызывается только после успешной записи. */
export function markCoachAssignmentIssued(
  store: CoachAssignmentsStore,
  id: string,
  opts: { now?: string } = {},
): CoachAssignmentsStore {
  const idx = store.items.findIndex(t => t.id === id);
  if (idx < 0) return store;
  const now = opts.now ?? new Date().toISOString();
  const items = [...store.items];
  items[idx] = { ...items[idx], issuedCount: items[idx].issuedCount + 1, lastIssuedAt: now, updatedAt: now };
  return { version: 1, items };
}

export function findCoachAssignment(store: CoachAssignmentsStore, id: string): CoachAssignmentTemplate | null {
  return store.items.find(t => t.id === id) ?? null;
}

/** Только шаблоны нужного типа — переключатель в интерфейсе не должен листать чужие. */
export function filterCoachAssignments(store: CoachAssignmentsStore, kind: AssignmentKind): CoachAssignmentTemplate[] {
  return store.items.filter(t => t.kind === kind);
}

export function coachAssignmentErrorText(error: CoachAssignmentError): string {
  switch (error) {
    case 'name':
      return 'Название обязательно.';
    case 'limit':
      return `В библиотеке уже ${COACH_ASSIGNMENTS_MAX} назначений — удалите ненужное.`;
    case 'size':
      return 'Назначение слишком большое для библиотеки.';
    case 'duplicate':
      return 'Шаблон с таким названием уже есть — назовите иначе.';
    case 'empty':
      return 'В назначении нет ни одного плана.';
    default:
      return '';
  }
}
