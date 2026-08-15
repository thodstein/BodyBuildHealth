/**
 * cardio.engine.ts — кардио для рельефа/восстановления/ЖСС (Этап T7, NEW + Раунды CARDIO).
 * Zone 2 (липолиз, восстановление) и HIIT (короткий высокий стимул).
 * Интеграция с PAL/nutrition.engine — READ-only (сожжённые ккал).
 *
 * Расширение (CardioCycle): многонедельный цикл с фазами, недельными объёмами,
 * делодами, taper/peak перед соревнованиями, адаптацией к силовому плану
 * и привязкой к PL/BB макроциклу. Полная спецификация: docs/CARDIO-CYCLE-INTEGRATION-PLAN.md
 */

// ─── Базовые типы (обратно-совместимо с T7) ───

export type CardioType = 'zone2' | 'hiit' | 'miss' | 'recovery';

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
}

export interface CardioCycleInput {
  goal: CardioGoal;
  totalWeeks?: number;             // по умолчанию 12
  bodyWeight?: number;             // по умолчанию 80
  daysAvailable?: number;          // 0-7 доступных дней (по умолчанию 7)
  recoveryLow?: boolean;           // низкое восстановление → HIIT убран
  competitions?: CardioCompetitionRef[];
  id?: string;
  name?: string;
  source?: CardioCycle['source'];
  createdAt?: string;
}

// ─── Константы ───

/** Оценка расхода ккал/мин по типу (для ~80кг атлета, поправка через вес). */
const KCAL_PER_MIN: Record<CardioType, number> = { zone2: 7, miss: 10, hiit: 14, recovery: 5 };

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

export function kcalForCardio(type: CardioType, durationMin: number, bodyWeight: number = 80): number {
  const base = KCAL_PER_MIN[type] * durationMin;
  return Math.round(base * (bodyWeight / 80));
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
 */
export function cardioPhaseForWeek(week: number, totalWeeks: number, competitions?: CardioCompetitionRef[]): CardioPhase {
  const comp = competitions?.find(c => c.week === week);
  if (comp) return 'peak';
  const beforeComp = competitions?.find(c => c.week === week + 1 || c.week === week + 2);
  if (beforeComp && week <= beforeComp.week) return 'taper';
  const upcoming = competitions?.find(c => c.week > week);
  if (upcoming) return week >= upcoming.week - 2 ? 'taper' : 'contest_prep';
  if (week === totalWeeks) return 'transition';
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
        base: [{ type: 'zone2', dur: 25, freq: 3, purpose: 'База для здоровья ССС' }],
        build: [{ type: 'zone2', dur: 35, freq: 3, purpose: 'Наращивание аэробной выносливости' }],
        maintenance: [{ type: 'zone2', dur: 40, freq: 3, purpose: 'Поддержание кардиореспираторного здоровья' }],
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
    if (p.type === 'hiit' && (recoveryLow || phase === 'taper')) continue;
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
  const recoveryLow = !!input.recoveryLow;
  const competitions = (input.competitions ?? []).filter(c => c.week >= 1 && c.week <= totalWeeks);
  const profile = profileForGoal(input.goal);
  const weeks: CardioWeek[] = [];
  let totalKcal = 0;
  let totalMinutes = 0;

  for (let w = 1; w <= totalWeeks; w++) {
    const phase = cardioPhaseForWeek(w, totalWeeks, competitions);
    const deload = !competitions.some(c => Math.abs(c.week - w) <= 2) && w % DELOAD_INTERVAL === 0 && phase !== 'transition';
    let { sessions, rationale } = buildWeekSessions(profile, phase, w, bw, recoveryLow);
    if (deload) {
      sessions = sessions
        .filter(s => s.type !== 'hiit')
        .map(s => ({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * profile.deloadMult)), weeklyFrequency: Math.max(1, Math.round(s.weeklyFrequency * profile.deloadMult)) }));
      rationale.push('Делод: объём кардио снижен, HIIT убран.');
    }
    if (daysAvailable < 7) sessions = capSessionsToDays(sessions, daysAvailable);
    const weekMinutes = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
    const weekKcal = sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0);
    totalMinutes += weekMinutes;
    totalKcal += weekKcal;
    weeks.push({ week: w, phase, sessions, totalMinutes: weekMinutes, totalKcal: weekKcal, deload, taper: phase === 'taper' || phase === 'peak', rationale });
  }

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
    rationale: [],
  };
  cycle.rationale.push(`Цель: ${CARDIO_GOAL_LABELS[input.goal].toLowerCase()}, ${totalWeeks} нед, ${daysAvailable} дн/нед.`);
  if (recoveryLow) cycle.rationale.push('Низкое восстановление: HIIT исключён.');
  if (competitions.length > 0) cycle.rationale.push(`Соревнования: ${competitions.map(c => `${c.name} (нед ${c.week})`).join(', ')} — taper и пик-неделя построены.`);
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

/** Календарь .ics: кардио-события по неделям (тип, минуты, фаза). */
export function buildCardioIcs(cycle: CardioCycle, referenceIso?: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BodyBuildHealth//CardioCycle//RU',
    'CALSCALE:GREGORIAN',
  ];
  for (const w of cycle.weeks) {
    const day = dayStartIso(w.week, referenceIso);
    const start = toIcsDate(day);
    for (const s of w.sessions) {
      if (s.weeklyFrequency <= 0) continue;
      const summary = `Кардио ${s.type.toUpperCase()} ${s.durationMin} мин · нед ${w.week}`;
      const desc = `Фаза: ${CARDIO_PHASE_LABELS[w.phase]} · ${s.purpose}${w.deload ? ' · делод' : ''}${w.taper ? ' · taper' : ''}`;
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${cycle.id}-w${w.week}-${s.type}@bbh`);
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${toIcsDate(day)}`);
      lines.push(`SUMMARY:${escIcs(summary)}`);
      lines.push(`DESCRIPTION:${escIcs(desc)}`);
      lines.push('END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
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
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${escHtml(cycle.name)}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%;margin-top:12px}
th,td{border:1px solid #ccc;padding:6px 10px;font-size:13px;text-align:left}th{background:#f0f0f0}h2{font-size:18px}</style></head>
<body><h2>❤️ ${escHtml(cycle.name)}</h2>
<p>Цель: ${escHtml(CARDIO_GOAL_LABELS[cycle.goal])} · ${cycle.totalWeeks} нед · в среднем ${summary.avgMinutesPerWeek} мин/нед · ${summary.avgKcalPerWeek} ккал/нед</p>
${cycle.rationale.map(r => `<p style="font-size:12px;color:#555">${escHtml(r)}</p>`).join('')}
<h3>Фазы</h3><table><tr><th>Фаза</th><th>Недель</th></tr>${phaseRows}</table>
<h3>Недели</h3><table><tr><th>Нед</th><th>Фаза</th><th>Сессии</th><th>Мин</th><th>Ккал</th><th>Метки</th></tr>${weekRows}</table>
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
