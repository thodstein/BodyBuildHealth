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
}

export interface CardioPlan {
  sessions: CardioSession[];
  totalKcalPerWeek: number;
  rationale: string[];
}

// ─── CardioCycle (многонедельный цикл) ───

export type CardioGoal = 'health' | 'mass' | 'cut' | 'recomp' | 'maintenance' | 'recovery';

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
  personal?: { age?: number; sex?: 'male' | 'female'; weight?: number };
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
    const joint = /сустав|колен|артрит|остеохондроз|травм/i;
    if (conds.some(c => joint.test(String(c).toLowerCase()))) f.jointIssues = true;
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
  if (cycle.goal === 'cut' || cycle.goal === 'recomp') {
    notes.push(`🥩 Белок при сушке: ≥2.2 г/кг = ${Math.round(bw * 2.2)} г/сут — сохранит мышцы на фоне дефицита + кардио.`);
  } else if (cycle.goal === 'mass') {
    notes.push(`🥩 Белок при массонаборе: 1.8-2.0 г/кг = ${Math.round(bw * 1.9)} г/сут.`);
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
];

// ─── Константы ───

/** Оценка расхода ккал/мин по типу (для ~80кг атлета, поправка через вес). */
const KCAL_PER_MIN: Record<CardioType, number> = { zone2: 7, miss: 10, hiit: 14, recovery: 5 };

/** MET-множитель по оборудованию (относительно бега = 1.0). Низкоударные
 *  виды сжигают меньше за минуту при той же продолжительности. */
