import type { CyclePlan, CycleTemplate, CycleWeekPlan, CyclePhaseDef, CycleSummary, MesocyclePhase5 } from './cycle-types.engine';

export type { CyclePlan, CycleTemplate, CycleWeekPlan, CyclePhaseDef, CycleSummary, MesocyclePhase5 };

/**
 * Goal-specific cycle templates with per-week volume/intensity multipliers.
 * 4-12 week cycles. 5-phase periodization model.
 */

// ── Phase configuration ──

export const PHASE5 = ['accumulation', 'intensification', 'transmutation', 'peak', 'deload'] as const;

type MesocyclePhase = typeof PHASE5[number];

// Map 5-phase → 4-phase (rir-matrix compatibility)
export const PHASE5_TO_PHASE4: Record<MesocyclePhase, 'base' | 'build' | 'peak' | 'deload'> = {
  accumulation: 'base',
  intensification: 'build',
  transmutation: 'build',
  peak: 'peak',
  deload: 'deload',
};

export const PHASE_DEFAULTS: Record<MesocyclePhase, {
  volStart: number; volEnd: number; intStart: number; intEnd: number;
  rirStart: number; rirEnd: number;
  desc: string;
}> = {
  accumulation:    { volStart: 0.85, volEnd: 1.05, intStart: 0.60, intEnd: 0.70, rirStart: 3, rirEnd: 2, desc: 'Накопление объёма' },
  intensification: { volStart: 0.80, volEnd: 0.90, intStart: 0.75, intEnd: 0.85, rirStart: 2, rirEnd: 1, desc: 'Рост интенсивности' },
  transmutation:   { volStart: 0.70, volEnd: 0.80, intStart: 0.85, intEnd: 0.92, rirStart: 1, rirEnd: 0, desc: 'Трансмутация в силу' },
  peak:            { volStart: 0.55, volEnd: 0.65, intStart: 0.90, intEnd: 0.98, rirStart: 1, rirEnd: 0, desc: 'Пиковая нагрузка' },
  deload:          { volStart: 0.40, volEnd: 0.50, intStart: 0.50, intEnd: 0.60, rirStart: 4, rirEnd: 4, desc: 'Разгрузка' },
};

// ── Cycle template definitions ──

