/**
 * bb-foundation.engine.ts — Основа бодибилдинга (hypertrophy base).
 *
 * Централизует научные принципы роста (Schoenfeld 2010/2016/2017, Israetel RP, Helms 2022)
 * и переводит их в цифры для генератора плана. Используется как единый источник
 * для volume/frequency/exercise/progression/tempo — чтобы все 4 маршрута BB-auto
 * (generic/split, PROF-cycle faithful/adapt) работали из одной модели.
 *
 * Пиллары:
 *  1. Механическое напряжение > метаболический стресс > повреждение (Schoenfeld)
 *  2. Объём = сеты × близость к отказу (RIR) × частота (Israetel MEV/MAV/MRV)
 *  3. Частота 2×/нед оптимальна для синтеза белка (Schoenfeld 2016, JSF 2019)
 *  4. Прогрессия = +вес | +повторы | +сеты при сохранении техники (double progression)
 *  5. Восстановление лимитирует target, PED расширяет MRV но не заменяет стаж
 */

export const HYPERTROPHY_PILLARS = [
  { id: 'tension', label: 'Механическое напряжение', desc: 'Тяжёлые compounds 6-10 повт, RIR 1-2 — главный драйвер. Без напряжения памп не растёт.', icon: '💪' },
  { id: 'stress', label: 'Метаболический стресс', desc: 'Памп-изоляции 12-18 повт, RIR 2-3, короткая пауза 60-90с — наполнение и саркоплазма.', icon: '🩸' },
  { id: 'damage', label: 'Контролируемое повреждение', desc: 'Растянутая позиция (разводка, RDL, incline curl) + эксцентрика 3-4с — триггер, не цель.', icon: '🧬' },
  { id: 'progression', label: 'Прогрессивная перегрузка', desc: 'Double progression: добил повторы до верха → +5% веса. Фиксирует рост без читинга.', icon: '📈' },
  { id: 'recovery', label: 'Восстановление', desc: 'Сон ≥7ч, белок ≥1.6г/кг, HRV/стресс → recoveryScore → целевый объём. Без сна объём режется.', icon: '😴' },
] as const;

// ── Объёмные ориентиры (прямые сеты/нед) — Israetel + Helms, адаптировано под кодовую базу ──
// Диапазоны, не потолок: builder выбирает target внутри по стажу/PED/recovery/goal.

export type BBLevel = 'beginner' | 'intermediate' | 'advanced' | 'enhanced';

export interface VolumeLandmark { mev: number; mavLow: number; mavHigh: number; mrv: number; }

