/**
 * cardio.engine.ts — кардио для рельефа/восстановления/ЖСС (Этап T7, NEW + Раунды CARDIO).
 * Zone 2 (липолиз, восстановление) и HIIT (короткий высокий стимул).
 * Интеграция с PAL/nutrition.engine — READ-only (сожжённые ккал).
 *
 * Расширение (CardioCycle): многонедельный цикл с фазами, недельными объёмами,
 * делодами, taper/peak перед соревнованиями, адаптацией к силовому плану
 * и привязкой к PL/BB макроциклу. Полная спецификация: docs/CARDIO-CYCLE-INTEGRATION-PLAN.md
 */
import { newId } from '../user-program/user-program.types';
import type { HeartZone, VdotResult, CardioCtlPoint } from './cardio-physiology.engine';
import {
  cardioHeartZones,
  maxHrClassic,
  maxHrTanaka,
  maxHrGulati,
  lthrZones,
  estimateLTHRFrom30Min,
  estimateZonesFromFieldTests,
  cyclingPowerZones,
  runningVdot,
  banisterTrimp,
  CARDIO_TRIMP_FACTOR,
  sessionTrimpEstimate,
  weeklyTrimp,
  cardioCtlSeries,
  cardioMonotonyStrain,
  cardioAcwrEwma,
  dailyTrimpFromLogEntry,
  dailyTrimpMap,
  cardioFactCtlSeries,
  cardioHrDrift,
} from './cardio-physiology.engine';
import { addDaysIso, todayLocalIso, toLocalIso } from './cardio-date-utils.engine';
export { addDaysIso, todayLocalIso, toLocalIso } from './cardio-date-utils.engine';
export type { HeartZone, VdotResult, CardioCtlPoint, CardioFactCtlPoint } from './cardio-physiology.engine';
// PRO-уровень: новые движки (эпики A/B/D/E/F/G) — реэкспорт для UI, без циклов (только типы внутрь).
import type { IndividualTaperPlan } from './cardio-taper-pro.engine';
export type { FieldTestSource, FieldTestInput, PersonalZones, CpEffort, CpFit, FieldTestLogEntry, LatestFieldTestMetrics } from './cardio-field-tests.engine';
export { ftpFrom20MinTest, criticalPowerFrom3And12, criticalPowerFromEfforts, talkTestZone2Ceiling, zonesFromTalkTest, personalZones, recommendFieldTest, validateFieldTestInput, appendFieldTestLog, responderFromLog, loadFieldTestLog, saveFieldTestLogEntry, removeFieldTestLogEntry, clearFieldTestLog, latestFieldTestMetrics, FIELD_TEST_LOG_KEY } from './cardio-field-tests.engine';
export type { DailyLoad, PmcPoint, HrDriftContext } from './cardio-pmc.engine';
export { dailyPmcSeries, hrTss, powerTss, runTss, correctHrForDrift, driftCorrectedTss, tssRampRate, interpretTsb } from './cardio-pmc.engine';
export type { TidModel, TimeInZones, SeasonPhase } from './cardio-tid.engine';
export { tidZoneOf, timeInZones, polarizationIndex, classifyTid, tidAdvice, phasedTidTarget, tidDistanceToTarget } from './cardio-tid.engine';
export type { DecouplingLevel, DecouplingResult, DurabilityPoint } from './cardio-durability.engine';
export { aerobicDecoupling, efficiencyPowerHr, efficiencyPaceHr, durabilityTrend, responderClassification, durabilityDurationTarget } from './cardio-durability.engine';
export type { TaperDecay, FatigueClass, PreTaperState, IndividualTaperPlan } from './cardio-taper-pro.engine';
export { exponentialTaperMult, stepTaperMult, recommendTaperDecay, individualizedTaperPlan, performanceGainEstimate, taperCutFromCycle } from './cardio-taper-pro.engine';
export type { HeatContext, SessionGap, TimingInput, InterferenceV2Input, InterferenceV2Result } from './cardio-safety.engine';
export { heatAltitudeHrAdd, hydrationAdvice, cardioTimingPenalty, cardioInterferenceV2 } from './cardio-safety.engine';
export {
  cardioHeartZones,
  maxHrClassic,
  maxHrTanaka,
  maxHrGulati,
  lthrZones,
  estimateLTHRFrom30Min,
  estimateZonesFromFieldTests,
  cyclingPowerZones,
  runningVdot,
  banisterTrimp,
  CARDIO_TRIMP_FACTOR,
  sessionTrimpEstimate,
  weeklyTrimp,
  cardioCtlSeries,
  cardioMonotonyStrain,
  cardioAcwrEwma,
  dailyTrimpFromLogEntry,
  dailyTrimpMap,
  cardioFactCtlSeries,
  cardioHrDrift,
} from './cardio-physiology.engine';

// ─── Базовые типы (обратно-совместимо с T7) ───

export type CardioType = 'zone2' | 'hiit' | 'miss' | 'recovery';

/** Оборудование/форма кардио (влияет на подбор при ограничениях суставов). */
export type CardioEquipment = 'running' | 'cycling' | 'rowing' | 'elliptical' | 'walking' | 'swimming';

export const CARDIO_EQUIPMENT_OPTIONS: { id: CardioEquipment; label: string; icon: string; impact: 'high' | 'low' }[] = [
  { id: 'running', label: 'Бег', icon: '🏃', impact: 'high' },
  { id: 'cycling', label: 'Вело', icon: '🚴', impact: 'low' },
  { id: 'rowing', label: 'Гребля', icon: '🚣', impact: 'low' },
  { id: 'elliptical', label: 'Эллипс', icon: '🧘', impact: 'low' },
  { id: 'walking', label: 'Ходьба', icon: '🚶', impact: 'low' },
  { id: 'swimming', label: 'Плавание', icon: '🏊', impact: 'low' },
];

export function cardioEquipmentLabel(id: CardioEquipment): string {
  return CARDIO_EQUIPMENT_OPTIONS.find(e => e.id === id)?.label ?? id;
}

/** Уровень подготовки: корректирует стартовый объём. */
export type CardioLevel = 'beginner' | 'intermediate' | 'advanced';
export const CARDIO_LEVEL_MULT: Record<CardioLevel, number> = { beginner: 0.8, intermediate: 1, advanced: 1.15 };
export const CARDIO_LEVEL_LABELS: Record<CardioLevel, string> = { beginner: 'Новичок', intermediate: 'Средний', advanced: 'Продвинутый' };

export interface CardioStructuredBlock {
  workSec: number;
  restSec: number;
  reps: number;
  target?: 'hr' | 'pace' | 'power' | 'rpe';
  targetHr?: { min?: number; max?: number };
  note?: string;
}

export interface CardioSession {
  id?: string;
  type: CardioType;
  durationMin: number;
  weeklyFrequency: number;
  intensity: 'low' | 'moderate' | 'high';
  kcalPerSession: number;   // оценочно
  purpose: string;
  targetHr?: { min?: number; max?: number };
  dayOfWeek?: number;
  restrictions?: string[];
  /** Предпочтительное оборудование для сессии (персонализация подбора). */
  equipment?: CardioEquipment;
  /** Структурированные интервалы (если есть — сессия выполняется по интервалам, а не равномерно). */
  structured?: CardioStructuredBlock[];
  /** Мощность (Вт) для вело/гребли, если задана. */
  powerWatts?: number;
}

export interface CardioPlan {
  sessions: CardioSession[];
  totalKcalPerWeek: number;
  rationale: string[];
}

// ─── CardioCycle (многонедельный цикл) ───

export type CardioGoal = 'health' | 'mass' | 'cut' | 'recomp' | 'maintenance' | 'recovery' | 'bb_prep' | 'pl_prep' | 'bb_taper';

export type CardioPeriodizationModel = 'linear' | 'polarized' | 'pyramidal' | 'pyramidal_polarized';
export const CARDIO_PERIODIZATION_LABELS: Record<CardioPeriodizationModel, string> = {
  linear: 'Линейная',
  polarized: 'Поляризованная (80/20)',
  pyramidal: 'Пирамидальная',
  pyramidal_polarized: 'Пирамида→Поляр. (Seiler 2026)',
};

export type CardioPhase =
  | 'base'
  | 'build'
  | 'maintenance'
  | 'contest_prep'
  | 'taper'
  | 'peak'
  | 'transition';

export interface CardioWeek {
  week: number;
  phase: CardioPhase;
  sessions: CardioSession[];
  totalMinutes: number;
  totalKcal: number;
  deload: boolean;
  taper: boolean;
  rationale: string[];
}

export interface CardioCompetitionRef {
  id: string;
  name: string;
  week: number;       // 1-индекс недели соревнования внутри цикла
  priority?: 'A' | 'B' | 'C';
}

export interface CardioCycle {
  id: string;
  name: string;
  goal: CardioGoal;
  totalWeeks: number;
  weeks: CardioWeek[];
  totalKcal: number;
  linkedMacrocycleId?: string;
  linkedCompetitionIds?: string[];
  source: 'auto' | 'manual' | 'imported';
  version: 1;
  createdAt: string;
  rationale: string[];
  /** Дата начала цикла (локальная YYYY-MM-DD) — неделя 1 = startDate.
   *  Все date-функции (неделя/прогресс/adherence/«Сегодня») должны
   *  использовать его как reference, иначе прогресс «съезжает». */
  startDate?: string;
  /** Снапшот параметров сборки — для «⚙️ Изменить параметры» в мастере. */
  config?: CardioCycleInput;
}

export interface CardioCycleInput {
  goal: CardioGoal;
  totalWeeks?: number;             // по умолчанию 12
  bodyWeight?: number;             // по умолчанию 80
  daysAvailable?: number;          // 0-7 доступных дней (по умолчанию 7)
  recoveryLow?: boolean;           // низкое восстановление → HIIT убран
  competitions?: CardioCompetitionRef[];
  /** Ручная структура фаз (недели base/build/maintenance). Если задано —
   *  используются эти доли вместо авто-процентов. taper/peak/contest_prep
   *  по-прежнему определяются соревнованиями. */
  phaseSplit?: { base?: number; build?: number; maintenance?: number };
  /** Длина taper-окна перед стартом (1-4, по умолчанию 2). */
  taperWeeks?: number;
  /** Модель taper: step (постоянный срез) vs exponential (прогрессивный, Thomas 2009, эффективнее) */
  taperModel?: 'step' | 'exponential';
  /** Строить taper перед стартами (по умолчанию true; false → старт без taper-кривой). */
  taper?: boolean;
  /** Строить пик-неделю старта (по умолчанию true; false → неделя старта лёгкая taper). */
  peakWeek?: boolean;
  /** Уровень подготовки (корректирует стартовый объём: 0.8/1/1.15). */
  level?: CardioLevel;
  /** Предпочтительное оборудование (до 3). */
  equipment?: CardioEquipment[];
  /** Щадить суставы: исключает ударные виды (бег). */
  lowImpact?: boolean;
  /** Возраст — для целевых пульс-зон сессий (Karvonen/ЧССмакс). */
  age?: number;
  /** ЧСС покоя — для пульс-зон по резерву (Karvonen). */
  restingHr?: number;
  /** Пол — для формулы ЧССмакс (женщины 226-age). */
  sex?: 'male' | 'female';
  /** Дни тяжёлых ног (0-6, Пн=0): zone2/miss/hiit не ставятся в эти дни. */
  legDays?: number[];
  /** Проблемы суставов из профиля (для autoLowImpact). */
  jointIssues?: boolean;
  /** Процент жира (0-70) — для точного расхода через FFM (вес × (1-бф/100)). */
  bodyFatPct?: number;
  /** Дата начала цикла (локальная YYYY-MM-DD); по умолчанию — сегодня. */
  startDate?: string;
  /** Сон (часы/ночь): <6 → объём ×0.9. */
  sleepHours?: number;
  /** Стресс (1-10): ≥7 → HIIT убран, объём ×0.95. */
  stressLevel?: number;
  /** HRV (мс, утренний): <25 при >0 → объём ×0.9. */
  hrvMs?: number;
  /** PED-курс: повышенное восстановление → объём ×1.05. */
  enhanced?: boolean;
  /** Авто-учёт суставов из профиля (chronicConditions) → lowImpact. */
  autoLowImpact?: boolean;
  /** Формула ЧССмакс: classic 220/226-age, tanaka 208-0.7×age (точнее), gulati 206-0.88×age (жен) */
  maxHrFormula?: 'classic' | 'tanaka' | 'gulati';
  /** Модель периодизации (Seiler 2026): linear / polarized 80/20 / pyramidal / pyramidal→polarized */
  periodizationModel?: CardioPeriodizationModel;
  /** PRO-калибровка (Эпик A): LTHR (Friel 30'), FTP (вело 20'×0.95), talk-test потолок Z2. Приоритет LTHR > FTP > talk > age. */
  lthr?: number;
  ftpWatts?: number;
  talkZone2Hr?: number;
  /** PRO-контекст среды (Эпик G): жара/влажность/высота для поправки HR-зон. */
  tempC?: number;
  humidityPct?: number;
  altitudeM?: number;
  /** Снапшот параметров сборки (для «⚙️ Изменить параметры»). Заполняется в buildCardioCycle. */
  config?: CardioCycleInput;
  id?: string;
  name?: string;
  source?: CardioCycle['source'];
  createdAt?: string;
}

// ─── Факторы профиля (сон/стресс/HRV/PED/суставы) и питание ───

export interface CardioProfileFactors {
  sleepHours?: number;
  stressLevel?: number;
  hrvMs?: number;
  enhanced?: boolean;
  jointIssues?: boolean;
}

/** Прочитать факторы восстановления/курса/суставов из профиля (чистая функция). */
export function cardioProfileFactors(profile: {
  personal?: { age?: number; sex?: 'male' | 'female'; weight?: number; bodyFat?: number };
  lifestyle?: { sleepHours?: number; stressLevel?: number; morningHRV?: number };
  pharma?: { currentSubstances?: unknown[] };
  health?: { chronicConditions?: string[] };
}): CardioProfileFactors {
  const f: CardioProfileFactors = {};
  const lf = profile.lifestyle ?? {};
  if (typeof lf.sleepHours === 'number' && lf.sleepHours > 0) f.sleepHours = lf.sleepHours;
  if (typeof lf.stressLevel === 'number' && lf.stressLevel > 0) f.stressLevel = lf.stressLevel;
  if (typeof lf.morningHRV === 'number' && lf.morningHRV > 0) f.hrvMs = lf.morningHRV;
  const subs = profile.pharma?.currentSubstances;
  if (Array.isArray(subs) && subs.length > 0) f.enhanced = true;
  const conds = profile.health?.chronicConditions;
  if (Array.isArray(conds)) {
    const joint = /сустав|колен|тазобедр|плеч|ахилл|мениск|артрит|остеохондроз|травм|joint|knee|hip|shoulder|achill|menisc/i;
    if (conds.some(c => joint.test(String(c)))) f.jointIssues = true;
  }
  return f;
}

/** Питание для кардио: расход, белок, углеводы, гидратация (чистая функция). */
export function cardioNutritionNotes(
  cycle: CardioCycle,
  profile: { personal?: { weight?: number; sex?: 'male' | 'female' }; nutrition?: { manualTargets?: { kcal?: number } } },
): string[] {
  const notes: string[] = [];
  const bw = profile.personal?.weight ?? 80;
  const s = cardioCycleSummary(cycle);
  notes.push(`🔥 Расход кардио: ${s.avgKcalPerWeek} ккал/нед (~${Math.max(1, Math.round(s.avgKcalPerWeek / 9))} г жира/нед при дефиците).`);
  if (cycle.goal === 'cut' || cycle.goal === 'recomp' || cycle.goal === 'bb_prep') {
    notes.push(`🥩 Белок при сушке/подготовке ББ: ≥2.2 г/кг = ${Math.round(bw * 2.2)} г/сут — сохранит мышцы на фоне дефицита + кардио.`);
  } else if (cycle.goal === 'mass') {
    notes.push(`🥩 Белок при массонаборе: 1.8-2.0 г/кг = ${Math.round(bw * 1.9)} г/сут.`);
  } else if (cycle.goal === 'pl_prep' || cycle.goal === 'bb_taper') {
    notes.push(`🥩 Белок при подготовке/тапере: 2.0-2.2 г/кг = ${Math.round(bw * 2.1)} г/сут — поддержание мышц и веса.`);
  } else {
    notes.push(`🥩 Белок: 1.6-2.0 г/кг = ${Math.round(bw * 1.8)} г/сут.`);
  }
  const hasHiit = s.hiitWeeks > 0;
  const longZ2 = cycle.weeks.some(w => w.sessions.some(x => x.type === 'zone2' && x.durationMin >= 60));
  if (hasHiit) notes.push('🍚 Перед HIIT: 30-60 г углеводов за 1-2 ч; после — 30-60 г + белок (гликоген).');
  if (longZ2) notes.push('💧 Zone 2 ≥60 мин: 500-750 мл/час, при >90 мин — электролиты (Na/K/Mg).');
  notes.push('⏰ Z2 можно натощак (жиросжигание); HIIT — только не натощак.');
  const kcal = profile.nutrition?.manualTargets?.kcal;
  if (typeof kcal === 'number' && kcal > 0) {
    notes.push(`📊 Калорийность цели: ${kcal} ккал/сут — расход кардио усиливает дефицит, следите за темпом (0.5-1%/нед).`);
  }
  return notes;
}

// ─── Пресеты-шаблоны (быстрые старты) ───

export interface CardioPreset {
  id: string;
  name: string;
  desc: string;
  icon: string;
  goal: CardioGoal;
  totalWeeks: number;
  daysAvailable: number;
  recoveryLow: boolean;
}

export const CARDIO_PRESETS: CardioPreset[] = [
  { id: 'health-8', name: 'Здоровье · 8 нед', desc: 'Zone 2 3-4 дня, аэробная база', icon: '💚', goal: 'health', totalWeeks: 8, daysAvailable: 4, recoveryLow: false },
  { id: 'cut-16', name: 'Сушка · 16 нед', desc: 'Прогрессия Zone 2 + HIIT, делоды', icon: '🔥', goal: 'cut', totalWeeks: 16, daysAvailable: 5, recoveryLow: false },
  { id: 'base-12', name: 'База · 12 нед', desc: 'Zone 2 3-4×, наращивание объёма', icon: '🌱', goal: 'health', totalWeeks: 12, daysAvailable: 4, recoveryLow: false },
  { id: 'mass-12', name: 'Масса · 12 нед', desc: 'Только восстановление 1-2×', icon: '🏗', goal: 'mass', totalWeeks: 12, daysAvailable: 2, recoveryLow: false },
  { id: 'recovery-4', name: 'Восстановление · 4 нед', desc: 'Лёгкий кровоток после тяжёлого блока', icon: '💤', goal: 'recovery', totalWeeks: 4, daysAvailable: 3, recoveryLow: true },
  { id: 'bb-prep-12', name: 'Подготовка ББ · 12 нед', desc: 'Прогрессия Zone 2 + MISS/HIIT на дефиците', icon: '🏁', goal: 'bb_prep', totalWeeks: 12, daysAvailable: 4, recoveryLow: false },
  { id: 'pl-prep-8', name: 'Подготовка ПЛ · 8 нед', desc: 'Умеренный Zone 2 + MISS без утомления ЦНС', icon: '🏋️', goal: 'pl_prep', totalWeeks: 8, daysAvailable: 3, recoveryLow: false },
  { id: 'bb-taper-4', name: 'Тапер ББ · 4 нед', desc: 'Плавное снижение объёма к шоу (0.9→0.6)', icon: '📉', goal: 'bb_taper', totalWeeks: 4, daysAvailable: 3, recoveryLow: true },
];

// ─── Константы ───

/** Оценка расхода ккал/мин по типу (для ~80кг атлета, поправка через вес). */
const KCAL_PER_MIN: Record<CardioType, number> = { zone2: 7, miss: 10, hiit: 14, recovery: 5 };

/** MET-множитель по оборудованию (относительно бега zone2 8.3 MET, Compendium 2024).
 *  Низкоударные виды сжигают меньше за минуту при той же продолжительности;
 *  swimming 6.0/8.3=0.72, cycling 7.5/8.3=0.90, rowing 6.0/8.3=0.72,
 *  elliptical 5.0/8.3=0.60, walking 3.8/8.3=0.46 — калибровано по compendium. */
const EQUIPMENT_MET: Record<CardioEquipment, number> = {
  running: 1.0,
  swimming: 0.72,
  cycling: 0.90,
  rowing: 0.72,
  elliptical: 0.60,
  walking: 0.46,
};

export const MAX_CYCLE_WEEKS = 104;
export const DELOAD_INTERVAL = 4;

export const CARDIO_GOAL_LABELS: Record<CardioGoal, string> = {
  health: 'Здоровье',
  mass: 'Массонабор',
  cut: 'Сушка',
  recomp: 'Рекомпозиция',
  maintenance: 'Поддержание',
  recovery: 'Восстановление',
  bb_prep: 'Подготовка ББ',
  pl_prep: 'Подготовка ПЛ',
  bb_taper: 'Тапер ББ',
};

export const CARDIO_PHASE_LABELS: Record<CardioPhase, string> = {
  base: 'База',
  build: 'Наращивание',
  maintenance: 'Поддержание',
  contest_prep: 'Prep',
  taper: 'Taper',
  peak: 'Пик-неделя',
  transition: 'Переход',
};

const TYPE_INTENSITY: Record<CardioType, 'low' | 'moderate' | 'high'> = {
  zone2: 'moderate',
  hiit: 'high',
  miss: 'moderate',
  recovery: 'low',
};

// ─── Расчёт ───

export function kcalForCardio(type: CardioType, durationMin: number, bodyWeight: number = 80, equipment?: CardioEquipment, sex?: 'male' | 'female', ffmKg?: number): number {
  const base = KCAL_PER_MIN[type] * durationMin;
  const met = equipment ? (EQUIPMENT_MET[equipment] ?? 1.0) : 1.0;
  // FFM точнее веса (жировая ткань сжигает меньше); пол: у женщин −6% энергозатрат
  // при той же нагрузке (средний метаболизм ниже на кг массы).
  const effWeight = ffmKg != null && ffmKg > 0 ? clamp(ffmKg, 20, 250) : bodyWeight;
  const sexFactor = sex === 'female' ? 0.94 : 1;
  return Math.round(base * met * (effWeight / 80) * sexFactor);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mkSession(
  type: CardioType,
  durationMin: number,
  frequency: number,
  purpose: string,
  bw: number,
  restrictions?: string[],
  sex?: 'male' | 'female',
  ffmKg?: number,
): CardioSession {
  return {
    type,
    durationMin,
    weeklyFrequency: frequency,
    intensity: TYPE_INTENSITY[type],
    kcalPerSession: kcalForCardio(type, durationMin, bw, undefined, sex, ffmKg),
    purpose,
    restrictions,
  };
}

/** Урезать частоту сессий под доступные дни (приоритет: zone2 → recovery → miss → hiit). */
export function capSessionsToDays(sessions: CardioSession[], daysAvailable: number): CardioSession[] {
  if (daysAvailable >= 7) return sessions;
  const priority: CardioType[] = ['zone2', 'recovery', 'miss', 'hiit'];
  const byType = new Map<CardioType, CardioSession[]>();
  for (const t of priority) byType.set(t, sessions.filter(s => s.type === t));
  const out: CardioSession[] = [];
  let used = 0;
  for (const t of priority) {
    const group = byType.get(t) ?? [];
    for (const s of group) {
      if (used >= daysAvailable) break;
      const take = Math.min(s.weeklyFrequency, daysAvailable - used);
      if (take > 0) out.push({ ...s, weeklyFrequency: take });
      used += take;
    }
  }
  return out;
}

// ─── Базовый недельный генератор (T7, обратно-совместим) ───

export interface CardioInput {
  goal: CardioGoal;
  bodyWeight?: number;
  daysAvailable?: number;     // сколько дней можно дать кардио (поверх трени)
  recoveryLow?: boolean;
}

export function buildCardioPlan(input: CardioInput): CardioPlan {
  const bw = input.bodyWeight || 80;
  const sessions: CardioSession[] = [];
  const rationale: string[] = [];
  const add = (type: CardioType, dur: number, freq: number, purpose: string) => {
    sessions.push(mkSession(type, dur, freq, purpose, bw));
  };
  if (input.goal === 'cut' || input.goal === 'bb_prep') {
    add('zone2', 45, 3, 'Липолиз, сохранение мышц, восстановление между трени');
    add('hiit', 15, 1, 'Метаболический стимул, EPOC, ЖСС без большого объёма');
    rationale.push('Сушка/подготовка ББ: zone2 3×45мин (липолиз без нагрузки на восстановление) + 1 HIIT 15мин (EPOC).');
  } else if (input.goal === 'recomp' || input.goal === 'maintenance' || input.goal === 'pl_prep') {
    add('zone2', 30, 2, 'Здоровье ССС, восстановление');
    if (input.goal === 'pl_prep') {
      add('miss', 20, 1, 'MISS (Z3 темпо): аэробная выносливость без утомления ЦНС');
      rationale.push('Подготовка ПЛ: умеренное zone2 + MISS — форма без утомления к старту.');
    } else {
      rationale.push('Поддержание/рекомпозиция: умеренное zone2 для ССС и восстановления.');
    }
  } else if (input.goal === 'mass') {
    add('recovery', 20, 1, 'Активное восстановление, не мешает массонабору');
    rationale.push('Массонабор: минимум кардио — только восстановление, чтобы не конкурировать с ростом.');
  } else if (input.goal === 'bb_taper') {
    add('zone2', 20, 2, 'Тапер ББ: лёгкий объём, привычка движения, без утомления');
    rationale.push('Тапер ББ: лёгкое zone2 2×20 — плавное снижение нагрузки к шоу.');
  } else {
    add('recovery', 30, 3, 'Активное восстановление, мобильность');
    rationale.push('Восстановление: лёгкое кардио для кровотока и мобильности.');
  }
  if (input.recoveryLow) { sessions.forEach(s => { if (s.type === 'hiit') s.weeklyFrequency = 0; }); rationale.push('Низкое восстановление → HIIT убран.'); }
  const total = sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0);
  return { sessions, totalKcalPerWeek: total, rationale };
}