export const CYCLE_TEMPLATES: CycleTemplate[] = [
  // ═══ BULK ═══
  {
    id: 'bulk_beginner_12',
    name: 'Масса: базовая 12 нед',
    description: 'Длительный набор с акцентом на объём. 4 фазы накопления + интенсификация + пик + разгрузка.',
    minWeeks: 10, maxWeeks: 14,
    goals: ['bulk'], levels: ['beginner', 'intermediate'],
    phases: [
      { phase: 'accumulation', weeks: 5, startVol: 0.85, endVol: 1.05 },
      { phase: 'intensification', weeks: 4, startVol: 0.85, endVol: 0.95 },
      { phase: 'transmutation', weeks: 2, startVol: 0.75, endVol: 0.85 },
      { phase: 'peak', weeks: 1, startVol: 0.60, endVol: 0.65 },
    ],
    progressionType: 'double',
    intensityProfile: 'moderate',
    recoveryThreshold: 40,
  },
  {
    id: 'bulk_advanced_10',
    name: 'Масса: продвинутая 10 нед',
    description: 'Для продвинутых и enhanced. Быстрая интенсификация, высокий объём.',
    minWeeks: 8, maxWeeks: 12,
    goals: ['bulk'], levels: ['advanced', 'enhanced'],
    phases: [
      { phase: 'accumulation', weeks: 3, startVol: 0.90, endVol: 1.10 },
      { phase: 'intensification', weeks: 4, startVol: 0.85, endVol: 0.95 },
      { phase: 'transmutation', weeks: 2, startVol: 0.75, endVol: 0.85 },
      { phase: 'peak', weeks: 1, startVol: 0.60, endVol: 0.65 },
    ],
    progressionType: 'undulating',
    intensityProfile: 'aggressive',
    recoveryThreshold: 55,
  },

  // ═══ CUT ═══
  {
    id: 'cut_standard_8',
    name: 'Сушка: стандарт 8 нед',
    description: 'Средняя продолжительность. Сохранение интенсивности при сниженном объёме.',
    minWeeks: 6, maxWeeks: 10,
    goals: ['cut'], levels: ['beginner', 'intermediate', 'advanced', 'enhanced'],
    phases: [
      { phase: 'accumulation', weeks: 2, startVol: 0.85, endVol: 0.95 },
      { phase: 'intensification', weeks: 3, startVol: 0.80, endVol: 0.85 },
      { phase: 'transmutation', weeks: 2, startVol: 0.70, endVol: 0.80 },
      { phase: 'peak', weeks: 1, startVol: 0.55, endVol: 0.60 },
    ],
    progressionType: 'linear',
    intensityProfile: 'moderate',
    recoveryThreshold: 45,
  },
  {
    id: 'cut_aggressive_6',
    name: 'Сушка: агрессивная 6 нед',
    description: 'Быстрая сушка. Максимальное сохранение интенсивности, минимальный объём.',
    minWeeks: 4, maxWeeks: 8,
    goals: ['cut'], levels: ['advanced', 'enhanced'],
    phases: [
      { phase: 'accumulation', weeks: 1, startVol: 0.85, endVol: 0.90 },
      { phase: 'intensification', weeks: 2, startVol: 0.80, endVol: 0.85 },
      { phase: 'transmutation', weeks: 2, startVol: 0.70, endVol: 0.80 },
      { phase: 'peak', weeks: 1, startVol: 0.55, endVol: 0.60 },
    ],
    progressionType: 'linear',
    intensityProfile: 'aggressive',
    recoveryThreshold: 50,
  },

  // ═══ STRENGTH ═══
  {
    id: 'strength_classic_12',
    name: 'Сила: классическая 12 нед',
    description: 'Полный силовой цикл с пикированием. 5/3/1-подобная структура.',
    minWeeks: 10, maxWeeks: 16,
    goals: ['strength'], levels: ['intermediate', 'advanced', 'enhanced'],
    phases: [
      { phase: 'accumulation', weeks: 4, startVol: 0.90, endVol: 1.00 },
      { phase: 'intensification', weeks: 4, startVol: 0.85, endVol: 0.90 },
      { phase: 'transmutation', weeks: 2, startVol: 0.70, endVol: 0.80 },
      { phase: 'peak', weeks: 2, startVol: 0.55, endVol: 0.65 },
    ],
    progressionType: 'linear',
    intensityProfile: 'moderate',
    recoveryThreshold: 50,
  },
  {
    id: 'strength_beginner_8',
    name: 'Сила: базовая 8 нед',
    description: 'Для новичков. Линейная прогрессия, частые разгрузки.',
    minWeeks: 6, maxWeeks: 10,
    goals: ['strength'], levels: ['beginner'],
    phases: [
      { phase: 'accumulation', weeks: 3, startVol: 0.85, endVol: 1.00 },
      { phase: 'intensification', weeks: 3, startVol: 0.80, endVol: 0.90 },
      { phase: 'peak', weeks: 1, startVol: 0.60, endVol: 0.70 },
      { phase: 'deload', weeks: 1 },
    ],
    progressionType: 'linear',
    intensityProfile: 'conservative',
    recoveryThreshold: 35,
  },

  // ═══ MAINTENANCE ═══
  {
    id: 'maintain_8',
    name: 'Поддержание 8 нед',
    description: 'Стабилизация. Умеренный объём, комфортная интенсивность.',
    minWeeks: 6, maxWeeks: 12,
    goals: ['maintenance'], levels: ['beginner', 'intermediate', 'advanced', 'enhanced'],
    phases: [
      { phase: 'accumulation', weeks: 4, startVol: 0.85, endVol: 0.95 },
      { phase: 'intensification', weeks: 3, startVol: 0.80, endVol: 0.85 },
      { phase: 'deload', weeks: 1 },
    ],
    progressionType: 'double',
    intensityProfile: 'conservative',
    recoveryThreshold: 35,
  },

  // ═══ RECOMP ═══
  {
    id: 'recomp_10',
    name: 'Режим рекомпозиции 10 нед',
    description: 'Баланс между набором и сжиганием. Средняя интенсивность, умеренный объём.',
    minWeeks: 8, maxWeeks: 12,
    goals: ['recomp'], levels: ['intermediate', 'advanced'],
    phases: [
      { phase: 'accumulation', weeks: 4, startVol: 0.85, endVol: 1.00 },
      { phase: 'intensification', weeks: 3, startVol: 0.80, endVol: 0.90 },
      { phase: 'transmutation', weeks: 2, startVol: 0.70, endVol: 0.80 },
      { phase: 'deload', weeks: 1 },
    ],
    progressionType: 'undulating',
    intensityProfile: 'moderate',
    recoveryThreshold: 45,
  },

  // ═══ REHAB ═══
  {
    id: 'rehab_8',
    name: 'Реабилитация 8 нед',
    description: 'Восстановление после травм. Низкий объём, консервативная прогрессия, частые разгрузки.',
    minWeeks: 6, maxWeeks: 12,
    goals: ['rehab'], levels: ['beginner', 'intermediate', 'advanced', 'enhanced'],
    phases: [
      { phase: 'accumulation', weeks: 4, startVol: 0.60, endVol: 0.75 },
      { phase: 'intensification', weeks: 2, startVol: 0.65, endVol: 0.75 },
      { phase: 'deload', weeks: 2 },
    ],
    progressionType: 'double',
    intensityProfile: 'conservative',
    recoveryThreshold: 25,
  },

  // ═══ HYPERTROPHY ═══
  {
    id: 'hypertrophy_12',
    name: 'Гипертрофия 12 нед',
    description: 'Максимальный мышечный рост. Высокий объём, средняя интенсивность, прогрессивная перегрузка.',
    minWeeks: 10, maxWeeks: 14,
    goals: ['hypertrophy'], levels: ['intermediate', 'advanced', 'enhanced'],
    phases: [
      { phase: 'accumulation', weeks: 5, startVol: 0.90, endVol: 1.10 },
      { phase: 'intensification', weeks: 4, startVol: 0.85, endVol: 0.95 },
      { phase: 'transmutation', weeks: 2, startVol: 0.75, endVol: 0.85 },
      { phase: 'deload', weeks: 1 },
    ],
    progressionType: 'double',
    intensityProfile: 'aggressive',
    recoveryThreshold: 50,
  },
  {
    id: 'hypertrophy_beginner_10',
    name: 'Гипертрофия базовая 10 нед',
    description: 'Для новичков. Плавное наращивание объёма, частая смена стимула.',
    minWeeks: 8, maxWeeks: 12,
    goals: ['hypertrophy'], levels: ['beginner'],
    phases: [
      { phase: 'accumulation', weeks: 4, startVol: 0.80, endVol: 1.00 },
      { phase: 'intensification', weeks: 3, startVol: 0.80, endVol: 0.90 },
      { phase: 'transmutation', weeks: 2, startVol: 0.70, endVol: 0.80 },
      { phase: 'deload', weeks: 1 },
    ],
    progressionType: 'double',
    intensityProfile: 'conservative',
    recoveryThreshold: 35,
  },
];

