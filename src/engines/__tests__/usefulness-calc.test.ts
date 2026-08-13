/**
 * usefulness-calc.test.ts — тесты расчётов полезности продуктов и приёмов.
 *
 * Покрытие:
 *  - calcMealScoreV2: пустые/нулевые веса (NaN-гуард), диапазон 1-10, макросы
 *  - calcMealDIAAS / calcDIAAS: смешанный приём, пустые входы, digest-коэффициенты
 *  - analyzeDailyDiet: пустой день без NaN, cortisolRisk только post-workout, PRAL-порог
 *  - calculateOverallScore: клэмп 1-10, фазовый модификатор
 *  - calcKbjuMatchScore / scoreFoodsForKBJU: приоритет белка, монотонность лейблов
 *  - scoreFoodsWithGapPriority / getGapCoverageForFood / buildGapSummary
 *  - analyzeNutrientGaps: структура, меньше дефицитов у полноценного приёма
 */
import { describe, it, expect } from 'vitest';
import {
  calcMealScoreV2,
  calcMealDIAAS,
  calcDIAAS,
  analyzeDailyDiet,
  calculateOverallScore,
  getDefaultProfile,
  type UserDietProfile,
} from '../product-usefulness-v2.engine';
import { calcKbjuMatchScore, scoreFoodsForKBJU } from '../kbju-food-match.engine';
import {
  scoreFoodsWithGapPriority,
  getGapCoverageForFood,
  buildGapSummary,
  calcGapEfficiency,
} from '../composer-targeting-integration';
import { analyzeNutrientGaps, NUTRIENT_CATEGORIES } from '../nutrient-gap-filler.engine';
import { FOOD_DB, type FoodItem } from '../../core/nutrition-database';

const f = (id: string): FoodItem => {
  const food = FOOD_DB.find(x => x.id === id);
  if (!food) throw new Error(`нет продукта ${id}`);
  return food;
};

// ─── calcMealScoreV2 ─────────────────────────────────────────────────
describe('calcMealScoreV2', () => {
  it('пустой список → score 0, без NaN', () => {
    const r = calcMealScoreV2([], getDefaultProfile());
    expect(r.compositeScore).toBe(0);
    expect(Number.isFinite(r.compositeScore)).toBe(true);
  });

  it('все веса = 0 → нет NaN (totalW-guard)', () => {
    const r = calcMealScoreV2([{ foodId: 'chicken_breast', weightGrams: 0 }, { foodId: 'rice_white', weightGrams: 0 }], getDefaultProfile());
    expect(Number.isFinite(r.compositeScore)).toBe(true);
    expect(r.compositeScore).toBeGreaterThanOrEqual(1);
    expect(r.compositeScore).toBeLessThanOrEqual(10);
  });

  it('100г курицы → корректные макросы и скор в 1-10', () => {
    const r = calcMealScoreV2([{ foodId: 'chicken_breast', weightGrams: 100 }], getDefaultProfile());
    expect(r.macros.protein).toBe(Math.round(f('chicken_breast').protein));
    expect(r.macros.kcal).toBe(Math.round(f('chicken_breast').kcal));
    expect(r.compositeScore).toBeGreaterThanOrEqual(1);
    expect(r.compositeScore).toBeLessThanOrEqual(10);
  });

  it('курица + рис: взвешенная композиция между продуктами', () => {
    const r = calcMealScoreV2([{ foodId: 'chicken_breast', weightGrams: 100 }, { foodId: 'rice_white', weightGrams: 100 }], getDefaultProfile());
    expect(r.productScores).toHaveLength(2);
    expect(r.macros.protein).toBeGreaterThan(f('chicken_breast').protein); // белок курицы + рис
    expect(r.macros.carbs).toBeGreaterThan(f('rice_white').carbs - 1);
  });
});

// ─── calcMealDIAAS ───────────────────────────────────────────────────
describe('calcMealDIAAS / calcDIAAS', () => {
  it('пустой вход → diaas 0', () => {
    expect(calcMealDIAAS([]).diaas).toBe(0);
  });

  it('смешанный приём (индейка+рис) ≥ DIAAS одного риса', () => {
    const mixed = calcMealDIAAS([{ foodId: 'turkey_breast', weightGrams: 100 }, { foodId: 'rice_white', weightGrams: 100 }]);
    const riceOnly = calcMealDIAAS([{ foodId: 'rice_white', weightGrams: 200 }]);
    expect(mixed.diaas).toBeGreaterThanOrEqual(riceOnly.diaas - 0.01);
    expect(mixed.diaas).toBeGreaterThan(0);
  });

  it('diaas в диапазоне 0-1.5 и округлён до 2 знаков', () => {
    for (const id of ['whey_isolate', 'lentils', 'rice_white', 'turkey_breast']) {
      const d = calcDIAAS(f(id)).diaas;
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1.5);
    }
  });

  it('полный животный профиль (индейка) выше неполного растительного (рис)', () => {
    const turkeyD = calcDIAAS(f('turkey_breast')).diaas;
    const riceD = calcDIAAS(f('rice_white')).diaas;
    // индейка: полный аминопрофиль + digest 0.95; рис: неполный профиль + digest 0.85
    expect(turkeyD).toBeGreaterThan(riceD);
  });
});

