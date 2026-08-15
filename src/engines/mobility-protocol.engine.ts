/**
 * Mobility Protocol Engine — «Мобильность» дневника тренировок.
 *
 * Пользователь собирает личный протокол мобильности из библиотеки блоков
 * (источник — mobility-методики training-methodology.engine: динамическая
 * разминка, статика, PNF, CARs, нагруженная/баллистическая растяжка,
 * мобильность позвоночника, FRC; готовые потоки — federation-grip-mobility.engine).
 *
 * Блоки привязаны к слотам: daily (ежедневная рутина), pre (перед тренировкой,
 * короткая подготовка проблемных зон — НЕ дублирует warmup), post (после
 * тренировки: статика/PNF/нагруженная), rest_day (сессия в день отдыха).
 *
 * В сессии (SessionPlayer) показываются шаги текущего слота с чекбоксами;
 * чек-ины (выполнено + ROM-оценка 1-5) копятся в he_mobility_checks —
 * приверженность и тренды ROM в аналитике вкладки «Мобильность».
 *
 * Отображение-онли: движок НЕ влияет на планирование/авторегуляцию.
 *
 * @module mobility-protocol-engine
 */

import { getMobilityFlows } from './federation-grip-mobility.engine';
import { latestAssessment, summarizeAssessment, weakestTests } from './mobility-assessment.engine';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type MobilitySlot = 'daily' | 'pre' | 'post' | 'rest_day';
export type MobilityDirection = 'pl' | 'bb' | 'both';

export interface MobilityExercise {
  name: string;
  reps: string;
  notes?: string;
}

export interface MobilityItem {
  id: string;
  slot: MobilitySlot;
  title: string;
  script: string;
  durationMin: number;
  /** Имя методики-источника (training-methodology.engine) или «flow» для готового потока. */
  sourceMethod?: string;
  targetAreas?: string[];
  exercises?: MobilityExercise[];
}

export interface MobilityBlock extends MobilityItem {
  /** Для фильтра пресетов. */
  direction: MobilityDirection;
  description: string;
}

export interface MobilityProtocol {
  id: string;
  name: string;
  direction: MobilityDirection;
  items: MobilityItem[];
  createdAt: string;
  updatedAt: string;
}

export interface MobilityCheckin {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  sessionId?: string;
  /** Протокол/рутина дня выполнены. */
  done: boolean;
  /** Оценка ROM/ощущения в суставах после, 1-5 (null = не оценено). */
  romScore: number | null;
  note?: string;
}

