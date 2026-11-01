/**
 * bb-auto-injections.ts — чистые хелперы пост-обработки плана в BB-Auto.
 *
 * Аудит 2026-11: свопы/«предпочтения»/L-R-добивки применялись к уже
 * финализированному плану, но собирались вручную:
 *   • объекты push'ились без `workSets` → пустые подходы в плеере и TypeError;
 *   • `muscle` брался из композитной группы каталога (arms/legs/shoulders);
 *   • `exerciseName` смешивал id и display-name.
 * Здесь единые правила; компонент остаётся тонким.
 */
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { trueMuscleOf } from '../../../engines/movement-pattern';
import { PCT_FOR_RIR } from '../../../engines/rir-table';

export interface WorkSetLike {
  weight: number;
  reps: number;
  rir: number;
  tempo?: string;
  restSeconds?: number;
  technique?: string;
}

const COMPOSITE_TO_CANON: Record<string, string> = {
  arms: 'biceps',
  legs: 'quads',
  core: 'abs',
  delts: 'shoulders',
  shoulders: 'shoulders',
};

/** Каноническая мышца для объёма/workMax. Композитные группы каталога не годятся. */
export function canonicalMuscleOf(cat: any, fallback?: string): string {
  if (!cat) return String(fallback || 'chest').toLowerCase();
  let m: string | null = null;
  try {
    m = trueMuscleOf({
      id: cat.id, name: cat.name, group: cat.group, type: cat.type,
      targetMuscle: cat.targetMuscle, movementPattern: cat.movementPattern,
      muscle: cat.muscle,
    } as any);
  } catch { /* одно упражнение не роняет сборку */ }
  const raw = String(m || cat.group || fallback || 'chest').toLowerCase();
  // trueMuscleOf уже отдаёт канон, но для записей вне каталога оставляем страховку.
  return COMPOSITE_TO_CANON[raw] || raw;
}

/**
 * Ключ упражнения = display-name, как во всём движке
 * (`bb-builder:2996 exerciseName: exData.name || exData.id`).
 * id здесь давал второй ключ для того же движения (веса/калибровка/экспорт).
 */
export function exerciseKeyOf(cat: any): string {
  return String(cat?.name || cat?.id || '');
}

/** Рабочие сеты точно по количеству `sets` (без рассинхрона sets/workSets). */
export function makeWorkSets(
  sets: number,
  opts: { reps: number; rir: number; weight: number; tempo?: string; restSeconds?: number },
): WorkSetLike[] {
  const n = Math.max(1, Math.round(Number(sets) || 1));
  return Array.from({ length: n }, () => ({
    reps: Math.max(1, Math.round(Number(opts.reps) || 8)),
    rir: Math.max(0, Math.min(5, Math.round(Number(opts.rir) || 0))),
    weight: Math.max(0, Math.round((Number(opts.weight) || 0) * 10) / 10),
    ...(opts.tempo ? { tempo: opts.tempo } : {}),
    ...(opts.restSeconds ? { restSeconds: opts.restSeconds } : {}),
  }));
}

/** Вес из персонального workMax по канонической мышце (не по композитной группе). */
export function estimatedWeightFor(cat: any, workMax: Record<string, number> | undefined, rir: number): number {
  const muscle = canonicalMuscleOf(cat);
  const wm = Number(workMax?.[muscle] ?? (cat?.group ? workMax?.[String(cat.group)] : 0) ?? 0);
  if (!Number.isFinite(wm) || wm <= 0) return 0;
  const pct = PCT_FOR_RIR[Math.max(0, Math.min(5, Math.round(rir)))] ?? 0.9;
  return Math.round(wm * pct);
}

/** Коэффициент пересчёта веса между снарядами (своп упражнения). */
const EQUIPMENT_LOAD_RATIO: Record<string, number> = {
  barbell: 1, smith: 0.9, machine: 0.85, dumbbell: 0.8, cable: 0.8, bodyweight: 0.7,
};

export function loadRatioBetween(fromEquipment: string | string[] | undefined, toEquipment: string | string[] | undefined): number {
  // Каталог отдаёт строку, но в планах встречаются массивы/склейки ('barbell,bench') —
  // берём первый распознанный снаряд, иначе 1 (без искажения веса).
  const pick = (v: string | string[] | undefined): number => {
    const tokens = Array.isArray(v) ? v : String(v ?? '').split(',');
    for (const t of tokens) {
      const k = String(t).trim().toLowerCase();
      if (EQUIPMENT_LOAD_RATIO[k]) return EQUIPMENT_LOAD_RATIO[k];
    }
    return 1;
  };
  return pick(toEquipment) / pick(fromEquipment);
}

/** Достать каталожную запись по id/имени (с нормализацией регистра). */
export function findCatalogExercise(idOrName: string): any {
  const low = String(idOrName || '').toLowerCase();
  if (!low) return null;
  return EXERCISE_CATALOG.find((c: any) =>
    String(c.id || '').toLowerCase() === low || String(c.name || '').toLowerCase() === low,
  ) || null;
}