// ─── CardioCycle — построение ───

/**
 * Нормализация ручного распределения фаз: сумма фаз не может превышать
 * totalWeeks (иначе build-фаза «съедает» поддерживающие недели и цикл
 * заканчивается раньше заявленного горизонта). Избыток усекается начиная
 * с последней фазы; значения клампятся к [0, totalWeeks].
 */
export function normalizeCardioPhaseSplit(
  input: { base?: number; build?: number; maintenance?: number },
  totalWeeks: number,
): { base: number; build: number; maintenance: number } {
  const t = Math.max(0, Math.round(totalWeeks));
  const raw = {
    base: input.base != null ? Math.round(input.base) : 0,
    build: input.build != null ? Math.round(input.build) : 0,
    maintenance: input.maintenance != null ? Math.round(input.maintenance) : 0,
  };
  let sum = raw.base + raw.build + raw.maintenance;
  if (sum <= t) return raw;
  // Усекаем с конца: maintenance → build → base, пока сумма не войдёт в горизонт.
  const out = { ...raw };
  for (const key of ['maintenance', 'build', 'base'] as const) {
    if (sum <= t) break;
    const over = sum - t;
    const cut = Math.min(out[key], over);
    out[key] -= cut;
    sum -= cut;
  }
  return out;
}

/**
 * Определить фазу недели: ramp base → build → maintenance,
 * taper/peak у соревнования, transition на последней неделе (без соревнований).
 * При заданном phaseSplit используется ручное распределение недель;
 * taperWeeks задаёт длину taper-окна (1-4), peakWeek — строить ли пик-неделю старта.
 */
export function cardioPhaseForWeek(
  week: number,
  totalWeeks: number,
  competitions?: CardioCompetitionRef[],
  phaseSplit?: { base?: number; build?: number; maintenance?: number },
  taperWeeks = 2,
  peakWeek = true,
  taperEnabled = true,
): CardioPhase {
  const comp = competitions?.find(c => c.week === week);
  if (comp) return peakWeek ? 'peak' : (taperEnabled ? 'taper' : 'maintenance');
  if (!taperEnabled) {
    // Без taper: недели до старта — наращивание (contest_prep), без taper-кривой.
    const upcoming = competitions?.find(c => c.week > week);
    if (upcoming) return 'contest_prep';
    if (week === totalWeeks) return 'transition';
    const t = totalWeeks;
    if (week <= Math.ceil(t * 0.33)) return 'base';
    if (week <= Math.ceil(t * 0.66)) return 'build';
    return 'maintenance';
  }
  const beforeComp = competitions?.find(c => c.week > week && c.week - week <= taperWeeks);
  if (beforeComp && week <= beforeComp.week) return 'taper';
  const upcoming = competitions?.find(c => c.week > week);
  if (upcoming) return week >= upcoming.week - taperWeeks ? 'taper' : 'contest_prep';
  if (week === totalWeeks) return 'transition';
  if (phaseSplit && (phaseSplit.base || phaseSplit.build || phaseSplit.maintenance)) {
    const baseEnd = Math.max(0, Math.round(phaseSplit.base ?? 0));
    const buildEnd = baseEnd + Math.max(0, Math.round(phaseSplit.build ?? 0));
    if (baseEnd > 0 && week <= baseEnd) return 'base';
    if (buildEnd > baseEnd && week <= buildEnd) return 'build';
    return 'maintenance';
  }
  const t = totalWeeks;
  if (week <= Math.ceil(t * 0.33)) return 'base';
  if (week <= Math.ceil(t * 0.66)) return 'build';
  return 'maintenance';
}

interface RampProfileEntry {
  type: CardioType;
  dur: number;
  freq: number;
  purpose: string;
  /** Альтернативная интенсивная сессия build-фазы: на нечётных неделях
   *  цикла ставится MISS (Z3), на чётных — HIIT (чередование, C1). */
  alt?: boolean;
}

interface RampProfile {
  base: RampProfileEntry[];
  build: RampProfileEntry[];
  maintenance: RampProfileEntry[];
  deloadMult: number;
  taperMult: number;
}

function profileForGoal(goal: CardioGoal, model?: CardioPeriodizationModel): RampProfile {
  let prof: RampProfile;
  switch (goal) {
    case 'cut':
    case 'bb_prep':
      prof = {
        base: [{ type: 'zone2', dur: 30, freq: 2, purpose: 'Вход в аэробную базу, щадящий старт сушки/подготовки' }],
        build: [
          { type: 'zone2', dur: 40, freq: 3, purpose: 'Рост липолитического объёма, восстановление' },
          { type: 'miss', dur: 20, freq: 1, purpose: 'MISS (Z3 темпо/фартлек): аэробная выносливость без ударной нагрузки', alt: true },
          { type: 'hiit', dur: 15, freq: 1, purpose: 'Метаболический стимул, EPOC, ЖСС', alt: true },
        ],
        maintenance: [
          { type: 'zone2', dur: 45, freq: 3, purpose: 'Липолиз, сохранение мышц, восстановление' },
          { type: 'hiit', dur: 15, freq: 1, purpose: 'Метаболический стимул, EPOC, ЖСС' },
        ],
        deloadMult: 0.6,
        taperMult: 0.6,
      };
      break;
    case 'pl_prep':
      prof = {
        base: [{ type: 'zone2', dur: 20, freq: 2, purpose: 'Лёгкая аэробная база без утомления (подготовка ПЛ)' }],
        build: [
          { type: 'zone2', dur: 25, freq: 3, purpose: 'Умеренный объём, поддержание выносливости' },
          { type: 'miss', dur: 20, freq: 1, purpose: 'MISS (Z3 темпо): аэробная выносливость', alt: true },
        ],
        maintenance: [{ type: 'zone2', dur: 30, freq: 3, purpose: 'Поддержание аэробной базы к старту' }],
        deloadMult: 0.6,
        taperMult: 0.6,
      };
      break;
    case 'bb_taper':
      prof = {
        base: [{ type: 'zone2', dur: 30, freq: 2, purpose: 'Вход в тапер: лёгкий объём без утомления' }],
        build: [{ type: 'zone2', dur: 25, freq: 2, purpose: 'Снижение объёма, сохранение привычки движения' }],
        maintenance: [{ type: 'recovery', dur: 20, freq: 2, purpose: 'Лёгкая активность, кровоток' }],
        deloadMult: 0.6,
        taperMult: 0.4,
      };
      break;
    case 'mass':
      prof = {
        base: [{ type: 'recovery', dur: 20, freq: 1, purpose: 'Активное восстановление, кровоток' }],
        build: [{ type: 'recovery', dur: 20, freq: 1, purpose: 'Активное восстановление, не мешает росту' }],
        maintenance: [{ type: 'recovery', dur: 20, freq: 1, purpose: 'Минимум кардио на массонаборе' }],
        deloadMult: 0.6,
        taperMult: 0.6,
      };
      break;
    case 'recomp':
      prof = {
        base: [{ type: 'zone2', dur: 25, freq: 2, purpose: 'Здоровье ССС, восстановление' }],
        build: [
          { type: 'zone2', dur: 30, freq: 2, purpose: 'Умеренная аэробная работа' },
          { type: 'miss', dur: 20, freq: 1, purpose: 'MISS (Z3 темпо): аэробная выносливость', alt: true },
          { type: 'hiit', dur: 15, freq: 1, purpose: 'Метаболический стимул, EPOC', alt: true },
        ],
        maintenance: [{ type: 'zone2', dur: 30, freq: 2, purpose: 'Поддержание ССС и восстановления' }],
        deloadMult: 0.6,
        taperMult: 0.6,
      };
      break;
    case 'maintenance':
      prof = {
        base: [{ type: 'zone2', dur: 25, freq: 2, purpose: 'Здоровье ССС, восстановление' }],
        build: [{ type: 'zone2', dur: 30, freq: 2, purpose: 'Умеренная аэробная работа' }],
        maintenance: [{ type: 'zone2', dur: 30, freq: 2, purpose: 'Поддержание ССС и восстановления' }],
        deloadMult: 0.6,
        taperMult: 0.6,
      };
      break;
    case 'recovery':
      prof = {
        base: [{ type: 'recovery', dur: 25, freq: 2, purpose: 'Лёгкое кардио, кровоток' }],
        build: [{ type: 'recovery', dur: 30, freq: 3, purpose: 'Активное восстановление, мобильность' }],
        maintenance: [{ type: 'recovery', dur: 30, freq: 3, purpose: 'Поддержание восстановления' }],
        deloadMult: 0.6,
        taperMult: 0.6,
      };
      break;
    case 'health':
    default:
      prof = {
        base: [{ type: 'zone2', dur: 25, freq: 3, purpose: 'База для здоровья ССС (3×)' }],
        build: [
          { type: 'zone2', dur: 30, freq: 4, purpose: 'Наращивание аэробной выносливости (4×)' },
          { type: 'miss', dur: 20, freq: 1, purpose: 'MISS (Z3 темпо): разнообразие, аэробная мощность', alt: true },
        ],
        maintenance: [{ type: 'zone2', dur: 40, freq: 4, purpose: 'Поддержание кардиореспираторного здоровья (4×)' }],
        deloadMult: 0.6,
        taperMult: 0.6,
      };
      break;
  }
  // ─── Применение модели периодизации Seiler 2026 ───
  if (model === 'polarized') {
    // Поляризованная: только low (zone2/recovery) + high (hiit), без умеренной (miss)
    for (const key of ['base', 'build', 'maintenance'] as const) {
      prof[key] = prof[key].filter(e => e.type !== 'miss');
      // если build потерял intensiveness полностью (cut без hiit из-за recoveryLow позже) — оставим как есть, hiit добавит quality
    }
  } else if (model === 'pyramidal') {
    // Пирамидальная: обеспечивает miss в базе и build (больше умеренной)
    for (const key of ['base', 'build'] as const) {
      const hasMiss = prof[key].some(e => e.type === 'miss');
      if (!hasMiss && (goal === 'cut' || goal === 'bb_prep' || goal === 'health' || goal === 'recomp')) {
        prof[key].push({ type: 'miss', dur: 20, freq: 1, purpose: 'MISS пирамидальная: умеренная мощность (pyramidal)', alt: key === 'build' });
      }
    }
  } else if (model === 'pyramidal_polarized') {
    // Seiler 2026: база pyramidal (больше Miss), build polarized (Miss→HIIT)
    const hasMissBase = prof.base.some(e => e.type === 'miss');
    if (!hasMissBase && (goal === 'cut' || goal === 'bb_prep' || goal === 'health' || goal === 'recomp')) {
      prof.base.push({ type: 'miss', dur: 20, freq: 1, purpose: 'MISS база pyramidal → polarized (Seiler)', alt: false });
    }
    // build делает polarized: убираем miss, оставляем hiit
    prof.build = prof.build.filter(e => e.type !== 'miss');
    // если в build не осталось hiit (health mass), оставляем как есть
    if (goal === 'health' && !prof.build.some(e => e.type === 'hiit')) {
      prof.build.push({ type: 'hiit', dur: 15, freq: 1, purpose: 'HIIT поляризация build-фазы', alt: true });
    }
  }
  return prof;
}

function buildWeekSessions(
  profile: RampProfile,
  phase: CardioPhase,
  week: number,
  bw: number,
  recoveryLow: boolean,
  volumeMult = 1,
  sex?: 'male' | 'female',
  ffmKg?: number,
): { sessions: CardioSession[]; rationale: string[] } {
  if (phase === 'peak') {
    return {
      sessions: [mkSession('recovery', 20, 1, 'Пик-неделя: только лёгкая привычная активность', bw, undefined, sex, ffmKg)],
      rationale: ['Пик-неделя: без HIIT и утомляющего кардио.'],
    };
  }
  // contest_prep = наращивание (прогрессирующий пул), а не готовый maintenance.
  const poolRaw: RampProfileEntry[] =
    phase === 'base' ? profile.base : (phase === 'build' || phase === 'contest_prep') ? profile.build : profile.maintenance;
  // Чередование альтернатив в build/prep: нечётная неделя цикла → MISS (Z3),
  // чётная → HIIT; если нужного типа в профиле нет — альтернатива не включается.
  let pool = poolRaw;
  if ((phase === 'build' || phase === 'contest_prep') && poolRaw.some(p => p.alt)) {
    const wantHiit = week % 2 === 0;
    pool = poolRaw.filter(p => !p.alt || p.type === (wantHiit ? 'hiit' : 'miss'));
  }
  const sessions: CardioSession[] = [];
  const rationale: string[] = [];
  const mult = volumeMult;
  for (const p of pool) {
    if (p.type === 'hiit' && (recoveryLow || phase === 'taper' || phase === 'transition')) continue;
    const dur = Math.max(10, Math.round(p.dur * mult));
    // Прогрессия (mult>1) растёт только длительностью; taper (mult<1) — и частотой.
    const freq = mult < 1 ? Math.max(1, Math.round(p.freq * mult)) : p.freq;
    if (freq <= 0) continue;
    sessions.push(mkSession(p.type, dur, freq, p.purpose, bw, undefined, sex, ffmKg));
  }
  if (phase === 'transition') {
    rationale.push('Переход: лёгкая активность для восстановления.');
  }
  if (phase === 'taper') rationale.push('Taper: объём снижается плавно к старту, интенсивность сохранена (Bosquet 2005).');
  return { sessions, rationale };
}

/** Построить полный кардио-цикл. */
export function buildCardioCycle(input: CardioCycleInput): CardioCycle {
  const totalWeeks = clamp(Math.round(input.totalWeeks ?? 12), 1, MAX_CYCLE_WEEKS);
  const bw = clamp(input.bodyWeight ?? 80, 30, 300);
  const ffmKg = typeof input.bodyFatPct === 'number' && input.bodyFatPct >= 3 && input.bodyFatPct <= 70 ? Math.round(bw * (1 - input.bodyFatPct / 100) * 10) / 10 : undefined;
  const daysAvailable = clamp(Math.round(input.daysAvailable ?? 7), 0, 7);
  const competitions = (input.competitions ?? []).filter(c => c.week >= 1 && c.week <= totalWeeks);
  const taperWeeks = clamp(Math.round(input.taperWeeks ?? 2), 1, 4);
  const peakWeek = input.peakWeek !== false;
  const taperEnabled = input.taper !== false;
  const phaseSplit = input.phaseSplit
    ? normalizeCardioPhaseSplit(input.phaseSplit, totalWeeks)
    : undefined;
  const levelMult = CARDIO_LEVEL_MULT[input.level ?? 'intermediate'];
  const lowImpact = !!input.lowImpact || (!!input.autoLowImpact && !!input.jointIssues);
  const stressHigh = (input.stressLevel ?? 0) >= 7;
  const sleepLow = (input.sleepHours ?? 7) < 6;
  const hrvLow = (input.hrvMs ?? 0) > 0 && (input.hrvMs ?? 0) < 25;
  const enhanced = !!input.enhanced;
  let factorMult = levelMult;
  const factorNotes: string[] = [];
  if (sleepLow) { factorMult *= 0.9; factorNotes.push('Сон <6 ч → объём ×0.9.'); }
  if (stressHigh) { factorMult *= 0.95; factorNotes.push('Стресс ≥7 → объём ×0.95, HIIT убран.'); }
  if (hrvLow) { factorMult *= 0.9; factorNotes.push('Низкий HRV → объём ×0.9.'); }
  if (enhanced) { factorMult *= 1.05; factorNotes.push('PED-курс: восстановление выше → объём ×1.05.'); }
  const recoveryLow = !!input.recoveryLow || stressHigh;
  const equipmentPool = (input.equipment ?? []).filter(e => !lowImpact || CARDIO_EQUIPMENT_OPTIONS.find(o => o.id === e)?.impact === 'low');
  const fallbackEquipment: CardioEquipment = lowImpact ? 'walking' : equipmentPool[0] ?? 'running';
  // PRO-калибровка зон (Эпик A): LTHR > talk-test > age. Жара/высота (Эпик G) сдвигают зоны вверх.
  const heatAdd = (input.tempC != null && input.tempC > 25 ? Math.min(10, Math.round(input.tempC - 25)) : 0)
    + (input.altitudeM != null && input.altitudeM > 1000 ? Math.min(15, Math.round((input.altitudeM - 1000) / 300)) : 0);
  const zones = (() => {
    if (input.lthr != null && input.lthr >= 80 && input.lthr <= 220) return lthrZones(Math.round(input.lthr));
    if (input.talkZone2Hr != null && input.talkZone2Hr >= 80 && input.talkZone2Hr <= 200) {
      const ceil = Math.round(input.talkZone2Hr);
      const mk = (zone: number, label: string, min: number, max: number, purpose: string): HeartZone => ({ zone, label, rangeMin: 0, rangeMax: 0, bpmMin: min, bpmMax: max, purpose });
      return [
        mk(1, 'Z1 Recovery', Math.max(60, ceil - 35), Math.max(80, ceil - 16), 'Восстановление (talk-test)'),
        mk(2, 'Z2 Zone 2', Math.max(80, ceil - 15), ceil, 'Аэробная база (talk-test)'),
        mk(3, 'Z3 Tempo/MISS', ceil + 1, ceil + 15, 'Темпо (talk-test)'),
        mk(4, 'Z4 Threshold', ceil + 16, ceil + 30, 'Порог (talk-test)'),
        mk(5, 'Z5 VO2max', ceil + 31, ceil + 55, 'Максимум (talk-test)'),
      ];
    }
    return input.age != null ? cardioHeartZones(input.age, input.restingHr, undefined, input.sex, (input as unknown as { maxHrFormula?: 'classic' | 'tanaka' | 'gulati' }).maxHrFormula) : undefined;
  })();
  const zonesAdj = zones && heatAdd > 0 ? zones.map(z => ({ ...z, bpmMin: z.bpmMin + heatAdd, bpmMax: z.bpmMax + heatAdd })) : zones;
  const profile = profileForGoal(input.goal, input.periodizationModel);
  const weeks: CardioWeek[] = [];
  let totalKcal = 0;
  let totalMinutes = 0;

  for (let w = 1; w <= totalWeeks; w++) {
    const phase = cardioPhaseForWeek(w, totalWeeks, competitions, phaseSplit, taperWeeks, peakWeek, taperEnabled);
    const deload = !competitions.some(c => Math.abs(c.week - w) <= 2) && w % DELOAD_INTERVAL === 0 && input.goal !== 'bb_taper' && phase !== 'transition' && phase !== 'taper' && phase !== 'peak';
    // Объём недели: непрерывная прогрессия рабочих недель (cut/recomp/health/
    // maintenance/prep) + плавная taper-кривая к старту. mass/recovery, делоды
    // и bb_taper (4 нед снижения 0.9→0.6, BB_CARDIO_TAPER_CURVE) — без прогрессии.
    let volumeMult = 1;
    if (input.goal === 'bb_taper') {
      volumeMult = bbCardioTaperMult(totalWeeks - w + 1, input.taperModel); // 1→0.6, 2→0.7, 3→0.85, 4→0.9 (или exponential 0.5/0.65/0.82/0.88)
    } else if (phase === 'taper') {
      const nextComp = competitions.find(c => c.week > w);
      const dist = nextComp ? nextComp.week - w : taperWeeks; // 1..taperWeeks
      volumeMult = bbCardioTaperMult(dist, input.taperModel);
    } else if (phase === 'transition') {
      volumeMult = profile.taperMult;
    } else if (!deload && phase !== 'peak' && ['cut', 'recomp', 'health', 'maintenance', 'bb_prep', 'pl_prep'].includes(input.goal)) {
      volumeMult = Math.min(1.3, 1 + 0.04 * (w - 1));
    }
    let { sessions, rationale } = buildWeekSessions(profile, phase, w, bw, recoveryLow, volumeMult, input.sex, ffmKg);
    if (deload) {
      sessions = sessions
        .filter(s => s.type !== 'hiit' && s.type !== 'miss')
        .map(s => ({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * profile.deloadMult)), weeklyFrequency: Math.max(1, Math.round(s.weeklyFrequency * profile.deloadMult)) }));
      rationale.push('Делод: объём кардио снижен, HIIT/MISS убраны.');
    }
    // Персонализация: уровень (объём), оборудование, целевые пульс-зоны.
    // Интенсивностная периодизация: Z2 сдвигается внутри своей зоны по ходу
    // цикла (нижняя часть в базе → верхняя в пике объёма, ниже в taper),
    // HIIT/MISS — фиксированные зоны 3/4.
    sessions = sessions.map(s => {
      const dur = Math.max(10, Math.round(s.durationMin * factorMult));
      const equip = (s.type === 'hiit' || s.type === 'miss') ? (equipmentPool[1] ?? fallbackEquipment) : (equipmentPool[0] ?? fallbackEquipment);
      const zone = s.type === 'hiit' ? zonesAdj?.[3] : s.type === 'miss' ? zonesAdj?.[2] : zonesAdj?.[1];
      let targetHr = zone ? { min: zone.bpmMin, max: zone.bpmMax } : s.targetHr;
      if (s.type === 'zone2' && zonesAdj && targetHr) {
        // Позиция внутри Z2: 0 = нижняя граница, 1 = верхняя.
        const prog = phase === 'taper' || phase === 'peak' || phase === 'transition'
          ? 0
          : deload
            ? 0.3
            : Math.min(1, (w - 1) / Math.max(1, totalWeeks - 1));
        const mid = Math.round(zone!.bpmMin + (zone!.bpmMax - zone!.bpmMin) * prog);
        targetHr = { min: mid, max: zone!.bpmMax };
      }
      return {
        ...s,
        durationMin: dur,
        kcalPerSession: kcalForCardio(s.type, dur, bw, equip, input.sex, ffmKg),
        equipment: equip,
        targetHr,
      };
    });
    const requestedFreq = sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    if (daysAvailable < 7) sessions = capSessionsToDays(sessions, daysAvailable);
    if (daysAvailable < 7 && requestedFreq > daysAvailable) {
      rationale.push(`Дней в неделю ${daysAvailable} < запрошенной частоты ${requestedFreq} — сессии урезаны под доступные дни.`);
    }
    sessions = assignSessionDays(sessions, input.legDays, input.startDate);
    const weekMinutes = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
    const weekKcal = sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0);
    totalMinutes += weekMinutes;
    totalKcal += weekKcal;
    weeks.push({ week: w, phase, sessions, totalMinutes: weekMinutes, totalKcal: weekKcal, deload, taper: phase === 'taper' || phase === 'peak', rationale });
  }

  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const cycle: CardioCycle = {
    id: input.id ?? `cardio-${Date.now()}`,
    name: input.name ?? `Кардио ${CARDIO_GOAL_LABELS[input.goal].toLowerCase()} ${totalWeeks} нед`,
    goal: input.goal,
    totalWeeks,
    weeks,
    totalKcal,
    linkedMacrocycleId: undefined,
    linkedCompetitionIds: competitions.map(c => c.id),
    source: input.source ?? 'auto',
    version: 1,
    createdAt: input.createdAt ?? new Date().toISOString(),
    startDate: input.startDate ?? todayLocal,
    config: input.config ?? undefined,
    rationale: [],
  };
  if (!cycle.config) {
    cycle.config = {
      goal: input.goal,
      totalWeeks: input.totalWeeks,
      bodyWeight: input.bodyWeight,
      bodyFatPct: input.bodyFatPct,
      daysAvailable: input.daysAvailable,
      recoveryLow: input.recoveryLow,
      competitions: input.competitions ? input.competitions.map(c => ({ ...c })) : undefined,
      phaseSplit: input.phaseSplit ? { ...input.phaseSplit } : undefined,
      taperWeeks: input.taperWeeks,
      peakWeek: input.peakWeek,
      taper: input.taper,
      level: input.level,
      equipment: input.equipment ? [...input.equipment] : undefined,
      lowImpact: input.lowImpact,
      age: input.age,
      restingHr: input.restingHr,
      sex: input.sex,
      legDays: input.legDays ? [...input.legDays] : undefined,
      sleepHours: input.sleepHours,
      stressLevel: input.stressLevel,
      hrvMs: input.hrvMs,
      enhanced: input.enhanced,
      autoLowImpact: input.autoLowImpact,
      jointIssues: input.jointIssues,
      maxHrFormula: (input as { maxHrFormula?: 'classic' | 'tanaka' | 'gulati' }).maxHrFormula,
      periodizationModel: input.periodizationModel,
      taperModel: input.taperModel,
      lthr: input.lthr,
      ftpWatts: input.ftpWatts,
      talkZone2Hr: input.talkZone2Hr,
      tempC: input.tempC,
      humidityPct: input.humidityPct,
      altitudeM: input.altitudeM,
    };
  }
  if (ffmKg != null) cycle.rationale.push(`FFM ${ffmKg} кг (жир ${input.bodyFatPct}%) — расход по безжировой массе.`);
  if (input.lthr != null && input.lthr >= 80 && input.lthr <= 220) cycle.rationale.push(`LTHR ${Math.round(input.lthr)} уд/мин (Friel 30') — зоны точные; HIIT контролируйте по мощности/темпу (HR занижает Z3).`);
  else if (input.talkZone2Hr != null && input.talkZone2Hr >= 80 && input.talkZone2Hr <= 200) cycle.rationale.push(`Talk-test: потолок Z2 ${Math.round(input.talkZone2Hr)} уд/мин — зоны оценочные.`);
  if (input.ftpWatts != null && input.ftpWatts >= 30) cycle.rationale.push(`FTP ${Math.round(input.ftpWatts)} Вт — ватт-зоны Coggan первичны для вело.`);
  if (heatAdd > 0) cycle.rationale.push(`Жара/высота: зоны +${heatAdd} уд/мин (терморегуляция/гипоксия) — пейте 500-750 мл/ч, >90' электролиты.`);
  cycle.rationale.push(`Цель: ${CARDIO_GOAL_LABELS[input.goal].toLowerCase()}, ${totalWeeks} нед, ${daysAvailable} дн/нед.`);
  if (input.level && input.level !== 'intermediate') cycle.rationale.push(`Уровень: ${CARDIO_LEVEL_LABELS[input.level].toLowerCase()} (объём ×${levelMult}).`);
  for (const n of factorNotes) cycle.rationale.push(n);
  if (lowImpact && input.autoLowImpact) cycle.rationale.push('Учтены проблемы суставов из профиля — низкоударный режим.');
  if (equipmentPool.length > 0) cycle.rationale.push(`Оборудование: ${equipmentPool.map(e => cardioEquipmentLabel(e)).join(', ')}${lowImpact ? ' (низкоударное)' : ''}.`);
  else if (lowImpact) cycle.rationale.push('Оборудование: низкоударное (ходьба/вело/эллипс по умолчанию).');
  if (input.age != null) cycle.rationale.push(`Возраст ${input.age}${input.sex === 'female' ? ' (жен.)' : ''} — целевые пульс-зоны сессий заданы${input.restingHr != null && input.restingHr > 0 ? ` (ЧСС покоя ${input.restingHr})` : ''}.`);
  if (recoveryLow) cycle.rationale.push('Низкое восстановление: HIIT исключён.');
  if (competitions.length > 0) {
    const starts = competitions.map(c => `${c.name} (нед ${c.week})`).join(', ');
    if (taperEnabled) {
      cycle.rationale.push(`Соревнования: ${starts} — taper ${taperWeeks} нед${peakWeek ? ' + пик-неделя' : ' (без пик-недели)'}.`);
    } else {
      cycle.rationale.push(`Соревнования: ${starts} — taper отключён: до старта наращивание (contest_prep), неделя старта${peakWeek ? ' — пик (только лёгкое recovery)' : ' — обычная'}.`);
    }
  }
  return cycle;
}

