/**
 * bb-packing.engine.ts — Packing-v2: заливка упражнений до индивидуального капа.
 *
 * Проблема: при BIG-объёмах ровный делёж сетов даёт 15–20 упражнений на
 * сессию (структурный пол: объём ÷ кап 5 × гарантии разнообразия).
 * Packing льёт сеты в терпеливые движения до их капа: тот же недельный
 * объём, меньше движений (качество > количество).
 *
 * Капы (утверждены пользователем):
 *  - терпеливые — до 6 (широкий верхний блок, Т-тяга, seal row, ...);
 *  - средние — до 5;
 *  - фикс-категория — стоят на своих 3–4, заливка их не трогает
 *    (финишеры, разводки, махи, икры, MGF-слоты, weak-optional, разминка,
 *    FST-7/GVT-помеченные).
 * Залитые сеты идут пирамидой через существующий backoffWeights
 * (топ-сет 100%, дальше −10%/−7.5%) — новой математики весов нет.
 *
 * Правила безопасности (уроки откаченного v1):
 *  - только opt-in флаг packingV2 (дефолт выкл — legacy байт-в-байт);
 *  - пилот: только мышца back, только фазы accumulation/intensification;
 *  - скип при weak/focus/spec-цели, градированных заменах, deload;
 *  - терпеливые 6 выше глобального капа 5 — только под флагом;
 *  - объём инвариантен: сумма розданных сетов = pl.sets ровно.
 */

import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { isAxialLoadExercise } from '../exercise-selector.engine';
import { STRICT_EXERCISE_GROUPS, strictGroupMatches } from './bb-exercise-selection.engine';
import { derivePattern } from '../movement-pattern';

/**
 * Packing-v2: какие мышцы пакуются (остальные — ровный legacy-делёж).
 * Плечи/руки/икры вне скоупа осознанно: бюджеты мизерные (флоры ≈ totals),
 * паковать нечего — дистрибьютор всё равно вернул бы legacy.
 * Ноги (квадры/хамсы/ягодицы) ИСКЛЮЧЕНЫ полностью (даже перераспределение):
 * любое изменение формы меняет косвенный микс → MEV-фидеры флиппуют через
 * порог (доказано дампами матрицы: quads +3, hams +1 слот, glutes +4 —
 * всё докидки гарантий, не заливка). Сбросы хвостов — только спине/груди,
 * где молчаливые докиды доказано отсутствуют.
 */
export const PACKING_MUSCLES = ['back', 'chest'];

/** Явные оверрайды packing-капа по id упражнения (бьют правило ниже). */
export const PACKING_OVERRIDES: Record<string, number> = {
  // Якоря пользователя (спина, терпеливые):
  pulldown_wide: 6,
  pulldown_vbar: 6,
  pullup_wide: 6,
  row_tbar: 6,
  tbar_row_v2: 6,
  row_seal: 6,
  row_db: 5,
  row_chest_supported: 6,
  seated_row: 5,
  // Задел под расширение пилота (dormant, пока пилот back-only):
  bench_bar: 6,
  squat_bar: 6,
  leg_press: 6,
  deadlift_romanian: 5,
};

export interface PackingCap {
  /** Потолок заливки для упражнения. */
  cap: number;
  /** true = не паковать вообще (держим ровную долю, кламп 3–4). */
  noPack: boolean;
}

const NOPACK_MARKERS = /MGF\/IGF1 слот|MGF pump slot|FST-7|GVT|8×8|gironda|Optional: слабая группа/i;

/**
 * Packing-cap упражнения: правило по свойствам + явные оверрайды.
 * Правило: compound → 5, isolation → 4; машина/Смит → +1 (потолок 6);
 * осевое → −1 (не выше 4); одностороннее → −1. Кламп 2..6.
 */
export function packingCapFor(ex: {
  id?: string;
  name?: string;
  type?: string;
  exerciseType?: string;
  equipment?: string | string[];
  comment?: string;
  rationale?: string;
  warmupActivator?: boolean;
}, muscle?: string): PackingCap {
  if ((ex as any).warmupActivator) return { cap: 0, noPack: true };
  // Икорная пара (стоя + сидя) обязана остаться парой — не пакуем.
  if (muscle === 'calves') return { cap: 0, noPack: true };
  const text = `${(ex as any).comment || ''} ${(ex as any).rationale || ''}`;
  if (NOPACK_MARKERS.test(text)) return { cap: 0, noPack: true };
  const id = String((ex as any).id || '');
  if (id && PACKING_OVERRIDES[id] !== undefined) {
    return { cap: Math.max(2, Math.min(6, PACKING_OVERRIDES[id])), noPack: false };
  }
  const cat = EXERCISE_CATALOG.find(c => (id && c.id === id) || (ex.name && c.name === ex.name)) as any;
  const type = String((ex as any).exerciseType || (ex as any).type || cat?.type || 'compound').toLowerCase();
  const equipRaw = (ex as any).equipment ?? cat?.equipment ?? '';
  const equip = (Array.isArray(equipRaw) ? equipRaw.join(' ') : String(equipRaw)).toLowerCase();
  const nm = String((ex as any).name || '').toLowerCase();
  let cap = type.includes('isolat') ? 4 : 5;
  if (/machine|smith|тренаж|смит|машин/.test(equip)) cap = Math.min(6, cap + 1);
  try {
    if (isAxialLoadExercise({ name: (ex as any).name || '', equipment: equip } as any)) cap = Math.min(4, cap - 1);
  } catch { /* одно упражнение не ломает распределение */ }
  if (/одной рук|one.?arm|single.?arm/.test(nm)) cap -= 1;
  return { cap: Math.max(2, Math.min(6, cap)), noPack: false };
}

