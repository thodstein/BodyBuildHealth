/**
 * Peaking Engine — Powerlifting + Bodybuilding peak week generators.
 *
 * PL Peaking:
 *  - SQ/BP/DL taper
 *  - Heavy singles @ RPE 8-9
 *  - Meet-week plan
 *  - Velocity-based adjustments
 *
 * BB Peaking:
 *  - Carb loading protocol
 *  - Water manipulation
 *  - Sodium timing
 *  - Pump sessions
 *  - Posing schedule
 *
 * @module peaking-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PLPeakingInput {
  meetDate: string; // ISO date
  current1RM: { squat: number; bench: number; deadlift: number };
  fatigue: number;
  pri: number;
  velocityProfile?: { squat: number; bench: number; deadlift: number };
}

export interface PLPeakWeek {
  weekLabel: string;
  daysUntilMeet: number;
  sessions: {
    dayName: string;
    focus: string;
    exercises: {
      name: string;
      sets: number;
      reps: number;
      percent: number;
      rpe: number;
      notes: string;
    }[];
  }[];
}

export interface PLPeakingOutput {
  plan: PLPeakWeek[];
  taperWeeks: number;
  lastHeavySquat: string;
  lastHeavyBench: string;
  lastHeavyDeadlift: string;
  meetDayInstructions: string[];
}

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
// PL Peaking Engine
// ═══════════════════════════════════════════════════════════════════════════

export function generatePLPeaking(input: PLPeakingInput): PLPeakingOutput {
  const plan: PLPeakWeek[] = [];

  // Week 4: Last heavy week
  plan.push({
    weekLabel: 'За 4 недели (последняя тяжёлая)',
    daysUntilMeet: 28,
    sessions: [
      {
        dayName: 'Пн — Squat',
        focus: 'squat',
        exercises: [
          { name: 'Squat', sets: 3, reps: 3, percent: 0.85, rpe: 8, notes: 'Рабочие подходы' },
          { name: 'Squat', sets: 1, reps: 1, percent: 0.90, rpe: 8.5, notes: 'Тяжёлый сингл' },
          { name: 'Pause Squat', sets: 3, reps: 5, percent: 0.70, rpe: 7, notes: 'Аксессуар' },
        ],
      },
      {
        dayName: 'Ср — Bench',
        focus: 'bench',
        exercises: [
          { name: 'Bench Press', sets: 3, reps: 3, percent: 0.85, rpe: 8, notes: 'Рабочие подходы' },
          { name: 'Bench Press', sets: 1, reps: 1, percent: 0.90, rpe: 8.5, notes: 'Тяжёлый сингл' },
          { name: 'Close-Grip Bench', sets: 3, reps: 6, percent: 0.70, rpe: 7, notes: 'Трицепс' },
        ],
      },
      {
        dayName: 'Пт — Deadlift',
        focus: 'deadlift',
        exercises: [
          { name: 'Deadlift', sets: 3, reps: 2, percent: 0.85, rpe: 8.5, notes: 'Рабочие подходы' },
          { name: 'Deadlift', sets: 1, reps: 1, percent: 0.90, rpe: 9, notes: 'Тяжёлый сингл' },
        ],
      },
    ],
  });

  // Week 3
  plan.push({
    weekLabel: 'За 3 недели',
    daysUntilMeet: 21,
    sessions: [
      {
        dayName: 'Пн — Squat',
        focus: 'squat',
        exercises: [
          { name: 'Squat', sets: 2, reps: 2, percent: 0.88, rpe: 8.5, notes: 'Последние тяжёлые двойки' },
          { name: 'Squat', sets: 1, reps: 1, percent: 0.92, rpe: 9, notes: 'Тяжёлый сингл — оценка формы' },
        ],
      },
      {
        dayName: 'Ср — Bench',
        focus: 'bench',
        exercises: [
          { name: 'Bench Press', sets: 2, reps: 2, percent: 0.88, rpe: 8.5, notes: 'Последние тяжёлые двойки' },
          { name: 'Bench Press', sets: 1, reps: 1, percent: 0.92, rpe: 9, notes: 'Тяжёлый сингл' },
        ],
      },
      {
        dayName: 'Пт — Deadlift',
        focus: 'deadlift',
        exercises: [
          { name: 'Deadlift', sets: 1, reps: 1, percent: 0.92, rpe: 9, notes: 'Последний тяжёлый сингл DL' },
          { name: 'Block Pull', sets: 3, reps: 3, percent: 0.75, rpe: 7, notes: 'Аксессуар' },
        ],
      },
    ],
  });

  // Week 2
  plan.push({
    weekLabel: 'За 2 недели (начало снижения)',
    daysUntilMeet: 14,
    sessions: [
      {
        dayName: 'Пн — Squat',
        focus: 'squat',
        exercises: [
          { name: 'Squat', sets: 1, reps: 1, percent: 0.90, rpe: 8.5, notes: 'Открывающий вес' },
          { name: 'Squat', sets: 2, reps: 3, percent: 0.75, rpe: 7, notes: 'Лёгкая работа' },
        ],
      },
      {
        dayName: 'Ср — Bench',
        focus: 'bench',
        exercises: [
          { name: 'Bench Press', sets: 1, reps: 1, percent: 0.90, rpe: 8.5, notes: 'Открывающий вес' },
          { name: 'Bench Press', sets: 2, reps: 3, percent: 0.75, rpe: 7, notes: 'Лёгкая работа' },
        ],
      },
    ],
  });

  // Week 1 (meet week)
  plan.push({
    weekLabel: 'Соревновательная неделя',
    daysUntilMeet: 7,
    sessions: [
      {
        dayName: 'Пн (за 6 дней) — Squat открывашка',
        focus: 'squat',
        exercises: [
          { name: 'Squat', sets: 1, reps: 1, percent: 0.85, rpe: 7.5, notes: 'Открывающий вес ×1 — уверенно' },
          { name: 'Bench Press', sets: 1, reps: 3, percent: 0.70, rpe: 6, notes: 'Лёгкий жим' },
        ],
      },
      {
        dayName: 'Ср (за 4 дня) — Последняя лёгкая',
        focus: 'fullbody',
        exercises: [
          { name: 'Squat', sets: 1, reps: 3, percent: 0.60, rpe: 5, notes: 'Движение без напряжения' },
          { name: 'Bench Press', sets: 1, reps: 3, percent: 0.60, rpe: 5, notes: 'Лёгкая активация' },
        ],
      },
    ],
  });

  return {
    plan,
    taperWeeks: 2,
    lastHeavySquat: 'За 3 недели (92%)',
    lastHeavyBench: 'За 3 недели (92%)',
    lastHeavyDeadlift: 'За 3 недели (92%)',
    meetDayInstructions: [
      'Разминка: пустой гриф ×10, 40%×5, 60%×3, 75%×1, 85%×1 (последний разминочный)',
      'Отдых между попытками: 5-8 минут',
      '1-я попытка: 90% — уверенный подъём',
      '2-я попытка: 95% — целевой результат',
      '3-я попытка: 97-100% — PR при хорошем самочувствии',
      'Питание: углеводы 6-8 г/кг за день до, лёгкий завтрак в день старта',
      'Гидратация: 500 мл воды + электролиты за 2 часа до',
    ],
  };
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

  return {
    weekPlan: week,
    recommendations: [
      'Натрий: 3g → 1g → 0.5g (ступенчатое снижение)',
      'Вода: 6L → 3L → SIP (последние 24 часа)',
      'Углеводы: front-load (дни 1-4) → back-load (дни 5-6)',
      'Памп-тренировки: circuit style, 3-4 упражнения × 3 круга, 15-20 повторений',
      'Позирование: минимум 20 минут в день, утро шоу — 45 минут',
      'Последний приём пищи за 3 часа до выхода на сцену',
      'Рисовые хлебцы + мёд за 30 минут до выхода для пампа',
    ],
  };
}
