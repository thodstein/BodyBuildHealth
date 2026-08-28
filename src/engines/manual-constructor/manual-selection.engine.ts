/**
 * manual-selection.engine.ts — PRO-подбор упражнений для ручного конструктора.
 *
 * Фаза 2: multi-angle diversity (ANGLE_CLASSES) + strict groups + lengthened bias + injury graded + mobility + plate calc.
 * Использует канонические ANGLE_CLASSES/lengthenedBonus/strict из bb-exercise-selection.
 */

import type { Exercise } from '../../core/types';
import { getExercisesByGroup } from '../../core/exercise-catalog';
import { ANGLE_CLASSES, lengthenedBonus, ensureStrictGroupCoverage } from '../bb/bb-exercise-selection.engine';
import { selectExercisesSmart, isAxialLoadExercise } from '../exercise-selector.engine';
import { isMobilityRestricted } from '../bb/bb-mobility.engine';

export interface SuggestProOpts {
  group: string;
  level: string;
  count: number;
  equipment: string[];
  weakZones?: string[];
  injuryProfile?: string[];
  injuriesDetailed?: { muscle: string; exclude?: boolean; weightPct?: number; volumePct?: number; repsCap?: number }[];
  avoidAxialLoad?: boolean;
  favoriteIds?: string[];
  excludeIds?: string[];
  mobilityRestrictions?: string[];
  trainingFocus?: 'strength'|'hypertrophy'|'endurance';
  /** Уже выбранные id в сессии (для дедупа) */
  selectedIds?: string[];
  selectedNames?: string[];
}

/** Скоринг lengthened + _score с учётом trainingFocus (0.5/1.0/1.5). */
function scoreWithLengthened(ex: any, focus?: string): number {
  const base = (ex as any)._score ?? 0;
  return base + lengthenedBonus(ex.name, focus as any);
}

/**
 * PRO-подбор: multi-angle + strict + lengthened + graded injury + mobility.
 * Возвращает count упражнений, гарантируя угловую диверсификацию.
 */
export function suggestExercisesPro(opts: SuggestProOpts): Exercise[] {
  const {
    group, level, count, equipment, weakZones = [], injuryProfile = [],
    injuriesDetailed = [], avoidAxialLoad = false, favoriteIds = [], excludeIds = [],
    mobilityRestrictions = [], trainingFocus, selectedIds = [], selectedNames = [],
  } = opts;

  const poolRaw: Exercise[] = getExercisesByGroup(group);
  if (poolRaw.length === 0) return [];

  // Фильтр: axialLoad + mobility + excludeIds (graded не исключаем полностью — дадим gentle)
  const pool = poolRaw.filter(ex => {
    if (excludeIds.includes((ex as any).id)) return false;
    if (avoidAxialLoad && isAxialLoadExercise(ex as any)) return false;
    if (mobilityRestrictions.length && isMobilityRestricted(ex as any, mobilityRestrictions)) return false;
    return true;
  });

  if (pool.length === 0) return [];

  // Добавляем _score + lengthenedBonus для сортировки
  const scored = pool.map(ex => ({ ...ex, _score: scoreWithLengthened(ex, trainingFocus) } as any));
  // Сортируем по скору убыв
  scored.sort((a: any, b: any) => (b._score ?? 0) - (a._score ?? 0));

  // Попытка через selectExercisesSmart с pool уже отфильтрованным, но с multi-angle enhanced
  // Делим на primary/secondary как и раньше, но внутри каждого — ANGLE diversity
  const wantCompound = count >= 2;
  const primaryCount = Math.min(wantCompound ? 1 : 0, scored.length);
  const secondaryCount = Math.max(0, Math.min(count - primaryCount, scored.length - primaryCount));

  // Helper: подобрать N с diversity
  function pickDiverse(cands: any[], need: number, usedIds: Set<string>, usedNames: Set<string>): any[] {
    if (need <= 0) return [];
    const angleClasses = ANGLE_CLASSES[group];
    if (!angleClasses || angleClasses.length === 0) {
      // fallback: просто top-N по скору
      return cands.filter(e => !usedIds.has(e.id) && !usedNames.has(e.name)).slice(0, need);
    }
    const picked: any[] = [];
    const usedClassIdx = new Set<number>();
    // Первый проход — по одному из каждого класса
    for (let ci = 0; ci < angleClasses.length && picked.length < need; ci++) {
      const ac = angleClasses[ci];
      const candidates = cands.filter(e => ac.match(e) && !usedIds.has(e.id) && !usedNames.has(e.name) && !picked.some(p => p.id === e.id));
      if (candidates.length === 0) continue;
      // берём лучший по скору (уже отсортированы)
      const best = candidates[0];
      picked.push(best);
      usedClassIdx.add(ci);
    }
    // Добрать если не хватило — из неиспользованных классов
    for (const e of cands) {
      if (picked.length >= need) break;
      if (picked.some(p => p.id === e.id) || usedIds.has(e.id) || usedNames.has(e.name)) continue;
      const clsIdx = angleClasses.findIndex(c => c.match(e));
      if (clsIdx >= 0 && usedClassIdx.has(clsIdx)) continue;
      picked.push(e);
      if (clsIdx >= 0) usedClassIdx.add(clsIdx);
    }
    // Если всё ещё не хватило — добираем любым
    for (const e of cands) {
      if (picked.length >= need) break;
      if (picked.some(p => p.id === e.id) || usedIds.has(e.id)) continue;
      picked.push(e);
    }
    return picked.slice(0, need);
  }

  const usedIds = new Set(selectedIds);
  const usedNames = new Set(selectedNames);

  // primary: берём compound кандидаты
  const compoundPool = scored.filter(e => (e as any).type === 'compound' || /жим|присед|тяга|становая|squat|bench|deadlift|press|pull/i.test((e as any).name));
  const primaryPool = compoundPool.length ? compoundPool : scored;
  const primary = pickDiverse(primaryPool, primaryCount, usedIds, usedNames);
  primary.forEach(e => { usedIds.add(e.id); usedNames.add(e.name); });

  const secondaryPool = scored.filter(e => !primary.some(p => p.id === e.id));
  let secondary = pickDiverse(secondaryPool, secondaryCount, usedIds, usedNames);

  let result: any[] = [...primary, ...secondary].slice(0, count);

  // Strict groups покрытие (если primary мышца — гарантировать группы как в bb-builder)
  try {
    const fakeExDatas = result.map(e => ({ id: (e as any).id, name: (e as any).name, _score: (e as any)._score }));
    const fakePool = scored.map(e => ({ id: (e as any).id, name: (e as any).name, _score: (e as any)._score }));
    const idsArr = Array.from(usedIds);
    const namesArr = Array.from(usedNames);
    ensureStrictGroupCoverage(fakeExDatas, fakePool, group, count, idsArr, namesArr, { isPrimary: true });
    // Применяем замены обратно к result
    for (let i = 0; i < fakeExDatas.length && i < result.length; i++) {
      const expectedId = (fakeExDatas[i] as any).id;
      if ((result[i] as any).id !== expectedId) {
        const found = scored.find(e => (e as any).id === expectedId);
        if (found) result[i] = found;
      }
    }
  } catch { /* ignore strict */ }

  // Graded injury: если мышца группы — graded (exclude false, weightPct 0.6) — помечаем, но не исключаем
  // UI покажет бейдж "⚡ Щадящая" — движок не режет здесь, это фильтр показа
  // Для справки — gentle substitution будет в BlockList (findGentleSubstitutions)

  // Fallback если не набрали
  if (result.length < count) {
    const needed = count - result.length;
    const fallback = scored.filter(e => !result.some(r => (r as any).id === (e as any).id)).slice(0, needed);
    result = [...result, ...fallback];
  }

  // Маппим к SelectedExercise shape (selectionScore/rationale)
  return result.map(e => ({
    ...(e as any),
    selectionScore: (e as any)._score ?? 0,
    rationale: [] as string[],
  })) as any;
}

