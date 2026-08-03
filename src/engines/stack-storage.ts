import { SUPPORT_CATALOG_DATA } from '../data/support-database';

export const SUPPORT_STACKS_KEY = 'savedStacks';

export interface StoredSupportStack {
  id: string;
  name: string;
  subs: string[];
  dosages: Record<string, { mg?: number; timing?: string }>;
  date: string;
  notes?: string;
}

function makeId(prefix = 'stack'): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {}
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRecord(raw: unknown, index: number): StoredSupportStack | null {
  if (Array.isArray(raw)) {
    const subs = raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
    return {
      id: makeId(),
      name: `Стек ${index + 1}`,
      subs,
      dosages: {},
      date: new Date().toISOString(),
      notes: '',
    };
  }
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const rawIds: unknown = Array.isArray(value.subs) ? value.subs : value.ids;
  const subs = (Array.isArray(rawIds) ? rawIds : [])
    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
  if (!subs.length) return null;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : makeId(),
    name: typeof value.name === 'string' && value.name ? value.name : `Стек ${index + 1}`,
    subs,
    dosages: value.dosages && typeof value.dosages === 'object' ? value.dosages as StoredSupportStack['dosages'] : {},
    date: typeof value.date === 'string' ? value.date : (typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString()),
    notes: typeof value.notes === 'string' ? value.notes : undefined,
  };
}

function parseRecords(raw: string | null): StoredSupportStack[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRecord).filter((x): x is StoredSupportStack => x !== null);
  } catch {
    return [];
  }
}

export function readSupportStacks(): StoredSupportStack[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem('savedStacks');
  return parseRecords(raw);
}

export function writeSupportStacks(stacks: StoredSupportStack[]): void {
  if (typeof localStorage === 'undefined') return;
  const normalized = stacks.map(normalizeRecord).filter((x): x is StoredSupportStack => x !== null);
  localStorage.setItem('savedStacks', JSON.stringify(normalized));
}

export function getStackDisplayName(stack: StoredSupportStack): string {
  if (stack.name && stack.name !== `Стек ${stack.id}`) return stack.name;
  const names = stack.subs.map(id => SUPPORT_CATALOG_DATA[id]?.nameRu || SUPPORT_CATALOG_DATA[id]?.name || id);
  return names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
}