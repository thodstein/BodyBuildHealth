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
  difficulty: 'hard' | 'medium' | 'light' | 'off';
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

export function computeOrthopedicConstraints(input: OrthopedicInput): OrthopedicConstraints {
  const blocked = new Set<string>();
  const romLimits: Record<string, { min: number; max: number }> = {};
  const recommendations: string[] = [];

  // Block patterns based on injuries
  for (const injury of input.injuryHistory) {
    const key = injury.toLowerCase().replace(/\s+/g, '_');
    const patterns = INJURY_PATTERN_BLACKLIST[key] || INJURY_PATTERN_BLACKLIST[injury.replace(/_.*/, '')];
    if (patterns) {
      patterns.forEach(p => blocked.add(p));
      recommendations.push(`Травма ${injury}: исключены ${patterns.join(', ')}`);
    }

    const limits = ROM_LIMITS_BY_INJURY[key];
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
      const patterns = INJURY_PATTERN_BLACKLIST[pain.toLowerCase()];
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
    const severity = input.jointLimitations[joint] || 'none';
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
  const plan: DailyLoad[] = [];
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

  // Apply capacity modifiers
  const volModifier = input.volumeCapacity;
  const intModifier = input.intensityCapacity;

  // Risk modifier
  const riskModifier = input.riskLevel === 'high' ? 0.6 : input.riskLevel === 'medium' ? 0.8 : 1.0;

  // PRI modifier
  const priModifier = input.priScore < 0.3 ? 0.7 : input.priScore > 0.7 ? 1.1 : 1.0;

  let totalVolume = 0;
  let totalIntensity = 0;
  let hardDays = 0;

  for (let d = 0; d < ndays; d++) {
    const tmpl = templates[pattern[d % pattern.length]];
    const volTarget = Math.round(tmpl.volume * volModifier * riskModifier * priModifier * 100);
    const intTarget = Math.round(tmpl.intensity * intModifier * riskModifier * priModifier * 100) / 100;
    const difficulty = tmpl.volume >= 0.9 ? 'hard' : tmpl.volume >= 0.6 ? 'medium' : 'light';

    totalVolume += volTarget;
    totalIntensity += intTarget;
    if (difficulty === 'hard') hardDays++;

    plan.push({
      day: d + 1,
      volumeTarget: volTarget,
      intensityTarget: Math.min(0.95, intTarget),
      densityTarget: tmpl.density,
      focus: difficulty === 'hard' ? 'Основной день' : difficulty === 'medium' ? 'Средний день' : 'Лёгкий день',
      difficulty,
    });
  }

  // Add off days
  for (let d = ndays; d < 7; d++) {
    plan.push({
      day: d + 1,
      volumeTarget: 0,
      intensityTarget: 0,
      densityTarget: 0,
      focus: 'Отдых',
      difficulty: 'off',
    });
  }

  if (hardDays >= 4) warnings.push('4+ тяжёлых дня — риск перетренированности');
  if (input.riskLevel === 'high' && hardDays > 1) warnings.push('Высокий риск — ограничьте до 1 тяжёлого дня');

  return {
    weekPlan: plan,
    totalVolume: Math.round(totalVolume),
    avgIntensity: ndays > 0 ? Math.round((totalIntensity / ndays) * 100) : 0,
    hardDays,
    warnings,
  };
}