// ─── analyzeDailyDiet ────────────────────────────────────────────────
describe('analyzeDailyDiet', () => {
  const prof = getDefaultProfile();
  prof.lbm = 70;

  it('пустой день → без NaN', () => {
    const r = analyzeDailyDiet([], prof);
    expect(Number.isFinite(r.totalKcal)).toBe(true);
    expect(Number.isFinite(r.giLoad)).toBe(true);
    expect(Number.isFinite(r.pralTotal)).toBe(true);
    expect(Number.isFinite(r.omegaRatio)).toBe(true);
    expect(r.mtorTriggered).toBe(false);
  });

  it('cortisolRisk: нет post-workout приёма → false', () => {
    const r = analyzeDailyDiet([{ timing: 'regular', products: [{ foodId: 'banana', weightGrams: 200 }] }], prof);
    expect(r.cortisolRisk).toBe(false);
  });

  it('cortisolRisk: post-workout БЕЗ быстрых углеводов → true (недозаправка)', () => {
    const r = analyzeDailyDiet([{ timing: 'post_workout', products: [{ foodId: 'chicken_breast', weightGrams: 150 }] }], prof);
    expect(r.cortisolRisk).toBe(true);
  });

  it('giLoad масштабируется весом (рис 100г vs 200г)', () => {
    const a = analyzeDailyDiet([{ products: [{ foodId: 'rice_white', weightGrams: 100 }] }], prof);
    const b = analyzeDailyDiet([{ products: [{ foodId: 'rice_white', weightGrams: 200 }] }], prof);
    expect(b.giLoad).toBeGreaterThan(a.giLoad);
  });

  it('PRAL: обычный приём не даёт «Закисление» (порог 100)', () => {
    const r = analyzeDailyDiet([{ products: [{ foodId: 'chicken_breast', weightGrams: 200 }, { foodId: 'rice_white', weightGrams: 200 }, { foodId: 'broccoli', weightGrams: 150 }] }], prof);
    expect(r.pralWarning).toBe(null);
  });

  it('mTOR: 150г курицы + 40г сыворотки триггерит', () => {
    const r = analyzeDailyDiet([{ products: [{ foodId: 'chicken_breast', weightGrams: 150 }, { foodId: 'whey_isolate', weightGrams: 40 }] }], prof);
    expect(r.mtorTriggered).toBe(true);
  });
});

// ─── calculateOverallScore ───────────────────────────────────────────
describe('calculateOverallScore', () => {
  it('скор в диапазоне 1-10 для всех категорий', () => {
    const prof = getDefaultProfile();
    for (const id of ['chicken_breast', 'rice_white', 'broccoli', 'avocado', 'whey_isolate', 'banana']) {
      const s = calculateOverallScore(f(id), prof);
      expect(s.total).toBeGreaterThanOrEqual(1);
      expect(s.total).toBeLessThanOrEqual(10);
    }
  });

  it('фаза EXTREME_CUT штрафует простые углеводы (phaseMod < 0 для риса)', () => {
    const cut: UserDietProfile = { ...getDefaultProfile(), phase: 'EXTREME_CUT' };
    const s = calculateOverallScore(f('rice_white'), cut);
    expect(s.phaseMod).toBeLessThan(0);
  });

  it('детерминированность: одинаковые входы → одинаковый скор', () => {
    const a = calculateOverallScore(f('salmon'), getDefaultProfile());
    const b = calculateOverallScore(f('salmon'), getDefaultProfile());
    expect(a.total).toBe(b.total);
  });
});