export interface MobilityTrends {
  series: { date: string; romScore: number | null }[];
  avgRom: number;
  count: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Storage keys
// ═══════════════════════════════════════════════════════════════════════════

export const MOBILITY_PROTOCOLS_KEY = 'he_mobility_protocols';
export const MOBILITY_ACTIVE_KEY = 'he_mobility_active_protocol_id';
export const MOBILITY_CHECKS_KEY = 'he_mobility_checks';
export const MOBILITY_DAY_PROGRESS_KEY = 'he_mobility_day_progress';

export const SLOT_ORDER: MobilitySlot[] = ['daily', 'pre', 'post', 'rest_day'];

export const SLOT_LABELS: Record<MobilitySlot, string> = {
  daily: 'Ежедневная рутина',
  pre: 'Перед тренировкой',
  post: 'После тренировки',
  rest_day: 'День отдыха',
};

export const DIRECTION_LABELS: Record<MobilityDirection, string> = {
  pl: 'ПЛ (пауэрлифтинг)',
  bb: 'ББ (бодибилдинг)',
  both: 'Универсал',
};

// ═══════════════════════════════════════════════════════════════════════════
// Library (блоки из mobility-методик + готовые flows)
// ═══════════════════════════════════════════════════════════════════════════

function flowToBlock(flow: ReturnType<typeof getMobilityFlows>[number], slot: MobilitySlot, direction: MobilityDirection, description: string): MobilityBlock {
  return {
    id: flow.id || `flow_${flow.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    slot,
    title: flow.name,
    script: `Готовый поток (${flow.durationMin} мин) для зон: ${flow.targetAreas.join(', ')}. Выполняйте упражнения последовательно, дыхание — по подсказкам каждого.`,
    durationMin: flow.durationMin,
    sourceMethod: 'flow',
    targetAreas: flow.targetAreas,
    exercises: flow.exercises.map(e => ({ name: e.name, reps: e.reps, notes: e.notes })),
    direction,
    description,
  };
}

const FLOWS = getMobilityFlows();

export const MOBILITY_LIBRARY: MobilityBlock[] = [
  // ── Ежедневная рутина ──
  {
    id: 'cars_morning', slot: 'daily', title: 'Утренняя рутина CARs (5 мин)',
    script: 'Суставная гимнастика по максимальной амплитуде: плечи 5 кругов вперёд/назад, локти 5×, запястья 5×, шейный отдел 3× медленно, грудной отдел 5×, тазобедренные 5× каждой ногой, колени 5×, голеностоп 5×. Медленно (3-5 сек на круг), с напряжением 20-30% макс, ежедневно.',
    durationMin: 5, sourceMethod: 'Суставная гимнастика и CARs', direction: 'both',
    targetAreas: ['Все суставы'],
    description: 'Ежедневная рутина CARs: синовиальная жидкость, контроль в крайних точках ROM, профилактика.',
  },
  {
    id: 'spine_daily', slot: 'daily', title: 'Мобильность позвоночника (5-10 мин)',
    script: 'cat-cow 10× → thread-the-needle 8×/сторона → open book rotation 10×/сторона → standing trunk rotation 10×/сторона → wall slides 10×. Поясница — стабильность (планка/dead bug при необходимости), грудной — экстензия. Утром и после долгого сидения.',
    durationMin: 8, sourceMethod: 'Мобильность позвоночника (Spinal Mobility)', direction: 'both',
    targetAreas: ['Позвоночник', 'Грудной отдел', 'Шея'],
    description: 'Сегментарная подвижность позвоночника — профилактика спины, глубина приседа/тяги.',
  },
  flowToBlock(FLOWS[0], 'daily', 'both', 'Полный утренний поток: позвоночник, бёдра, плечи (15 мин).'),
  // ── Перед тренировкой (короткая подготовка проблемных зон, НЕ разминка) ──
  {
    id: 'hip_cars_pre', slot: 'pre', title: 'CARs бёдер перед приседом (2 мин)',
    script: 'Перед разминкой: тазобедренные CARs 5 кругов каждой ногой в обе стороны + deep squat hold 30-45 сек с локтями, раздвигающими колени. Готовит бёдра к приседу без статики (статическое растяжение до тренировки снижает силу на 5-10%).',
    durationMin: 2, sourceMethod: 'Суставная гимнастика и CARs', direction: 'pl',
    targetAreas: ['Тазобедренные'],
    description: 'Подготовка таза к приседу/тяге до разминки — без потери силы.',
  },
  {
    id: 'tspine_pre', slot: 'pre', title: 'Грудной отдел перед жимом (2 мин)',
    script: 'Open book stretch 8/сторону + wall slides 10 + thread-the-needle 6/сторону. Освобождает грудной отдел для жима лёжа/над головой. Не статика на грудь!',
    durationMin: 2, sourceMethod: 'Мобильность позвоночника (Spinal Mobility)', direction: 'pl',
    targetAreas: ['Грудной отдел'],
    description: 'Грудная экстензия перед жимовыми движениями.',
  },
  // ── После тренировки ──
  {
    id: 'static_post', slot: 'post', title: 'Статика после тренировки (8-10 мин)',
    script: '2-3 подхода по 20-60 сек на целевые зоны, мягкое натяжение (6/10), без боли и рывков: бицепс бедра (3×30), квадрицепсы (3×30), сгибатели бедра (3×30), грудь (2×45), икры (2×30). Выдох в растяжение. Только ПОСЛЕ тренировки.',
    durationMin: 10, sourceMethod: 'Статическая растяжка (Static Stretching)', direction: 'both',
    targetAreas: ['Бицепс бедра', 'Квадрицепсы', 'Грудь', 'Сгибатели бедра'],
    description: 'Статика после: ROM без потери силы, снижение DOMS.',
  },
  {
    id: 'pnf_post', slot: 'post', title: 'PNF после тренировки (с партнёром)',
    script: 'Contract-relax: (1) пассивное растяжение до натяжения 10 сек, (2) изометрия против рук партнёра 6-10 сек на 50-70% усилия, (3) выдох + расслабление, (4) углубление растяжения 20-30 сек. 2-3 цикла на зону, 1-2×/нед. После PNF мышца временно слабее — только в конце сессии.',
    durationMin: 12, sourceMethod: 'PNF-растяжка (Proprioceptive Neuromuscular Facilitation)', direction: 'pl',
    targetAreas: ['Бицепс бедра', 'Грудь', 'Ягодицы'],
    description: 'Самый быстрый прирост ROM (+10-20° за 4-6 нед), нужен партнёр.',
  },
  {
    id: 'loaded_bb', slot: 'post', title: 'Нагруженная растяжка (stretch-гипертрофия)',
    script: 'Лёгкий вес (25-40% 1RM), пауза 30-90 сек в крайней точке, выдох для углубления: румынская тяга с паузой внизу (бицепс бедра), разводка гантелей с удержанием (грудь), пулловер (широчайшие), сплит-присед с паузой (сгибатели бедра). 2-3 подхода ×1 повтор с длинной паузой, 2×/нед. Цель — растяжение, не утомление.',
    durationMin: 15, sourceMethod: 'Нагруженная растяжка (Loaded Stretching)', direction: 'bb',
    targetAreas: ['Бицепс бедра', 'Грудь', 'Широчайшие'],
    description: 'Растяжение под отягощением: ROM + stretch-mediated гипертрофия (ББ).',
  },
  // ── День отдыха ──
  flowToBlock(FLOWS[1], 'rest_day', 'pl', 'Поток раскрытия бёдер: тазобедренные, пах, ягодицы, поясница (10 мин).'),
  flowToBlock(FLOWS[2], 'rest_day', 'both', 'Поток позвоночник+плечи: ролл, open book, растяжка груди (12 мин).'),
  {
    id: 'loaded_rest', slot: 'rest_day', title: 'Нагруженная растяжка (день отдыха)',
    script: 'Отдельная сессия 15-20 мин: RDL с паузой 45-60 сек внизу + разводка с удержанием 30-45 сек + пулловер с паузой. 2-3 подхода ×1 повтор, вес 25-40% 1RM, 2×/нед.',
    durationMin: 20, sourceMethod: 'Нагруженная растяжка (Loaded Stretching)', direction: 'bb',
    targetAreas: ['Бицепс бедра', 'Грудь', 'Широчайшие'],
    description: 'Полноценная сессия нагруженной растяжки в день отдыха.',
  },
  {
    id: 'pairs_rest', slot: 'rest_day', title: 'PAILs/RAILs (FRC, продвинутый)',
    script: 'Протокол FRC на проблемную зону: пассивное растяжение в крайней точке 2 мин → PAILs (изометрия в растяжении) 10-30 сек, наращивая усилие 50→100% → RAILs (изометрия при выходе) 10-30 сек → новое пассивное растяжение 30 сек. 2-3 цикла, 2-3×/нед. Начинать с 50% усилия.',
    durationMin: 18, sourceMethod: 'FRC (Functional Range Conditioning) — система', direction: 'both',
    targetAreas: ['Проблемная зона'],
    description: 'Активный ROM через изометрию в крайних точках (продвинутый).',
  },
];

export function getMobilityBlockById(id: string): MobilityBlock | null {
  return MOBILITY_LIBRARY.find(b => b.id === id) || null;
}

/** Создать шаг протокола из блока библиотеки (копия с новым id). */
export function mobilityBlockToItem(block: MobilityBlock): MobilityItem {
  return {
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    slot: block.slot,
    title: block.title,
    script: block.script,
    durationMin: block.durationMin,
    sourceMethod: block.sourceMethod,
    targetAreas: block.targetAreas ? [...block.targetAreas] : undefined,
    exercises: block.exercises ? block.exercises.map(e => ({ ...e })) : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Presets (ПЛ / ББ / универсал)
// ═══════════════════════════════════════════════════════════════════════════

const PRESET_RECIPES: Record<Exclude<MobilityDirection, 'both'>, string[]> = {
  pl: ['cars_morning', 'spine_daily', 'hip_cars_pre', 'tspine_pre', 'static_post', 'pnf_post', 'flow_hip_opener', 'flow_spine_shoulder'],
  bb: ['cars_morning', 'spine_daily', 'loaded_bb', 'static_post', 'loaded_rest', 'flow_full_body_morning'],
};

const UNIVERSAL_RECIPE: string[] = ['cars_morning', 'spine_daily', 'static_post', 'flow_hip_opener', 'flow_spine_shoulder'];

export const PRESET_LABELS: Record<MobilityDirection, string> = {
  pl: 'ПЛ: спина/бёдра под присед-тягу, статика+PNF после, потоки в отдых',
  bb: 'ББ: CARs ежедневно, нагруженная растяжка (stretch-гипертрофия), статика',
  both: 'Универсал: CARs + позвоночник + статика + потоки',
};

export function buildPresetMobility(direction: MobilityDirection): MobilityProtocol {
  const recipe = direction === 'both' ? UNIVERSAL_RECIPE
    : direction === 'pl' ? PRESET_RECIPES.pl : PRESET_RECIPES.bb;
  const items: MobilityItem[] = recipe
    .map(id => getMobilityBlockById(id))
    .filter((b): b is MobilityBlock => !!b)
    .map(mobilityBlockToItem);
  const now = new Date().toISOString();
  return {
    id: `mob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `Мобильность: ${DIRECTION_LABELS[direction]}`,
    direction,
    items,
    createdAt: now,
    updatedAt: now,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Sanitizers
// ═══════════════════════════════════════════════════════════════════════════

const VALID_SLOTS: MobilitySlot[] = ['daily', 'pre', 'post', 'rest_day'];
const VALID_DIRECTIONS: MobilityDirection[] = ['pl', 'bb', 'both'];

function clampRom(v: unknown): number | null {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0;
  if (n <= 0) return null;
  return Math.min(5, Math.max(1, n));
}

export function sanitizeMobilityItem(raw: any): MobilityItem | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.title !== 'string' || raw.title.trim() === '') return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    slot: VALID_SLOTS.includes(raw.slot) ? raw.slot : 'daily',
    title: raw.title,
    script: typeof raw.script === 'string' ? raw.script : '',
    durationMin: typeof raw.durationMin === 'number' && Number.isFinite(raw.durationMin) && raw.durationMin >= 0 ? Math.round(raw.durationMin) : 1,
    sourceMethod: typeof raw.sourceMethod === 'string' ? raw.sourceMethod : undefined,
    targetAreas: Array.isArray(raw.targetAreas) ? raw.targetAreas.filter((x: unknown): x is string => typeof x === 'string') : undefined,
    exercises: Array.isArray(raw.exercises)
      ? raw.exercises.filter((e: any) => e && typeof e.name === 'string').map((e: any) => ({ name: e.name, reps: typeof e.reps === 'string' ? e.reps : '', notes: typeof e.notes === 'string' ? e.notes : undefined }))
      : undefined,
  };
}

