import { getNutritionV2Data, calcTrend, type NutritionV2Data } from '../core/nutrition-v2-data';

export interface NutritionV2Input {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  bodyFatPercent?: number;
  pal: number;
  goal: 'deficit' | 'maintenance' | 'bulk' | 'mini_cut';
  trainingDaysPerWeek?: number;
  avgTrainingMinutes?: number;
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
  lbm: number;
  proteinGPerKgLbm: number;
  carbFloorG: number;
}

export function calcNutritionV2(input: NutritionV2Input): NutritionV2Output {
  const v2 = getNutritionV2Data();

  // 1. Calculate LBM (lean body mass) — sport dietology standard
  const bfPct = (input.bodyFatPercent && input.bodyFatPercent > 3) ? input.bodyFatPercent : (input.sex === 'male' ? 15 : 22);
  const lbm = input.weightKg * (1 - bfPct / 100);

  // 2. BMR — Cunningham when BF known, Mifflin-St Jeor as fallback
  let bmr: number;
  let bmrMethod: 'mifflin' | 'cunningham';
  if (input.bodyFatPercent && input.bodyFatPercent > 5) {
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

  // 3. Base TDEE
  const baseTDEE = Math.round(bmr * input.pal);

  // 4. Weight trend adjustment
  const trend = calcTrend(v2);
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

  // 7. Macros — sport dietology standard: LBM-based protein
  const profileGPerKg = v2.proteinGPerKg || 0;
  const proteinFactor = profileGPerKg > 0 ? profileGPerKg
    : input.goal === 'deficit' || input.goal === 'mini_cut' ? 2.5
    : input.goal === 'bulk' ? 2.0
    : 2.0;
  const proteinG = Math.round(lbm * proteinFactor);
  const proteinKcal = proteinG * 4;

  const fatFactor = v2.fatMinGPerKg || 0;
  const fatG = fatFactor > 0
    ? Math.round(input.weightKg * fatFactor)
    : Math.round(input.weightKg * (input.goal === 'bulk' ? 1.0 : 0.85));
  const fatKcal = fatG * 9;

  // Carbs as training-driven target, not residual
  const carbFloorG = 130;
  const trainingDays = input.trainingDaysPerWeek || 3;
  const avgTrainMin = input.avgTrainingMinutes || 60;
  const trainingVolume = trainingDays * avgTrainMin;
  let carbsGPerKg: number;
  if (trainingVolume >= 600) carbsGPerKg = 6.5;
  else if (trainingVolume >= 400) carbsGPerKg = 5.5;
  else if (trainingVolume >= 200) carbsGPerKg = 4.5;
  else carbsGPerKg = 3.5;
  if (input.goal === 'deficit') carbsGPerKg *= 0.7;
  else if (input.goal === 'mini_cut') carbsGPerKg *= 0.6;
  else if (input.goal === 'bulk') carbsGPerKg *= 1.2;

  let carbsG = Math.round(input.weightKg * carbsGPerKg);
  if (carbsG < carbFloorG) carbsG = carbFloorG;

  // Recalculate kcal from macros (more accurate than TDEE × factor)
  let kcal = proteinKcal + fatKcal + carbsG * 4;

  // Goal adjustment to kcal
  if (input.goal === 'deficit') kcal = Math.round(kcal * 0.85);
  else if (input.goal === 'mini_cut') kcal = Math.round(kcal * 0.78);
  else if (input.goal === 'bulk') kcal = Math.round(kcal * 1.08);

  // Ensure at least TDEE for training
  if (input.goal !== 'deficit' && input.goal !== 'mini_cut' && kcal < tdee * 0.95) {
    kcal = Math.round(tdee * 0.95);
  }

  // Recalculate carbs from final kcal
  const carbsFromKcal = Math.max(carbFloorG, Math.round((kcal - proteinKcal - fatKcal) / 4));
  carbsG = carbsFromKcal;

  // Refeed recommendation
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
    lbm: Math.round(lbm),
    proteinGPerKgLbm: Math.round(proteinFactor * 10) / 10,
    carbFloorG,
  };
}
