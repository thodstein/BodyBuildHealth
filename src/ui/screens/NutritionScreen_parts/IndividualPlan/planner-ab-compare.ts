/**
 * planner-ab-compare.ts — A/B двух планов питания (волна-3).
 *
 * Пользователь снимает снапшот текущего дня в слот A и слот B (например, до/после
 * перегенерации или два варианта рецептов), затем сравнивает: КБЖУ дня, приёмы,
 * состав продуктов и заметки движка. Хранение — localStorage `he_nutrition_ab_v1`,
 * кап один снапшот на слот (A/B), всё с try/catch (битый сторедж = пустые слоты).
 */

export type AbSlot = 'A' | 'B';

export const AB_SLOTS: AbSlot[] = ['A', 'B'];
export const AB_STORAGE_KEY = 'he_nutrition_ab_v1';

export interface AbItemSnapshot {
  id: string;
  name: string;
  amount: number;
  p: number;
  f: number;
  c: number;
  kcal: number;
}

export interface AbMealSnapshot {
  label: string;
  type?: string;
  time?: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  items: AbItemSnapshot[];
}

export interface AbPlanSnapshot {
  slot: AbSlot;
  savedAt: string;
  name: string;
  totals: { kcal: number; p: number; f: number; c: number; fiber: number };
  meals: AbMealSnapshot[];
  notes: string[];
}

export interface AbDiffRow {
  key: 'kcal' | 'p' | 'f' | 'c' | 'fiber';
  label: string;
  a: number;
  b: number;
  delta: number;
  deltaPct: number | null;
}

export interface AbMealDiff {
  label: string;
  aKcal: number;
  bKcal: number;
  deltaKcal: number;
  aP: number;
  bP: number;
  deltaP: number;
  added: string[];
  removed: string[];
}

export interface AbDiffResult {
  rows: AbDiffRow[];
  meals: AbMealDiff[];
  foodAdded: string[];
  foodRemoved: string[];
  notesAdded: string[];
  notesRemoved: string[];
  summary: string;
}

interface DayPlanLike {
  totals?: { kcal?: number; p?: number; f?: number; c?: number; fiber?: number } | null;
  meals?: Array<{
    label?: string; type?: string; time?: string;
    totals?: { kcal?: number; p?: number; f?: number; c?: number } | null;
    items?: Array<{ id?: string; name?: string; amount?: number; p?: number; f?: number; c?: number; kcal?: number }> | null;
  }> | null;
  notes?: string[] | null;
}

const round1 = (v: number): number => Math.round(v * 10) / 10;

/** Снапшот дня → структура A/B. null при пустом дне/мусоре. */
export function snapshotFromDayPlan(
  slot: AbSlot,
  plan: DayPlanLike | null | undefined,
  opts?: { name?: string },
): AbPlanSnapshot | null {
  if (!plan || !Array.isArray(plan.meals) || plan.meals.length === 0) return null;
  const meals: AbMealSnapshot[] = plan.meals.map(m => ({
    label: String(m?.label || m?.type || 'Приём'),
    type: m?.type ? String(m.type) : undefined,
    time: m?.time ? String(m.time) : undefined,
    kcal: Math.round(m?.totals?.kcal || 0),
    p: round1(m?.totals?.p || 0),
    f: round1(m?.totals?.f || 0),
    c: round1(m?.totals?.c || 0),
    items: (m?.items || []).map(it => ({
      id: String(it?.id || it?.name || ''),
      name: String(it?.name || it?.id || ''),
      amount: round1(it?.amount || 0),
      p: round1(it?.p || 0),
      f: round1(it?.f || 0),
      c: round1(it?.c || 0),
      kcal: Math.round(it?.kcal || 0),
    })).filter(it => it.id),
  })).filter(m => m.items.length > 0 || m.kcal > 0);
  if (meals.length === 0) return null;
  const t = plan.totals || {};
  return {
    slot,
    savedAt: new Date().toISOString(),
    name: String(opts?.name || `${meals.length} приёмов`),
    totals: {
      kcal: Math.round(t.kcal || 0),
      p: round1(t.p || 0),
      f: round1(t.f || 0),
      c: round1(t.c || 0),
      fiber: round1(t.fiber || 0),
    },
    meals,
    notes: (plan.notes || []).map(n => String(n || '')).filter(Boolean).slice(0, 60),
  };
}

