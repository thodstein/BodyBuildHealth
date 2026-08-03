export const BIOSTACK_STACKS_KEY = 'he_biostack_stacks_v2';
export const LEGACY_SUPPORT_STACKS_KEY = 'savedStacks';
export const LEGACY_FINDER_STACKS_KEY = 'he_finder_saved_stacks';
export const LEGACY_BIOSTACK_STACKS_KEY = 'he_biostack_stacks';

export interface StoredBioStack {
  id: string;
  name: string;
  ids: string[];
  /** Legacy alias used by SupportScreen. */
  subs?: string[];
  profileSnapshot: unknown | null;
  createdAt: string;
  version: number;
  notes?: string;
  dosages?: Record<string, { mg?: number; timing?: string }>;
}

function makeId(prefix = 'stack'): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {}
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRecord(raw: unknown, index: number): StoredBioStack | null {
  if (Array.isArray(raw)) {
    const ids = raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
    return {
      id: makeId(), name: `Стек ${index + 1}`, ids, subs: ids,
      profileSnapshot: null, createdAt: new Date().toISOString(), version: 2,
    };
  }
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const rawIds: unknown = Array.isArray(value.ids) ? value.ids : value.subs;
  const ids = (Array.isArray(rawIds) ? rawIds : [])
    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
  if (!ids.length) return null;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : makeId(),
    name: typeof value.name === 'string' && value.name ? value.name : `Стек ${index + 1}`,
    ids: [...new Set(ids)], subs: [...new Set(ids)],
    profileSnapshot: value.profileSnapshot ?? null,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : (typeof value.date === 'string' ? value.date : new Date().toISOString()),
    version: typeof value.version === 'number' ? value.version : 2,
    notes: typeof value.notes === 'string' ? value.notes : undefined,
    dosages: value.dosages && typeof value.dosages === 'object' ? value.dosages as StoredBioStack['dosages'] : undefined,
  };
}

function parseRecords(raw: string | null): StoredBioStack[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRecord).filter((x): x is StoredBioStack => x !== null);
  } catch {
    return [];
  }
}

export function readBioStackStacks(): StoredBioStack[] {
  if (typeof localStorage === 'undefined') return [];
  const current = parseRecords(localStorage.getItem(BIOSTACK_STACKS_KEY));
  if (current.length) return current;

  const legacySupport = parseRecords(localStorage.getItem(LEGACY_SUPPORT_STACKS_KEY));
  const legacyFinder = parseRecords(localStorage.getItem(LEGACY_FINDER_STACKS_KEY));
  const legacyBioStack = parseRecords(localStorage.getItem(LEGACY_BIOSTACK_STACKS_KEY));
  const migrated = [...legacySupport, ...legacyFinder, ...legacyBioStack];
  const unique = migrated.filter((stack, index, all) => all.findIndex(item => item.id === stack.id) === index);
  if (unique.length) {
    writeBioStackStacks(unique);
    localStorage.removeItem(LEGACY_BIOSTACK_STACKS_KEY);
  }
  return unique;
}

export function writeBioStackStacks(stacks: unknown[]): void {
  if (typeof localStorage === 'undefined') return;
  const normalized = stacks.map(normalizeRecord).filter((x): x is StoredBioStack => x !== null);
  localStorage.setItem(BIOSTACK_STACKS_KEY, JSON.stringify(normalized));
  // Keep old readers functional during the migration window, but never make it authoritative.
  localStorage.setItem(LEGACY_SUPPORT_STACKS_KEY, JSON.stringify(normalized));
}
