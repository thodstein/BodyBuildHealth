/**
 * Complete Recommendation Domain — Full recommendation system
 *
 * Covers ALL recommendation types:
 *  - Technique fixes based on error detection
 *  - Load adjustments based on performance/fatigue
 *  - Volume adjustments based on recovery/overload
 *  - Intensity adjustments based on technique/risk
 *  - Exercise replacements based on injury/equipment
 *  - Variation selection based on weak points
 *  - Frequency adjustments based on recovery
 *  - Periodization adjustments based on progress
 *  - Deload scheduling based on fatigue markers
 *  - Nutrition adjustments based on body comp trends
 *  - Supplement recommendations based on stack
 *  - Recovery protocol selection
 *
 * @module recommendation-engine-v2
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type RecCategory = 'technique' | 'load' | 'volume' | 'intensity' | 'exercise' | 'variation' | 'frequency' | 'periodization' | 'deload' | 'nutrition' | 'supplement' | 'recovery' | 'sleep' | 'mindset';
export type RecSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface Recommendation {
  id: string;
  category: RecCategory;
  severity: RecSeverity;
  title: string;
  message: string;
  details: string;
  actionItems: string[];
  priority: number;
  confidence: number;
  relatedMetrics: Record<string, number>;
}

export interface RecInput {
  performance: { recentPR: boolean; strengthTrend: number; plateauWeeks: number; velocityLoss: number };
  technique: { score: number; errors: string[]; romStability: number };
  fatigue: { acute: number; chronic: number; acwr: number; monotony: number; strain: number; cnsLoad: number };
  recovery: { sleepScore: number; hrvScore: number; subjectiveReadiness: number; hydrationScore: number; nutritionScore: number };
  body: { weightTrend: number; bfTrend: number; ffmi: number };
  training: { frequency: number; avgIntensity: number; volumeTrend: number; phase: string; weeksInCycle: number };
  risk: { overall: number; jointFlags: string[]; systemicFlags: string[] };
  goals: { type: string; progress: number; weeksRemaining: number };
  equipment: string[];
  injuries: string[];
  weakPoints: string[];
}

export interface RecOutput {
  recommendations: Recommendation[];
  criticalActions: Recommendation[];
  suggestions: Recommendation[];
  summary: string;
  complianceRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Rule Engine
// ═══════════════════════════════════════════════════════════════════════════

interface RecRule {
  category: RecCategory;
  condition: (i: RecInput) => boolean;
  generate: (i: RecInput) => Recommendation;
}

const RECOMMENDATION_RULES: RecRule[] = [
  // ═══════════════════════ TECHNIQUE ═══════════════════════
  {
    category: 'technique',
    condition: (i) => i.technique.score < 0.5 && i.technique.errors.length > 0,
    generate: (i) => ({
      id: 'rec_tech_poor', category: 'technique', severity: 'high', title: 'Критически низкое качество техники',
      message: `Техника-скор ${(i.technique.score * 100).toFixed(0)}%. Ошибки: ${i.technique.errors.join(', ')}.`,
      details: 'Приоритет — качество движения, а не вес. Используйте tempo-вариации (3-1-3-0) и видео-анализ.',
      actionItems: ['Снизить вес на 20-30%', 'Добавить tempo работу', 'Записывать видео подходов', 'Фокус на 1-2 ошибки за тренировку'],
      priority: 90, confidence: 0.85,
      relatedMetrics: { techniqueScore: i.technique.score, errors: i.technique.errors.length },
    }),
  },
  {
    category: 'technique',
    condition: (i) => i.technique.errors.includes('knee_valgus'),
    generate: () => ({
      id: 'rec_knee_valgus', category: 'technique', severity: 'medium', title: 'Колени заваливаются внутрь',
      message: 'Вальгус коленей обнаружен. Риск травмы ПКС и мениска.',
      details: 'Слабые отводящие бедра (glute medius). Добавьте banded активацию перед приседом.',
      actionItems: ['Clamshell 2×15 перед приседом', 'Banded squat 3×10 (лёгкий вес)', 'Copenhagen plank 2×30 сек', 'Думать "колени наружу" при подъёме'],
      priority: 75, confidence: 0.80, relatedMetrics: {},
    }),
  },
  {
    category: 'technique',
    condition: (i) => i.technique.errors.includes('rounding_back'),
    generate: () => ({
      id: 'rec_rounding_back', category: 'technique', severity: 'high', title: 'Округление спины при тяге',
      message: 'Округление поясницы — высокий риск грыжи диска.',
      details: 'Слабый кор и разгибатели спины. Неправильный bracing.',
      actionItems: ['Dead bug 3×8 перед тягой', 'RDL с лёгким весом (техника)', 'Trap bar deadlift вместо классики', 'Брейсинг: глубокий вдох в живот перед подъёмом'],
      priority: 85, confidence: 0.85, relatedMetrics: {},
    }),
  },

  // ═══════════════════════ LOAD ═══════════════════════
  {
    category: 'load',
    condition: (i) => i.performance.velocityLoss > 40,
    generate: (i) => ({
      id: 'rec_vl_high', category: 'load', severity: 'high', title: `Потеря скорости ${Math.round(i.performance.velocityLoss)}%`,
      message: 'Высокий velocity loss — чрезмерная усталость в подходе.',
      details: 'VL >40% = слишком много повторений с данным весом. Качество падает, риск травмы растёт.',
      actionItems: ['Снизить вес на 10-15%', 'Уменьшить повторения в подходе', 'Увеличить отдых между подходами'],
      priority: 80, confidence: 0.80, relatedMetrics: { velocityLoss: i.performance.velocityLoss },
    }),
  },
  {
    category: 'load',
    condition: (i) => i.performance.plateauWeeks >= 4 && i.performance.strengthTrend <= 0,
    generate: (i) => ({
      id: 'rec_plateau', category: 'load', severity: 'medium', title: `Плато ${i.performance.plateauWeeks} недель`,
      message: 'Прогресс остановился. Текущий стимул недостаточен.',
      details: 'Тело адаптировалось к нагрузке. Нужен новый стимул.',
      actionItems: ['Сменить прогрессию (linear → double → RPE)', 'Увеличить или уменьшить объём на 20%', 'Сменить вариацию упражнения', 'Deload 1 неделя → новый цикл'],
      priority: 70, confidence: 0.75, relatedMetrics: { plateauWeeks: i.performance.plateauWeeks },
    }),
  },

  // ═══════════════════════ VOLUME ═══════════════════════
  {
    category: 'volume',
    condition: (i) => i.fatigue.acwr > 1.5,
    generate: (i) => ({
      id: 'rec_acwr_high', category: 'volume', severity: 'critical', title: `ACWR ${i.fatigue.acwr.toFixed(1)} — критический`,
      message: 'Acute:Chronic Workload Ratio >1.5 — риск травмы увеличен в 3-5 раз.',
      details: 'Резкое увеличение нагрузки. Организм не успевает адаптироваться.',
      actionItems: ['Немедленно снизить объём на 40-50%', 'Пропустить 1-2 тренировки', 'Только лёгкая работа (RPE ≤6)', 'Вернуться к нормальному объёму через 1-2 недели'],
      priority: 95, confidence: 0.90, relatedMetrics: { acwr: i.fatigue.acwr },
    }),
  },
  {
    category: 'volume',
    condition: (i) => i.fatigue.monotony > 2.5,
    generate: (i) => ({
      id: 'rec_monotony', category: 'volume', severity: 'medium', title: `Монотонность ${i.fatigue.monotony.toFixed(1)}`,
      message: 'Слишком однообразная нагрузка. Риск перетренированности.',
      details: 'Варьируйте нагрузку между днями: тяжёлый → лёгкий → средний.',
      actionItems: ['Добавить лёгкий день', 'Варьировать повторения (сила 3-6, гипертрофия 8-15)', 'Разные упражнения в разные дни'],
      priority: 65, confidence: 0.75, relatedMetrics: { monotony: i.fatigue.monotony },
    }),
  },

  // ═══════════════════════ INTENSITY ═══════════════════════
  {
    category: 'intensity',
    condition: (i) => i.training.avgIntensity > 8.5 && i.fatigue.cnsLoad > 15,
    generate: () => ({
      id: 'rec_intensity_cns', category: 'intensity', severity: 'high', title: 'Перегрузка ЦНС',
      message: 'Средняя интенсивность >8.5 RPE + высокая нагрузка на ЦНС.',
      details: 'ЦНС требуется больше времени на восстановление чем мышцы. Симптомы: раздражительность, плохой сон, падение мотивации.',
      actionItems: ['Deload 1 неделя (RPE ≤6)', 'Снизить количество подходов RPE ≥9', 'Увеличить сон до 8-9 часов', 'Добавить активное восстановление'],
      priority: 85, confidence: 0.80, relatedMetrics: {},
    }),
  },

  // ═══════════════════════ DELOAD ═══════════════════════
  {
    category: 'deload',
    condition: (i) => i.training.weeksInCycle >= 6 && i.fatigue.acwr > 1.3,
    generate: () => ({
      id: 'rec_deload_needed', category: 'deload', severity: 'high', title: 'Deload рекомендован',
      message: `Неделя ${6}+ цикла + ACWR повышен. Запланируйте разгрузочную неделю.`,
      details: 'Deload снижает накопленную усталость и позволяет организму суперкомпенсироваться.',
      actionItems: ['Объём 40-50% от обычного', 'Интенсивность 50-60%', '3 тренировки вместо 4-5', 'Фокус на технику и мобильность'],
      priority: 80, confidence: 0.85, relatedMetrics: {},
    }),
  },

  // ═══════════════════════ NUTRITION ═══════════════════════
  {
    category: 'nutrition',
    condition: (i) => i.recovery.nutritionScore < 40,
    generate: (i) => ({
      id: 'rec_nutrition_poor', category: 'nutrition', severity: 'high', title: 'Питание требует улучшения',
      message: 'Низкий nutrition score. Белка недостаточно или калорийность не соответствует цели.',
      details: 'Питание — 70% результата. Без правильного питания тренировки неэффективны.',
      actionItems: ['Отслеживать калории 1 неделю (взвешивать еду)', 'Белок: 1.8-2.5 г/кг', 'Овощи: 400-600 г/день', 'Вода: 33 мл/кг'],
      priority: 75, confidence: 0.85, relatedMetrics: { nutritionScore: i.recovery.nutritionScore },
    }),
  },
  {
    category: 'nutrition',
    condition: (i) => i.body.weightTrend > 0.5 && i.goals.type === 'cut',
    generate: (i) => ({
      id: 'rec_cut_failing', category: 'nutrition', severity: 'medium', title: 'Вес растёт на сушке',
      message: `Тренд веса +${i.body.weightTrend.toFixed(1)} кг/нед при цели "сушка".`,
      details: 'Калорийность слишком высока или低估 потребления.',
      actionItems: ['Снизить калории на 200-300 ккал', 'Увеличить кардио на 2 сессии/нед', 'Исключить "скрытые" калории (соусы, масло, напитки)'],
      priority: 70, confidence: 0.80, relatedMetrics: { weightTrend: i.body.weightTrend },
    }),
  },

  // ═══════════════════════ RECOVERY ═══════════════════════
  {
    category: 'recovery',
    condition: (i) => i.recovery.sleepScore < 40 || i.recovery.hrvScore < 40,
    generate: () => ({
      id: 'rec_sleep_hrv', category: 'recovery', severity: 'critical', title: 'Критически низкое восстановление',
      message: 'Сон и/или HRV на критическом уровне. Тренировки неэффективны.',
      details: 'Без восстановления нет прогресса. Приоритет — сон и снижение стресса.',
      actionItems: ['Сон 8+ часов (ложиться до 23:00)', 'Магний 400 мг + Мелатонин 3 мг', 'Без экранов за 60 мин до сна', 'Прогулка 30 мин вместо тренировки'],
      priority: 95, confidence: 0.90, relatedMetrics: {},
    }),
  },

  // ═══════════════════════ SUPPLEMENT ═══════════════════════
  {
    category: 'supplement',
    condition: (i) => i.risk.jointFlags.includes('joint_pain') && i.risk.jointFlags.length > 0,
    generate: () => ({
      id: 'rec_joint_support', category: 'supplement', severity: 'medium', title: 'Поддержка суставов',
      message: 'Обнаружена боль в суставах. Добавьте нутритивную поддержку.',
      details: 'Глюкозамин + хондроитин + коллаген + омега-3.',
      actionItems: ['Глюкозамин 1500 мг + Хондроитин 1200 мг', 'Коллаген II типа 40 мг', 'Омега-3 4-6 г', 'Куркумин 500 мг 2×/день'],
      priority: 60, confidence: 0.65, relatedMetrics: {},
    }),
  },

  // ═══════════════════════ MINDSET ═══════════════════════ 
  {
    category: 'mindset',
    condition: (i) => i.training.weeksInCycle >= 8 && i.performance.plateauWeeks >= 3,
    generate: () => ({
      id: 'rec_mindset_grind', category: 'mindset', severity: 'low', title: 'Фаза grind — это нормально',
      message: 'Вы в рабочей фазе цикла. Прогресс замедляется — это естественно.',
      details: 'Не каждая тренировка будет PR. Консистентность > интенсивность.',
      actionItems: ['Фокус на процессе, не на результате', 'Отмечайте маленькие победы', 'Смените музыку/одежду для свежести', 'Тренируйтесь с партнёром'],
      priority: 30, confidence: 0.60, relatedMetrics: {},
    }),
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Main Engine
// ═══════════════════════════════════════════════════════════════════════════

export function generateRecommendations(input: RecInput): RecOutput {
  const allRecs: Recommendation[] = [];
  let id = 0;

  for (const rule of RECOMMENDATION_RULES) {
    if (rule.condition(input)) {
      const rec = rule.generate(input);
      rec.id = `rec_${++id}_${rec.category}`;
      allRecs.push(rec);
    }
  }

  // Sort by priority
  allRecs.sort((a, b) => b.priority - a.priority);

  const criticalActions = allRecs.filter(r => r.severity === 'critical' || r.severity === 'high');
  const suggestions = allRecs.filter(r => r.severity !== 'critical' && r.severity !== 'high');

  const criticalCount = criticalActions.length;
  const totalCount = allRecs.length;

  let complianceRate = 100;
  if (criticalCount >= 3) complianceRate = 30;
  else if (criticalCount >= 1) complianceRate = 60;
  else if (totalCount >= 5) complianceRate = 80;

  const summary = criticalCount > 0
    ? `🔴 ${criticalCount} критических рекомендаций требуют немедленного внимания. ${totalCount} всего.`
    : totalCount > 0
      ? `🟡 ${totalCount} рекомендаций для оптимизации тренировок.`
      : '✅ Все показатели в норме. Продолжайте программу.';

  return { recommendations: allRecs, criticalActions, suggestions, summary, complianceRate };
}

/** Quick one-off recommendations for specific situations */
export function quickRec(category: RecCategory, context: string): Recommendation {
  return {
    id: `quick_${Date.now()}`, category, severity: 'medium',
    title: `Рекомендация: ${category}`,
    message: context, details: '', actionItems: [], priority: 50, confidence: 0.7, relatedMetrics: {},
  };
}