// ─── Кардио ↔ contest prep ББ (prep-синхронизация) ───

/** Структурный тип prep-плана ББ (зеркало BBContestPrepPlan из bb-contest-prep.engine).
 *  Импорт bb-движка исключён намеренно: кардио-движок не должен тянуть
 *  bb-цепочку (bb-builder → macrocycle) — достаточно структурной совместимости. */
export interface CardioPrepPlanLike {
  id: string;
  showDate: string;
  category: string;
  sex?: 'male' | 'female';
  preparation: {
    startDate: string;
    weeks: number;
    finalWeeks: number;
    targetRatePctPerWeek: number;
    startingWeightKg: number;
    currentCalories: number;
    stepsPerDay: number;
    cardioMinutesPerWeek: number;
    volumeMult?: number;
  };
  taper: { enabled: boolean; weeks: number };
  peakWeek: { enabled: boolean };
  phases?: {
    key: string;
    weekStart: number;
    weekEnd: number;
    dateStart: string;
    dateEnd: string;
  }[];
}

export interface CardioPrepBuildOptions {
  id?: string;
  name?: string;
  equipment?: CardioEquipment[];
  lowImpact?: boolean;
  autoLowImpact?: boolean;
  jointIssues?: boolean;
  level?: CardioLevel;
  age?: number;
  restingHr?: number;
  legDays?: number[];
  daysAvailable?: number;
  sleepHours?: number;
  stressLevel?: number;
  hrvMs?: number;
  enhanced?: boolean;
  bodyFatPct?: number;
  startDate?: string;
}

/** Шаги пик-недели prep по дням (зеркало STEPS_BY_DAY bb-contest-prep.engine). */
export const PREP_PEAK_STEPS_BY_DAY: Record<number, number> = { 1: 12000, 2: 12000, 3: 10000, 4: 9000, 5: 8000, 6: 6000, 7: 4000 };

/** Единая taper-кривая кардио ББ: расстояние до шоу (недели) → множитель объёма.
 *  Один источник для bb_taper-цели, taper-ветки buildCardioCycle, buildCardioCycleFromPrep
 *  и applyBBCardioTaper (прежние разрозненные 0.85→0.4 / 0.4+0.15×(dist−1) / 0.6/0.8).
 *  Кривая плавная: 0.9 → 0.85 → 0.7 → 0.6 (Bosquet 2005; в пик-неделю кардио
 *  режется сильнее силовой prep-кривой — ради гликогена и внешнего вида). */
export const BB_CARDIO_TAPER_CURVE: Record<number, number> = { 1: 0.6, 2: 0.7, 3: 0.85, 4: 0.9 };
export const BB_CARDIO_TAPER_CURVE_EXPONENTIAL: Record<number, number> = { 1: 0.5, 2: 0.65, 3: 0.82, 4: 0.88 };
export type CardioTaperModel = 'step' | 'exponential';

/** Множитель объёма кардио за `dist` недель до шоу (1 = ближайшая к пику неделя). */
export function bbCardioTaperMult(dist: number, model?: CardioTaperModel): number {
  const curve = model === 'exponential' ? BB_CARDIO_TAPER_CURVE_EXPONENTIAL : BB_CARDIO_TAPER_CURVE;
  return curve[clamp(Math.round(dist), 1, 4)] ?? 0.6;
}

/** Рекомендация по taper с учётом pre-fatigue (Bosquet 2024: F-OR нужен 3 нед + сон). */
export function cardioTaperRecommendation(input: {
  taperWeeks?: number;
  taperModel?: CardioTaperModel;
  acwr?: number | null;
  wellnessReadiness?: number | null;
  sleepHours?: number | null;
}): { weeks: number; model: CardioTaperModel; reason: string; sleepHygiene: boolean } {
  let weeks = clamp(Math.round(input.taperWeeks ?? 2), 1, 4);
  let model: CardioTaperModel = input.taperModel ?? 'step';
  const highFatigue = (input.acwr != null && input.acwr >= 1.3) || (input.wellnessReadiness != null && input.wellnessReadiness < 4) || (input.sleepHours != null && input.sleepHours < 6);
  const sleepHygiene = !!highFatigue;
  if (highFatigue && weeks < 3) {
    weeks = 3;
    model = 'exponential';
  }
  let reason = `Taper ${weeks} нед, модель ${model === 'exponential' ? 'exponential (прогрессивный, Thomas 2009)' : 'step'}.`;
  if (sleepHygiene) reason += ' F-OR/высокая усталость → 3 нед exponential + гигиена сна (Bosquet F-OR 2024).';
  return { weeks, model, reason, sleepHygiene };
}

/* addDaysIso / todayLocalIso теперь из cardio-date-utils.engine.ts */

/** Фаза prep-плана для недели цикла (по ranges плана; null → данных нет). */
function prepPhaseKeyForWeek(prep: CardioPrepPlanLike, week: number): string | null {
  for (const p of prep.phases ?? []) {
    if (week >= p.weekStart && week <= p.weekEnd) return p.key;
  }
  return null;
}

export interface CardioPrepCategoryProfile {
  category: string;
  sex: 'male' | 'female';
  minMinutesPerWeek: number;
  maxMinutesPerWeek: number;
  stepsPerDay: number;
  hiitAllowed: boolean;
  targetRatePctPerWeek: [number, number];
}

/** Дефолтный кардио-профиль по категории шоу ББ: объём минут / шаги / HIIT и
 *  целевой темп снижения веса (жен. 0.4–0.6%/нед, муж. 0.5–0.75%/нед — безопасные
 *  границы для сохранения мышц на дефиците; light-категории щадятся сильнее). */
export function cardioPrepCategoryProfile(category: string | undefined, sex?: 'male' | 'female'): CardioPrepCategoryProfile {
  const c = String(category || '').toLowerCase();
  const female = sex === 'female';
  if (c === 'bikini' || c === 'wellness') {
    return { category: c, sex: 'female', minMinutesPerWeek: 45, maxMinutesPerWeek: 90, stepsPerDay: 9000, hiitAllowed: false, targetRatePctPerWeek: [0.4, 0.5] };
  }
  if (c === 'figure') {
    return { category: c, sex: 'female', minMinutesPerWeek: 60, maxMinutesPerWeek: 120, stepsPerDay: 9500, hiitAllowed: true, targetRatePctPerWeek: [0.45, 0.55] };
  }
  if (c === 'womens_physique' || c === 'womens_bb') {
    return { category: c, sex: 'female', minMinutesPerWeek: 90, maxMinutesPerWeek: 150, stepsPerDay: 10000, hiitAllowed: true, targetRatePctPerWeek: [0.5, 0.6] };
  }
  if (c === 'mens_physique') {
    return { category: c, sex: 'male', minMinutesPerWeek: 30, maxMinutesPerWeek: 60, stepsPerDay: 7000, hiitAllowed: false, targetRatePctPerWeek: [0.5, 0.75] };
  }
  if (c === 'classic_physique') {
    return { category: c, sex: 'male', minMinutesPerWeek: 60, maxMinutesPerWeek: 90, stepsPerDay: 8000, hiitAllowed: true, targetRatePctPerWeek: [0.5, 0.75] };
  }
  if (c === 'mens_bb' || c === 'bb_212') {
    return { category: c, sex: 'male', minMinutesPerWeek: 90, maxMinutesPerWeek: 150, stepsPerDay: 10000, hiitAllowed: true, targetRatePctPerWeek: [0.5, 0.75] };
  }
  // Неизвестная/пустая категория → половое значение по умолчанию.
  return female
    ? { category: c, sex: 'female', minMinutesPerWeek: 60, maxMinutesPerWeek: 120, stepsPerDay: 9000, hiitAllowed: true, targetRatePctPerWeek: [0.4, 0.6] }
    : { category: c, sex: 'male', minMinutesPerWeek: 60, maxMinutesPerWeek: 120, stepsPerDay: 8000, hiitAllowed: true, targetRatePctPerWeek: [0.5, 0.75] };
}

/**
 * Построить кардио-цикл из prep-плана ББ. Единый источник объёма —
 * preparation.cardioMinutesPerWeek (после сборки записать обратно через
 * syncPrepCardioMinutes, чтобы prep знал фактический объём кардио).
 * Недели: подготовка (база → наращивание, финальная ×0.9) → taper по
 * BB_CARDIO_TAPER_CURVE → пик-неделя (только лёгкая активность) → post-show
 * (восстановительное zone2 2×25). Женщины: только zone2 (без HIIT/MISS).
 */
export function buildCardioCycleFromPrep(
  prep: CardioPrepPlanLike | null | undefined,
  opts: CardioPrepBuildOptions = {},
): CardioCycle | null {
  if (!prep) return null;
  const p = prep.preparation;
  const sex = prep.sex ?? 'male';
  const catProfile = cardioPrepCategoryProfile(prep.category, sex);
  const prepWeeks = clamp(Math.round(p.weeks ?? 12), 1, MAX_CYCLE_WEEKS);
  const taperWeeks = clamp(Math.round(prep.taper?.weeks ?? 2), 1, 4);
  const peakEnabled = prep.peakWeek?.enabled !== false;
  const prepBaseWeeks = prepWeeks + taperWeeks + (peakEnabled ? 1 : 0);
  const postShowEnd = Math.max(0, ...(prep.phases ?? []).filter(x => x.key === 'post_show').map(x => x.weekEnd));
  const totalWeeks = clamp(Math.max(prepBaseWeeks, postShowEnd), 1, MAX_CYCLE_WEEKS);
  const prepMinutes = p.cardioMinutesPerWeek > 0
    ? Math.round(p.cardioMinutesPerWeek)
    : Math.round((catProfile.minMinutesPerWeek + catProfile.maxMinutesPerWeek) / 2);
  const finalWeeks = clamp(Math.round(p.finalWeeks ?? 0), 0, prepWeeks);
  const prepVolumeMult = p.volumeMult && p.volumeMult > 0 && p.volumeMult < 1 ? p.volumeMult : 1;
  const bw = clamp(p.startingWeightKg > 0 ? p.startingWeightKg : 80, 30, 300);
  const ffmPrep = typeof (opts as { bodyFatPct?: number }).bodyFatPct === 'number' && (opts as { bodyFatPct?: number }).bodyFatPct! >= 3 && (opts as { bodyFatPct?: number }).bodyFatPct! <= 70 ? Math.round(bw * (1 - (opts as { bodyFatPct?: number }).bodyFatPct! / 100) * 10) / 10 : undefined;
  const daysAvailable = clamp(Math.round(opts.daysAvailable ?? 7), 0, 7);
  const levelMult = CARDIO_LEVEL_MULT[opts.level ?? 'intermediate'];
  const lowImpact = !!opts.lowImpact || (!!opts.autoLowImpact && !!opts.jointIssues);
  const equipmentPool = (opts.equipment ?? []).filter(e => !lowImpact || CARDIO_EQUIPMENT_OPTIONS.find(o => o.id === e)?.impact === 'low');
  const fallbackEquipment: CardioEquipment = lowImpact ? 'walking' : equipmentPool[0] ?? 'running';
  const zones = opts.age != null ? cardioHeartZones(opts.age, opts.restingHr, undefined, sex) : undefined;
  const weeks: CardioWeek[] = [];
  let totalKcal = 0;
  let totalMinutes = 0;

  // Базовая зона2-раскладка по минутам prep (freq 2-5×/нед, длительность кратна 5).
  const splitZone2 = (minutes: number): CardioSession[] => {
    const freq = clamp(Math.round(minutes / 40), 2, 5);
    const dur = Math.max(10, Math.round(minutes / freq / 5) * 5);
    return [mkSession('zone2', dur, freq, 'Prep-подготовка: липолиз, аэробная база без утомления', bw, undefined, sex, ffmPrep)];
  };

  for (let w = 1; w <= totalWeeks; w++) {
    const key = prepPhaseKeyForWeek(prep, w);
    let phase: CardioPhase;
    let sessions: CardioSession[] = [];
    const rationale: string[] = [];
    if (key === 'taper' || (!key && w > prepWeeks && w <= prepWeeks + taperWeeks)) {
      phase = 'taper';
      const dist = w - prepWeeks; // 1..taperWeeks (1 = дальше от шоу)
      const mult = bbCardioTaperMult(taperWeeks - dist + 1);
      sessions = splitZone2(Math.max(20, Math.round(prepMinutes * mult)));
      rationale.push(`Taper prep: объём ×${mult.toFixed(2)} (BB_CARDIO_TAPER_CURVE), только zone2.`);
    } else if (key === 'peak_week' || key === 'show_day' || (!key && w === prepBaseWeeks && peakEnabled)) {
      phase = 'peak';
      sessions = [mkSession('recovery', 20, 1, 'Пик-неделя: только лёгкая привычная активность', bw, undefined, sex, ffmPrep)];
      rationale.push('Пик-неделя: без HIIT и утомляющего кардио; шаги — по протоколу PREP_PEAK_STEPS_BY_DAY.');
    } else if (key === 'post_show' || (!key && w > prepBaseWeeks)) {
      phase = 'transition';
      sessions = [mkSession('zone2', 25, 2, 'Post-show: восстановительное кардио, возврат объёма постепенно', bw, undefined, sex, ffmPrep)];
      rationale.push('Post-show: лёгкое zone2 2×25 мин — восстановление без перебора.');
    } else {
      const isFinal = key === 'final_preparation' || (!key && w > prepWeeks - finalWeeks);
      phase = isFinal ? 'contest_prep' : w <= Math.ceil(prepWeeks / 2) ? 'base' : 'build';
      const progress = Math.min(1.3, 1 + 0.04 * (w - 1));
      const minutes = Math.round(prepMinutes * progress * (isFinal ? 0.9 : 1) * prepVolumeMult);
      sessions = splitZone2(minutes);
      if (!isFinal && sex === 'male' && catProfile.hiitAllowed && w > Math.ceil(prepWeeks / 2)) {
        const intense = w % 2 === 0
          ? mkSession('hiit', 15, 1, 'HIIT: метаболический стимул без большого объёма (чередование)', bw, undefined, sex, ffmPrep)
          : mkSession('miss', 20, 1, 'MISS (Z3): аэробная выносливость без ударной нагрузки (чередование)', bw, undefined, sex, ffmPrep);
        sessions.push(intense);
      }
      if (isFinal) rationale.push('Финальная подготовка: объём ×0.9, только zone2 (Helms 2022).');
      else if (phase === 'build') rationale.push('Наращивание: минуты по prep-плану + прогрессия, HIIT/MISS чередуются.');
      else rationale.push('База: вход в подготовку, щадящий старт.');
    }
    // Персонализация: уровень (объём), оборудование, целевые пульс-зоны, ккал.
    sessions = sessions.map(s => {
      const dur = Math.max(10, Math.round(s.durationMin * levelMult));
      const equip = (s.type === 'hiit' || s.type === 'miss') ? (equipmentPool[1] ?? fallbackEquipment) : (equipmentPool[0] ?? fallbackEquipment);
      const zone = s.type === 'hiit' ? zones?.[3] : s.type === 'miss' ? zones?.[2] : zones?.[1];
      return {
        ...s,
        durationMin: dur,
        kcalPerSession: kcalForCardio(s.type, dur, bw, equip, sex, ffmPrep),
        equipment: equip,
        targetHr: zone ? { min: zone.bpmMin, max: zone.bpmMax } : s.targetHr,
      };
    });
    const requestedFreq = sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    if (daysAvailable < 7) sessions = capSessionsToDays(sessions, daysAvailable);
    if (daysAvailable < 7 && requestedFreq > daysAvailable) {
      rationale.push(`Дней в неделю ${daysAvailable} < запрошенной частоты ${requestedFreq} — сессии урезаны под доступные дни.`);
    }
    sessions = assignSessionDays(sessions, opts.legDays, opts.startDate ?? p.startDate);
    const weekMinutes = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
    const weekKcal = sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0);
    totalMinutes += weekMinutes;
    totalKcal += weekKcal;
    weeks.push({ week: w, phase, sessions, totalMinutes: weekMinutes, totalKcal: weekKcal, deload: false, taper: phase === 'taper' || phase === 'peak', rationale });
  }

  const cycle: CardioCycle = {
    id: opts.id ?? `cardio-prep-${Date.now()}`,
    name: opts.name ?? `Кардио к prep ${prep.category || ''} · ${totalWeeks} нед`.trim(),
    goal: 'bb_prep',
    totalWeeks,
    weeks,
    totalKcal,
    linkedMacrocycleId: undefined,
    linkedCompetitionIds: [],
    source: 'auto',
    version: 1,
    createdAt: new Date().toISOString(),
    startDate: opts.startDate ?? p.startDate,
    config: {
      goal: 'bb_prep',
      totalWeeks,
      bodyWeight: bw,
      daysAvailable,
      level: opts.level,
      equipment: opts.equipment ? [...opts.equipment] : undefined,
      lowImpact: opts.lowImpact,
      age: opts.age,
      restingHr: opts.restingHr,
      sex,
      legDays: opts.legDays ? [...opts.legDays] : undefined,
      sleepHours: opts.sleepHours,
      stressLevel: opts.stressLevel,
      hrvMs: opts.hrvMs,
      enhanced: opts.enhanced,
      autoLowImpact: opts.autoLowImpact,
      jointIssues: opts.jointIssues,
      taperWeeks,
      peakWeek: peakEnabled,
    },
    rationale: [
      `Цель: подготовка ББ по prep-плану (${prep.category || 'категория не задана'}, ${sex === 'female' ? 'жен.' : 'муж.'}), ${totalWeeks} нед.`,
      `Минуты из prep-плана: ${prepMinutes} мин/нед (категория ${catProfile.minMinutesPerWeek}-${catProfile.maxMinutesPerWeek}).`,
      ...(catProfile.targetRatePctPerWeek[0] !== 0.5 || catProfile.targetRatePctPerWeek[1] !== 0.75
        ? [`Целевой темп ${catProfile.targetRatePctPerWeek[0]}-${catProfile.targetRatePctPerWeek[1]}%/нед — темп питания проверяется через prepCardioKcalAdvice.`]
        : []),
    ],
  };
  if (opts.age != null) cycle.rationale.push(`Возраст ${opts.age}${sex === 'female' ? ' (жен.)' : ''} — целевые пульс-зоны сессий заданы.`);
  return cycle;
}

/** Записать фактический объём кардио цикла обратно в prep-план (среднее по
 *  рабочим неделям: base/build/contest_prep; clamp 20-600 мин/нед).
 *  Возвращает копию prep-плана с обновлённым cardioMinutesPerWeek
 *  (или null при отсутствии prep-плана / без изменений). */
export function syncPrepCardioMinutes(
  prep: CardioPrepPlanLike | null | undefined,
  cycle: CardioCycle | null | undefined,
): CardioPrepPlanLike | null {
  if (!prep || !cycle) return null;
  const work = cycle.weeks.filter(w => w.phase === 'base' || w.phase === 'build' || w.phase === 'contest_prep');
  if (work.length === 0) return null;
  const avg = Math.round(work.reduce((s, w) => s + w.totalMinutes, 0) / work.length);
  const next = clamp(avg, 20, 600);
  if (Math.round(prep.preparation.cardioMinutesPerWeek) === next) return null;
  return { ...prep, preparation: { ...prep.preparation, cardioMinutesPerWeek: next } };
}

export interface CardioPeakWeekDay {
  day: number;
  dateIso: string;
  steps: number;
  cardioMin: number;
  note: string;
}

/** Пик-неделя кардио для prep-плана: 7 дней до шоу с шагами по протоколу
 *  PREP_PEAK_STEPS_BY_DAY и лёгким кардио (20 мин в начале → 0 в день шоу). */
export function cardioPeakWeekFromPrep(
  prep: CardioPrepPlanLike | null | undefined,
  cycle?: CardioCycle | null,
): CardioPeakWeekDay[] {
  if (!prep?.showDate) return [];
  const show = prep.showDate;
  const peakMin = cycle
    ? cycle.weeks.find(w => w.phase === 'peak')?.sessions[0]?.durationMin ?? 20
    : 20;
  return [1, 2, 3, 4, 5, 6, 7].map(d => {
    const cardioMin = d <= 4 ? 20 : d === 5 ? 15 : d === 6 ? 10 : 0;
    return {
      day: d,
      dateIso: addDaysIso(show, d - 7),
      steps: PREP_PEAK_STEPS_BY_DAY[d] ?? 8000,
      cardioMin: d === 7 ? Math.min(peakMin, 20) : cardioMin,
      note: d === 7 ? 'День шоу: только привычная активность' : d === 6 ? 'Шаги снижаются, кардио 10 мин' : d <= 4 ? 'Кардио лёгкое: пульс ниже Z2, шаги по протоколу' : 'Шаги снижаются к шоу, кардио минимально',
    };
  });
}

// ─── Женская модель и безопасность (пол/FFM/цикл/анемия/RED-S) ───

export interface CardioPeriodInput {
  /** Длина цикла в днях (21-35; по умолчанию 28). */
  cycleLengthDays?: number;
  /** Дата начала последней менструации (YYYY-MM-DD). */
  lastPeriodStartIso?: string;
}

/** Фаза менструального цикла для даты: фолликулярная (1-14), овуляция (15-16),
 *  лютеиновая (17-28). Без даты начала — «не задан». */
export function menstrualPhaseForDate(
  input: CardioPeriodInput | undefined,
  dateIso: string,
): { cycleDay: number; phase: 'follicular' | 'ovulatory' | 'luteal'; note: string } {
  if (!input?.lastPeriodStartIso) {
    return { cycleDay: 1, phase: 'follicular', note: 'Цикл не задан — без корректировок.' };
  }
  const length = clamp(Math.round(input.cycleLengthDays ?? 28), 21, 35);
  const start = new Date(input.lastPeriodStartIso.length === 10 ? input.lastPeriodStartIso + 'T00:00:00' : input.lastPeriodStartIso);
  const d = new Date(dateIso.length === 10 ? dateIso + 'T00:00:00' : dateIso);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(d.getTime())) {
    return { cycleDay: 1, phase: 'follicular', note: 'Дата цикла некорректна — без корректировок.' };
  }
  const diff = Math.floor((d.getTime() - start.getTime()) / 86400000);
  if (diff < 0) return { cycleDay: 1, phase: 'follicular', note: 'Дата до начала цикла — фолликулярная по умолчанию.' };
  const cycleDay = (diff % length) + 1;
  const follEnd = Math.max(10, Math.round(length * 0.5));
  const ovEnd = Math.min(length - 1, follEnd + 2);
  if (cycleDay <= follEnd) return { cycleDay, phase: 'follicular', note: 'Фолликулярная фаза — кардио по плану.' };
  if (cycleDay <= ovEnd) return { cycleDay, phase: 'ovulatory', note: 'Овуляция — работа по плану.' };
  return { cycleDay, phase: 'luteal', note: 'Лютеиновая фаза: RPE воспринимается выше, HIIT → zone2.' };
}