export const VOLUME_LANDMARKS: Record<BBLevel, Record<string, VolumeLandmark>> = {
  beginner: {
    chest: { mev: 8, mavLow: 10, mavHigh: 14, mrv: 16 },
    back: { mev: 10, mavLow: 12, mavHigh: 16, mrv: 18 },
    shoulders: { mev: 6, mavLow: 8, mavHigh: 12, mrv: 14 },
    quads: { mev: 8, mavLow: 10, mavHigh: 14, mrv: 16 },
    hamstrings: { mev: 6, mavLow: 8, mavHigh: 12, mrv: 14 },
    glutes: { mev: 6, mavLow: 8, mavHigh: 12, mrv: 14 },
    calves: { mev: 6, mavLow: 8, mavHigh: 12, mrv: 16 },
    biceps: { mev: 6, mavLow: 8, mavHigh: 12, mrv: 14 },
    triceps: { mev: 6, mavLow: 8, mavHigh: 12, mrv: 14 },
    forearms: { mev: 4, mavLow: 4, mavHigh: 8, mrv: 10 },
    abs: { mev: 4, mavLow: 6, mavHigh: 10, mrv: 12 },
    traps: { mev: 4, mavLow: 6, mavHigh: 10, mrv: 12 },
  },
  intermediate: {
    chest: { mev: 10, mavLow: 12, mavHigh: 18, mrv: 22 },
    back: { mev: 12, mavLow: 16, mavHigh: 22, mrv: 26 },
    shoulders: { mev: 8, mavLow: 10, mavHigh: 16, mrv: 18 },
    quads: { mev: 10, mavLow: 12, mavHigh: 18, mrv: 20 },
    hamstrings: { mev: 8, mavLow: 10, mavHigh: 16, mrv: 18 },
    glutes: { mev: 8, mavLow: 10, mavHigh: 16, mrv: 18 },
    calves: { mev: 8, mavLow: 10, mavHigh: 14, mrv: 16 },
    biceps: { mev: 8, mavLow: 10, mavHigh: 16, mrv: 18 },
    triceps: { mev: 8, mavLow: 10, mavHigh: 16, mrv: 18 },
    forearms: { mev: 4, mavLow: 6, mavHigh: 10, mrv: 12 },
    abs: { mev: 6, mavLow: 8, mavHigh: 12, mrv: 14 },
    traps: { mev: 6, mavLow: 8, mavHigh: 12, mrv: 14 },
  },
  advanced: {
    chest: { mev: 12, mavLow: 14, mavHigh: 20, mrv: 24 },
    back: { mev: 14, mavLow: 18, mavHigh: 26, mrv: 32 },
    shoulders: { mev: 10, mavLow: 12, mavHigh: 18, mrv: 20 },
    quads: { mev: 12, mavLow: 14, mavHigh: 20, mrv: 24 },
    hamstrings: { mev: 10, mavLow: 12, mavHigh: 18, mrv: 20 },
    glutes: { mev: 10, mavLow: 12, mavHigh: 18, mrv: 20 },
    calves: { mev: 10, mavLow: 12, mavHigh: 16, mrv: 18 },
    biceps: { mev: 10, mavLow: 12, mavHigh: 18, mrv: 20 },
    triceps: { mev: 10, mavLow: 12, mavHigh: 18, mrv: 20 },
    forearms: { mev: 6, mavLow: 8, mavHigh: 12, mrv: 14 },
    abs: { mev: 8, mavLow: 10, mavHigh: 14, mrv: 16 },
    traps: { mev: 8, mavLow: 10, mavHigh: 14, mrv: 16 },
  },
  enhanced: {
    chest: { mev: 14, mavLow: 18, mavHigh: 26, mrv: 32 },
    back: { mev: 18, mavLow: 24, mavHigh: 36, mrv: 44 },
    shoulders: { mev: 12, mavLow: 16, mavHigh: 22, mrv: 26 },
    quads: { mev: 14, mavLow: 18, mavHigh: 26, mrv: 32 },
    hamstrings: { mev: 12, mavLow: 16, mavHigh: 22, mrv: 26 },
    glutes: { mev: 12, mavLow: 16, mavHigh: 22, mrv: 26 },
    calves: { mev: 12, mavLow: 14, mavHigh: 18, mrv: 20 },
    biceps: { mev: 12, mavLow: 16, mavHigh: 22, mrv: 26 },
    triceps: { mev: 12, mavLow: 16, mavHigh: 22, mrv: 26 },
    forearms: { mev: 6, mavLow: 8, mavHigh: 14, mrv: 16 },
    abs: { mev: 10, mavLow: 12, mavHigh: 16, mrv: 18 },
    traps: { mev: 10, mavLow: 12, mavHigh: 16, mrv: 18 },
  },
};

export function getLandmark(level: BBLevel, muscle: string): VolumeLandmark | null {
  const table = VOLUME_LANDMARKS[level] ?? VOLUME_LANDMARKS.intermediate;
  return table[muscle] ?? table[muscle.toLowerCase()] ?? null;
}

// ── Частота ──

export const FREQUENCY_TABLE: Record<BBLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 2,
  enhanced: 2,
};

export function optimalFrequency(level: BBLevel, years: number): number {
  if (level === 'beginner' || years < 1) return 1;
  if (level === 'enhanced' && years >= 6) return 2; // 3× без специализации вредит восстановлению
  return FREQUENCY_TABLE[level] ?? 2;
}

// ── Повторы / RIR / темп / отдых ──

export type Phase = 'accumulation' | 'intensification' | 'deload' | 'peaking';