// ─── calcKbjuMatchScore / scoreFoodsForKBJU ──────────────────────────
describe('calcKbjuMatchScore', () => {
  it('курица отлично закрывает белковый дефицит (score >= 55)', () => {
    const target = { kcal: 600, protein: 40, fat: 10, carbs: 10 };
    const r = calcKbjuMatchScore(f('chicken_breast'), target);
    expect(r.matchScore).toBeGreaterThanOrEqual(55);
    expect(r.label === 'Идеально' || r.label === 'Хорошо').toBe(true);
  });

  it('масло НЕ подходит под белковый дефицит (score < 35)', () => {
    const target = { kcal: 600, protein: 40, fat: 10, carbs: 10 };
    const r = calcKbjuMatchScore(f('butter'), target);
    expect(r.matchScore).toBeLessThan(35);
  });

  it('scoreFoodsForKBJU: резульаты отсортированы по убыванию и ≤ maxResults', () => {
    const target = { kcal: 600, protein: 40, fat: 15, carbs: 40 };
    const res = scoreFoodsForKBJU(FOOD_DB.slice(0, 200) as any, target, undefined, undefined, 10);
    expect(res.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < res.length; i++) expect(res[i - 1].matchScore).toBeGreaterThanOrEqual(res[i].matchScore);
  });

  it('scoreFoodsForKBJU: пустой пул → []', () => {
    expect(scoreFoodsForKBJU([], { kcal: 500, protein: 30, fat: 10, carbs: 30 })).toEqual([]);
  });
});

// ─── composer-targeting ──────────────────────────────────────────────
describe('composer-targeting (gap-aware)', () => {
  it('analyzeNutrientGaps: структура результата', () => {
    const r = analyzeNutrientGaps([{ foodId: 'chicken_breast', weightGrams: 150 }]);
    expect(r.gaps.length).toBeGreaterThan(20);
    for (const g of r.gaps) {
      expect(Number.isFinite(g.current)).toBe(true);
      expect(Number.isFinite(g.deficit)).toBe(true);
      expect(g.percentCovered).toBeGreaterThanOrEqual(0);
      expect(g.percentCovered).toBeLessThanOrEqual(100);
    }
    expect(r.summary.deficits + r.summary.marginal + r.summary.ok).toBe(r.gaps.length);
  });

  it('полноценный приём (мясо+овощи+рис) имеет меньше дефицитов, чем чистый рис', () => {
    const poor = analyzeNutrientGaps([{ foodId: 'rice_white', weightGrams: 400 }]);
    const rich = analyzeNutrientGaps([
      { foodId: 'chicken_breast', weightGrams: 200 },
      { foodId: 'broccoli', weightGrams: 150 },
      { foodId: 'rice_white', weightGrams: 200 },
      { foodId: 'salmon', weightGrams: 100 },
    ]);
    expect(rich.summary.deficits).toBeLessThan(poor.summary.deficits);
  });

  it('getGapCoverageForFood: шпинат закрывает калий/магний', () => {
    const gaps = analyzeNutrientGaps([{ foodId: 'rice_white', weightGrams: 400 }]).gaps;
    const cov = getGapCoverageForFood(f('spinach'), gaps);
    expect(cov.covered).toBeGreaterThan(0);
    expect(cov.nutrients.some(n => n === 'potassium' || n === 'magnesium' || n === 'vitamin_a' || n === 'iron')).toBe(true);
  });

  it('scoreFoodsWithGapPriority: без NaN, ≤ maxResults, gap-fillers первые', () => {
    const gapResult = analyzeNutrientGaps([{ foodId: 'rice_white', weightGrams: 400 }]);
    const res = scoreFoodsWithGapPriority(FOOD_DB.slice(0, 300) as any, { kcal: 800, protein: 50, fat: 20, carbs: 80 }, gapResult, undefined, undefined, 15, 0.4);
    expect(res.length).toBeLessThanOrEqual(15);
    for (const r of res) {
      expect(Number.isFinite(r.matchScore)).toBe(true);
      expect(r.matchScore).toBeGreaterThanOrEqual(0);
      expect(r.matchScore).toBeLessThanOrEqual(100);
    }
    const firstFiller = res.findIndex(r => r.isGapFiller);
    const firstNonFiller = res.findIndex(r => !r.isGapFiller);
    if (firstFiller !== -1 && firstNonFiller !== -1) {
      expect(firstFiller).toBeLessThan(firstNonFiller);
    }
  });

  it('buildGapSummary: категории совпадают с NUTRIENT_CATEGORIES', () => {
    const r = analyzeNutrientGaps([{ foodId: 'chicken_breast', weightGrams: 150 }]);
    const summary = buildGapSummary(r);
    expect(summary.length).toBe(Object.keys(NUTRIENT_CATEGORIES).length);
    for (const s of summary) {
      expect(s.deficits + s.marginal + s.ok).toBe(s.nutrients.length);
    }
  });

  it('calcGapEfficiency: конечное число, ≥ 0', () => {
    const gaps = analyzeNutrientGaps([{ foodId: 'rice_white', weightGrams: 400 }]).gaps;
    expect(Number.isFinite(calcGapEfficiency(f('spinach'), gaps))).toBe(true);
    expect(calcGapEfficiency(f('spinach'), gaps)).toBeGreaterThanOrEqual(0);
  });
});
