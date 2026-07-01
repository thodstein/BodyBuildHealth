/**
 * nutrition-periworkout.engine.ts — пери-воркаутное питание (до/во время/после)
 * на основе объёма и длительности тренировочной сессии и массы тела.
 * Цель: углеводы для работоспособности + белок для восстановления + жидкость.
 */
export interface PeriWorkoutInput {
  /** объём сессии, кг·повт (тоннаж) — нагрузочный маркер */
  sessionVolume: number;
  /** длительность, мин */
  durationMin: number;
  /** масса тела, кг */
  bodyWeight: number;
  /** цель (bulk/cut/strength/maintenance/recomp) — влияет на пост-углеводы */
  goal?: string;
}

export interface PeriWorkoutPlan {
  pre: { carbsG: number; timing: string; note: string };
  intra: { carbsGPerH: number; fluidMlPerH: number; note: string };
  post: { carbsG: number; proteinG: number; timing: string; note: string };
  fluidTotalMl: number;
  rationale: string[];
}

const r = (v: number) => Math.round(v * 10) / 10;

export function computePeriWorkoutNutrition(input: PeriWorkoutInput): PeriWorkoutPlan {
  const bw = Math.max(40, input.bodyWeight || 80);
  const dur = Math.max(20, input.durationMin || 60);
  const vol = Math.max(0, input.sessionVolume || 0);
  const goal = input.goal || 'strength';

  // интенсивность сессии: шкала по длительности и тоннажу
  const durScale = dur >= 90 ? 1.15 : dur >= 60 ? 1.0 : dur >= 40 ? 0.85 : 0.7;
  const volScale = vol >= 20000 ? 1.1 : vol >= 10000 ? 1.0 : vol >= 3000 ? 0.9 : 0.8;
  const k = durScale * volScale;

  // До: 1-2 г/кг углеводов за 1-3 ч
  const preCarbs = r(bw * 1.5 * k);
  // Во время: 0.7 г/кг/ч для >60мин или тяжёлых; минимум 30 г/ч
  const intraCarbsPerH = dur >= 60 || vol >= 10000 ? Math.max(30, r(bw * 0.7 * (dur >= 90 ? 1.0 : 0.8))) : 0;
  const intraFluidPerH = r(500 * (dur >= 75 ? 1.2 : 1.0)); // 400-600 мл/ч
  // После: углеводы 1-1.2 г/кг (на массе/силе больше; на сушке меньше), белок 0.3-0.4 г/кг
  const postCarbsBase = goal === 'cut' ? 0.6 : goal === 'maintenance' ? 0.8 : 1.1;
  const postCarbs = r(bw * postCarbsBase * k);
  const postProtein = r(bw * 0.35);
  // Жидкость: 500 мл до + интра + 1.25× потери после (~150% от интра-часа)
  const intraHours = dur / 60;
  const fluidTotal = r(500 + intraFluidPerH * intraHours + (intraFluidPerH * intraHours) * 1.25);

  const rationale = [
    `Нагрузка: ${dur} мин, тоннаж ${Math.round(vol)} кг·повт (коэф. ${k.toFixed(2)}).`,
    `До: ${preCarbs}г углеводов за 1-3 ч (≈1.5 г/кг) — топливо, сохранение гликогена.`,
    intraCarbsPerH > 0 ? `Во время: ${intraCarbsPerH}г углеводов/ч + ${intraFluidPerH}мл/ч — поддержание глюкозы, производительность.` : `Во время: короткая сессия — достаточно воды.`,
    `После: ${postCarbs}г углеводов + ${postProtein}г белка в течение 2 ч — гликоген + синтез белка.`,
    `Жидкость за сессию: ~${fluidTotal} мл.`,
  ];

  return {
    pre: { carbsG: preCarbs, timing: '1-3 ч до', note: 'Сложные углеводы (рис, овсянка, pasta) + немного белка.' },
    intra: { carbsGPerH: intraCarbsPerH, fluidMlPerH: intraFluidPerH, note: intraCarbsPerH > 0 ? 'Изотоник / мальтодекстрин + вода.' : 'Вода по жажде.' },
    post: { carbsG: postCarbs, proteinG: postProtein, timing: '0-2 ч после', note: 'Углеводы + быстрый белок (сыворотка) для восстановления.' },
    fluidTotalMl: fluidTotal,
    rationale,
  };
}