/** Учесть менструальный цикл в неделях цикла: в лютеиновую фазу HIIT/MISS
 *  заменяются zone2 (пульс воспринимается выше, задержка жидкости, жар).
 *  Идемпотентно: уже заменённые недели не трогаются повторно. */
export function cardioCyclePeriodAware(
  cycle: CardioCycle,
  input?: CardioPeriodInput,
): { cycle: CardioCycle; changes: CardioTuneChange[]; notes: string[] } {
  if (!input?.lastPeriodStartIso) return { cycle, changes: [], notes: ['Цикл не задан — без корректировок.'] };
  const bw = cycleBodyWeight(cycle);
  const ffm = cycleFfmKg(cycle);
  const sex = cycle.config?.sex;
  const changes: CardioTuneChange[] = [];
  const notes: string[] = [];
  const weeks = cycle.weeks.map(w => {
    if (!cycle.startDate) return w;
    const start = addDaysIso(cycle.startDate, (w.week - 1) * 7);
    const ph = menstrualPhaseForDate(input, start);
    if (ph.phase !== 'luteal') return w;
    const intense = w.sessions.filter(s => s.type === 'hiit' || s.type === 'miss');
    if (intense.length === 0) return w;
    const from = intense.map(s => `${s.type.toUpperCase()} ×${s.weeklyFrequency}`).join(', ');
    const sessions = w.sessions.map(s => {
      if (s.type === 'hiit') {
        return recalcSessionKcal({ ...s, type: 'zone2' as CardioType, intensity: 'moderate' as const, durationMin: Math.max(10, Math.round(s.durationMin * 1.5)), purpose: 'Лютеиновая фаза: HIIT → zone2 (RPE воспринимается выше)' }, bw, sex, ffm);
      }
      if (s.type === 'miss') {
        return recalcSessionKcal({ ...s, type: 'zone2' as CardioType, intensity: 'moderate' as const, purpose: 'Лютеиновая фаза: MISS → zone2 (щадяще)' }, bw, sex, ffm);
      }
      return s;
    });
    const to = sessions.filter(s => s.type === 'zone2').reduce((s, x) => s + x.weeklyFrequency, 0);
    changes.push({ week: w.week, label: 'Лютеиновая фаза → HIIT/MISS заменены zone2', from, to: `${to}× zone2` });
    return rebuildWeek(w, sessions, ['Лютеиновая фаза: интенсивное кардио заменено zone2 (RPE выше, задержка воды).']);
  });
  if (changes.length > 0) notes.push(`Менструальный цикл: скорректировано недель — ${changes.length}.`);
  return { cycle: { ...cycle, weeks }, changes, notes };
}

export interface CardioLabsLike {
  ferritin?: number;   // мкг/л
  hemoglobin?: number; // г/л
  hct?: number;        // %
}

export interface CardioAnemiaResult {
  warnings: string[];
  volumeMult: number;
  ferritinLow: boolean;
  hbLow: boolean;
}

/** Анемия/железодефицит (ферритин <30 мкг/л — дефицит железа; Hb <120 жен./<130
 *  муж. — анемия; HCT <36 жен./<41 муж. — подтверждение). Объём кардио −10%
 *  при анемии (пульс-цели при сниженном Hb завышены). */
export function cardioAnemiaSignals(labs: CardioLabsLike | null | undefined, sex: 'male' | 'female' = 'male'): CardioAnemiaResult {
  const warnings: string[] = [];
  const ferritinLow = labs?.ferritin != null && labs.ferritin > 0 && labs.ferritin < 30;
  const hbLow = labs?.hemoglobin != null && labs.hemoglobin > 0 && labs.hemoglobin < (sex === 'female' ? 120 : 130);
  const hctLow = labs?.hct != null && labs.hct > 0 && labs.hct < (sex === 'female' ? 36 : 41);
  if (ferritinLow) warnings.push(`Ферритин ${labs!.ferritin} мкг/л <30 — дефицит железа (часто у женщин на сушке); проверьте ферритин и статус железа.`);
  if (hbLow) warnings.push(`Гемоглобин ${labs!.hemoglobin} г/л — анемия: пульс-цели завышены, объём кардио снижен (−10%).`);
  if (hctLow) warnings.push(`Гематокрит ${labs!.hct}% — низкий: подтверждает анемию/переразведение.`);
  if (warnings.length === 0) warnings.push('Анемия не обнаружена.');
  const volumeMult = hbLow ? 0.9 : 1;
  return { warnings, volumeMult, ferritinLow, hbLow };
}

/** RED-S флаг: энергетическая доступность <30 ккал/кг FFM/день (Mountjoy 2014).
 *  Для prep-плана: текущие калории против FFM (вес × (1−%жира)).
 *  Возвращает null при отсутствии данных или EA ≥ 30. */
export function cardioRedSFlag(
  prep: CardioPrepPlanLike | null | undefined,
  opts: { bodyFatPct?: number; weightKg?: number; kcalPerDay?: number } = {},
): string | null {
  if (prep?.sex !== 'female') return null;
  const weight = prep.preparation?.startingWeightKg > 0 ? prep.preparation.startingWeightKg : opts.weightKg;
  const kcal = prep.preparation?.currentCalories > 0 ? prep.preparation.currentCalories : opts.kcalPerDay;
  const bf = opts.bodyFatPct != null && opts.bodyFatPct >= 0 ? opts.bodyFatPct / 100 : 0.22;
  if (!weight || !kcal || weight <= 0 || kcal <= 0) return null;
  const ffm = weight * (1 - bf);
  const ea = kcal / ffm;
  if (ea < 30) {
    return `RED-S: энергетическая доступность ${ea.toFixed(1)} ккал/кг FFM (<30) — объём кардио НЕ повышать, проверить калории prep-плана.`;
  }
  return null;
}

/** Каскад стартов A/B/C: главный A — полный taper + пик (только recovery);
 *  B — лёгкий taper (1-недельное окно, объём −30%, HIIT убран); C — без taper,
 *  HIIT убирается только в неделю старта. Уже размеченные taper/peak недели
 *  не перерезаются (идемпотентно). */
export function applyCardioCompetitionCascade(
  cycle: CardioCycle,
  competitions: { week: number; priority?: 'A' | 'B' | 'C' }[],
): CardioCycle {
  const pri = (p?: 'A' | 'B' | 'C') => (p === 'A' ? 0 : p === 'B' ? 1 : 2);
  const comps = [...competitions]
    .filter(c => c.week >= 1 && c.week <= cycle.totalWeeks)
    .sort((a, b) => (a.week !== b.week ? a.week - b.week : pri(a.priority) - pri(b.priority)));
  if (comps.length === 0) return cycle;
  const bw = cycleBodyWeight(cycle);
  const sex = cycle.config?.sex;
  let out = cycle;
  for (const comp of comps) {
    const priority = comp.priority ?? 'B';
    const weeks = out.weeks.map(w => {
      const delta = comp.week - w.week;
      if (delta < 0 || w.taper || w.deload || w.phase === 'peak') return w;
      if (priority === 'A') {
        if (delta === 0) {
          const sessions = [mkSession('recovery', 20, 1, 'День старта A: только лёгкая привычная активность', bw, undefined, sex)];
          return rebuildWeek({ ...w, phase: 'peak', taper: true }, sessions, ['ПЛ пик (A): только recovery 20 мин.']);
        }
        if (delta <= 2) {
          const mult = delta === 1 ? 0.5 : 0.7;
          const sessions = w.sessions
            .filter(s => s.type !== 'hiit' && (delta === 1 || s.type !== 'miss'))
            .map(s => recalcSessionKcal({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * mult)), weeklyFrequency: Math.max(1, Math.round(s.weeklyFrequency * (delta === 1 ? 1 : 0.8))) }, bw, sex));
          return rebuildWeek({ ...w, phase: 'taper', taper: true }, sessions, [`ПЛ taper (A) N-${delta}: объём снижен, HIIT${delta === 1 ? '/MISS' : ''} убраны.`]);
        }
        return w;
      }
      if (priority === 'B') {
        if (delta === 0 || delta === 1) {
          const sessions = w.sessions
            .filter(s => s.type !== 'hiit')
            .map(s => recalcSessionKcal({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * 0.7)) }, bw, sex));
          return rebuildWeek({ ...w, phase: 'taper', taper: true }, sessions, [`ПЛ taper (B) N-${delta}: объём −30%, HIIT убран.`]);
        }
        return w;
      }
      // C: старт без taper — только неделя старта без HIIT.
      if (delta === 0) {
        const sessions = w.sessions.filter(s => s.type !== 'hiit').map(s => recalcSessionKcal(s, bw, sex));
        return rebuildWeek(w, sessions, ['Старт C: без taper, HIIT убран в неделю старта.']);
      }
      return w;
    });
    out = { ...out, weeks, rationale: [...out.rationale, `Каскад стартов ПЛ: ${priority} — неделя ${comp.week}.`] };
  }
  return out;
}

// ─── Обратная связь: ACWR, ЧСС покоя, факт-ЧСС, совет prep по калориям ───

export interface CardioAcwrEntry {
  date: string;
  durationMin: number;
  rpe?: number;
  completed?: boolean;
}

/** ACWR кардио по дневнику (Foster 2001: sRPE-нагрузка = мин × RPE/10; acute 7д,
 *  chronic — среднее за 28д × 7). Нужно ≥2 записей за 28д. Зоны: ≥1.5 dangerous,
 *  ≥1.3 caution, <0.8 undertrained, иначе optimal. */
export function cardioAcwr(
  log: CardioAcwrEntry[],
  referenceIso?: string,
): { ratio: number; zone: 'dangerous' | 'caution' | 'optimal' | 'undertrained'; acuteLoad: number; chronicLoad: number; note: string } | null {
  const entries = (log ?? []).filter(e => e.durationMin > 0 && e.completed !== false);
  if (entries.length < 2) return null;
  const ref = referenceIso ?? todayLocalIso();
  const refMs = new Date(ref).getTime();
  const load = (e: CardioAcwrEntry) => (e.durationMin * (e.rpe && e.rpe > 0 ? e.rpe : 6)) / 10;
  const inWindow = (e: CardioAcwrEntry, from: number, to: number) => {
    const ms = new Date(e.date).getTime();
    // Верхняя граница хронического окна эксклюзивная — запись ровно на ref−7д
    // не попадает одновременно в acute и chronic. to==0 — включает сегодня (ms <= ref).
    return ms >= refMs - from * 86400000 && (to > 0 ? ms < refMs - to * 86400000 : ms <= refMs);
  };
  const acute = entries.filter(e => inWindow(e, 7, 0)).reduce((s, e) => s + load(e), 0);
  const chronicEntries = entries.filter(e => inWindow(e, 28, 7));
  // ACWR информативен только при достаточной базе: ≥4 сессий за 28д и охват ≥14д.
  // Иначе хроническая нагрузка занижена (сумма делится на 28 дней) — отношение неинформативно.
  if (chronicEntries.length < 4) return null;
  const chronicMs = chronicEntries.map(e => new Date(e.date).getTime());
  if (Math.max(...chronicMs) - Math.min(...chronicMs) < 14 * 86400000) return null;
  const chronic = (chronicEntries.reduce((s, e) => s + load(e), 0) / 28) * 7;
  if (chronic <= 0) return null;
  const ratio = acute / chronic;
  const zone = ratio >= 1.5 ? 'dangerous' : ratio >= 1.3 ? 'caution' : ratio < 0.8 ? 'undertrained' : 'optimal';
  const note = zone === 'dangerous'
    ? 'ACWR ≥1.5: резкий рост нагрузки — объём снизить, обязателен лёгкий день.'
    : zone === 'caution'
      ? 'ACWR 1.3-1.5: осторожно — объём не повышать эту неделю.'
      : zone === 'undertrained'
        ? 'ACWR <0.8: растренированность — можно мягко повысить объём.'
        : 'ACWR в норме — прогрессия по плану.';
  return { ratio, zone, acuteLoad: Math.round(acute), chronicLoad: Math.round(chronic), note };
}

export interface CardioHrEntry {
  date: string;
  hr?: number;
}

/** Сигнал ЧСС покоя по дневнику: среднее за последние 7д против среднего за
 *  21 день до этого окна; рост >5% → warning (переутомление/недовосстановление). */
export function cardioRestingHrSignal(
  entries: CardioHrEntry[],
  referenceIso?: string,
): { avg7: number | null; avg21: number | null; deltaPct: number | null; warning: string | null } {
  const ref = referenceIso ?? todayLocalIso();
  const refMs = new Date(ref).getTime();
  const withHr = (entries ?? []).filter(e => e.hr && e.hr > 30 && e.hr < 140).map(e => ({ ...e, ms: new Date(e.date).getTime() }));
  const avg = (from: number, to: number) => {
    const xs = withHr.filter(e => e.ms >= refMs - from * 86400000 && (to > 0 ? e.ms < refMs - to * 86400000 : e.ms <= refMs)).map(e => e.hr!);
    return xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  };
  const avg7 = avg(7, 0);
  const avg21 = avg(28, 7);
  let deltaPct: number | null = null;
  let warning: string | null = null;
  if (avg7 != null && avg21 != null && avg21 > 0) {
    deltaPct = ((avg7 - avg21) / avg21) * 100;
    if (deltaPct > 5) warning = `ЧСС покоя ↑ ${deltaPct.toFixed(1)}% (${avg21.toFixed(0)} → ${avg7.toFixed(0)} уд/мин) — возможное переутомление; объём кардио снизить.`;
  }
  return { avg7, avg21, deltaPct, warning };
}

/** Факт-ЧСС против целевых зон: если в прошедших неделях средний факт-пульс
 *  устойчиво выше верхней границы zone2 (+5), будущим неделям целевые зоны
 *  снижаются на 5 уд/мин (не ниже 60/70). Прошедшие недели не меняются. */
export function cardioFactHrAdjustment(
  cycle: CardioCycle,
  log: { date: string; avgHr?: number }[],
  referenceIso?: string,
): { cycle: CardioCycle; changes: CardioTuneChange[]; notes: string[] } {
  const ref = referenceIso ?? todayLocalIso();
  const currentWeek = cycle.startDate ? (cardioWeekForDate(cycle, ref, cycle.startDate)?.week ?? 1) : 1;
  const changes: CardioTuneChange[] = [];
  const notes: string[] = [];
  const weeks = cycle.weeks.map(w => {
    if (w.week <= currentWeek || w.phase === 'peak' || w.taper || w.deload) return w;
    const zone = w.sessions.find(s => s.targetHr)?.targetHr;
    if (!zone) return w;
    const min0 = zone.min ?? 110;
    const max0 = zone.max ?? 150;
    const weekStart = addDaysIso(cycle.startDate!, (w.week - 1) * 7);
    const weekEnd = addDaysIso(weekStart, 6);
    const facts = (log ?? []).filter(e => e.avgHr && e.avgHr > 0 && e.date >= weekStart && e.date <= weekEnd);
    if (facts.length === 0) return w;
    const avgFact = facts.reduce((s, e) => s + e.avgHr!, 0) / facts.length;
    if (avgFact <= max0 + 5) return w;
    const sessions = w.sessions.map(s => {
      if (!s.targetHr) return s;
      const min = Math.max(60, s.targetHr.min ?? min0 - 5);
      const max = Math.max(70, s.targetHr.max ?? max0 - 5);
      return { ...s, targetHr: { min, max }, purpose: `${s.purpose ?? ''} (факт-ЧСС ${avgFact.toFixed(0)} > ${max0}: зона −5)`.trim() };
    });
    changes.push({ week: w.week, label: 'Факт-ЧСС выше зоны — целевые зоны −5 уд/мин', from: `${min0}-${max0}`, to: `${Math.max(60, min0 - 5)}-${Math.max(70, max0 - 5)}` });
    return { ...w, sessions };
  });
  if (changes.length === 0) notes.push('Факт-ЧСС в пределах целевых зон.');
  else notes.push(`Факт-ЧСС: скорректированы зоны будущих недель — ${changes.length}.`);
  return { cycle: { ...cycle, weeks }, changes, notes };
}

export interface CardioPrepKcalAdvice {
  action: 'keep' | 'reduce_cardio' | 'increase_cardio' | 'increase_calories';
  reason: string;
  ratePctPerWeek: number | null;
  targetRange: [number, number];
  cardioAvgKcalPerWeek: number;
}

/** Совет по динамике веса для prep (ОДНА переменная за раз): слишком быстро
 *  (темп > 1.3× верхней границы) → кардио −10% ИЛИ калории +150; слишком медленно
 *  (темп < 0.8× нижней) → кардио +10% с оговоркой про низкие калории prep.
 *  В taper/пик корректировки не предлагаются. */
