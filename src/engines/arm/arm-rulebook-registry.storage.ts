import {
  ARM_RULEBOOK_REGISTRY,
  createRulebookRegistry,
  type RulebookRegistry,
  type RulebookSnapshot,
} from './arm-rulebook';

export const ARM_RULEBOOK_STORAGE_KEY = 'he_arm_rulebook_registry_v1';

export interface RulebookStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function storageOrNull(): RulebookStorage | null {
  try {
    if (typeof globalThis === 'undefined') return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSnapshot(value: unknown): value is RulebookSnapshot {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 1 || typeof value.id !== 'string' || typeof value.authority !== 'string') return false;
  if (typeof value.version !== 'string' || typeof value.scope !== 'string' || !Array.isArray(value.sources)) return false;
  if (!isRecord(value.rules) || typeof value.rules.kind !== 'string') return false;
  if (value.rules.kind === 'waf') return Array.isArray(value.rules.categories);
  if (value.rules.kind === 'armlifting_usa') return Array.isArray(value.rules.protocols);
  return false;
}

function isRegistry(value: unknown): value is RulebookRegistry {
  return isRecord(value) && value.schemaVersion === 1 && Array.isArray(value.snapshots) && value.snapshots.length > 0 && value.snapshots.every(isSnapshot);
}

export function loadArmRulebookRegistry(storage: RulebookStorage | null = storageOrNull()): RulebookRegistry {
  if (!storage) return ARM_RULEBOOK_REGISTRY;
  try {
    const raw = storage.getItem(ARM_RULEBOOK_STORAGE_KEY);
    if (!raw) return ARM_RULEBOOK_REGISTRY;
    const parsed: unknown = JSON.parse(raw);
    if (!isRegistry(parsed)) return ARM_RULEBOOK_REGISTRY;
    return createRulebookRegistry(parsed.snapshots);
  } catch {
    return ARM_RULEBOOK_REGISTRY;
  }
}

export function saveArmRulebookRegistry(
  registry: RulebookRegistry,
  storage: RulebookStorage | null = storageOrNull(),
): boolean {
  if (!storage || !isRegistry(registry)) return false;
  try {
    storage.setItem(ARM_RULEBOOK_STORAGE_KEY, JSON.stringify(registry));
    return true;
  } catch {
    return false;
  }
}

export function clearArmRulebookRegistry(storage: RulebookStorage | null = storageOrNull()): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(ARM_RULEBOOK_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
