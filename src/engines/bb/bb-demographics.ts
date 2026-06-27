/**
 * bb-demographics.ts — демографическая адаптация BB (Этап BB17, NEW).
 * Женский (акцент ягодицы/низ, менструальный цикл), мастера/возраст (MRV↓, преабил),
 * авто-подбор сплита по доступным дням.
 */
import { normLevel, getVolumeLandmarks } from '../volume-landmarks.engine';

export interface DemographicAdjust {
  emphasisMuscles: string[];     // приоритетные мышцы
  mrvMultiplier: number;
  extraPrehab: string[];
  splitByDays: string;           // рекомендуемый pattern id
  notes: string[];
}

const SPLIT_BY_DAYS: Record<number, string> = {
  2: 'fullbody_3', 3: 'fullbody_3', 4: 'upper_lower_4', 5: 'rolling_4_1', 6: 'ppl_6', 7: 'ppl_6',
};

export function splitForDays(daysPerWeek: number): string {
  return SPLIT_BY_DAYS[Math.min(7, Math.max(2, daysPerWeek))] || 'upper_lower_4';
}

export function femaleAdjust(): DemographicAdjust {
  return {
    emphasisMuscles: ['glutes', 'hamstrings', 'quads', 'calves'],
    mrvMultiplier: 0.95,
    extraPrehab: ['таз/симфиз', 'колени'],
    splitByDays: 'upper_lower_4',
    notes: [
      'Акцент на нижнюю часть (ягодицы/бицепс бедра) — больший объём.',
      'Фолликулярная фаза (1-14дн): выше толерантность к интенсивности/объёму.',
      'Лютеальная фаза (15-28дн): возможен больший объём, но больше утомления → следить за восстановлением.',
    ],
  };
}

export function mastersAdjust(age: number): DemographicAdjust {
  const mrvMult = age >= 60 ? 0.8 : age >= 50 ? 0.88 : 0.95;
  return {
    emphasisMuscles: ['back', 'shoulders', 'legs'],
    mrvMultiplier: mrvMult,
    extraPrehab: ['плечи (ротаторная манжета)', 'колени', 'нижняя часть спины', 'тазобедренные'],
    splitByDays: 'upper_lower_4',
    notes: [
      `Возраст ${age}: MRV×${mrvMult} — больше восстановления, меньше объёма.`,
      'Увеличенный преабилити (суставы/связки восстанавливаются медленнее).',
      'Длинная разминка, акцент на контроль темпа и технику.',
    ],
  };
}

/** Скорректировать MAV/MRV мышц под демографию. */
export function adjustVolumeForDemographic(muscle: string, level: string, adj: DemographicAdjust): { mev: number; mav: number; mrv: number } | null {
  const lm = getVolumeLandmarks(normLevel(level), muscle);
  if (!lm) return null;
  const m = adj.mrvMultiplier;
  const emphasis = adj.emphasisMuscles.includes(muscle) ? 1.15 : 1.0;
  return {
    mev: Math.round(lm.mev * m * emphasis),
    mav: Math.round(lm.mav * m * emphasis),
    mrv: Math.round(lm.mrv * m * emphasis),
  };
}