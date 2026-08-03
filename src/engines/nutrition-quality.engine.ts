import { FOOD_DB } from '../core/nutrition-database';
import { getMicro } from '../core/nutrition-micros';

interface MealItem { name: string; kcal: number; p: number; f: number; c: number; category?: string; id?: string; amount?: number; qty?: number }

export interface QualityScore {
  total: number;
  breakdown: {
    microDensity: number;  // 0-30
    macroBalance: number;  // 0-20
    fiber: number;         // 0-15
    fatQuality: number;    // 0-15
    wholeFoods: number;    // 0-20
  };
  microDeficiencies: { nutrient: string; current: number; target: number; unit: string }[];
  glycemicLoad: number;
}

const MICRO_TARGETS: Record<string, { target: number; unit: string; label: string }> = {
  Fe: { target: 18, unit: 'мг', label: 'Железо' },
  Mg: { target: 400, unit: 'мг', label: 'Магний' },
  Zn: { target: 15, unit: 'мг', label: 'Цинк' },
  Ca: { target: 1000, unit: 'мг', label: 'Кальций' },
  VitC: { target: 90, unit: 'мг', label: 'Витамин C' },
  VitD: { target: 15, unit: 'мкг', label: 'Витамин D' },
  VitB12: { target: 2.4, unit: 'мкг', label: 'B12' },
  K: { target: 3500, unit: 'мг', label: 'Калий' },
};

export function calcMealQuality(items: MealItem[]): QualityScore {
  // Aggregate macro totals
  let totalKcal = 0, totalP = 0, totalF = 0, totalC = 0, totalFiber = 0;
  let totalSatFat = 0, totalOmega3 = 0;
  let wholeFoodKcal = 0, processedKcal = 0;
  const microTotals: Record<string, number> = {};

  for (const item of items) {
    totalKcal += item.kcal;
    totalP += item.p;
    totalF += item.f;
    totalC += item.c;

    // Bug 1: match by id first (accurate), fallback to name (diary items may lack id).
    const food = (item.id ? FOOD_DB.find(f => f.id === item.id) : undefined)
      || FOOD_DB.find(f => (f.name||'').toLowerCase() === (item.name||'').toLowerCase());
    if (food) {
      // Bug 3: scale by portion (amount ?? qty ?? 100).
      const _rawAmt = item.amount ?? item.qty ?? 100;
      const _amtNum = typeof _rawAmt === 'string' ? (parseFloat(_rawAmt) || 100) : (_rawAmt as number);
      const factor = _amtNum / 100;
      totalFiber += (food.fiber || 0) * factor;
      if (food.micros) {
        for (const [key, val] of Object.entries(food.micros)) {
          if (typeof val === 'number') microTotals[key] = (microTotals[key] || 0) + val * factor;
        }
      }
      // Bug 6: only fast_food is 'processed'; sports supplements (whey/casein/creatine) are NOT junk.
      if (food.category === 'fast_food') {
        processedKcal += item.kcal;
      } else {
        wholeFoodKcal += item.kcal;
      }
      // Bug 2: real saturated fat (not Cholesterol); omega-3 from getMicro.
      totalSatFat += getMicro(food, 'SatFat');
      totalOmega3 += getMicro(food, 'Omega3');
    }
  }

  // Breakdown scoring
  const microDensity = Math.min(30, Math.round((Object.keys(microTotals).length / Object.keys(MICRO_TARGETS).length) * 30));

  const pPct = totalKcal > 0 ? (totalP * 4 / totalKcal) * 100 : 0;
  const fPct = totalKcal > 0 ? (totalF * 9 / totalKcal) * 100 : 0;
  const cPct = totalKcal > 0 ? (totalC * 4 / totalKcal) * 100 : 0;
  let macroBalance = 20;
  if (pPct < 15 || pPct > 35) macroBalance -= 5;
  if (fPct < 15 || fPct > 40) macroBalance -= 5;
  if (cPct < 30 || cPct > 60) macroBalance -= 5;
  macroBalance = Math.max(0, macroBalance);

  const fiber = Math.min(15, Math.round((totalFiber / 30) * 15));
  const fatQuality = totalOmega3 > 1 ? 15 : totalOmega3 > 0.5 ? 10 : Math.min(15, Math.round((1 - totalSatFat / Math.max(1, totalF)) * 15));
  const wholeFoodPct = totalKcal > 0 ? wholeFoodKcal / totalKcal : 0.5;
  const wholeFoods = Math.min(20, Math.round(wholeFoodPct * 20));

  // Micro deficiencies
  const microDeficiencies: QualityScore['microDeficiencies'] = [];
  for (const [key, tgt] of Object.entries(MICRO_TARGETS)) {
    const current = microTotals[key] || 0;
    if (current < tgt.target * 0.7) {
      microDeficiencies.push({ nutrient: tgt.label, current: Math.round(current), target: tgt.target, unit: tgt.unit });
    }
  }

  // Glycemic load estimate
  const glycemicLoad = totalC > 100 ? Math.round(totalC * 0.15) : Math.round(totalC * 0.12);

  const total = microDensity + macroBalance + fiber + fatQuality + wholeFoods;

  // P2-fix: removed saveNutritionV2Data side effect — calcMealQuality is a pure
  // scoring function and should not write to localStorage. Callers that want to
  // persist the quality score should do so explicitly. This was causing test
  // runs to mutate shared localStorage state and made the function non-idempotent.
  return { total, breakdown: { microDensity, macroBalance, fiber, fatQuality, wholeFoods }, microDeficiencies, glycemicLoad };
}

export function getQualityLabel(score: number): { label: string; color: string; emoji: string } {
  if (score >= 85) return { label: 'Отлично', color: '#22c55e', emoji: '🌟' };
  if (score >= 70) return { label: 'Хорошо', color: '#00e68a', emoji: '👍' };
  if (score >= 55) return { label: 'Средне', color: '#f59e0b', emoji: '📊' };
  if (score >= 40) return { label: 'Ниже среднего', color: '#f97316', emoji: '⚠️' };
  return { label: 'Плохо', color: '#ef4444', emoji: '🔴' };
}
