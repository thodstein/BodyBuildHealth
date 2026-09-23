/**
 * bb-demographics.ts — демографическая адаптация BB (Этап BB17, NEW).
 * Женский (акцент ягодицы/низ, менструальный цикл), мастера/возраст (MRV↓, преабил),
 * авто-подбор сплита по доступным дням.
 */
import { normLevel, getVolumeLandmarks } from '../volume-landmarks.engine';

/**
 * Волна 5.4 (BB-AUTO-EXHAUSTIVE-PRO): единый женский бонус задней цепи
 * (glutes + hamstrings) — +20% объёма. Источник: Plotkin 2023 (Frontiers, MRI:
 * присед и hip thrust растят ягодицы, хамсы — только прямая работа), Kassiano 2024
 * (нетренированные женщины: leg press + SLDL + hip thrust +9.3% толщины glute max
 * против +6.0% без траста), Barbalho 2020 (присед ≈ траст по ягодицам).
 * Потребители: bb-builder (sessionShareFor), cycle-to-plan (glute/hams-бонусы).
 */
export const FEMALE_POSTERIOR_BOOST = 1.2;

/** Женский бонус задней цепи по мышце (1.0 — все остальные случаи). */
export function femalePosteriorBoost(muscle: string, sex?: string): number {
  return sex === 'female' && (muscle === 'glutes' || muscle === 'hamstrings') ? FEMALE_POSTERIOR_BOOST : 1;
}

export interface DemographicAdjust {
  emphasisMuscles: string[];     // приоритетные мышцы
  mrvMultiplier: number;
  extraPrehab: string[];
  splitByDays: string;           // рекомендуемый pattern id
  notes: string[];
}

export function femaleAdjust(): DemographicAdjust {
  return {
    emphasisMuscles: ['glutes', 'hamstrings', 'quads', 'calves'],
    mrvMultiplier: 0.95,
    extraPrehab: ['таз/симфиз', 'колени'],
    // D1: Female glute focus — dedicated 5×/нед split with 3 glute sessions.
    splitByDays: 'female_glute_5',
    notes: [
      'Акцент на нижнюю часть (ягодицы/бицепс бедра) — больший объём.',
      'Женский сплит 5×/нед: 3 glute-сессии (2 тяж + 1 памп) + 2 upper.',
      'Задняя цепь: glutes+hamstrings +20% (Plotkin 2023 MRI — хамсы растут только от прямого объёма; Kassiano 2024 — leg press + SLDL + thrust).',
      'Присед и hip thrust равноценны для ягодиц (Barbalho 2020); у ТРЕНИРОВАННЫХ женщин присед ≥ траст (Plotkin 2023) — приоритет приседания на продвинутом уровне.',
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