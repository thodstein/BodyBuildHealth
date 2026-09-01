/**
 * Peaking Engine — BB peak week generator.
 *
 * BB Peaking:
 *  - Carb loading protocol
 *  - Water manipulation
 *  - Sodium timing
 *  - Pump sessions
 *  - Posing schedule
 *
 * Фаза 5.30: удалена deprecated PL-часть (generatePLPeaking / PLPeakingInput /
 * PLPeakWeek / PLPeakingOutput) — она была не подключена ни к одному UI
 * (канон ПЛ-тапера/пика: lms-taper.engine + lms-macro-taper.engine + pro/taper.engine).
 * Также удалены мёртвые обёртки peakForPLMeet/peakForBBShow из training-integration.
 *
 * @module peaking-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface BBPeakingInput {
  showDate: string;
  conditioning: number; // 0-1
  fullness: number;     // 0-1
  dryness: number;      // 0-1
  carbTolerance: number; // 0-1
}

export interface BBPeakingOutput {
  weekPlan: {
    day: number;
    training: string;
    carbs: string;
    water: string;
    sodium: string;
    posing: string;
  }[];
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// BB Peaking Engine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @deprecated — BB-часть peaking-engine переведена на canonical engine
 * `bb-contest-prep.engine.ts` (buildBBContestPrep / buildPeakWeek /
 * computePeakWeekNutritionTargets). generateBBPeaking оставлен только для
 * обратной совместимости (TaperPlannerTab переведён на canonical через
 * `bbPeakingCompatFromContestPrep` в bb-contest-prep.engine.ts).
 * Новые UI-точки входа ЗАПРЕЩЕНЫ.
 */
export function generateBBPeaking(input: BBPeakingInput): BBPeakingOutput {
  const week: BBPeakingOutput['weekPlan'] = [];

  const days = [
    { training: 'Верх (pump)', carbs: '200g', water: '6L', sodium: '3g', posing: '15 мин' },
    { training: 'Низ (pump)', carbs: '250g', water: '6L', sodium: '3g', posing: '15 мин' },
    { training: 'Верх (лёгкий)', carbs: '300g', water: '6L', sodium: '3g', posing: '20 мин' },
    { training: 'Полный покой', carbs: '350g', water: '5L', sodium: '2g', posing: '20 мин' },
    { training: 'Верх (pump — последний)', carbs: '400g', water: '3L', sodium: '1g', posing: '30 мин' },
    { training: 'Покой', carbs: '300g', water: '1L', sodium: '0.5g', posing: '30 мин' },
    { training: 'ДЕНЬ ШОУ', carbs: '200g', water: 'SIP', sodium: '0.5g', posing: 'Утро' },
  ];

  if (input.conditioning < 0.5) {
    days[3].carbs = '250g'; // less conditioning = less carb tolerance
  }
  if (input.fullness < 0.5) {
    days[4].carbs = '500g'; // less fullness = more carb load
  }
  if (input.dryness > 0.7) {
    days[5].water = '0.5L'; // already dry = less water cut
  }

  for (let i = 0; i < 7; i++) {
    week.push({
      day: i + 1,
      ...days[i],
    });
  }

  const recommendations: string[] = [
    `Шоу: ${input.showDate}. Протокол 7 дней (деплеция → загрузка → пик → шоу).`,
    'Карб-загрузка: по переносимости (conditioning/fullness); воду и натрий модулировать только при confirmedManipulation.',
    'Памп-рутина backstage: резинки/отжимания 15-20 повт × 2 круга, без отказа.',
    'Стабильные вода/натрий по умолчанию (канон: bb-contest-prep.engine).',
  ];

  return { weekPlan: week, recommendations };
}