export function sanitizeMobilityProtocol(raw: any): MobilityProtocol | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.name !== 'string' || raw.name.trim() === '') return null;
  const items = Array.isArray(raw.items)
    ? (raw.items as any[]).map(r => sanitizeMobilityItem(r)).filter((x): x is MobilityItem => !!x)
    : [];
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `mob_${Date.now()}`,
    name: raw.name,
    direction: VALID_DIRECTIONS.includes(raw.direction) ? raw.direction : 'both',
    items,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

export function sanitizeMobilityCheckin(raw: any): MobilityCheckin | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(raw.date)) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `mchk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: raw.date.slice(0, 10),
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : undefined,
    done: typeof raw.done === 'boolean' ? raw.done : false,
    romScore: clampRom(raw.romScore),
    note: typeof raw.note === 'string' ? raw.note : undefined,
  };
}

function readJSON(key: string): any[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function writeJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota — игнор */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// Protocol CRUD
// ═══════════════════════════════════════════════════════════════════════════

export function loadMobilityProtocols(): MobilityProtocol[] {
  return readJSON(MOBILITY_PROTOCOLS_KEY).map(sanitizeMobilityProtocol).filter((p): p is MobilityProtocol => !!p);
}

export function saveMobilityProtocols(list: MobilityProtocol[]): void {
  writeJSON(MOBILITY_PROTOCOLS_KEY, Array.isArray(list) ? list : []);
}

export function createMobilityProtocol(name: string, direction: MobilityDirection, items: MobilityItem[] = []): MobilityProtocol {
  const now = new Date().toISOString();
  return {
    id: `mob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'Мой протокол мобильности',
    direction,
    items: items.map(sanitizeMobilityItem).filter((x): x is MobilityItem => !!x),
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertMobilityProtocol(protocol: MobilityProtocol): MobilityProtocol[] {
  const list = loadMobilityProtocols();
  const clean = sanitizeMobilityProtocol(protocol);
  if (!clean) return list;
  const idx = list.findIndex(p => p.id === clean.id);
  const updated: MobilityProtocol = { ...clean, updatedAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = updated;
  else list.push(updated);
  saveMobilityProtocols(list);
  return list;
}

export function deleteMobilityProtocol(id: string): MobilityProtocol[] {
  const list = loadMobilityProtocols().filter(p => p.id !== id);
  saveMobilityProtocols(list);
  try {
    if (localStorage.getItem(MOBILITY_ACTIVE_KEY) === id) localStorage.removeItem(MOBILITY_ACTIVE_KEY);
  } catch { /* ignore */ }
  return list;
}

export function duplicateMobilityProtocol(id: string): MobilityProtocol[] {
  const list = loadMobilityProtocols();
  const src = list.find(p => p.id === id);
  if (!src) return list;
  const now = new Date().toISOString();
  const copy: MobilityProtocol = {
    ...src,
    id: `mob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `${src.name} (копия)`,
    items: src.items.map(it => ({ ...it, id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` })),
    createdAt: now,
    updatedAt: now,
  };
  list.push(copy);
  saveMobilityProtocols(list);
  return list;
}

