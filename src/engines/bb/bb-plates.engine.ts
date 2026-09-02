/**
 * bb-plates.engine.ts — P1: гимназическая микрозагрузка (availablePlates / roundToAvailablePlates).
 *
 * Вес каждого рабочего сета округляется к реально достижимому значению на СВОЁМ
 * оборудовании (набор пластин на пару гантелей/грифа в конкретном зале), а не к
 * абстрактному шагу 2.5/1.25. Дробные пластины (0.5/0.25 кг) — микрозагрузка для
 * тонкой прогрессии без скачков.
 *
 * Капы не меняются — только реалистичность весов (применяется пост-проходом).
 */

export interface PlatePreset {
  id: string;
  label: string;
  /** Набор пластин на ОДНУ сторону (кг). */
  plates: number[];
  barWeight: number;
}

/** Пресеты наборов пластин. */
export const PLATE_SET_PRESETS: PlatePreset[] = [
  { id: 'standard', label: 'Стандарт (20-1.25)', plates: [20, 15, 10, 5, 2.5, 1.25], barWeight: 20 },
  { id: 'fractional', label: 'Микрозагрузка (0.25-0.5)', plates: [20, 10, 5, 2.5, 1.25, 0.5, 0.25], barWeight: 20 },
  { id: 'home', label: 'Домашний набор (25-2.5)', plates: [25, 10, 5, 2.5], barWeight: 20 },
  { id: 'machine', label: 'Машины/блоки (шаг 1)', plates: [], barWeight: 0, },
];

/** Нормализовать набор пластин (отсортировать desc, убрать <=0/дубли). */
export function normalizePlates(plates: number[] | undefined): number[] {
  if (!plates || plates.length === 0) return [];
  return Array.from(new Set(plates.filter(p => Number.isFinite(p) && p > 0))).sort((a, b) => b - a);
}

/** Достижим ли вес при данном наборе пластин (штангой) и весе грифа. */
export function isWeightReachable(weight: number, plates: number[], barWeight = 0): boolean {
  const target = weight - barWeight;
  if (target < 0) return false;
  if (target === 0) return true;
  const norm = normalizePlates(plates);
  if (norm.length === 0) return false; // машины — не штанговая математика
  const half = target / 2; // пластины на обе стороны
  let rem = half;
  for (const p of norm) {
    while (rem >= p - 1e-9) rem -= p;
  }
  return Math.abs(rem) < 1e-6;
}

/** Округлить вес к ближайшему достижимому на наборе пластин (медленно, но точно). */
export function roundToAvailablePlates(weight: number, plates: number[], barWeight = 0): number {
  if (!Number.isFinite(weight) || weight <= 0) return Math.max(0, Math.round(weight * 10) / 10);
  const norm = normalizePlates(plates);
  const step = norm.length > 0 ? Math.min(...norm) : 2.5;
  if (norm.length === 0 || step <= 0) return Math.round(weight / 2.5) * 2.5; // fallback стандарт
  // Идём от ближайшего к весу, шагом минимальной пластины, пока не достижимо.
  let candidate = weight;
  let dir = 1;
  for (let i = 0; i < 400; i++) {
    if (candidate > 0 && isWeightReachable(candidate, norm, barWeight)) return Math.round(candidate * 100) / 100;
    candidate += dir * step;
    if (candidate > weight + 40 * step && dir === 1) { dir = -1; candidate = weight - step; }
  }
  return Math.round(weight / 2.5) * 2.5;
}

/** Рекомендуемый пресет по доступному оборудованию. */
export function recommendPlatePreset(equipment: string[] = []): PlatePreset {
  const hasBar = equipment.some(e => /штанга|barbell|гриф/i.test(e));
  if (!hasBar) return PLATE_SET_PRESETS.find(p => p.id === 'machine')!;
  return PLATE_SET_PRESETS.find(p => p.id === 'standard')!;
}

type PlateWorkSet = { weight?: number };
type PlateExercise = { workSets?: PlateWorkSet[] };
type PlatePlan = { weeks?: Array<{ sessions: Array<{ exercises: PlateExercise[] }> }> };

/**
 * Пост-проход: округлить все рабочие веса плана к достижимым на заданном наборе пластин.
 * Машины (barWeight=0, plates=[]) → fallback шаг 2.5 (без поломки). Не меняет капы.
 */
export function applyPlateRoundingToPlan(plan: PlatePlan, plates: number[] | undefined, barWeight = 20): { changed: number } {
  const norm = normalizePlates(plates);
  if (norm.length === 0) return { changed: 0 };
  let changed = 0;
  for (const wk of plan.weeks || []) for (const s of wk.sessions || []) for (const ex of s.exercises || []) {
    for (const st of ex.workSets || []) {
      const w = Number(st.weight ?? 0);
      if (w <= 0) continue;
      const r = roundToAvailablePlates(w, norm, barWeight);
      if (r !== w) { st.weight = r; changed++; }
    }
  }
  return { changed };
}
