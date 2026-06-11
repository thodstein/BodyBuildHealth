/**
 * Cycle Engines + Periodization Engines — Combined Module
 *
 * Cycle Engines (9 types):
 *  - PL Base Strength, Volume, Intensity, Peaking
 *  - BB Mass, Specialization, Weak Point, Contest Prep
 *  - WL Technique, Strength
 *  - CF Conditioning, Strength
 *  - Rehab Cycle
 *
 * Periodization Phases (6 types):
 *  - Accumulation, Intensification, Peaking, Deload
 *  - GPP, SPP
 *
 * @module cycle-periodization-engines
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type CycleType =
  | 'pl_base' | 'pl_volume' | 'pl_intensity' | 'pl_peaking'
  | 'bb_mass' | 'bb_specialization' | 'bb_weakpoint' | 'bb_contest'
  | 'wl_technique' | 'wl_strength'
  | 'cf_conditioning' | 'cf_strength'
  | 'rehab';

export type PhaseType = 'accumulation' | 'intensification' | 'peaking' | 'deload' | 'gpp' | 'spp';

export type GoalType = 'strength' | 'hypertrophy' | 'conditioning' | 'technique' | 'rehab' | 'powerlifting' | 'bodybuilding' | 'weightlifting' | 'crossfit';

export interface CycleWeek {
  weekIndex: number;
  volumeMultiplier: number;
  intensityMultiplier: number;
  focus: 'volume' | 'intensity' | 'technique' | 'peaking' | 'mass' | 'conditioning' | 'rehab' | 'deload' | 'strength';
  repsRange: [number, number];
  rpeRange: [number, number];
  notes: string;
}

export interface CycleInput {
  weeks: number;
  goal: GoalType;
  targetMuscle?: string;
  weakPoints: string[];
  riskLevel: 'low' | 'medium' | 'high';
  fatigueLevel: number;
}

export interface CycleOutput {
  name: string;
  totalWeeks: number;
  weeks: CycleWeek[];
  description: string;
  deloadWeek: number | null;
}

export interface PhaseParams {
  volumeLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  intensityLevel: 'low' | 'medium' | 'high' | 'very_high';
  frequencyLevel: 'low' | 'medium' | 'high';
  fatigueCeiling: number;
  priority: 'volume' | 'intensity' | 'peak' | 'recovery' | 'general' | 'specific';
}

export interface PhaseInput {
  goal: GoalType;
  phase: PhaseType;
  analytics: {
    fatigue: number;
    recovery: number;
    risk: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Cycle Generators
// ═══════════════════════════════════════════════════════════════════════════

function makeWeek(
  wi: number, vm: number, im: number,
  focus: CycleWeek['focus'], reps: [number, number], rpe: [number, number], note: string,
): CycleWeek {
  return { weekIndex: wi, volumeMultiplier: vm, intensityMultiplier: im, focus, repsRange: reps, rpeRange: rpe, notes: note };
}

// ── PL Cycles ──

function plBaseStrength(weeks: number): CycleOutput {
  const w: CycleWeek[] = [];
  for (let i = 0; i < weeks; i++) {
    const vm = 1.0 + i * 0.05;
    w.push(makeWeek(i + 1, vm, 0.70 + i * 0.02, 'strength', [3, 6], [7, 8.5], `Неделя ${i + 1}: наращивание силы`));
  }
  return { name: 'PL Base Strength Cycle', totalWeeks: weeks, weeks: w, description: 'Базовый силовой цикл. Умеренный объём, растущая интенсивность.', deloadWeek: weeks };
}

function plVolumeCycle(weeks: number): CycleOutput {
  const w: CycleWeek[] = [
    makeWeek(1, 1.2, 0.65, 'volume', [8, 12], [6, 7], '120% базового объёма'),
    makeWeek(2, 1.3, 0.65, 'volume', [8, 12], [6.5, 7.5], '130% — пик объёма'),
    makeWeek(3, 1.4, 0.60, 'volume', [10, 15], [6, 7], '140% — максимальный объём'),
    makeWeek(4, 1.0, 0.65, 'volume', [8, 10], [6, 7], '100% — стабилизация'),
  ];
  return { name: 'PL Volume Cycle', totalWeeks: 4, weeks: w, description: 'Объёмный цикл для наращивания рабочей ёмкости.', deloadWeek: 4 };
}

function plIntensityCycle(weeks: number): CycleOutput {
  const w: CycleWeek[] = [
    makeWeek(1, 0.8, 0.82, 'intensity', [3, 5], [7.5, 8.5], '80% объёма, 80-85% интенсивности'),
    makeWeek(2, 0.75, 0.86, 'intensity', [2, 4], [8, 9], '85-88% интенсивности'),

    makeWeek(3, 0.70, 0.90, 'intensity', [1, 3], [8.5, 9.5], '88-92% — подход к пику'),
    makeWeek(4, 0.60, 0.75, 'deload', [3, 5], [6, 7], 'Taper — снижение объёма'),
  ];
  return { name: 'PL Intensity Cycle', totalWeeks: 4, weeks: w, description: 'Интенсивный цикл для выхода на максимальную силу.', deloadWeek: 4 };
}

function plPeakingCycle(weeks: number): CycleOutput {
  const w: CycleWeek[] = [
    makeWeek(1, 0.6, 0.90, 'peaking', [1, 3], [8.5, 9.5], '90% интенсивности, 60% объёма'),
    makeWeek(2, 0.4, 0.93, 'peaking', [1, 2], [9, 9.5], '92-95% интенсивности — тяжёлые синглы'),
    makeWeek(3, 0.3, 0.70, 'deload', [3, 5], [6, 7], 'Taper 30% объёма — восстановление перед стартом'),
  ];
  return { name: 'PL Peaking Cycle', totalWeeks: 3, weeks: w, description: 'Пиковый цикл — выход на соревновательный максимум.', deloadWeek: 3 };
}

// ── BB Cycles ──

function bbMassCycle(weeks: number): CycleOutput {
  const w: CycleWeek[] = [];
  for (let i = 0; i < weeks; i++) {
    const vm = 1.2 + i * 0.1;
    w.push(makeWeek(i + 1, vm, 0.65, 'mass', [8, 15], [6, 8], `Неделя ${i + 1}: ${Math.round(vm * 100)}% объёма`));
  }
  // Deload on last week
  if (weeks >= 4) w[weeks - 1] = makeWeek(weeks, 0.8, 0.60, 'deload', [8, 12], [5, 6], 'Делоад — восстановление');
  return { name: 'BB Mass Cycle', totalWeeks: weeks, weeks: w, description: 'Массонаборный цикл. Прогрессивный рост объёма.', deloadWeek: weeks };
}

function bbSpecializationCycle(input: CycleInput): CycleOutput {
  const target = input.targetMuscle || 'chest';
  const w: CycleWeek[] = [
    makeWeek(1, 1.5, 0.65, 'mass', [10, 15], [6, 7.5], `${target}: 150% объёма, остальные 70%`),
    makeWeek(2, 1.7, 0.65, 'mass', [8, 15], [6.5, 8], `${target}: 170%`),
    makeWeek(3, 1.8, 0.62, 'mass', [10, 15], [6, 7.5], `${target}: пик 180%`),
    makeWeek(4, 1.0, 0.60, 'deload', [8, 12], [5, 6], 'Делоад'),
  ];
  return { name: `BB Specialization (${target})`, totalWeeks: 4, weeks: w, description: `Специализация на ${target}. Сверхвысокий объём целевой группы.`, deloadWeek: 4 };
}

function bbWeakPointCycle(input: CycleInput): CycleOutput {
  const wps = input.weakPoints.slice(0, 2);
  const w: CycleWeek[] = [];
  for (let i = 0; i < 4; i++) {
    w.push(makeWeek(i + 1, 1.4 + i * 0.15, 0.65, 'mass', [10, 15], [6, 7.5], `Приоритет: ${wps.join(', ')}`));
  }
  return { name: 'BB Weak Point Cycle', totalWeeks: 4, weeks: w, description: `Устранение слабых мест: ${wps.join(', ')}.`, deloadWeek: null };
}

function bbContestPrep(weeks: number): CycleOutput {
  const w: CycleWeek[] = [];
  for (let i = 0; i < weeks; i++) {
    if (i < weeks * 0.6) {
      w.push(makeWeek(i + 1, 1.1 + i * 0.05, 0.60, 'conditioning', [12, 20], [5, 7], `Неделя ${i + 1}: объём + conditioning`));
    } else {
      w.push(makeWeek(i + 1, 0.7 - i * 0.05, 0.60, 'peaking', [10, 15], [5, 6.5], `Неделя ${i + 1}: снижение объёма, позирование`));
    }
  }
  return { name: 'BB Contest Prep Cycle', totalWeeks: weeks, weeks: w, description: 'Подготовка к соревнованиям. Снижение жира, поддержание мышц.', deloadWeek: weeks };
}

// ── WL Cycles ──

function wlTechniqueCycle(weeks: number): CycleOutput {
  const w: CycleWeek[] = [];
  for (let i = 0; i < weeks; i++) {
    w.push(makeWeek(i + 1, 1.3, 0.55, 'technique', [3, 5], [5, 6.5], `Неделя ${i + 1}: комплексы, техника`));
  }
  return { name: 'WL Technique Cycle', totalWeeks: weeks, weeks: w, description: 'Технический цикл. Низкая интенсивность, высокий объём повторений.', deloadWeek: null };
}

function wlStrengthCycle(weeks: number): CycleOutput {
  const w: CycleWeek[] = [
    makeWeek(1, 1.0, 0.80, 'strength', [2, 5], [7, 8], 'Тяги + присед 80%'),
    makeWeek(2, 0.9, 0.85, 'intensity', [1, 4], [7.5, 8.5], 'Тяжёлые тяги 85%'),
    makeWeek(3, 0.8, 0.89, 'intensity', [1, 3], [8, 9], '88-90%'),
    makeWeek(4, 0.6, 0.70, 'deload', [3, 5], [6, 7], 'Taper 70%'),
  ];
  return { name: 'WL Strength Cycle', totalWeeks: 4, weeks: w, description: 'Силовой цикл тяжёлой атлетики.', deloadWeek: 4 };
}

// ── CF Cycles ──

function cfConditioningCycle(weeks: number): CycleOutput {
  const w: CycleWeek[] = [];
  for (let i = 0; i < weeks; i++) {
    w.push(makeWeek(i + 1, 1.3, 0.6, 'conditioning', [15, 30], [5, 6.5], `Неделя ${i + 1}: интервалы + метконы`));
  }
  return { name: 'CF Conditioning Cycle', totalWeeks: weeks, weeks: w, description: 'Кондиционный цикл. Высокая плотность, интервалы.', deloadWeek: weeks };
}

function cfStrengthCycle(weeks: number): CycleOutput {
  const w: CycleWeek[] = [
    makeWeek(1, 1.0, 0.75, 'strength', [3, 6], [7, 8], 'Присед + жим + тяга'),
    makeWeek(2, 0.9, 0.80, 'strength', [2, 5], [7.5, 8.5], 'Становая + overhead + гимнастика'),
    makeWeek(3, 0.8, 0.85, 'intensity', [1, 4], [8, 9], 'Комплексы + тяжёлые синглы'),
    makeWeek(4, 0.6, 0.70, 'deload', [3, 5], [6, 7], 'Taper'),
  ];
  return { name: 'CF Strength Cycle', totalWeeks: 4, weeks: w, description: 'Силовой цикл CrossFit.', deloadWeek: 4 };
}

// ── Rehab Cycle ──

function rehabCycle(weeks: number): CycleOutput {
  const w: CycleWeek[] = [];
  for (let i = 0; i < weeks; i++) {
    const vm = 0.6 + i * 0.15;
    w.push(makeWeek(i + 1, Math.min(1.2, vm), 0.4 + i * 0.06, 'rehab', [10, 20], [3, 5], `Неделя ${i + 1}: изометрика → лёгкая динамика`));
  }
  return { name: 'Rehab Cycle', totalWeeks: weeks, weeks: w, description: 'Восстановительный цикл. Постепенная прогрессия.', deloadWeek: null };
}

// ═══════════════════════════════════════════════════════════════════════════
// Cycle Router
// ═══════════════════════════════════════════════════════════════════════════

export function generateCycle(type: CycleType, input: CycleInput): CycleOutput {
  switch (type) {
    case 'pl_base': return plBaseStrength(input.weeks);
    case 'pl_volume': return plVolumeCycle(input.weeks);
    case 'pl_intensity': return plIntensityCycle(input.weeks);
    case 'pl_peaking': return plPeakingCycle(input.weeks);
    case 'bb_mass': return bbMassCycle(input.weeks);
    case 'bb_specialization': return bbSpecializationCycle(input);
    case 'bb_weakpoint': return bbWeakPointCycle(input);
    case 'bb_contest': return bbContestPrep(input.weeks);
    case 'wl_technique': return wlTechniqueCycle(input.weeks);
    case 'wl_strength': return wlStrengthCycle(input.weeks);
    case 'cf_conditioning': return cfConditioningCycle(input.weeks);
    case 'cf_strength': return cfStrengthCycle(input.weeks);
    case 'rehab': return rehabCycle(input.weeks);
    default: return plBaseStrength(4);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Periodization Engine
// ═══════════════════════════════════════════════════════════════════════════

export function getPhaseParams(input: PhaseInput): PhaseParams {
  switch (input.phase) {
    case 'accumulation':
      return {
        volumeLevel: 'high',
        intensityLevel: 'low',
        frequencyLevel: 'medium',
        fatigueCeiling: 0.7,
        priority: 'volume',
      };
    case 'intensification':
      return {
        volumeLevel: 'medium',
        intensityLevel: 'high',
        frequencyLevel: 'medium',
        fatigueCeiling: 0.6,
        priority: 'intensity',
      };
    case 'peaking':
      return {
        volumeLevel: 'very_low',
        intensityLevel: 'very_high',
        frequencyLevel: 'low',
        fatigueCeiling: 0.4,
        priority: 'peak',
      };
    case 'deload':
      return {
        volumeLevel: 'very_low',
        intensityLevel: 'low',
        frequencyLevel: 'low',
        fatigueCeiling: 0.3,
        priority: 'recovery',
      };
    case 'gpp':
      return {
        volumeLevel: 'high',
        intensityLevel: 'low',
        frequencyLevel: 'high',
        fatigueCeiling: 0.8,
        priority: 'general',
      };
    case 'spp':
      return {
        volumeLevel: 'medium',
        intensityLevel: 'medium',
        frequencyLevel: 'medium',
        fatigueCeiling: 0.65,
        priority: 'specific',
      };
    default:
      return {
        volumeLevel: 'medium',
        intensityLevel: 'medium',
        frequencyLevel: 'medium',
        fatigueCeiling: 0.6,
        priority: 'volume',
      };
  }
}

/**
 * Generate a multi-phase periodization plan.
 * Example: 12 weeks = 4w Accumulation + 4w Intensification + 3w Peaking + 1w Deload
 */
