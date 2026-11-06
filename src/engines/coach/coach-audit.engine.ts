/**
 * coach-audit.engine.ts — журнал действий тренера (устройственный).
 *
 * ЗАЧЕМ. Когда атлетов много, вопрос «кто и когда выдал/удалил программу» рано
 * или поздно возникает. Полный лог с именами и содержимым — лишняя копия чужих
 * персональных данных. Поэтому здесь только: событие, время и id атлета.
 *
 * ПРАВИЛА:
 *  • ключ `he_coach_audit` — устройственный: при входе в данные атлета журнал
 *    тренера не должен исчезать;
 *  • никаких имён, программ, заметок и текстов — только вид события и `athleteId`;
 *  • хвост ограничен (500): журнал диагностический, а не архив. Старые события
 *    вытесняются по одному, и это единственное место, где вытеснение допустимо;
 *  • битый JSON/чужая версия → пустой журнал, без исключений;
 *  • «добавить» не бросает при переполнении localStorage: событие просто не
 *    запишется, а данные атлета важнее журнала.
 */
export const COACH_AUDIT_KEY = 'he_coach_audit';
export const COACH_AUDIT_MAX = 500;

export type CoachAuditKind =
  | 'athlete-added'
  | 'athlete-updated'
  | 'athlete-status'
  | 'athlete-removed'
  | 'athlete-data-deleted'
  | 'athletes-forgotten'
  | 'space-entered'
  | 'invite-created'
  | 'invite-rotated'
  | 'invite-revoked'
  | 'space-joined'
  | 'space-left'
  | 'program-saved'
  | 'program-issued'
  | 'program-imported'
  | 'program-exported'
  | 'copy-exported'
  | 'copy-imported'
  | 'reminders-enabled'
  | 'reminders-disabled'
  | 'pin-enabled'
  | 'pin-disabled'
  | 'locked';

export interface CoachAuditEvent {
  id: string;
  kind: CoachAuditKind;
  /** ISO-событие (не календарная дата). */
  at: string;
  athleteId: string | null;
}

export interface CoachAuditStore {
  version: 1;
  items: CoachAuditEvent[];
}

const KINDS: readonly CoachAuditKind[] = [
  'athlete-added',
  'athlete-updated',
  'athlete-status',
  'athlete-removed',
  'athlete-data-deleted',
  'athletes-forgotten',
  'space-entered',
  'invite-created',
  'invite-rotated',
  'invite-revoked',
  'space-joined',
  'space-left',
  'program-saved',
  'program-issued',
  'program-imported',
  'program-exported',
  'copy-exported',
  'copy-imported',
  'reminders-enabled',
  'reminders-disabled',
  'pin-enabled',
  'pin-disabled',
  'locked',
];

export function emptyCoachAudit(): CoachAuditStore {
  return { version: 1, items: [] };
}

const isKind = (v: unknown): v is CoachAuditKind => KINDS.includes(v as CoachAuditKind);

export function parseCoachAudit(raw: string | null | undefined): CoachAuditStore {
  if (!raw) return emptyCoachAudit();
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; items?: unknown } | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 || !Array.isArray(parsed.items)) {
      return emptyCoachAudit();
    }
    const items: CoachAuditEvent[] = [];
    for (const raw2 of parsed.items as unknown[]) {
      if (!raw2 || typeof raw2 !== 'object') continue;
      const e = raw2 as Record<string, unknown>;
      if (!isKind(e.kind)) continue;
      items.push({
        id: String(e.id ?? '').slice(0, 80) || `e_${items.length}`,
        kind: e.kind,
        at: typeof e.at === 'string' ? e.at : '',
        athleteId: typeof e.athleteId === 'string' && e.athleteId ? e.athleteId.slice(0, 80) : null,
      });
    }
    return { version: 1, items: items.slice(-COACH_AUDIT_MAX) };
  } catch {
    return emptyCoachAudit();
  }
}

export function serializeCoachAudit(store: CoachAuditStore): string {
  return JSON.stringify(store);
}

