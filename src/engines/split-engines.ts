/**
 * Split Engines — Full Body, Upper/Lower, PPL, Powerbuilding, Strongman,
 *                Weightlifting, CrossFit, Rehab
 *
 * Each split engine returns a week structure with day focus, exercise slots,
 * and pattern assignments.
 *
 * Combined module — all 8 split engines in one file.
 *
 * @module split-engines
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type SplitGoal = 'strength' | 'hypertrophy' | 'conditioning' | 'technique' | 'rehab' | 'powerbuilding' | 'weightlifting' | 'crossfit' | 'strongman';

export type SessionFocus = 'squat' | 'bench' | 'deadlift' | 'upper' | 'lower' | 'fullbody' | 'push' | 'pull' | 'legs' | 'overhead' | 'event' | 'metcon' | 'rehab' | 'technique' | 'snatch' | 'clean_jerk';

export type PatternSlot = 'squat' | 'hinge' | 'horizontal_push' | 'horizontal_pull' | 'vertical_push' | 'vertical_pull' | 'lunge' | 'carry' | 'rotation' | 'accessory';

export interface DaySlot {
  pattern: PatternSlot;
  role: 'main' | 'secondary' | 'accessory' | 'rehab';
  priority: number; // 1 = first, higher = later
}

export interface SessionTemplate {
  dayIndex: number;
  focus: SessionFocus;
  priority: 'strength' | 'hypertrophy' | 'technique' | 'conditioning' | 'rehab';
  slots: DaySlot[];
}

export interface SplitInput {
  daysPerWeek: number;
  goal: SplitGoal;
  primaryLift?: string;
  weakPoints: string[];
  targetMuscle?: string;
  injuryType?: 'knee' | 'shoulder' | 'lower_back' | 'hip' | 'ankle';
  equipmentAvailable: string[];
}

export interface SplitOutput {
  name: string;
  description: string;
  sessions: SessionTemplate[];
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Full Body Workout (FBW)
// ═══════════════════════════════════════════════════════════════════════════

export function generateFBWSplit(input: SplitInput): SplitOutput {
  const recs: string[] = ['FBW — каждая тренировка включает всё тело'];
  const sessions: SessionTemplate[] = [];

  const variants: { focus: SessionFocus; squatPattern: PatternSlot; hingePattern: PatternSlot }[] = [
    { focus: 'squat', squatPattern: 'squat', hingePattern: 'hinge' },
    { focus: 'deadlift', squatPattern: 'lunge', hingePattern: 'hinge' },
    { focus: 'bench', squatPattern: 'squat', hingePattern: 'hinge' },
  ];

  for (let d = 0; d < Math.min(input.daysPerWeek, 3); d++) {
    const v = variants[d];
    const slots: DaySlot[] = [
      { pattern: v.squatPattern, role: 'main', priority: 1 },
      { pattern: 'horizontal_push', role: 'main', priority: 2 },
      { pattern: v.hingePattern, role: 'secondary', priority: 3 },
      { pattern: 'horizontal_pull', role: 'secondary', priority: 4 },
      { pattern: 'vertical_push', role: 'accessory', priority: 5 },
      { pattern: 'vertical_pull', role: 'accessory', priority: 6 },
      { pattern: 'accessory', role: 'accessory', priority: 7 },
    ];
    sessions.push({
      dayIndex: d + 1,
      focus: v.focus,
      priority: input.goal === 'hypertrophy' ? 'hypertrophy' : 'strength',
      slots,
    });
  }

  return {
    name: 'Full Body Workout (FBW)',
    description: '3 тренировки в неделю, каждая задействует всё тело. Фокус дня: squat → deadlift → bench.',
    sessions,
    recommendations: recs,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Upper/Lower Split
// ═══════════════════════════════════════════════════════════════════════════

export function generateUpperLowerSplit(input: SplitInput): SplitOutput {
  const sessions: SessionTemplate[] = [];
  const ndays = Math.min(input.daysPerWeek, 4);

  // Day 1: Upper (strength focus)
  sessions.push({
    dayIndex: 1,
    focus: 'upper',
    priority: 'strength',
    slots: [
      { pattern: 'horizontal_push', role: 'main', priority: 1 },
      { pattern: 'horizontal_pull', role: 'main', priority: 2 },
      { pattern: 'vertical_push', role: 'secondary', priority: 3 },
      { pattern: 'vertical_pull', role: 'secondary', priority: 4 },
      { pattern: 'accessory', role: 'accessory', priority: 5 },
      { pattern: 'accessory', role: 'accessory', priority: 6 },
    ],
  });

  // Day 2: Lower
  sessions.push({
    dayIndex: 2,
    focus: 'lower',
    priority: 'strength',
    slots: [
      { pattern: 'squat', role: 'main', priority: 1 },
      { pattern: 'hinge', role: 'main', priority: 2 },
      { pattern: 'lunge', role: 'secondary', priority: 3 },
      { pattern: 'accessory', role: 'accessory', priority: 4 },
      { pattern: 'accessory', role: 'accessory', priority: 5 },
    ],
  });

  if (ndays >= 3) {
    sessions.push({
      dayIndex: 3,
      focus: 'upper',
      priority: 'hypertrophy',
      slots: [
        { pattern: 'horizontal_push', role: 'secondary', priority: 1 },
        { pattern: 'horizontal_pull', role: 'secondary', priority: 2 },
        { pattern: 'vertical_push', role: 'accessory', priority: 3 },
        { pattern: 'vertical_pull', role: 'accessory', priority: 4 },
        { pattern: 'accessory', role: 'accessory', priority: 5 },
        { pattern: 'accessory', role: 'accessory', priority: 6 },
      ],
    });
  }

  if (ndays >= 4) {
    sessions.push({
      dayIndex: 4,
      focus: 'lower',
      priority: 'hypertrophy',
      slots: [
        { pattern: 'squat', role: 'secondary', priority: 1 },
        { pattern: 'hinge', role: 'secondary', priority: 2 },
        { pattern: 'lunge', role: 'accessory', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
        { pattern: 'accessory', role: 'accessory', priority: 5 },
      ],
    });
  }

  return {
    name: 'Upper/Lower Split',
    description: 'Чередование верха и низа. 4 дня/нед: Upper → Lower → Upper (hyper) → Lower (hyper).',
    sessions,
    recommendations: ['Чередуйте strength и hypertrophy дни для оптимального прогресса.'],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Push / Pull / Legs (PPL)
// ═══════════════════════════════════════════════════════════════════════════

export function generatePPLSplit(input: SplitInput): SplitOutput {
  const sessions: SessionTemplate[] = [];
  const cycles = Math.max(1, Math.floor(input.daysPerWeek / 3));

  for (let c = 0; c < cycles; c++) {
    // Push
    sessions.push({
      dayIndex: sessions.length + 1,
      focus: 'push',
      priority: c === 0 ? 'strength' : 'hypertrophy',
      slots: [
        { pattern: 'horizontal_push', role: 'main', priority: 1 },
        { pattern: 'vertical_push', role: 'secondary', priority: 2 },
        { pattern: 'accessory', role: 'accessory', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
        { pattern: 'accessory', role: 'accessory', priority: 5 },
      ],
    });

    // Pull
    sessions.push({
      dayIndex: sessions.length + 1,
      focus: 'pull',
      priority: c === 0 ? 'strength' : 'hypertrophy',
      slots: [
        { pattern: 'horizontal_pull', role: 'main', priority: 1 },
        { pattern: 'vertical_pull', role: 'secondary', priority: 2 },
        { pattern: 'hinge', role: 'secondary', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
        { pattern: 'accessory', role: 'accessory', priority: 5 },
      ],
    });

    // Legs
    sessions.push({
      dayIndex: sessions.length + 1,
      focus: 'legs',
      priority: c === 0 ? 'strength' : 'hypertrophy',
      slots: [
        { pattern: 'squat', role: 'main', priority: 1 },
        { pattern: 'hinge', role: 'secondary', priority: 2 },
        { pattern: 'lunge', role: 'accessory', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
        { pattern: 'accessory', role: 'accessory', priority: 5 },
      ],
    });
  }

  return {
    name: 'Push/Pull/Legs (PPL)',
    description: `${sessions.length} тренировок/нед. Первый цикл — сила, остальные — гипертрофия.`,
    sessions,
    recommendations: ['6 дней/нед: PPL ×2 для максимальной гипертрофии.', '3 дня/нед: PPL ×1 для базовой силы.'],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Powerbuilding Split
// ═══════════════════════════════════════════════════════════════════════════

export function generatePowerbuildingSplit(input: SplitInput): SplitOutput {
  const sessions: SessionTemplate[] = [
    {
      dayIndex: 1, focus: 'squat', priority: 'strength',
      slots: [
        { pattern: 'squat', role: 'main', priority: 1 },
        { pattern: 'hinge', role: 'main', priority: 2 },
        { pattern: 'lunge', role: 'secondary', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
        { pattern: 'accessory', role: 'accessory', priority: 5 },
        { pattern: 'accessory', role: 'accessory', priority: 6 },
      ],
    },
    {
      dayIndex: 2, focus: 'bench', priority: 'strength',
      slots: [
        { pattern: 'horizontal_push', role: 'main', priority: 1 },
        { pattern: 'horizontal_pull', role: 'main', priority: 2 },
        { pattern: 'vertical_push', role: 'secondary', priority: 3 },
        { pattern: 'vertical_pull', role: 'secondary', priority: 4 },
        { pattern: 'accessory', role: 'accessory', priority: 5 },
        { pattern: 'accessory', role: 'accessory', priority: 6 },
      ],
    },
    {
      dayIndex: 3, focus: 'deadlift', priority: 'strength',
      slots: [
        { pattern: 'hinge', role: 'main', priority: 1 },
        { pattern: 'squat', role: 'secondary', priority: 2 },
        { pattern: 'carry', role: 'secondary', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
        { pattern: 'accessory', role: 'accessory', priority: 5 },
      ],
    },
    {
      dayIndex: 4, focus: 'upper', priority: 'hypertrophy',
      slots: [
        { pattern: 'vertical_push', role: 'secondary', priority: 1 },
        { pattern: 'vertical_pull', role: 'secondary', priority: 2 },
        { pattern: 'horizontal_push', role: 'accessory', priority: 3 },
        { pattern: 'horizontal_pull', role: 'accessory', priority: 4 },
        { pattern: 'accessory', role: 'accessory', priority: 5 },
        { pattern: 'accessory', role: 'accessory', priority: 6 },
      ],
    },
  ];

  return {
    name: 'Powerbuilding Split',
    description: 'Гибрид силы и гипертрофии. 3 силовых дня (Squat/Bench/Deadlift) + 1 гипертрофийный.',
    sessions: sessions.slice(0, Math.min(input.daysPerWeek, 4)),
    recommendations: ['Силовые дни: RPE 7-9, гипертрофийные: RPE 6-8.'],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Strongman Split
// ═══════════════════════════════════════════════════════════════════════════

export function generateStrongmanSplit(input: SplitInput): SplitOutput {
  const sessions: SessionTemplate[] = [
    {
      dayIndex: 1, focus: 'overhead', priority: 'strength',
      slots: [
        { pattern: 'vertical_push', role: 'main', priority: 1 },
        { pattern: 'carry', role: 'main', priority: 2 },
        { pattern: 'accessory', role: 'accessory', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
      ],
    },
    {
      dayIndex: 2, focus: 'deadlift', priority: 'strength',
      slots: [
        { pattern: 'hinge', role: 'main', priority: 1 },
        { pattern: 'carry', role: 'secondary', priority: 2 },
        { pattern: 'squat', role: 'secondary', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
      ],
    },
    {
      dayIndex: 3, focus: 'squat', priority: 'strength',
      slots: [
        { pattern: 'squat', role: 'main', priority: 1 },
        { pattern: 'carry', role: 'secondary', priority: 2 },
        { pattern: 'accessory', role: 'accessory', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
      ],
    },
  ];

  return {
    name: 'Strongman Split',
    description: '3 дня: Overhead + Carries → Deadlift + Events → Squat + Grip.',
    sessions: sessions.slice(0, Math.min(input.daysPerWeek, 3)),
    recommendations: ['При отсутствии strongman-оборудования — barbell вариации.', 'Добавьте grip work в каждый день.'],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Olympic Weightlifting Split
// ═══════════════════════════════════════════════════════════════════════════

export function generateWeightliftingSplit(input: SplitInput): SplitOutput {
  const sessions: SessionTemplate[] = [
    {
      dayIndex: 1, focus: 'snatch', priority: 'technique',
      slots: [
        { pattern: 'vertical_pull', role: 'main', priority: 1 },
        { pattern: 'squat', role: 'secondary', priority: 2 },
        { pattern: 'hinge', role: 'accessory', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
      ],
    },
    {
      dayIndex: 2, focus: 'clean_jerk', priority: 'technique',
      slots: [
        { pattern: 'vertical_pull', role: 'main', priority: 1 },
        { pattern: 'squat', role: 'secondary', priority: 2 },
        { pattern: 'vertical_push', role: 'secondary', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
      ],
    },
    {
      dayIndex: 3, focus: 'squat', priority: 'strength',
      slots: [
        { pattern: 'squat', role: 'main', priority: 1 },
        { pattern: 'hinge', role: 'main', priority: 2 },
        { pattern: 'accessory', role: 'accessory', priority: 3 },
      ],
    },
    {
      dayIndex: 4, focus: 'technique', priority: 'technique',
      slots: [
        { pattern: 'vertical_pull', role: 'main', priority: 1 },
        { pattern: 'vertical_push', role: 'secondary', priority: 2 },
        { pattern: 'accessory', role: 'accessory', priority: 3 },
      ],
    },
  ];

  return {
    name: 'Olympic Weightlifting Split',
    description: 'Snatch → Clean & Jerk → Strength → Technique. 4 дня/нед.',
    sessions: sessions.slice(0, Math.min(input.daysPerWeek, 4)),
    recommendations: ['Технические дни: RPE ≤ 6, focus на качестве движения.', 'Силовой день: Front/Back squat приоритет.'],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. CrossFit Split
// ═══════════════════════════════════════════════════════════════════════════

export function generateCrossFitSplit(input: SplitInput): SplitOutput {
  const sessions: SessionTemplate[] = [
    {
      dayIndex: 1, focus: 'metcon', priority: 'conditioning',
      slots: [
        { pattern: 'hinge', role: 'main', priority: 1 },
        { pattern: 'carry', role: 'secondary', priority: 2 },
        { pattern: 'rotation', role: 'accessory', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
      ],
    },
    {
      dayIndex: 2, focus: 'upper', priority: 'strength',
      slots: [
        { pattern: 'vertical_push', role: 'main', priority: 1 },
        { pattern: 'vertical_pull', role: 'main', priority: 2 },
        { pattern: 'horizontal_push', role: 'secondary', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
      ],
    },
    {
      dayIndex: 3, focus: 'fullbody', priority: 'conditioning',
      slots: [
        { pattern: 'squat', role: 'main', priority: 1 },
        { pattern: 'hinge', role: 'secondary', priority: 2 },
        { pattern: 'carry', role: 'accessory', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
        { pattern: 'accessory', role: 'accessory', priority: 5 },
      ],
    },
    {
      dayIndex: 4, focus: 'fullbody', priority: 'strength',
      slots: [
        { pattern: 'squat', role: 'main', priority: 1 },
        { pattern: 'vertical_push', role: 'secondary', priority: 2 },
        { pattern: 'hinge', role: 'secondary', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
      ],
    },
    {
      dayIndex: 5, focus: 'metcon', priority: 'conditioning',
      slots: [
        { pattern: 'carry', role: 'main', priority: 1 },
        { pattern: 'rotation', role: 'secondary', priority: 2 },
        { pattern: 'accessory', role: 'accessory', priority: 3 },
        { pattern: 'accessory', role: 'accessory', priority: 4 },
      ],
    },
  ];

  return {
    name: 'CrossFit Split',
    description: '5 дней: Metcon → Strength → Fullbody → Strength → Metcon.',
    sessions: sessions.slice(0, Math.min(input.daysPerWeek, 5)),
    recommendations: ['Metcon дни: moderate вес, высокая плотность.', 'Силовые дни: heavy compounds, затем гимнастика.'],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. Rehab Split
// ═══════════════════════════════════════════════════════════════════════════

export function generateRehabSplit(input: SplitInput): SplitOutput {
  const injury = input.injuryType || 'lower_back';
  const sessions: SessionTemplate[] = [];
  const blacklist: Record<string, PatternSlot[]> = {
    knee: ['squat', 'lunge'],
    shoulder: ['vertical_push'],
    lower_back: ['hinge', 'carry'],
    hip: ['squat'],
    ankle: ['lunge'],
  };

  const blocked = blacklist[injury] || [];

  for (let d = 1; d <= Math.max(2, Math.min(input.daysPerWeek, 4)); d++) {
    const slots: DaySlot[] = [];

    // Safe patterns only
    const safePatterns: PatternSlot[] = ['horizontal_push', 'horizontal_pull', 'vertical_pull', 'rotation', 'accessory'];
    if (!blocked.includes('squat') && d <= 2) safePatterns.push('squat');
    if (!blocked.includes('hinge') && d >= 2) safePatterns.push('hinge');

    for (let i = 0; i < safePatterns.length && slots.length < 5; i++) {
      slots.push({
        pattern: safePatterns[i],
        role: i < 2 ? 'secondary' : 'accessory',
        priority: i + 1,
      });
    }

    // Always add rehab slot
    slots.push({ pattern: 'accessory', role: 'rehab', priority: 10 });

    sessions.push({
      dayIndex: d,
      focus: 'rehab',
      priority: 'rehab',
      slots,
    });
  }

  return {
    name: `Rehab Split (${injury})`,
    description: `Восстановительная программа. Травма: ${injury}. Исключены: ${blocked.join(', ') || 'нет'}.`,
    sessions,
    recommendations: [
      'Изометрика + мобилити первые 2 недели.',
      'Постепенное добавление динамики с недели 3.',
      'Боль — откат на предыдущую неделю.',
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Router
// ═══════════════════════════════════════════════════════════════════════════

export function generateSplit(input: SplitInput): SplitOutput {
  switch (input.goal) {
    case 'weightlifting': return generateWeightliftingSplit(input);
    case 'crossfit': return generateCrossFitSplit(input);
    case 'strongman': return generateStrongmanSplit(input);
    case 'powerbuilding': return generatePowerbuildingSplit(input);
    case 'rehab': return generateRehabSplit(input);
    case 'hypertrophy':
      if (input.daysPerWeek >= 5) return generatePPLSplit({ ...input, daysPerWeek: 6 });
      return generateUpperLowerSplit({ ...input, daysPerWeek: 4 });
    case 'conditioning':
      return generateCrossFitSplit(input);
    case 'strength':
    default:
      if (input.daysPerWeek <= 3) return generateFBWSplit(input);
      if (input.daysPerWeek <= 4) return generateUpperLowerSplit(input);
      return generatePPLSplit(input);
  }
}
