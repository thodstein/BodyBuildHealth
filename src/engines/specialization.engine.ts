/**
 * specialization.engine.ts — Режим специализации (оверлоад одной группы).
 *
 * Принцип: целевая группа получает 1.3-1.5× MAV, остальные — MEV (минимум).
 * Длительность: 8-12 недель, 1-2 делода.
 */
import type { Exercise } from '../core/types';
import { EXERCISE_CATALOG, getExercisesByGroup } from '../core/exercise-catalog';

export interface SpecializationInput {
  targetGroup: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  weakPoints: string[];
  injuries: { muscle: string; from: string; to?: string }[];
  daysPerWeek: number;
}

export interface SpecializedDay {
  dayNumber: number;
  exercises: SpecializedExercise[];
  targetVolume: number;
}

export interface SpecializedExercise {
  id: string;
  name: string;
  group: string;
  type: string;
  sets: number;
  reps: number;
  rir: number;
  order: number;
}

/** Справочник MAV/MEV по группам мышц и уровню */
const VOLUME_BY_LEVEL: Record<string, Record<string, { mev: [number,number]; mav: [number,number]; mrv: number }>> = {
  beginner: {
    chest:     { mev: [6,8],   mav: [8,12],  mrv: 14 },
    back:      { mev: [6,8],   mav: [10,14], mrv: 16 },
    legs:      { mev: [6,8],   mav: [10,14], mrv: 16 },
    shoulders: { mev: [4,6],   mav: [6,10],  mrv: 12 },
    arms:      { mev: [6,8],   mav: [8,12],  mrv: 14 },
    core:      { mev: [4,6],   mav: [6,10],  mrv: 12 },
  },
  intermediate: {
    chest:     { mev: [8,10],  mav: [12,16], mrv: 18 },
    back:      { mev: [8,10],  mav: [14,18], mrv: 22 },
    legs:      { mev: [8,10],  mav: [14,18], mrv: 22 },
    shoulders: { mev: [6,8],   mav: [8,12],  mrv: 14 },
    arms:      { mev: [8,10],  mav: [10,16], mrv: 18 },
    core:      { mev: [4,6],   mav: [6,10],  mrv: 14 },
  },
  advanced: {
    chest:     { mev: [10,12], mav: [14,20], mrv: 24 },
    back:      { mev: [10,14], mav: [16,22], mrv: 26 },
    legs:      { mev: [10,14], mav: [16,22], mrv: 26 },
    shoulders: { mev: [8,10],  mav: [10,16], mrv: 18 },
    arms:      { mev: [10,12], mav: [12,18], mrv: 22 },
    core:      { mev: [6,8],   mav: [8,12],  mrv: 16 },
  },
};

/** Дни недели для 3-6 дней */
const SPLIT_TEMPLATES: Record<number, { name: string; days: string[][] }> = {
  3: { name: 'Фулбоди 3 дня', days: [['chest','back','legs','shoulders','arms','core'],['chest','back','legs','shoulders','arms','core'],['chest','back','legs','shoulders','arms','core']] },
  4: { name: 'Верх/Низ 4 дня', days: [['chest','back','shoulders','arms'],['legs','core'],['chest','back','shoulders','arms'],['legs','core']] },
  5: { name: 'PPL 5 дней', days: [['chest','shoulders','triceps'],['back','biceps'],['legs','core'],['chest','shoulders','triceps'],['back','biceps','legs']] },
  6: { name: 'PPL 6 дней', days: [['chest','shoulders','triceps'],['back','biceps'],['legs','core'],['chest','shoulders','triceps'],['back','biceps'],['legs','core']] },
};

