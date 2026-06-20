import { getNutritionV2Data, calcTrend, type NutritionV2Data } from '../core/nutrition-v2-data';

export interface NutritionV2Input {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  bodyFatPercent?: number;
  pal: number;
  goal: 'deficit' | 'maintenance' | 'bulk' | 'mini_cut';
}

export interface NutritionV2Output {
  tdee: number;
  baseTdee: number;
  adjustment: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  kcal: number;
  trendKgPerWeek: number;
  metabolicAdaptation: number;
  refeedRecommended: boolean;
  bmrMethod: 'mifflin' | 'cunningham';
}

export function calcNutritionV2(input: NutritionV2Input): NutritionV2Output {
  const v2 = getNutritionV2Data();

  // 1. BMR
  let bmr: number;
  let bmrMethod: 'mifflin' | 'cunningham';
  if (input.bodyFatPercent && input.bodyFatPercent > 5) {
    const lbm = input.weightKg * (1 - input.bodyFatPercent / 100);
    bmr = 370 + 21.6 * lbm;
    bmrMethod = 'cunningham';
  } else {
    if (input.sex === 'male') {
      bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + 5;
    } else {
      bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age - 161;
    }
    bmrMethod = 'mifflin';
  }

  // 2. Base TDEE
  const baseTDEE = Math.round(bmr * input.pal);

  // 3. Weight trend
  const trend = calcTrend(v2);

  // 4. Adjustment from weight trend
  let adjustment = 0;
  if (v2.weightHistory.length >= 3 && Math.abs(trend) > 0.05) {
    if (input.goal === 'deficit' || input.goal === 'mini_cut') {
      const expectedLoss = input.goal === 'deficit' ? -0.5 : -0.7;
      const diff = trend - expectedLoss;
      adjustment = Math.round(diff * 700);
      adjustment = Math.max(-500, Math.min(500, adjustment));
    } else if (input.goal === 'bulk') {
      const expectedGain = 0.25;
      const diff = trend - expectedGain;
      adjustment = Math.round(diff * 700);
      adjustment = Math.max(-300, Math.min(300, adjustment));
    }
  }

  // 5. Metabolic adaptation
  const dietWeeks = v2.dietWeeks;
  let metaAdapt = 0;
  if (input.goal === 'deficit' || input.goal === 'mini_cut') {
    if (dietWeeks > 8) metaAdapt = 0.1;
    else if (dietWeeks > 4) metaAdapt = 0.05;
  }
  const metaKcal = Math.round(baseTDEE * metaAdapt);

  // 6. Final TDEE
  const tdee = baseTDEE + adjustment - metaKcal;

  // 7. Macros
  const proteinG = Math.round(input.weightKg * v2.proteinGPerKg);
  const proteinKcal = proteinG * 4;
  const fatG = Math.round(input.weightKg * v2.fatMinGPerKg);
  const fatKcal = fatG * 9;
  const carbsKcal = tdee - proteinKcal - fatKcal;
  const carbsG = Math.max(0, Math.round(carbsKcal / 4));

  // 8. Goal adjustment
  let kcal = tdee;
  if (input.goal === 'deficit') kcal = Math.round(tdee * 0.8);
  else if (input.goal === 'mini_cut') kcal = Math.round(tdee * 0.75);
  else if (input.goal === 'bulk') kcal = Math.round(tdee * 1.1);

  // 9. Refeed recommendation
  const refeedRecommended = dietWeeks > 4 && input.goal === 'deficit' && trend > -0.2;

  return {
    tdee: Math.round(tdee),
    baseTdee: baseTDEE,
    adjustment,
    proteinG,
    fatG,
    carbsG,
    kcal,
    trendKgPerWeek: trend,
    metabolicAdaptation: metaAdapt,
    refeedRecommended,
    bmrMethod,
  };
}
