/**
 * Orthopedic Pattern + Training Load Distribution Engines
 *
 * Orthopedic Pattern: safe movement patterns given injury/surgery history
 * Load Distribution: weekly volume/intensity/density allocation across days
 * Training Day Balancer: session-internal load balancing
 *
 * @module orthopedic-load-engines
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface OrthopedicInput {
  injuryHistory: string[];
  jointLimitations: Record<string, 'none' | 'mild' | 'moderate' | 'severe'>;
  techniqueIssues: string[];
  currentPain: string[];
}

export interface OrthopedicConstraints {
  allowedPatterns: string[];
  blockedPatterns: string[];
  romLimits: Record<string, { min: number; max: number }>;
  jointStressLimits: Record<string, number>;
  recommendations: string[];
  phase: 'acute' | 'subacute' | 'chronic' | 'maintenance';
}

export interface LoadDistributionInput {
  weeklySessions: number;
  goal: string;
  volumeCapacity: number;
  intensityCapacity: number;
  priScore: number;
  riskLevel: string;
}

export interface DailyLoad {
  day: number;
  volumeTarget: number;
  intensityTarget: number;
  densityTarget: number;
  focus: string;
  difficulty: 'hard' | 'medium' | 'light' | 'off' | 'rehab';
}

export interface LoadDistributionOutput {
  weekPlan: DailyLoad[];
  totalVolume: number;
  avgIntensity: number;
  hardDays: number;
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Orthopedic Pattern Engine
// ═══════════════════════════════════════════════════════════════════════════

const INJURY_PATTERN_BLACKLIST: Record<string, string[]> = {
  knee: ['squat', 'lunge', 'carry'],
  knee_acl: ['squat', 'lunge', 'carry', 'hinge'],
  knee_meniscus: ['squat', 'lunge'],
  hip: ['squat', 'lunge'],
  hip_labrum: ['squat', 'lunge', 'hinge'],
  spine: ['hinge', 'carry'],
  spine_disc: ['hinge', 'carry', 'squat'],
  spine_fracture: ['squat', 'hinge', 'lunge', 'carry', 'vertical_push'],
  shoulder: ['vertical_push', 'horizontal_push'],
  shoulder_rotator: ['vertical_push', 'horizontal_push'],
  shoulder_labrum: ['vertical_push', 'horizontal_push', 'vertical_pull'],
  shoulder_dislocation: ['vertical_push'],
  elbow: ['horizontal_push', 'accessory'],
  ankle: ['lunge', 'carry'],
};

const ROM_LIMITS_BY_INJURY: Record<string, Record<string, { min: number; max: number }>> = {
  knee_acl: {
    knee: { min: 0, max: 60 },
    hip: { min: 0, max: 90 },
  },
  spine_disc: {
    spine: { min: -10, max: 20 },
    hip: { min: 0, max: 80 },
  },
  shoulder_rotator: {
    shoulder: { min: 0, max: 90 },
    elbow: { min: 0, max: 90 },
  },
};

const JOINT_STRESS_LIMIT: Record<string, number> = {
  knee: 3,
  hip: 4,
  spine: 3,
  shoulder: 3,
  elbow: 4,
  ankle: 4,
};

const JOINT_ALIASES: Record<string, string> = {
  lower_back: 'spine', lumbar: 'spine', disc: 'spine',
  rotator: 'shoulder', cuff: 'shoulder',
};

const INJURY_ALIASES: Record<string, string> = {
  lower_back: 'spine_disc', lumbar: 'spine_disc', disc: 'spine_disc',
  rotator: 'shoulder_rotator', cuff: 'shoulder_rotator',
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function computeOrthopedicConstraints(input: OrthopedicInput): OrthopedicConstraints {
  const blocked = new Set<string>();
  const romLimits: Record<string, { min: number; max: number }> = {};
  const recommendations: string[] = [];

  // Block patterns based on injuries
  for (const injury of input.injuryHistory) {
    const key = normalizeKey(injury);
    const injuryKey = INJURY_ALIASES[key] || key;
    const patterns = INJURY_PATTERN_BLACKLIST[injuryKey] || INJURY_PATTERN_BLACKLIST[injuryKey.replace(/_.*/, '')];
    if (patterns) {
      patterns.forEach(p => blocked.add(p));
      recommendations.push(`Травма ${injury}: исключены ${patterns.join(', ')}`);
    }

    const limits = ROM_LIMITS_BY_INJURY[injuryKey];
    if (limits) Object.assign(romLimits, limits);
  }

  // Joint limitations
  for (const [joint, severity] of Object.entries(input.jointLimitations)) {
    if (severity === 'severe') {
      const patterns = INJURY_PATTERN_BLACKLIST[joint];
      if (patterns) patterns.forEach(p => blocked.add(p));
      romLimits[joint] = romLimits[joint] || { min: 0, max: 45 };
    }
    if (severity === 'moderate') {
      romLimits[joint] = romLimits[joint] || { min: 0, max: 70 };
    }
  }

  // Technique issues
  if (input.techniqueIssues.includes('rounding_back') || input.techniqueIssues.includes('butt_wink')) {
    blocked.add('hinge');
    recommendations.push('Техника: округление спины — hinge временно исключён');
  }

  // Pain
  if (input.currentPain.length > 0) {
    for (const pain of input.currentPain) {
      const key = normalizeKey(pain);
      const patterns = INJURY_PATTERN_BLACKLIST[key] || INJURY_PATTERN_BLACKLIST[key.replace(/_.*/, '')];
      if (patterns) patterns.forEach(p => blocked.add(p));
    }
    recommendations.push(`Боль в: ${input.currentPain.join(', ')} — соответствующие паттерны исключены`);
  }

  const allowedPatterns = ['squat', 'hinge', 'horizontal_push', 'horizontal_pull',
    'vertical_push', 'vertical_pull', 'lunge', 'carry', 'rotation', 'anti_rotation', 'accessory',
  ].filter(p => !blocked.has(p));

  if (blocked.size > 2) {
    recommendations.push('Много ограничений — добавьте изометрику и мобилити');
  }

  const stressLimits: Record<string, number> = {};
  for (const [joint, limit] of Object.entries(JOINT_STRESS_LIMIT)) {
    const severity = input.jointLimitations[joint]
      || input.jointLimitations[Object.keys(JOINT_ALIASES).find(alias => JOINT_ALIASES[alias] === joint) || '']
      || 'none';
    stressLimits[joint] = severity === 'severe' ? 1 : severity === 'moderate' ? Math.min(limit, 2) : limit;
  }

  const phase = input.currentPain.length > 0 ? 'acute'
    : blocked.size > 3 ? 'subacute'
    : blocked.size > 1 ? 'chronic'
    : 'maintenance';

  return {
    allowedPatterns,
    blockedPatterns: [...blocked],
    romLimits,
    jointStressLimits: stressLimits,
    recommendations,
    phase,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Training Load Distribution Engine
// ═══════════════════════════════════════════════════════════════════════════

export function distributeWeeklyLoad(input: LoadDistributionInput): LoadDistributionOutput {
  const warnings: string[] = [];
  const ndays = Math.max(2, Math.min(7, input.weeklySessions));

  // Define hard/medium/light day templates
  const templates: Record<string, { volume: number; intensity: number; density: number }> = {
    hard: { volume: 1.0, intensity: 0.85, density: 0.9 },
    medium: { volume: 0.75, intensity: 0.75, density: 0.8 },
    light: { volume: 0.5, intensity: 0.60, density: 0.6 },
    rehab: { volume: 0.3, intensity: 0.45, density: 0.4 },
  };

  // Distribution pattern by goal
  const patterns: Record<string, string[]> = {
    strength: ['hard', 'light', 'hard', 'medium', 'light'],
    hypertrophy: ['medium', 'medium', 'hard', 'medium', 'medium', 'light'],
    conditioning: ['hard', 'hard', 'medium', 'hard', 'medium'],
    technique: ['light', 'light', 'medium', 'light', 'light'],
    rehab: ['rehab', 'rehab', 'light', 'rehab', 'rehab'],
  };

  const pattern = patterns[input.goal] || patterns.hypertrophy;

  // Apply capacity modifiers — синхронизированы с ортопедией (high риск = -40%)
  const volModifier = input.volumeCapacity;
  const intModifier = input.intensityCapacity;
  const riskModifier = input.riskLevel === 'high' ? 0.6 : input.riskLevel === 'medium' ? 0.8 : 1.0;
  const priModifier = input.priScore < 0.3 ? 0.7 : input.priScore > 0.7 ? 1.1 : 1.0;

  // 1. Собираем тренировочные слоты в порядке паттерна (синхрон с движком)
  type Slot = { volume: number; intensity: number; density: number; difficulty: 'hard'|'medium'|'light'|'rehab'; focus: string };
  const slots: Slot[] = [];
  let totalVolume = 0;
  let totalIntensity = 0;
  let hardDays = 0;
  for (let d = 0; d < ndays; d++) {
    const key = pattern[d % pattern.length];
    const tmpl = templates[key] ?? templates.medium;
    const volTarget = Math.round(tmpl.volume * volModifier * riskModifier * priModifier * 100);
    const intTarget = Math.round(tmpl.intensity * intModifier * riskModifier * priModifier * 100) / 100;
    let difficulty: 'hard'|'medium'|'light'|'rehab' = tmpl.volume >= 0.9 ? 'hard' : tmpl.volume >= 0.6 ? 'medium' : (key === 'rehab' ? 'rehab' : 'light');
    // риск high — понижаем hard до medium для безопасности
    if (input.riskLevel === 'high' && difficulty === 'hard') difficulty = 'medium';
    totalVolume += volTarget;
    totalIntensity += intTarget;
    if (difficulty === 'hard') hardDays++;
    slots.push({
      volume: volTarget,
      intensity: Math.min(0.95, intTarget),
      density: tmpl.density,
      difficulty,
      focus: difficulty === 'hard' ? 'Основной день' : difficulty === 'medium' ? 'Средний день' : difficulty === 'rehab' ? 'Реабилитация' : 'Лёгкий день',
    });
  }

  // 2. Равномерное распределение тренировочных дней по 7-дневной неделе (без «дни подряд» блоком)
  // оптимальные позиции — максимизируют интервал между тренировками
  const POSITION_MAP: Record<number, number[]> = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 2, 4, 6],
    5: [0, 1, 3, 4, 6],
    6: [0, 1, 2, 4, 5, 6],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  const positions = POSITION_MAP[ndays] ?? Array.from({ length: ndays }, (_, i) => Math.round((i * 6) / Math.max(1, ndays - 1)));
  const posSet = new Set(positions);

  const weekPlan: DailyLoad[] = [];
  let slotIdx = 0;
  for (let day = 0; day < 7; day++) {
    if (posSet.has(day) && slotIdx < slots.length) {
      const s = slots[slotIdx++];
      weekPlan.push({ day: day + 1, volumeTarget: s.volume, intensityTarget: s.intensity, densityTarget: s.density, focus: s.focus, difficulty: s.difficulty });
    } else {
      weekPlan.push({ day: day + 1, volumeTarget: 0, intensityTarget: 0, densityTarget: 0, focus: 'Отдых', difficulty: 'off' });
    }
  }

  if (hardDays >= 4) warnings.push('4+ тяжёлых дня — риск перетренированности');
  if (input.riskLevel === 'high' && hardDays > 1) warnings.push('Высокий риск — ограничьте до 1 тяжёлого дня');
  // дополнительная проверка на подряд идущие hard (после распределения)
  let consecutiveHard = 0, maxConsec = 0;
  for (const d of weekPlan) {
    if (d.difficulty === 'hard') { consecutiveHard++; maxConsec = Math.max(maxConsec, consecutiveHard); }
    else if (d.difficulty !== 'off') consecutiveHard = 0;
    else consecutiveHard = 0;
  }
  if (maxConsec >= 2 && input.riskLevel !== 'low') warnings.push('Тяжёлые дни подряд — добавьте отдых между ними');

  return {
    weekPlan,
    totalVolume: Math.round(totalVolume),
    avgIntensity: ndays > 0 ? Math.round((totalIntensity / ndays) * 100) : 0,
    hardDays,
    warnings,
  };
}
