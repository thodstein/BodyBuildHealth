/**
 * bb-peak-week.engine.ts — peak week протокол для BB-соревнований.
 *
 * Профессиональный инструмент: 7-дневный протокол подготовки к сцене.
 * - Вода: load (8-10л) → cut (0.5л за 2 дня до сцены)
 * - Натрий: load (5-7г/день) → cut (0.5г/день за 1-2 дня)
 * - Углеводы: depletion (3 дня, <50г/день) → reload (2 дня, 300-500г/день)
 * - Позирование: расписание (утро/вечер, 15-30 мин)
 * - Тренировка: только лёгкая памп (без compounds), последний день — отдых
 *
 * Источники: Helms MAAS (peak week protocols), Alberts Nippardt (carb cycling),
 * competitive BB coaching practice 2020-2024.
 */

export type PeakDayPhase = 'load' | 'depletion' | 'reload' | 'peak' | 'show';

export interface PeakWeekDay {
  day: number;          // 1-7 (day 7 = show day)
  phase: PeakDayPhase;
  waterLiters: number;  // литры воды в день
  sodiumGrams: number;  // граммы натрия в день
  carbGrams: number;    // граммы углеводов в день
  trainingMinutes: number; // минуты тренировки (0 = отдых)
  trainingType: string;    // тип тренировки
  poseMinutes: number;     // минуты позирования
  notes: string;
}

export interface PeakWeekProtocol {
  days: PeakWeekDay[];
  totalWaterCut: number;  // литры срезания воды (load - show)
  totalCarbReload: number; // граммы углеводов в reload фазе
  showDay: number;        // день соревнований (7)
  rationale: string[];
  warnings: string[];
}

/**
 * Построить 7-дневный peak week протокол.
 * @param bodyWeightKg — вес тела (для расчёта воды/углеводов)
 * @param category — категория (bikini/figure/wellness/mens_physique/classic/bb_212/open)
 * @param sex — пол (женщины → меньше углеводов, больше вода)
 */
export function buildPeakWeekProtocol(
  bodyWeightKg: number = 80,
  category: string = 'mens_physique',
  sex: 'male' | 'female' = 'male',
): PeakWeekProtocol {
  const isFemale = sex === 'female';
  const isLightCategory = ['bikini', 'wellness'].includes(category);

  // Base values scaled by body weight
  const baseWater = Math.round((bodyWeightKg * 0.12) * 10) / 10; // ~0.12 L/kg
  const loadWater = Math.max(6, Math.min(12, baseWater));
  const peakWater = 0.5;
  const showWater = 0.25;

  // Sodium: load 5-7g → cut to 0.5g
  const loadSodium = isLightCategory ? 4 : 6;
  const cutSodium = 0.5;

  // Carbs: depletion <50g → reload based on weight
  const depletionCarbs = 30;
  const reloadCarbs = Math.round(bodyWeightKg * (isFemale ? 4 : 5)); // 4-5 g/kg
  const peakCarbs = Math.round(bodyWeightKg * (isFemale ? 3 : 4));
  const showCarbs = Math.round(bodyWeightKg * 2);

  // Training: depletion days = light pump, reload = minimal, peak/show = rest
  const days: PeakWeekDay[] = [
    {
      day: 1,
      phase: 'load',
      waterLiters: loadWater,
      sodiumGrams: loadSodium,
      carbGrams: depletionCarbs,
      trainingMinutes: 45,
      trainingType: 'Памп-тренировка (верх): лёгкие веса, 15-20 повт, без failure',
      poseMinutes: 20,
      notes: 'Начало water load. Углеводное истощение — <50г carbs. Много воды, нормальный натрий.',
    },
    {
      day: 2,
      phase: 'depletion',
      waterLiters: loadWater,
      sodiumGrams: loadSodium,
      carbGrams: depletionCarbs,
      trainingMinutes: 45,
      trainingType: 'Памп-тренировка (низ): лёгкие веса, 15-20 повт, без failure',
      poseMinutes: 25,
      notes: 'Продолжение depletion. Гликоген истощается. Возможно чувство слабости — это нормально.',
    },
    {
      day: 3,
      phase: 'depletion',
      waterLiters: loadWater - 1,
      sodiumGrams: loadSodium,
      carbGrams: depletionCarbs,
      trainingMinutes: 30,
      trainingType: 'Лёгкий памп (полное тело): 20 мин, только изоляция',
      poseMinutes: 30,
      notes: 'Последний день depletion. Снижаем воду на 1л. Завтра — начало carb reload.',
    },
    {
      day: 4,
      phase: 'reload',
      waterLiters: loadWater - 3,
      sodiumGrams: loadSodium - 1,
      carbGrams: reloadCarbs,
      trainingMinutes: 0,
      trainingType: 'Отдых. Без тренировки — гликоген наполняется.',
      poseMinutes: 20,
      notes: 'Carb reload день 1. Вода снижена на 3л от пика. Натрий слегка снижен. Углеводы высокие.',
    },
    {
      day: 5,
      phase: 'reload',
      waterLiters: loadWater - 5,
      sodiumGrams: cutSodium,
      carbGrams: reloadCarbs,
      trainingMinutes: 0,
      trainingType: 'Отдых. Без тренировки.',
      poseMinutes: 25,
      notes: 'Carb reload день 2. Вода резко снижена. Натрий минимален. Мышцы наполняются гликогеном.',
    },
    {
      day: 6,
      phase: 'peak',
      waterLiters: peakWater,
      sodiumGrams: cutSodium,
      carbGrams: peakCarbs,
      trainingMinutes: 0,
      trainingType: 'Отдых. Только лёгкая растяжка и позирование.',
      poseMinutes: 40,
      notes: 'Peak day. Минимум воды. Мышцы полные, кожа тонкая. Проверка поз.',
    },
    {
      day: 7,
      phase: 'show',
      waterLiters: showWater,
      sodiumGrams: cutSodium,
      carbGrams: showCarbs,
      trainingMinutes: 0,
      trainingType: 'Соревновательный день. Только позирование.',
      poseMinutes: 60,
      notes: 'Show day! Минимум воды (только глотки при жажде). Углеводы для энергии. Позирование на сцене.',
    },
  ];

  const totalWaterCut = loadWater - showWater;
  const totalCarbReload = reloadCarbs * 2;

  const rationale: string[] = [
    `📋 Peak week протокол (7 дней): ${category} ${sex}`,
    `💧 Вода: ${loadWater}л (load) → ${peakWater}л (peak) → ${showWater}л (show). Срезание: ${totalWaterCut.toFixed(1)}л`,
    `🧂 Натрий: ${loadSodium}г (load) → ${cutSodium}г (cut). Срезание за 3 дня до сцены.`,
    `🍚 Углеводы: depletion ${depletionCarbs}г/день (3 дня) → reload ${reloadCarbs}г/день (2 дня) → peak ${peakCarbs}г → show ${showCarbs}г`,
    `🏋️ Тренировки: дни 1-3 лёгкий памп (30-45 мин), дни 4-7 отдых. Compounds исключены.`,
    `🎭 Позирование: 20-60 мин/день, нарастающее к show day.`,
  ];

  const warnings: string[] = [
    '⚠ Peak week — экстремальная манипуляция. Только под наблюдением тренера/врача.',
    '⚠ Контроль электролитов (K+, Mg2+) — риск судорог при срезании воды.',
    '⚠ Не применять при проблемах с почками, сердцем, давлением.',
    '⚠ Carb depletion вызывает слабость, головокружение — не водить машину в дни 1-3.',
  ];
  if (isFemale) {
    warnings.push('⚠ Женщины: меньше углеводов в reload (риск отёков). Больше внимания позированию.');
  }

  return {
    days,
    totalWaterCut,
    totalCarbReload,
    showDay: 7,
    rationale,
    warnings,
  };
}