export function loadActiveMobility(): MobilityProtocol | null {
  const list = loadMobilityProtocols();
  try {
    const id = localStorage.getItem(MOBILITY_ACTIVE_KEY);
    if (id) {
      const found = list.find(p => p.id === id);
      if (found) return found;
    }
  } catch { /* ignore */ }
  return list[0] || null;
}

export function setActiveMobility(id: string | null): void {
  try {
    if (id) localStorage.setItem(MOBILITY_ACTIVE_KEY, id);
    else localStorage.removeItem(MOBILITY_ACTIVE_KEY);
  } catch { /* ignore */ }
}

/** Шаги протокола для слота (порядок не важен — слот задаёт группировку). */
export function itemsForSlot(protocol: MobilityProtocol | null, slot: MobilitySlot): MobilityItem[] {
  if (!protocol || !Array.isArray(protocol.items)) return [];
  return protocol.items.filter(it => it && it.slot === slot);
}

/** Есть ли у протокола ежедневная рутина (для напоминаний). */
export function hasDailyRoutine(protocol: MobilityProtocol | null): boolean {
  return !!protocol && Array.isArray(protocol.items) && protocol.items.some(it => it.slot === 'daily');
}

// ═══════════════════════════════════════════════════════════════════════════
// Check-ins
// ═══════════════════════════════════════════════════════════════════════════