export function prepCardioKcalAdvice(
  prep: CardioPrepPlanLike | null | undefined,
  cycle: CardioCycle | null | undefined,
  weightLog: { date: string; weightKg: number }[],
  referenceIso?: string,
): CardioPrepKcalAdvice | null {
  if (!prep || !cycle) return null;
  const profile = cardioPrepCategoryProfile(prep.category, prep.sex);
  const targetRange: [number, number] = profile.targetRatePctPerWeek;
  const ref = referenceIso ?? todayLocalIso();
  const refMs = new Date(ref).getTime();
  const inWindow = (e: { date: string }, from: number, to: number) => {
    const ms = new Date(e.date).getTime();
    // Эксклюзивная верхняя граница для to>0 — запись на ref−7д не попадает в оба окна. to==0 включает сегодня.
    return ms >= refMs - from * 86400000 && (to > 0 ? ms < refMs - to * 86400000 : ms <= refMs);
  };
  const entries = (weightLog ?? []).filter(e => e.weightKg > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
  const avg7 = (() => {
    const xs = entries.filter(e => inWindow(e, 7, 0)).map(e => e.weightKg);
    return xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  })();
  const avgPrev7 = (() => {
    const xs = entries.filter(e => inWindow(e, 14, 7)).map(e => e.weightKg);
    return xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  })();
  const work = cycle.weeks.filter(w => w.phase === 'base' || w.phase === 'build' || w.phase === 'contest_prep');
  const cardioAvgKcalPerWeek = work.length > 0
    ? Math.round(work.reduce((s, w) => s + w.totalKcal, 0) / work.length)
    : cycle.totalKcal;
  // Guard по ТЕКУЩЕЙ неделе (не «в цикле вообще есть taper»): корректировки
  // запрещены только когда мы уже в taper/пике.
  const current = cycle.startDate ? cardioWeekForDate(cycle, ref, cycle.startDate) : null;
  const currentPhase = current?.phase;
  const taperPhase = currentPhase === 'taper' || currentPhase === 'peak';
  if (taperPhase || avg7 == null || avgPrev7 == null || avgPrev7 <= 0) {
    return {
      action: 'keep',
      reason: taperPhase ? 'Taper/пик: корректировки запрещены.' : 'Мало данных по весу — записывайте вес в дневник.',
      ratePctPerWeek: null,
      targetRange,
      cardioAvgKcalPerWeek,
    };
  }
  const rate = ((avg7 - avgPrev7) / avgPrev7) * 100;
  if (rate < 0 && Math.abs(rate) > targetRange[1] * 1.3) {
    return {
      action: 'reduce_cardio',
      reason: `Темп −${Math.abs(rate).toFixed(1)}%/нед быстрее цели ${targetRange[0]}-${targetRange[1]}%/нед. Одна переменная: кардио −10% (${Math.round(cardioAvgKcalPerWeek * 0.1)} ккал/нед) ИЛИ калории +150 (жёсткий дефицит разрушает мышцы).`,
      ratePctPerWeek: rate,
      targetRange,
      cardioAvgKcalPerWeek,
    };
  }
  if (Math.abs(rate) < targetRange[0] * 0.8) {
    return {
      action: 'increase_cardio',
      reason: `Темп ${Math.abs(rate).toFixed(1)}%/нед ниже цели. Кардио +10% (${Math.round(cardioAvgKcalPerWeek * 0.1)} ккал/нед) — при калориях <1500 ккал сначала увеличить калории (плато метаболизма).`,
      ratePctPerWeek: rate,
      targetRange,
      cardioAvgKcalPerWeek,
    };
  }
  return {
    action: 'keep',
    reason: `Темп ${Math.abs(rate).toFixed(1)}%/нед в цели ${targetRange[0]}-${targetRange[1]}%/нед — продолжайте.`,
    ratePctPerWeek: rate,
    targetRange,
    cardioAvgKcalPerWeek,
  };
}

export interface CardioPrepWeightCheck {
  lastKg: number | null;
  delta7d: number | null;
  delta14d: number | null;
  measurements: number;
}

export interface CardioPrepCheckIn {
  week: number | null;
  totalWeeks: number;
  phase: CardioPhase | null;
  daysToShow: number | null;
  weight: CardioPrepWeightCheck;
  restingHr: { avg7: number | null; avg21: number | null; deltaPct: number | null; warning: string | null };
  adherence: { plannedMinutes: number; doneMinutes: number; pct: number | null; skippedSessions: number };
  acwr: { ratio: number; zone: 'dangerous' | 'caution' | 'optimal' | 'undertrained'; note: string } | null;
  notes: string[];
}

/** Контрольные замеры prep: вес (последний/Δ7/Δ14), ЧСС покоя, выполнение
 *  текущей недели, ACWR кардио и дней до шоу — единая сводка «где я в
 *  подготовке». Чистая функция; данные — из журнала/лога веса/ЧСС покоя. */
export function cardioPrepCheckIn(
  prep: CardioPrepPlanLike | null | undefined,
  cycle: CardioCycle | null | undefined,
  log: { date: string; durationMin: number; rpe?: number; completed?: boolean }[],
  weightLog: { date: string; weightKg: number }[],
  hrEntries: CardioHrEntry[],
  referenceIso?: string,
): CardioPrepCheckIn | null {
  if (!prep || !cycle) return null;
  const ref = referenceIso ?? todayLocalIso();
  const refMs = new Date(ref).getTime();
  const totalWeeks = cycle.totalWeeks;
  const current = cycle.startDate ? cardioWeekForDate(cycle, ref, cycle.startDate) : null;
  const week = current?.week ?? null;
  const phase = current?.phase ?? null;

  let daysToShow: number | null = null;
  if (prep.showDate) {
    const show = new Date(prep.showDate).getTime();
    if (Number.isFinite(show)) daysToShow = Math.round((show - refMs) / 86400000);
  }

  const inWindow = (date: string, from: number, to: number) => {
    const ms = new Date(date).getTime();
    return ms >= refMs - from * 86400000 && (to > 0 ? ms < refMs - to * 86400000 : ms <= refMs);
  };
  const avgOf = (xs: number[]) => (xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

  const weights = (weightLog ?? []).filter(e => e.weightKg > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
  const avg7 = avgOf(weights.filter(e => inWindow(e.date, 7, 0)).map(e => e.weightKg));
  const avgPrev7 = avgOf(weights.filter(e => inWindow(e.date, 14, 7)).map(e => e.weightKg));
  const avgPrev14 = avgOf(weights.filter(e => inWindow(e.date, 21, 14)).map(e => e.weightKg));
  const weight: CardioPrepWeightCheck = {
    lastKg: weights.length > 0 ? weights[weights.length - 1].weightKg : null,
    delta7d: avg7 != null && avgPrev7 != null ? avg7 - avgPrev7 : null,
    delta14d: avg7 != null && avgPrev14 != null ? avg7 - avgPrev14 : null,
    measurements: weights.filter(e => inWindow(e.date, 28, 0)).length,
  };

  const restingHr = cardioRestingHrSignal(hrEntries, ref);

  let adherence = { plannedMinutes: 0, doneMinutes: 0, pct: null as number | null, skippedSessions: 0 };
  if (week != null && cycle.startDate) {
    const start = addDaysIso(cycle.startDate, (week - 1) * 7);
    const end = addDaysIso(start, 6);
    const plannedMinutes = current?.totalMinutes ?? 0;
    const done = (log ?? []).filter(e => e.completed !== false && e.date >= start && e.date <= end);
    const skipped = (log ?? []).filter(e => e.completed === false && e.date >= start && e.date <= end);
    const doneMinutes = done.reduce((s, e) => s + (e.durationMin || 0), 0);
    adherence = {
      plannedMinutes,
      doneMinutes,
      pct: plannedMinutes > 0 ? Math.round((doneMinutes / plannedMinutes) * 100) : null,
      skippedSessions: skipped.length,
    };
  }

  const acwrRaw = cardioAcwr(
    (log ?? []).map(e => ({ date: e.date, durationMin: e.durationMin, rpe: e.rpe, completed: e.completed })),
    ref,
  );
  const acwr = acwrRaw ? { ratio: acwrRaw.ratio, zone: acwrRaw.zone, note: acwrRaw.note } : null;

  const notes: string[] = [];
  if (restingHr.warning) notes.push(restingHr.warning);
  if (acwr) notes.push(acwr.note);
  if (adherence.pct != null && adherence.pct < 60) {
    notes.push(`Выполнение недели ${adherence.pct}% (${adherence.doneMinutes}/${adherence.plannedMinutes} мин) — разгрузите или перенесите сессии.`);
  }
  if (daysToShow != null && daysToShow <= 14 && phase !== 'transition' && phase !== null) {
    notes.push(`До шоу ${daysToShow} дн.: объём по taper-кривой, новых непривычных нагрузок не добавлять.`);
  }
  if (weight.delta7d != null && weight.delta7d > 0 && weight.measurements >= 3) {
    notes.push(`Вес ↑ ${weight.delta7d.toFixed(1)} кг за неделю — на дефиците проверить воду/натрий/электролиты.`);
  }
  if (notes.length === 0) notes.push('Замеры в норме: вес/ЧСС/выполнение без тревожных сигналов.');

  return { week, totalWeeks, phase, daysToShow, weight, restingHr, adherence, acwr, notes };
}

// ─── Сериализация / библиотека ───

export const CARDIO_CYCLES_KEY = 'he_cardio_cycles';
export const ACTIVE_CARDIO_CYCLE_KEY = 'he_active_cardio_cycle';

export function loadCardioCycles(): CardioCycle[] {
  try {
    const v = JSON.parse(localStorage.getItem(CARDIO_CYCLES_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((c): c is CardioCycle => !!c && typeof c === 'object' && Array.isArray(c.weeks)) : [];
  } catch { return []; }
}

export function saveCardioCycle(cycle: CardioCycle): void {
  const all = loadCardioCycles().filter(c => c.id !== cycle.id);
  all.unshift(cycle);
  try { localStorage.setItem(CARDIO_CYCLES_KEY, JSON.stringify(all.slice(0, 20))); } catch { /* ignore */ }
}

export function removeCardioCycle(id: string): void {
  try { localStorage.setItem(CARDIO_CYCLES_KEY, JSON.stringify(loadCardioCycles().filter(c => c.id !== id))); } catch { /* ignore */ }
}

export function loadActiveCardioCycle(): CardioCycle | null {
  try {
    const v = JSON.parse(localStorage.getItem(ACTIVE_CARDIO_CYCLE_KEY) ?? 'null');
    return v && typeof v === 'object' && Array.isArray(v.weeks) ? v as CardioCycle : null;
  } catch { return null; }
}

export function setActiveCardioCycle(cycle: CardioCycle | null): void {
  try {
    if (cycle) localStorage.setItem(ACTIVE_CARDIO_CYCLE_KEY, JSON.stringify(cycle));
    else localStorage.removeItem(ACTIVE_CARDIO_CYCLE_KEY);
  } catch { /* ignore */ }
}

// ─── Сценарии-снапшоты (как «📸 Сценарии года» макро) ───

export const CARDIO_SCENARIOS_KEY = 'he_cardio_scenarios';
const CARDIO_SCENARIOS_CAP = 6;

export interface CardioScenario {
  id: string;
  name: string;
  savedAt: string;
  cycle: CardioCycle;
}

export function loadCardioScenarios(): CardioScenario[] {
  try {
    const v = JSON.parse(localStorage.getItem(CARDIO_SCENARIOS_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is CardioScenario => !!x && typeof x === 'object' && x.cycle && Array.isArray(x.cycle.weeks)) : [];
  } catch { return []; }
}

export function saveCardioScenario(cycle: CardioCycle, name?: string): CardioScenario {
  const all = loadCardioScenarios();
  const sc: CardioScenario = { id: `sc-${Date.now()}`, name: name?.trim() || cycle.name, savedAt: new Date().toISOString(), cycle };
  all.unshift(sc);
  try { localStorage.setItem(CARDIO_SCENARIOS_KEY, JSON.stringify(all.slice(0, CARDIO_SCENARIOS_CAP))); } catch { /* ignore */ }
  return sc;
}

export function removeCardioScenario(id: string): void {
  try {
    localStorage.setItem(CARDIO_SCENARIOS_KEY, JSON.stringify(loadCardioScenarios().filter(s => s.id !== id)));
  } catch { /* ignore */ }
}

/** Чистая функция: распределить сессии по дням недели (Пн=0),
 *  пропуская дни тяжёлых ног для zone2/miss/hiit (recovery — в любой день).
 *  Стартовый день — referenceIso (неделя 1 цикла), иначе день сборки:
 *  иначе для циклов с прошедшей startDate «Сегодня»/календарь съезжают.
 *  Если все 7 дней заблокированы — интенсивные сессии остаются на заблокированном дне (конфликт будет показан в UI). */
export function assignSessionDays(sessions: CardioSession[], legDays?: number[], referenceIso?: string): CardioSession[] {
  const blocked = new Set((legDays ?? []).filter(d => d >= 0 && d <= 6));
  const out: CardioSession[] = [];
  const ref = referenceIso ? new Date(referenceIso) : new Date();
  let day = (ref.getDay() + 6) % 7;
  const avoid = (t: CardioType) => t !== 'recovery' && blocked.size > 0 && blocked.size < 7;
  for (const s of sessions) {
    if (s.dayOfWeek != null) { out.push(s); continue; }
    if (avoid(s.type)) {
      let guard = 0;
      while (blocked.has(day) && guard < 7) { day = (day + 1) % 7; guard++; }
    }
    out.push({ ...s, dayOfWeek: day });
    day = (day + 1) % 7;
  }
  return out;
}

/** Сессия недели, попавшая на день тяжёлых ног. */
export interface CardioLegDayConflict {
  dayOfWeek: number;
  sessions: CardioSession[];
}

/** Сессии недели, чей день (Пн=0) совпадает с днём тяжёлых ног цикла
 *  (zone2/miss/hiit — конфликт; recovery — лёгкое, не конфликт). */
export function cardioWeekLegConflicts(cycle: CardioCycle, weekNo: number): CardioLegDayConflict[] {
  const leg = new Set((cycle.config?.legDays ?? []).filter(d => d >= 0 && d <= 6));
  if (leg.size === 0) return [];
  const w = cycle.weeks.find(x => x.week === weekNo);
  if (!w) return [];
  const laid = spreadSessionsAcrossDays(w);
  const out: CardioLegDayConflict[] = [];
  for (let i = 0; i < 7; i++) {
    if (!leg.has(i)) continue;
    const sessions = laid.filter(s => s.dayOfWeek === i && s.type !== 'recovery');
    if (sessions.length > 0) out.push({ dayOfWeek: i, sessions });
  }
  return out;
}

// ─── Совет по динамике веса (плато на сушке) ───

export interface CardioWeightAdvice {
  action: 'increase' | 'keep';
  reason: string;
}

/** Плато веса 10-14 дней на cut/recomp → рекомендация добавить 10-15 мин Zone 2. */
export function cardioWeightAdvice(
  weightLog: { date: string; weight: number }[],
  cycle: CardioCycle,
  referenceIso?: string,
): CardioWeightAdvice {
  if (cycle.goal !== 'cut' && cycle.goal !== 'recomp' && cycle.goal !== 'bb_prep') {
    return { action: 'keep', reason: 'Совет по весу актуален для сушки/рекомпозиции/подготовки ББ.' };
  }
  const sorted = [...weightLog].filter(e => Number.isFinite(e.weight)).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length < 2) return { action: 'keep', reason: 'Недостаточно замеров веса для анализа.' };
  const ref = referenceIso ? new Date(referenceIso) : new Date();
  const refIso = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`;
  const recent = sorted.filter(e => e.date <= refIso).slice(-4);
  if (recent.length < 2) return { action: 'keep', reason: 'Недостаточно свежих замеров.' };
  const first = recent[0];
  const last = recent[recent.length - 1];
  const delta = last.weight - first.weight;
  const spanDays = Math.max(1, Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000));
  const weekly = (delta / spanDays) * 7;
  if (Math.abs(weekly) < 0.25) {
    return { action: 'increase', reason: `Вес стоит (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} кг за ${spanDays} дн) — добавьте 10-15 мин Zone 2 на неделю (одна переменная за раз).` };
  }
  return { action: 'keep', reason: `Темп снижения веса ${Math.abs(weekly).toFixed(2)} кг/нед — в норме, кардио менять не нужно.` };
}

/** Одно-кликовое применение рекомендации по весу: +N мин Zone 2 на рабочие недели. */
export function bumpCardioZone2Volume(cycle: CardioCycle, addMin = 15): CardioCycle {
  const bw = cycleBodyWeight(cycle);
  const ffm = cycleFfmKg(cycle);
  const sex = cycle.config?.sex;
  const weeks = cycle.weeks.map(w => {
    if (w.deload || w.taper || w.phase === 'peak' || w.phase === 'transition') return w;
    const sessions = w.sessions.map(s => {
      if (s.type !== 'zone2') return s;
      const durationMin = s.durationMin + addMin;
      return recalcSessionKcal({ ...s, durationMin }, bw, sex, ffm);
    });
    return rebuildWeek(w, sessions, ['⚖️ Zone 2 +' + addMin + ' мин (коррекция по весу)']);
  });
  return { ...cycle, weeks, source: cycle.source };
}

/** Безопасный бамп с правилом 10% (PRO): недельный объём не растёт >10%, иначе кап. Монотонность >2 — бамп запрещён. */
export function bumpCardioZone2VolumeGuarded(cycle: CardioCycle, addMin = 10, dailyTrimp?: number[]): { cycle: CardioCycle; capped: boolean; reason: string } {
  const mono = dailyTrimp && dailyTrimp.length > 0 ? cardioMonotonyStrain(dailyTrimp) : null;
  if (mono && mono.monotony > 2) {
    return { cycle, capped: true, reason: `Monotony ${mono.monotony} >2 — объём не повышаем (риск).` };
  }
  const bw = cycleBodyWeight(cycle);
  const ffm = cycleFfmKg(cycle);
  const sex = cycle.config?.sex;
  const weeks = cycle.weeks.map(w => {
    if (w.deload || w.taper || w.phase === 'peak' || w.phase === 'transition') return w;
    const oldTotal = w.totalMinutes;
    const capTotal = Math.round(oldTotal * 1.10);
    let sessions = w.sessions.map(s => s.type === 'zone2' ? recalcSessionKcal({ ...s, durationMin: s.durationMin + addMin }, bw, sex, ffm) : s);
    let newTotal = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
    if (newTotal > capTotal) {
      const scale = capTotal / newTotal;
      sessions = sessions.map(s => s.type === 'zone2' ? recalcSessionKcal({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * scale)) }, bw, sex, ffm) : s);
      newTotal = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
    }
    const capped = newTotal < oldTotal + addMin * w.sessions.filter(s => s.type === 'zone2').reduce((a, x) => a + x.weeklyFrequency, 0);
    return rebuildWeek(w, sessions, [capped ? `⚖️ Zone 2 +${addMin} мин (кап 10%: ${oldTotal}→${newTotal})` : `⚖️ Zone 2 +${addMin} мин (10% rule ok)`]);
  });
  return { cycle: { ...cycle, weeks, source: cycle.source }, capped: false, reason: 'Бамп применён в рамках 10% правила.' };
}

// ─── История версий цикла (undo авто-подстройки/правок) ───

export const CARDIO_HISTORY_KEY = 'he_cardio_cycle_history';
const CARDIO_HISTORY_CAP = 20;
export const CARDIO_UI_PREFS_KEY = 'he_cardio_ui_prefs';
export interface CardioUiPrefs { filters?: Record<string, string>; lastTab?: string }
export function loadCardioUiPrefs(): CardioUiPrefs {
  try { const v = JSON.parse(localStorage.getItem(CARDIO_UI_PREFS_KEY) ?? 'null'); return v && typeof v === 'object' ? v as CardioUiPrefs : {}; } catch { return {}; }
}
export function saveCardioUiPrefs(p: CardioUiPrefs): void { try { localStorage.setItem(CARDIO_UI_PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ } }

export interface CardioCycleVersion {
  id: string;
  cycleId: string;
  savedAt: string;
  reason: string;
  cycle: CardioCycle;
}

export function loadCardioCycleVersions(): CardioCycleVersion[] {
  try {
    const v = JSON.parse(localStorage.getItem(CARDIO_HISTORY_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is CardioCycleVersion => !!x && typeof x === 'object' && x.cycleId && x.cycle) : [];
  } catch { return []; }
}

/** Снапшот текущей версии цикла перед изменением (для undo). Хранит до 5 версий на цикл, 20 глобально. */
export function saveCardioCycleVersion(cycle: CardioCycle, reason: string): void {
  if (!cycle) return;
  const all = loadCardioCycleVersions();
  const snapshot: CardioCycle = JSON.parse(JSON.stringify(cycle));
  all.unshift({ id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, cycleId: cycle.id, savedAt: new Date().toISOString(), reason, cycle: snapshot });
  // cap per cycle: 5 на цикл
  const perCycle = new Map<string, number>();
  const filtered: typeof all = [];
  for (const v of all) {
    const cnt = perCycle.get(v.cycleId) ?? 0;
    if (cnt < 5) { filtered.push(v); perCycle.set(v.cycleId, cnt + 1); }
  }
  try { localStorage.setItem(CARDIO_HISTORY_KEY, JSON.stringify(filtered.slice(0, CARDIO_HISTORY_CAP))); } catch { /* ignore */ }
}

/** Последняя версия цикла для undo (или null). */
export function latestCardioCycleVersion(cycleId: string): CardioCycleVersion | null {
  return loadCardioCycleVersions().find(v => v.cycleId === cycleId) ?? null;
}

/** Восстановить последнюю версию цикла для undo. Снапшот НЕ удаляется:
 * повторный вызов снова вернёт ту же версию, а новый «Сохранить версию»
 * перезапишет её (LIFO). Для полной очистки истории — clearCardioCycleHistory. */
export function restoreCardioCycleVersion(cycleId: string): CardioCycle | null {
  const v = latestCardioCycleVersion(cycleId);
  return v ? v.cycle : null;
}

/** Очистить историю версий цикла (при полном удалении цикла). */
export function clearCardioCycleHistory(cycleId: string): void {
  try {
    localStorage.setItem(CARDIO_HISTORY_KEY, JSON.stringify(loadCardioCycleVersions().filter(v => v.cycleId !== cycleId)));
  } catch { /* ignore */ }
}

/** Миграция старого недельного CardioPlan → однонедельный CardioCycle. */
export function cardioPlanToCycle(plan: CardioPlan, goal: CardioGoal = 'maintenance'): CardioCycle {
  const week: CardioWeek = {
    week: 1,
    phase: 'maintenance',
    sessions: plan.sessions.filter(s => s.weeklyFrequency > 0),
    totalMinutes: plan.sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0),
    totalKcal: plan.totalKcalPerWeek,
    deload: false,
    taper: false,
    rationale: plan.rationale,
  };
  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    id: `cardio-migrated-${Date.now()}`,
    name: `Кардио ${CARDIO_GOAL_LABELS[goal].toLowerCase()} (миграция)`,
    goal,
    totalWeeks: 1,
    weeks: [week],
    totalKcal: plan.totalKcalPerWeek,
    source: 'imported',
    version: 1,
    createdAt: new Date().toISOString(),
    startDate: todayLocal,
    rationale: plan.rationale,
  };
}

/** Сводка цикла для UI: минуты/ккал в неделю по фазам. */
export function cardioCycleSummary(cycle: CardioCycle): {
  avgMinutesPerWeek: number;
  avgKcalPerWeek: number;
  phaseWeeks: Record<CardioPhase, number>;
  hiitWeeks: number;
} {
  const phaseWeeks: Record<CardioPhase, number> = { base: 0, build: 0, maintenance: 0, contest_prep: 0, taper: 0, peak: 0, transition: 0 };
  let totalMinutes = 0;
  let hiitWeeks = 0;
  for (const w of cycle.weeks) {
    phaseWeeks[w.phase] = (phaseWeeks[w.phase] ?? 0) + 1;
    totalMinutes += w.totalMinutes;
    if (w.sessions.some(s => s.type === 'hiit')) hiitWeeks += 1;
  }
  return {
    avgMinutesPerWeek: cycle.totalWeeks > 0 ? Math.round(totalMinutes / cycle.totalWeeks) : 0,
    avgKcalPerWeek: cycle.totalWeeks > 0 ? Math.round(cycle.totalKcal / cycle.totalWeeks) : 0,
    phaseWeeks,
    hiitWeeks,
  };
}

// ─── Адаптация к силовому плану и taper (PL/BB) ───

export interface StrengthContext {
  legDaysPerWeek?: number;
  acwr?: number | null;
  acwrZone?: 'optimal' | 'undertrained' | 'caution' | 'dangerous' | null;
  recoveryLow?: boolean;
  strengthPlanWeeks?: number;
  strengthPlanStartWeek?: number;
}

const ACWR_CAUTION = 1.3;
const ACWR_DANGEROUS = 1.5;

/** Вес, из которого собран цикл (для пересчёта ккал в адаптациях). */
export function cycleBodyWeight(cycle: CardioCycle): number {
  return typeof cycle.config?.bodyWeight === 'number' && cycle.config.bodyWeight > 0 ? cycle.config.bodyWeight : 80;
}
/** FFM (кг) из цикла, если известен bodyFatPct, иначе null. */
export function cycleFfmKg(cycle: CardioCycle): number | undefined {
  const bf = cycle.config?.bodyFatPct;
  const w = cycleBodyWeight(cycle);
  if (typeof bf === 'number' && Number.isFinite(bf) && bf >= 3 && bf <= 70) return Math.round(w * (1 - bf / 100) * 10) / 10;
  return undefined;
}
/** Эффективный вес для kкал: FFM если есть, иначе общий вес. */
export function cycleEffectiveWeight(cycle: CardioCycle): number {
  return cycleFfmKg(cycle) ?? cycleBodyWeight(cycle);
}

const LEG_MUSCLES = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'legs', 'quadriceps', 'hamstring']);

/** Число дней ног в неделе 1 ББ-плана (для адаптации раскладки кардио). */
export function legDaysFromBBPlan(plan: { weeks?: { sessions?: { blocks?: { muscle?: string }[] }[] }[] } | null | undefined): number {
  const w1 = plan?.weeks?.[0];
  if (!w1?.sessions) return 0;
  const days = new Set<number>();
  w1.sessions.forEach((s, idx) => {
    const hasLegs = (s.blocks ?? []).some(b => b.muscle && LEG_MUSCLES.has(String(b.muscle).toLowerCase()));
    if (hasLegs) days.add(idx);
  });
  return days.size;
}

function rebuildWeek(week: CardioWeek, sessions: CardioSession[], extraRationale: string[]): CardioWeek {
  const totalMinutes = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
  const totalKcal = sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0);
  return { ...week, sessions, totalMinutes, totalKcal, rationale: [...week.rationale, ...extraRationale] };
}

/** Пересчитать kcalPerSession под текущую длительность/оборудование.
 *  ЕДИНАЯ точка пересчёта: все адаптации (adapt/taper/tune/improve/bump)
 *  обязаны вызывать её при изменении durationMin — иначе минуты и ккал расходятся. */
export function recalcSessionKcal(session: CardioSession, bodyWeight?: number, sex?: 'male' | 'female', ffmKg?: number): CardioSession {
  return {
    ...session,
    kcalPerSession: kcalForCardio(session.type, session.durationMin, bodyWeight ?? 80, session.equipment, sex, ffmKg),
  };
}

/**
 * Согласовать кардио-цикл с силовым планом: ACWR-ограничения и конфликт с ногами.
 * Возвращает новый цикл; исходный не меняется.
 */
export function adaptCardioToStrength(cycle: CardioCycle, ctx: StrengthContext): CardioCycle {
  const acwr = ctx.acwr ?? null;
  const zone = ctx.acwrZone ?? (acwr != null ? (acwr >= ACWR_DANGEROUS ? 'dangerous' : acwr >= ACWR_CAUTION ? 'caution' : acwr < 0.8 ? 'undertrained' : 'optimal') : null);
  const legDays = Math.max(0, Math.round(ctx.legDaysPerWeek ?? 0));
  const recoveryLow = !!ctx.recoveryLow;
  const bw = cycleBodyWeight(cycle);
  const ffm = cycleFfmKg(cycle);
  const sex = cycle.config?.sex;
  const weeks = cycle.weeks.map(w => {
    const extra: string[] = [];
    let sessions = w.sessions;
    if (zone === 'dangerous') {
      sessions = sessions
        .filter(s => s.type === 'recovery' || s.type === 'zone2')
        .map(s => recalcSessionKcal({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * 0.6)), weeklyFrequency: Math.max(1, Math.round(s.weeklyFrequency * 0.6)) }, bw, sex, ffm));
      extra.push('ACWR опасный: только лёгкое кардио, объём −30-50%.');
    } else if (zone === 'caution') {
      sessions = sessions.filter(s => s.type !== 'hiit').map(s => recalcSessionKcal({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * 0.85)) }, bw, sex, ffm));
      extra.push('ACWR осторожный: HIIT убран, минуты −15%.');
    }
    if (recoveryLow) {
      const hadHiit = sessions.some(s => s.type === 'hiit');
      sessions = sessions.filter(s => s.type !== 'hiit');
      if (hadHiit) extra.push('Низкое восстановление: HIIT убран.');
    }
    if (legDays >= 4) {
      const hadIntense = sessions.some(s => s.type === 'hiit' || s.type === 'miss');
      sessions = sessions.map(s => s.type === 'miss' ? { ...s, type: 'zone2' as CardioType, intensity: 'moderate' as const, purpose: s.purpose } : s);
      if (sessions.some(s => s.type === 'hiit')) {
        sessions = sessions.filter(s => s.type !== 'hiit');
        if (hadIntense) extra.push('Высокая частота ног: интенсивное кардио заменено на zone2.');
      } else if (hadIntense) {
        extra.push('Высокая частота ног: интенсивное кардио заменено на zone2.');
      }
    }
    return rebuildWeek(w, sessions, extra);
  });
  const rationale = [...cycle.rationale];
  if (zone === 'dangerous') rationale.push('Адаптация к силовому плану: опасный ACWR.');
  else if (zone === 'caution') rationale.push('Адаптация к силовому плану: осторожный ACWR.');
  if (legDays >= 4) rationale.push('Адаптация к силовому плану: частые ноги → без HIIT/MISS.');
  return { ...cycle, weeks, rationale, source: cycle.source };
}

/**
 * PL taper: 2 недели перед стартом — объём ↓, HIIT убран заранее, пик — только recovery.
 * Идемпотентен: недели уже в фазе taper/peak не режутся повторно.
 */
export function applyPLCardioTaper(cycle: CardioCycle, opts: { competitionWeek: number; taperWeeks?: number }): CardioCycle {
  const compWeek = opts.competitionWeek;
  const taperWeeks = Math.max(1, Math.min(4, Math.round(opts.taperWeeks ?? 2)));
  const bw = cycleBodyWeight(cycle);
  const ffm = cycleFfmKg(cycle);
  const sex = cycle.config?.sex;
  const weeks = cycle.weeks.map(w => {
    const delta = compWeek - w.week;
    if (delta < 0 || w.taper || w.deload) return w;
    if (delta === 0) {
      const sessions = [mkSession('recovery', 20, 1, 'День старта: только лёгкая привычная активность', bw, undefined, sex)];
      return rebuildWeek({ ...w, phase: 'peak', taper: true }, sessions, ['PL пик: только recovery 20 мин.']);
    }
    if (delta <= taperWeeks) {
      let sessions = w.sessions.filter(s => s.type !== 'hiit');
      const mult = delta === 1 ? 0.5 : 0.7;
      sessions = sessions
        .filter(s => s.type === 'recovery' || s.type === 'zone2')
        .map(s => recalcSessionKcal({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * mult)), weeklyFrequency: Math.max(1, Math.round(s.weeklyFrequency * (delta === 1 ? 1 : 0.8))) }, bw, sex, ffm));
      const note = delta === 1 ? 'PL taper N-1: только лёгкое кардио.' : `PL taper N-${delta}: объём −30%, HIIT убран.`;
      return rebuildWeek({ ...w, phase: 'taper', taper: true }, sessions, [note]);
    }
    return w;
  });
  return { ...cycle, weeks, rationale: [...cycle.rationale, `PL taper к неделе ${compWeek} применён.`] };
}

/**
 * BB taper и peak week: перед шоу объём снижается постепенно, HIIT убирается
 * минимум за 2 недели; пик-неделя — только лёгкая привычная активность.
 * Кардио-сессии НЕ добавляются в силовой BB-план (только в CardioCycle).
 */
export function applyBBCardioTaper(cycle: CardioCycle, opts: { showWeek: number; peakWeek?: boolean; taperWeeks?: number }): CardioCycle {
  const showWeek = opts.showWeek;
  const taperWeeks = Math.max(1, Math.min(4, Math.round(opts.taperWeeks ?? 2)));
  const peakWeek = opts.peakWeek ?? true;
  const bw = cycleBodyWeight(cycle);
  const ffm = cycleFfmKg(cycle);
  const sex = cycle.config?.sex;
  const weeks = cycle.weeks.map(w => {
    const delta = showWeek - w.week;
    if (delta < 0 || w.taper || w.deload) return w;
    if (delta === 0 && peakWeek) {
      const sessions = [mkSession('recovery', 20, 1, 'Пик-неделя: лёгкая активность без утомления', bw, undefined, sex)];
      return rebuildWeek({ ...w, phase: 'peak', taper: true }, sessions, ['BB пик-неделя: только recovery, без HIIT/MISS.']);
    }
    if (delta <= taperWeeks) {
      // N-1: только zone2/recovery (MISS тоже убирается — в последнюю неделю
      // перед шоу никакой утомляющей аэробной работы); дальше — без HIIT.
      let sessions = w.sessions.filter(s => s.type !== 'hiit' && (delta === 1 ? s.type !== 'miss' : true));
      const mult = bbCardioTaperMult(delta); // 1→0.6, 2→0.7, 3→0.85, 4→0.9
      sessions = sessions.map(s => recalcSessionKcal({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * mult)) }, bw, sex, ffm));
      const note = delta === 1 ? 'BB taper N-1: объём снижен, только лёгкое кардио.' : `BB taper N-${delta}: объём −${Math.round((1 - mult) * 100)}%, HIIT убран.`;
      return rebuildWeek({ ...w, phase: 'taper', taper: true }, sessions, [note]);
    }
    return w;
  });
  return { ...cycle, weeks, rationale: [...cycle.rationale, `BB taper к неделе ${showWeek} применён.`] };
}

/** Применить taper к циклу по типу направления. */
export function applyCardioTaperBySport(cycle: CardioCycle, sport: 'pl' | 'bb', opts: { competitionWeek: number; peakWeek?: boolean }): CardioCycle {
  if (sport === 'pl') return applyPLCardioTaper(cycle, { competitionWeek: opts.competitionWeek });
  return applyBBCardioTaper(cycle, { showWeek: opts.competitionWeek, peakWeek: opts.peakWeek });
}

/**
 * Применить индивидуальный taper-план (Эпик F, individualizedTaperPlan) к циклу.
 * Окно: последние taperWeeks = round(durationDays/7) недель перед showWeek (кламп 1-4).
 * Множитель недели — непрерывный exponential (tauDays плана), а не ступенчатая
 * BB_CARDIO_TAPER_CURVE: N-1 — только zone2/recovery, остальные — без HIIT.
 * Идемпотентен: недели уже taper/peak/deload не режутся повторно.
 * Возвращает копию цикла + изменения (показывать пользователю на подтверждение).
 */
export function applyIndividualizedTaperToCycle(
  cycle: CardioCycle,
  plan: IndividualTaperPlan,
  opts: { showWeek: number },
): { cycle: CardioCycle; changes: CardioTuneChange[] } {
  const changes: CardioTuneChange[] = [];
  const showWeek = Math.round(opts.showWeek);
  const taperWeeks = Math.max(1, Math.min(4, Math.round(plan.durationDays / 7)));
  const totalDays = Math.max(7, plan.durationDays);
  const bw = cycleBodyWeight(cycle);
  const ffm = cycleFfmKg(cycle);
  const sex = cycle.config?.sex;
  const weeks = cycle.weeks.map(w => {
    const delta = showWeek - w.week; // 1 = ближайшая к шоу
    if (delta < 1 || delta > taperWeeks || w.taper || w.deload || w.phase === 'peak') return w;
    // день от старта taper-окна: дальняя неделя → 0, ближайшая → totalDays
    const dayFromStart = (taperWeeks - delta) * 7;
    const tau = Math.max(1, plan.tauDays);
    const r = Math.max(0, Math.min(0.9, plan.reductionPct / 100));
    const prog = 1 - Math.exp(-dayFromStart / tau);
    const full = 1 - Math.exp(-totalDays / tau);
    const mult = Math.round((1 - r * (full > 0 ? prog / full : 1)) * 1000) / 1000;
    const before = w.totalMinutes;
    let sessions = w.sessions.filter(s => s.type !== 'hiit' && (delta === 1 ? s.type !== 'miss' : true));
    sessions = sessions.map(s => recalcSessionKcal({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * mult)) }, bw, sex, ffm));
    const after = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
    changes.push({
      week: w.week,
      label: delta === 1 ? `Индивид. taper N-1 (exp τ=${tau}д): только лёгкое` : `Индивид. taper N-${delta} (exp τ=${tau}д, ×${mult})`,
      from: `${before} мин`,
      to: `${after} мин`,
    });
    return rebuildWeek({ ...w, phase: 'taper', taper: true }, sessions, [`Индивид. taper N-${delta}: ×${mult} (план −${plan.reductionPct}% за ${plan.durationDays}д, прогноз +${plan.expectedGainPct}%).`]);
  });
  return {
    cycle: { ...cycle, weeks, rationale: [...cycle.rationale, `Индивид. taper к неделе ${showWeek}: −${plan.reductionPct}% за ${plan.durationDays}д (exp τ=${plan.tauDays}д, прогноз +${plan.expectedGainPct}%).`] },
    changes,
  };
}

// ─── Экспорт .ics ───

function escIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcsDateTime(isoDate: string, timeHHmm = '06:00'): string {
  const d = isoDate.slice(0, 10);
  const t = timeHHmm.replace(':', '');
  return `${d.replace(/-/g, '')}T${t}00`;
}
function addMinutesToIcsDateTime(icsDateTime: string, minutes: number): string {
  const y = Number(icsDateTime.slice(0, 4));
  const m = Number(icsDateTime.slice(4, 6)) - 1;
  const d = Number(icsDateTime.slice(6, 8));
  const hh = Number(icsDateTime.slice(9, 11));
  const mm = Number(icsDateTime.slice(11, 13));
  const dt = new Date(y, m, d, hh, mm);
  dt.setMinutes(dt.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

function dayStartIso(week: number, referenceIso?: string): string {
  const ref = referenceIso ? new Date(referenceIso) : new Date();
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + (week - 1) * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Дата конкретного дня недели (dow 0-6, Пн=0) внутри недели цикла. */
function dayOfWeekIso(week: number, dow: number, referenceIso?: string): string {
  const ref = referenceIso ? new Date(referenceIso) : new Date();
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + (week - 1) * 7 + dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Календарь .ics: кардио-события по дням недели (тип, минуты, фаза). Учитывает weeklyFrequency и dayOfWeek, DTEND = DTSTART + duration. */
export function buildCardioIcs(cycle: CardioCycle, referenceIso?: string): string {
  const ref = referenceIso ?? cycle.startDate;
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BodyBuildHealth//CardioCycle//RU',
    'CALSCALE:GREGORIAN',
  ];
  for (const w of cycle.weeks) {
    const baseDay = dayStartIso(w.week, ref);
    for (let si = 0; si < w.sessions.length; si++) {
      const s = w.sessions[si];
      if (s.weeklyFrequency <= 0) continue;
      const freq = Math.max(1, Math.round(s.weeklyFrequency));
      for (let k = 0; k < freq; k++) {
        const isoDate = s.dayOfWeek != null ? dayOfWeekIso(w.week, (s.dayOfWeek + k) % 7, ref) : (() => {
          const base = new Date(baseDay.length === 10 ? baseDay + 'T00:00:00' : baseDay);
          base.setDate(base.getDate() + k);
          return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
        })();
        const dtStart = toIcsDateTime(isoDate, '06:00');
        const dtEnd = addMinutesToIcsDateTime(dtStart, s.durationMin);
        const summary = `Кардио ${s.type.toUpperCase()} ${s.durationMin} мин · нед ${w.week}`;
        const desc = `Фаза: ${CARDIO_PHASE_LABELS[w.phase]} · ${s.purpose}${s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}${w.deload ? ' · делод' : ''}${w.taper ? ' · taper' : ''}`;
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${cycle.id}-w${w.week}-${s.type}-${si}-${k}@bbh`);
        lines.push(`DTSTART:${dtStart}`);
        lines.push(`DTEND:${dtEnd}`);
        lines.push(`SUMMARY:${escIcs(summary)}`);
        lines.push(`DESCRIPTION:${escIcs(desc)}`);
        lines.push('END:VEVENT');
      }
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Экранирование XML для .tcx. */
function escXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Экспорт цикла в .tcx (Garmin Training Center): одна «деятельность» на
 *  сессию дня с длительностью, типом и примечанием. Если session.structured заданы интервалы — пишет Lap на каждый блок. */
export function buildCardioTcx(cycle: CardioCycle, referenceIso?: string): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">',
  ];
  let act = 0;
  for (const w of cycle.weeks) {
    for (const s of w.sessions) {
      if (s.weeklyFrequency <= 0) continue;
      const dateIso = s.dayOfWeek != null ? dayOfWeekIso(w.week, s.dayOfWeek, referenceIso) : dayStartIso(w.week, referenceIso);
      const start = dateIso + 'T' + '06:00:00Z';
      act++;
      lines.push('  <Activities><Activity Sport="Biking" ActivityType="Manual">');
      lines.push(`    <Id>${start}</Id>`);
      if (s.structured && s.structured.length > 0) {
        let t = new Date(start).getTime();
        for (const blk of s.structured) {
          for (let r = 0; r < blk.reps; r++) {
            const lapStart = new Date(t).toISOString().replace(/\.\d+Z$/, 'Z');
            t += blk.workSec * 1000;
            lines.push(`    <Lap StartTime="${lapStart}">`);
            lines.push(`      <TotalTimeSeconds>${blk.workSec}</TotalTimeSeconds>`);
            lines.push(`      <DistanceMeters>0</DistanceMeters>`);
            lines.push(`      <Calories>${Math.round(s.kcalPerSession * blk.workSec / (s.durationMin * 60))}</Calories>`);
            lines.push(`      <Intensity>Active</Intensity>`);
            lines.push('    </Lap>');
            if (blk.restSec > 0) {
              const restStart = new Date(t).toISOString().replace(/\.\d+Z$/, 'Z');
              t += blk.restSec * 1000;
              lines.push(`    <Lap StartTime="${restStart}">`);
              lines.push(`      <TotalTimeSeconds>${blk.restSec}</TotalTimeSeconds>`);
              lines.push(`      <DistanceMeters>0</DistanceMeters>`);
              lines.push(`      <Calories>0</Calories>`);
              lines.push(`      <Intensity>Resting</Intensity>`);
              lines.push('    </Lap>');
            }
          }
        }
      } else {
        lines.push(`    <Lap StartTime="${start}">`);
        lines.push(`      <TotalTimeSeconds>${s.durationMin * 60}</TotalTimeSeconds>`);
        lines.push(`      <DistanceMeters>0</DistanceMeters>`);
        lines.push(`      <Calories>${s.kcalPerSession}</Calories>`);
        lines.push(`      <Intensity>${s.type === 'hiit' ? 'Active' : 'Resting'}</Intensity>`);
        lines.push('    </Lap>');
      }
      lines.push(`    <Notes>${escXml(`Кардио ${s.type.toUpperCase()} · ${CARDIO_PHASE_LABELS[w.phase]} · нед ${w.week}${s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}`)}</Notes>`);
      lines.push('  </Activity></Activities>');
    }
  }
  lines.push('</TrainingCenterDatabase>');
  return lines.join('\r\n');
}

/** Экспорт первой недели цикла в Zwift .zwo (structured workout, bike/run). */
export function buildCardioZwo(cycle: CardioCycle, referenceIso?: string): string {
  const w = cycle.weeks[0];
  if (!w) return '<?xml version="1.0" encoding="UTF-8"?><workout_file><workout></workout></workout_file>';
  const sport = w.sessions.some(s => s.equipment === 'running') ? 'run' : 'bike';
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<workout_file>',
    `  <author>BodyBuildHealth</author>`,
    `  <name>${escXml(cycle.name)}</name>`,
    `  <description>${escXml(`Кардио ${CARDIO_GOAL_LABELS[cycle.goal]} · ${cycle.totalWeeks} нед · ${cycle.weeks[0].totalMinutes} мин/нед`)}</description>`,
    `  <sportType>${sport}</sportType>`,
    '  <workout>',
  ];
  for (const s of w.sessions) {
    if (s.structured && s.structured.length > 0) {
      for (const blk of s.structured) {
        const pwr = blk.target === 'power' ? blk.targetHr?.max ?? 65 : s.type === 'hiit' ? 95 : s.type === 'miss' ? 80 : 65;
        lines.push(`    <Warmup Duration="${blk.workSec}" PowerLow="${Math.max(0.3, pwr/100-0.1).toFixed(2)}" PowerHigh="${(pwr/100).toFixed(2)}" pace="0"/>`);
        if (blk.restSec > 0) lines.push(`    <SteadyState Duration="${blk.restSec}" Power="${(0.5).toFixed(2)}" pace="0"/>`);
      }
    } else {
      const pwrMap: Record<string, number> = { zone2: 0.65, miss: 0.8, hiit: 0.95, recovery: 0.5 };
      const pwr = pwrMap[s.type] ?? 0.65;
      if (s.type === 'hiit') {
        // 60/90 ×4 минимум
        const reps = Math.max(4, Math.round((s.durationMin * 60) / 150));
        lines.push(`    <IntervalsT Repeat="${reps}" OnDuration="60" OffDuration="90" OnPower="${pwr.toFixed(2)}" OffPower="0.45" pace="0"/>`);
      } else {
        lines.push(`    <SteadyState Duration="${s.durationMin * 60}" Power="${pwr.toFixed(2)}" pace="0"/>`);
      }
    }
  }
  lines.push('  </workout>');
  lines.push('</workout_file>');
  return lines.join('\r\n');
}