export function readCoachAudit(storage: { getItem?: (k: string) => string | null } | null | undefined): CoachAuditStore {
  if (!storage || typeof storage.getItem !== 'function') return emptyCoachAudit();
  try {
    return parseCoachAudit(storage.getItem(COACH_AUDIT_KEY));
  } catch {
    return emptyCoachAudit();
  }
}

export function writeCoachAudit(
  storage: { setItem?: (k: string, v: string) => void } | null | undefined,
  store: CoachAuditStore,
): CoachAuditStore {
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(COACH_AUDIT_KEY, serializeCoachAudit(store));
    } catch {
      /* журнал не важнее данных атлета */
    }
  }
  return store;
}

export function addCoachAuditEvent(
  store: CoachAuditStore,
  kind: CoachAuditKind,
  opts: { athleteId?: string | null; id?: string; now?: string } = {},
): CoachAuditStore {
  const at = opts.now ?? new Date().toISOString();
  const event: CoachAuditEvent = {
    id: opts.id ?? `e_${at}_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    at,
    athleteId: opts.athleteId ? opts.athleteId.slice(0, 80) : null,
  };
  const items = [...store.items, event];
  return {
    version: 1,
    items: items.length > COACH_AUDIT_MAX ? items.slice(items.length - COACH_AUDIT_MAX) : items,
  };
}

/**
 * Слияние двух журналов (локального и облачного) по `id`.
 *
 * ЗАЧЕМ. Журнал синхронизируется как устройственный ключ. Без слияния два
 * телефона затирали бы события друг друга по принципу «кто последний записал».
 * Здесь объединяем без потерь, сортируем по времени и держим тот же потолок.
 */
export function mergeCoachAudit(
  a: string | null | undefined,
  b: string | null | undefined,
): CoachAuditStore {
  const byId = new Map<string, CoachAuditEvent>();
  for (const store of [parseCoachAudit(a), parseCoachAudit(b)]) {
    for (const event of store.items) {
      if (!byId.has(event.id)) byId.set(event.id, event);
    }
  }
  const items = [...byId.values()].sort((x, y) => {
    if (x.at !== y.at) return x.at < y.at ? -1 : 1;
    if (x.id === y.id) return 0;
    return x.id < y.id ? -1 : 1;
  });
  return {
    version: 1,
    items: items.length > COACH_AUDIT_MAX ? items.slice(items.length - COACH_AUDIT_MAX) : items,
  };
}

/** Последние события первыми — так их и показывает UI. */
export function recentAudit(store: CoachAuditStore, limit = 20): CoachAuditEvent[] {
  return [...store.items].reverse().slice(0, Math.max(0, limit));
}

export function auditLabel(kind: CoachAuditKind): string {
  switch (kind) {
    case 'athlete-added':
      return 'добавлен атлет';
    case 'athlete-updated':
      return 'карточка изменена';
    case 'athlete-status':
      return 'сменён статус';
    case 'athlete-removed':
      return 'удалена карточка';
    case 'athlete-data-deleted':
      return 'удалены данные атлета';
    case 'athletes-forgotten':
      return 'забыты все атлеты';
    case 'space-entered':
      return 'открыты данные атлета';
    case 'invite-created':
      return 'создан код для телефона атлета';
    case 'invite-rotated':
      return 'код доступа сменён';
    case 'invite-revoked':
      return 'доступ с телефона отозван';
    case 'space-joined':
      return 'подключены данные тренера';
    case 'space-left':
      return 'отключены данные тренера';
    case 'program-saved':
      return 'программа снята в библиотеку';
    case 'program-issued':
      return 'программа выдана';
    case 'program-imported':
      return 'программа импортирована из файла';
    case 'program-exported':
      return 'программа выгружена файлом';
    case 'copy-exported':
      return 'копия атлета выгружена';
    case 'copy-imported':
      return 'атлет восстановлен из копии';
    case 'reminders-enabled':
      return 'напоминания включены';
    case 'reminders-disabled':
      return 'напоминания выключены';
    case 'pin-enabled':
      return 'PIN включён';
    case 'pin-disabled':
      return 'PIN выключен';
    case 'locked':
      return 'профиль заблокирован';
    default:
      return String(kind);
  }
}
