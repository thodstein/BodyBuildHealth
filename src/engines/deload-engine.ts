/**
 * Unified Deload Engine — единый движок делода.
 *
 * Объединяет три источника разгрузочной логики:
 *   1. detectOvertraining() — 12-маркерный детектор перетренированности (из overtraining-scheduler)
 *   2. autoSchedule() — авто-расписание фаз по цели/уровню (из overtraining-scheduler)
 *   3. generateDeload() — 8-факторный генератор протоколов делода (из genetic-deload-technique)
 *   4. getDeloadRecommendation() — триггеры по recovery/RPE/плато/длительности (из progression)
 *
 * Единый вход: getAutoDeload() — объединяет все триггеры в одно решение.
 *
 * @module deload-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** 8-факторный ввод для генератора делода */
export interface DeloadInput {
  weeksInCycle: number;
  fatigueScore: number;
  priScore: number;
  sleepScore: number;
  hrvSuppression: number;
  jointPain: number;
  motivation: number;
  gymPerformance: 'improving' | 'stable' | 'declining';
}

export interface DeloadProtocol {
  type: 'standard' | 'active' | 'complete' | 'taper';
  weeks: number;
  volumePercent: number;
  intensityPercent: number;
  frequencyDays: number;
  dailyActivities: string[];
  nutritionAdjustment: string;
  expectedOutcome: string;
}

/** 12-маркерный ввод для детектора перетренированности */
export interface OvertrainingInput {
  performanceDecline: number;
  hrvSuppression: number;
  restingHRIncrease: number;
  sleepHours: number;
  sleepQuality: number;
  moodDisturbance: boolean;
  appetiteLoss: boolean;
  frequentIllness: boolean;
  jointPainIncrease: boolean;
  trainingMotivation: number;
  rpeInflation: boolean;
  recoveryTimeExtension: boolean;
  libidoDecrease: boolean;
}

export interface OvertrainingOutput {
  totalScore: number;
  maxScore: number;
  riskLevel: 'none' | 'mild' | 'moderate' | 'severe' | 'critical';
  riskPercent: number;
  markers: { name: string; score: number; maxScore: number; status: 'normal' | 'warning' | 'critical' }[];
  recommendation: string;
  deloadUrgency: 'none' | 'advisory' | 'recommended' | 'required' | 'urgent';
  estimatedRecoveryWeeks: number;
}

/** Авто-расписание фаз */
export interface AutoScheduleInput {
  goal: 'strength' | 'hypertrophy' | 'peaking' | 'recomposition';
  level: 'beginner' | 'intermediate' | 'advanced';
  weeksUntilGoal: number;
  currentWeek: number;
  fatigueLevel: number;
  recoveryLevel: number;
  overtrainingRisk: number;
  acwr?: number | null;
  monotony?: number | null;
  strain?: number | null;
}

export interface ScheduledWeek {
  week: number;
  phase: 'accumulation' | 'intensification' | 'peaking' | 'deload' | 'active_rest';
  volumePercent: number;
  intensityPercent: number;
  rpeTarget: number;
  rirTarget: number;
  sessionsPerWeek: number;
  notes: string;
}

export interface AutoScheduleOutput {
  weeks: ScheduledWeek[];
  deloadWeeks: number[];
  peakWeek: number | null;
  warnings: string[];
}

/** Единый ввод для авто-делаода */
export interface AutoDeloadInput {
  // из overtraining-scheduler
  overtraining: OvertrainingInput;
  // из genetic-deload-technique
  deloadFactors: DeloadInput;
  // из progression + autoSchedule
  weeksSinceDeload: number;
  currentRPE: number;
  recoveryScore: number;
  // авто-расписание
  schedule: AutoScheduleInput;
  // sRPE
  acwr: number;
  monotony: number;
  strain: number;
}

export interface AutoDeloadOutput {
  shouldDeload: boolean;
  urgency: 'none' | 'advisory' | 'recommended' | 'required' | 'urgent';
  protocol: DeloadProtocol;
  overtrainingResult: OvertrainingOutput;
  schedule: AutoScheduleOutput;
  reasons: string[];
  warnings: string[];
  estimatedRecoveryWeeks: number;
}

