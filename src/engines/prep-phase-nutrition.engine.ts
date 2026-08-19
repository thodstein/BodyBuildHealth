/**
 * prep-phase-nutrition.engine.ts — интеграция с contest prep (доп. функция 7).
 *
 * Лёгкий слой поверх BB-contest-prep: по фазе prep возвращает питательные ориентиры
 * (белок/жиры/углеводы/вода/натрий) и предупреждения для рискованных фаз (пик-неделя:
 * манипуляции водой/натрием только при подтверждении и под наблюдением).
 * Не назначает дозы — только рамки для скоринга приёмов.
 */
export type PrepPhase = 'preparation' | 'final_preparation' | 'taper' | 'peak_week' | 'show_day' | 'post_show';

export interface PrepNutritionInput {
  phase: PrepPhase;
  weightKg?: number;
  sex?: 'male' | 'female';
  manualManipulationConfirmed?: boolean;
}

export interface PrepNutritionResult {
  phase: PrepPhase;
  proteinGPerKg: number;
  fatFloorGPerKg: number;
  carbMode: 'normal' | 'lower' | 'reduced' | 'tapered' | 'loaded';
  sodium: 'stable' | 'modulated';
  water: 'stable' | 'modulated';
  warnings: string[];
  recommendation: string;
}

export function assessPrepPhaseNutrition(input: PrepNutritionInput): PrepNutritionResult {
  const sex = input.sex || 'male';
  const bw = Math.max(40, input.weightKg || 80);
  const confirmed = input.manualManipulationConfirmed === true;

  let proteinGPerKg = 2.2;
  let fatFloorGPerKg = sex === 'female' ? 0.8 : 0.6;
  let carbMode: PrepNutritionResult['carbMode'] = 'normal';
  let sodium: PrepNutritionResult['sodium'] = 'stable';
  let water: PrepNutritionResult['water'] = 'stable';
  const warnings: string[] = [];

  switch (input.phase) {
    case 'preparation':
      proteinGPerKg = 2.2; fatFloorGPerKg = sex === 'female' ? 0.8 : 0.6; carbMode = 'lower';
      break;
    case 'final_preparation':
      proteinGPerKg = 2.5; fatFloorGPerKg = sex === 'female' ? 0.8 : 0.6; carbMode = 'reduced';
      break;
    case 'taper':
      proteinGPerKg = 2.2; carbMode = 'tapered'; sodium = 'stable'; water = 'stable';
      break;
    case 'peak_week':
      proteinGPerKg = 2.2; carbMode = 'loaded';
      if (confirmed) { sodium = 'modulated'; water = 'modulated'; }
      else {
        warnings.push('Пик-неделя: манипуляции водой/натрием требуют подтверждения и контроля; по умолчанию вода/натрий стабильны.');
      }
      break;
    case 'show_day':
      proteinGPerKg = 2.0; carbMode = 'loaded';
      warnings.push('День шоу: приём по отработанному протоколу, без экспериментов.');
      break;
    case 'post_show':
      proteinGPerKg = 2.0; carbMode = 'normal'; sodium = 'stable'; water = 'stable';
      warnings.push('Пост-шоу: восстановление, вода/натрий стабильны, без манипуляций.');
      break;
  }

  const recommendation = `Фаза «${input.phase}»: белок ~${proteinGPerKg} г/кг, жиры ≥ ${fatFloorGPerKg} г/кг, карб-режим — ${carbMode}; вода/натрий — ${water === 'modulated' ? 'модулируются' : 'стабильны'}/${sodium === 'modulated' ? 'модулируются' : 'стабильны'} (масса ${Math.round(bw)} кг).`;

  return { phase: input.phase, proteinGPerKg, fatFloorGPerKg, carbMode, sodium, water, warnings, recommendation };
}