export function loadMobilityCheckins(): MobilityCheckin[] {
  return readJSON(MOBILITY_CHECKS_KEY)
    .map(sanitizeMobilityCheckin)
    .filter((c): c is MobilityCheckin => !!c)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Upsert чек-ина (замена по date+sessionId). Возвращает полный список. */
export function upsertMobilityCheckin(input: Omit<MobilityCheckin, 'id'>): MobilityCheckin[] {
  const list = loadMobilityCheckins();
  const key = (c: MobilityCheckin) => `${c.date}|${c.sessionId || ''}`;
  const target = key({ ...input, id: '' } as MobilityCheckin);
  const idx = list.findIndex(c => key(c) === target);
  const entry: MobilityCheckin = {
    id: idx >= 0 ? list[idx].id : `mchk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    done: !!input.done,
    romScore: clampRom(input.romScore),
  };
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  writeJSON(MOBILITY_CHECKS_KEY, list);
  return list;
}

export function latestMobilityCheckin(): MobilityCheckin | null {
  const list = loadMobilityCheckins();
  return list.length > 0 ? list[list.length - 1] : null;
}

/** Приверженность: доля дней с выполненной рутиной/сессией за N дней. */
export function mobilityAdherence(days = 30): { done: number; total: number; pct: number } {
  const list = loadMobilityCheckins();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const floor = since.toISOString().slice(0, 10);
  const recent = list.filter(c => c.date >= floor);
  const done = recent.filter(c => c.done).length;
  return {
    done,
    total: recent.length,
    pct: recent.length > 0 ? Math.round(done / recent.length * 100) : 0,
  };
}

export function mobilityTrends(days = 30): MobilityTrends {
  const list = loadMobilityCheckins().slice(-days);
  const scored = list.filter(c => c.romScore !== null);
  const avg = scored.length > 0
    ? Math.round(scored.reduce((s, c) => s + (c.romScore || 0), 0) / scored.length * 10) / 10
    : 0;
  return {
    series: list.map(c => ({ date: c.date, romScore: c.romScore })),
    avgRom: avg,
    count: list.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Day progress (чекбоксы панели сессии)
// ═══════════════════════════════════════════════════════════════════════════

export interface MobilityDayProgress {
  date: string;
  doneItems: string[];
}

export function loadMobilityDayProgress(date?: string): MobilityDayProgress {
  const key = date || new Date().toISOString().slice(0, 10);
  try {
    const raw = JSON.parse(localStorage.getItem(MOBILITY_DAY_PROGRESS_KEY) || 'null');
    if (raw && raw.date === key && Array.isArray(raw.doneItems)) {
      return { date: key, doneItems: raw.doneItems.filter((x: unknown): x is string => typeof x === 'string') };
    }
  } catch { /* ignore */ }
  return { date: key, doneItems: [] };
}

export function saveMobilityDayProgress(progress: MobilityDayProgress): void {
  try { localStorage.setItem(MOBILITY_DAY_PROGRESS_KEY, JSON.stringify(progress)); } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

export function exportMobilityCheckinsCSV(): string {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const rows: string[] = ['date,session_id,done,rom_score,note'];
  for (const c of loadMobilityCheckins()) {
    rows.push([
      c.date,
      c.sessionId ? esc(c.sessionId) : '',
      c.done ? 1 : 0,
      c.romScore === null ? '' : c.romScore,
      c.note ? esc(c.note) : '',
    ].join(','));
  }
  return rows.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// Insights
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Персональные инсайты мобильности: приверженность, ROM-тренд, покрытие слотов.
 * Отображение-онли — рекомендации не меняют план.
 */
export function buildMobilityInsights(protocol: MobilityProtocol | null): string[] {
  const out: string[] = [];
  if (!protocol) {
    out.push('Протокол мобильности ещё не собран. Начните с пресета (ПЛ / ББ / универсал) — рутина появится в сессии перед тренировкой.');
    return out;
  }
  if (protocol.items.length === 0) {
    out.push('Протокол пуст. Добавьте блоки из библиотеки или примените пресет.');
    return out;
  }
  const adherence = mobilityAdherence(30);
  if (adherence.total >= 3) {
    if (adherence.pct >= 70) out.push(`Рутина выполняется в ${adherence.pct}% дней — отличная последовательность. Держите ритм: эффект CARs/позвоночника накопительный.`);
    else if (adherence.pct >= 35) out.push(`Рутина выполняется в ${adherence.pct}% дней. Сократите протокол до 1-2 самых ценных блоков в день — короткая рутина выполняется чаще.`);
    else out.push(`Рутина выполняется только в ${adherence.pct}% дней. Начните с одного ежедневного блока (например, CARs 5 мин) и закрепите его неделю.`);
  }
  const trends = mobilityTrends(30);
  if (trends.count >= 3 && trends.avgRom > 0) {
    if (trends.avgRom <= 2.5) out.push(`Средняя оценка ROM ${trends.avgRom}/5 — суставы «жёсткие». Добавьте ежедневную рутину и проверьте объём: возможно, нужен делод или больше растяжки после тренировок.`);
    else if (trends.avgRom >= 4) out.push(`Средняя оценка ROM ${trends.avgRom}/5 — отличная подвижность. Поддерживайте её рутиной, при необходимости усложняйте (PNF, нагруженная).`);
  }
  const hasDaily = hasDailyRoutine(protocol);
  const hasRest = itemsForSlot(protocol, 'rest_day').length > 0;
  const hasPost = itemsForSlot(protocol, 'post').length > 0;
  if (!hasDaily) out.push('В протоколе нет ежедневной рутины (слот «Ежедневная рутина») — добавьте CARs или мобильность позвоночника: эффект накопительный, без ежедневности он теряется.');
  if (!hasRest) out.push('Нет сессий в дни отдыха — добавьте поток (бёдра/позвоночник) в слот «День отдыха»: дни без тренировки — лучшее время для глубокой мобильности.');
  if (!hasPost) out.push('Нет растяжки после тренировки — статика/PNF после сессии дают ROM без потери силы и снижают DOMS.');
  const ass = latestAssessment();
  if (ass) {
    const sum = summarizeAssessment(ass);
    if (sum.scored > 0) {
      const weak = weakestTests(ass);
      if (weak.length > 0) {
        const names = weak.slice(0, 3).map(w => w.test.area.split(' / ')[0]).join(', ');
        out.push(`Оценка мобильности от ${ass.date}: ${sum.total}/${sum.max} (${sum.pct}%). Слабые зоны: ${names}${weak.length > 3 ? ' и др.' : ''}. Добавьте корректирующие блоки (кнопка «＋ Коррективы» в карточке оценки).`);
      } else {
        out.push(`Оценка мобильности от ${ass.date}: ${sum.total}/${sum.max} (${sum.pct}%) — все зоны в норме. Поддерживайте рутиной и пере-оценивайте раз в 2-4 недели.`);
      }
    }
  }
  if (out.length === 0) out.push('Протокол сбалансирован. Отмечайте выполнение и ROM — появятся персональные рекомендации.');
  return out;
}