/** Запись лога силы (для getDeloadRecommendation) */
interface StrengthLogEntry {
  name?: string;
  date?: string;
  estimated1RM?: number;
  weight?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Overtraining Detection (12 markers)
// ═══════════════════════════════════════════════════════════════════════════

export function detectOvertraining(input: OvertrainingInput): OvertrainingOutput {
  const markers: OvertrainingOutput['markers'] = [];

  let perfScore = 0;
  if (input.performanceDecline < -5) perfScore = 2;
  else if (input.performanceDecline < -2) perfScore = 1;
  if (input.performanceDecline < -10) perfScore = 3;
  markers.push({ name: 'Падение 1RM', score: perfScore, maxScore: 3, status: perfScore >= 2 ? 'critical' : perfScore >= 1 ? 'warning' : 'normal' });

  let hrvScore = 0;
  if (input.hrvSuppression > 15) hrvScore = 1;
  if (input.hrvSuppression > 25) hrvScore = 2;
  if (input.hrvSuppression > 35) hrvScore = 3;
  markers.push({ name: 'Подавление HRV', score: hrvScore, maxScore: 3, status: hrvScore >= 2 ? 'critical' : hrvScore >= 1 ? 'warning' : 'normal' });

  let hrScore = 0;
  if (input.restingHRIncrease > 5) hrScore = 1;
  if (input.restingHRIncrease > 10) hrScore = 2;
  if (input.restingHRIncrease > 15) hrScore = 3;
  markers.push({ name: 'Пульс покоя ↑', score: hrScore, maxScore: 3, status: hrScore >= 2 ? 'critical' : hrScore >= 1 ? 'warning' : 'normal' });

  let sleepScore = 0;
  if (input.sleepHours < 6.5) sleepScore += 1;
  if (input.sleepHours < 5) sleepScore += 1;
  if (input.sleepQuality <= 2) sleepScore += 1;
  markers.push({ name: 'Нарушение сна', score: sleepScore, maxScore: 3, status: sleepScore >= 2 ? 'critical' : sleepScore >= 1 ? 'warning' : 'normal' });

  const binaryScore = (v: boolean) => v ? 3 : 0;
  markers.push({ name: 'Настроение', score: binaryScore(input.moodDisturbance), maxScore: 3, status: input.moodDisturbance ? 'warning' : 'normal' });
  markers.push({ name: 'Аппетит', score: binaryScore(input.appetiteLoss), maxScore: 3, status: input.appetiteLoss ? 'warning' : 'normal' });
  markers.push({ name: 'Частые болезни', score: binaryScore(input.frequentIllness), maxScore: 3, status: input.frequentIllness ? 'critical' : 'normal' });
  markers.push({ name: 'Боль в суставах', score: binaryScore(input.jointPainIncrease), maxScore: 3, status: input.jointPainIncrease ? 'warning' : 'normal' });
  markers.push({ name: 'Мотивация', score: input.trainingMotivation <= 2 ? 3 : input.trainingMotivation <= 3 ? 1 : 0, maxScore: 3, status: input.trainingMotivation <= 2 ? 'warning' : 'normal' });
  markers.push({ name: 'RPE инфляция', score: binaryScore(input.rpeInflation), maxScore: 3, status: input.rpeInflation ? 'critical' : 'normal' });
  markers.push({ name: 'Восстановление', score: binaryScore(input.recoveryTimeExtension), maxScore: 3, status: input.recoveryTimeExtension ? 'critical' : 'normal' });
  markers.push({ name: 'Либидо', score: binaryScore(input.libidoDecrease), maxScore: 3, status: input.libidoDecrease ? 'warning' : 'normal' });

  const total = markers.reduce((s, m) => s + m.score, 0);
  const max = 36;

  let riskLevel: OvertrainingOutput['riskLevel'] = 'none';
  if (total >= 25) riskLevel = 'critical';
  else if (total >= 18) riskLevel = 'severe';
  else if (total >= 12) riskLevel = 'moderate';
  else if (total >= 6) riskLevel = 'mild';

  let deloadUrgency: OvertrainingOutput['deloadUrgency'] = 'none';
  if (total >= 25) deloadUrgency = 'urgent';
  else if (total >= 18) deloadUrgency = 'required';
  else if (total >= 12) deloadUrgency = 'recommended';
  else if (total >= 6) deloadUrgency = 'advisory';

  const recoveryWeeks = total >= 25 ? 3 : total >= 18 ? 2 : total >= 12 ? 1 : 0;

  return {
    totalScore: total,
    maxScore: max,
    riskLevel,
    riskPercent: Math.round((total / max) * 100),
    markers,
    recommendation: total >= 18
      ? `Критические признаки перетренированности (${total}/${max}). Немедленный deload ${recoveryWeeks} нед.`
      : total >= 12
        ? `Умеренные признаки (${total}/${max}). Deload ${recoveryWeeks} нед, снижение объёма на 40%.`
        : total >= 6
          ? `Лёгкие признаки (${total}/${max}). Мониторинг, снижение интенсивности.`
          : 'Признаков перетренированности нет. Продолжайте программу.',
    deloadUrgency,
    estimatedRecoveryWeeks: recoveryWeeks,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Auto-Schedule (purpose × level → weekly phases)
// ═══════════════════════════════════════════════════════════════════════════

export function autoSchedule(input: AutoScheduleInput): AutoScheduleOutput {
  const weeks: ScheduledWeek[] = [];
  const deloadWeeks: number[] = [];
  const warnings: string[] = [];
  let peakWeek: number | null = null;

  let w = input.currentWeek + 1;
  const totalWeeks = input.weeksUntilGoal;
  const acwr = input.acwr ?? null;
  const monotony = input.monotony ?? null;
  const strain = input.strain ?? null;

  const pattern = input.goal === 'peaking'
    ? ['accumulation', 'accumulation', 'intensification', 'deload', 'intensification', 'peaking', 'peaking', 'deload']
    : input.goal === 'strength'
      ? ['accumulation', 'accumulation', 'accumulation', 'deload', 'intensification', 'intensification', 'intensification', 'deload']
      : ['accumulation', 'accumulation', 'accumulation', 'accumulation', 'deload', 'accumulation', 'accumulation', 'deload'];

  let deloadFreq = input.level === 'beginner' ? 6 : input.level === 'intermediate' ? 5 : 4;

  if (acwr !== null && acwr > 1.5) {
    deloadFreq = Math.max(3, deloadFreq - 2);
    warnings.push(`ACWR ${acwr.toFixed(2)} > 1.5 — делоды учащены (каждые ${deloadFreq} нед вместо ${input.level === 'beginner' ? 6 : input.level === 'intermediate' ? 5 : 4})`);
  } else if (acwr !== null && acwr > 1.3) {
    deloadFreq = Math.max(3, deloadFreq - 1);
    warnings.push(`ACWR ${acwr.toFixed(2)} > 1.3 — делоды учащены (каждые ${deloadFreq} нед)`);
  }

  if (input.overtrainingRisk > 50 && deloadFreq > 3) {
    deloadFreq = Math.max(3, deloadFreq - 1);
  }

  for (let i = 0; i < totalWeeks; i++) {
    let phase = pattern[i % pattern.length] as ScheduledWeek['phase'];

    if ((input.overtrainingRisk > 50 || (acwr !== null && acwr > 1.5) || (strain !== null && strain > 1500)) && i === 0) {
      phase = 'deload';
      if (input.overtrainingRisk > 50) warnings.push(`Неделя ${w}: принудительный deload (риск перетрена ${input.overtrainingRisk}%)`);
      if (acwr !== null && acwr > 1.5) warnings.push(`Неделя ${w}: принудительный deload (ACWR ${acwr.toFixed(2)} — опасная перегрузка)`);
      if (strain !== null && strain > 1500) warnings.push(`Неделя ${w}: принудительный deload (strain ${Math.round(strain)} > 1500)`);
    }

    if (w % deloadFreq === 0 && phase !== 'deload') {
      phase = 'deload';
    }

    const params: Record<string, { vol: number; int: number; rpe: number; rir: number; sesh: number; note: string }> = {
      accumulation: { vol: 100, int: 70, rpe: 6.5, rir: 3, sesh: input.level === 'beginner' ? 3 : 4, note: 'Накопление объёма. Субмаксимальные веса, много подсобки.' },
      intensification: { vol: 75, int: 83, rpe: 8, rir: 1.5, sesh: input.level === 'beginner' ? 3 : 4, note: 'Рост интенсивности. Снижение объёма, увеличение весов.' },
      peaking: { vol: 45, int: 90, rpe: 9, rir: 0.5, sesh: 3, note: 'Максимальная специфика. Минимум объёма, максимум веса.' },
      deload: { vol: 40, int: 55, rpe: 5.5, rir: 4, sesh: 2, note: 'Восстановление ЦНС и суставов. Лёгкие веса, мобильность.' },
      active_rest: { vol: 20, int: 40, rpe: 4, rir: 6, sesh: 2, note: 'Активный отдых. Только лёгкое кардио и мобильность.' },
    };

    const p = params[phase];

    let volMod = 1.0;
    if (input.fatigueLevel > 0.7) volMod = Math.min(volMod, 0.8);
    if (input.recoveryLevel < 0.3) volMod = Math.min(volMod, 0.7);
    if (acwr !== null && acwr > 1.5) volMod = Math.min(volMod, 0.6);
    else if (acwr !== null && acwr > 1.3) volMod = Math.min(volMod, 0.8);
    if (monotony !== null && monotony > 2) volMod = Math.min(volMod, 0.75);

    let rpeMod = 1.0;
    let rirMod = 1.0;
    if (acwr !== null && acwr > 1.5) { rpeMod = 0.85; rirMod = 1.5; }
    else if (acwr !== null && acwr > 1.3) { rpeMod = 0.9; rirMod = 1.3; }
    if (monotony !== null && monotony > 2) { rpeMod = Math.min(rpeMod, 0.9); rirMod = Math.max(rirMod, 1.3); }

    weeks.push({
      week: w,
      phase,
      volumePercent: Math.round(p.vol * volMod),
      intensityPercent: Math.round(p.int * rpeMod),
      rpeTarget: Math.round(p.rpe * rpeMod * 10) / 10,
      rirTarget: Math.round(p.rir * rirMod * 10) / 10,
      sessionsPerWeek: p.sesh,
      notes: p.note,
    });

    if (phase === 'deload') deloadWeeks.push(w);
    if (phase === 'peaking' && !peakWeek) peakWeek = w;

    w++;
  }

  return { weeks, deloadWeeks, peakWeek, warnings };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Deload Protocol Generator (8 fatigue markers → protocol)
// ═══════════════════════════════════════════════════════════════════════════

export function generateDeload(input: DeloadInput): DeloadProtocol {
  let deloadSignals = 0;

  if (input.weeksInCycle >= 8) deloadSignals += 2;
  else if (input.weeksInCycle >= 5) deloadSignals++;
  if (input.fatigueScore > 0.75) deloadSignals += 2;
  else if (input.fatigueScore > 0.6) deloadSignals++;
  if (input.priScore < 0.35) deloadSignals += 2;
  else if (input.priScore < 0.5) deloadSignals++;
  if (input.hrvSuppression > 20) deloadSignals++;
  if (input.jointPain > 6) deloadSignals += 2;
  else if (input.jointPain > 4) deloadSignals++;
  if (input.motivation < 3) deloadSignals++;
  if (input.gymPerformance === 'declining') deloadSignals += 2;
  if (input.sleepScore < 40) deloadSignals++;

  if (deloadSignals >= 8) {
    return {
      type: 'complete', weeks: 1,
      volumePercent: 20, intensityPercent: 40, frequencyDays: 2,
      dailyActivities: ['Прогулка 30 мин', 'Мобильность 15 мин', 'Дыхание 4-7-8', 'Foam rolling 10 мин'],
      nutritionAdjustment: 'Поддерживающие калории. Белок 1.8 г/кг.',
      expectedOutcome: `Высокий сигнал deload (${deloadSignals}/13). Полный отдых от нагрузок.`,
    };
  }

  if (deloadSignals >= 5) {
    return {
      type: 'standard', weeks: 1,
      volumePercent: 40, intensityPercent: 55, frequencyDays: 3,
      dailyActivities: ['Лёгкое кардио 20 мин', 'Мобильность', 'Растяжка', 'Технические упражнения без веса'],
      nutritionAdjustment: 'Поддерживающие калории. Белок 2.0 г/кг.',
      expectedOutcome: `Умеренный сигнал (${deloadSignals}/13). Снижение объёма на 60%.`,
    };
  }

  if (deloadSignals >= 3) {
    return {
      type: 'active', weeks: 1,
      volumePercent: 55, intensityPercent: 65, frequencyDays: 4,
      dailyActivities: ['Основные движения 60%', 'Аксессуары 50% объёма', 'Мобильность'],
      nutritionAdjustment: 'Поддерживающие. Можно небольшой дефицит.',
      expectedOutcome: `Лёгкий сигнал (${deloadSignals}/13). Активный deload — снижение на 40%.`,
    };
  }

  return {
    type: 'taper', weeks: 1,
    volumePercent: 70, intensityPercent: 80, frequencyDays: 4,
    dailyActivities: ['Снижение объёма на 30%', 'Сохранение интенсивности', 'Фокус на основные движения'],
    nutritionAdjustment: 'Поддерживающие калории.',
    expectedOutcome: `Минимальный сигнал (${deloadSignals}/13). Микро-deload/taper.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3b. PRO Deload Protocols — 4 структурированных протокола с расписанием
// ═══════════════════════════════════════════════════════════════════════════

export interface DeloadDay {
  day: number;
  type: 'rest' | 'cardio_light' | 'mobility' | 'light_weights' | 'technique' | 'pump' | 'stretching' | 'massage';
  description: string;
  exercises?: { name: string; sets: number; reps: string; intensityPct?: number }[];
  notes?: string;
}

export interface StructuredDeload {
  protocolName: string;
  protocolType: 'full' | 'backoff' | 'active' | 'minimal';
  days: number;
  volumeReductionPct: number;
  intensityReductionPct: number;
  rirTarget: number;
  weeklySchedule: DeloadDay[];
  warnings: string[];
  expectedRecovery: string;
  contraindications: string[];
}

/** 4 PRO-протокола делода */
export const DELOAD_PROTOCOLS: Record<string, StructuredDeload> = {
  full: {
    protocolName: 'Полный делод (ЦНС + суставы)',
    protocolType: 'full',
    days: 7,
    volumeReductionPct: 60,
    intensityReductionPct: 10,
    rirTarget: 4,
    weeklySchedule: [
      { day: 1, type: 'rest', description: 'Полный отдых. Никаких тренировок.', notes: 'Сон +1 час, баня/сауна' },
      { day: 2, type: 'mobility', description: 'Мобильность 20-30 мин. Ролл, растяжка.', notes: 'Фокус на проблемные зоны (плечи/таз/голеностоп)' },
      { day: 3, type: 'cardio_light', description: 'Лёгкое кардио 20 мин (ходьба 120 уд/мин). Растяжка 15 мин.', notes: 'ЧСС ≤ 120 уд/мин. Никакой нагрузки на суставы' },
      { day: 4, type: 'rest', description: 'Полный отдых.', notes: 'Массаж при возможности' },
      { day: 5, type: 'technique', description: 'Техническая работа. Compound 50% 1ПМ × 3×3, RIR 4.', exercises: [
        { name: 'Присед (техника)', sets: 3, reps: '3', intensityPct: 50 },
        { name: 'Жим (техника)', sets: 3, reps: '3', intensityPct: 50 },
        { name: 'Тяга (техника)', sets: 3, reps: '3', intensityPct: 50 },
      ], notes: 'Только техника. Никакого отказа. Темп 3-0-3-0.' },
      { day: 6, type: 'stretching', description: 'Растяжка 30 мин. Дыхание.', notes: 'Фасциальный релиз' },
      { day: 7, type: 'massage', description: 'Лёгкое кардио 15 мин + массаж/ролл.', notes: 'Оценка готовности к возврату' },
    ],
    warnings: ['Не выполнять никаких отказных подходов', 'Снизить шаги до 5000/день', 'Исключить алкоголь'],
    expectedRecovery: 'Восстановление ЦНС на 80-100% через 7 дней. Суперкомпенсация на 8-10 день.',
    contraindications: ['Неделя перед соревнованиями (использовать back-off)', 'ACWR < 0.8 (недотренированность — не нужен)'],
  },

  backoff: {
    protocolName: 'Back-off делод (перед пиком / поддержание)',
    protocolType: 'backoff',
    days: 5,
    volumeReductionPct: 30,
    intensityReductionPct: 5,
    rirTarget: 2,
    weeklySchedule: [
      { day: 1, type: 'light_weights', description: 'Compound 70% 1ПМ × 3×5, RIR 2. Без подсобки.', exercises: [
        { name: 'Присед', sets: 3, reps: '5', intensityPct: 70 },
      ], notes: 'Только база. Восстановление без потери тонуса.' },
      { day: 2, type: 'light_weights', description: 'Жим 70% × 3×5 + тяга 70% × 2×5, RIR 2.', exercises: [
        { name: 'Жим лёжа', sets: 3, reps: '5', intensityPct: 70 },
        { name: 'Тяга штанги', sets: 2, reps: '5', intensityPct: 70 },
      ] },
      { day: 3, type: 'rest', description: 'Отдых. Мобильность 15 мин (опционально).' },
      { day: 4, type: 'light_weights', description: 'Compound 75% 1ПМ × 2×3, RIR 2.', exercises: [
        { name: 'Присед', sets: 2, reps: '3', intensityPct: 75 },
        { name: 'Жим', sets: 2, reps: '3', intensityPct: 75 },
        { name: 'Тяга', sets: 2, reps: '3', intensityPct: 75 },
      ] },
      { day: 5, type: 'cardio_light', description: 'Лёгкое кардио 15 мин. Оценка готовности.' },
    ],
    warnings: ['Не повышать интенсивность выше 75%', 'Выполнять подходы свежим'],
    expectedRecovery: 'Поддержание нейромышечного тонуса. Готовность к пику через 5 дней.',
    contraindications: ['Сильная ЦНС-усталость (использовать full deload)', 'Травма (нужен active)'],
  },

  active: {
    protocolName: 'Активное восстановление (травмы / низкая готовность)',
    protocolType: 'active',
    days: 7,
    volumeReductionPct: 50,
    intensityReductionPct: 10,
    rirTarget: 4,
    weeklySchedule: [
      { day: 1, type: 'mobility', description: 'Мобильность 20 мин + лёгкие машины 2×15, RIR 4.', exercises: [
        { name: 'Разгибание ног в тренажёре', sets: 2, reps: '15' },
        { name: 'Тяга верхнего блока', sets: 2, reps: '15' },
      ], notes: 'Без осевой нагрузки. Машины + блоки.' },
      { day: 2, type: 'cardio_light', description: 'Ходьба 30 мин. Растяжка 15 мин.' },
      { day: 3, type: 'light_weights', description: 'Изоляция 3×12-15, RIR 4.', exercises: [
        { name: 'Жим гантелей под углом', sets: 3, reps: '12-15' },
        { name: 'Тяга гантели', sets: 3, reps: '12-15' },
        { name: 'Сгибание ног', sets: 3, reps: '12-15' },
      ], notes: 'Только изоляция. Пампинг без отказа.' },
      { day: 4, type: 'rest', description: 'Отдых.' },
      { day: 5, type: 'pump', description: 'Пампинг-сессия 30 мин. Кровоток в целевые группы.', exercises: [
        { name: 'Разводки гантелей', sets: 3, reps: '15-20' },
        { name: 'Бицепс со штангой', sets: 3, reps: '15' },
        { name: 'Трицепс на блоке', sets: 3, reps: '15' },
      ] },
      { day: 6, type: 'stretching', description: 'Растяжка + ролл 30 мин. Дыхание.' },
      { day: 7, type: 'massage', description: 'Ходьба 20 мин + массаж. Оценка готовности.' },
    ],
    warnings: ['Исключить compound движения с осевой нагрузкой', 'ЧСС не выше 130'],
    expectedRecovery: 'Снижение мышечной боли через 3-4 дня, полное восстановление через 7 дней.',
    contraindications: ['Перед соревнованиями (использовать back-off)', 'После длительного перерыва (начинать с разминки)'],
  },

  minimal: {
    protocolName: 'Микро-разгрузка (ACWR / перегрузка без усталости)',
    protocolType: 'minimal',
    days: 5,
    volumeReductionPct: 20,
    intensityReductionPct: 0,
    rirTarget: 3,
    weeklySchedule: [
      { day: 1, type: 'light_weights', description: 'Обычный сплит, но −20% подходов, RIR 3.', notes: 'Сохранить интенсивность (80-85% 1ПМ) при сниженном объёме' },
      { day: 2, type: 'light_weights', description: 'Обычный сплит, −20% подходов, RIR 3.', notes: 'Убрать подсобку на 50%' },
      { day: 3, type: 'rest', description: 'Отдых.' },
      { day: 4, type: 'light_weights', description: 'Обычный сплит, −10% подходов, RIR 2.', notes: 'Возврат к нормальному объёму на 50%' },
      { day: 5, type: 'cardio_light', description: 'Лёгкое кардио + оценка.' },
    ],
    warnings: ['Не снижать вес на базовых движениях', 'Следить за RIR — не подходить к отказу'],
    expectedRecovery: 'Лёгкая разгрузка. Возврат к 100% объёму через 5 дней.',
    contraindications: ['Сильная усталость — нужен full deload'],
  },
};

/** Выбрать протокол делода по контексту */
export function selectDeloadProtocol(ctx: {
  acwr: number;
  weeksSinceDeload: number;
  fatigue: number;
  recovery: number;
  hasCompetitionSoon: boolean;
  jointPain: boolean;
  cnsFatigue: boolean;
  goal: string;
}): StructuredDeload {
  const s = ctx;

  // Полный делод: ЦНС усталость, ACWR > 1.5, 8+ нед без делода
  if (s.cnsFatigue || s.weeksSinceDeload >= 8 || (s.acwr > 1.5 && s.fatigue >= 7)) {
    return DELOAD_PROTOCOLS.full;
  }

  // Активное восстановление: травмы, recovery < 50
  if (s.jointPain || s.recovery < 50) {
    return DELOAD_PROTOCOLS.active;
  }

  // Back-off: перед соревнованиями или ACWR 1.3-1.5
  if (s.hasCompetitionSoon || (s.acwr > 1.3 && s.fatigue >= 5)) {
    return DELOAD_PROTOCOLS.backoff;
  }

  // Микро-разгрузка: лёгкий ACWR или профилактика
  return DELOAD_PROTOCOLS.minimal;
}

/** Сформировать план делода в формате дней */
export function buildDeloadWeek(ctx: {
  acwr: number; weeksSinceDeload: number; fatigue: number; recovery: number;
  hasCompetitionSoon: boolean; jointPain: boolean; cnsFatigue: boolean; goal: string;
}): StructuredDeload {
  return selectDeloadProtocol(ctx);
}

export function getDeloadChecklist(protocol: DeloadProtocol): string[] {
  const checklist: string[] = [
    'Снизить количество рабочих подходов',
    'Исключить отказные подходы (RPE ≤ 7)',
    'Увеличить сон на 1 час',
    'Увеличить калории до поддерживающих (если на дефиците)',
  ];

  if (protocol.type === 'complete') {
    checklist.push('Полный отдых от тренажёрного зала');
    checklist.push('Массаж / физиотерапия при болях');
    checklist.push('Медитация / дыхательные практики');
  }

  if (protocol.type === 'standard') {
    checklist.push('Заменить тяжёлые compound на machine вариации');
    checklist.push('Tempo работа (3-0-3-0)');
  }

  return checklist;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Progression-based Deload Recommendation
// ═══════════════════════════════════════════════════════════════════════════

export function getDeloadRecommendation(
  logs: StrengthLogEntry[],
  currentRPE: number,
  weeksSinceDeload: number,
  recoveryScore: number
): { shouldDeload: boolean; reason: string } {
  if (recoveryScore < 40) return { shouldDeload: true, reason: `Восстановление ${recoveryScore}% < 40 — рекомендуется делоад` };
  if (weeksSinceDeload >= 8) return { shouldDeload: true, reason: `${weeksSinceDeload} недель без делаода — плановый делоад` };
  if (currentRPE >= 9.5) return { shouldDeload: true, reason: `RPE ${currentRPE} ≥ 9.5 — делоад` };

  const chrono = [...logs].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const plateauExercises = chrono.filter((l, i, arr) => {
    if (i === 0) return false;
    const cur = l.estimated1RM ?? 0;
    const prev = arr[i - 1].estimated1RM ?? 0;
    return Math.abs(cur - prev) < 0.5;
  });
  if (plateauExercises.length >= 3) return { shouldDeload: true, reason: `Плато по ${plateauExercises.length} упражнениям — делоад для суперкомпенсации` };

  return { shouldDeload: false, reason: '' };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Unified Auto-Deload (all triggers combined)
// ═══════════════════════════════════════════════════════════════════════════

export function getAutoDeload(input: AutoDeloadInput): AutoDeloadOutput {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const overtrainingResult = detectOvertraining(input.overtraining);
  const protocol = generateDeload(input.deloadFactors);
  const schedule = autoSchedule(input.schedule);

  // Собираем триггеры со всех трёх движков
  let totalTriggers = 0;

  // Триггер 1: перетренированность (12 маркеров)
  if (overtrainingResult.riskPercent >= 50) {
    totalTriggers += 3;
    reasons.push(`Перетрен: ${overtrainingResult.riskPercent}% (${overtrainingResult.totalScore}/${overtrainingResult.maxScore})`);
  } else if (overtrainingResult.riskPercent >= 25) {
    totalTriggers += 2;
    reasons.push(`Признаки перетрена: ${overtrainingResult.riskPercent}%`);
  } else if (overtrainingResult.riskPercent >= 12) {
    totalTriggers += 1;
    reasons.push(`Лёгкие признаки перетрена: ${overtrainingResult.riskPercent}%`);
  }

  // Триггер 2: recovery/pRPE/плато/длительность (из progression)
  const deloadRec = getDeloadRecommendation([], input.currentRPE, input.weeksSinceDeload, input.recoveryScore);
  if (deloadRec.shouldDeload) {
    totalTriggers += 1;
    reasons.push(deloadRec.reason);
  }

  // Триггер 3: делод-факторы (8 сигналов)
  if (protocol.type === 'complete') {
    totalTriggers += 3;
    reasons.push(`Высокий сигнал делода: тип ${protocol.type}, объём ${protocol.volumePercent}%`);
  } else if (protocol.type === 'standard') {
    totalTriggers += 2;
    reasons.push(`Умеренный сигнал делода: тип ${protocol.type}, объём ${protocol.volumePercent}%`);
  } else if (protocol.type === 'active') {
    totalTriggers += 1;
    reasons.push(`Лёгкий сигнал делода: тип ${protocol.type}`);
  }

  // Триггер 4: sRPE ACWR
  if (input.acwr > 1.5) {
    totalTriggers += 2;
    reasons.push(`ACWR ${input.acwr.toFixed(2)} — опасная зона перегрузки`);
    warnings.push('Немедленное снижение объёма: ACWR > 1.5');
  } else if (input.acwr > 1.3) {
    totalTriggers += 1;
    reasons.push(`ACWR ${input.acwr.toFixed(2)} — зона осторожности`);
  }

  // Триггер 5: монотонность/strain
  if (input.monotony > 2 || input.strain > 1000) {
    totalTriggers += 1;
    reasons.push(`Монотонность ${input.monotony.toFixed(1)}, strain ${Math.round(input.strain)} — риск перетрена от однообразия`);
  }

  // Определяем итоговую срочность
  let urgency: AutoDeloadOutput['urgency'] = 'none';
  let shouldDeload = false;

  if (totalTriggers >= 6) { urgency = 'urgent'; shouldDeload = true; }
  else if (totalTriggers >= 4) { urgency = 'required'; shouldDeload = true; }
  else if (totalTriggers >= 2) { urgency = 'recommended'; shouldDeload = true; }
  else if (totalTriggers >= 1) { urgency = 'advisory'; shouldDeload = false; }

  const estWeeks = Math.max(
    overtrainingResult.estimatedRecoveryWeeks,
    protocol.weeks,
    totalTriggers >= 6 ? 2 : totalTriggers >= 4 ? 1 : 0
  );

  return {
    shouldDeload,
    urgency,
    protocol,
    overtrainingResult,
    schedule,
    reasons,
    warnings,
    estimatedRecoveryWeeks: estWeeks,
  };
}