/**
 * Чистое распределение total сетов по упражнениям.
 * floors[i] — минимум каждому (exMin legacy); locked[i] — фикс-категория
 * (держим кламп ровной доли 3–4); caps[i] — потолки заливки.
 * Порядок заливки остатка: cap по убыванию, ties — исходный порядок
 * (стабильно, лид первым т.к. tolerant-compound обычно первый).
 * Возвращает null при невозможности (locked > total или caps < total) —
 * вызывающий падает на legacy ровный делёж (объём свят).
 */
export function distributePackingSets(
  total: number,
  floors: number[],
  caps: number[],
  locked: boolean[],
  evenShare: number,
): number[] | null {
  const n = floors.length;
  if (n === 0 || caps.length !== n || locked.length !== n) return null;
  const out = [...floors];
  let remaining = total - floors.reduce((a, b) => a + b, 0);
  if (remaining < 0) return null;
  // Фикс-категория: ровная доля, кламп 3–4 (план пользователя).
  for (let i = 0; i < n; i++) {
    if (!locked[i]) continue;
    const want = Math.max(3, Math.min(4, evenShare));
    if (want < floors[i]) return null;
    remaining -= (want - floors[i]);
    out[i] = want;
    if (remaining < 0) return null;
  }
  // Заливка остатка по убыванию капа (стабильно).
  const order = out.map((_, i) => i).filter(i => !locked[i])
    .sort((a, b) => (caps[b] - caps[a]) || (a - b));
  for (const i of order) {
    if (remaining <= 0) break;
    const room = caps[i] - out[i];
    if (room <= 0) continue;
    const add = Math.min(room, remaining);
    out[i] += add;
    remaining -= add;
  }
  if (remaining > 0) return null;
  return out;
}

/**
 * Packing реально применён в плане: флаг + хотя бы одно залитое
 * упражнение (sets 6 у терпеливого = подпись packing; распределение
 * в пределах ≤5 от legacy неотличимо и отдельно не маркируется).
 */
export function isPackingActive(plan: any): boolean {
  try {
    return (plan as any)?.packingV2 === true;
  } catch { return false; }
}

export interface PackingDropItem {
  /** Паттерн движения (derivePattern) — защита единственного представителя. */
  pattern: string;
  /** Ключи жёстких групп мышцы, куда входит упражнение. */
  strictKeys: string[];
}

/**
 * Фаза сброса: убрать хвостовые упражнения, перелив их сеты в терпеливые
 * головы в пределах капов. Объём инвариантен (перелив ровно снятое).
 * Не сбрасываем: лида (index 0), locked, единственного представителя
 * паттерна-класса, единственного представителя strict-группы.
 * Не опускаемся ниже minKeep упражнений. Возвращает null, если сбросить
 * нечего (не меняем ничего — вызывающий держит результат distribute).
 */
export function planPackingDrops(
  amounts: number[],
  caps: number[],
  locked: boolean[],
  items: PackingDropItem[],
  minKeep: number = 2,
  mandated?: boolean[],
): { keep: boolean[]; sets: number[] } | null {
  const n = amounts.length;
  if (n === 0 || caps.length !== n || locked.length !== n || items.length !== n) return null;
  const isMandated = (i: number): boolean => !!mandated?.[i];
  const keep = amounts.map(() => true);
  const sets = [...amounts];
  const keptCount = () => keep.filter(Boolean).length;
  for (;;) {
    if (keptCount() <= minKeep) break;
    // Кандидат: наименьшие сеты среди не-лида, не-locked, не-mandated
    // (PPL-мандаты: flat/incline/fly груди, колодец бицепса бедра —
    // финализатор докинул бы их обратно с 4 сетами, стало бы хуже).
    let cand = -1;
    for (let i = 1; i < n; i++) {
      if (!keep[i] || locked[i] || isMandated(i)) continue;
      if (cand < 0 || sets[i] < sets[cand]) cand = i;
    }
    if (cand < 0) break;
    // Единственный представитель паттерна или strict-группы — не трогаем.
    const pat = items[cand].pattern;
    if (pat && pat !== 'unknown' && !keep.some((k, j) => k && j !== cand && items[j].pattern === pat)) break;
    const sKeys = items[cand].strictKeys || [];
    if (sKeys.some(g => !keep.some((k, j) => k && j !== cand && (items[j].strictKeys || []).includes(g)))) break;
    // Перелив снятого в оставшиеся незалоченные в пределах капов.
    let need = sets[cand];
    const receivers = keep
      .map((k, i) => ({ k, i }))
      .filter(({ k, i }) => k && i !== cand && !locked[i])
      .sort((a, b) => (caps[b.i] - caps[a.i]) || (a.i - b.i));
    for (const { i } of receivers) {
      if (need <= 0) break;
      const room = caps[i] - sets[i];
      if (room <= 0) continue;
      const add = Math.min(room, need);
      sets[i] += add;
      need -= add;
    }
    if (need > 0) break;
    keep[cand] = false;
    sets[cand] = 0;
  }
  if (keep.every(Boolean)) return null;
  return { keep, sets };
}

/** strict-ключи упражнения среди групп мышцы (для защиты при сбросе). */
export function strictKeysFor(ex: { id?: string; name?: string }, muscle: string): string[] {
  try {
    return (STRICT_EXERCISE_GROUPS[muscle] || []).filter(g => strictGroupMatches(ex, g)).map(g => g.key);
  } catch { return []; }
}

/** Паттерн упражнения для защиты единственного представителя (safe-обёртка). */
export function packingPatternOf(ex: any): string {
  try {
    const p = derivePattern(ex);
    return p || 'unknown';
  } catch { return 'unknown'; }
}