// ── Public API ──

export function selectCycleTemplate(
  goal: string,
  level: string,
  weeks: number
): CycleTemplate | null {
  const candidates = CYCLE_TEMPLATES.filter(t =>
    t.goals.includes(goal) &&
    t.levels.includes(level) &&
    t.minWeeks <= weeks &&
    t.maxWeeks >= weeks
  );

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aFit = weeks >= a.minWeeks && weeks <= a.maxWeeks ? 1 : 0;
    const bFit = weeks >= b.minWeeks && weeks <= b.maxWeeks ? 1 : 0;
    if (bFit !== aFit) return bFit - aFit;
    return a.id.length - b.id.length;
  });

  return candidates[0];
}

export function getCycleTemplatesByGoal(goal: string): CycleTemplate[] {
  return CYCLE_TEMPLATES.filter(t => t.goals.includes(goal));
}

export function generateCyclePlan(
  goal: string,
  level: string,
  weeks: number,
  recovery: number
): CyclePlan {
  const template = selectCycleTemplate(goal, level, weeks);

  if (!template) {
    return generateFallbackCycle(goal, level, weeks);
  }

  return generateCyclePlanInternal(template, weeks, goal, level, recovery);
}

function mapToRirPhase(
  phase: MesocyclePhase,
  phaseWeek: number,
  totalPhaseWeeks: number,
  recovery: number
): 'base' | 'build' | 'peak' | 'deload' {
  if (phase === 'deload') return 'deload';
  if (phase === 'peak') return 'peak';

  if (phase === 'transmutation') {
    if (phaseWeek >= totalPhaseWeeks - 1) return 'peak';
    return 'build';
  }

  if (phase === 'intensification') {
    if (phaseWeek <= 1) return 'base';
    return 'build';
  }

  return 'base';
}

