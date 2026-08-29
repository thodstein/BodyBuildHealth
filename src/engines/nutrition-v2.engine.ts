import { getNutritionV2Data, calcTrend, type NutritionV2Data } from '../core/nutrition-v2-data';
import { computeBMR } from '../core/metabolic-constants';

export interface NutritionV2Input {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  bodyFatPercent?: number;
  pal: number;
  goal: 'deficit' | 'maintenance' | 'bulk' | 'mini_cut' | 'cut' | 'strength' | 'recomp' | 'rehab' | 'health';
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
  bmrMethod: string; // FullBMRMethod from metabolic-constants (includes Harris/Henry/Livingston)
  lbm: number;
  proteinGPerKgLbm: number;
  carbFloorG: number;
}

export function calcNutritionV2(input: NutritionV2Input): NutritionV2Output {
  const v2 = getNutritionV2Data();

  // Д-16: 'cut' — маппинг fat_loss/cutting из планировщика. Все ветки дефицита
  // (goalMult/белок/карб-флор/адаптация) трактуют 'cut' как deficit — раньше
  // адаптивные фичи учитывали его, а goalMult/proteinFactor/carbMinFromVolume — нет.
  const isDeficit = input.goal === 'deficit' || input.goal === 'mini_cut' || input.goal === 'cut';

  // 1. LBM + 2. BMR — via centralized metabolic-constants (унификация с хабом)
  const bfPct = (input.bodyFatPercent && input.bodyFatPercent > 3) ? input.bodyFatPercent : (input.sex === 'male' ? 12 : 22);
  const lbm = input.weightKg * (1 - bfPct / 100);
  const bmrRes = computeBMR({ weight: input.weightKg, height: input.heightCm, age: input.age, sex: input.sex, bodyFat: input.bodyFatPercent });
  let bmr = bmrRes.bmr;
  let bmrMethod: string = bmrRes.method as string;

  // 3. Base TDEE — validated PAL (B11 fix)
  const pal = Math.max(1.15, Math.min(2.4, input.pal || 1.55));
  const baseTDEE = Math.round(bmr * pal);

  // 4. Weight trend adjustment (B6: coefficient 770 instead of 700)
  const trend = calcTrend(v2);
  let adjustment = 0;
  if (v2.weightHistory.length >= 3 && Math.abs(trend) > 0.05) {
    // Д-16: 'cut' is the caller's mapping for fat_loss/cutting — treat as a deficit for adaptive features.
    if (input.goal === 'deficit' || input.goal === 'mini_cut' || input.goal === 'cut') {
      const expectedLoss = input.goal === 'mini_cut' ? -0.7 : -0.5;
      const diff = trend - expectedLoss;
      adjustment = Math.round(diff * 770);  // B6: 1kg fat ≈ 7700 kcal → 770 kcal / 0.1 kg/нед
      adjustment = Math.max(-500, Math.min(500, adjustment));
    } else if (input.goal === 'bulk') {
      const expectedGain = 0.25;
      const diff = trend - expectedGain;
      adjustment = Math.round(diff * 770);
      adjustment = Math.max(-300, Math.min(300, adjustment));
    }
  }

  // 5. Metabolic adaptation — continuous, not stepped (B5 fix)
  const dietWeeks = v2.dietWeeks;
  let metaAdapt = 0;
  // Д-16: include 'cut' so long cutting phases accrue metabolic adaptation too.
  if ((input.goal === 'deficit' || input.goal === 'mini_cut' || input.goal === 'cut') && dietWeeks > 2) {
    metaAdapt = Math.min(0.15, dietWeeks * 0.012);  // B5: ~1.2%/нед непрерывно, кап 15%
  }
  const metaKcal = Math.round(baseTDEE * metaAdapt);

  // 6. Maintenance TDEE — pure metabolic rate (B2+B3 fix)
  const tdee = baseTDEE + adjustment - metaKcal;

  // Target kcal = maintenance TDEE × goal multiplier (B2+B3 fix: single penalty, not double)
  const goalMult = input.goal === 'deficit' ? 0.85
    : input.goal === 'mini_cut' ? 0.82
    : input.goal === 'cut' ? 0.85
    : input.goal === 'bulk' ? 1.08
    : 1.0;
  let targetKcal = Math.round(tdee * goalMult);

  // 7. Macros — sport dietology standard: LBM-based protein, weight-based fat, residual carbs (B2+B3 fix)
  const isHealth = input.goal === 'health';
  const profileGPerKg = v2.proteinGPerKg || 0;
  const proteinFactor = profileGPerKg > 0 ? profileGPerKg
    : isDeficit ? 2.5
    : isHealth ? 1.8
    : input.goal === 'bulk' ? 2.0
    : 2.0;
  const proteinG = Math.round(lbm * proteinFactor);
  const proteinKcal = proteinG * 4;

  const fatFactor = v2.fatMinGPerKg || 0;
  const fatG = fatFactor > 0
    ? Math.round(input.weightKg * fatFactor)
    : Math.round(input.weightKg * (input.goal === 'bulk' ? 1.0 : 0.85));
  const fatKcal = fatG * 9;

  // Carbs as residual from target kcal (B2 fix: single penalty, not double)
  const carbFloorG = 130;
  let carbsG = Math.max(carbFloorG, Math.round((targetKcal - proteinKcal - fatKcal) / 4));

  // Training-driven carb floor: higher volume = more carbs needed
  const trainingDays = input.trainingDaysPerWeek || 3;
  const avgTrainMin = input.avgTrainingMinutes || 60;
  const trainingVolume = trainingDays * avgTrainMin;
  let carbMinFromVolume: number;
  if (trainingVolume >= 600) carbMinFromVolume = 4.5;
  else if (trainingVolume >= 400) carbMinFromVolume = 3.5;
  else if (trainingVolume >= 200) carbMinFromVolume = 2.5;
  else carbMinFromVolume = 2.0;
  if (input.goal === 'deficit') carbMinFromVolume *= 0.7;
  else if (input.goal === 'mini_cut') carbMinFromVolume *= 0.6;
  else if (input.goal === 'cut') carbMinFromVolume *= 0.7;
  else if (input.goal === 'bulk') carbMinFromVolume *= 1.2;
  else if (input.goal === 'health') carbMinFromVolume *= 0.9;
  const trainingCarbFloor = Math.round(input.weightKg * carbMinFromVolume);
  // Raise carb floor if training demands more (but don't exceed calorie budget)
  carbsG = Math.max(carbsG, Math.min(trainingCarbFloor, Math.max(carbFloorG, Math.round((targetKcal - proteinKcal - fatKcal) / 3.5))));

  // kcal from macros — should be close to targetKcal (B2 fix: one unified pathway)
  // Audit-fix: ниже убран повторный пересчёт carbsG (дублировал строку выше и
  // затирал поднятый тренировочный карб-флор) — carbsG остаётся как рассчитан.
  let kcal = proteinKcal + fatKcal + carbsG * 4;

  // Safety bounds (B12 fix)
  const minKcal = Math.round(proteinKcal + fatKcal + carbFloorG * 4);
  if (kcal < minKcal) {
    kcal = minKcal;
    carbsG = carbFloorG;
  }
  const maxKcal = Math.round(tdee * 1.25);  // B12: not more than +25% of maintenance even for bulk
  if (kcal > maxKcal) {
    kcal = maxKcal;
    carbsG = Math.max(carbFloorG, Math.round((maxKcal - proteinKcal - fatKcal) / 4));
  }

  // Refeed recommendation (B7 fix)
  // Д-16: include 'cut' so cutting users also get refeed guidance on plateau / long diet.
const refeedRecommended = dietWeeks > 4 && (input.goal === 'deficit' || input.goal === 'mini_cut' || input.goal === 'cut')
    && (trend > -0.2 || dietWeeks >= 6);  // B7: plateau OR prophylactic refeed every 6+ weeks

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
