/**
 * planner-targets.ts — чистая функция расчёта КБЖУ-целей планировщика.
 *
 * Bug-4 fix: вынесено из IndividualPlanContext.calcTargets (useMemo с мутационной
 * цепочкой из 10+ веток) в тестируемую чистую функцию. Контракт: чистая, детерминированная,
 * один источник истины для целей. Порядок правил зафиксирован и задокументирован.
 *
 * Порядок применения правил (каждое последующее видит результат предыдущего):
 *   1. PAL + BMR/TDEE через calcNutritionV2 (fallback calcNutrition)
 *   2. Bulk surplus % (если не дефолт 10%)
 *   3. Фаза курса (kcalMod + pAdd г/кг) с пересчётом Ж/У из остатка
 *   4. AAS: +0.3 г/кг белка
 *   5. Короткий инсулин: минимум углеводов по дозе, потолок жира
 *   6. Любой инсулин: потолок жира 0.5 г/кг
 *   7. GLP-1: потолок жира 0.4 г/кг, +0.2 г/кг белка
 *   8. Weight-adapt (по логу веса): масштаб kcal/Б/Ж/У
 *   9. Metabolic adaptation %: масштаб всего
 *  10. Ручные г/кг (перезаписывают Б/Ж/У и пересчитывают kcal)
 *
 * Возвращает { bmr, tdee, kcal, protein, fats, carbs, adjustment }.
 */

import { calcNutrition } from "../../../../engines/nutrition.engine";
import { calcNutritionV2 } from "../../../../engines/nutrition-v2.engine";
import { computePalFull } from "../../../../core/metabolic-constants";

export interface PlannerTargetInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female' | '';
  goal: string;            // mass/strength/fat_loss/cutting/post_cut/maintenance/recomposition/rehab
  phase: string;           // course/bridge/pct/recovery/cutting/maintenance/recomp/fat_loss/post_cut
  bodyFatPct: number;
  workoutsPerWeek: number;
  avgWorkoutMinutes: number;
  dailySteps: number;
  householdActivity: 'light' | 'moderate' | 'active' | '' | string;
  trainType: 'hiit' | 'cardio' | 'mixed' | '' | string;
  trainIntensity: 'low' | 'medium' | 'high' | '' | string;
  surplusPct: number;
  injections: { type: string; dose: number; esterType?: string }[];
  weightAdaptMode: boolean;
  weightLogWeek: number[];
  expectedLossKgWeek: number;
  metabolicAdaptEnabled: boolean;
  metabolicAdaptPct: number;
  manualGPerKg: { protein: number; fat: number; carbs: number };
}

export interface PlannerTargets {
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  fats: number;
  carbs: number;
  adjustment: number;
}

// ─── Диетологический потолок углеводов (П.4/П.1, Aug 22 2026; контекст Aug 28 2026) ──
// Цель углеводов НЕ должна раздуваться множителями уровня/циклинга до абсурда
// (жалоба «120 кг на курсе → 900/814 г углеводов»).
// Aug 28 2026 (жалоба «110 кг атлет — цель срезана»): потолок 5 г/кг для ВСЕХ целей
// срезал bulk-план крупного атлета до ~4000 ккал при TDEE+профицит ~4800. Теперь потолок
// КОНТЕКСТНЫЙ (если передан goalPhase): cut/дефицит → 5 г/кг (как раньше), recomp/health/
// maintenance/strength → 6, bulk → по тренировочному объёму: ≥600 мин/нед → 8, ≥400 → 7,
// иначе 6 (Helms 2014, Slater 2019: межсезонье 4-8 г/кг при высоком объёме). Без goalPhase
// поведение прежнее (5 г/кг) — обратно-совместимо. Ручной режим (manual) капа не имеет
// по определению ( Context передаёт manualC напрямую ).
// При инсулине потолок НЕ ниже инсулин-флора (~10 г/1 ЕД, но не более 8 г/кг) —
// иначе высокие дозы не были бы обеспечены углеводами. Чистая функция: тестируемая.
export function contextualCarbCapGPerKg(goalPhase?: string, trainingVolumeMinPerWeek?: number): number {
  if (!goalPhase) return 5;
  if (goalPhase === 'cut') return 5;
  if (goalPhase === 'bulk') {
    const vol = Math.max(0, Number(trainingVolumeMinPerWeek) || 0);
    if (vol >= 600) return 8;
    if (vol >= 400) return 7;
    return 6;
  }
  // recomp / health / maintenance / strength — умеренный потолок
  return 6;
}