// ─── Следующая сессия ───

export interface CardioNextSession {
  date: string;
  week: number;
  session: CardioSession;
}

/** Ближайшая запланированная сессия от даты (с учётом дня недели сессии). */
export function cardioNextSession(cycle: CardioCycle, dateIso: string, referenceIso?: string): CardioNextSession | null {
  const parseLocal = (v: string) => new Date(v.length === 10 ? v + 'T00:00:00' : v);
  const start = parseLocal(dateIso);
  if (!Number.isFinite(start.getTime())) return null;
  const maxDays = Math.min(cycle.totalWeeks * 7, 365);
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const week = cardioWeekForDate(cycle, iso, referenceIso);
    if (!week) continue;
    const dow = (d.getDay() + 6) % 7;
    const s = week.sessions.find(x => x.dayOfWeek === dow);
    if (s) return { date: iso, week: week.week, session: s };
  }
  return null;
}

// ─── Перенос сессии (reschedule) ───

export interface CardioRescheduleResult {
  cycle: CardioCycle;
  changes: CardioTuneChange[];
}

/**
 * Перенести плановую сессию с даты на ближайший свободный день её недели.
 * Плановая сессия на дату ищется по dayOfWeek; свободный день — следующий
 * (по кругу), на котором нет плановой сессии. Возвращает копию цикла;
 * без сессии на дату или без свободного дня — цикл не меняется.
 */
export function rescheduleCardioSession(cycle: CardioCycle, dateIso: string, opts: { referenceIso?: string } = {}): CardioRescheduleResult {
  const parseLocal = (v: string) => new Date(v.length === 10 ? v + 'T00:00:00' : v);
  const ref = opts.referenceIso ?? cycle.startDate;
  const week = cardioWeekForDate(cycle, dateIso, ref);
  if (!week) return { cycle, changes: [] };
  const target = parseLocal(dateIso);
  if (!Number.isFinite(target.getTime())) return { cycle, changes: [] };
  const dow = (target.getDay() + 6) % 7;
  const planned = week.sessions.find(s => (s.dayOfWeek ?? dow) === dow);
  if (!planned) return { cycle, changes: [] };
  let next = dow;
  let guard = 0;
  do {
    next = (next + 1) % 7;
    guard++;
  } while (guard < 7 && week.sessions.some(s => s.dayOfWeek === next));
  if (guard >= 7 || next === dow) return { cycle, changes: [] };
  const sessions = week.sessions.map(s => (s === planned ? { ...s, dayOfWeek: next } : s));
  const week2 = rebuildWeek({ ...week, sessions }, sessions, []);
  const weeks = cycle.weeks.map(w => (w.week === week.week ? week2 : w));
  return {
    cycle: { ...cycle, weeks },
    changes: [{ week: week.week, label: 'Сессия перенесена', from: DAY_LABELS_RU[dow], to: DAY_LABELS_RU[next] }],
  };
}

// ─── Конвертация в UserProgram (отдельная тренировочная программа) ───

const CARDIO_TO_PHASE: Record<CardioPhase, 'accumulation' | 'intensification' | 'deload' | 'peaking'> = {
  base: 'accumulation',
  build: 'intensification',
  maintenance: 'accumulation',
  contest_prep: 'intensification',
  taper: 'deload',
  peak: 'peaking',
  transition: 'deload',
};

const CARDIO_TYPE_RU: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Recovery' };

/**
 * Экспорт CardioCycle как самостоятельной UserProgram (BB-структура) —
 * открывается в ручном конструкторе и может выполняться как обычная программа.
 */
export function cardioCycleToUserProgram(cycle: CardioCycle): import('../user-program/user-program.types').UserProgram {
  const weeks: import('../user-program/user-program.types').UserWeek[] = cycle.weeks.map(w => {
    const sessions: import('../user-program/user-program.types').UserSession[] = [];
    for (const s of w.sessions) {
      // Раскрываем weeklyFrequency в отдельные дни (день недели сдвигается),
      // чтобы программа отражала реальную частоту, а не одну сессию.
      for (let k = 0; k < s.weeklyFrequency; k++) {
        const dayOfWeek = s.dayOfWeek != null ? (s.dayOfWeek + k) % 7 : undefined;
        sessions.push({
          id: newId('ses'),
          name: `Кардио: ${CARDIO_TYPE_RU[s.type]} ${s.durationMin} мин`,
          dayOfWeek,
          focus: 'cardio',
          estimatedMin: s.durationMin,
          blocks: [{
            id: newId('blk'),
            type: 'accessory',
            exerciseName: `Кардио ${s.type.toUpperCase()} ${s.durationMin} мин${s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}`,
            muscle: 'cardio',
            role: 'primary',
            sets: [{ reps: 1, rir: 0, weight: 0, restSec: 60 }],
            note: `${s.purpose}${s.targetHr?.max ? ` · ЧСС ${s.targetHr.min}-${s.targetHr.max}` : ''}`,
            character: s.type === 'hiit' ? 'тяж' : s.type === 'recovery' ? 'лёг' : 'памп',
          }],
        });
      }
    }
    return { week: w.week, phase: CARDIO_TO_PHASE[w.phase] ?? 'accumulation', deload: w.deload, sessions };
  });
  const now = new Date().toISOString();
  const avgFreq = Math.max(1, Math.round(cycle.weeks.reduce((sum, w) => sum + w.sessions.reduce((a, x) => a + x.weeklyFrequency, 0), 0) / Math.max(1, cycle.totalWeeks)));
  return {
    meta: {
      id: newId('prog'),
      title: cycle.name,
      author: 'Кардио-конструктор',
      goal: cycle.goal,
      level: 'intermediate',
      daysPerWeek: Math.min(7, avgFreq),
      weeks: cycle.totalWeeks,
      direction: 'bb',
      createdAt: now,
      updatedAt: now,
      source: 'from_build',
      tags: ['cardio'],
      trainingFocus: 'endurance',
    },
    bb: {
      direction: 'bb',
      microcycleTemplate: { daySlots: [] },
      weeks,
      volumeBudget: {},
      progression: { loadStrategy: 'linear', deloadProtocol: 'mini', intensityTechniques: [] },
      constraints: { equipment: (cycle.weeks[0]?.sessions ?? []).map(s => s.equipment ? cardioEquipmentLabel(s.equipment) : '').filter(Boolean) },
    },
  };
}

// ─── Текстовая сводка (копирование в буфер) ───

/** Текстовое расписание цикла для буфера обмена. */
export function buildCardioSummaryText(cycle: CardioCycle): string {
  const s = cardioCycleSummary(cycle);
  const lines: string[] = [];
  lines.push(`❤️ ${cycle.name}`);
  lines.push(`Цель: ${CARDIO_GOAL_LABELS[cycle.goal]} · ${cycle.totalWeeks} нед · в среднем ${s.avgMinutesPerWeek} мин/нед · ${s.avgKcalPerWeek} ккал/нед · ${s.hiitWeeks} HIIT-нед`);
  if (cycle.linkedCompetitionIds?.length) lines.push(`Старты: ${cycle.linkedCompetitionIds.length}`);
  const legDays = (cycle.config?.legDays ?? []).filter(d => d >= 0 && d <= 6);
  if (legDays.length > 0) lines.push(`🦵 Дни тяжёлых ног: ${legDays.map(d => DAY_LABELS_RU[d]).join(', ')} — интенсивное кардио на них не ставится (recovery — можно).`);
  lines.push('── Недели ──');
  for (const w of cycle.weeks) {
    const sessions = w.sessions
      .map(x => `${x.type.toUpperCase()} ${x.durationMin}×${x.weeklyFrequency}${x.equipment ? ' (' + cardioEquipmentLabel(x.equipment) + ')' : ''}${x.targetHr?.max ? ' ЧСС ' + x.targetHr.min + '-' + x.targetHr.max : ''}`)
      .join(', ');
    const marks = [w.deload ? 'делод' : null, w.taper ? 'taper' : null].filter(Boolean).join('+');
    lines.push(`Нед ${w.week} · ${CARDIO_PHASE_LABELS[w.phase]}${marks ? ' · ' + marks : ''}: ${sessions} — ${w.totalMinutes} мин, ${w.totalKcal} ккал`);
  }
  const forecast = cardioFitnessForecast(cycle);
  lines.push(`📈 Прогноз адаптации: +${forecast.vo2GainPct}% VO2max за цикл (${forecast.effectiveWeeks} рабочих нед).`);
  const tests = cardioCoachHints(cycle).filter(h => h.kind === 'test');
  if (tests.length > 0) lines.push(`🔬 Контрольные замеры: недели ${tests.map(t => t.week).join(', ')}.`);
  if (cycle.rationale.length > 0) {
    lines.push('── Обоснование ──');
    lines.push(...cycle.rationale);
  }
  return lines.join('\n');
}

// ─── Мост в планировщик питания (ккал кардио) ───

export interface CardioNutritionPayload {
  text: string;
  avgKcalPerWeek: number;
  avgMinutesPerWeek: number;
  todayMinutes: number;
  todayKcal: number;
}

/**
 * Полезная нагрузка «кардио → питание»: средний расход ккал/нед цикла
 * и факт за сегодня (журнал). Чистая функция — handler моста и кнопка
 * «🍽 В питание» используют её, чтобы цифры не расходились.
 */
export function cardioToNutritionPayload(
  cycle: CardioCycle,
  log: { date: string; durationMin: number; calories?: number; completed: boolean }[],
  todayIso?: string,
): CardioNutritionPayload {
  const s = cardioCycleSummary(cycle);
  const d = todayIso ? new Date(todayIso) : new Date();
  const iso = todayIso ?? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fact = log.filter(e => e.completed && e.date === iso);
  const todayMinutes = fact.reduce((sum, e) => sum + e.durationMin, 0);
  const todayKcal = fact.reduce((sum, e) => sum + (e.calories ?? 0), 0);
  const text = [
    `❤️ ${cycle.name}: расход ~${s.avgKcalPerWeek} ккал/нед (${s.avgMinutesPerWeek} мин/нед)`,
    todayMinutes > 0 ? `🔥 Сегодня: ${todayMinutes} мин · ${todayKcal} ккал` : '🔥 Сегодня: кардио не записано',
    '🍽 Учитывайте расход в дефиците: цель = BMR×PAL − дефицит + кардио (темп 0.5-1%/нед).',
  ].join('\n');
  return { text, avgKcalPerWeek: s.avgKcalPerWeek, avgMinutesPerWeek: s.avgMinutesPerWeek, todayMinutes, todayKcal };
}

// ─── Печатная сводка ───

function escHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** HTML-сводка цикла для печати (XSS-safe экранирование пользовательских названий). */
export function buildCardioPrintHtml(cycle: CardioCycle): string {
  const summary = cardioCycleSummary(cycle);
  const legDays = (cycle.config?.legDays ?? []).filter(d => d >= 0 && d <= 6);
  const phaseRows = (Object.keys(summary.phaseWeeks) as CardioPhase[])
    .filter(p => summary.phaseWeeks[p] > 0)
    .map(p => `<tr><td>${escHtml(CARDIO_PHASE_LABELS[p])}</td><td>${summary.phaseWeeks[p]}</td></tr>`)
    .join('');
  const weekRows = cycle.weeks.map(w => {
    const sessions = w.sessions
      .map(s => `${s.type.toUpperCase()} ${s.durationMin} мин ×${s.weeklyFrequency}`)
      .join(' · ');
    const marks = [w.deload ? 'делод' : null, w.taper ? 'taper' : null].filter(Boolean).join(' + ');
    return `<tr><td>${w.week}</td><td>${escHtml(CARDIO_PHASE_LABELS[w.phase])}</td><td>${escHtml(sessions)}</td><td>${w.totalMinutes}</td><td>${w.totalKcal}</td><td>${escHtml(marks)}</td></tr>`;
  }).join('');
  const dayRows = cycle.weeks.map(w => {
    const cells = DAY_LABELS_RU.map((d, di) => {
      const sess = spreadSessionsAcrossDays(w).filter(s => s.dayOfWeek === di);
      const isLeg = legDays.includes(di);
      const content = sess.length === 0
        ? '—'
        : sess.map(s => `${s.type.toUpperCase()} ${s.durationMin}м${s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}${s.targetHr?.max ? '<br>ЧСС ' + s.targetHr.min + '-' + s.targetHr.max : ''}`).join('<br>');
      return `<td style="vertical-align:top;font-size:11px${isLeg ? ';background:#fff7e0' : ''}">${isLeg ? '🦵 ' : ''}${escHtml(content)}</td>`;
    }).join('');
    return `<tr><td style="font-weight:700;font-size:11px">Нед ${w.week}<br>${escHtml(CARDIO_PHASE_LABELS[w.phase])}</td>${cells}</tr>`;
  }).join('');
  const forecast = cardioFitnessForecast(cycle);
  const quality = cardioQualityReport(cycle, 7);
  const qualityRows = quality.findings.map(f => `<tr><td>${f.level === 'warn' ? '⚠' : f.level === 'ok' ? '✅' : '💡'}</td><td>${escHtml(f.text)}</td></tr>`).join('');
  const hintRows = cardioCoachHints(cycle)
    .filter(h => h.kind !== 'work')
    .map(h => `<tr><td>${h.week}</td><td>${escHtml(CARDIO_PHASE_LABELS[h.phase])}</td><td>${escHtml(h.text)}</td></tr>`)
    .join('');
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${escHtml(cycle.name)}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%;margin-top:12px}
th,td{border:1px solid #ccc;padding:6px 10px;font-size:13px;text-align:left}th{background:#f0f0f0}h2{font-size:18px}</style></head>
<body><h2>❤️ ${escHtml(cycle.name)}</h2>
<p>Цель: ${escHtml(CARDIO_GOAL_LABELS[cycle.goal])} · ${cycle.totalWeeks} нед · в среднем ${summary.avgMinutesPerWeek} мин/нед · ${summary.avgKcalPerWeek} ккал/нед</p>
${legDays.length > 0 ? `<p style="font-size:12px;color:#8a6d1a">🦵 Дни тяжёлых ног: ${legDays.map(d => escHtml(DAY_LABELS_RU[d])).join(', ')} — интенсивное кардио на них не ставится (recovery — можно).</p>` : ''}
<p style="font-size:12px;color:#555">📈 Прогноз адаптации: +${forecast.vo2GainPct}% VO2max за цикл (${forecast.effectiveWeeks} рабочих нед). ${escHtml(forecast.note)}</p>
${cycle.linkedMacrocycleId ? '<p style="font-size:12px;color:#555">🗓 Привязан к годовому плану (cardioCycleId).</p>' : ''}
${cycle.config?.bodyFatPct ? `<p style="font-size:12px;color:#555">FFM ${cycleFfmKg(cycle) ?? '—'} кг (жир ${cycle.config.bodyFatPct}%) — расход по безжировой массе.</p>` : ''}
${cycle.rationale.map(r => `<p style="font-size:12px;color:#555">${escHtml(r)}</p>`).join('')}
<h3>📊 Качество цикла: ${quality.score}/100</h3><table><tr><th>Уровень</th><th>Вывод</th></tr>${qualityRows}</table>
<h3>Фазы</h3><table><tr><th>Фаза</th><th>Недель</th></tr>${phaseRows}</table>
<h3>Недели</h3><table><tr><th>Нед</th><th>Фаза</th><th>Сессии</th><th>Мин</th><th>Ккал</th><th>Метки</th></tr>${weekRows}</table>
${hintRows ? `<h3>💡 Ключевые недели</h3><table><tr><th>Нед</th><th>Фаза</th><th>Что делать</th></tr>${hintRows}</table>` : ''}
<h3>🗓 Недели по дням (Пн-Вс)</h3><table><tr><th>Неделя</th><th>Пн</th><th>Вт</th><th>Ср</th><th>Чт</th><th>Пт</th><th>Сб</th><th>Вс</th></tr>${dayRows}</table>
</body></html>`;
}

// ─── Сравнение сценариев ───

export interface CardioCycleDiff {
  field: string;
  label: string;
  from: string;
  to: string;
  delta: number;
}

export interface CardioCycleComparison {
  a: { id: string; name: string };
  b: { id: string; name: string };
  diffs: CardioCycleDiff[];
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** Сравнение двух кардио-сценариев: недели, минуты, ккал, HIIT-недели, фазы. */
export function compareCardioCycles(a: CardioCycle, b: CardioCycle): CardioCycleComparison {
  const sa = cardioCycleSummary(a);
  const sb = cardioCycleSummary(b);
  const diffs: CardioCycleDiff[] = [];
  const add = (field: string, label: string, from: number, to: number, unit = '') => {
    if (from === to) return;
    diffs.push({ field, label, from: `${from}${unit}`, to: `${to}${unit}`, delta: to - from });
  };
  add('weeks', 'Недель', a.totalWeeks, b.totalWeeks);
  add('minutes', 'Мин/нед', sa.avgMinutesPerWeek, sb.avgMinutesPerWeek);
  add('kcal', 'Ккал/нед', sa.avgKcalPerWeek, sb.avgKcalPerWeek);
  add('hiit', 'HIIT-недель', sa.hiitWeeks, sb.hiitWeeks);
  const phases = Object.keys(CARDIO_PHASE_LABELS) as CardioPhase[];
  for (const p of phases) {
    add('phase_' + p, `Фаза «${CARDIO_PHASE_LABELS[p]}»`, sa.phaseWeeks[p] ?? 0, sb.phaseWeeks[p] ?? 0, ' нед');
  }
  return {
    a: { id: a.id, name: a.name },
    b: { id: b.id, name: b.name },
    diffs,
  };
}

/** Человекочитаемая строка сравнения (для UI/toast). */
export function formatCardioComparison(cmp: CardioCycleComparison): string {
  if (cmp.diffs.length === 0) return 'Сценарии идентичны по нагрузке.';
  return cmp.diffs
    .map(d => `${d.label}: ${d.from} → ${d.to} (${signed(d.delta)})`)
    .join(' · ');
}

// ─── Проф-инструмент: даты, пульс-зоны, авто-подстройка ───

export const DAY_LABELS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Раскладка сессий недели по дням (равномерно от reference-дня; сессии получают dayOfWeek). */
export function spreadSessionsAcrossDays(week: CardioWeek, referenceIso?: string): CardioSession[] {
  const ref = referenceIso ? new Date(referenceIso) : new Date();
  const startDow = (ref.getDay() + 6) % 7; // Пн=0
  const sessions: CardioSession[] = [];
  let dayIdx = startDow;
  for (const s of week.sessions) {
    const sched: CardioSession = { ...s, dayOfWeek: s.dayOfWeek ?? dayIdx };
    sessions.push(sched);
    dayIdx = (dayIdx + 1) % 7;
  }
  return sessions;
}

/** Активная неделя цикла по локальной дате (неделя 1 = reference). */
export function cardioWeekForDate(cycle: CardioCycle, dateIso: string, referenceIso?: string): CardioWeek | null {
  const parseLocal = (v: string) => new Date(v.length === 10 ? v + 'T00:00:00' : v);
  const ref = referenceIso ? parseLocal(referenceIso) : (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
  const target = parseLocal(dateIso);
  if (!Number.isFinite(target.getTime())) return null;
  const diffDays = Math.round((target.getTime() - ref.getTime()) / 86400000);
  const week = Math.floor(diffDays / 7) + 1;
  return cycle.weeks.find(w => w.week === week) ?? null;
}

export interface CardioLegDayInfo {
  dayOfWeek: number;
  isLegDay: boolean;
}

/** День недели (Пн=0) даты и является ли он днём тяжёлых ног цикла. */
export function cardioLegDayForDate(cycle: CardioCycle | null, dateIso: string): CardioLegDayInfo | null {
  if (!cycle) return null;
  const d = new Date(dateIso.length === 10 ? dateIso + 'T00:00:00' : dateIso);
  if (!Number.isFinite(d.getTime())) return null;
  const dayOfWeek = (d.getDay() + 6) % 7;
  const leg = new Set((cycle.config?.legDays ?? []).filter(x => x >= 0 && x <= 6));
  return { dayOfWeek, isLegDay: leg.has(dayOfWeek) };
}

/** Сессии на конкретную дату (раскладка по дням недели, без силового контекста). */
export function cardioSessionsForDate(cycle: CardioCycle, dateIso: string, referenceIso?: string): { week: CardioWeek; sessions: CardioSession[] } | null {
  const week = cardioWeekForDate(cycle, dateIso, referenceIso);
  if (!week) return null;
  const parseLocal = (v: string) => new Date(v.length === 10 ? v + 'T00:00:00' : v);
  const ref = referenceIso ? parseLocal(referenceIso) : (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
  const target = parseLocal(dateIso);
  const dow = (target.getDay() + 6) % 7;
  const startDow = (ref.getDay() + 6) % 7;
  const spread = spreadSessionsAcrossDays(week, referenceIso);
  const weekdaySessions = spread.filter(s => (s.dayOfWeek ?? startDow) === dow);
  return { week, sessions: weekdaySessions };
}

/** Серии объёма по неделям для графика (мин/ккал/фаза). */
export function cardioVolumeSeries(cycle: CardioCycle): { week: number; minutes: number; kcal: number; phase: CardioPhase; taper: boolean }[] {
  return cycle.weeks.map(w => ({ week: w.week, minutes: w.totalMinutes, kcal: w.totalKcal, phase: w.phase, taper: w.taper || w.deload }));
}

export interface CardioTuneChange {
  week: number;
  label: string;
  from: string;
  to: string;
}

export interface CardioTuneResult {
  cycle: CardioCycle;
  changes: CardioTuneChange[];
  advice: CardioAdviceLike;
}

export interface CardioAdviceLike {
  action: 'reduce' | 'keep' | 'increase';
  reason: string;
}

/**
 * Авто-подстройка цикла по дневнику: «одна переменная за раз».
 * - adherence сессий <60% → частоту zone2/recovery −1;
 * - средний RPE ≥8 → минуты −10% (интенсивность не трогаем);
 * - adherence >110% и RPE <6 → минуты +10% (для cut/recomp);
 * - ACWR ≥1.5 → HIIT убрать; ACWR 1.3-1.5 → минуты −15%;
 * - делод/taper/peak недели не трогаются.
 * Возвращает копию цикла + список изменений (для подтверждения пользователем).
 */
export function autoTuneCardioCycle(
  cycle: CardioCycle,
  log: { date: string; durationMin: number; rpe?: number; completed: boolean }[],
  opts: { acwr?: number | null; referenceIso?: string } = {},
): CardioTuneResult {
  const parseLocal = (v: string) => new Date(v.length === 10 ? v + 'T00:00:00' : v);
  const ref = opts.referenceIso ? parseLocal(opts.referenceIso) : new Date();
  const refIso = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`;
  const currentWeek = cardioWeekForDate(cycle, refIso, cycle.startDate)?.week ?? cycle.totalWeeks;
  // База окон недель — cycle.startDate (неделя 1 цикла); referenceIso — только
  // «текущая дата» для определения текущей недели.
  const base = cycle.startDate ? parseLocal(cycle.startDate) : ref;
  const changes: CardioTuneChange[] = [];
  // ACWR: явный opts.acwr (извне) либо из дневника (кардио-журнал, окна 7/28д).
  const acwr = opts.acwr != null
    ? { ratio: opts.acwr, fromLog: false }
    : (() => {
        const r = cardioAcwr(log, refIso);
        return r ? { ratio: r.ratio, fromLog: true } : null;
      })();
  // Статистика недель для недельной прогрессии (4D).
  const weekStats: { week: number; doneCount: number; pct: number; avgRpe: number; rest: boolean }[] = [];
  const weeks = cycle.weeks.map(w => {
    if (w.deload || w.taper || w.phase === 'peak' || w.phase === 'transition') {
      weekStats.push({ week: w.week, doneCount: 0, pct: 0, avgRpe: 0, rest: true });
      return w;
    }
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (w.week - 1) * 7);
    const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + w.week * 7);
    const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    const done = log.filter(e => e.completed && e.date >= startIso && e.date < endIso);
    const plannedSessions = w.sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    const pct = plannedSessions > 0 ? done.length / plannedSessions : 0;
    const avgRpe = done.filter(e => typeof e.rpe === 'number').reduce((s, e) => s + (e.rpe ?? 0), 0) / Math.max(1, done.filter(e => typeof e.rpe === 'number').length);
    weekStats.push({ week: w.week, doneCount: done.length, pct, avgRpe, rest: false });
    // Прошлые недели не трогаем: авто-тюн применяется только к текущей и будущим
    // (иначе «план vs факт» уже прожитых недель меняется ретроспективно).
    if (w.week < currentWeek) return w;
    let sessions = w.sessions;
    const bw = cycleBodyWeight(cycle);
    const ffm = cycleFfmKg(cycle);
    const sex = cycle.config?.sex;
    const cw = (label: string, from: string, to: string) => changes.push({ week: w.week, label, from, to });
    if (acwr != null && acwr.ratio >= 1.5 && sessions.some(s => s.type === 'hiit')) {
      sessions = sessions.filter(s => s.type !== 'hiit');
      cw('ACWR опасный → HIIT убран', `HIIT ×${w.sessions.filter(s => s.type === 'hiit').reduce((s, x) => s + x.weeklyFrequency, 0)}`, '0');
    } else if (acwr != null && acwr.ratio >= 1.3) {
      const before = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
      sessions = sessions.map(s => recalcSessionKcal({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * 0.85)) }, bw, sex, ffm));
      const after = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
      cw('ACWR осторожный → минуты −15%', `${before} мин`, `${after} мин`);
    } else if (done.length > 0 && avgRpe >= 8) {
      const before = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
      sessions = sessions.map(s => recalcSessionKcal({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * 0.9)) }, bw, sex, ffm));
      const after = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
      cw(`RPE ${avgRpe.toFixed(1)} → минуты −10%`, `${before} мин`, `${after} мин`);
    } else if (pct > 0 && pct < 0.6) {
      const z2 = sessions.find(s => s.type === 'zone2' || s.type === 'recovery');
      if (z2 && z2.weeklyFrequency > 1) {
        const before = `${z2.type.toUpperCase()} ×${z2.weeklyFrequency}`;
        sessions = sessions.map(s => (s.type === z2.type ? { ...s, weeklyFrequency: Math.max(1, s.weeklyFrequency - 1) } : s));
        const after = `${z2.type.toUpperCase()} ×${sessions.find(s => s.type === z2.type)!.weeklyFrequency}`;
        cw(`Выполнено ${Math.round(pct * 100)}% → частота −1`, before, after);
      }
    } else if (pct >= 1.1 && avgRpe > 0 && avgRpe < 6 && (cycle.goal === 'cut' || cycle.goal === 'recomp' || cycle.goal === 'bb_prep')) {
      const before = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
      sessions = sessions.map(s => recalcSessionKcal({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * 1.1)) }, bw, sex, ffm));
      const after = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
      cw('Выполнено >110%, RPE низкий → минуты +10%', `${before} мин`, `${after} мин`);
    }
    return rebuildWeek(w, sessions, []);
  });

  // Недельная прогрессия: 2 последние прошедшие недели «лёгкие» (всё выполнено,
  // RPE <6) → будущим рабочим неделям +10%; 2 «тяжёлые» (RPE ≥8 или <50% плана)
  // → −10%. Только будущие недели — прошлое не меняется.
  {
    const past = weekStats.filter(s => !s.rest && s.week < currentWeek && s.doneCount > 0).slice(-2);
    let weeklyAdjust: { label: string; mult: number } | null = null;
    if (past.length === 2) {
      const easy = past.every(s => s.pct >= 1 && s.avgRpe > 0 && s.avgRpe < 6);
      const overload = past.every(s => s.avgRpe >= 8 || s.pct < 0.5);
      if (easy) weeklyAdjust = { label: '2 лёгкие недели подряд → минуты +10% (недельная прогрессия)', mult: 1.1 };
      else if (overload) weeklyAdjust = { label: '2 тяжёлые недели подряд → минуты −10%', mult: 0.9 };
    }
    if (weeklyAdjust) {
      const bw = cycleBodyWeight(cycle);
      const ffm = cycleFfmKg(cycle);
      const sex = cycle.config?.sex;
      for (const w of weeks) {
        if (w.week <= currentWeek || w.deload || w.taper || w.phase === 'peak' || w.phase === 'transition') continue;
        const before = w.totalMinutes;
        const sessions = w.sessions.map(s => recalcSessionKcal({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * weeklyAdjust!.mult)) }, bw, sex, ffm));
        const after = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
        if (after !== before) {
          const idx = weeks.indexOf(w);
          weeks[idx] = rebuildWeek(w, sessions, []);
          changes.push({ week: w.week, label: weeklyAdjust.label, from: `${before} мин`, to: `${after} мин` });
        }
      }
    }
  }

  // Guard: ни одна будущая неделя не должна превысить 90 мин × дней (перегруз дня).
  const daysAvail = typeof cycle.config?.daysAvailable === 'number' ? cycle.config.daysAvailable : 7;
  if (daysAvail > 0 && daysAvail < 7) {
    const maxPerWeek = daysAvail * 90;
    for (let i = 0; i < weeks.length; i++) {
      if (weeks[i].totalMinutes > maxPerWeek) {
        const w = weeks[i];
        const scale = maxPerWeek / w.totalMinutes;
        const bw2 = cycleBodyWeight(cycle);
        const ffm2 = cycleFfmKg(cycle);
        const sex2 = cycle.config?.sex;
        const sessions = w.sessions.map(s => recalcSessionKcal({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * scale)) }, bw2, sex2, ffm2));
        weeks[i] = rebuildWeek(w, sessions, [`Guard: capped to ${maxPerWeek} мин (дней ${daysAvail} ×90).`]);
        changes.push({ week: w.week, label: 'Guard: перегруз дня → scaled', from: `${w.totalMinutes} мин`, to: `${weeks[i].totalMinutes} мин` });
      }
    }
  }

  const totalBefore = cycle.weeks.reduce((s, w) => s + w.totalMinutes, 0);
  const totalAfter = weeks.reduce((s, w) => s + w.totalMinutes, 0);
  const cycle2: CardioCycle = { ...cycle, weeks, source: cycle.source };
  const advice: CardioAdviceLike = changes.length > 0
    ? { action: totalAfter < totalBefore ? 'reduce' : totalAfter > totalBefore ? 'increase' : 'keep', reason: `Авто-подстройка: ${changes.length} изменений (недель: ${[...new Set(changes.map(c => c.week))].join(', ')}).` }
    : { action: 'keep', reason: 'Данные дневника соответствуют плану — изменений нет.' };
  return { cycle: cycle2, changes, advice };
}

// ─── Качество цикла (диагностика) ───

export interface CardioQualityFinding {
  level: 'ok' | 'warn' | 'info';
  text: string;
}

export interface CardioQualityReport {
  score: number;
  findings: CardioQualityFinding[];
}

function weekMaxFreq(w: CardioWeek): number {
  return w.sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
}

/**
 * Диагностика качества кардио-цикла: объём под цель, прогрессия, делоды,
 * HIIT, taper у стартов, пустые недели, перегруз дней. Возвращает score 0-100.
 */
export function cardioQualityReport(cycle: CardioCycle, daysAvailable = 7): CardioQualityReport {
  const findings: CardioQualityFinding[] = [];
  let penalty = 0;
  const s = cardioCycleSummary(cycle);
  const add = (level: CardioQualityFinding['level'], text: string, pts: number) => {
    findings.push({ level, text });
    if (level === 'warn') penalty += pts;
  };

  // 1. Объём под цель
  const avg = s.avgMinutesPerWeek;
  if (cycle.goal === 'cut' || cycle.goal === 'bb_prep') {
    if (avg < 90) add('warn', `${cycle.goal === 'bb_prep' ? 'Подготовка ББ' : 'Сушка'}: ${avg} мин/нед — маловато для липолиза (ориентир 90-210).`, 15);
    else if (avg > 210) add('warn', `${cycle.goal === 'bb_prep' ? 'Подготовка ББ' : 'Сушка'}: ${avg} мин/нед — высокий объём, следите за восстановлением.`, 10);
    else add('ok', `Объём ${avg} мин/нед соответствует ${cycle.goal === 'bb_prep' ? 'подготовке ББ' : 'сушке'}.`, 0);
  } else if (cycle.goal === 'mass') {
    if (avg > 60) add('warn', `Массонабор: ${avg} мин/нед может конкурировать с ростом (ориентир ≤60).`, 15);
    else add('ok', `Объём ${avg} мин/нед не мешает массонабору.`, 0);
  } else if (cycle.goal === 'health') {
    if (avg < 90) add('warn', `Здоровье: ${avg} мин/нед — меньше рекомендаций ВОЗ (150 мин/нед умеренной).`, 15);
    else add('ok', `Объём ${avg} мин/нед закрывает базовую рекомендацию.`, 0);
  } else if (cycle.goal === 'recovery') {
    if (avg > 150) add('warn', `Восстановление: ${avg} мин/нед — много для разгрузочного режима.`, 10);
  } else if (cycle.goal === 'pl_prep') {
    if (avg < 40) add('warn', `Подготовка ПЛ: ${avg} мин/нед — мало для аэробной поддержки (ориентир 60-150).`, 10);
    else if (avg > 150) add('warn', `Подготовка ПЛ: ${avg} мин/нед — может утомлять перед стартом (ориентир 60-150).`, 10);
    else add('ok', `Объём ${avg} мин/нед поддерживает форму без утомления.`, 0);
  } else if (cycle.goal === 'bb_taper') {
    if (avg > 150) add('warn', `Тапер ББ: ${avg} мин/нед — много для разгрузочных недель (ориентир 30-120, объём ↓).`, 10);
    else add('ok', `Тапер ББ: объём снижается к шоу — корректно.`, 0);
  }

  // 2. Прогрессия объёма (вторая половина > первой) для cut/health/recomp/prep
  //    Сравниваем только рабочие недели (без taper/peak/transition/делодов —
  //    они по определению снижают объём в конце).
  if (['cut', 'health', 'recomp', 'bb_prep', 'pl_prep'].includes(cycle.goal) && cycle.totalWeeks >= 6) {
    const work = cycle.weeks.filter(w => !w.taper && !w.deload && w.phase !== 'transition' && w.phase !== 'peak');
    if (work.length >= 4) {
      const half = Math.floor(work.length / 2);
      const first = work.slice(0, half).reduce((sum, w) => sum + w.totalMinutes, 0);
      const second = work.slice(half).reduce((sum, w) => sum + w.totalMinutes, 0);
      if (second <= first) add('warn', 'Нет прогрессии объёма: вторая половина рабочих недель не тяжелее первой.', 15);
      else add('ok', 'Прогрессия объёма нарастает по ходу цикла.', 0);
    }
  }

  // 3. Делоды
  if (cycle.totalWeeks >= 8 && ['cut', 'health', 'recomp', 'bb_prep'].includes(cycle.goal)) {
    if (!cycle.weeks.some(w => w.deload)) add('warn', 'В длинном цикле нет делод-недель.', 10);
    else add('ok', 'Делод-недели присутствуют.', 0);
  }

  // 4. HIIT для сушки/подготовки ББ
  if (cycle.goal === 'cut' || cycle.goal === 'bb_prep') {
    if (s.hiitWeeks === 0) add('info', 'HIIT отсутствует — для сушки/подготовки можно добавить 1×15 мин (при достаточном восстановлении).', 0);
    else add('ok', `HIIT на ${s.hiitWeeks} неделях — метаболический стимул есть.`, 0);
  }

  // 5. Taper у стартов (не штрафуем циклы, где taper выключен явно)
  if ((cycle.linkedCompetitionIds?.length ?? 0) > 0) {
    const taperOff = cycle.config?.taper === false;
    const taperWeeksCount = cycle.weeks.filter(w => w.phase === 'taper').length;
    if (taperWeeksCount === 0) {
      if (taperOff) add('info', 'Taper отключён в параметрах — перед стартом наращивание (contest_prep), без снижения объёма.', 0);
      else add('warn', 'Есть старты, но нет ни одной taper-недели.', 10);
    } else add('ok', `Taper построен (${taperWeeksCount} нед).`, 0);
    const peak = cycle.weeks.find(w => w.phase === 'peak');
    if (peak && peak.sessions.some(s => s.type === 'hiit')) add('warn', 'Пик-неделя содержит HIIT.', 10);
  }

  // 6. Пустые недели и перегруз дней
  const emptyWeeks = cycle.weeks.filter(w => weekMaxFreq(w) === 0).length;
  if (emptyWeeks > 0) add('warn', `${emptyWeeks} недель без сессий.`, 10);

  // 7. Safety: перегруз (мин/сессия, мин/нед, HIIT-частота)
  for (const s of cardioSafetyReport(cycle).warnings) add('warn', s, 10);

  const maxFreq = Math.max(1, ...cycle.weeks.map(weekMaxFreq));
  if (daysAvailable > 0 && daysAvailable < 7 && maxFreq > daysAvailable) {
    add('info', `Максимальная частота недели (${maxFreq}) больше доступных дней (${daysAvailable}) — часть сессий сгруппируется.`, 0);
  }

  // 8. Polarized 80/20 (Seiler): доля интенсивных (HIIT+MISS) не должна превышать 25% от всех минут
  {
    const totalMin = cycle.weeks.reduce((s, w) => s + w.totalMinutes, 0);
    const intenseMin = cycle.weeks.reduce((s, w) => s + w.sessions.filter(x => x.type === 'hiit' || x.type === 'miss').reduce((a, x) => a + x.durationMin * x.weeklyFrequency, 0), 0);
    if (totalMin > 0) {
      const pct = (intenseMin / totalMin) * 100;
      if (pct > 25) add('warn', `Интенсивное кардио (HIIT+MISS) ${pct.toFixed(0)}% от объёма — выше 80/20 (Seiler): снизьте HIIT или добавьте Zone 2.`, 10);
      else if (pct > 20) add('info', `Интенсивное кардио ${pct.toFixed(0)}% — близко к лимиту 80/20 (рекомендуется ≤20% HIIT/MISS).`, 0);
      else if (intenseMin > 0) add('ok', `Распределение ${Math.round(100 - pct)}/${Math.round(pct)} (Zone2 vs HIIT/MISS) — соответствует polarized 80/20.`, 0);
    }
  }

  // 9. Монотонность: одинаковый объём каждую неделю → риск (Foster).
  if (cycle.totalWeeks >= 6) {
    const vols = cycle.weeks.filter(w => !w.deload && !w.taper && w.phase !== 'peak' && w.phase !== 'transition').map(w => w.totalMinutes);
    if (vols.length >= 4) {
      const mean = vols.reduce((a, b) => a + b, 0) / vols.length;
      const variance = vols.reduce((s, v) => s + (v - mean) ** 2, 0) / vols.length;
      const sd = Math.sqrt(variance);
      const cv = mean > 0 ? sd / mean : 0;
      if (cv < 0.08) add('warn', 'Монотонность: объём почти одинаков каждую неделю — варьируйте нагрузку (Foster monotony).', 10);
      else if (cv < 0.15) add('info', 'Вариативность объёма низкая — добавьте волны нагрузки.', 0);
    }
  }

  return { score: Math.max(0, Math.min(100, 100 - penalty)), findings };
}