function calculateCycleSummary(
  weekPlans: CycleWeekPlan[],
  goal: string,
  level: string
): CycleSummary {
  let totalVol = 0;
  let totalInt = 0;
  let deloadWeeks = 0;
  const phaseCount: Record<string, number> = {};

  for (const wp of weekPlans) {
    totalVol += wp.volumeMultiplier;
    totalInt += wp.intensityMultiplier;
    if (wp.isDeload) deloadWeeks++;
    phaseCount[wp.phase] = (phaseCount[wp.phase] || 0) + 1;
  }

  const n = weekPlans.length;

  return {
    totalWeeks: n,
    avgVolumeMultiplier: n > 0 ? totalVol / n : 0,
    avgIntensityMultiplier: n > 0 ? totalInt / n : 0,
    totalDeloadWeeks: deloadWeeks,
    phaseBreakdown: phaseCount,
    goal,
    level,
  };
}

function generateFallbackCycle(goal: string, level: string, weeks: number): CyclePlan {
  const phases: CyclePhaseDef[] = [
    { phase: 'accumulation', weeks: Math.max(2, Math.round(weeks * 0.4)) },
    { phase: 'intensification', weeks: Math.max(2, Math.round(weeks * 0.3)) },
    { phase: 'transmutation', weeks: Math.max(1, Math.round(weeks * 0.15)) },
    { phase: 'peak', weeks: Math.max(1, Math.round(weeks * 0.1)) },
    { phase: 'deload', weeks: Math.max(1, Math.round(weeks * 0.05)) },
  ];

  const fallbackTemplate: CycleTemplate = {
    id: 'fallback',
    name: 'Авто-цикл',
    description: 'Автоматически сгенерированный цикл на основе распределения фаз.',
    minWeeks: weeks, maxWeeks: weeks,
    goals: [goal], levels: [level],
    phases,
    progressionType: 'double',
    intensityProfile: 'moderate',
    recoveryThreshold: 40,
  };

  return generateCyclePlanInternal(fallbackTemplate, weeks, goal, level, 50);
}

function generateCyclePlanInternal(
  template: CycleTemplate,
  weeks: number,
  goal: string,
  level: string,
  recovery: number
): CyclePlan {
  const weekPlans: CycleWeekPlan[] = [];
  let weekCounter = 0;

  for (const phaseDef of template.phases) {
    for (let pw = 0; pw < phaseDef.weeks; pw++) {
      weekCounter++;
      if (weekCounter > weeks) break;

      const progress = phaseDef.weeks > 1 ? pw / Math.max(1, phaseDef.weeks - 1) : 1;
      const volStart = phaseDef.startVol ?? PHASE_DEFAULTS[phaseDef.phase].volStart;
      const volEnd = phaseDef.endVol ?? PHASE_DEFAULTS[phaseDef.phase].volEnd;
      const intStart = PHASE_DEFAULTS[phaseDef.phase].intStart;
      const intEnd = PHASE_DEFAULTS[phaseDef.phase].intEnd;
      const rirStart = PHASE_DEFAULTS[phaseDef.phase].rirStart;
      const rirEnd = PHASE_DEFAULTS[phaseDef.phase].rirEnd;

      weekPlans.push({
        week: weekCounter,
        phase: phaseDef.phase,
        phaseWeek: pw + 1,
        volumeMultiplier: clamp(volStart + (volEnd - volStart) * progress, 0.3, 1.3),
        intensityMultiplier: clamp(intStart + (intEnd - intStart) * progress, 0.4, 1.0),
        rirBase: Math.round((rirStart + (rirEnd - rirStart) * progress) * 2) / 2,
        rirPhase: mapToRirPhase(phaseDef.phase, pw, phaseDef.weeks, recovery),
        isDeload: phaseDef.phase === 'deload',
        progressionType: template.progressionType,
      });
    }
  }

  return {
    templateId: template.id,
    totalWeeks: weekPlans.length,
    goal,
    level,
    weekPlans,
    summary: calculateCycleSummary(weekPlans, goal, level),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export function getCyclePhaseName(phase: MesocyclePhase): string {
  return PHASE_DEFAULTS[phase].desc;
}
