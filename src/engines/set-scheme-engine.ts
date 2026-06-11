/**
 * Set Scheme Engine — Generates set schemes based on goal, difficulty, and risk.
 *
 * Supported schemes:
 *  - straight sets (3x8, 4x6, 5x5)
 *  - pyramid (ascending weight)
 *  - reverse pyramid (descending weight)
 *  - top-set + backoff (one heavy set + volume work)
 *  - wave loading (oscillating intensity)
 *  - cluster sets (built-in rest)
 *  - EMOM sets (every minute on the minute)
 *  - density sets (max reps in time cap)
 *
 * @module set-scheme-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type SchemeType = 'straight' | 'pyramid' | 'reverse_pyramid' | 'top_backoff' | 'wave' | 'cluster' | 'emom' | 'density';

export interface SetDefinition {
  setIndex: number;
  reps: number;
  weightPercent: number; // % of 1RM
  restSeconds: number;
  isTopSet: boolean;
  notes: string;
}

export interface SetSchemeOutput {
  schemeType: SchemeType;
  totalSets: number;
  sets: SetDefinition[];
  totalReps: number;
  averageIntensity: number;
  totalDurationMin: number;
}

export interface SetSchemeInput {
  goal: 'strength' | 'hypertrophy' | 'conditioning' | 'technique' | 'rehab' | string;
  difficultyLevel: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
  fatigueLevel: number; // 0-1
  estimated1RM: number;
  baseSets: number;
  baseReps: number;
  baseIntensity: number; // % of 1RM
}

// ═══════════════════════════════════════════════════════════════════════════
// RPE table (RPE → %1RM for given reps)
// ═══════════════════════════════════════════════════════════════════════════

const RPE_TO_PERCENT: Record<number, Record<number, number>> = {
  // reps: { RPE7, RPE8, RPE9, RPE10 }
  1: { 7: 0.89, 8: 0.92, 9: 0.96, 10: 1.00 },
  2: { 7: 0.86, 8: 0.89, 9: 0.92, 10: 0.95 },
  3: { 7: 0.83, 8: 0.86, 9: 0.89, 10: 0.92 },
  4: { 7: 0.81, 8: 0.84, 9: 0.87, 10: 0.90 },
  5: { 7: 0.79, 8: 0.82, 9: 0.85, 10: 0.88 },
  6: { 7: 0.76, 8: 0.79, 9: 0.82, 10: 0.85 },
  8: { 7: 0.72, 8: 0.75, 9: 0.78, 10: 0.82 },
  10: { 7: 0.68, 8: 0.71, 9: 0.75, 10: 0.78 },
  12: { 7: 0.64, 8: 0.67, 9: 0.71, 10: 0.74 },
  15: { 7: 0.60, 8: 0.63, 9: 0.67, 10: 0.70 },
};

function getPercentForReps(reps: number, rpe: number): number {
  const repEntry = RPE_TO_PERCENT[reps] || RPE_TO_PERCENT[10];
  const rpeEntry = repEntry[rpe] || repEntry[7];
  return rpeEntry;
}

// ═══════════════════════════════════════════════════════════════════════════
// Scheme generators
// ═══════════════════════════════════════════════════════════════════════════

function generateStraightSets(input: SetSchemeInput): SetSchemeOutput {
  const sets: SetDefinition[] = [];
  const n = Math.max(3, input.baseSets);
  const reps = input.baseReps;
  const pct = input.baseIntensity;

  for (let i = 0; i < n; i++) {
    sets.push({
      setIndex: i + 1,
      reps,
      weightPercent: pct,
      restSeconds: input.goal === 'strength' ? 180 : input.goal === 'hypertrophy' ? 90 : 60,
      isTopSet: false,
      notes: `Подход ${i + 1}/${n}`,
    });
  }

  return {
    schemeType: 'straight',
    totalSets: n,
    sets,
    totalReps: n * reps,
    averageIntensity: pct,
    totalDurationMin: Math.round((n * (reps * 3 + (input.goal === 'strength' ? 180 : 90))) / 60),
  };
}

function generatePyramid(input: SetSchemeInput): SetSchemeOutput {
  const sets: SetDefinition[] = [];
  const n = Math.max(4, input.baseSets);
  const reps = [12, 10, 8, 6, 8, 10].slice(0, n);
  const pcts = [0.60, 0.68, 0.76, 0.84, 0.76, 0.68].slice(0, n);

  for (let i = 0; i < n; i++) {
    sets.push({
      setIndex: i + 1,
      reps: reps[i],
      weightPercent: pcts[i],
      restSeconds: 120,
      isTopSet: i === Math.floor(n / 2),
      notes: i < n / 2 ? 'Разогрев ↑' : i > n / 2 ? 'Остывание ↓' : 'Пик △',
    });
  }

  return {
    schemeType: 'pyramid',
    totalSets: n,
    sets,
    totalReps: reps.reduce((s, r) => s + r, 0),
    averageIntensity: pcts.reduce((s, p) => s + p, 0) / n,
    totalDurationMin: Math.round((n * 120 + sets.reduce((s, e) => s + e.reps * 3, 0)) / 60),
  };
}

function generateReversePyramid(input: SetSchemeInput): SetSchemeOutput {
  const sets: SetDefinition[] = [];
  const n = Math.max(3, input.baseSets);
  const reps = [6, 8, 10].slice(0, n);
  const pcts = [0.84, 0.78, 0.72].slice(0, n);

  for (let i = 0; i < n; i++) {
    sets.push({
      setIndex: i + 1,
      reps: reps[i],
      weightPercent: pcts[i],
      restSeconds: 120,
      isTopSet: i === 0,
      notes: i === 0 ? 'Топ-сет (самый тяжёлый)' : `Снижение веса -${Math.round((1 - pcts[i] / pcts[0]) * 100)}%`,
    });
  }

  return {
    schemeType: 'reverse_pyramid',
    totalSets: n,
    sets,
    totalReps: reps.reduce((s, r) => s + r, 0),
    averageIntensity: pcts.reduce((s, p) => s + p, 0) / n,
    totalDurationMin: Math.round((n * 120 + sets.reduce((s, e) => s + e.reps * 3, 0)) / 60),
  };
}

function generateTopBackoff(input: SetSchemeInput): SetSchemeOutput {
  const sets: SetDefinition[] = [];
  const topPct = Math.min(0.92, input.baseIntensity + 0.05);

  sets.push({
    setIndex: 1,
    reps: Math.max(1, input.baseReps - 3),
    weightPercent: topPct,
    restSeconds: 180,
    isTopSet: true,
    notes: 'Топ-сет — максимальная нагрузка',
  });

  const backoffSets = Math.max(2, input.baseSets - 1);
  const dropPct = 0.10; // 10% drop per backoff set

  for (let i = 0; i < backoffSets; i++) {
    sets.push({
      setIndex: i + 2,
      reps: input.baseReps + 2,
      weightPercent: topPct * (1 - dropPct * (i + 1)),
      restSeconds: 120,
      isTopSet: false,
      notes: `Бэкофф ${i + 1} — ${Math.round(topPct * (1 - dropPct * (i + 1)) * 100)}%`,
    });
  }

  return {
    schemeType: 'top_backoff',
    totalSets: sets.length,
    sets,
    totalReps: sets.reduce((s, e) => s + e.reps, 0),
    averageIntensity: sets.reduce((s, e) => s + e.weightPercent, 0) / sets.length,
    totalDurationMin: Math.round((sets.length * 150 + sets.reduce((s, e) => s + e.reps * 3, 0)) / 60),
  };
}

function generateWaveLoading(input: SetSchemeInput): SetSchemeOutput {
  const sets: SetDefinition[] = [];
  const waves = Math.max(1, Math.floor(input.baseSets / 3));
  const basePct = input.baseIntensity;

  for (let w = 0; w < waves; w++) {
    const waveShift = w * 0.02; // each wave slightly heavier
    const waveReps = [5, 3, 1];
    const wavePcts = [basePct - 0.05 + waveShift, basePct + waveShift, basePct + 0.04 + waveShift];

    for (let j = 0; j < 3; j++) {
      sets.push({
        setIndex: sets.length + 1,
        reps: waveReps[j],
        weightPercent: Math.min(0.95, wavePcts[j]),
        restSeconds: 150,
        isTopSet: j === 2,
        notes: `Волна ${w + 1}, шаг ${j + 1}`,
      });
    }
  }

  return {
    schemeType: 'wave',
    totalSets: sets.length,
    sets,
    totalReps: sets.reduce((s, e) => s + e.reps, 0),
    averageIntensity: sets.reduce((s, e) => s + e.weightPercent, 0) / sets.length,
    totalDurationMin: Math.round((sets.length * 150 + sets.reduce((s, e) => s + e.reps * 3, 0)) / 60),
  };
}

function generateClusterSets(input: SetSchemeInput): SetSchemeOutput {
  const sets: SetDefinition[] = [];
  const clusters = input.baseSets;
  const repsPerCluster = 5;
  const intraRest = 15; // seconds between reps in cluster

  for (let i = 0; i < clusters; i++) {
    sets.push({
      setIndex: i + 1,
      reps: repsPerCluster,
      weightPercent: Math.min(0.90, input.baseIntensity + 0.05),
      restSeconds: 120,
      isTopSet: false,
      notes: `Кластер ${i + 1}: ${repsPerCluster} повторов с отдыхом ${intraRest}с между повторениями`,
    });
  }

  return {
    schemeType: 'cluster',
    totalSets: clusters,
    sets,
    totalReps: clusters * repsPerCluster,
    averageIntensity: Math.min(0.90, input.baseIntensity + 0.05),
    totalDurationMin: Math.round((clusters * (repsPerCluster * (3 + intraRest) + 120)) / 60),
  };
}

function generateEMOM(input: SetSchemeInput): SetSchemeOutput {
  const sets: SetDefinition[] = [];
  const rounds = Math.max(4, input.baseSets + 2);
  const reps = Math.max(3, input.baseReps - 2);
  const pct = input.baseIntensity - 0.15;

  for (let i = 0; i < rounds; i++) {
    sets.push({
      setIndex: i + 1,
      reps,
      weightPercent: pct,
      restSeconds: 0, // EMOM — rest is whatever remains in the minute
      isTopSet: false,
      notes: `EMOM раунд ${i + 1}/${rounds} — каждый подход в начале минуты`,
    });
  }

  return {
    schemeType: 'emom',
    totalSets: rounds,
    sets,
    totalReps: rounds * reps,
    averageIntensity: pct,
    totalDurationMin: rounds,
  };
}

function generateDensitySets(input: SetSchemeInput): SetSchemeOutput {
  const sets: SetDefinition[] = [];
  const targetReps = input.baseSets * input.baseReps;
  const reps = input.baseReps;
  const pct = input.baseIntensity - 0.10;
  const maxSets = Math.max(3, input.baseSets + 2);

  for (let i = 0; i < maxSets; i++) {
    sets.push({
      setIndex: i + 1,
      reps,
      weightPercent: pct,
      restSeconds: 45,
      isTopSet: false,
      notes: `Плотный подход ${i + 1} — цель: ${targetReps} общих повторений за ${maxSets * 0.75} мин`,
    });
  }

  return {
    schemeType: 'density',
    totalSets: maxSets,
    sets,
    totalReps: maxSets * reps,
    averageIntensity: pct,
    totalDurationMin: Math.round(maxSets * 0.75),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Engine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Selects and generates the optimal set scheme based on goal, difficulty, and risk.
 *
 * Rules:
 *  - Strength → top-backoff, wave loading, cluster
 *  - Hypertrophy → straight, pyramid, reverse pyramid, density
 *  - Conditioning → EMOM, density
 *  - Technique → straight (lower intensity)
 *  - Rehab → straight (low volume)
 *
 *  - High risk → always straight or EMOM (safe)
 *  - High difficulty → avoid wave/cluster
 *  - High fatigue → reduce total sets by 25%
 */