export const REP_RANGES: Record<Phase, { heavy: [number, number]; pump: [number, number] }> = {
  accumulation: { heavy: [6, 10], pump: [12, 18] },
  intensification: { heavy: [4, 8], pump: [10, 15] },
  deload: { heavy: [8, 12], pump: [12, 15] },
  peaking: { heavy: [3, 6], pump: [8, 12] },
};

export const RIR_RANGES: Record<Phase, [number, number]> = {
  accumulation: [2, 3],
  intensification: [1, 2],
  deload: [3, 4],
  peaking: [0, 1],
};

export const TEMPO: Record<Phase, string> = {
  accumulation: '3-1-1-0',
  intensification: '2-1-1-0',
  deload: '3-1-1-0',
  peaking: '2-0-1-0',
};

export const REST_SEC: Record<Phase, { heavy: number; pump: number }> = {
  accumulation: { heavy: 120, pump: 75 },
  intensification: { heavy: 150, pump: 90 },
  deload: { heavy: 120, pump: 60 },
  peaking: { heavy: 180, pump: 90 },
};

// ── Упражнения: иерархия паттернов ──

export const EXERCISE_HIERARCHY: Record<string, string[]> = {
  chest: ['horizontal_push', 'incline_push', 'dip_push', 'decline_push', 'isolation_chest'],
  back: ['horizontal_pull', 'vertical_pull', 'isolation_back', 'isolation_shoulders'],
  quads: ['squat', 'lunge', 'isolation_legs_quad'],
  hamstrings: ['hinge', 'isolation_legs_ham'],
  shoulders: ['vertical_push', 'isolation_shoulders'],
  biceps: ['isolation_arms'],
  triceps: ['isolation_arms'],
  glutes: ['glute_squat', 'hinge'],
};

// ── Проверка основы: аудит плана по пилларам ──

export interface FoundationAudit {
  volumeOk: boolean;
  frequencyOk: boolean;
  tensionOk: boolean;
  stressOk: boolean;
  recoveryOk: boolean;
  warnings: string[];
  score: number; // 0-100
}

export function auditFoundation(input: {
  weeklyVolume: Record<string, number>;
  frequency: Record<string, number>;
  level: BBLevel;
  heavySets: number;
  pumpSets: number;
  recoveryScore: number;
}): FoundationAudit {
  const warnings: string[] = [];
  let score = 100;

  // объём vs MEV/MRV
  for (const [m, sets] of Object.entries(input.weeklyVolume)) {
    const lm = getLandmark(input.level, m);
    if (!lm) continue;
    if (sets < lm.mev) { warnings.push(`${m}: ${sets} < MEV ${lm.mev} — недобор`); score -= 8; }
    if (sets > lm.mrv) { warnings.push(`${m}: ${sets} > MRV ${lm.mrv} — перебор`); score -= 12; }
  }
  // частота
  for (const [m, freq] of Object.entries(input.frequency)) {
    const opt = optimalFrequency(input.level, 3);
    if (freq < opt && !['calves','abs','forearms','traps'].includes(m)) { warnings.push(`${m}: ${freq}×/нед < оптимума ${opt}×`); score -= 5; }
  }
  // tension / stress баланс
  const total = input.heavySets + input.pumpSets;
  if (total > 0) {
    const heavyRatio = input.heavySets / total;
    if (heavyRatio < 0.35) { warnings.push(`Мало тяжёлых сетов ${(heavyRatio*100).toFixed(0)}% — нужно 40-60%`); score -= 6; }
    if (heavyRatio > 0.75) { warnings.push(`Слишком много тяжёлых ${(heavyRatio*100).toFixed(0)}% — риск недовосстановления`); score -= 6; }
  }
  // восстановление
  if (input.recoveryScore < 50) { warnings.push(`Recovery ${input.recoveryScore} — снизь объём`); score -= 10; }

  return { volumeOk: !warnings.some(w=>w.includes('MRV')||w.includes('MEV')), frequencyOk: !warnings.some(w=>w.includes('×/нед')), tensionOk: !warnings.some(w=>w.includes('тяжёлых')), stressOk: true, recoveryOk: input.recoveryScore >= 65, warnings, score: Math.max(0, Math.min(100, score)) };
}