const EQUIPMENT_MET: Record<CardioEquipment, number> = {
  running: 1.0,
  swimming: 0.82,
  cycling: 0.77,
  rowing: 0.71,
  elliptical: 0.51,
  walking: 0.44,
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

export function kcalForCardio(type: CardioType, durationMin: number, bodyWeight: number = 80, equipment?: CardioEquipment): number {
  const base = KCAL_PER_MIN[type] * durationMin;
  const met = equipment ? (EQUIPMENT_MET[equipment] ?? 1.0) : 1.0;
  return Math.round(base * met * (bodyWeight / 80));
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
): CardioSession {
  return {
    type,
    durationMin,
    weeklyFrequency: frequency,
    intensity: TYPE_INTENSITY[type],
    kcalPerSession: kcalForCardio(type, durationMin, bw),
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
  goal: 'mass' | 'cut' | 'recomp' | 'maintenance' | 'recovery';
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
  if (input.goal === 'cut') {
    add('zone2', 45, 3, 'Липолиз, сохранение мышц, восстановление между трени');
    add('hiit', 15, 1, 'Метаболический стимул, EPOC, ЖСС без большого объёма');
    rationale.push('Сушка: zone2 3×45мин (липолиз без нагрузки на восстановление) + 1 HIIT 15мин (EPOC).');
  } else if (input.goal === 'recomp' || input.goal === 'maintenance') {
    add('zone2', 30, 2, 'Здоровье ССС, восстановление');
    rationale.push('Поддержание/рекомпозиция: умеренное zone2 для ССС и восстановления.');
  } else if (input.goal === 'mass') {
    add('recovery', 20, 1, 'Активное восстановление, не мешает массонабору');
    rationale.push('Массонабор: минимум кардио — только восстановление, чтобы не конкурировать с ростом.');
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
): CardioPhase {
  const comp = competitions?.find(c => c.week === week);
  if (comp) return peakWeek ? 'peak' : 'taper';
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

interface RampProfile {
  base: { type: CardioType; dur: number; freq: number; purpose: string }[];
  build: { type: CardioType; dur: number; freq: number; purpose: string }[];
  maintenance: { type: CardioType; dur: number; freq: number; purpose: string }[];
  deloadMult: number;
  taperMult: number;
}

function profileForGoal(goal: CardioGoal): RampProfile {
  switch (goal) {
    case 'cut':
      return {
        base: [{ type: 'zone2', dur: 30, freq: 2, purpose: 'Вход в аэробную базу, щадящий старт сушки' }],
        build: [
          { type: 'zone2', dur: 40, freq: 3, purpose: 'Рост липолитического объёма, восстановление' },
          { type: 'hiit', dur: 15, freq: 1, purpose: 'Метаболический стимул, EPOC, ЖСС' },
        ],
        maintenance: [
          { type: 'zone2', dur: 45, freq: 3, purpose: 'Липолиз, сохранение мышц, восстановление' },
          { type: 'hiit', dur: 15, freq: 1, purpose: 'Метаболический стимул, EPOC, ЖСС' },
        ],
        deloadMult: 0.6,
        taperMult: 0.6,
      };
    case 'mass':
      return {
        base: [{ type: 'recovery', dur: 20, freq: 1, purpose: 'Активное восстановление, кровоток' }],
        build: [{ type: 'recovery', dur: 20, freq: 1, purpose: 'Активное восстановление, не мешает росту' }],
        maintenance: [{ type: 'recovery', dur: 20, freq: 1, purpose: 'Минимум кардио на массонаборе' }],
        deloadMult: 0.6,
        taperMult: 0.6,
      };
    case 'recomp':
    case 'maintenance':
      return {
        base: [{ type: 'zone2', dur: 25, freq: 2, purpose: 'Здоровье ССС, восстановление' }],
        build: [{ type: 'zone2', dur: 30, freq: 2, purpose: 'Умеренная аэробная работа' }],
        maintenance: [{ type: 'zone2', dur: 30, freq: 2, purpose: 'Поддержание ССС и восстановления' }],
        deloadMult: 0.6,
        taperMult: 0.6,
      };
    case 'recovery':
      return {
        base: [{ type: 'recovery', dur: 25, freq: 2, purpose: 'Лёгкое кардио, кровоток' }],
        build: [{ type: 'recovery', dur: 30, freq: 3, purpose: 'Активное восстановление, мобильность' }],
        maintenance: [{ type: 'recovery', dur: 30, freq: 3, purpose: 'Поддержание восстановления' }],
        deloadMult: 0.6,
        taperMult: 0.6,
      };
    case 'health':
    default:
      return {
        base: [{ type: 'zone2', dur: 25, freq: 3, purpose: 'База для здоровья ССС (3×)' }],
        build: [{ type: 'zone2', dur: 30, freq: 4, purpose: 'Наращивание аэробной выносливости (4×)' }],
        maintenance: [{ type: 'zone2', dur: 40, freq: 4, purpose: 'Поддержание кардиореспираторного здоровья (4×)' }],
        deloadMult: 0.6,
        taperMult: 0.6,
      };
  }
}

function buildWeekSessions(
  profile: RampProfile,
  phase: CardioPhase,
  week: number,
  bw: number,
  recoveryLow: boolean,
): { sessions: CardioSession[]; rationale: string[] } {
  if (phase === 'peak') {
    return {
      sessions: [mkSession('recovery', 20, 1, 'Пик-неделя: только лёгкая привычная активность', bw)],
      rationale: ['Пик-неделя: без HIIT и утомляющего кардио.'],
    };
  }
  const pool: { type: CardioType; dur: number; freq: number; purpose: string }[] =
    phase === 'base' ? profile.base : phase === 'build' ? profile.build : profile.maintenance;
  const sessions: CardioSession[] = [];
  const rationale: string[] = [];
  const mult = phase === 'taper' || phase === 'transition' ? profile.taperMult : 1;
  for (const p of pool) {
    if (p.type === 'hiit' && (recoveryLow || phase === 'taper' || phase === 'transition')) continue;
    const dur = Math.max(10, Math.round(p.dur * mult));
    const freq = Math.max(1, Math.round(p.freq * mult));
    if (freq <= 0) continue;
    sessions.push(mkSession(p.type, dur, freq, p.purpose, bw));
  }
  if (phase === 'transition') {
    rationale.push('Переход: лёгкая активность для восстановления.');
  }
  if (phase === 'taper') rationale.push('Taper: объём снижен, интенсивность сохранена (Bosquet 2005).');
  return { sessions, rationale };
}

/** Построить полный кардио-цикл. */
export function buildCardioCycle(input: CardioCycleInput): CardioCycle {
  const totalWeeks = clamp(Math.round(input.totalWeeks ?? 12), 1, MAX_CYCLE_WEEKS);
  const bw = clamp(input.bodyWeight ?? 80, 30, 300);
  const daysAvailable = clamp(Math.round(input.daysAvailable ?? 7), 0, 7);
  const competitions = (input.competitions ?? []).filter(c => c.week >= 1 && c.week <= totalWeeks);
  const taperWeeks = clamp(Math.round(input.taperWeeks ?? 2), 1, 4);
  const peakWeek = input.peakWeek !== false;
  const phaseSplit = input.phaseSplit
    ? {
        base: input.phaseSplit.base != null ? clamp(Math.round(input.phaseSplit.base), 0, Math.max(0, totalWeeks - 2)) : 0,
        build: input.phaseSplit.build != null ? clamp(Math.round(input.phaseSplit.build), 0, Math.max(0, totalWeeks - 2)) : 0,
        maintenance: input.phaseSplit.maintenance != null ? clamp(Math.round(input.phaseSplit.maintenance), 0, Math.max(0, totalWeeks - 2)) : 0,
      }
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
  const zones = input.age != null ? cardioHeartZones(input.age, input.restingHr, undefined, input.sex) : undefined;
  const profile = profileForGoal(input.goal);
  const weeks: CardioWeek[] = [];
  let totalKcal = 0;
  let totalMinutes = 0;

  for (let w = 1; w <= totalWeeks; w++) {
    const phase = cardioPhaseForWeek(w, totalWeeks, competitions, phaseSplit, taperWeeks, peakWeek);
    const deload = !competitions.some(c => Math.abs(c.week - w) <= 2) && w % DELOAD_INTERVAL === 0 && phase !== 'transition' && phase !== 'taper' && phase !== 'peak';
    let { sessions, rationale } = buildWeekSessions(profile, phase, w, bw, recoveryLow);
    if (deload) {
      sessions = sessions
        .filter(s => s.type !== 'hiit')
        .map(s => ({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * profile.deloadMult)), weeklyFrequency: Math.max(1, Math.round(s.weeklyFrequency * profile.deloadMult)) }));
      rationale.push('Делод: объём кардио снижен, HIIT убран.');
    }
    // Персонализация: уровень (объём), оборудование, целевые пульс-зоны
    sessions = sessions.map(s => {
      const dur = Math.max(10, Math.round(s.durationMin * factorMult));
      const equip = (s.type === 'hiit' || s.type === 'miss') ? (equipmentPool[1] ?? fallbackEquipment) : (equipmentPool[0] ?? fallbackEquipment);
      const zone = s.type === 'hiit' ? zones?.[3] : s.type === 'miss' ? zones?.[2] : zones?.[1];
      return {
        ...s,
        durationMin: dur,
        kcalPerSession: kcalForCardio(s.type, dur, bw, equip),
        equipment: equip,
        targetHr: zone ? { min: zone.bpmMin, max: zone.bpmMax } : s.targetHr,
      };
    });
    if (daysAvailable < 7) sessions = capSessionsToDays(sessions, daysAvailable);
    sessions = assignSessionDays(sessions, input.legDays);
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
      daysAvailable: input.daysAvailable,
      recoveryLow: input.recoveryLow,
      competitions: input.competitions ? input.competitions.map(c => ({ ...c })) : undefined,
      phaseSplit: input.phaseSplit ? { ...input.phaseSplit } : undefined,
      taperWeeks: input.taperWeeks,
      peakWeek: input.peakWeek,
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
    };
  }
  cycle.rationale.push(`Цель: ${CARDIO_GOAL_LABELS[input.goal].toLowerCase()}, ${totalWeeks} нед, ${daysAvailable} дн/нед.`);
  if (input.level && input.level !== 'intermediate') cycle.rationale.push(`Уровень: ${CARDIO_LEVEL_LABELS[input.level].toLowerCase()} (объём ×${levelMult}).`);
  for (const n of factorNotes) cycle.rationale.push(n);
  if (lowImpact && input.autoLowImpact) cycle.rationale.push('Учтены проблемы суставов из профиля — низкоударный режим.');
  if (equipmentPool.length > 0) cycle.rationale.push(`Оборудование: ${equipmentPool.map(e => cardioEquipmentLabel(e)).join(', ')}${lowImpact ? ' (низкоударное)' : ''}.`);
  else if (lowImpact) cycle.rationale.push('Оборудование: низкоударное (ходьба/вело/эллипс по умолчанию).');
  if (input.age != null) cycle.rationale.push(`Возраст ${input.age}${input.sex === 'female' ? ' (жен.)' : ''} — целевые пульс-зоны сессий заданы${input.restingHr != null && input.restingHr > 0 ? ` (ЧСС покоя ${input.restingHr})` : ''}.`);
  if (recoveryLow) cycle.rationale.push('Низкое восстановление: HIIT исключён.');
  if (competitions.length > 0) {
    cycle.rationale.push(`Соревнования: ${competitions.map(c => `${c.name} (нед ${c.week})`).join(', ')} — taper ${taperWeeks} нед${peakWeek ? ' + пик-неделя' : ' (без пик-недели)'}.`);
  }
  return cycle;
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
 *  пропуская дни тяжёлых ног для zone2/miss/hiit (recovery — в любой день). */
export function assignSessionDays(sessions: CardioSession[], legDays?: number[]): CardioSession[] {
  const blocked = new Set((legDays ?? []).filter(d => d >= 0 && d <= 6));
  const out: CardioSession[] = [];
  const now = new Date();
  let day = (now.getDay() + 6) % 7;
  const avoid = (t: CardioType) => t !== 'recovery' && blocked.size > 0;
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
  if (cycle.goal !== 'cut' && cycle.goal !== 'recomp') {
    return { action: 'keep', reason: 'Совет по весу актуален для сушки/рекомпозиции.' };
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
  const weeks = cycle.weeks.map(w => {
    if (w.deload || w.taper || w.phase === 'peak' || w.phase === 'transition') return w;
    const sessions = w.sessions.map(s => {
      if (s.type !== 'zone2') return s;
      const durationMin = s.durationMin + addMin;
      return { ...s, durationMin, kcalPerSession: kcalForCardio('zone2', durationMin, 80, s.equipment) };
    });
    return rebuildWeek(w, sessions, ['⚖️ Zone 2 +' + addMin + ' мин (коррекция по весу)']);
  });
  return { ...cycle, weeks, source: cycle.source };
}

// ─── История версий цикла (undo авто-подстройки/правок) ───

export const CARDIO_HISTORY_KEY = 'he_cardio_cycle_history';
const CARDIO_HISTORY_CAP = 5;

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

/** Снапшот текущей версии цикла перед изменением (для undo). */
export function saveCardioCycleVersion(cycle: CardioCycle, reason: string): void {
  if (!cycle) return;
  const all = loadCardioCycleVersions().filter(v => v.cycleId !== cycle.id);
  all.unshift({ id: `v-${Date.now()}`, cycleId: cycle.id, savedAt: new Date().toISOString(), reason, cycle });
  try { localStorage.setItem(CARDIO_HISTORY_KEY, JSON.stringify(all.slice(0, CARDIO_HISTORY_CAP))); } catch { /* ignore */ }
}

/** Последняя версия цикла для undo (или null). */
export function latestCardioCycleVersion(cycleId: string): CardioCycleVersion | null {
  return loadCardioCycleVersions().find(v => v.cycleId === cycleId) ?? null;
}

/** Восстановить версию: возвращает цикл и удаляет снапшот из истории. */
export function restoreCardioCycleVersion(cycleId: string): CardioCycle | null {
  const all = loadCardioCycleVersions();
  const idx = all.findIndex(v => v.cycleId === cycleId);
  if (idx < 0) return null;
  const [version] = all.splice(idx, 1);
  try { localStorage.setItem(CARDIO_HISTORY_KEY, JSON.stringify(all)); } catch { /* ignore */ }
  return version.cycle;
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

function rebuildWeek(week: CardioWeek, sessions: CardioSession[], extraRationale: string[]): CardioWeek {
  const totalMinutes = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
  const totalKcal = sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0);
  return { ...week, sessions, totalMinutes, totalKcal, rationale: [...week.rationale, ...extraRationale] };
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
  const weeks = cycle.weeks.map(w => {
    const extra: string[] = [];
    let sessions = w.sessions;
    if (zone === 'dangerous') {
      sessions = sessions
        .filter(s => s.type === 'recovery' || s.type === 'zone2')
        .map(s => ({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * 0.6)), weeklyFrequency: Math.max(1, Math.round(s.weeklyFrequency * 0.6)) }));
      extra.push('ACWR опасный: только лёгкое кардио, объём −30-50%.');
    } else if (zone === 'caution') {
      sessions = sessions.filter(s => s.type !== 'hiit').map(s => ({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * 0.85)) }));
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
  const weeks = cycle.weeks.map(w => {
    const delta = compWeek - w.week;
    if (delta < 0 || w.taper || w.deload) return w;
    if (delta === 0) {
      const sessions = [mkSession('recovery', 20, 1, 'День старта: только лёгкая привычная активность', 80)];
      return rebuildWeek({ ...w, phase: 'peak', taper: true }, sessions, ['PL пик: только recovery 20 мин.']);
    }
    if (delta <= taperWeeks) {
      let sessions = w.sessions.filter(s => s.type !== 'hiit');
      const mult = delta === 1 ? 0.5 : 0.7;
      sessions = sessions
        .filter(s => s.type === 'recovery' || s.type === 'zone2')
        .map(s => ({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * mult)), weeklyFrequency: Math.max(1, Math.round(s.weeklyFrequency * (delta === 1 ? 1 : 0.8))) }));
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
  const weeks = cycle.weeks.map(w => {
    const delta = showWeek - w.week;
    if (delta < 0 || w.taper || w.deload) return w;
    if (delta === 0 && peakWeek) {
      const sessions = [mkSession('recovery', 20, 1, 'Пик-неделя: лёгкая активность без утомления', 80)];
      return rebuildWeek({ ...w, phase: 'peak', taper: true }, sessions, ['BB пик-неделя: только recovery, без HIIT/MISS.']);
    }
    if (delta <= taperWeeks) {
      let sessions = w.sessions.filter(s => s.type !== 'hiit');
      const mult = delta === 1 ? 0.6 : 0.8;
      sessions = sessions.map(s => ({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * mult)) }));
      const note = delta === 1 ? 'BB taper N-1: объём снижен, только лёгкое кардио.' : `BB taper N-${delta}: объём −20%, HIIT убран.`;
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

// ─── Экспорт .ics ───

function escIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcsDate(isoDate: string): string {
  return isoDate.replace(/[-:]/g, '').slice(0, 15) + 'Z';
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

/** Календарь .ics: кардио-события по дням недели (тип, минуты, фаза). */
export function buildCardioIcs(cycle: CardioCycle, referenceIso?: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BodyBuildHealth//CardioCycle//RU',
    'CALSCALE:GREGORIAN',
  ];
  for (const w of cycle.weeks) {
    const day = dayStartIso(w.week, referenceIso);
    for (const s of w.sessions) {
      if (s.weeklyFrequency <= 0) continue;
      const start = toIcsDate(s.dayOfWeek != null ? dayOfWeekIso(w.week, s.dayOfWeek, referenceIso) : day);
      const summary = `Кардио ${s.type.toUpperCase()} ${s.durationMin} мин · нед ${w.week}`;
      const desc = `Фаза: ${CARDIO_PHASE_LABELS[w.phase]} · ${s.purpose}${s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}${w.deload ? ' · делод' : ''}${w.taper ? ' · taper' : ''}`;
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${cycle.id}-w${w.week}-${s.type}@bbh`);
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${start}`);
      lines.push(`SUMMARY:${escIcs(summary)}`);
      lines.push(`DESCRIPTION:${escIcs(desc)}`);
      lines.push('END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
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
  lines.push('── Недели ──');
  for (const w of cycle.weeks) {
    const sessions = w.sessions
      .map(x => `${x.type.toUpperCase()} ${x.durationMin}×${x.weeklyFrequency}${x.equipment ? ' (' + cardioEquipmentLabel(x.equipment) + ')' : ''}${x.targetHr?.max ? ' ЧСС ' + x.targetHr.min + '-' + x.targetHr.max : ''}`)
      .join(', ');
    const marks = [w.deload ? 'делод' : null, w.taper ? 'taper' : null].filter(Boolean).join('+');
    lines.push(`Нед ${w.week} · ${CARDIO_PHASE_LABELS[w.phase]}${marks ? ' · ' + marks : ''}: ${sessions} — ${w.totalMinutes} мин, ${w.totalKcal} ккал`);
  }
  if (cycle.rationale.length > 0) {
    lines.push('── Обоснование ──');
    lines.push(...cycle.rationale);
  }
  return lines.join('\n');
}

// ─── Печатная сводка ───

function escHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** HTML-сводка цикла для печати (XSS-safe экранирование пользовательских названий). */
export function buildCardioPrintHtml(cycle: CardioCycle): string {
  const summary = cardioCycleSummary(cycle);
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
      const content = sess.length === 0
        ? '—'
        : sess.map(s => `${s.type.toUpperCase()} ${s.durationMin}м${s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}${s.targetHr?.max ? '<br>ЧСС ' + s.targetHr.min + '-' + s.targetHr.max : ''}`).join('<br>');
      return `<td style="vertical-align:top;font-size:11px">${escHtml(content)}</td>`;
    }).join('');
    return `<tr><td style="font-weight:700;font-size:11px">Нед ${w.week}<br>${escHtml(CARDIO_PHASE_LABELS[w.phase])}</td>${cells}</tr>`;
  }).join('');
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${escHtml(cycle.name)}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%;margin-top:12px}
th,td{border:1px solid #ccc;padding:6px 10px;font-size:13px;text-align:left}th{background:#f0f0f0}h2{font-size:18px}</style></head>
<body><h2>❤️ ${escHtml(cycle.name)}</h2>
<p>Цель: ${escHtml(CARDIO_GOAL_LABELS[cycle.goal])} · ${cycle.totalWeeks} нед · в среднем ${summary.avgMinutesPerWeek} мин/нед · ${summary.avgKcalPerWeek} ккал/нед</p>
${cycle.rationale.map(r => `<p style="font-size:12px;color:#555">${escHtml(r)}</p>`).join('')}
<h3>Фазы</h3><table><tr><th>Фаза</th><th>Недель</th></tr>${phaseRows}</table>
<h3>Недели</h3><table><tr><th>Нед</th><th>Фаза</th><th>Сессии</th><th>Мин</th><th>Ккал</th><th>Метки</th></tr>${weekRows}</table>
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

export interface HeartZone {
  zone: number;
  label: string;
  rangeMin: number; // % от ЧСС макс (упрощённо, без резерва)
  rangeMax: number;
  bpmMin: number;
  bpmMax: number;
  purpose: string;
}

/** Пульс-зоны (Karvonen с резервом при restingHr; иначе % от ЧССмакс).
 *  ЧССмакс: мужчины 220-возраст, женщины 226-возраст. */
export function cardioHeartZones(age: number, restingHr?: number, maxHr?: number, sex?: 'male' | 'female'): HeartZone[] {
  const a = Math.max(12, Math.min(90, age));
  const hrmax = maxHr && maxHr > 0 ? maxHr : sex === 'female' ? 226 - a : 220 - a;
  const rest = restingHr && restingHr > 0 ? Math.max(30, Math.min(100, restingHr)) : undefined;
  const ranges: { zone: number; label: string; min: number; max: number; purpose: string }[] = [
    { zone: 1, label: 'Z1 Recovery', min: 50, max: 60, purpose: 'Восстановление, разминка' },
    { zone: 2, label: 'Z2 Zone 2', min: 60, max: 70, purpose: 'Аэробная база, липолиз' },
    { zone: 3, label: 'Z3 Tempo/MISS', min: 70, max: 80, purpose: 'Мисс, аэробная выносливость' },
    { zone: 4, label: 'Z4 Threshold', min: 80, max: 90, purpose: 'Порог, интервалы' },
    { zone: 5, label: 'Z5 VO2max', min: 90, max: 100, purpose: 'Максимальный стимул (короткие интервалы)' },
  ];
  const karvonen = (pct: number) => rest != null ? Math.round(rest + (hrmax - rest) * pct / 100) : Math.round(hrmax * pct / 100);
  return ranges.map(r => ({
    zone: r.zone,
    label: r.label,
    rangeMin: r.min,
    rangeMax: r.max,
    bpmMin: karvonen(r.min),
    bpmMax: karvonen(r.max),
    purpose: r.purpose,
  }));
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
  const ref = opts.referenceIso ? new Date(opts.referenceIso) : new Date();
  const changes: CardioTuneChange[] = [];
  const weeks = cycle.weeks.map(w => {
    if (w.deload || w.taper || w.phase === 'peak' || w.phase === 'transition') return w;
    const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + (w.week - 1) * 7);
    const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + w.week * 7);
    const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    const done = log.filter(e => e.completed && e.date >= startIso && e.date < endIso);
    const plannedSessions = w.sessions.reduce((s, x) => s + x.weeklyFrequency, 0);
    const pct = plannedSessions > 0 ? done.length / plannedSessions : 0;
    const avgRpe = done.filter(e => typeof e.rpe === 'number').reduce((s, e) => s + (e.rpe ?? 0), 0) / Math.max(1, done.filter(e => typeof e.rpe === 'number').length);
    let sessions = w.sessions;
    const cw = (label: string, from: string, to: string) => changes.push({ week: w.week, label, from, to });
    if (opts.acwr != null && opts.acwr >= 1.5 && sessions.some(s => s.type === 'hiit')) {
      sessions = sessions.filter(s => s.type !== 'hiit');
      cw('ACWR опасный → HIIT убран', `HIIT ×${w.sessions.filter(s => s.type === 'hiit').reduce((s, x) => s + x.weeklyFrequency, 0)}`, '0');
    } else if (opts.acwr != null && opts.acwr >= 1.3) {
      const before = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
      sessions = sessions.map(s => ({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * 0.85)) }));
      const after = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
      cw('ACWR осторожный → минуты −15%', `${before} мин`, `${after} мин`);
    } else if (done.length > 0 && avgRpe >= 8) {
      const before = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
      sessions = sessions.map(s => ({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * 0.9)) }));
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
    } else if (pct >= 1.1 && avgRpe > 0 && avgRpe < 6 && (cycle.goal === 'cut' || cycle.goal === 'recomp')) {
      const before = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
      sessions = sessions.map(s => ({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * 1.1)) }));
      const after = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
      cw('Выполнено >110%, RPE низкий → минуты +10%', `${before} мин`, `${after} мин`);
    }
    return rebuildWeek(w, sessions, []);
  });
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
  if (cycle.goal === 'cut') {
    if (avg < 90) add('warn', `Сушка: ${avg} мин/нед — маловато для липолиза (ориентир 90-210).`, 15);
    else if (avg > 210) add('warn', `Сушка: ${avg} мин/нед — высокий объём, следите за восстановлением.`, 10);
    else add('ok', `Объём ${avg} мин/нед соответствует сушке.`, 0);
  } else if (cycle.goal === 'mass') {
    if (avg > 60) add('warn', `Массонабор: ${avg} мин/нед может конкурировать с ростом (ориентир ≤60).`, 15);
    else add('ok', `Объём ${avg} мин/нед не мешает массонабору.`, 0);
  } else if (cycle.goal === 'health') {
    if (avg < 90) add('warn', `Здоровье: ${avg} мин/нед — меньше рекомендаций ВОЗ (150 мин/нед умеренной).`, 15);
    else add('ok', `Объём ${avg} мин/нед закрывает базовую рекомендацию.`, 0);
  } else if (cycle.goal === 'recovery') {
    if (avg > 150) add('warn', `Восстановление: ${avg} мин/нед — много для разгрузочного режима.`, 10);
  }

  // 2. Прогрессия объёма (вторая половина > первой) для cut/health/recomp
  //    Сравниваем только рабочие недели (без taper/peak/transition/делодов —
  //    они по определению снижают объём в конце).
  if (['cut', 'health', 'recomp'].includes(cycle.goal) && cycle.totalWeeks >= 6) {
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
  if (cycle.totalWeeks >= 8 && ['cut', 'health', 'recomp'].includes(cycle.goal)) {
    if (!cycle.weeks.some(w => w.deload)) add('warn', 'В длинном цикле нет делод-недель.', 10);
    else add('ok', 'Делод-недели присутствуют.', 0);
  }

  // 4. HIIT для сушки
  if (cycle.goal === 'cut') {
    if (s.hiitWeeks === 0) add('info', 'HIIT отсутствует — для сушки можно добавить 1×15 мин (при достаточном восстановлении).', 0);
    else add('ok', `HIIT на ${s.hiitWeeks} неделях — метаболический стимул есть.`, 0);
  }

  // 5. Taper у стартов
  if ((cycle.linkedCompetitionIds?.length ?? 0) > 0) {
    const taperWeeksCount = cycle.weeks.filter(w => w.phase === 'taper').length;
    if (taperWeeksCount === 0) add('warn', 'Есть старты, но нет ни одной taper-недели.', 10);
    else add('ok', `Taper построен (${taperWeeksCount} нед).`, 0);
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
  lines.push(`Цель «${goal}» определяет профиль: ${input.goal === 'cut' ? 'прогрессия Zone 2 (2×30 → 3×45) + HIIT 1×15, делоды каждые 4 нед' : input.goal === 'health' ? 'Zone 2 3-4×25-40 мин — база для здоровья ССС' : input.goal === 'mass' ? 'минимум кардио (только восстановление 1×20), чтобы не конкурировать с ростом' : input.goal === 'recovery' ? 'лёгкое кардио 2-3×25-30 для кровотока и мобильности' : input.goal === 'recomp' || input.goal === 'maintenance' ? 'умеренное Zone 2 2×25-30 для поддержания' : ''}.`);
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
    const tw = Math.max(1, Math.min(4, Math.round(input.taperWeeks ?? 2)));
    lines.push(`Старты: ${comps.map(c => `${c.name} (нед ${c.week})`).join(', ')} — taper ${tw} нед${input.peakWeek !== false ? ' + пик-неделя' : ''} (без HIIT, объём ×0.6-0.7).`);
  }
  const s = cardioCycleSummary(cycle);
  lines.push(`Итог: ${cycle.totalWeeks} нед, ${s.avgMinutesPerWeek} мин/нед, ${s.avgKcalPerWeek} ккал/нед, ${s.hiitWeeks} HIIT-недель.`);
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
  const s = cardioCycleSummary(cycle);
  const weeks = cycle.weeks.map(w => {
    let sessions = w.sessions;
    // 1. HIIT для cut/recomp
    if ((cycle.goal === 'cut' || cycle.goal === 'recomp') && s.hiitWeeks === 0 && !recoveryLow && daysAvailable >= 3) {
      if ((w.phase === 'build' || w.phase === 'maintenance') && !w.deload && !w.taper && !w.sessions.some(x => x.type === 'hiit')) {
        sessions = [...sessions, mkSession('hiit', 15, 1, 'HIIT добавлен авто-улучшением (EPOC, ЖСС)', 80)];
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