/** Плиты — расчёт блинов для штанги. */
export function calcPlates(
  weight: number,
  opts?: { barWeight?: number; plates?: number[]; roundKg?: number },
): { perSide: number[]; platesNeeded: Record<string, number>; remainder: number; roundedWeight: number } {
  const bar = opts?.barWeight ?? 20;
  const available = opts?.plates ?? [20, 15, 10, 5, 2.5, 1.25, 0.5];
  const roundKg = opts?.roundKg ?? 2.5;
  // Округляем до roundKg
  const rounded = Math.round(weight / roundKg) * roundKg;
  let toLoad = Math.max(0, (rounded - bar) / 2);
  const perSide: number[] = [];
  const platesNeeded: Record<string, number> = {};
  for (const p of available) {
    const cnt = Math.floor(toLoad / p + 1e-9);
    for (let i = 0; i < cnt; i++) perSide.push(p);
    if (cnt > 0) platesNeeded[String(p)] = cnt;
    toLoad -= cnt * p;
    toLoad = Math.round(toLoad * 100) / 100;
  }
  const remainder = Math.round(toLoad * 2 * 100) / 100;
  return { perSide, platesNeeded, remainder, roundedWeight: rounded };
}

export function weightToPct(weight: number, workMax: number): number {
  if (!workMax || workMax <= 0) return 0;
  return Math.round((weight / workMax) * 1000) / 10; // %
}
export function pctToWeight(pct: number, workMax: number): number {
  // pct 0.75 или 75 — поддерживаем оба
  const p = pct > 1 ? pct / 100 : pct;
  return Math.round(workMax * p * 10) / 10;
}
export function roundToPlates(weight: number, plates: number[] = [2.5, 5]): number {
  const step = Math.min(...plates);
  return Math.round(weight / step) * step;
}

/** Проверка graded: мышца щадящая? */
export function isGradedMuscle(muscle: string, injuriesDetailed: { muscle: string; exclude?: boolean }[]): boolean {
  return injuriesDetailed.some(i => i.muscle.toLowerCase() === muscle.toLowerCase() && i.exclude === false);
}
