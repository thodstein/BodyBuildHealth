/**
 * lab-exercise-profile.engine.ts — профиль сопротивления и покрытие подрегионов для Лаборатории (Epic A).
 *
 * Фиксит два аудит-пункта без дублей (reuse SFR_EXERCISE_DB + EXERCISE_CATALOG + SUBREGION_DEFS):
 *  - 1.1: `getResistanceProfile` из ExerciseLabShared — эвристика по подстрокам названия.
 *         Здесь: данные первичны (SFR_EXERCISE_DB → `data`; `stretchPhase` каталога → `data`),
 *         эвристика — только fallback с честным `source:'estimated'`.
 *  - 1.3: `regionalCoverage` Шага 3 матчил ключевые слова подрегионов против короткой строки
 *         `targetMuscle` («Грудь») → почти всё всегда uncovered. Здесь матчинг идёт против
 *         `bio.primary/secondary + name + targetMuscle`.
 *  - Epic B (тут же, чтобы не плодить файлы): `resolveLabWorkingWeight` — честный вес генератора
 *         Шага 1: baseline → workMax мышцы → null (никакого `fakeRM`, мока нет).
 *
 * Чистые функции, план не мутируют.
 */
import { EXERCISE_CATALOG } from '../core/exercise-catalog';
import {
  SFR_EXERCISE_DB,
  sfrOf,
  resistanceProfileOf,
  isUnilateralExercise,
  type ResistanceProfile,
} from './bb/bb-sfr-db';
import { getExerciseBio } from '../data/exercise-biomechanics-db';
import { SUBREGION_DEFS } from '../ui/screens/TrainingScreen_parts/ExerciseLabShared';

export interface LabResistanceProfile {
  profile: ResistanceProfile;
  /** 'data' — из SFR_EXERCISE_DB или stretchPhase каталога; 'estimated' — эвристика, ориентир. */
  source: 'data' | 'estimated';
  sfr: number | null;
  unilateral: boolean;
}

function findCatalog(ex: { id?: string; name?: string }) {
  if (ex?.id) {
    const byId = EXERCISE_CATALOG.find((c) => c.id === ex.id);
    if (byId) return byId;
  }
  if (ex?.name) {
    const low = ex.name.toLowerCase();
    const byName = EXERCISE_CATALOG.find(
      (c) => c.name.toLowerCase() === low || c.id.toLowerCase() === low,
    );
    if (byName) return byName;
  }
  return null;
}

/** Профиль сопротивления упражнения: данные первичны, эвристика — только fallback. */
export function getLabResistanceProfile(ex: { id?: string; name?: string }): LabResistanceProfile {
  const rec = ex?.id ? SFR_EXERCISE_DB[ex.id] : undefined;
  if (rec) {
    return {
      profile: rec.resistanceProfile,
      source: 'data',
      sfr: rec.sfr,
      unilateral: !!rec.unilateral || isUnilateralExercise(ex),
    };
  }
  const cat = findCatalog(ex);
  if (cat && (cat as { stretchPhase?: boolean }).stretchPhase) {
    return {
      profile: 'lengthened',
      source: 'data',
      sfr: sfrOf(ex),
      unilateral: isUnilateralExercise(ex),
    };
  }
  return {
    profile: resistanceProfileOf(ex) ?? 'mid',
    source: 'estimated',
    sfr: sfrOf(ex),
    unilateral: isUnilateralExercise(ex),
  };
}

/** Текстовая «сводка» упражнения для матчинга подрегионов: bio + имя + целевая. */
function exerciseHaystack(ex: { id?: string; name?: string }): string {
  const parts: string[] = [];
  try {
    const cat = findCatalog(ex);
    if (cat?.targetMuscle) parts.push(String(cat.targetMuscle));
    if (cat?.name) parts.push(String(cat.name));
    const bioId = ex?.id || cat?.id;
    if (bioId) {
      const bio = getExerciseBio(bioId);
      if (bio) {
        parts.push(...(bio.primaryMuscles || []), ...(bio.secondaryMuscles || []));
      }
    }
  } catch {
    /* noop — пустой haystack даёт uncovered, а не throw */
  }
  if (ex?.name) parts.push(String(ex.name));
  return parts.join(' ').toLowerCase();
}

/** Какие подрегионы группы закрывает одно упражнение (id подрегионов). */
export function subregionsCoveredBy(ex: { id?: string; name?: string }, group: string): string[] {
  const regions = SUBREGION_DEFS[group] || [];
  if (regions.length === 0) return [];
  const hay = exerciseHaystack(ex);
  if (!hay.trim()) return [];
  return regions
    .filter((r) => r.keywords.some((kw) => hay.includes(String(kw).toLowerCase())))
    .map((r) => r.id);
}

export interface GroupSubregionCoverage {
  covered: string[];
  uncovered: string[];
  total: number;
}

/** Покрытие подрегионов группы набором упражнений (union; фиксит 1.3). */
export function groupSubregionCoverage(
  group: string,
  exercises: Array<{ id?: string; name?: string }>,
): GroupSubregionCoverage {
  const regions = SUBREGION_DEFS[group] || [];
  const covered = new Set<string>();
  for (const ex of exercises || []) {
    for (const id of subregionsCoveredBy(ex, group)) covered.add(id);
  }
  const all = regions.map((r) => r.id);
  return {
    covered: all.filter((id) => covered.has(id)),
    uncovered: all.filter((id) => !covered.has(id)),
    total: all.length,
  };
}

export interface LabWorkingWeight {
  weight: number | null;
  source: 'baseline' | 'workmax' | null;
}

/**
 * Честный рабочий вес для генератора Шага 1 (Epic B).
 * Приоритет: strengthBaselines[exId] → workMax[группа мышцы] → null.
 * null означает «базы нет» — UI показывает прочерк + CTA в Профиль, выдумывать кг запрещено.
 */
export function resolveLabWorkingWeight(
  baselines: Record<string, number> | undefined | null,
  workMaxByMuscle: Record<string, number> | undefined | null,
  ex: { id?: string; group?: string },
): LabWorkingWeight {
  const base = ex?.id ? Number((baselines || {})[ex.id]) : NaN;
  if (Number.isFinite(base) && base > 0) return { weight: base, source: 'baseline' };
  const wm = ex?.group ? Number((workMaxByMuscle || {})[ex.group]) : NaN;
  if (Number.isFinite(wm) && wm > 0) return { weight: wm, source: 'workmax' };
  return { weight: null, source: null };
}
