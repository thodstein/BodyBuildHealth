/**
 * Risk & Biomechanics Domain — Complete Module
 *
 * Joint Load Engine      : Torque calculations for all major joints
 * Spine Load Engine      : Compression + shear forces on spine
 * Knee Load Engine       : Valgus index, knee torque, patellofemoral stress
 * Shoulder Load Engine   : Impingement risk, rotator cuff stress
 * Biomechanics Models    : 2D segment model, lever arms, mass distribution
 * Risk Engine            : Unified risk score → flags → recommendations
 *
 * Pure functions. No state. Works in browser (Telegram Mini App).
 *
 * @module biomechanics-risk-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface AnthropometryInput {
  heightCm: number;
  weightKg: number;
  femurLengthCm?: number;
  tibiaLengthCm?: number;
  torsoLengthCm?: number;
  armLengthCm?: number;
  footWidthCm?: number;
}

export interface ExerciseBiomechanics {
  exerciseId: string;
  category: string;
  barPosition?: 'high_bar' | 'low_bar' | 'front' | 'overhead' | 'none';
  stance?: 'narrow' | 'medium' | 'wide';
  grip?: 'narrow' | 'medium' | 'wide' | 'snatch_grip';
  isUnilateral: boolean;
  expectedROM: { minCm: number; maxCm: number };
  jointAnglesDeg: {
    kneeMin: number; kneeMax: number;
    hipMin: number; hipMax: number;
    ankleMin: number; ankleMax: number;
    shoulderMin: number; shoulderMax: number;
    elbowMin: number; elbowMax: number;
  };
  torqueProfile: 'bottom_peak' | 'midrange_peak' | 'top_peak' | 'uniform';
  spineLoadProfile: 'low' | 'medium' | 'high';
  kneeLoadProfile: 'low' | 'medium' | 'high';
  shoulderLoadProfile: 'low' | 'medium' | 'high';
}

export interface LoadInput {
  weightKg: number;
  barPosition: string;
  stance: string;
  grip: string;
  romCm?: number;
}

export interface BiomechanicsInput {
  exercise: ExerciseBiomechanics;
  load: LoadInput;
  anthropometry: AnthropometryInput;
  videoMetrics?: {
    barPath?: { x: number; y: number }[];
    kneeAngle?: number;
    torsoAngle?: number;
    shoulderAngle?: number;
    velocity?: number;
  };
}

export interface JointTorqueOutput {
  kneeNm: number;
  hipNm: number;
  ankleNm: number;
  shoulderNm: number;
  elbowNm: number;
  lumbarNm: number;
}

export interface SpineLoadOutput {
  compressionN: number;
  shearN: number;
  compressionRisk: 'low' | 'medium' | 'high';
  shearRisk: 'low' | 'medium' | 'high';
}

export interface KneeLoadOutput {
  torqueNm: number;
  valgusIndex: number;
  valgusRisk: 'low' | 'medium' | 'high';
  patellofemoralStress: number; // MPa estimate
}

export interface ShoulderLoadOutput {
  torqueNm: number;
  impingementRisk: 'low' | 'medium' | 'high';
  rotatorCuffStress: number; // relative 0-1
  labrumStress: number; // relative 0-1
}

export interface RiskFlag {
  joint: string;
  severity: 'low' | 'medium' | 'high';
  type: string;
  message: string;
  recommendation: string;
}

export interface RiskOutput {
  overallRiskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  jointTorques: JointTorqueOutput;
  spineLoad: SpineLoadOutput;
  kneeLoad: KneeLoadOutput;
  shoulderLoad: ShoulderLoadOutput;
  flags: RiskFlag[];
  recommendations: string[];
  exerciseSafetyScore: number; // 0-100
}

// ═══════════════════════════════════════════════════════════════════════════
// Biomechanics Models — Segment lengths and mass fractions
// ═══════════════════════════════════════════════════════════════════════════

/** Estimates segment lengths from height (fraction of height). Winter (2009). */
function estimateSegments(anthro: AnthropometryInput) {
  const H = anthro.heightCm;
  return {
    femurLength: anthro.femurLengthCm || H * 0.245,
    tibiaLength: anthro.tibiaLengthCm || H * 0.246,
    torsoLength: anthro.torsoLengthCm || H * 0.300,
    armLength: anthro.armLengthCm || H * 0.186,
    footLength: H * 0.152,
    footWidth: anthro.footWidthCm || 10,
  };
}