/**
 * Применить peak week к BB-плану: заменить выбранную неделю на peak week protocol
 * (по умолчанию — последнюю). Тренировки в peak week = только лёгкий памп.
 * @param weekNumber — 1-индекс недели для применения (по умолчанию последняя).
 */
export function applyPeakWeekToPlan(
  plan: any,
  protocol: PeakWeekProtocol,
  weekNumber?: number,
): any {
  if (!plan || !plan.weeks || plan.weeks.length < 1) return plan;
  const idx = weekNumber == null
    ? plan.weeks.length - 1
    : Math.max(0, Math.min(plan.weeks.length - 1, weekNumber - 1));
  const lastWeekIdx = idx;
  const lastWeek = plan.weeks[lastWeekIdx];
  // Заменяем фазу последней недели на 'peaking'
  const newWeek = {
    ...lastWeek,
    phase: 'peaking' as const,
    deload: true,
    taper: true,
    sessions: lastWeek.sessions.map((s: any, si: number) => {
      const day = protocol.days[Math.min(si, protocol.days.length - 1)];
      // Снижаем объём: 2 сета на упражнение (floor=2, не 1), RIR 3-4, вес 50%
      // C2: ранее floor=1 — 1 сет недостаточен для стимула (fix A7 в taper использует floor=2).
      return {
        ...s,
        exercises: s.exercises.map((e: any) => ({
          ...e,
          sets: Math.max(2, Math.round(e.sets * 0.3)),
          rir: 4,
          workSets: (e.workSets || []).slice(0, 2).map((ws: any) => ({
            ...ws,
            weight: Math.round((ws.weight || 0) * 0.5),
            rir: 4,
          })),
          comment: `${e.comment || ''} [Peak week: ${day.trainingType}]`,
        })),
      };
    }),
  };
  const newWeeks = [...plan.weeks];
  newWeeks[lastWeekIdx] = newWeek;
  return {
    ...plan,
    weeks: newWeeks,
    rationale: [...(plan.rationale || []), ...protocol.rationale, ...protocol.warnings],
  };
}