// ─── Safety-валидация правок (перегруз) ───

/** Предупреждения безопасности: сессии/недели за пределами разумных объёмов. */
export function cardioSafetyReport(cycle: CardioCycle): { warnings: string[] } {
  const warnings: string[] = [];
  for (const w of cycle.weeks) {
    for (const s of w.sessions) {
      const limit = s.type === 'hiit' ? 30 : s.type === 'zone2' ? 90 : s.type === 'miss' ? 90 : 120;
      if (s.durationMin > limit) {
        warnings.push(`Нед ${w.week}: ${s.type.toUpperCase()} ${s.durationMin} мин — больше ${limit} мин (перегруз).`);
      }
      if (s.type === 'hiit' && s.weeklyFrequency > 3) {
        warnings.push(`Нед ${w.week}: HIIT ×${s.weeklyFrequency} — больше 3×/нед (риск перетренированности).`);
      }
    }
    if (w.totalMinutes > 600) {
      warnings.push(`Нед ${w.week}: ${w.totalMinutes} мин — больше 600 мин/нед (высокий риск перегрузки).`);
    }
  }
  return { warnings };
}

/** Обратный снапшот параметров сборки для «⚙️ Изменить параметры». */
export function configFromCycle(cycle: CardioCycle): CardioCycleInput | null {
  return cycle.config ? { ...cycle.config } : null;
}

// ─── Варианты плана и объяснение выбора (P0) ───

export type CardioVariant = 'gentle' | 'base' | 'intense';

export interface CardioVariantInfo {
  id: CardioVariant;
  label: string;
  desc: string;
  cycle: CardioCycle;
  summary: ReturnType<typeof cardioCycleSummary>;
}

export const CARDIO_VARIANT_LABELS: Record<CardioVariant, string> = {
  gentle: 'Щадящий',
  base: 'Базовый',
  intense: 'Интенсивный',
};

/**
 * Три варианта нагрузки для одной цели: щадящий (новичок, без HIIT),
 * базовый (как задано пользователем) и интенсивный (продвинутый, с HIIT).
 */
export function cardioPlanVariants(input: CardioCycleInput): CardioVariantInfo[] {
  const ids: CardioVariant[] = ['gentle', 'base', 'intense'];
  return ids.map(id => {
    const opts: CardioCycleInput = { ...input, id: undefined, name: undefined, source: 'auto' };
    if (id === 'gentle') {
      opts.level = 'beginner';
      opts.recoveryLow = true;
    } else if (id === 'intense') {
      opts.level = 'advanced';
      opts.recoveryLow = false;
    } else {
      opts.level = input.level ?? 'intermediate';
      opts.recoveryLow = input.recoveryLow;
    }
    const cycle = buildCardioCycle(opts);
    return { id, label: CARDIO_VARIANT_LABELS[id], desc: id === 'gentle' ? 'Мягкий старт, без HIIT' : id === 'intense' ? 'Максимальный объём, HIIT' : 'Как в параметрах', cycle, summary: cardioCycleSummary(cycle) };
  });
}

/** Текстовое объяснение, почему построен именно такой план. */
export function explainCardioChoice(input: CardioCycleInput, cycle: CardioCycle): string[] {
  const lines: string[] = [];
  const goal = CARDIO_GOAL_LABELS[input.goal].toLowerCase();
  lines.push(`Цель «${goal}» определяет профиль: ${input.goal === 'cut' ? 'прогрессия Zone 2 (2×30 → 3×45) + HIIT 1×15, делоды каждые 4 нед' : input.goal === 'bb_prep' ? 'прогрессия Zone 2 (2×30 → 3×45) + MISS/HIIT на дефиците, делоды каждые 4 нед (подготовка ББ)' : input.goal === 'pl_prep' ? 'умеренный Zone 2 2-3×20-30 + MISS, без HIIT — не утомлять ЦНС к старту (подготовка ПЛ)' : input.goal === 'bb_taper' ? 'лёгкое Zone 2/recovery с плавным снижением объёма 0.9→0.6 за 4 нед (тапер ББ, BB_CARDIO_TAPER_CURVE)' : input.goal === 'health' ? 'Zone 2 3-4×25-40 мин — база для здоровья ССС' : input.goal === 'mass' ? 'минимум кардио (только восстановление 1×20), чтобы не конкурировать с ростом' : input.goal === 'recovery' ? 'лёгкое кардио 2-3×25-30 для кровотока и мобильности' : input.goal === 'recomp' || input.goal === 'maintenance' ? 'умеренное Zone 2 2×25-30 для поддержания' : ''}.`);
  const level = input.level ?? 'intermediate';
  lines.push(`Уровень «${CARDIO_LEVEL_LABELS[level].toLowerCase()}»: объём сессий ×${CARDIO_LEVEL_MULT[level]}.`);
  lines.push(`Доступно ${input.daysAvailable ?? 7} дн/нед — сессии распределены по ${Math.min(input.daysAvailable ?? 7, 7)} дням.`);
  if (input.recoveryLow) lines.push('Низкое восстановление: HIIT исключён из всех недель.');
  if (input.equipment && input.equipment.length > 0) {
    lines.push(`Оборудование: ${input.equipment.map(e => cardioEquipmentLabel(e)).join(', ')}${input.lowImpact ? ' (низкоударное, суставы щадятся)' : ''}.`);
  } else if (input.lowImpact) {
    lines.push('Низкоударный режим: высокоударный бег заменён на ходьбу/вело/эллипс.');
  }
  if (input.age != null) {
    const zones = cardioHeartZones(input.age, input.restingHr, undefined, input.sex);
    lines.push(`Возраст ${input.age}${input.sex === 'female' ? ' (жен.)' : ''}${input.restingHr != null && input.restingHr > 0 ? `, ЧСС покоя ${input.restingHr}` : ''}: зона Z2 = ${zones[1].bpmMin}-${zones[1].bpmMax} уд/мин.`);
  }
  const comps = (input.competitions ?? []).filter(c => c.week >= 1 && c.week <= (input.totalWeeks ?? 12));
  if (comps.length > 0) {
    if (input.taper === false) {
      lines.push(`Старты: ${comps.map(c => `${c.name} (нед ${c.week})`).join(', ')} — taper отключён: перед стартом наращивание (contest_prep), неделя старта${input.peakWeek !== false ? ' — пик (только лёгкое recovery)' : ' — обычная'}, без taper-кривой.`);
    } else {
      const tw = Math.max(1, Math.min(4, Math.round(input.taperWeeks ?? 2)));
      lines.push(`Старты: ${comps.map(c => `${c.name} (нед ${c.week})`).join(', ')} — taper ${tw} нед${input.peakWeek !== false ? ' + пик-неделя' : ''} (без HIIT, объём ×0.85→×0.4).`);
    }
  }
  const s = cardioCycleSummary(cycle);
  lines.push(`Итог: ${cycle.totalWeeks} нед, ${s.avgMinutesPerWeek} мин/нед, ${s.avgKcalPerWeek} ккал/нед, ${s.hiitWeeks} HIIT-недель.`);
  if (input.age != null) {
    const f = cardioFitnessForecast(cycle);
    lines.push(`Прогноз адаптации: +${f.vo2GainPct}% VO2max за цикл (${f.effectiveWeeks} рабочих нед).`);
  }
  return lines;
}

// ─── Улучшение цикла по отчёту качества (P1) ───

/**
 * Авто-исправления по отчёту качества:
 * - сушка/рекомпозиция без HIIT (и восстановление позволяет) → добавить HIIT на build/maintenance;
 * - здоровье/рекомпозиция с малым объёмом → увеличить частоту zone2 на maintenance-неделях;
 * - возвращает копию цикла + список изменений (для подтверждения).
 */
export function improveCardioCycle(cycle: CardioCycle, opts: { daysAvailable?: number; recoveryLow?: boolean } = {}): CardioTuneResult {
  const changes: CardioTuneChange[] = [];
  const daysAvailable = opts.daysAvailable ?? 7;
  const recoveryLow = opts.recoveryLow ?? false;
  const bw = cycleBodyWeight(cycle);
  const ffm = cycleFfmKg(cycle);
  const sex = cycle.config?.sex;
  const s = cardioCycleSummary(cycle);
  const weeks = cycle.weeks.map(w => {
    let sessions = w.sessions;
    // 1. HIIT для cut/recomp/подготовки ББ
    if ((cycle.goal === 'cut' || cycle.goal === 'recomp' || cycle.goal === 'bb_prep') && s.hiitWeeks === 0 && !recoveryLow && daysAvailable >= 3) {
      if ((w.phase === 'build' || w.phase === 'maintenance') && !w.deload && !w.taper && !w.sessions.some(x => x.type === 'hiit')) {
        sessions = [...sessions, mkSession('hiit', 15, 1, 'HIIT добавлен авто-улучшением (EPOC, ЖСС)', bw, undefined, sex, ffm)];
        changes.push({ week: w.week, label: 'HIIT 15×1 добавлен', from: 'нет', to: 'HIIT 15×1' });
      }
    }
    // 2. Объём для health/recomp
    if ((cycle.goal === 'health' || cycle.goal === 'recomp') && s.avgMinutesPerWeek < 90 && w.phase === 'maintenance' && !w.deload && !w.taper) {
      const z2 = sessions.find(x => x.type === 'zone2');
      if (z2 && z2.weeklyFrequency < daysAvailable && z2.weeklyFrequency < 6) {
        const before = `${z2.type.toUpperCase()} ×${z2.weeklyFrequency}`;
        sessions = sessions.map(x => (x.type === 'zone2' ? { ...x, weeklyFrequency: x.weeklyFrequency + 1 } : x));
        changes.push({ week: w.week, label: 'Zone 2 частота +1', from: before, to: `ZONE2 ×${z2.weeklyFrequency + 1}` });
      }
    }
    return rebuildWeek(w, sessions, []);
  });
  const cycle2: CardioCycle = { ...cycle, weeks, source: cycle.source };
  const advice: CardioAdviceLike = changes.length > 0
    ? { action: 'increase', reason: `Улучшение: ${changes.length} изменений (недели: ${[...new Set(changes.map(c => c.week))].join(', ')}).` }
    : { action: 'keep', reason: 'План уже соответствует рекомендациям качества.' };
  return { cycle: cycle2, changes, advice };
}

// ─── Протокол сессии (P1) ───

export interface CardioSessionPhase {
  name: string;
  minutes: number;
  note: string;
  hrZone?: { min?: number; max?: number };
}

/** Фазы сессии по типу: разминка / основная / заминка с минутами и пульсом. */
export function cardioSessionProtocol(session: Pick<CardioSession, 'type' | 'durationMin'>, zones?: HeartZone[]): CardioSessionPhase[] {
  const dur = Math.max(10, session.durationMin);
  const z = (idx: number) => zones?.[idx];
  switch (session.type) {
    case 'hiit': {
      const work = Math.max(5, dur - 10);
      return [
        { name: 'Разминка', minutes: 5, note: 'Лёгкий темп, плавное повышение пульса', hrZone: z(0) ? { min: z(0)!.bpmMin, max: z(0)!.bpmMax } : undefined },
        { name: 'Интервалы', minutes: work, note: '30 сек работа / 90 сек отдых (Z4 → Z1)', hrZone: z(3) ? { min: z(3)!.bpmMin, max: z(3)!.bpmMax } : undefined },
        { name: 'Заминка', minutes: 5, note: 'Лёгкий темп до восстановления пульса', hrZone: z(0) ? { min: z(0)!.bpmMin, max: z(0)!.bpmMax } : undefined },
      ];
    }
    case 'recovery': {
      const main = Math.max(5, dur - 5);
      return [
        { name: 'Основная', minutes: main, note: 'Очень лёгкий темп, разговорный', hrZone: z(0) ? { min: z(0)!.bpmMin, max: z(0)!.bpmMax } : undefined },
        { name: 'Заминка', minutes: 5, note: 'Ходьба, дыхание', hrZone: z(0) ? { min: z(0)!.bpmMin, max: z(0)!.bpmMax } : undefined },
      ];
    }
    default: {
      const main = Math.max(5, dur - 10);
      const isMiss = session.type === 'miss';
      return [
        { name: 'Разминка', minutes: 5, note: 'Лёгкий темп, подготовка к работе', hrZone: z(0) ? { min: z(0)!.bpmMin, max: z(0)!.bpmMax } : undefined },
        { name: 'Основная', minutes: main, note: isMiss ? 'Умеренный темп, Z3 (70-80%)' : 'Zone 2, разговорный темп (60-70%)', hrZone: isMiss ? (z(2) ? { min: z(2)!.bpmMin, max: z(2)!.bpmMax } : undefined) : (z(1) ? { min: z(1)!.bpmMin, max: z(1)!.bpmMax } : undefined) },
        { name: 'Заминка', minutes: 5, note: 'Снижение темпа, растяжка', hrZone: z(0) ? { min: z(0)!.bpmMin, max: z(0)!.bpmMax } : undefined },
      ];
    }
  }
}

/** Построить структурированные интервалы для сессии (HR/pace/power clamp). */
export function buildStructuredIntervals(session: CardioSession, zones?: HeartZone[]): CardioStructuredBlock[] {
  const dur = session.durationMin;
  if (session.type === 'hiit') {
    const work = 60;
    const rest = 90;
    const reps = Math.max(4, Math.round((dur - 10) * 60 / (work + rest)));
    const targetHr = zones?.[3] ? { min: zones[3].bpmMin, max: zones[3].bpmMax } : undefined;
    return [{ workSec: work, restSec: rest, reps, target: 'hr', targetHr, note: 'HIIT Z4 60/90' }];
  }
  if (session.type === 'miss') {
    const work = 600;
    const rest = 180;
    const reps = Math.max(1, Math.round((dur - 10) * 60 / (work + rest)));
    const targetHr = zones?.[2] ? { min: zones[2].bpmMin, max: zones[2].bpmMax } : undefined;
    return [{ workSec: work, restSec: rest, reps, target: 'hr', targetHr, note: 'MISS Z3 10/3' }];
  }
  return [];
}
/** Проверка интерференции (Wilson 2012): HIIT <48ч до тяжёлых ног = penalty, Zone2 после ног = ok. */
export function interferenceScore(legDays: number[], cardioDay: number): 'ok' | 'caution' | 'avoid' {
  if (!legDays || legDays.length === 0) return 'ok';
  const diff = Math.min(...legDays.map(d => {
    const delta = (cardioDay - d + 7) % 7;
    return Math.min(delta, 7 - delta);
  }));
  if (diff === 0) return 'avoid';
  if (diff === 1) return 'caution';
  return 'ok';
}

export { cardioInterferenceScoreDetailed, interferenceForCycle, simpleInterferenceScore } from './cardio-interference.engine';

// ─── Год кардио: последовательность циклов (этап 6) ───

export interface CardioYearBlock {
  cycle: CardioCycle;
  /** Неделя года (1-индекс) начала блока — продолжение предыдущего цикла. */
  startWeek: number;
  totalWeeks: number;
  summary: ReturnType<typeof cardioCycleSummary>;
}

export interface CardioYearPlan {
  blocks: CardioYearBlock[];
  totalWeeks: number;
  avgMinutesPerWeek: number;
  avgKcalPerWeek: number;
  goals: CardioGoal[];
}

/**
 * Собрать «год кардио» из последовательности циклов: блоки встают подряд
 * (неделя 1 = старт первого цикла), сводка — средние по всему году.
 * Пустой список → null.
 */
export function cardioYearPlan(cycles: CardioCycle[]): CardioYearPlan | null {
  if (!Array.isArray(cycles) || cycles.length === 0) return null;
  let cursor = 1;
  const blocks: CardioYearBlock[] = [];
  for (const cycle of cycles) {
    const summary = cardioCycleSummary(cycle);
    blocks.push({ cycle, startWeek: cursor, totalWeeks: cycle.totalWeeks, summary });
    cursor += cycle.totalWeeks;
  }
  const totalWeeks = cursor - 1;
  const totalMinutes = blocks.reduce((s, b) => s + b.cycle.weeks.reduce((a, w) => a + w.totalMinutes, 0), 0);
  const totalKcal = blocks.reduce((s, b) => s + b.cycle.weeks.reduce((a, w) => a + w.totalKcal, 0), 0);
  return {
    blocks,
    totalWeeks,
    avgMinutesPerWeek: totalWeeks > 0 ? Math.round(totalMinutes / totalWeeks) : 0,
    avgKcalPerWeek: totalWeeks > 0 ? Math.round(totalKcal / totalWeeks) : 0,
    goals: cycles.map(c => c.goal),
  };
}

/** Текстовая сводка «года кардио» для буфера/печати. */
export function buildCardioYearText(plan: CardioYearPlan): string {
  const lines: string[] = [];
  lines.push('📆 Год кардио');
  for (const b of plan.blocks) {
    const end = b.startWeek + b.totalWeeks - 1;
    lines.push(`  ${String(b.startWeek).padStart(2, ' ')}–${String(end).padStart(2, ' ')} нед · ${b.cycle.name} · ${CARDIO_GOAL_LABELS[b.cycle.goal]} · ${b.summary.avgMinutesPerWeek} мин/нед · ${b.summary.avgKcalPerWeek} ккал/нед`);
  }
  lines.push(`Итого: ${plan.totalWeeks} нед · в среднем ${plan.avgMinutesPerWeek} мин/нед · ${plan.avgKcalPerWeek} ккал/нед`);
  return lines.join('\n');
}

/** Переместить сессию внутри недели на другой день (drag-and-drop, dayOfWeek 0-6). */
export function moveCardioSessionInWeek(cycle: CardioCycle, weekNo: number, sessionIdx: number, newDayOfWeek: number): CardioCycle | null {
  if (newDayOfWeek < 0 || newDayOfWeek > 6) return null;
  const w = cycle.weeks.find(x => x.week === weekNo);
  if (!w) return null;
  if (sessionIdx < 0 || sessionIdx >= w.sessions.length) return null;
  const weeks = cycle.weeks.map(ww => {
    if (ww.week !== weekNo) return ww;
    const sessions = ww.sessions.map((s, i) => (i === sessionIdx ? { ...s, dayOfWeek: newDayOfWeek } : s));
    return { ...ww, sessions };
  });
  return { ...cycle, weeks };
}

/** Годовая CTL-серия факта (склейка по датам через cardioFactCtlSeries каждого цикла). */
export function cardioYearFactCtlSeries(
  year: CardioYearPlan | null,
  log: { date: string; type: CardioType; durationMin: number; avgHr?: number; completed?: boolean }[],
  opts: { restHr?: number; maxHr?: number; sex?: 'male' | 'female'; referenceIso?: string } = {},
): ReturnType<typeof cardioFactCtlSeries> {
  if (!year || !log || log.length === 0) return [];
  // используем общий лог, но режем по датам года (первая неделя года → последняя)
  const firstStart = year.blocks[0]?.cycle.startDate;
  if (!firstStart) return cardioFactCtlSeries(log, opts);
  // сдвигаем reference к концу года
  const totalWeeks = year.totalWeeks;
  const endIso = addDaysIso(firstStart, totalWeeks * 7 - 1);
  return cardioFactCtlSeries(log, { ...opts, referenceIso: endIso, days: totalWeeks * 7 });
}

// ─── Проф-инструменты: прогноз адаптации и подсказки недель ───

export interface CardioFitnessForecast {
  /** Ожидаемый прирост VO2max за цикл, % (модель адаптации: чем больше
   *  эффективных минут и выше стартовый уровень, тем медленнее рост). */
  vo2GainPct: number;
  /** Эффективные (рабочие) недели — без делодов/taper/пика/перехода. */
  effectiveWeeks: number;
  /** Краткое объяснение модели. */
  note: string;
}

/**
 * Прогноз кардиоадаптации по циклу (VO2max-прирост).
 * Модель: новичок 2.5%/нед эффективной работы, средний 1.5%, продвинутый 1%,
 * с насыщением от объёма (норма 150-300 мин/нед) и возрастом. mass/recovery —
 * минимальная адаптация (цикл не для прогресса). Возвращает чистую оценку —
 * рекомендательный характер.
 */
export function cardioFitnessForecast(cycle: CardioCycle): CardioFitnessForecast {
  const level = cycle.config?.level ?? 'intermediate';
  const ratePerWeek = level === 'beginner' ? 0.025 : level === 'advanced' ? 0.01 : 0.015;
  const effectiveWeeks = cycle.weeks.filter(w => !w.deload && !w.taper && w.phase !== 'peak' && w.phase !== 'transition').length;
  const s = cardioCycleSummary(cycle);
  const minutes = s.avgMinutesPerWeek;
  const volumeFactor = minutes > 0 ? Math.min(1, Math.max(0.4, minutes / 250)) : 0.5;
  const age = cycle.config?.age;
  const ageFactor = age != null && age > 45 ? 0.85 : 1;
  const intensityFactor = s.hiitWeeks > 0 ? 1.05 : 1;
  const goalFactor = cycle.goal === 'mass' || cycle.goal === 'recovery' || cycle.goal === 'bb_taper' ? 0.15 : 1;
  const gain = ratePerWeek * effectiveWeeks * volumeFactor * ageFactor * intensityFactor * goalFactor;
  const vo2GainPct = Math.round(gain * 1000) / 10;
  const note = cycle.goal === 'mass' || cycle.goal === 'recovery' || cycle.goal === 'bb_taper'
    ? 'Цикл не направлен на рост аэробной формы (масса/восстановление/тапер) — адаптация минимальна.'
    : `Модель: ${effectiveWeeks} рабочих нед · ${Math.round(minutes)} мин/нед · уровень ${CARDIO_LEVEL_LABELS[level].toLowerCase()}${cycle.config?.age != null && cycle.config.age > 45 ? ' · возраст >45 (адаптация ×0.85)' : ''}${s.hiitWeeks > 0 ? ' · с HIIT (×1.05)' : ''}.`;
  return { vo2GainPct, effectiveWeeks, note };
}

export interface CardioCoachHint {
  week: number;
  phase: CardioPhase;
  text: string;
  /** Чем отмечена неделя: deload/taper/peak/тест. */
  kind: 'work' | 'deload' | 'taper' | 'peak' | 'test';
}

/**
 * Тренерские подсказки на каждую неделю: контрольный тест (каждые ~4 рабочих
 * недели и в конце базы), делод, taper/пик, зоны. Чистая функция для UI.
 */
export function cardioCoachHints(cycle: CardioCycle): CardioCoachHint[] {
  const hints: CardioCoachHint[] = [];
  let workCounter = 0;
  for (const w of cycle.weeks) {
    if (w.deload) { hints.push({ week: w.week, phase: w.phase, kind: 'deload', text: 'Делод: объём снижен, только лёгкая активность — восстановление и сон в приоритете.' }); continue; }
    if (w.phase === 'peak') { hints.push({ week: w.week, phase: w.phase, kind: 'peak', text: 'Пик-неделя: только лёгкое recovery, без HIIT — свежесть к старту.' }); continue; }
    if (w.phase === 'taper') { hints.push({ week: w.week, phase: w.phase, kind: 'taper', text: 'Taper: объём снижается плавно, HIIT убран — интенсивность сохранена (Bosquet 2005).' }); continue; }
    if (w.phase === 'transition') { hints.push({ week: w.week, phase: w.phase, kind: 'deload', text: 'Переход: лёгкая активность для восстановления.' }); continue; }
    workCounter++;
    if (workCounter % 4 === 0 || (w.phase === 'base' && cycle.weeks.some(x => x.phase !== 'base' && x.week > w.week))) {
      hints.push({ week: w.week, phase: w.phase, kind: 'test', text: 'Контрольный замер: 30 мин на комфортном темпе, ЧСС/пульс, ощущения (RPE) — сверьте с прошлой неделей.' });
    } else {
      const z2 = w.sessions.find(s => s.type === 'zone2');
      const zoneText = z2?.targetHr?.max ? ` Зона Z2: ${z2.targetHr.min}-${z2.targetHr.max} уд/мин.` : '';
      hints.push({ week: w.week, phase: w.phase, kind: 'work', text: `Рабочая неделя: ${Math.round(w.totalMinutes)} мин.${zoneText}` });
    }
  }
  return hints;
}

/** Сводная строка прогноза + подсказок для UI (короткая). */
export function cardioCoachSummary(cycle: CardioCycle): string[] {
  const f = cardioFitnessForecast(cycle);
  const lines: string[] = [];
  lines.push(`📈 Прогноз адаптации: +${f.vo2GainPct}% VO2max за цикл (${f.effectiveWeeks} рабочих нед). ${f.note}`);
  const tests = cardioCoachHints(cycle).filter(h => h.kind === 'test');
  if (tests.length > 0) lines.push(`🔬 Контрольные замеры: недели ${tests.map(t => t.week).join(', ')} — сравните пульс/темп/ощущения с предыдущим замером.`);
  return lines;
}
