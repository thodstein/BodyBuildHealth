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

/** Достижим ли вес при данном наборе пластин (штангой) и весе грифа (точный DP, не жадный). */
export function isWeightReachable(weight: number, plates: number[], barWeight = 0): boolean {
  const target = weight - barWeight;
  if (target < -1e-6) return false;
  if (Math.abs(target) < 1e-6) return true;
  const norm = normalizePlates(plates);
  if (norm.length === 0) return false; // машины — не штанговая математика
  const half = target / 2; // пластины на обе стороны
  // Переводим в целые единицы по 0.05 кг (покрывает 0.25/0.5/1.25/2.5/5/10/15/20/25 кг без ошибок float).
  const scale = 20;
  const targetUnits = Math.round(half * scale);
  if (Math.abs(half * scale - targetUnits) > 1e-4 || targetUnits > 20000) return false;
  const plateUnits = Array.from(new Set(norm.map(p => Math.round(p * scale)).filter(u => u > 0)));
  if (plateUnits.length === 0) return false;
  const dp = new Uint8Array(targetUnits + 1);
  dp[0] = 1;
  for (const u of plateUnits) {
    for (let s = u; s <= targetUnits; s++) {
      if (dp[s - u]) dp[s] = 1;
    }
  }
  return dp[targetUnits] === 1;
}

/** Округлить вес к ближайшему достижимому на наборе пластин (симметричный поиск на сетке). */
export function roundToAvailablePlates(weight: number, plates: number[], barWeight = 0): number {
  if (!Number.isFinite(weight) || weight <= 0) return Math.max(0, Math.round(weight * 10) / 10);
  const norm = normalizePlates(plates);
  const minPlate = norm.length > 0 ? Math.min(...norm) : 1.25;
  if (norm.length === 0 || minPlate <= 0) return Math.round(weight / 2.5) * 2.5; // fallback стандарт
  // Шаг изменения штанги с двумя сторонами = 2 * minPlate (или 0.5 для безопасности)
  const grid = Math.max(0.25, minPlate * 2);
  if (weight <= barWeight) return barWeight > 0 ? barWeight : Math.round(weight / grid) * grid;
  const baseIdx = Math.round((weight - barWeight) / grid);
  // Симметричный поиск: 0, +1, -1, +2, -2... — ближайший достижимый без смещения вверх.
  for (let d = 0; d <= 200; d++) {
    const offsets = d === 0 ? [0] : [d, -d];
    for (const off of offsets) {
      const idx = baseIdx + off;
      if (idx < 0) continue;
      const cand = Math.round((barWeight + idx * grid) * 100) / 100;
      if (cand > 0 && isWeightReachable(cand, norm, barWeight)) return cand;
    }
  }
  return Math.round(weight / 2.5) * 2.5;
}

/** Определить, является ли упражнение штанговым (гриф 20 кг), или гантелями/блоком/тренажёром. */
export function isBarbellExercise(ex: { name?: string; exerciseName?: string; equipment?: string | string[] }): boolean {
  const eq = Array.isArray(ex.equipment) ? ex.equipment.join(' ').toLowerCase() : String(ex.equipment || '').toLowerCase();
  const n = String(ex.exerciseName || ex.name || '').toLowerCase();
  if (!eq && !n) return true;
  if (/гантел|dumbbell|блок|кабел|cable|тренаж|machine|смит|smith|кроссовер|crossover|bodyweight|свой вес|резин|band|гир|kettlebell/i.test(n)) {
    return false;
  }
  if (eq) {
    if (eq.includes('barbell') || eq.includes('штанг')) return true;
    if (/dumbbell|cable|machine|bodyweight|kettlebell|band|smith/.test(eq)) return false;
  }
  return /штанг|barbell|гриф|присед.*спин|становая|румынская тяга(?!.*гантел)|жим лёжа(?!.*гантел)|жим лежа(?!.*гантел)|армейский жим(?!.*гантел)|ez/i.test(n);
}

/** Рекомендуемый пресет по доступному оборудованию. */
export function recommendPlatePreset(equipment: string[] = []): PlatePreset {
  const hasBar = equipment.some(e => /штанга|barbell|гриф/i.test(e));
  if (!hasBar) return PLATE_SET_PRESETS.find(p => p.id === 'machine')!;
  return PLATE_SET_PRESETS.find(p => p.id === 'standard')!;
}

type PlateWorkSet = { weight?: number };
type PlateExercise = { name?: string; exerciseName?: string; equipment?: string | string[]; workSets?: PlateWorkSet[] };
type PlatePlan = { weeks?: Array<{ sessions: Array<{ exercises: PlateExercise[] }> }> };

/**
 * Пост-проход: округлить все рабочие веса плана к достижимым на заданном наборе пластин.
 * P1-1: barWeight (20 кг) применяется ТОЛЬКО к штанговым упражнениям; гантели/блоки/машины
 * округляются с barWeight=0 (иначе махи гантелями 12.5 кг превращались в 20 кг).
 */
export function applyPlateRoundingToPlan(plan: PlatePlan, plates: number[] | undefined, barWeight = 20): { changed: number } {
  const norm = normalizePlates(plates);
  if (norm.length === 0) return { changed: 0 };
  let changed = 0;
  for (const wk of plan.weeks || []) for (const s of wk.sessions || []) for (const ex of s.exercises || []) {
    const isBar = isBarbellExercise(ex);
    const minStep = isBar ? 0 : Math.min(2.5, Math.max(0.5, Math.min(...norm)));
    for (const st of ex.workSets || []) {
      const w = Number(st.weight ?? 0);
      if (w <= 0) continue;
      // Гантели/блоки/тренажёры не получают штанговый гриф 20 кг даже при весе ≥ 20 кг.
      const r = isBar
        ? roundToAvailablePlates(w, norm, barWeight)
        : Math.max(minStep, Math.round(w / minStep) * minStep);
      if (r !== w) { st.weight = Math.round(r * 100) / 100; changed++; }
    }
  }
  return { changed };
}