export function generatePeriodization(totalWeeks: number, goal: GoalType): { phases: { phase: PhaseType; weeks: number; params: PhaseParams }[] } {
  const phases: { phase: PhaseType; weeks: number; params: PhaseParams }[] = [];

  if (totalWeeks <= 4) {
    phases.push({ phase: 'accumulation', weeks: totalWeeks, params: getPhaseParams({ goal, phase: 'accumulation', analytics: { fatigue: 0, recovery: 0, risk: 0 } }) });
  } else if (totalWeeks <= 8) {
    const accWeeks = Math.floor(totalWeeks * 0.5);
    phases.push({ phase: 'accumulation', weeks: accWeeks, params: getPhaseParams({ goal, phase: 'accumulation', analytics: { fatigue: 0, recovery: 0, risk: 0 } }) });
    const intWeeks = totalWeeks - accWeeks - 1;
    if (intWeeks > 0) phases.push({ phase: 'intensification', weeks: intWeeks, params: getPhaseParams({ goal, phase: 'intensification', analytics: { fatigue: 0, recovery: 0, risk: 0 } }) });
    phases.push({ phase: 'deload', weeks: 1, params: getPhaseParams({ goal, phase: 'deload', analytics: { fatigue: 0, recovery: 0, risk: 0 } }) });
  } else {
    const accWeeks = Math.floor(totalWeeks * 0.35);
    const intWeeks = Math.floor(totalWeeks * 0.30);
    const peakWeeks = Math.max(2, Math.floor(totalWeeks * 0.20));
    const dlWeeks = totalWeeks - accWeeks - intWeeks - peakWeeks;
    phases.push({ phase: 'accumulation', weeks: accWeeks, params: getPhaseParams({ goal, phase: 'accumulation', analytics: { fatigue: 0, recovery: 0, risk: 0 } }) });
    phases.push({ phase: 'intensification', weeks: intWeeks, params: getPhaseParams({ goal, phase: 'intensification', analytics: { fatigue: 0, recovery: 0, risk: 0 } }) });
    phases.push({ phase: 'peaking', weeks: peakWeeks, params: getPhaseParams({ goal, phase: 'peaking', analytics: { fatigue: 0, recovery: 0, risk: 0 } }) });
    if (dlWeeks > 0) phases.push({ phase: 'deload', weeks: dlWeeks, params: getPhaseParams({ goal, phase: 'deload', analytics: { fatigue: 0, recovery: 0, risk: 0 } }) });
  }

  return { phases };
}