/** Специализация: построить распределение подходов по группам */
export function calcSpecializationVolume(input: SpecializationInput): Record<string, { sets: number; status: string; pctOfMav: number }> {
  const { targetGroup, level } = input;
  const volDb = VOLUME_BY_LEVEL[level] || VOLUME_BY_LEVEL.intermediate;
  const groups = Object.keys(volDb);
  const result: Record<string, { sets: number; status: string; pctOfMav: number }> = {};

  for (const g of groups) {
    const v = volDb[g];
    if (!v) continue;
    const isTarget = g === targetGroup;

    // Целевая: 1.4× MAV, остальные: MEV
    const targetSets = isTarget
      ? Math.round((v.mav[0] + v.mav[1]) / 2 * 1.4)
      : Math.round((v.mev[0] + v.mev[1]) / 2);

    const avgMav = (v.mav[0] + v.mav[1]) / 2;
    const pct = avgMav > 0 ? Math.round(targetSets / avgMav * 100) : 100;
    const status = isTarget ? 'оверлоад' : targetSets >= v.mav[0] ? 'поддержание' : 'минимум';

    result[g] = { sets: targetSets, status, pctOfMav: pct };
  }

  return result;
}

/** Построить недельный план специализации */
export function generateSpecializedWeek(input: SpecializationInput): SpecializedDay[] {
  const { targetGroup, daysPerWeek, equipment, weakPoints, injuries } = input;
  const vol = calcSpecializationVolume(input);
  const template = SPLIT_TEMPLATES[daysPerWeek] || SPLIT_TEMPLATES[4];
  const injuryMuscles = injuries.map(i => i.muscle);

  return template.days.map((groups, dayIdx) => {
    const exercises: SpecializedExercise[] = [];
    const usedIds = new Set<string>();

    for (const g of groups) {
      const v = vol[g];
      if (!v || v.sets === 0) continue;

      const isTarget = g === targetGroup;
      const targetSets = v.sets;

      // Отбор упражнений: для целевой группы берём все варианты, для остальных — базовые
      const pool = EXERCISE_CATALOG.filter(ex =>
        ex.group === g &&
        (!equipment.length || equipment.includes(ex.equipment)) &&
        !injuryMuscles.includes(ex.group) &&
        !usedIds.has(ex.id) &&
        (ex.type === 'compound' || (isTarget && ex.type === 'isolation'))
      );

      // Распределение подходов между упражнениями
      const exercisesPerGroup = isTarget ? Math.min(3, pool.length) : Math.min(2, pool.length);
      const setsPerEx = Math.floor(targetSets / exercisesPerGroup);
      const remainder = targetSets - setsPerEx * exercisesPerGroup;

      const selected = pool.slice(0, exercisesPerGroup);
      selected.forEach((ex, i) => {
        exercises.push({
          id: ex.id,
          name: ex.name,
          group: g,
          type: ex.type,
          sets: setsPerEx + (i < remainder ? 1 : 0),
          reps: isTarget ? 10 : 12,
          rir: weakPoints.includes(g) ? 1 : isTarget ? 2 : 3,
          order: i,
        });
        usedIds.add(ex.id);
      });
    }

    exercises.sort((a, b) => a.order - b.order);
    const totalVolume = exercises.reduce((s, e) => s + e.sets, 0);

    return { dayNumber: dayIdx + 1, exercises, targetVolume: totalVolume };
  });
}

/** Сводка специализации для UI */
export function formatSpecializationSummary(input: SpecializationInput): string[] {
  const vol = calcSpecializationVolume(input);
  const result: string[] = [];
  result.push(`🎯 Цель: специализация на «${targetGroupName(input.targetGroup)}»`);
  result.push(`📆 Длительность: 8-12 нед, делод на 5-6 нед`);
  result.push('');
  for (const [g, v] of Object.entries(vol)) {
    const name = targetGroupName(g);
    const accent = g === input.targetGroup ? '🟢' : '⚪';
    result.push(`${accent} ${name}: ${v.sets} сетов/нед (${v.status}, ${v.pctOfMav}% MAV)`);
  }
  return result;
}

function targetGroupName(g: string): string {
  const names: Record<string, string> = {
    chest: 'Грудь', back: 'Спина', legs: 'Ноги',
    shoulders: 'Плечи', arms: 'Руки', core: 'Кор',
    quads: 'Квадрицепс', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы',
    biceps: 'Бицепс', triceps: 'Трицепс', calves: 'Икры', abs: 'Пресс',
  };
  return names[g] || g;
}