export function loadAbSnapshots(storage?: { getItem(k: string): string | null }): Partial<Record<AbSlot, AbPlanSnapshot>> {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return {};
    const parsed = JSON.parse(store.getItem(AB_STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Partial<Record<AbSlot, AbPlanSnapshot>> = {};
    for (const slot of AB_SLOTS) {
      const s = (parsed as any)[slot];
      if (s && typeof s === 'object' && Array.isArray(s.meals) && s.meals.length > 0 && s.totals) {
        out[slot] = s as AbPlanSnapshot;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveAbSnapshot(
  snap: AbPlanSnapshot,
  storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void },
): boolean {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store || !snap) return false;
    const all = { ...loadAbSnapshots(store as any), [snap.slot]: snap };
    store.setItem(AB_STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function removeAbSnapshot(
  slot: AbSlot,
  storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void },
): void {
  try {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return;
    const all = loadAbSnapshots(store as any);
    delete all[slot];
    store.setItem(AB_STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

function deltaRow(key: AbDiffRow['key'], label: string, a: number, b: number): AbDiffRow {
  const delta = round1(b - a);
  return { key, label, a, b, delta, deltaPct: a > 0 ? round1((delta / a) * 100) : null };
}

const fmtDelta = (v: number): string => (v > 0 ? `+${v}` : `${v}`);

/** Дифф B относительно A: КБЖУ дня, приёмы (по подписи), состав, заметки. */
export function diffAbSnapshots(a: AbPlanSnapshot, b: AbPlanSnapshot): AbDiffResult {
  const rows: AbDiffRow[] = [
    deltaRow('kcal', 'Ккал', a.totals.kcal, b.totals.kcal),
    deltaRow('p', 'Белок, г', a.totals.p, b.totals.p),
    deltaRow('f', 'Жиры, г', a.totals.f, b.totals.f),
    deltaRow('c', 'Углеводы, г', a.totals.c, b.totals.c),
    deltaRow('fiber', 'Клетчатка, г', a.totals.fiber, b.totals.fiber),
  ];

  // Приёмы: матч по подписи, затем по индексу (уникальные подписи).
  const meals: AbMealDiff[] = [];
  const bByLabel = new Map<string, AbMealSnapshot>();
  for (const m of b.meals) if (!bByLabel.has(m.label)) bByLabel.set(m.label, m);
  const usedB = new Set<AbMealSnapshot>();
  a.meals.forEach((ma, i) => {
    const mb = bByLabel.get(ma.label) || (!usedB.has(b.meals[i]) ? b.meals[i] : undefined);
    const bm = mb || { label: ma.label, kcal: 0, p: 0, f: 0, c: 0, items: [] as AbItemSnapshot[] };
    usedB.add(bm as AbMealSnapshot);
    const bIds = new Set(bm.items.map(it => it.id));
    const aIds = new Set(ma.items.map(it => it.id));
    meals.push({
      label: ma.label,
      aKcal: ma.kcal,
      bKcal: bm.kcal,
      deltaKcal: bm.kcal - ma.kcal,
      aP: ma.p,
      bP: bm.p,
      deltaP: round1(bm.p - ma.p),
      added: bm.items.filter(it => !aIds.has(it.id)).map(it => `${it.name} ${it.amount}г`),
      removed: ma.items.filter(it => !bIds.has(it.id)).map(it => `${it.name} ${it.amount}г`),
    });
  });
  for (const mb of b.meals) {
    if (usedB.has(mb)) continue;
    meals.push({
      label: `${mb.label} (только B)`,
      aKcal: 0, bKcal: mb.kcal, deltaKcal: mb.kcal, aP: 0, bP: mb.p, deltaP: mb.p,
      added: mb.items.map(it => `${it.name} ${it.amount}г`), removed: [],
    });
  }

  const aFoods = new Map<string, string>();
  const bFoods = new Map<string, string>();
  for (const m of a.meals) for (const it of m.items) aFoods.set(it.id, it.name);
  for (const m of b.meals) for (const it of m.items) bFoods.set(it.id, it.name);
  const foodAdded = [...bFoods.keys()].filter(id => !aFoods.has(id)).map(id => bFoods.get(id) || id);
  const foodRemoved = [...aFoods.keys()].filter(id => !bFoods.has(id)).map(id => aFoods.get(id) || id);

  const aNotes = new Set(a.notes);
  const bNotes = new Set(b.notes);
  const notesAdded = b.notes.filter(n => !aNotes.has(n)).slice(0, 8);
  const notesRemoved = a.notes.filter(n => !bNotes.has(n)).slice(0, 8);

  const kcalD = rows[0].delta;
  const pD = rows[1].delta;
  const cD = rows[3].delta;
  const summary = [
    `B vs A: ${fmtDelta(rows[0].delta)} ккал`,
    `${fmtDelta(pD)} г Б`,
    `${fmtDelta(cD)} г У`,
    kcalD === 0 && pD === 0 && cD === 0 ? '— макросы совпали' : '',
  ].filter(Boolean).join(' · ');

  return { rows, meals, foodAdded, foodRemoved, notesAdded, notesRemoved, summary };
}