export function computeDieteticCarbTarget(opts: {
  weightKg: number;
  rawCarbsG: number;
  insulinTotalUnits?: number;
  carbGPerKg?: number;      // потолок г/кг (по умолчанию: контекст goalPhase или 5)
  maxCarbGPerKg?: number;   // верхний предел при инсулине (по умолчанию 8)
  minCarbG?: number;        // нижний этаж (по умолчанию 50)
  goalPhase?: string;       // 'bulk' | 'cut' | 'maintenance' | 'recomp' | 'health' | 'strength'
  trainingVolumeMinPerWeek?: number; // минуты тренировок в неделю (для bulk 7-8 г/кг)
}): number {
  const w = Math.max(1, opts.weightKg || 0);
  const carbGPerKg = opts.carbGPerKg ?? contextualCarbCapGPerKg(opts.goalPhase, opts.trainingVolumeMinPerWeek);
  const maxCarbGPerKg = opts.maxCarbGPerKg ?? 8;
  const minCarbG = opts.minCarbG ?? 50;
  const insulinTotal = Math.max(0, opts.insulinTotalUnits || 0);
  const insulinFloor = Math.round(insulinTotal * 10); // ~10 г на 1 ЕД
  const ceilingAbs = Math.round(w * maxCarbGPerKg);
  const floorCapped = Math.min(insulinFloor, ceilingAbs);
  const ceiling = Math.max(Math.round(w * carbGPerKg), floorCapped, minCarbG);
  const val = Math.max(floorCapped, Math.min(Math.max(opts.rawCarbsG || 0, minCarbG), ceiling));
  return Math.min(val, ceilingAbs);
}

// Категория цели для контекстных капов (GOAL_MAP вне computePlannerTargets).
export function plannerGoalCategory(goal: string): string {
  return GOAL_MAP[goal] || 'maintenance';
}