export function generateSetScheme(input: SetSchemeInput): SetSchemeOutput {
  // Determine scheme type
  let schemeType: SchemeType = 'straight';

  if (input.riskLevel === 'high' || input.difficultyLevel === 'high') {
    schemeType = 'straight';
  } else if (input.goal === 'strength') {
    const options: SchemeType[] = ['top_backoff', 'wave', 'cluster'];
    schemeType = options[Math.floor(Math.random() * options.length)];
  } else if (input.goal === 'hypertrophy') {
    const options: SchemeType[] = ['straight', 'pyramid', 'reverse_pyramid', 'density'];
    schemeType = options[Math.floor(Math.random() * options.length)];
  } else if (input.goal === 'conditioning') {
    const options: SchemeType[] = ['emom', 'density', 'straight'];
    schemeType = options[Math.floor(Math.random() * options.length)];
  } else if (input.goal === 'technique') {
    schemeType = 'straight';
  } else if (input.goal === 'rehab') {
    schemeType = 'straight';
  }

  // Generate the selected scheme
  switch (schemeType) {
    case 'pyramid': return generatePyramid(input);
    case 'reverse_pyramid': return generateReversePyramid(input);
    case 'top_backoff': return generateTopBackoff(input);
    case 'wave': return generateWaveLoading(input);
    case 'cluster': return generateClusterSets(input);
    case 'emom': return generateEMOM(input);
    case 'density': return generateDensitySets(input);
    case 'straight':
    default: return generateStraightSets(input);
  }
}