/** Segment mass fractions of total body mass. */
function segmentMassFractions() {
  return {
    headNeck: 0.081,
    trunk: 0.497,
    upperArm: 0.028,
    forearm: 0.016,
    hand: 0.006,
    thigh: 0.100,
    shank: 0.046,
    foot: 0.014,
  };
}

/** Gravity constant */
const G = 9.81;

// ═══════════════════════════════════════════════════════════════════════════
// Joint Load Engine — Torque calculations
// ═══════════════════════════════════════════════════════════════════════════

function calcJointTorques(
  exercise: ExerciseBiomechanics,
  load: LoadInput,
  segments: ReturnType<typeof estimateSegments>,
  massFrac: ReturnType<typeof segmentMassFractions>,
  videoAngles?: { kneeAngle?: number; torsoAngle?: number; shoulderAngle?: number },
): JointTorqueOutput {
  const bodyMass = G * 80; // default 80kg if not given
  const barWeight = load.weightKg * G;

  // Lever arm approximations (meters)
  const femurLeverM = segments.femurLength / 100 * 0.4;  // ~40% of femur for knee moment
  const hipLeverM = segments.femurLength / 100 * 0.6;     // ~60% for hip moment
  const ankleLeverM = segments.tibiaLength / 100 * 0.3;
  const spineLeverM = segments.torsoLength / 100 * 0.5;
  const shoulderLeverM = segments.armLength / 100 * 0.5;

  // Get actual or expected joint angles
  const kneeAngle = videoAngles?.kneeAngle ?? Math.min(exercise.jointAnglesDeg.kneeMin + 10, exercise.jointAnglesDeg.kneeMax);
  const torsoAngle = videoAngles?.torsoAngle ?? 45;
  const shoulderAngle = videoAngles?.shoulderAngle ?? Math.max(exercise.jointAnglesDeg.shoulderMin, exercise.jointAnglesDeg.shoulderMax - 30);

  // Torque = F × d × sin(θ)
  const kneeNm = (barWeight + bodyMass * massFrac.thigh * 0.5) * femurLeverM * Math.sin((kneeAngle * Math.PI) / 180);
  const hipNm = (barWeight + bodyMass * massFrac.trunk * 0.3) * hipLeverM * Math.sin(((90 - torsoAngle) * Math.PI) / 180);
  const ankleNm = (barWeight + bodyMass * massFrac.shank * 0.3) * ankleLeverM * 0.5;
  const shoulderNm = (barWeight * 0.5) * shoulderLeverM * Math.sin(((90 - shoulderAngle) * Math.PI) / 180);
  const elbowNm = (barWeight * 0.3) * (segments.armLength / 100 * 0.3) * 0.5;
  const lumbarNm = (barWeight + bodyMass * massFrac.trunk * 0.5) * spineLeverM * Math.cos(((90 - torsoAngle) * Math.PI) / 180);

  return {
    kneeNm: Math.round(kneeNm),
    hipNm: Math.round(hipNm),
    ankleNm: Math.round(ankleNm),
    shoulderNm: Math.round(shoulderNm),
    elbowNm: Math.round(elbowNm),
    lumbarNm: Math.round(lumbarNm),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Spine Load Engine
// ═══════════════════════════════════════════════════════════════════════════

function calcSpineLoad(
  exercise: ExerciseBiomechanics,
  load: LoadInput,
  torque: JointTorqueOutput,
  videoTorsoAngle?: number,
): SpineLoadOutput {
  const torsoAngle = videoTorsoAngle ?? 45;
  const torsoRad = (torsoAngle * Math.PI) / 180;
  const barForce = load.weightKg * G;
  const trunkMass = 80 * 0.497; // ~40kg trunk

  // Compression = sum of forces along spine axis
  const compression = (barForce + trunkMass * G) * Math.cos(torsoRad) + torque.lumbarNm * 0.1;
  // Shear = sum of forces perpendicular to spine
  const shear = (barForce + trunkMass * G) * Math.sin(torsoRad);

  // Risk thresholds (based on NIOSH limits)
  // Safe: compression < 3400N, shear < 1000N
  const compressionRisk = compression > 5000 ? 'high' : compression > 3400 ? 'medium' : 'low';
  const shearRisk = shear > 1500 ? 'high' : shear > 1000 ? 'medium' : 'low';

  return {
    compressionN: Math.round(compression),
    shearN: Math.round(shear),
    compressionRisk,
    shearRisk,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Knee Load Engine
// ═══════════════════════════════════════════════════════════════════════════

function calcKneeLoad(
  torque: JointTorqueOutput,
  segments: ReturnType<typeof estimateSegments>,
  videoKneeAngle?: number,
  kneeInwardShiftCm?: number,
): KneeLoadOutput {
  // Patellofemoral stress (MPa) ≈ knee torque / contact area estimate
  const patellofemoralStress = torque.kneeNm / 400; // rough conversion to MPa

  // Valgus index = inward deviation / foot width
  const inwardShift = kneeInwardShiftCm ?? 0;
  const footWidth = segments.footWidth;
  const valgusIndex = footWidth > 0 ? inwardShift / footWidth : 0;
  const valgusRisk = valgusIndex > 0.15 ? 'high' : valgusIndex > 0.08 ? 'medium' : 'low';

  return {
    torqueNm: torque.kneeNm,
    valgusIndex: Math.round(valgusIndex * 1000) / 1000,
    valgusRisk,
    patellofemoralStress: Math.round(patellofemoralStress * 100) / 100,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Shoulder Load Engine
// ═══════════════════════════════════════════════════════════════════════════

function calcShoulderLoad(
  exercise: ExerciseBiomechanics,
  torque: JointTorqueOutput,
  load: LoadInput,
  videoShoulderAngle?: number,
): ShoulderLoadOutput {
  const shoulderAngle = videoShoulderAngle ?? 90;
  const overheadFactor = exercise.category.includes('press') || exercise.category.includes('overhead') ? 1.5 : 1.0;
  const barFactor = load.barPosition === 'overhead' ? 2.0 : load.barPosition === 'front' ? 0.8 : 1.0;

  // Impingement risk: high when shoulder is internally rotated + abducted
  const impingementScore = (shoulderAngle / 180) * overheadFactor * barFactor;
  const impingementRisk = impingementScore > 0.7 ? 'high' : impingementScore > 0.4 ? 'medium' : 'low';

  // Rotator cuff stress (relative 0-1)
  const cuffStress = Math.min(1, torque.shoulderNm / 80 * overheadFactor);

  // Labrum stress (relative 0-1)
  const labrumStress = Math.min(1, torque.shoulderNm / 100 * (shoulderAngle > 120 ? 1.8 : 1.0));

  return {
    torqueNm: torque.shoulderNm,
    impingementRisk,
    rotatorCuffStress: Math.round(cuffStress * 100) / 100,
    labrumStress: Math.round(labrumStress * 100) / 100,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Risk Engine — Aggregate all biomechanics data into unified risk
// ═══════════════════════════════════════════════════════════════════════════

function generateRiskFlags(
  biomech: BiomechanicsInput,
  jointLoads: JointTorqueOutput,
  spineLoad: SpineLoadOutput,
  kneeLoad: KneeLoadOutput,
  shoulderLoad: ShoulderLoadOutput,
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // Knee flags
  if (kneeLoad.valgusRisk === 'high') {
    flags.push({
      joint: 'knee',
      severity: 'high',
      type: 'valgus_collapse',
      message: 'Вальгус колена — смещение колена внутрь при нагрузке',
      recommendation: 'Добавьте banded squats, укрепите ягодицы (hip thrust, clamshell)',
    });
  }
  if (jointLoads.kneeNm > 250) {
    flags.push({
      joint: 'knee',
      severity: jointLoads.kneeNm > 350 ? 'high' : 'medium',
      type: 'high_torque',
      message: `Торк колена ${jointLoads.kneeNm} Нм — повышенная нагрузка`,
      recommendation: 'Снизьте вес на 20%, уменьшите глубину до 90°',
    });
  }

  // Spine flags
  if (spineLoad.compressionRisk === 'high') {
    flags.push({
      joint: 'spine',
      severity: 'high',
      type: 'compression',
      message: `Компрессия позвоночника ${spineLoad.compressionN} Н — риск грыжи`,
      recommendation: 'Замените упражнение на вариацию с меньшей осевой нагрузкой',
    });
  }
  if (spineLoad.shearRisk === 'high') {
    flags.push({
      joint: 'spine',
      severity: 'high',
      type: 'shear',
      message: `Сдвиговая нагрузка ${spineLoad.shearN} Н — риск спондилолистеза`,
      recommendation: 'Укрепите кор (dead bug, Pallof press), уменьшите наклон торса',
    });
  }

  // Shoulder flags
  if (shoulderLoad.impingementRisk === 'high') {
    flags.push({
      joint: 'shoulder',
      severity: 'high',
      type: 'impingement',
      message: 'Высокий риск импинджмента плеча',
      recommendation: 'Добавьте упражнения на внешнее вращение, уменьшите overhead-нагрузку',
    });
  }
  if (shoulderLoad.rotatorCuffStress > 0.7) {
    flags.push({
      joint: 'shoulder',
      severity: 'medium',
      type: 'cuff_stress',
      message: 'Высокая нагрузка на ротаторную манжету',
      recommendation: 'Добавьте YTWL-комплекс, уменьшите вес на overhead-упражнениях',
    });
  }

  // Hip flags
  if (jointLoads.hipNm > 300) {
    flags.push({
      joint: 'hip',
      severity: jointLoads.hipNm > 400 ? 'high' : 'medium',
      type: 'high_torque',
      message: `Торк бедра ${jointLoads.hipNm} Нм`,
      recommendation: 'Снизьте вес, проверьте технику (hip hinge)',
    });
  }

  return flags;
}

function calcOverallRisk(flags: RiskFlag[]): { score: number; level: 'low' | 'medium' | 'high' | 'critical' } {
  if (flags.length === 0) return { score: 5, level: 'low' };

  let score = 0;
  for (const flag of flags) {
    score += flag.severity === 'high' ? 25 : flag.severity === 'medium' ? 12 : 5;
  }
  score = Math.min(100, score);

  const level = score >= 80 ? 'critical' : score >= 50 ? 'high' : score >= 20 ? 'medium' : 'low';
  return { score, level };
}

// ═══════════════════════════════════════════════════════════════════════════
// Exercise Safety Profile — pre-defined for common exercises
// ═══════════════════════════════════════════════════════════════════════════

const EXERCISE_SAFETY: Record<string, { riskProfile: string; maxTorqueNm: Record<string, number>; contraindications: string[] }> = {
  back_squat: {
    riskProfile: 'medium',
    maxTorqueNm: { knee: 300, hip: 350, spine: 250 },
    contraindications: ['knee_injury', 'spine_injury'],
  },
  bench_press: {
    riskProfile: 'low',
    maxTorqueNm: { shoulder: 200, elbow: 80 },
    contraindications: ['shoulder_injury'],
  },
  deadlift: {
    riskProfile: 'high',
    maxTorqueNm: { spine: 400, hip: 400 },
    contraindications: ['spine_injury', 'hip_injury'],
  },
  overhead_press: {
    riskProfile: 'medium',
    maxTorqueNm: { shoulder: 250, spine: 150 },
    contraindications: ['shoulder_injury', 'spine_injury'],
  },
  barbell_row: {
    riskProfile: 'low',
    maxTorqueNm: { spine: 200, shoulder: 100 },
    contraindications: [],
  },
  pull_up: {
    riskProfile: 'low',
    maxTorqueNm: { shoulder: 80, elbow: 60 },
    contraindications: [],
  },
  front_squat: {
    riskProfile: 'medium',
    maxTorqueNm: { knee: 280, hip: 300, spine: 200 },
    contraindications: ['knee_injury'],
  },
  romanian_deadlift: {
    riskProfile: 'medium',
    maxTorqueNm: { spine: 300, hip: 300 },
    contraindications: ['spine_injury'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Pipeline
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full biomechanics + risk analysis for a given exercise and load.
 *
 * Pipeleine:
 *  1. Estimate segment lengths from anthropometry
 *  2. Calculate joint torques (knee, hip, ankle, shoulder, elbow, lumbar)
 *  3. Calculate spine load (compression + shear)
 *  4. Calculate knee load (valgus + patellofemoral)
 *  5. Calculate shoulder load (impingement + cuff + labrum)
 *  6. Generate risk flags
 *  7. Compute overall risk score
 *  8. Look up exercise safety profile
 */
export function analyzeBiomechanics(input: BiomechanicsInput): RiskOutput {
  const segments = estimateSegments(input.anthropometry);
  const massFrac = segmentMassFractions();

  const videoAngles = input.videoMetrics
    ? {
        kneeAngle: input.videoMetrics.kneeAngle,
        torsoAngle: input.videoMetrics.torsoAngle,
        shoulderAngle: input.videoMetrics.shoulderAngle,
      }
    : undefined;

  // Step 1-2: Joint torques
  const jointTorques = calcJointTorques(input.exercise, input.load, segments, massFrac, videoAngles);

  // Step 3: Spine load
  const spineLoad = calcSpineLoad(input.exercise, input.load, jointTorques, input.videoMetrics?.torsoAngle);

  // Step 4: Knee load
  const kneeLoad = calcKneeLoad(jointTorques, segments, input.videoMetrics?.kneeAngle);

  // Step 5: Shoulder load
  const shoulderLoad = calcShoulderLoad(input.exercise, jointTorques, input.load, input.videoMetrics?.shoulderAngle);

  // Step 6: Risk flags
  const flags = generateRiskFlags(input, jointTorques, spineLoad, kneeLoad, shoulderLoad);

  // Step 7: Overall risk
  const { score: riskScore, level: riskLevel } = calcOverallRisk(flags);

  // Step 8: Safety profile
  const safety = EXERCISE_SAFETY[input.exercise.exerciseId];
  let safetyScore = 80; // default safe
  if (safety) {
    if (safety.riskProfile === 'high') safetyScore = 40;
    else if (safety.riskProfile === 'medium') safetyScore = 60;
    // Reduce further if contraindicated
    for (const flag of flags) {
      if (safety.contraindications.includes(flag.joint + '_injury')) safetyScore -= 15;
    }
    safetyScore = Math.max(10, Math.min(100, safetyScore));
  }

  // Recommendations
  const recommendations = flags.map(f => f.recommendation);
  if (riskLevel === 'high' || riskLevel === 'critical') {
    recommendations.unshift('Рассмотрите замену упражнения на более безопасную вариацию');
  }
  if (safetyScore < 50) {
    recommendations.unshift('Упражнение имеет низкий профиль безопасности — используйте с осторожностью');
  }

  return {
    overallRiskScore: riskScore,
    riskLevel,
    jointTorques,
    spineLoad,
    kneeLoad,
    shoulderLoad,
    flags,
    recommendations: [...new Set(recommendations)],
    exerciseSafetyScore: Math.round(safetyScore),
  };
}

/**
 * Quick check: is an exercise safe given risk snapshot?
 */
export function quickSafetyCheck(
  exerciseId: string,
  riskSnapshot: Record<string, string>,
): { safe: boolean; reason: string } {
  const safety = EXERCISE_SAFETY[exerciseId];
  if (!safety) return { safe: true, reason: '' };

  for (const [joint, level] of Object.entries(riskSnapshot)) {
    if (level === 'high' && safety.contraindications.includes(joint + '_injury')) {
      return { safe: false, reason: `Противопоказано при травме ${joint}` };
    }
  }

  if (safety.riskProfile === 'high') {
    return { safe: true, reason: 'Высокий риск — выполняйте с осторожностью и полным контролем техники' };
  }

  return { safe: true, reason: '' };
}