// ─── П2 (Роунд-2, Aug 28): совет автокоррекции калорий по темпу веса ──────
// Единый контур «план → факт → коррекция»: недельный темп из лога веса vs
// целевой темп цели → ±150-250 ккал ОДНОЙ переменной (калории), без стэкинга.
export interface PlannerWeightAdviceInput {
  weightLog: number[];          // веса по дням (ASC или DESC — сортируется внутри)
  goal: string;                 // mass/strength/fat_loss/cutting/maintenance/...
  sex: 'male' | 'female' | '';
  kcalTarget: number;
  expectedLossKgWeek?: number;  // ожидаемый темп потери (если задан пользователем)
}
export interface PlannerWeightAdvice {
  status: 'no_data' | 'ok' | 'too_fast_loss' | 'too_slow_loss' | 'too_fast_gain' | 'too_slow_gain';
  weeklyKg: number;
  targetWeeklyKg: number;
  kcalDelta: number;            // применение: manualKcal += kcalDelta (совет, не авто)
  reason: string;
}
export function plannerWeightAdjustAdvice(input: PlannerWeightAdviceInput): PlannerWeightAdvice {
  const noData: PlannerWeightAdvice = { status: 'no_data', weeklyKg: 0, targetWeeklyKg: 0, kcalDelta: 0, reason: 'Записывайте вес в дневник ежедневно — совет появится через ~7 дней замеров.' };
  const valid = [...(input.weightLog || [])].filter(w => Number.isFinite(w) && w > 0);
  if (valid.length < 4) return noData;
  const first = valid[0]; const last = valid[valid.length - 1];
  const intervals = Math.max(1, valid.length - 1);
  const weeklyKg = Math.round(((last - first) / intervals * 7) * 100) / 100; // + = набор
  const isCut = ['cut', 'fat_loss', 'cutting'].includes(input.goal);
  const isBulk = ['bulk', 'mass'].includes(input.goal);
  if (!isCut && !isBulk) return { ...noData, reason: 'Совет коррекции — для целей набора/сушки (maintenance не корректируется по весу).' };
  const female = input.sex === 'female';
  const targetWeeklyKg = isCut
    ? -(input.expectedLossKgWeek && input.expectedLossKgWeek > 0 ? input.expectedLossKgWeek : (female ? 0.004 : 0.005) * (valid.length > 0 ? Math.max(...valid) : 80))
    : (female ? 0.0015 : 0.002) * Math.max(...valid);
  const diff = weeklyKg - targetWeeklyKg; // >0 = быстрее цели (для cut: медленнее теряет)
  // Порог значимости: ±0.1 кг/нед — меньше = шум воды
  if (Math.abs(diff) < 0.1) {
    return { status: 'ok', weeklyKg, targetWeeklyKg: Math.round(targetWeeklyKg * 100) / 100, kcalDelta: 0, reason: `Темп в норме: ${weeklyKg > 0 ? '+' : ''}${weeklyKg} кг/нед при цели ${Math.round(targetWeeklyKg * 100) / 100} кг/нед. Ничего не меняем.` };
  }
  // Сушка: теряет медленнее цели → ↓ккал; теряет быстрее → ↑ккал (защита мышц)
  const step = female ? 125 : 150;
  if (isCut) {
    if (weeklyKg > targetWeeklyKg * 0.5) {
      return { status: 'too_slow_loss', weeklyKg, targetWeeklyKg: Math.round(targetWeeklyKg * 100) / 100, kcalDelta: -step, reason: `Сушка stalled: ${weeklyKg} кг/нед вместо ${Math.round(targetWeeklyKg * 100) / 100}. Снизьте калории на ${step} и оцените через 2 недели.` };
    }
    if (weeklyKg < targetWeeklyKg * 1.5) {
      return { status: 'too_fast_loss', weeklyKg, targetWeeklyKg: Math.round(targetWeeklyKg * 100) / 100, kcalDelta: step, reason: `Потеря слишком быстрая (${weeklyKg} кг/нед) — риск мышц. Добавьте ${step} ккал.` };
    }
  } else {
    if (weeklyKg < targetWeeklyKg * 0.5) {
      return { status: 'too_slow_gain', weeklyKg, targetWeeklyKg: Math.round(targetWeeklyKg * 100) / 100, kcalDelta: step, reason: `Набор медленнее цели: ${weeklyKg > 0 ? '+' : ''}${weeklyKg} кг/нед. Добавьте ${step} ккал.` };
    }
    if (weeklyKg > targetWeeklyKg * 2) {
      return { status: 'too_fast_gain', weeklyKg, targetWeeklyKg: Math.round(targetWeeklyKg * 100) / 100, kcalDelta: -step, reason: `Набор слишком быстрый (${weeklyKg > 0 ? '+' : ''}${weeklyKg} кг/нед) — много жира. Снизьте на ${step} ккал.` };
    }
  }
  return { status: 'ok', weeklyKg, targetWeeklyKg: Math.round(targetWeeklyKg * 100) / 100, kcalDelta: 0, reason: 'Темп в допустимом коридоре.' };
}