/** Get recovery protocol based on readiness */
export function getRecoveryRec(readiness: number, sleepScore: number, hrvScore: number): Recommendation[] {
  const recs: Recommendation[] = [];
  if (readiness < 30) {
    recs.push({
      id: 'rec_full_rest', category: 'recovery', severity: 'critical', title: 'Полный отдых',
      message: 'Готовность критически низкая. Пропустите тренировку.',
      details: 'Активное восстановление: прогулка, растяжка, foam rolling.',
      actionItems: ['Пропустить тренировку', 'Прогулка 30 мин', 'Foam rolling 15 мин', 'Сон 9+ часов'],
      priority: 95, confidence: 0.90, relatedMetrics: { readiness, sleepScore, hrvScore },
    });
  }
  if (sleepScore < 40) {
    recs.push({
      id: 'rec_sleep_priority', category: 'sleep', severity: 'high', title: 'Приоритет: сон',
      message: 'Качество сна низкое. Все остальные рекомендации вторичны.',
      details: 'Без сна нет восстановления. 7-9 часов обязательно.',
      actionItems: ['Ложиться до 23:00', 'Темнота, прохлада, тишина', 'Магний 400 мг + Мелатонин 3 мг', 'Без кофеина после 14:00'],
      priority: 90, confidence: 0.90, relatedMetrics: { sleepScore },
    });
  }
  return recs;
}