const PHASE_MULT: Record<string, { kcalMod: number; pAdd: number }> = {
  course: { kcalMod: 1.0, pAdd: 0.3 },
  bridge: { kcalMod: 0.95, pAdd: 0 },
  pct: { kcalMod: 0.9, pAdd: 0 },
  recovery: { kcalMod: 1.05, pAdd: 0.3 },
  cutting: { kcalMod: 0.8, pAdd: 0.2 },
  maintenance: { kcalMod: 1.0, pAdd: 0 },
  recomp: { kcalMod: 0.9, pAdd: 0.1 },
  fat_loss: { kcalMod: 0.75, pAdd: 0.2 },
  post_cut: { kcalMod: 1.05, pAdd: 0.1 },
};

const GOAL_MAP: Record<string, string> = {
  mass: 'bulk', strength: 'strength', fat_loss: 'cut', cutting: 'cut',
  post_cut: 'maintenance', maintenance: 'maintenance', recomposition: 'recomp', rehab: 'rehab',
  health: 'health',
};

export function computePlannerTargets(input: PlannerTargetInput): PlannerTargets {
  const {
    weightKg: _weight, heightCm: height, age, sex, goal, phase, bodyFatPct,
    workoutsPerWeek: _wpw, avgWorkoutMinutes: _awm, dailySteps, householdActivity,
    trainType, trainIntensity, surplusPct, injections: _injections,
    weightAdaptMode, weightLogWeek, expectedLossKgWeek,
    metabolicAdaptEnabled, metabolicAdaptPct: _metabolicAdaptPct, manualGPerKg: _manualGPerKg,
  } = input;
  const weight = Math.max(40, Math.min(300, Number(_weight) || 80));
  const wpw = Math.max(0, Number(_wpw) || 0);
  const awm = Math.max(0, Number(_awm) || 0);
  const injections = Array.isArray(_injections) ? _injections : [];
  const metabolicAdaptPct = Math.max(0, Math.min(50, Number(_metabolicAdaptPct) || 0));
  const manualGPerKg = _manualGPerKg && typeof _manualGPerKg === 'object' ? _manualGPerKg : { protein: 0, fat: 0, carbs: 0 };

  // 1. PAL + TDEE — via centralized computePalFull (унификация с хабом)
  const pal = computePalFull({
    workoutsPerWeek: wpw,
    avgWorkoutMinutes: awm,
    dailySteps: Number(dailySteps) || 0,
    householdActivity: String(householdActivity || ''),
    trainType: String(trainType || ''),
    trainIntensity: String(trainIntensity || ''),
  });

  const engineGoal = GOAL_MAP[goal] || 'maintenance';

  // weight-adapt factor (computed from weight log)
  // P0-fix: weeklyAvgLoss = total_loss / days_span * 7 (single division).
  // Previous formula divided by (n-1) TWICE → understated loss rate by (n-1)x,
  // causing insufficient kcal correction during real weight loss.
  // weightLogWeek holds point measurements; span between first and last = (n-1) intervals.
  // Each interval is assumed to be 1 day (caller passes daily weights); for a weekly log
  // the caller should pass 7-8 points. If intervals are >1 day, the rate is still
  // approximately correct because we scale by the ratio 7/(n-1).
  let weightAdj = 1.0;
  if (weightAdaptMode && weightLogWeek.length >= 2) {
    // FIX input-audit: фильтруем 0/отрицательные записи — они давали ложный «сброс веса»
    // (80 → 0 = «потеря 80кг») и молча поднимали калораж до +20%
    const validW = weightLogWeek.filter(w => Number.isFinite(w) && w > 0);
    if (validW.length >= 2) {
      const actualLoss = validW[0] - validW[validW.length - 1];
      const intervals = Math.max(1, validW.length - 1);
      // kg per week = (total loss / intervals) * 7 (assume 1 interval = 1 day).
      // If intervals span a different period, the caller's weightLogWeek is responsible
      // for reflecting that; we only correct the double-division bug here.
      const weeklyAvgLoss = actualLoss > 0 ? (actualLoss / intervals) * 7 : 0;
      if (expectedLossKgWeek > 0 && weeklyAvgLoss < expectedLossKgWeek * 0.7) {
        weightAdj = 1 - (expectedLossKgWeek - Math.max(0, weeklyAvgLoss)) * 2 / Math.max(1, weight);
      } else if (weeklyAvgLoss > expectedLossKgWeek * 1.3) {
        weightAdj = 1 + (weeklyAvgLoss - expectedLossKgWeek) * 2 / Math.max(1, weight);
      }
      weightAdj = Math.max(0.8, Math.min(1.2, weightAdj));
    }
  }

  const targetsV2 = (() => {
    try {
      return calcNutritionV2({
        weightKg: weight, heightCm: height, age, sex: sex || 'male',
        pal, goal: engineGoal as any, bodyFatPercent: bodyFatPct,
        trainingDaysPerWeek: wpw, avgTrainingMinutes: awm,
      });
    } catch { return null; }
  })();

  const baseTdeeV2 = targetsV2?.baseTdee || 0;
  const adjV2 = targetsV2?.adjustment || 0;

  let targets: any;
  if (targetsV2) {
    targets = {
      bmr: baseTdeeV2 > 0 ? Math.round(baseTdeeV2 / (pal || 1.2)) : 0,
      tdee: baseTdeeV2 || Math.round(targetsV2.kcal - adjV2),
      kcal: targetsV2.kcal,
      protein: targetsV2.proteinG,
      fats: targetsV2.fatG,
      carbs: targetsV2.carbsG,
      adjustment: adjV2,
    };
  } else {
    try {
      const r = calcNutrition({ weightKg: weight, heightCm: height, age, sex: sex || 'male', pal, goal: engineGoal });
      targets = { bmr: r.bmr, tdee: r.tdee, kcal: r.kcal, protein: r.protein, fats: r.fats, carbs: r.carbs, adjustment: r.kcal - r.tdee };
    } catch {
      targets = { bmr: 0, tdee: 0, kcal: 2500, protein: 160, fats: 70, carbs: 300, adjustment: 0 };
    }
  }

  // 2. Bulk surplus
  if (engineGoal === 'bulk' && surplusPct !== 10) {
    targets.kcal = Math.round((targets.tdee || targets.kcal) * (1 + surplusPct / 100));
    targets.carbs = Math.round((targets.kcal - targets.protein * 4 - targets.fats * 9) / 4);
  }

  // 3. Phase multipliers
  const pm = PHASE_MULT[phase] || { kcalMod: 1.0, pAdd: 0 };
  targets.kcal = Math.round(targets.kcal * pm.kcalMod);
  targets.protein = Math.round(targets.protein + weight * pm.pAdd);
  if (pm.kcalMod !== 1.0 || pm.pAdd !== 0) {
    const pKcal = targets.protein * 4;
    const remaining = Math.max(0, targets.kcal - pKcal);
    if (targets.fats > 0 || targets.carbs > 0) {
      const fRatio = (targets.fats * 9) / Math.max(1, targets.fats * 9 + targets.carbs * 4);
      targets.fats = Math.round((remaining * fRatio) / 9);
      targets.carbs = Math.round((remaining * (1 - fRatio)) / 4);
    } else {
      targets.fats = Math.round((remaining * 0.25) / 9);
      targets.carbs = Math.round((remaining * 0.75) / 4);
    }
  }

  // 4-7. Pharma adjustments
  const hasAAS = injections.some(i => i.type === 'ААС');
  const hasShortInsulin = injections.some(i => i.type === 'инсулин' && i.esterType != null && i.esterType !== 'long');
  const hasInsulin = injections.some(i => i.type === 'инсулин');
  const hasGLP = injections.some(i => i.type === 'семаглутид' || i.type === 'тирзепатид');

  if (hasAAS) {
    targets.protein = Math.round(targets.protein + weight * 0.3);
    targets.kcal = targets.protein * 4 + targets.fats * 9 + targets.carbs * 4;
  }
  if (hasShortInsulin) {
    const totalInsulinDose = injections.filter(i => i.type === 'инсулин' && i.esterType != null && i.esterType !== 'long').reduce((s, i) => s + (Number(i.dose) || 0), 0);
    const minInsulinCarbs = totalInsulinDose * 10;
    if (targets.carbs < minInsulinCarbs) targets.carbs = Math.round(minInsulinCarbs * 1.2);
    const maxFat = Math.round(weight * 0.5);
    if (targets.fats > maxFat) targets.fats = maxFat;
    targets.kcal = targets.protein * 4 + targets.fats * 9 + targets.carbs * 4;
  } else if (hasInsulin) {
    const maxFat = Math.round(weight * 0.5);
    if (targets.fats > maxFat) targets.fats = maxFat;
    targets.kcal = targets.protein * 4 + targets.fats * 9 + targets.carbs * 4;
  }
  if (hasGLP) {
    targets.fats = Math.min(targets.fats, Math.round(weight * 0.4));
    targets.protein = Math.round(targets.protein + weight * 0.2);
    targets.kcal = targets.protein * 4 + targets.fats * 9 + targets.carbs * 4;
  }

  // 8. Weight adapt
  if (weightAdj !== 1.0) {
    targets.kcal = Math.round(targets.kcal * weightAdj);
    targets.protein = Math.round(targets.protein * weightAdj);
    targets.fats = Math.round(targets.fats * weightAdj);
    targets.carbs = Math.round(targets.carbs * weightAdj);
  }

  // 9. Metabolic adaptation
  if (metabolicAdaptEnabled && metabolicAdaptPct > 0) {
    const adaptFactor = 1 - metabolicAdaptPct / 100;
    targets.kcal = Math.round(targets.kcal * adaptFactor);
    targets.protein = Math.round(targets.protein * adaptFactor);
    targets.fats = Math.round(targets.fats * adaptFactor);
    targets.carbs = Math.round(targets.carbs * adaptFactor);
  }
  // Safety: never negative macros
  targets.protein = Math.max(0, targets.protein);
  targets.fats = Math.max(0, targets.fats);
  targets.carbs = Math.max(0, targets.carbs);
  targets.kcal = Math.max(0, targets.kcal);

  // Ж2 (Роунд-2, Aug 28): женский гейт сушки — дефицит ≤22% ккал (муж ≤25%):
  // RED-S/гормональный контур женщин чувствительнее к агрессивному дефициту
  // (Helms 2022, Iraki 2019). Цели ниже TDEE×0.78 у женщин поднимаются до 0.78.
  if (sex === 'female' && (engineGoal === 'cut')) {
    const tdeeRef = targets.tdee || 0;
    if (tdeeRef > 0 && targets.kcal > 0 && targets.kcal < tdeeRef * 0.78) {
      targets.kcal = Math.round(tdeeRef * 0.78);
      // Углеводы пересчитываются из остатка (белок/жир защищены)
      targets.carbs = Math.max(0, Math.round((targets.kcal - targets.protein * 4 - targets.fats * 9) / 4));
    }
  }

  // 10. Manual г/кг (overrides macros, recompute kcal)
  if (manualGPerKg.protein > 0) targets.protein = Math.round(weight * manualGPerKg.protein);
  if (manualGPerKg.fat > 0) targets.fats = Math.round(weight * manualGPerKg.fat);
  if (manualGPerKg.carbs > 0) targets.carbs = Math.round(weight * manualGPerKg.carbs);
  if (manualGPerKg.protein > 0 || manualGPerKg.fat > 0 || manualGPerKg.carbs > 0) {
    targets.kcal = targets.protein * 4 + targets.fats * 9 + targets.carbs * 4;
  }

  return targets as PlannerTargets;
}