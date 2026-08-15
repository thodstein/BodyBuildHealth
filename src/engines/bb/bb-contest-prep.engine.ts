/**
 * bb-contest-prep.engine.ts — BB Contest Prep: единая система тапера ББ (пикинг к шоу).
 *
 * Покрывает обе стороны пикинга:
 *   1. ТРЕНИРОВОЧНЫЙ ТАПЕР — недельные множители объёма/интенсивности/RIR из
 *      Библиотеки методик (peaking-protocols.engine: bb 4 нед / classic WF / pl),
 *      накладывается на последние weeksOut недель сгенерированного BB-плана.
 *   2. НУТРИЦИОННАЯ ПИК-НЕДЕЛЯ (7 дней, день 7 = шоу) — ккал/БЖУ/клетчатка,
 *      вода (л), натрий (мг), калий (мг), тренировка по дням D-6..D-0,
 *      позирование, добавки, почасовой таймлайн дня шоу.
 *
 * В бодибилдинге пик-неделя — это прежде всего еда (карбс/вода/натрий),
 * тренировки вспомогательны (деплеция гликогена → отдых → памп).
 *
 * Источники: Helms MAAS (peak week), Schoenfeld 2021, практика соревновательного
 * ББ (front/back-load протоколы), Bosquet 2005 (объём ↓, интенсивность сохраняется).
 *
 * Чистый движок: без UI-импортов, все функции детерминированы, входы валидируются.
 */

import { getPeakingProtocol, type PeakingProtocol } from '../peaking-protocols.engine';
import type { BBPlan } from './bb-builder.engine';

// ═══════════════════════════════════════════════════════════════════════════
// Типы
// ═══════════════════════════════════════════════════════════════════════════

/** Категории ББ (id совпадают с planner-categories.ts — единая система id). */
export type BBContestCategory =
  | 'mens_physique' | 'classic_physique' | 'mens_bb' | 'bb_212'
  | 'bikini' | 'figure' | 'wellness' | 'womens_physique' | 'womens_bb';

export type CarbLoadStrategy = 'front' | 'moderate' | 'back';
export type WaterStrategy = 'classic' | 'moderate' | 'minimal';
export type SodiumStrategy = 'constant' | 'cut_2d' | 'cut_3d';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/** Специализация к соревнованиям — упор на мышцу/группу, которую подтягиваем к пику. */
export type ContestSpecialization =
  | 'none'
  | 'chest' | 'back' | 'shoulders' | 'arms'
  | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves'
  | 'abs' | 'traps';

export const CONTEST_SPECIALIZATION_LABELS: Record<ContestSpecialization, string> = {
  none: 'Без специализации',
  chest: 'Грудь',
  back: 'Спина',
  shoulders: 'Плечи',
  arms: 'Руки (бицепс+трицепс)',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  quads: 'Квадрицепс',
  hamstrings: 'Бицепс бедра',
  glutes: 'Ягодицы',
  calves: 'Икры',
  abs: 'Пресс',
  traps: 'Трапеции',
};

/** Соревнование в календаре подготовки (поддержка нескольких стартов). */
export interface ContestEventEntry {
  id: string;
  name: string;
  date?: string;              // ISO yyyy-mm-dd (если нет — используется showDate/неделя макроцикла)
  priority?: 'A' | 'B' | 'C'; // A — главный старт, B — контрольный, C — тренировочный
}

export interface BBContestPrepConfig {
  // ── Атлет ──
  sex: 'male' | 'female';
  category: BBContestCategory;
  weightKg: number;                 // 40..200
  bodyFatPct?: number;              // текущий % жира — оценка готовности к пику
  experienceLevel: ExperienceLevel;
  enhanced: boolean;                // курс/натурал (карбс-толерантность, диуретики)
  prepCount: number;                // сколько пиков уже пройдено (0 → консервативно)

  // ── Тайминг ──
  showDate: string;                 // ISO yyyy-mm-dd (день 7 пик-недели; при соревнованиях — fallback)
  weeksOut: number;                 // 1..4 — сколько последних недель плана покрывает тапер

  // ── Соревнования и специализация ──
  competitions?: ContestEventEntry[];  // несколько стартов (пик-неделя строится под ГЛАВНЫЙ)
  mainCompetitionId?: string;          // id главного соревнования (иначе авто: A > B > первое)
  specialization?: ContestSpecialization; // упор на мышцу к соревнованиям (объём щадится в тапере, добивка в пик-неделе)

  // ── Стратегии ──
  trainingProtocol: PeakingProtocol;   // кривая тапера из Библиотеки (bb/classic/pl)
  carbLoadStrategy: CarbLoadStrategy;  // front (D-4..D-2) / moderate (D-3..D-1) / back (D-2..D-1)
  waterStrategy: WaterStrategy;        // classic (load+cut) / moderate / minimal
  sodiumStrategy: SodiumStrategy;      // constant (современный) / cut_2d / cut_3d

  // ── Безопасность и предпочтения ──
  contraindications?: string[];     // kidney/heart/hypertension → force minimal+constant
  allergens?: string[];             // из профиля питания (для mealNotes)
  preferLowFiberCarbs?: boolean;    // рисовые хлебцы/белый рис вместо овсянки/бобовых
  creatineStrategy?: 'continue' | 'stop';
  schedule?: { wake: string; stage: string };  // для таймлайна шоу-дня (HH:mm)
  /** Явное подтверждение агрессивных модов (classic water / cut_* натрия). Без него — стабильные. */
  confirmedManipulation?: boolean;
}

/** Неделя тренировочного тапера (из Библиотеки методик, усечённая до weeksOut). */
export interface TrainingTaperWeek {
  weekOffset: number;   // -N .. -1 (относительно недели шоу)
  label: string;
  volumePct: number;    // множитель объёма (сетов)
  intensityPct: number; // множитель веса
  rirMin: number;
  rirMax: number;
  focus: string;
  deloadBefore: boolean;
}

export type PeakDayPhase =
  | 'deplete_1' | 'deplete_2' | 'deplete_3'
  | 'load_1' | 'load_2' | 'load_3'
  | 'peak' | 'show';

export interface PeakWeekDayPlan {
  day: number;              // 1..7 (7 = show day)
  date: string;             // ISO дата дня
  phase: PeakDayPhase;
  phaseLabel: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberMaxG: number;
  waterLiters: number;
  sodiumMg: number;
  potassiumMg: number;
  training: { type: string; minutes: number; details: string[] };
  cardioSteps: number;
  posingMinutes: number;
  sleepHours: number;
  supplementNotes: string[];
  mealNotes: string[];
}

export interface ShowTimelineItem { time: string; action: string; detail: string; }

export interface BBContestPrepResult {
  config: BBContestPrepConfig;
  taper: TrainingTaperWeek[];
  peakWeek: PeakWeekDayPlan[];
  showTimeline: ShowTimelineItem[];
  /** Соревнования (сортированы по дате/приоритету) и главное из них. */
  competitions: ContestEventEntry[];
  mainCompetition: ContestEventEntry | null;
  readiness: {
    targetBf: number | null;
    gap: number | null;
    verdict: 'on_track' | 'behind' | 'ahead';
    note: string;
  };
  warnings: string[];
  rationale: string[];
}

export interface ConfigValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** Принудительные безопасные моды (противопоказания). */
  forced: Partial<BBContestPrepConfig>;
}

/** BB-план с маркером наложенного тапера (идемпотентность, мульти-соревнования). */
export interface BBPlanWithPrep extends BBPlan {
  contestPrep?: {
    showDate: string;
    protocol: PeakingProtocol;
    weeksOut: number;
    appliedAt: string;
    /** 1-индекс недель плана, к которым уже применён тапер/пик-неделя. */
    appliedWeeks?: number[];
  };
}

/** База для оверлея на план питания (значения «без пик-недели»). */
export interface PeakNutritionBase {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  waterMl: number;
  sodiumMg: number;
}

/** Абсолютные цели дня пик-недели (приоритет над cycling). */
export interface PeakNutritionTargets {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberMaxG: number;
  waterMl: number;
  sodiumMg: number;
  potassiumMg: number;
  phase: PeakDayPhase | null;
  phaseLabel: string;
  note: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Таблицы категорий (профессиональный контент)
// ═══════════════════════════════════════════════════════════════════════════

interface CategoryProfile {
  label: string;
  sex: 'male' | 'female';
  /** Целевой % жира для stage condition. */
  targetBodyFatPct: number;
  /** Гликогеновая загрузка: г/кг/день по стратегиям. */
  carbLoadGPerKg: { front: [number, number]; moderate: [number, number]; back: [number, number] };
  /** Карбс деплеции, г/кг/день. */
  depleteCarbsGPerKg: number;
  /** Белок, г/кг/день (постоянный всю пик-неделю). */
  proteinGPerKg: number;
  /** Мягкая категория — не пересушивать (bikini/wellness). */
  light: boolean;
}

export const CATEGORY_PROFILES: Record<BBContestCategory, CategoryProfile> = {
  mens_bb:          { label: 'Bodybuilding (открытая)', sex: 'male',   targetBodyFatPct: 4,  carbLoadGPerKg: { front: [7, 8], moderate: [6, 7], back: [4, 5] }, depleteCarbsGPerKg: 0.7, proteinGPerKg: 2.5, light: false },
  bb_212:           { label: '212 Olympia',             sex: 'male',   targetBodyFatPct: 4,  carbLoadGPerKg: { front: [7, 8], moderate: [6, 7], back: [4, 5] }, depleteCarbsGPerKg: 0.7, proteinGPerKg: 2.5, light: false },
  classic_physique: { label: 'Classic Physique',        sex: 'male',   targetBodyFatPct: 5,  carbLoadGPerKg: { front: [7, 8], moderate: [6, 7], back: [4, 5] }, depleteCarbsGPerKg: 0.7, proteinGPerKg: 2.4, light: false },
  mens_physique:    { label: "Men's Physique",          sex: 'male',   targetBodyFatPct: 6,  carbLoadGPerKg: { front: [5, 6], moderate: [4, 5], back: [3, 4] }, depleteCarbsGPerKg: 0.8, proteinGPerKg: 2.3, light: false },
  womens_bb:        { label: "Women's Bodybuilding",    sex: 'female', targetBodyFatPct: 6,  carbLoadGPerKg: { front: [5, 6], moderate: [4, 5], back: [3, 4] }, depleteCarbsGPerKg: 0.9, proteinGPerKg: 2.2, light: false },
  womens_physique:  { label: "Women's Physique",        sex: 'female', targetBodyFatPct: 7,  carbLoadGPerKg: { front: [5, 6], moderate: [4, 5], back: [3, 4] }, depleteCarbsGPerKg: 0.9, proteinGPerKg: 2.2, light: false },
  figure:           { label: 'Figure',                  sex: 'female', targetBodyFatPct: 9,  carbLoadGPerKg: { front: [4, 5], moderate: [3, 4], back: [2, 3] }, depleteCarbsGPerKg: 0.9, proteinGPerKg: 2.2, light: false },
  bikini:           { label: 'Bikini',                  sex: 'female', targetBodyFatPct: 11, carbLoadGPerKg: { front: [3, 4], moderate: [2.5, 3], back: [2, 2.5] }, depleteCarbsGPerKg: 1.0, proteinGPerKg: 2.0, light: true },
  wellness:         { label: 'Wellness',                sex: 'female', targetBodyFatPct: 12, carbLoadGPerKg: { front: [3, 4], moderate: [2.5, 3], back: [2, 2.5] }, depleteCarbsGPerKg: 1.0, proteinGPerKg: 2.0, light: true },
};

export const CONTEST_CATEGORY_LABELS: Record<BBContestCategory, string> = Object.fromEntries(
  (Object.keys(CATEGORY_PROFILES) as BBContestCategory[]).map(k => [k, CATEGORY_PROFILES[k].label]),
) as Record<BBContestCategory, string>;

/** Канонические мышцы BB-планов, на которые влияет специализация. */
const SPEC_TO_MUSCLES: Record<Exclude<ContestSpecialization, 'none'>, string[]> = {
  chest: ['chest'],
  back: ['back'],
  shoulders: ['shoulders', 'delt_front', 'delt_mid', 'delt_rear'],
  arms: ['biceps', 'triceps', 'forearms'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  quads: ['quads'],
  hamstrings: ['hamstrings'],
  glutes: ['glutes'],
  calves: ['calves'],
  abs: ['abs'],
  traps: ['traps'],
};

/** Совпадает ли мышца упражнения со специализацией. */
export function muscleMatchesSpecialization(muscle: string | null | undefined, spec: ContestSpecialization | undefined): boolean {
  if (!spec || spec === 'none') return false;
  const targets = SPEC_TO_MUSCLES[spec] ?? [];
  const m = String(muscle || '').toLowerCase();
  return targets.some(t => m === t || m.includes(t) || t.includes(m));
}

/** Главное соревнование: явный id → авто (A > B > первое) → null. */
export function resolveMainCompetition(cfg: BBContestPrepConfig): ContestEventEntry | null {
  const comps = Array.isArray(cfg.competitions) ? cfg.competitions : [];
  if (comps.length === 0) return null;
  if (cfg.mainCompetitionId) {
    const found = comps.find(c => c.id === cfg.mainCompetitionId);
    if (found) return found;
  }
  return comps.find(c => c.priority === 'A')
    ?? comps.find(c => c.priority === 'B')
    ?? comps[0]
    ?? null;
}

/** Дата главного шоу: дата главного соревнования или showDate. */
export function resolveShowDate(cfg: BBContestPrepConfig): string {
  const main = resolveMainCompetition(cfg);
  if (main?.date && isValidIsoDate(main.date)) return main.date;
  return cfg.showDate;
}

/** Фазы по дням (день 1 = D-6, день 7 = шоу). */
const PHASES_BY_STRATEGY: Record<CarbLoadStrategy, PeakDayPhase[]> = {
  // front: деплеция 2 дня (D-6, D-5) → загрузка 3 дня (D-4..D-2) → пик (D-1) → шоу.
  front: ['deplete_1', 'deplete_2', 'load_1', 'load_2', 'load_3', 'peak', 'show'],
  // moderate: классика 3/3 — деплеция (D-6..D-4) → загрузка (D-3..D-1) → шоу.
  moderate: ['deplete_1', 'deplete_2', 'deplete_3', 'load_1', 'load_2', 'load_3', 'show'],
  // back: деплеция 3 дня → переход (D-3) → загрузка 2 дня (D-2, D-1) → шоу.
  back: ['deplete_1', 'deplete_2', 'deplete_3', 'peak', 'load_1', 'load_2', 'show'],
};

export const PHASE_LABELS_RU: Record<PeakDayPhase, string> = {
  deplete_1: 'Деплеция 1',
  deplete_2: 'Деплеция 2',
  deplete_3: 'Деплеция 3',
  load_1: 'Загрузка 1',
  load_2: 'Загрузка 2',
  load_3: 'Загрузка 3',
  peak: 'Пик',
  show: 'Шоу',
};

/** Визуальные цвета фаз пик-недели (единые для всех UI-поверхностей). */
export const PEAK_PHASE_COLORS: Record<PeakDayPhase, string> = {
  deplete_1: '#f59e0b',
  deplete_2: '#f59e0b',
  deplete_3: '#f59e0b',
  load_1: '#22c55e',
  load_2: '#22c55e',
  load_3: '#22c55e',
  peak: '#a855f7',
  show: '#fbbf24',
};

/** Вода по дням (л) — множители от пика нагрузки. */
const WATER_DAY_MULT: Record<WaterStrategy, number[]> = {
  classic: [1, 1, 1, 1, 0.6, 0.35, 0.03],  // load → ступенчатый cut → глотки
  moderate: [1, 1, 1, 1, 1, 0.5, 0.1],     // мягкий cut
  minimal: [1, 1, 1, 1, 1, 1, 0.15],       // без манипуляций
};

/** Натрий по дням (мг). */
const SODIUM_DAY_MG: Record<SodiumStrategy, [number, number, number, number, number, number, number]> = {
  constant: [2800, 2800, 2800, 2800, 2800, 2800, 2000],
  cut_2d:   [3000, 3000, 3000, 3000, 3000, 800, 600],
  cut_3d:   [3000, 3000, 3000, 3000, 1500, 500, 500],
};

const KNOWN_CONTRAINDICATIONS = ['kidney', 'heart', 'hypertension'];

// ═══════════════════════════════════════════════════════════════════════════
// Утилиты
// ═══════════════════════════════════════════════════════════════════════════

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round1 = (v: number): number => Math.round(v * 10) / 10;

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Локальное «сегодня» в ISO (без UTC-сдвигов). */
export function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Таймзона-безопасная арифметика ISO-дат (без toISOString-сдвигов). */
export function isoAddDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Разница в календарных днях: bIso − aIso (положительно, если b позже). */
export function isoDiffDays(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00`);
  const b = new Date(`${bIso}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function daysBetween(aIso: string, bIso: string): number {
  return isoDiffDays(aIso, bIso);
}

function timeMinus(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(2000, 0, 1, Number.isFinite(h) ? h : 7, Number.isFinite(m) ? m : 0);
  d.setMinutes(d.getMinutes() - minutes);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function hasContraindication(cfg: BBContestPrepConfig, id: string): boolean {
  const list = (cfg.contraindications || []).map(c => c.trim().toLowerCase());
  const patterns: Record<string, RegExp> = {
    kidney: /kidney|kidneys|почк/,
    heart: /heart|серд/,
    hypertension: /hypertension|гипертон|давлен|blood.?pressure/,
  };
  const re = patterns[id];
  return re ? list.some(c => re.test(c)) : false;
}

// ═══════════════════════════════════════════════════════════════════════════
// Валидация
// ═══════════════════════════════════════════════════════════════════════════

export function validateBBContestPrepConfig(cfg: BBContestPrepConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const forced: Partial<BBContestPrepConfig> = {};

  if (!cfg) { errors.push('Конфиг отсутствует.'); return { ok: false, errors, warnings, forced }; }

  const profile = CATEGORY_PROFILES[cfg.category];
  if (!profile) errors.push(`Неизвестная категория: ${cfg.category}`);
  else if (profile.sex !== cfg.sex) errors.push(`Категория «${profile.label}» не соответствует полу «${cfg.sex}».`);

  if (!Number.isFinite(cfg.weightKg) || cfg.weightKg < 40 || cfg.weightKg > 200) {
    errors.push(`Вес ${cfg.weightKg} кг вне диапазона 40–200.`);
  }
  if (cfg.bodyFatPct != null && (!Number.isFinite(cfg.bodyFatPct) || cfg.bodyFatPct < 3 || cfg.bodyFatPct > 60)) {
    errors.push(`% жира ${cfg.bodyFatPct} вне диапазона 3–60.`);
  }
  if (!isValidIsoDate(cfg.showDate)) errors.push(`Дата шоу «${cfg.showDate}» некорректна (нужно ISO yyyy-mm-dd).`);
  else if (daysBetween(new Date().toISOString().slice(0, 10), cfg.showDate) < 0) errors.push('Дата шоу в прошлом.');
  if (!Number.isInteger(cfg.weeksOut) || cfg.weeksOut < 1 || cfg.weeksOut > 4) errors.push(`weeksOut ${cfg.weeksOut} вне диапазона 1–4.`);
  if (!['bb', 'classic', 'pl'].includes(cfg.trainingProtocol)) errors.push(`Неизвестный тренировочный протокол: ${cfg.trainingProtocol}`);
  if (!['front', 'moderate', 'back'].includes(cfg.carbLoadStrategy)) errors.push(`Неизвестная карб-стратегия: ${cfg.carbLoadStrategy}`);
  if (!['classic', 'moderate', 'minimal'].includes(cfg.waterStrategy)) errors.push(`Неизвестная водная стратегия: ${cfg.waterStrategy}`);
  if (!['constant', 'cut_2d', 'cut_3d'].includes(cfg.sodiumStrategy)) errors.push(`Неизвестная натриевая стратегия: ${cfg.sodiumStrategy}`);
  if (!['beginner', 'intermediate', 'advanced'].includes(cfg.experienceLevel)) errors.push(`Неизвестный уровень: ${cfg.experienceLevel}`);
  if (!Number.isFinite(cfg.prepCount) || cfg.prepCount < 0) errors.push(`prepCount ${cfg.prepCount} некорректен.`);
  if (cfg.schedule && (cfg.schedule.wake != null || cfg.schedule.stage != null)) {
    const okTime = (t?: string) => t == null || /^\d{2}:\d{2}$/.test(t);
    if (!okTime(cfg.schedule.wake) || !okTime(cfg.schedule.stage)) errors.push('schedule.wake/stage должны быть в формате HH:mm.');
  }
  // ── Соревнования и специализация ──
  const comps = Array.isArray(cfg.competitions) ? cfg.competitions : [];
  const compIds = new Set<string>();
  for (const c of comps) {
    if (!c || typeof c.id !== 'string' || !c.id.trim() || typeof c.name !== 'string' || !c.name.trim()) {
      errors.push('Каждое соревнование должно иметь id и название.');
      continue;
    }
    if (compIds.has(c.id)) errors.push(`Дублирующийся id соревнования: ${c.id}`);
    compIds.add(c.id);
    if (c.date != null && !isValidIsoDate(c.date)) errors.push(`Дата соревнования «${c.name}» некорректна (нужно ISO yyyy-mm-dd).`);
    if (c.priority != null && !['A', 'B', 'C'].includes(c.priority)) errors.push(`Приоритет соревнования «${c.name}» должен быть A/B/C.`);
  }
  if (cfg.mainCompetitionId && !compIds.has(cfg.mainCompetitionId)) {
    errors.push(`Главное соревнование ${cfg.mainCompetitionId} не найдено в списке.`);
  }
  if (comps.length > 0 && !cfg.mainCompetitionId && !comps.some(c => c.priority === 'A')) {
    warnings.push('💡 Укажите главное соревнование (или приоритет A) — пик-неделя строится под главный старт.');
  }
  if (comps.filter(c => c.priority === 'A').length > 1) {
    warnings.push('⚠ Несколько соревнований с приоритетом A — выберите одно главное (mainCompetitionId).');
  }
  if (cfg.specialization != null && !(cfg.specialization in CONTEST_SPECIALIZATION_LABELS)) {
    errors.push(`Неизвестная специализация: ${cfg.specialization}`);
  }

  // ── Принудительные безопасные моды по противопоказаниям ──
  for (const id of KNOWN_CONTRAINDICATIONS) {
    if (!hasContraindication(cfg, id)) continue;
    const label = id === 'kidney' ? 'почки' : id === 'heart' ? 'сердце' : 'гипертония';
    warnings.push(`⚠ Противопоказание (${label}): агрессивные водные/натриевые манипуляции опасны.`);
    if (cfg.waterStrategy !== 'minimal') {
      forced.waterStrategy = 'minimal';
      warnings.push('Водная стратегия принудительно переведена в «minimal» (без load/cut).');
    }
    if (cfg.sodiumStrategy !== 'constant') {
      forced.sodiumStrategy = 'constant';
      warnings.push('Натриевая стратегия принудительно переведена в «constant» (натрий не трогаем).');
    }
    if (cfg.carbLoadStrategy !== 'moderate') {
      forced.carbLoadStrategy = 'moderate';
      warnings.push('Карб-загрузка принудительно переведена в «moderate» (умеренная).');
    }
  }

  // ── Рекомендательные warnings ──
  if (cfg.experienceLevel === 'beginner' || cfg.prepCount === 0) {
    warnings.push('💡 Первый пик (или новичок): минимум манипуляций — вода minimal, натрий constant, карбс moderate. Нарабатывайте опыт, не рискуйте формой.');
  }
  if (cfg.sex === 'female') {
    warnings.push('⚠ Женщины: вода не ниже 1.5–2 л/день, натрий не ниже 800 мг — риск гипонатриемии выше при меньшей массе.');
  }
  if (profile && profile.light) {
    warnings.push(`⚠ Категория «${profile.label}»: не пересушивать — судьи хотят мягкую сухость, агрессивные water/sodium-протоколы ломают look.`);
  }
  if (profile && cfg.bodyFatPct != null && cfg.bodyFatPct - profile.targetBodyFatPct > 2) {
    warnings.push(`⚠ Готовность: % жира ${cfg.bodyFatPct}% при цели ~${profile.targetBodyFatPct}% — до сухости не дожато. Карб-загрузка даст залив: выбирайте moderate/back и мягкий water cut.`);
  }
  if (cfg.enhanced && cfg.waterStrategy === 'classic') {
    warnings.push('⚠ Курс + классический water cut: диуретики — ТОЛЬКО по назначению врача. Контроль K/Mg обязателен (судороги, аритмия).');
  }
  if (cfg.waterStrategy === 'classic') {
    warnings.push('⚠ Классический water load/cut — экстремальная манипуляция: контроль электролитов (K+ 3000–4700 мг, Mg 300–400 мг), риск гипонатриемии/судорог.');
  }

  return { ok: errors.length === 0, errors, warnings, forced };
}

/** Применить force-моды к конфигу (не меняет входной объект). */
export function applyForcedModes(cfg: BBContestPrepConfig): BBContestPrepConfig {
  const { forced } = validateBBContestPrepConfig(cfg);
  return { ...cfg, ...forced };
}

// ═══════════════════════════════════════════════════════════════════════════
// Тренировочный тапер (canonical BB-кривая; PL/classic — из Библиотеки методик)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Каноническая BB-кривая тапера (современный подход, Bosquet 2005 + Helms 2022):
 * объём снижается (90% → 60%), ИНТЕНСИВНОСТЬ сохраняется (95% → 85%),
 * RIR 2–4 (никакого автоматического RIR 0 и отказных серий),
 * без новых упражнений и тяжёлых эксцентрических нагрузок.
 */
const BB_TAPER_CURVE: Array<Pick<TrainingTaperWeek, 'label' | 'volumePct' | 'intensityPct' | 'rirMin' | 'rirMax' | 'focus' | 'deloadBefore'>> = [
  { label: 'Подводящая', volumePct: 0.90, intensityPct: 0.95, rirMin: 2, rirMax: 3, focus: 'Объём слегка снижен, рабочие веса сохраняются, без отказа', deloadBefore: true },
  { label: 'Taper-2', volumePct: 0.85, intensityPct: 0.95, rirMin: 2, rirMax: 3, focus: 'Снижение объёма (80–90%), интенсивность сохраняется, RIR 2–3', deloadBefore: false },
  { label: 'Taper-1', volumePct: 0.70, intensityPct: 0.90, rirMin: 2, rirMax: 4, focus: 'Объём 60–75%, вес в разумных пределах, RIR 2–4', deloadBefore: false },
  { label: 'Финал', volumePct: 0.60, intensityPct: 0.85, rirMin: 2, rirMax: 4, focus: 'Минимум объёма, памп-акцент, без отказа', deloadBefore: false },
];

export function buildTrainingTaper(cfg: BBContestPrepConfig): TrainingTaperWeek[] {
  const v = validateBBContestPrepConfig(cfg);
  if (!v.ok) return [];
  const eff = applyForcedModes(cfg);
  const source = eff.trainingProtocol === 'bb'
    ? BB_TAPER_CURVE
    : getPeakingProtocol(eff.trainingProtocol).weeks;
  const selected = source.slice(-eff.weeksOut);
  const n = selected.length;
  return selected.map((w, i) => ({
    weekOffset: -(n - i),
    label: w.label,
    volumePct: w.volumePct,
    intensityPct: w.intensityPct,
    rirMin: w.rirMin,
    rirMax: w.rirMax,
    focus: w.focus,
    deloadBefore: w.deloadBefore,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Пик-неделя: 7 дней (день 7 = шоу)
// ═══════════════════════════════════════════════════════════════════════════

// Кэш buildPeakWeek: пик-неделя вызывается per-day из hot path планировщика
// (nutritionTargetsForPrepDate для каждого дня плана) — повторные сборки
// с одинаковыми ключами не пересчитываются.
const _peakWeekCache = new Map<string, PeakWeekDayPlan[]>();
function peakWeekCached(eff: BBContestPrepConfig): PeakWeekDayPlan[] {
  const key = `${eff.sex}|${eff.category}|${eff.weightKg}|${eff.carbLoadStrategy}|${eff.waterStrategy}|${eff.sodiumStrategy}|${eff.showDate}|${eff.preferLowFiberCarbs ? 1 : 0}|${eff.creatineStrategy ?? ''}|${eff.allergens?.join(',') ?? ''}`;
  const hit = _peakWeekCache.get(key);
  if (hit) return hit;
  const built = buildPeakWeek(eff);
  if (_peakWeekCache.size >= 32) {
    const firstKey = _peakWeekCache.keys().next().value;
    if (firstKey) _peakWeekCache.delete(firstKey);
  }
  _peakWeekCache.set(key, built);
  return built;
}

interface DayTraining {
  type: string;
  minutes: number;
  details: string[];
}

const TRAINING_BY_PHASE: Record<PeakDayPhase, DayTraining> = {
  deplete_1: {
    type: 'Верх круговой (деплеция гликогена)',
    minutes: 50,
    details: [
      '3 круга: жим → тяга → плечи → руки, 12–15 повт, ~60–70% рабочего веса',
      'Отдых между кругами 90–120 сек — метаболический стресс, не силовой',
      'Без отказа: цель — исчерпать гликоген, не накопить повреждения',
    ],
  },
  deplete_2: {
    type: 'Низ круговой (деплеция гликогена)',
    minutes: 50,
    details: [
      '3 круга: присед-паттерн → RDL → сгибания ног → икры, 12–15 повт, ~60–70%',
      'Отдых 90–120 сек между кругами',
      'Держите технику — усталость растёт, риск травмы выше',
    ],
  },
  deplete_3: {
    type: 'Full-body лёгкий (финальная деплеция)',
    minutes: 30,
    details: [
      '2 круга полного тела, только изоляция/тренажёры, 15–20 повт, лёгкий вес',
      'Короткий отдых 60 сек — завершаем исчерпание',
    ],
  },
  load_1: { type: 'Отдых', minutes: 0, details: ['Без тренировки — гликоген начинает наполняться. Лёгкая прогулка 20–30 мин.'] },
  load_2: { type: 'Отдых', minutes: 0, details: ['Полный покой. Позирование и растяжка.'] },
  load_3: { type: 'Отдых', minutes: 0, details: ['Полный покой. Проверка поз, прогон обязательной программы.'] },
  peak: { type: 'Отдых / лёгкий памп по желанию', minutes: 15, details: ['Если «заливает» — 10–15 мин лёгкого пампа верх тела. Иначе — покой.'] },
  show: {
    type: 'Памп-рутина backstage',
    minutes: 25,
    details: [
      'Резинки/отжимания/лёгкие гантели: 15–20 повт, 2 круга, без усталости',
      'Цель — налить мышцы кровью перед выходом',
    ],
  },
};

const POSING_BY_DAY: Record<number, number> = { 1: 20, 2: 20, 3: 25, 4: 30, 5: 30, 6: 45, 7: 60 };
const STEPS_BY_DAY: Record<number, number> = { 1: 12000, 2: 12000, 3: 10000, 4: 9000, 5: 8000, 6: 6000, 7: 4000 };

export function buildPeakWeek(cfg: BBContestPrepConfig): PeakWeekDayPlan[] {
  const v = validateBBContestPrepConfig(cfg);
  if (!v.ok) return [];
  const eff = applyForcedModes(cfg);
  const profile = CATEGORY_PROFILES[eff.category];
  const isFemale = eff.sex === 'female';
  const w = eff.weightKg;
  const phases = PHASES_BY_STRATEGY[eff.carbLoadStrategy];

  const proteinG = Math.round(w * profile.proteinGPerKg);
  const potassiumMg = isFemale ? 3500 : 4000;
  const depleteCarbs = clamp(Math.round(w * profile.depleteCarbsGPerKg), 40, 120);
  const [carbLo, carbHi] = profile.carbLoadGPerKg[eff.carbLoadStrategy];
  const carbMid = Math.round((carbLo + carbHi) / 2 * w);
  const carbLoG = Math.round(carbLo * w);
  const carbHiG = Math.round(carbHi * w);
  const peakCarbs = clamp(Math.round(w * (isFemale ? 1.8 : 2.2)), 100, 260);
  const showCarbs = clamp(Math.round(w * (isFemale ? 1.4 : 1.8)), 80, 220);

  const carbsForPhase = (phase: PeakDayPhase): number => {
    switch (phase) {
      case 'deplete_1': case 'deplete_2': case 'deplete_3': return depleteCarbs;
      case 'load_1': return carbLoG;
      case 'load_2': return carbMid;
      case 'load_3': return carbHiG;
      case 'peak': return peakCarbs;
      case 'show': return showCarbs;
      default: return depleteCarbs;
    }
  };

  // Вода
  const waterBase = eff.waterStrategy === 'classic'
    ? clamp(round1(w * 0.115), 6, 10)
    : eff.waterStrategy === 'moderate'
      ? clamp(round1(w * 0.075), 4, 6)
      : clamp(round1(w * 0.04), 2.5, 4);
  const waterMults = WATER_DAY_MULT[eff.waterStrategy];

  // Натрий
  const naRow = SODIUM_DAY_MG[eff.sodiumStrategy];
  const naFloor = (profile.light || isFemale) ? 800 : 0;
  const showNaFloor = 500;

  const fiberFor = (phase: PeakDayPhase): number =>
    phase.startsWith('deplete') ? 40 : phase === 'show' ? 15 : 25;

  const fatGPerKg = (phase: PeakDayPhase): number => {
    if (phase.startsWith('deplete')) return profile.light ? 0.8 : 0.9;
    return profile.light ? 0.45 : 0.35;
  };

  const days: PeakWeekDayPlan[] = phases.map((phase, idx) => {
    const day = idx + 1;
    const carbsG = carbsForPhase(phase);
    const fatG = Math.max(30, Math.round(w * fatGPerKg(phase)));
    const kcal = Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
    const waterLiters = round1(Math.max(isFemale && day === 7 ? 0.5 : 0.25, waterBase * waterMults[idx]));
    const sodiumMg = Math.max(day === 7 ? showNaFloor : naFloor, naRow[idx]);

    const carbSource = cfg.preferLowFiberCarbs
      ? 'Низковолокнистые карбс: белый рис, рисовые хлебцы, картофель, мёд, джем'
      : 'Карбс: белый рис, картофель, хлебцы, фрукты малыми порциями';

    const mealNotes: string[] = [];
    if (phase.startsWith('deplete')) {
      mealNotes.push(`Белок ${proteinG} г распределить на 4–5 приёмов. Карбс — только вокруг тренировки и овощи.`);
      mealNotes.push('Овощи с высоким объёмом (огурец, салат) — борьба с голодом без калорий.');
    } else if (phase.startsWith('load')) {
      mealNotes.push(`${carbSource}. ${carbsG} г карбс на 6–7 малых приёмов каждые 2–2.5 ч.`);
      mealNotes.push(`Жиры минимум (${fatG} г) — жир замедляет всасывание карбс. Клетчатка ≤ 25 г.`);
    } else if (phase === 'peak') {
      mealNotes.push('Умеренные карбс, вода снижена. Последняя проверка формы: при заливе — не добавляйте соль.');
    } else {
      mealNotes.push('Завтрак за 2.5 ч до выхода: рисовые хлебцы + мёд/джем, ½ банана, кофе при привычке.');
      mealNotes.push('Далее карбс малыми порциями каждые 1.5–2 ч. Вода глотками.');
    }
    if (cfg.allergens?.length) mealNotes.push(`Исключить аллергены: ${cfg.allergens.join(', ')}.`);

    const supplementNotes: string[] = [];
    supplementNotes.push(`Магний 300–400 мг/день (анти-судороги), калий ${potassiumMg} мг — не снижать.`);
    if (cfg.creatineStrategy === 'stop') supplementNotes.push('Креатин прекращён за 2 нед (по выбору). Современный консенсус: отмена не обязательна — не влияет на подкожную воду.');
    else supplementNotes.push('Креатин продолжаем — на подкожную воду не влияет.');
    if (phase === 'deplete_1') {
      supplementNotes.push('Никаких новых добавок в пик-неделю. Витамин C/рыбий жир — как обычно.');
      supplementNotes.push('Диуретики — только по назначению врача. Самодеятельность опасна.');
    }
    if (phase === 'show') supplementNotes.push('Соль пакетик за 30–60 мин до выхода (только продвинутые, при постоянном натрии) — васкулярность.');

    return {
      day,
      date: isoAddDays(eff.showDate, idx - 6),
      phase,
      phaseLabel: PHASE_LABELS_RU[phase],
      kcal,
      proteinG,
      carbsG,
      fatG,
      fiberMaxG: fiberFor(phase),
      waterLiters,
      sodiumMg,
      potassiumMg,
      training: TRAINING_BY_PHASE[phase],
      cardioSteps: STEPS_BY_DAY[day] ?? 8000,
      posingMinutes: POSING_BY_DAY[day] ?? 30,
      sleepHours: day === 7 ? 8 : 9,
      supplementNotes,
      mealNotes,
    };
  });

  return days;
}

// ═══════════════════════════════════════════════════════════════════════════
// Таймлайн дня шоу
// ═══════════════════════════════════════════════════════════════════════════

export function buildShowTimeline(cfg: BBContestPrepConfig): ShowTimelineItem[] {
  const wake = cfg.schedule?.wake || '07:00';
  const stage = cfg.schedule?.stage || '12:00';
  const steps: Array<[number, string, string]> = [
    [150, 'Подъём', 'Лёгкий завтрак: рисовые хлебцы + мёд/джем, ½ банана, сывороточный изолят при голоде. Кофе — при привычке.'],
    [120, 'Завтрак окончен', 'Первый перекус карбс (рисовые хлебцы). Вода глотками.'],
    [90, 'Грим / укладка', 'Финализация внешнего вида, загар/грумминг.'],
    [60, 'Backstage', 'Вода глотками. При постоянном натрии: щепотка соли (продвинутые) — васкулярность.'],
    [45, 'Памп-рутина', 'Резинки, отжимания, лёгкие гантели 15–20 повт × 2 круга. Цель — налить мышцы.'],
    [30, 'Финальный карбс', 'Рисовые хлебцы + мёд. Проверка поз перед зеркалом.'],
    [15, 'Прогон позирования', 'Обязательная программа: удержание каждой позы 3–5 сек.'],
    [0, 'Выход на сцену', 'Улыбка, контроль дыхания, фиксация поз. Вы готовы.'],
  ];
  return steps.map(([min, action, detail]) => ({
    time: timeMinus(stage, min),
    action,
    detail,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Готовность (bodyFat vs цель категории)
// ═══════════════════════════════════════════════════════════════════════════

export function computeReadiness(cfg: BBContestPrepConfig): BBContestPrepResult['readiness'] {
  const profile = CATEGORY_PROFILES[cfg.category];
  if (!profile) {
    return { targetBf: null, gap: null, verdict: 'on_track', note: 'Категория неизвестна — готовность не оценивается.' };
  }
  if (cfg.bodyFatPct == null) {
    return { targetBf: profile.targetBodyFatPct, gap: null, verdict: 'on_track', note: '% жира не указан — готовность не оценивается. Укажите текущий % жира.' };
  }
  const gap = Math.round((cfg.bodyFatPct - profile.targetBodyFatPct) * 10) / 10;
  if (gap <= 0.5) {
    return { targetBf: profile.targetBodyFatPct, gap, verdict: 'ahead', note: `Уже на цели (или суше): минимум манипуляций, карб-загрузка без риска залива.` };
  }
  if (gap <= 2) {
    return { targetBf: profile.targetBodyFatPct, gap, verdict: 'on_track', note: `До цели ${gap}% — по графику. Стандартный протокол подойдёт.` };
  }
  return {
    targetBf: profile.targetBodyFatPct, gap, verdict: 'behind',
    note: `До цели ${gap}% — сушка не дожата. Карб-загрузка даст залив: moderate/back + мягкий water cut.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Сборка полного результата
// ═══════════════════════════════════════════════════════════════════════════

export function buildBBContestPrep(rawCfg: BBContestPrepConfig): BBContestPrepResult {
  const v = validateBBContestPrepConfig(rawCfg);
  if (!v.ok) {
    throw new Error(`Некорректный конфиг тапера ББ: ${v.errors.join(' ')}`);
  }
  const base = applyForcedModes(rawCfg);
  const showDate = resolveShowDate(base);
  const cfg: BBContestPrepConfig = { ...base, showDate };
  const profile = CATEGORY_PROFILES[cfg.category];
  const taper = buildTrainingTaper(cfg);
  const peakWeek = buildPeakWeek(cfg);
  const showTimeline = buildShowTimeline(cfg);
  const readiness = computeReadiness(cfg);

  const competitions = [...(Array.isArray(cfg.competitions) ? cfg.competitions : [])].sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
    const pr = { A: 0, B: 1, C: 2 };
    return (pr[a.priority ?? 'C'] ?? 2) - (pr[b.priority ?? 'C'] ?? 2);
  });
  const mainCompetition = resolveMainCompetition(cfg);
  const spec = cfg.specialization;

  const warnings = [...v.warnings];
  const rationale = [
    `🏁 Тапер ББ: категория ${profile.label} (${cfg.sex}), вес ${cfg.weightKg} кг, шоу ${cfg.showDate}.`,
    `📉 Тренировки: протокол «${getPeakingProtocol(cfg.trainingProtocol).name}», последние ${cfg.weeksOut} нед (${taper.map(t => `${t.label} ${Math.round(t.volumePct * 100)}%`).join(' → ')}).`,
    `🍚 Карбс: ${cfg.carbLoadStrategy} (деплеция ${peakWeek.filter(d => d.phase.startsWith('deplete')).length} дн → загрузка ${peakWeek.filter(d => d.phase.startsWith('load')).length} дн).`,
    `💧 Вода: ${cfg.waterStrategy}; 🧂 натрий: ${cfg.sodiumStrategy}; калий ${peakWeek[0]?.potassiumMg ?? 3500} мг — не снижается.`,
    `🎭 Позирование ${POSING_BY_DAY[1]}–${POSING_BY_DAY[7]} мин/день; день шоу — памп-рутина backstage.`,
  ];
  if (competitions.length > 0) {
    rationale.push(`🏁 Соревнования (${competitions.length}): ${competitions.map(c => `${c.name}${c.priority ? ` [${c.priority}]` : ''}`).join(', ')}.`);
    if (mainCompetition) rationale.push(`⭐ Главный старт: «${mainCompetition.name}»${mainCompetition.date ? ` (${mainCompetition.date})` : ''} — пик-неделя и тапер строятся под него.`);
  }
  if (spec && spec !== 'none') {
    rationale.push(`⭐ Специализация: ${CONTEST_SPECIALIZATION_LABELS[spec]} — объём целевой мышцы щадится в тапере и добивается в памп-сессиях пик-недели.`);
  }
  if (cfg.enhanced) rationale.push('💉 На курсе: карбс-толерантность выше; диуретики — только врач.');

  return { config: cfg, taper, peakWeek, showTimeline, competitions, mainCompetition, readiness, warnings, rationale };
}

// ═══════════════════════════════════════════════════════════════════════════
// Пик-неделя по реальной дате (анкоринг вместо offset % 7)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * День пик-недели для конкретной даты. null — дата вне окна [шоу−6, шоу].
 * День 1 = D-6, день 7 = шоу.
 */
export function peakWeekDayForDate(dateIso: string, cfg: BBContestPrepConfig): PeakWeekDayPlan | null {
  if (!isValidIsoDate(dateIso)) return null;
  const v = validateBBContestPrepConfig(cfg);
  if (!v.ok) return null;
  const showDate = resolveShowDate(cfg);
  const diff = daysBetween(dateIso, showDate); // дней от date до шоу
  if (diff < 0 || diff > 6) return null;
  const peakWeek = peakWeekCached({ ...cfg, showDate });
  // diff = дней от date до шоу: 0 → шоу (день 7), 6 → день 1 (D-6).
  return peakWeek[6 - diff] ?? null;
}

/**
 * Абсолютные цели питания на день (приоритет над cycling).
 * Вне пик-недели возвращает базу без изменений (note = null).
 */
export function computePeakWeekNutritionTargets(
  dateIso: string,
  base: PeakNutritionBase,
  cfg: BBContestPrepConfig,
): PeakNutritionTargets {
  const day = peakWeekDayForDate(dateIso, cfg);
  if (!day) {
    return {
      kcal: base.kcal, proteinG: base.proteinG, fatG: base.fatG, carbsG: base.carbsG,
      fiberMaxG: 60, waterMl: base.waterMl, sodiumMg: base.sodiumMg, potassiumMg: 3500,
      phase: null, phaseLabel: '', note: '',
    };
  }
  return {
    kcal: day.kcal,
    proteinG: day.proteinG,
    fatG: day.fatG,
    carbsG: day.carbsG,
    fiberMaxG: day.fiberMaxG,
    waterMl: Math.round(day.waterLiters * 1000),
    sodiumMg: day.sodiumMg,
    potassiumMg: day.potassiumMg,
    phase: day.phase,
    phaseLabel: day.phaseLabel,
    note: `🏁 Пик-неделя D-${7 - day.day} (${day.phaseLabel}): карбс ${day.carbsG} г, жиры ${day.fatG} г, вода ${day.waterLiters} л, натрий ${day.sodiumMg} мг. ${day.training.type === 'Отдых' ? 'Тренировка: отдых.' : `Тренировка: ${day.training.type.toLowerCase()}.`}`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Оверлеи на BB-план
// ═══════════════════════════════════════════════════════════════════════════

function weekVolume(wk: BBPlan['weeks'][number]): number {
  let v = 0;
  for (const s of wk.sessions) for (const e of s.exercises) v += (e.sets || 0);
  return v;
}

/**
 * Преобразовать сессию в пик-недельную (памп/деплеция) по порядковому номеру.
 * si 0 → верх круговой, si 1 → низ круговой, si 2 → full-body лёгкий,
 * si ≥ 3 → отдых (пустая сессия с пометкой).
 */
function toPeakWeekSession(
  session: BBPlan['weeks'][number]['sessions'][number],
  si: number,
  cfg: BBContestPrepConfig,
  peakWeek: PeakWeekDayPlan[],
): any {
  const training = peakWeek[Math.min(si, 2)]?.training ?? TRAINING_BY_PHASE.deplete_3;
  if (si >= 3) {
    return {
      ...session,
      exercises: [],
      peakWeekRest: true,
      comment: `Пик-неделя: отдых. Позирование ${POSING_BY_DAY[7] ?? 60} мин, растяжка.`,
    };
  }
  const exercises = session.exercises.map(e => {
    const isSpec = muscleMatchesSpecialization((e as any).muscle, cfg.specialization);
    const baseSets = Math.max(2, Math.round((e.sets || 3) * 0.8)) + (isSpec ? 2 : 0); // ⭐ спец-добивка в пик-неделе
    const finalSets = Math.min(5, baseSets);
    const template: any = (e.workSets || [])[0] || { reps: 15, rir: 2, weight: 0 };
    return {
      ...e,
      sets: finalSets,
      repsRange: [15, 20] as [number, number],
      rir: 2,
      tempoSpec: '2-1-1-0',
      restSeconds: 60,
      warmupSets: [],
      workSets: Array.from({ length: finalSets }, (_, i) => ({
        ...(e.workSets?.[i % Math.max(1, (e.workSets || []).length)] ?? template),
        reps: 15,
        rir: 2,
        weight: Math.round((e.workSets?.[i % Math.max(1, (e.workSets || []).length)]?.weight ?? template.weight ?? 0) * 0.6 * 10) / 10,
        tempo: '2-1-1-0',
        restSeconds: 60,
      })),
      comment: `🎭 Пик-неделя (${training.type.toLowerCase()}): памп 15–20 повт, без отказа, ~60% веса.${isSpec ? ' ⭐ Спец-добивка (целевая мышца).' : ''} [Peak week: ${training.type}]`,
      rationale: `Пик-неделя: деплеция гликогена, памп-режим.${isSpec ? ' Специализация: приоритет целевой мышцы.' : ''} ${training.details[0] ?? ''}`,
    };
  });
  return { ...session, exercises, peakWeekTraining: true };
}

/**
 * Наложить тренировочный тапер (кривая Библиотеки) на недели плана, предшествующие
 * неделе шоу, и превратить неделю шоу в пик-неделю. НЕ мутирует исходный план.
 * Идемпотентен per-week: недели, уже обработанные тапером/пик-неделей, пропускаются,
 * поэтому можно накладывать тапер на НЕСКОЛЬКО недель шоу (несколько соревнований).
 * `opts.weekNumber` — 1-индекс недели шоу (по умолчанию последняя; клампится к краям).
 */
export function applyTrainingTaperToBBPlan(
  plan: BBPlan,
  rawCfg: BBContestPrepConfig,
  opts?: { weekNumber?: number; force?: boolean },
): BBPlanWithPrep {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return plan as BBPlanWithPrep;
  const v = validateBBContestPrepConfig(rawCfg);
  if (!v.ok) return plan as BBPlanWithPrep;
  const base = applyForcedModes(rawCfg);
  const cfg: BBContestPrepConfig = { ...base, showDate: resolveShowDate(base) };
  const existing = (plan as BBPlanWithPrep).contestPrep;
  const force = opts?.force === true;

  const taper = buildTrainingTaper(cfg);
  const n = taper.length;
  const weeks = plan.weeks.map(w => ({ ...w, sessions: w.sessions.map(s => ({ ...s, exercises: s.exercises.map(e => ({ ...e, workSets: (e.workSets || []).map(ws => ({ ...ws })) })) })) })) as any[];
  const total = weeks.length;
  const endIdx = clamp((opts?.weekNumber ?? total) - 1, 0, total - 1);
  const startIdx = Math.max(0, endIdx - n + 1);
  const windowLen = endIdx - startIdx + 1;
  const usedTaper = taper.slice(n - windowLen);
  const appliedWeeks: number[] = [];

  const weekAlreadyPrepped = (wk: any): boolean =>
    wk.peakWeek === true || (typeof wk.prepProtocol === 'string' && wk.prepProtocol.length > 0 && !wk.prepProtocol.startsWith('Пропущена'));

  // 🦵 Ноги (и крупные мышцы с длительной крепатурой) разгружаются РАНЬШЕ:
  // в первую неделю тапера их объём режется дополнительно.
  const LEG_MUSCLES = ['quads', 'hamstrings', 'glutes', 'calves'];

  for (let i = 0; i < windowLen; i++) {
    const idx = startIdx + i;
    const wk = weeks[idx];
    const t = usedTaper[i];
    if (!t) break;
    // Без force: идемпотентно пропускаем уже наложенные недели (другое соревнование).
    // С force: ОБНОВЛЯЕМ наложенный ранее taper (пользователь изменил настройки).
    if (weekAlreadyPrepped(wk) && !force) continue;

    // Guard: не резать уже разгруженные недели (anti-двойное снижение, как PL-taper).
    // Исключение: недели с меткой taper (без prepProtocol) — это следы АВТО-taper
    // финализатора (applyTaperToFinalWeeks), а не настоящий deload: наш канонический
    // taper накладывается ПОВЕРХ существующего (пользователь просил «обновлять план»),
    // иначе prep-кривая искажается (недели <60% объёма молча пропускались).
    const autoTaperMarked = wk.taper === true && !wk.prepProtocol && !wk.peakWeek;
    const isDeload = !autoTaperMarked && (wk.deload === true || wk.phase === 'deload'
      || (idx > 0 && weekVolume(wk) < weekVolume(weeks[idx - 1]) * 0.6));
    if (isDeload) {
      wk.phase = wk.phase ?? 'deload';
      wk.taper = true;
      wk.prepProtocol = `Пропущена (разгрузка) — ${t.label}`;
      continue;
    }

    const rirClamp = (r: number): number => clamp(r, t.rirMin, t.rirMax);
    const firstTaperWeek = i === 0;

    for (const s of wk.sessions) {
      s.exercises = s.exercises.map((e: any) => {
        const isSpec = muscleMatchesSpecialization(e.muscle, cfg.specialization);
        const muscleKey = String(e.muscle || '').toLowerCase();
        const isLeg = LEG_MUSCLES.some(m => muscleKey.includes(m) || m.includes(muscleKey));
        // ⭐ Специализация: целевая мышца щадится — объём режется мягче (×1.25 к множителю).
        // 🦵 Ноги: в первую неделю тапера — дополнительно ×0.9 (последняя тяжёлая ног уже позади).
        const effMult = Math.max(
          0.4,
          (isSpec ? Math.min(1, t.volumePct * 1.25) : t.volumePct) * (firstTaperWeek && isLeg ? 0.9 : 1),
        );
        const newSets = Math.max(2, Math.round((e.sets || 0) * effMult));
        const source = e.workSets || [];
        const template = source[source.length - 1] || { reps: (e.repsRange?.[0] ?? 10), rir: e.rir, weight: 0 };
        const workSets = Array.from({ length: newSets }, (_, si) => ({
          ...(source[si] || template),
          weight: Math.round((source[si]?.weight ?? template.weight) * t.intensityPct * 10) / 10,
          rir: rirClamp(source[si]?.rir ?? template.rir),
        }));
        return {
          ...e,
          sets: newSets,
          rir: rirClamp(e.rir),
          workSets,
          comment: `${e.comment || ''} 📉 Тапер: ${t.label} (объём ${Math.round(effMult * 100)}%, вес ${Math.round(t.intensityPct * 100)}%).${isSpec ? ' ⭐ Спец: объём щадится.' : ''}${firstTaperWeek && isLeg ? ' 🦵 Ноги: разгружаются раньше.' : ''}`,
        };
      });
    }
    wk.phase = 'peaking';
    wk.taper = true;
    wk.prepProtocol = `${getPeakingProtocol(cfg.trainingProtocol).name} — ${t.label}`;
    appliedWeeks.push(idx + 1);
  }

  // Неделя шоу → пик-неделя (памп/деплеция, отдых).
  if (windowLen > 0) {
    const wk = weeks[endIdx];
    // Guard только против ПРОШЛЫХ применений (peakWeek) при !force; с force —
    // пересобираем пик-неделю по актуальным настройкам (обновление плана).
    if (wk.peakWeek !== true || force) {
      const peakWeek = buildPeakWeek(cfg);
      wk.phase = 'peaking';
      wk.taper = true;
      wk.peakWeek = true;
      wk.sessions = wk.sessions.map((s: any, si: number) => toPeakWeekSession(s, si, cfg, peakWeek));
      wk.prepProtocol = `Пик-неделя: ${PHASES_BY_STRATEGY[cfg.carbLoadStrategy].map(p => PHASE_LABELS_RU[p]).join(' → ')}`;
      if (!appliedWeeks.includes(endIdx + 1)) appliedWeeks.push(endIdx + 1);
    }
  }

  const applied = appliedWeeks.length > 0;
  const result = {
    ...plan,
    weeks,
    rationale: applied
      ? [
          ...(plan.rationale || []),
          `🏁 Тапер ББ наложен (нед ${appliedWeeks.join(', ')}): «${getPeakingProtocol(cfg.trainingProtocol).name}» (${cfg.weeksOut} нед) + пик-неделя (шоу ${cfg.showDate}).`,
          `🍚 Питание пик-недели: ${cfg.carbLoadStrategy} загрузка, вода ${cfg.waterStrategy}, натрий ${cfg.sodiumStrategy} — см. блок «Питание → Тапер ББ».`,
        ]
      : plan.rationale,
  };
  (result as BBPlanWithPrep).contestPrep = {
    showDate: existing?.showDate ?? cfg.showDate,
    protocol: cfg.trainingProtocol,
    weeksOut: cfg.weeksOut,
    appliedAt: new Date().toISOString(),
    appliedWeeks: [...(existing?.appliedWeeks ?? []), ...appliedWeeks],
  };
  return result as BBPlanWithPrep;
}

/**
 * Оверлей только пик-недели (без недельного тапера) — на конкретную неделю плана
 * (по умолчанию финальная; `opts.weekNumber` — 1-индекс, клампится к краям).
 * Идемпотентен per-week — можно накладывать на несколько недель шоу.
 */
export function applyPeakWeekOverlayToBBPlan(
  plan: BBPlan,
  rawCfg: BBContestPrepConfig,
  opts?: { weekNumber?: number },
): BBPlanWithPrep {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return plan as BBPlanWithPrep;
  const v = validateBBContestPrepConfig(rawCfg);
  if (!v.ok) return plan as BBPlanWithPrep;
  const base = applyForcedModes(rawCfg);
  const cfg: BBContestPrepConfig = { ...base, showDate: resolveShowDate(base) };
  const existing = (plan as BBPlanWithPrep).contestPrep;

  const weeks = plan.weeks.map(w => ({ ...w, sessions: w.sessions.map(s => ({ ...s, exercises: s.exercises.map(e => ({ ...e, workSets: (e.workSets || []).map(ws => ({ ...ws })) })) })) })) as any[];
  const targetIdx = clamp((opts?.weekNumber ?? weeks.length) - 1, 0, weeks.length - 1);
  const target = weeks[targetIdx];
  let applied = false;
  if (target.peakWeek !== true) {
    const peakWeek = buildPeakWeek(cfg);
    target.phase = 'peaking';
    target.deload = false;
    target.taper = true;
    target.peakWeek = true;
    target.sessions = target.sessions.map((s: any, si: number) => toPeakWeekSession(s, si, cfg, peakWeek));
    target.prepProtocol = `Пик-неделя: ${PHASES_BY_STRATEGY[cfg.carbLoadStrategy].map(p => PHASE_LABELS_RU[p]).join(' → ')}`;
    applied = true;
  }

  const result = {
    ...plan,
    weeks,
    rationale: applied
      ? [
          ...(plan.rationale || []),
          `🎭 Пик-неделя наложена на неделю ${targetIdx + 1} (шоу ${cfg.showDate}): деплеция → загрузка → отдых → памп.`,
        ]
      : plan.rationale,
  };
  (result as BBPlanWithPrep).contestPrep = {
    showDate: existing?.showDate ?? cfg.showDate,
    protocol: cfg.trainingProtocol,
    weeksOut: cfg.weeksOut,
    appliedAt: new Date().toISOString(),
    appliedWeeks: [...(existing?.appliedWeeks ?? []), ...(applied ? [targetIdx + 1] : [])],
  };
  return result as BBPlanWithPrep;
}

// ═══════════════════════════════════════════════════════════════════════════
// Применение фаз contest prep к BB-плану (Этап 3: разметка недель, привязка к дате)
// ═══════════════════════════════════════════════════════════════════════════

/** Фаза недели в контексте contest prep (пишется в wk.contestPhase). */
export type BBWeekPrepPhase = 'preparation' | 'final_preparation' | 'taper' | 'peak_week';

export interface ContestPrepApplyOpts {
  prepWeeks?: number;      // недели подготовки (включая финальную), дефолт 12
  taperWeeks?: number;     // недели тапера (1-4), дефолт cfg.weeksOut
  weekNumber?: number;     // неделя шоу (1-index), дефолт последняя
  force?: boolean;         // перезаписать уже наложенный taper/пик актуальными настройками
}

/**
 * Единое применение contest prep к BB-плану — СТРОИТ тренировочный цикл:
 * 1) если план короче prepWeeks + taperWeeks + пик — ДОСТРАИВАЕТ недостающие
 *    недели подготовки в начало плана (пик привязан к концу/дате шоу);
 * 2) taper (applyTrainingTaperToBBPlan) на последние taperWeeks + пик-неделя;
 * 3) финальная подготовка (последние 2 нед подготовки): объём ×0.9, RIR 2–3,
 *    интенсивность сохраняется, спец-мышца щадится, deload не трогается;
 * 4) разметка недель фазами (wk.contestPhase: preparation/final_preparation/taper/peak_week);
 * 5) метаданные phases (BBContestPrepPlan.phases) для календаря.
 * НЕ мутирует входной план. Идемпотентен per-week и по длине.
 */
export function applyContestPrepToBBPlan(
  plan: BBPlan,
  rawCfg: BBContestPrepConfig,
  opts: ContestPrepApplyOpts = {},
): BBPlanWithPrep {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return plan as BBPlanWithPrep;
  const v = validateBBContestPrepConfig(rawCfg);
  if (!v.ok) return plan as BBPlanWithPrep;
  const base = applyForcedModes(rawCfg);
  const cfg: BBContestPrepConfig = { ...base, showDate: resolveShowDate(base) };
  const taperWeeks = Math.min(4, Math.max(1, Math.round(opts.taperWeeks ?? cfg.weeksOut)));
  const prepWeeks = Math.max(1, Math.round(opts.prepWeeks ?? 12));

  // 1) Достройка тренировочного цикла до полной длины фаз.
  const needed = prepWeeks + taperWeeks + 1;
  let basePlan: BBPlanWithPrep = plan as BBPlanWithPrep;
  const addedWeeks = Math.max(0, needed - basePlan.weeks.length);
  if (addedWeeks > 0) {
    basePlan = prependPreparationWeeks(basePlan, addedWeeks);
  }

  // 2) Taper + пик-неделя на последние taperWeeks+1 недель.
  //    force=true: повторное наложение ОБНОВЛЯЕТ уже размеченные недели (изменения настроек).
  const tapered = applyTrainingTaperToBBPlan(basePlan, { ...cfg, weeksOut: Math.min(4, taperWeeks + 1) }, { weekNumber: opts.weekNumber, force: opts.force === true }) as BBPlanWithPrep;
  const weeks = tapered.weeks as any[];
  const total = weeks.length;
  const endIdx = clamp((opts.weekNumber ?? total) - 1, 0, total - 1);
  // 0-index: taper занимает недели [endIdx - taperWeeks, endIdx - 1], пик = endIdx.
  const taperStart0 = Math.max(0, endIdx - taperWeeks);
  const prepEnd0 = taperStart0 - 1;
  const finalStart0 = Math.max(0, prepEnd0 - 1);

  const byIdx = new Map<number, BBWeekPrepPhase>();
  for (let i = 0; i < total; i++) {
    let phase: BBWeekPrepPhase;
    if (i === endIdx) phase = 'peak_week';
    else if (i >= taperStart0) phase = 'taper';
    else if (prepEnd0 >= 0 && i >= finalStart0) phase = 'final_preparation';
    else phase = 'preparation';
    byIdx.set(i, phase);
  }

  for (let i = 0; i < total; i++) {
    weeks[i] = { ...weeks[i], contestPhase: byIdx.get(i) ?? 'preparation' };
  }

  // 3) Финальная подготовка: объём ×0.9, RIR 2–3, интенсивность сохраняется,
  //    спец-мышца щадится (×1.25 к множителю, ≤1.0), deload не трогаем.
  const FINAL_PREP_VOLUME = 0.9;
  for (let i = finalStart0; i <= prepEnd0; i++) {
    const wk = weeks[i];
    if (!wk) continue;
    if (wk.deload === true || wk.phase === 'deload') continue; // anti-двойной deload
    for (const s of wk.sessions) {
      s.exercises = s.exercises.map((e: any) => {
        const isSpec = muscleMatchesSpecialization(e.muscle, cfg.specialization);
        const mult = Math.max(0.4, isSpec ? Math.min(1, FINAL_PREP_VOLUME * 1.25) : FINAL_PREP_VOLUME);
        const newSets = Math.max(2, Math.round((e.sets || 0) * mult));
        const rir = clamp((Number(e.rir) || 2) + 1, 2, 4);
        const source = e.workSets || [];
        const workSets = source.slice(0, newSets).map((ws: any) => ({ ...ws, rir }));
        return { ...e, sets: newSets, rir, workSets, comment: `${e.comment || ''} 📉 Финальная подготовка: объём ×${Math.round(mult * 100)}%, RIR 2–3, вес сохраняется.${isSpec ? ' ⭐ Спец: щадится.' : ''}` };
      });
    }
    wk.phase = wk.phase || 'accumulation';
    wk.prepProtocol = 'Финальная подготовка: объём ×0.9, RIR 2–3';
  }

  // Метаданные фаз для календаря (BBContestPrepPlan.phases), сжатые до недель плана.
  const usedPrep = Math.max(1, prepEnd0 + 1); // фактическое число недель подготовки в плане
  const phases = computePrepPhaseRanges(usedPrep, taperWeeks, cfg.showDate, true);

  const warnings: string[] = [];
  const notes: string[] = [];
  if (addedWeeks > 0) {
    notes.push(`📈 Тренировочный цикл расширен с ${basePlan.weeks.length - addedWeeks} до ${total} нед: подготовка ${usedPrep} нед → taper ${taperWeeks} нед → пик-неделя.`);
  } else if (total > needed) {
    notes.push(`📈 План длиннее минимума подготовки (${total} нед): первые ${total - needed} нед — подготовка, дальше по фазам.`);
  }
  if (usedPrep < prepWeeks) {
    warnings.push(`⚠ План (${total} нед) короче полной подготовки ${prepWeeks}+${taperWeeks}+пик: подготовка усечена до ${usedPrep} нед. Увеличьте длительность плана для полной подготовки.`);
  }

  const result = {
    ...tapered,
    weeks,
    rationale: [
      ...(tapered.rationale || []),
      `🗓 Contest prep: подготовка ${usedPrep} нед (объём 100%) → финальная ×0.9/RIR 2–3 → taper ${taperWeeks} нед (объём 85%→60%, интенсивность сохраняется, RIR 2–4) → пик-неделя (шоу ${cfg.showDate}).`,
      ...notes,
    ],
  } as BBPlanWithPrep;
  (result as any).contestPrep = {
    ...(result.contestPrep ?? {}),
    phases,
    warnings,
    showDate: cfg.showDate,
  };
  return result as BBPlanWithPrep;
}

/** Достроить план В НАЧАЛО недостающими неделями подготовки (клон недели 1). */
function prependPreparationWeeks(plan: BBPlanWithPrep, addWeeks: number): BBPlanWithPrep {
  const add = Math.max(1, Math.round(addWeeks));
  const weeks = plan.weeks as any[];
  const template = weeks[0];
  if (!template || add <= 0) return plan;
  const clone = (w: any) => ({
    ...w,
    week: w.week,
    deload: false,
    phase: 'accumulation',
    taper: false,
    peakWeek: false,
    prepProtocol: undefined,
    contestPhase: 'preparation' as BBWeekPrepPhase,
    sessions: w.sessions.map((s: any) => ({
      ...s,
      exercises: s.exercises.map((e: any) => ({ ...e, workSets: (e.workSets || []).map((ws: any) => ({ ...ws })) })),
    })),
  });
  const inserted: any[] = [];
  for (let k = 0; k < add; k++) inserted.push(clone(template));
  const newWeeks = [...inserted, ...weeks];
  newWeeks.forEach((w, i) => { w.week = i + 1; });
  return { ...plan, weeks: newWeeks } as BBPlanWithPrep;
}

/**
 * Расширить ТОЛЬКО подготовительный блок плана (пик и тапер не трогаются):
 * дублирует последнюю неделю подготовки перед началом тапера.
 * Завершённые недели (contestPhase недели с прошлой датой) не копируются.
 */
export function extendBBPlanPreparation(plan: BBPlanWithPrep, addWeeks: number): BBPlanWithPrep {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return plan;
  const add = Math.max(1, Math.round(addWeeks));
  const weeks = plan.weeks as any[];
  const total = weeks.length;
  const endIdx = total - 1;
  const meta = (plan as any).contestPrep as { phases?: PrepPhaseRange[] } | undefined;
  const taperPhases = (meta?.phases ?? []).filter(p => p.key === 'taper' || p.key === 'peak_week');
  const taperWeeks = taperPhases.length > 0
    ? Math.max(1, taperPhases.filter(p => p.key === 'taper').reduce((s, p) => s + (p.weekEnd - p.weekStart + 1), 0) || 1)
    : Math.max(1, Math.min(4, (plan as any).contestPrep?.weeksOut ?? 3));
  const taperStart = Math.max(1, endIdx - taperWeeks);
  const prepIdx = taperStart - 1;
  const template = weeks[prepIdx] ?? weeks[Math.max(0, taperStart - 2)] ?? weeks[0];
  if (!template) return plan;
  const clone = (w: any) => ({
    ...w,
    week: w.week,
    sessions: w.sessions.map((s: any) => ({
      ...s,
      exercises: s.exercises.map((e: any) => ({ ...e, workSets: (e.workSets || []).map((ws: any) => ({ ...ws })) })),
    })),
  });
  const inserted: any[] = [];
  for (let k = 0; k < add; k++) {
    const c = clone(template);
    c.contestPhase = 'preparation';
    c.taper = false;
    c.peakWeek = false;
    c.prepProtocol = undefined;
    inserted.push(c);
  }
  const newWeeks = [...weeks.slice(0, prepIdx), ...inserted, ...weeks.slice(prepIdx)];
  // Перенумеровать week 1-index.
  newWeeks.forEach((w, i) => { w.week = i + 1; });
  const result = { ...plan, weeks: newWeeks } as BBPlanWithPrep;
  (result as any).contestPrep = meta ?? (plan as any).contestPrep;
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Сериализация и legacy
// ═══════════════════════════════════════════════════════════════════════════

export function serializeBBPrepConfig(cfg: BBContestPrepConfig): string {
  return JSON.stringify(cfg);
}

/** Безопасное чтение: валидация формы + отсев мусора (как loadDesigns). */
export function deserializeBBPrepConfig(str: string | null | undefined): BBContestPrepConfig | null {
  if (!str) return null;
  let raw: unknown;
  try { raw = JSON.parse(str); } catch { return null; }
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const cfg: BBContestPrepConfig = {
    sex: c.sex === 'female' ? 'female' : 'male',
    category: (c.category as BBContestCategory) || 'mens_physique',
    weightKg: Number(c.weightKg),
    bodyFatPct: c.bodyFatPct == null ? undefined : Number(c.bodyFatPct),
    experienceLevel: (c.experienceLevel as ExperienceLevel) || 'intermediate',
    enhanced: !!c.enhanced,
    prepCount: Number.isFinite(Number(c.prepCount)) ? Math.max(0, Math.round(Number(c.prepCount))) : 0,
    showDate: String(c.showDate || ''),
    weeksOut: Number.isInteger(Number(c.weeksOut)) ? clamp(Number(c.weeksOut), 1, 4) : 3,
    trainingProtocol: (['bb', 'classic', 'pl'] as const).includes(c.trainingProtocol as PeakingProtocol) ? (c.trainingProtocol as PeakingProtocol) : 'bb',
    carbLoadStrategy: (['front', 'moderate', 'back'] as const).includes(c.carbLoadStrategy as CarbLoadStrategy) ? (c.carbLoadStrategy as CarbLoadStrategy) : 'moderate',
    waterStrategy: (['classic', 'moderate', 'minimal'] as const).includes(c.waterStrategy as WaterStrategy) ? (c.waterStrategy as WaterStrategy) : 'minimal',
    sodiumStrategy: (['constant', 'cut_2d', 'cut_3d'] as const).includes(c.sodiumStrategy as SodiumStrategy) ? (c.sodiumStrategy as SodiumStrategy) : 'constant',
    contraindications: Array.isArray(c.contraindications) ? c.contraindications.filter((x): x is string => typeof x === 'string') : undefined,
    allergens: Array.isArray(c.allergens) ? c.allergens.filter((x): x is string => typeof x === 'string') : undefined,
    preferLowFiberCarbs: !!c.preferLowFiberCarbs,
    creatineStrategy: c.creatineStrategy === 'stop' ? 'stop' : c.creatineStrategy === 'continue' ? 'continue' : undefined,
    confirmedManipulation: c.confirmedManipulation === true ? true : undefined,
    competitions: Array.isArray(c.competitions)
      ? c.competitions
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
          .map(x => ({
            id: String(x.id ?? ''),
            name: String(x.name ?? ''),
            date: x.date != null ? String(x.date) : undefined,
            priority: x.priority === 'A' || x.priority === 'B' || x.priority === 'C' ? x.priority : undefined,
          }))
      : undefined,
    mainCompetitionId: c.mainCompetitionId != null ? String(c.mainCompetitionId) : undefined,
    specialization: (c.specialization != null && (c.specialization as string) in CONTEST_SPECIALIZATION_LABELS)
      ? (c.specialization as ContestSpecialization)
      : undefined,
    schedule: (c.schedule && typeof c.schedule === 'object' && (c.schedule as any).stage)
      ? { wake: String((c.schedule as any).wake || '07:00'), stage: String((c.schedule as any).stage || '12:00') }
      : undefined,
  };
  const v = validateBBContestPrepConfig(cfg);
  if (!v.ok) return null;
  return cfg;
}

const LEGACY_CATEGORY_MAP: Record<string, BBContestCategory> = {
  mens_physique: 'mens_physique',
  classic_physique: 'classic_physique',
  classic: 'classic_physique',
  mens_bb: 'mens_bb',
  open: 'mens_bb',
  bb_212: 'bb_212',
  bikini: 'bikini',
  figure: 'figure',
  wellness: 'wellness',
  womens_physique: 'womens_physique',
  womens_bb: 'womens_bb',
};

/**
 * Нормализовать категорию из произвольного источника (профиль bbCategory,
 * legacy id «classic»/«open» и т.п.) в канонический id движка с проверкой пола.
 */
export function normalizeContestCategory(raw: string | null | undefined, sex: 'male' | 'female'): BBContestCategory {
  const key = String(raw || '').trim().toLowerCase();
  const mapped = LEGACY_CATEGORY_MAP[key];
  if (mapped && CATEGORY_PROFILES[mapped].sex === sex) return mapped;
  return sex === 'female' ? 'bikini' : 'mens_physique';
}

/**
 * Back-compat: старые поля профиля (goals.peakWeek + goals.peakShowDay ISO +
 * goals.bbCategory) → консервативный дефолтный конфиг.
 * Возвращает null, если пик-неделя не была включена или дата шоу в прошлом.
 */
export function legacyConfigFromProfile(
  goals: { peakWeek?: boolean; peakShowDay?: string; bbCategory?: string } | null | undefined,
  personal: { weight?: number; sex?: string } | null | undefined,
): BBContestPrepConfig | null {
  if (!goals || goals.peakWeek !== true || !goals.peakShowDay) return null;
  if (!isValidIsoDate(goals.peakShowDay)) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (daysBetween(today, goals.peakShowDay) < -1) return null; // шоу уже прошло

  const sex: 'male' | 'female' = personal?.sex === 'female' ? 'female' : 'male';
  const mapped = LEGACY_CATEGORY_MAP[String(goals.bbCategory || '')];
  const category: BBContestCategory = mapped
    ? mapped
    : (sex === 'female' ? 'bikini' : 'mens_physique');

  return {
    sex,
    category,
    weightKg: clamp(Number(personal?.weight) || 80, 40, 200),
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 0,
    showDate: goals.peakShowDay,
    weeksOut: 3,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'minimal',
    sodiumStrategy: 'constant',
  };
}

// ── Ключ хранения в профиле ──
export const BB_PREP_CONFIG_KEY = 'bbPeakConfig';

// ═══════════════════════════════════════════════════════════════════════════
// BBContestPrepPlan — единая версионированная модель contest prep
// (Этап 2: preparation / taper / peakWeek / showDay разделены, safety, версии)
// ═══════════════════════════════════════════════════════════════════════════

export type PrepPhaseKey =
  | 'preparation' | 'final_preparation' | 'taper' | 'peak_week' | 'show_day' | 'post_show';

export type PrepPlanStatus = 'draft' | 'active' | 'completed' | 'cancelled';

/** Вода: стабильная (безопасно, по умолчанию) / умеренная модуляция. classic запрещён по умолчанию. */
export type PrepWaterMode = 'stable' | 'moderate';
/** Натрий: стабильный (по умолчанию) / умеренная модуляция. cut_* запрещён по умолчанию. */
export type PrepSodiumMode = 'stable' | 'moderate';
/** Карб-загрузка: консервативная / умеренная / высокая. */
export type PrepCarbMode = 'conservative' | 'moderate' | 'high';
/** Стратегия пик-недели: только тестированная / консервативная / умеренная / высокая. */
export type PrepPeakStrategy = 'tested' | 'conservative' | 'moderate' | 'high';

/** Диапазон недель фазы (1-index, включительно) с датами. */
export interface PrepPhaseRange {
  key: PrepPhaseKey;
  label: string;
  weekStart: number;
  weekEnd: number;
  dateStart: string;   // ISO yyyy-mm-dd
  dateEnd: string;     // ISO (последний день фазы)
  note: string;
  color: string;
}

export interface BBContestPrepPlan {
  id: string;
  version: number;            // версия СХЕМЫ (миграции)
  algorithmVersion: number;   // версия алгоритма (пересчёт результатов)
  status: PrepPlanStatus;
  createdAt: string;          // ISO datetime
  updatedAt: string;          // ISO datetime
  source: 'bb_auto' | 'planner' | 'macrocycle' | 'legacy';

  showDate: string;
  category: BBContestCategory;
  sex: 'male' | 'female';

  preparation: {
    startDate: string;
    weeks: number;                    // включая «финальную подготовку»
    finalWeeks: number;               // последние N недель подготовки = финальная (обычно 2)
    targetRatePctPerWeek: number;     // 0.25..0.75 % массы тела в неделю
    startingWeightKg: number;
    currentCalories: number;
    stepsPerDay: number;
    cardioMinutesPerWeek: number;
  };

  taper: {
    enabled: boolean;
    weeks: number;                    // 1..4
    volumeProfile: number[];          // множители объёма (от ранней недели к поздней)
    intensityProfile: number[];       // множители веса (интенсивность сохраняется)
    rirProfile: Array<[number, number]>;
  };

  peakWeek: {
    enabled: boolean;
    strategy: PrepPeakStrategy;
    waterMode: PrepWaterMode;
    sodiumMode: PrepSodiumMode;
    carbMode: PrepCarbMode;
  };

  phases: PrepPhaseRange[];

  trainingPlanId?: string;
  nutritionPlanId?: string;
  testPeakWeekId?: string;

  safety: {
    contraindications: string[];
    warnings: string[];
    requiresReview: boolean;   // requiresProfessionalReview
    blockedProtocol: boolean;  // автоматический peak-протокол ограничен/отключён
  };

  /** Число завершённых недель от старта — не пересчитываются без подтверждения. */
  frozenWeeks?: number;
}

export const PREP_PLAN_VERSION = 1;
export const PREP_ALGORITHM_VERSION = 1;
/** Ключ хранения единого плана в профиле (goals.bbContestPrepPlan). */
export const BB_PREP_PLAN_KEY = 'bbContestPrepPlan';

export const PREP_PHASE_LABELS: Record<PrepPhaseKey, string> = {
  preparation: 'Подготовка',
  final_preparation: 'Финальная подготовка',
  taper: 'Taper',
  peak_week: 'Peak week',
  show_day: 'Show day',
  post_show: 'Post-show',
};

export const PREP_PHASE_COLORS: Record<PrepPhaseKey, string> = {
  preparation: '#3b82f6',
  final_preparation: '#8b5cf6',
  taper: '#f59e0b',
  peak_week: '#ec4899',
  show_day: '#fbbf24',
  post_show: '#22c55e',
};

/** Расширенный список противопоказаний, при которых нужен requiresReview. */
const PROFESSIONAL_REVIEW_CONDITIONS: Array<{ id: string; label: string; re: RegExp }> = [
  { id: 'kidney', label: 'заболевания почек', re: /kidney|kidneys|почк/ },
  { id: 'heart', label: 'сердечно-сосудистые заболевания', re: /heart|серд/ },
  { id: 'hypertension', label: 'гипертония', re: /hypertension|гипертон|давлен|blood.?pressure/ },
  { id: 'diabetes', label: 'диабет', re: /diabet|диабет/ },
  { id: 'pregnancy', label: 'беременность', re: /pregnan|беремен/ },
  { id: 'eating_disorder', label: 'расстройство пищевого поведения', re: /eating.?disorder|пищев(?:ого|ое).?(?:расстройств|поведен)|анорекс|булим|ортодекс/ },
  { id: 'seizures', label: 'обмороки или судороги', re: /seizure|обморок|судорог|syncope|epileps|эпилепс/ },
  { id: 'electrolyte', label: 'нарушения электролитов', re: /electrolyte|электролит|гипонатрием|hyp[o]?natr/ },
];

/** Какие условия требуют профессионального сопровождения (requiresReview). */
export function professionalReviewConditions(contraindications: string[] | undefined): string[] {
  const list = (contraindications || []).map(c => String(c).trim().toLowerCase()).filter(Boolean);
  if (list.length === 0) return [];
  return PROFESSIONAL_REVIEW_CONDITIONS
    .filter(c => list.some(s => c.re.test(s)))
    .map(c => c.label);
}

/** Диапазоны недель всех фаз prep-плана. totalWeeks = prepWeeks + taperWeeks + peak(1). */
export function computePrepPhaseRanges(
  prepWeeks: number,
  taperWeeks: number,
  showDate: string,
  peakEnabled: boolean,
): PrepPhaseRange[] {
  const pw = Math.max(1, Math.min(52, Math.round(prepWeeks)));
  const tw = Math.min(4, Math.max(1, Math.round(taperWeeks)));
  const total = pw + tw + (peakEnabled ? 1 : 0);
  const finalW = pw >= 4 ? 2 : 0;
  const phases: PrepPhaseRange[] = [];

  const push = (key: PrepPhaseKey, wStart: number, wEnd: number, note: string) => {
    if (wEnd < wStart || wStart < 1) return;
    const weeksFromEnd = total - wEnd;
    const dateEnd = isoAddDays(showDate, -7 * weeksFromEnd);
    const len = wEnd - wStart + 1;
    const dateStart = isoAddDays(dateEnd, -(7 * len - 1));
    phases.push({ key, label: PREP_PHASE_LABELS[key], weekStart: wStart, weekEnd: wEnd, dateStart, dateEnd, note, color: PREP_PHASE_COLORS[key] });
  };

  if (finalW > 0) {
    push('preparation', 1, pw - finalW,
      'Сушка и сохранение массы: дефицит 0.25–0.75%/нед, объём стабилен, кардио/шаги по плану.');
    push('final_preparation', pw - finalW + 1, pw,
      'Финал подготовки: дефицит смягчается, объём снижается умеренно, позирование 20–30 мин/день.');
  } else {
    push('preparation', 1, pw, 'Подготовка: дефицит 0.25–0.75%/нед, объём стабилен.');
  }
  push('taper', pw + 1, pw + tw,
    'Taper: объём снижается (объём 80–90% → 60–75%), интенсивность сохраняется, RIR 2–4, без отказа, без новых упражнений.');
  if (peakEnabled) {
    push('peak_week', total, total,
      'Peak week: 7 дней к сцене — деплеция/загрузка по протоколу, лёгкий памп, вода и натрий стабильны (если не подтверждена модуляция).');
    // Show day — сам день шоу (одна дата, внутри недели пика).
    const showRange: PrepPhaseRange = {
      key: 'show_day',
      label: PREP_PHASE_LABELS.show_day,
      weekStart: total,
      weekEnd: total,
      dateStart: showDate,
      dateEnd: showDate,
      note: 'Show day: выход на сцену, памп-рутина backstage, карбс малыми порциями.',
      color: PREP_PHASE_COLORS.show_day,
    };
    phases.push(showRange);
  }
  push('post_show', total + 1, total + 1,
    'Post-show: восстановление — питание на поддерживающем уровне, лёгкие тренировки, контроль веса.');

  return phases;
}

/** Оценка текущих калорий подготовки: поддерживающие − дефицит на цель. */
export function estimatePrepCalories(weightKg: number, targetRatePctPerWeek: number, referenceKcal?: number): number {
  const maintenance = referenceKcal && referenceKcal > 1200 ? referenceKcal : Math.round(weightKg * 31);
  const rate = clamp(Number(targetRatePctPerWeek) || 0.5, 0.1, 1.5);
  const deficit = Math.round((rate / 100) * weightKg * 7700 / 7);
  return Math.max(1200, maintenance - deficit);
}

/** Минимально безопасные жиры (г/кг): 0.6–0.8 — жиры не обнуляются в последние дни. */
export function prepFatFloorGPerKg(sex: 'male' | 'female'): number {
  return sex === 'female' ? 0.8 : 0.6;
}

/** Собрать единый версионированный план contest prep из конфига. */
export interface BuildPrepPlanOpts {
  id?: string;
  source?: BBContestPrepPlan['source'];
  status?: BBContestPrepPlan['status'];
  prepWeeks?: number;
  taperWeeks?: number;
  currentCalories?: number;
  stepsPerDay?: number;
  cardioMinutesPerWeek?: number;
  targetRatePctPerWeek?: number;
  trainingPlanId?: string;
  nutritionPlanId?: string;
  testPeakWeekId?: string;
}

export function buildBBContestPrepPlan(rawCfg: BBContestPrepConfig, opts: BuildPrepPlanOpts = {}): BBContestPrepPlan {
  const v = validateBBContestPrepConfig(rawCfg);
  if (!v.ok) throw new Error(`Некорректный конфиг contest prep: ${v.errors.join(' ')}`);
  const base = applyForcedModes(rawCfg);
  const showDate = resolveShowDate(base);
  const cfg: BBContestPrepConfig = { ...base, showDate };

  const prepWeeks = clamp(Number(opts.prepWeeks) || 12, 1, 52);
  const taperWeeks = clamp(Number(opts.taperWeeks) || cfg.weeksOut, 1, 4);
  const taperCurve = buildTrainingTaper({ ...cfg, weeksOut: taperWeeks });
  const phases = computePrepPhaseRanges(prepWeeks, taperWeeks, showDate, true);

  const conditionLabels = professionalReviewConditions(cfg.contraindications);
  const requiresReview = conditionLabels.length > 0;
  const confirmed = cfg.confirmedManipulation === true;
  // Агрессивные моды (не stable-вода/натрий) при противопоказаниях → протокол блокируется;
  // без явного подтверждения (confirmedManipulation) классика/срезание недоступны — стабильные.
  const manipulationRequested = cfg.waterStrategy !== 'minimal' || cfg.sodiumStrategy !== 'constant';
  const blockedProtocol = requiresReview && manipulationRequested;
  const allowedManipulation = confirmed && !blockedProtocol;

  const warnings = [...v.warnings];
  if (blockedProtocol) {
    warnings.push('⛔ Автоматический пик-протокол ограничен: при противопоказаниях требуются стабильные вода и натрий и сопровождение врача/тренера.');
  }
  if (manipulationRequested && !confirmed) {
    warnings.push('⚠ Агрессивные режимы (water load/cut, срезание натрия) требуют явного подтверждения: используются стабильные вода и натрий.');
  }
  if (cfg.waterStrategy === 'classic' && confirmed) {
    warnings.push('⚠ Классический water load/cut подтверждён: контроль электролитов обязателен, диуретики — только по назначению врача.');
  }

  const now = new Date().toISOString();
  const startDate = phases[0]?.dateStart ?? isoAddDays(showDate, -(7 * (prepWeeks + taperWeeks)));
  const targetRate = clamp(Number(opts.targetRatePctPerWeek) || 0.5, 0.25, 0.75);

  const plan: BBContestPrepPlan = {
    id: opts.id ?? `bbprep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    version: PREP_PLAN_VERSION,
    algorithmVersion: PREP_ALGORITHM_VERSION,
    status: opts.status ?? 'active',
    createdAt: now,
    updatedAt: now,
    source: opts.source ?? 'bb_auto',
    showDate,
    category: cfg.category,
    sex: cfg.sex,
    preparation: {
      startDate,
      weeks: prepWeeks,
      finalWeeks: prepWeeks >= 4 ? 2 : 0,
      targetRatePctPerWeek: targetRate,
      startingWeightKg: cfg.weightKg,
      currentCalories: opts.currentCalories ?? estimatePrepCalories(cfg.weightKg, targetRate),
      stepsPerDay: opts.stepsPerDay ?? 8000,
      cardioMinutesPerWeek: opts.cardioMinutesPerWeek ?? 0,
    },
    taper: {
      enabled: taperWeeks > 0,
      weeks: taperWeeks,
      volumeProfile: taperCurve.map(t => t.volumePct),
      intensityProfile: taperCurve.map(t => t.intensityPct),
      rirProfile: taperCurve.map(t => [t.rirMin, t.rirMax]),
    },
    peakWeek: {
      enabled: true,
      strategy: cfg.experienceLevel === 'beginner' || cfg.prepCount === 0
        ? 'conservative'
        : cfg.carbLoadStrategy === 'front' ? 'moderate' : 'conservative',
      waterMode: allowedManipulation && (cfg.waterStrategy === 'classic' || cfg.waterStrategy === 'moderate') ? 'moderate' : 'stable',
      sodiumMode: allowedManipulation && cfg.sodiumStrategy !== 'constant' ? 'moderate' : 'stable',
      carbMode: cfg.carbLoadStrategy === 'front' ? 'high' : cfg.carbLoadStrategy === 'back' ? 'conservative' : 'moderate',
    },
    phases,
    trainingPlanId: opts.trainingPlanId,
    nutritionPlanId: opts.nutritionPlanId,
    testPeakWeekId: opts.testPeakWeekId,
    safety: {
      contraindications: [...(cfg.contraindications || [])],
      warnings,
      requiresReview,
      blockedProtocol,
    },
  };
  return plan;
}

/** Пересчитать фазы плана (после изменения даты/длительности). */
export function replanBBContestPrep(plan: BBContestPrepPlan, showDate: string, prepWeeks?: number, taperWeeks?: number): BBContestPrepPlan {
  const pw = prepWeeks ?? plan.preparation.weeks;
  const tw = taperWeeks ?? plan.taper.weeks;
  const phases = computePrepPhaseRanges(pw, tw, showDate, plan.peakWeek.enabled);
  const startDate = phases[0]?.dateStart ?? plan.preparation.startDate;
  return {
    ...plan,
    showDate,
    phases,
    updatedAt: new Date().toISOString(),
    preparation: { ...plan.preparation, weeks: pw, finalWeeks: pw >= 4 ? 2 : 0, startDate },
    taper: { ...plan.taper, weeks: tw },
  };
}

/**
 * Перенос даты шоу. Завершённые недели (frozenWeeks от старта) не пересчитываются
 * без подтверждения: если новый календарь меняет фазы внутри замороженной зоны,
 * возвращается warning + frozenOverridden=true (пересчёт всё же происходит,
 * UI обязан спросить подтверждение).
 */
export function shiftBBContestPrepShowDate(plan: BBContestPrepPlan, newShowDate: string): { plan: BBContestPrepPlan; changedFrozen: boolean; warnings: string[] } {
  if (!isValidIsoDate(newShowDate)) return { plan, changedFrozen: false, warnings: ['Некорректная дата шоу.'] };
  if (daysBetween(isoToday(), newShowDate) < 0) return { plan, changedFrozen: false, warnings: ['Дата шоу в прошлом — план не изменён.'] };
  const prev = plan;
  const next = replanBBContestPrep(plan, newShowDate);
  let changedFrozen = false;
  const frozen = prev.frozenWeeks ?? 0;
  if (frozen > 0) {
    // Завершённые недели (weekStart ≤ frozen) не должны менять СВОИ даты при пересчёте.
    for (const p of next.phases) {
      if (p.weekStart > frozen) break;
      const prevPhase = prev.phases.find(q => q.key === p.key);
      if (prevPhase && prevPhase.dateStart !== p.dateStart) { changedFrozen = true; break; }
    }
  }
  const warnings: string[] = [];
  if (changedFrozen) warnings.push(`⚠ Перенос шоу меняет фазы внутри первых ${frozen} завершённых недель — пересчёт требует подтверждения.`);
  return { plan: next, changedFrozen, warnings };
}

/** Добавить/убрать недели ТОЛЬКО в подготовительный блок (пик и тапер не трогаются). */
export function addPrepWeeks(plan: BBContestPrepPlan, delta: number): BBContestPrepPlan {
  const pw = Math.max(1, Math.min(52, plan.preparation.weeks + Math.round(delta)));
  return replanBBContestPrep(plan, plan.showDate, pw, plan.taper.weeks);
}

/** Фаза конкретной недели плана (1-index) или null. */
export function prepPhaseForWeek(plan: BBContestPrepPlan, week1: number): PrepPhaseRange | null {
  return plan.phases.find(p => week1 >= p.weekStart && week1 <= p.weekEnd) ?? null;
}

/** Прошли ли все фазы (шоу позади). */
export function prepPlanCompleted(plan: BBContestPrepPlan): boolean {
  return daysBetween(isoToday(), plan.showDate) > 7;
}

export function serializeBBContestPrepPlan(plan: BBContestPrepPlan): string {
  return JSON.stringify(plan);
}

/** Безопасное чтение: валидация формы + отсев мусора. */
export function deserializeBBContestPrepPlan(str: string | null | undefined): BBContestPrepPlan | null {
  if (!str) return null;
  let raw: unknown;
  try { raw = JSON.parse(str); } catch { return null; }
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== 'string' || !Array.isArray(p.phases) || !p.preparation || typeof p.preparation !== 'object') return null;
  if (p.version == null || !Number.isFinite(Number(p.version))) return null;
  const prep = p.preparation as Record<string, unknown>;
  const tp = p.taper as Record<string, unknown> | undefined;
  const pk = p.peakWeek as Record<string, unknown> | undefined;
  const sf = p.safety as Record<string, unknown> | undefined;
  const cfg: BBContestPrepConfig = {
    sex: p.sex === 'female' ? 'female' : 'male',
    category: (p.category as BBContestCategory) in CATEGORY_PROFILES ? (p.category as BBContestCategory) : 'mens_physique',
    weightKg: Number(prep.startingWeightKg) || 80,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 0,
    showDate: String(p.showDate || ''),
    weeksOut: Number.isInteger(Number(tp?.weeks)) ? clamp(Number(tp?.weeks), 1, 4) : 3,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: pk?.waterMode === 'moderate' ? 'moderate' : 'minimal',
    sodiumStrategy: pk?.sodiumMode === 'moderate' ? 'cut_2d' : 'constant',
    contraindications: Array.isArray(sf?.contraindications) ? sf.contraindications.filter((x): x is string => typeof x === 'string') : undefined,
  };
  const v = validateBBContestPrepConfig(cfg);
  if (!v.ok) return null;
  return p as unknown as BBContestPrepPlan;
}

/**
 * Единая точка чтения сохранённого prep-состояния из профиля:
 * новый план (goals.bbContestPrepPlan) → legacy конфиг (goals.bbPeakConfig) →
 * legacy поля (goals.peakWeek + peakShowDay). Возвращает план или null.
 */
export function planFromStored(
  storedPlan: string | null | undefined,
  storedConfig: string | null | undefined,
  goals?: { peakWeek?: boolean; peakShowDay?: string; bbCategory?: string } | null,
  personal?: { weight?: number; sex?: string } | null,
  opts?: BuildPrepPlanOpts,
): BBContestPrepPlan | null {
  const fromPlan = deserializeBBContestPrepPlan(storedPlan);
  if (fromPlan) return fromPlan;
  const cfg = storedConfig ? deserializeBBPrepConfig(storedConfig) : null;
  if (cfg) return buildBBContestPrepPlan(cfg, opts);
  const legacy = legacyConfigFromProfile(goals, personal);
  if (legacy) return buildBBContestPrepPlan(legacy, opts);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Питание: дневные цели для ЛЮБОЙ даты подготовки + адаптер в MealPlanInput
// (Этап 5: пик-неделя — абсолютные цели; подготовка — дефицит по targetRate,
//  белок 2.2-2.5 г/кг, жиры ≥ floor, вода/натрий стабильны)
// ═══════════════════════════════════════════════════════════════════════════

import type { MealPlanInput } from '../meal-plan-generator.engine';

/** Обратная проекция плана в конфиг (для переиспользования функций пик-недели). */
export function configFromPlan(plan: BBContestPrepPlan): BBContestPrepConfig {
  return {
    sex: plan.sex,
    category: plan.category,
    weightKg: plan.preparation.startingWeightKg,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 0,
    showDate: plan.showDate,
    weeksOut: plan.taper.weeks,
    trainingProtocol: 'bb',
    carbLoadStrategy: plan.peakWeek.carbMode === 'high' ? 'front' : plan.peakWeek.carbMode === 'conservative' ? 'back' : 'moderate',
    waterStrategy: plan.peakWeek.waterMode === 'moderate' ? 'moderate' : 'minimal',
    sodiumStrategy: plan.peakWeek.sodiumMode === 'moderate' ? 'cut_2d' : 'constant',
    contraindications: plan.safety.contraindications,
  };
}

/** Фаза плана по дате (из plan.phases). */
export function prepPhaseForDate(plan: BBContestPrepPlan, dateIso: string): PrepPhaseRange | null {
  if (!isValidIsoDate(dateIso)) return null;
  return plan.phases.find(p => dateIso >= p.dateStart && dateIso <= p.dateEnd) ?? null;
}

/**
 * Единая точка расчёта дневных целей питания на ЛЮБУЮ дату contest prep.
 * - пик-неделя (≤ 7 дней до шоу): абсолютные цели buildPeakWeek;
 * - подготовка/тапер: дефицит по plan.preparation (калории ступенчатые,
 *   белок из профиля категории, жиры ≥ безопасный минимум, вода/натрий стабильны);
 * - вне окна: база без изменений.
 */
export function nutritionTargetsForPrepDate(
  dateIso: string,
  plan: BBContestPrepPlan,
  base: PeakNutritionBase,
): PeakNutritionTargets {
  const day = peakWeekDayForDate(dateIso, configFromPlan(plan));
  if (day) {
    return computePeakWeekNutritionTargets(dateIso, base, configFromPlan(plan));
  }
  const phase = prepPhaseForDate(plan, dateIso);
  if (!phase) {
    return {
      kcal: base.kcal, proteinG: base.proteinG, fatG: base.fatG, carbsG: base.carbsG,
      fiberMaxG: 60, waterMl: base.waterMl, sodiumMg: base.sodiumMg, potassiumMg: 3500,
      phase: null, phaseLabel: '', note: '',
    };
  }
  if (phase.key === 'post_show') {
    // После шоу — восстановление на поддерживающем уровне (не дефицит подготовки).
    const w = plan.preparation.startingWeightKg;
    const post = buildPostShowPlan(plan);
    return {
      kcal: post.kcal,
      proteinG: post.proteinG,
      fatG: Math.max(30, Math.round(w * prepFatFloorGPerKg(plan.sex))),
      carbsG: Math.max(50, Math.round((post.kcal - post.proteinG * 4 - Math.max(30, Math.round(w * prepFatFloorGPerKg(plan.sex))) * 9) / 4)),
      fiberMaxG: 40,
      waterMl: Math.round(post.waterLiters * 1000),
      sodiumMg: base.sodiumMg,
      potassiumMg: 3500,
      phase: null,
      phaseLabel: PREP_PHASE_LABELS.post_show,
      note: `🔄 Post-show: питание на поддерживающем уровне (${post.kcal} ккал), белок ${post.proteinG} г, вода/натрий стабильны. ${post.weightCheck}`,
    };
  }
  const profile = CATEGORY_PROFILES[plan.category];
  const w = plan.preparation.startingWeightKg;
  const proteinG = Math.round(w * clamp(profile?.proteinGPerKg ?? 2.2, 1.8, 2.8));
  const fatFloor = prepFatFloorGPerKg(plan.sex);
  const fatG = Math.max(30, Math.round(w * fatFloor));
  // Ступенчатая коррекция калорий по фазе: финальная подготовка −2-3%, тапер — поддержание.
  const phaseMult = phase.key === 'final_preparation' ? 0.97 : phase.key === 'taper' ? 1.0 : 1.0;
  const kcal = Math.max(1400, Math.round(plan.preparation.currentCalories * phaseMult));
  const carbsG = Math.max(50, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  const phaseNote = phase.key === 'taper'
    ? 'Объём снижается, калории стабильны — усталость падает, катаболизм не нужен.'
    : phase.key === 'final_preparation'
      ? 'Финал подготовки: лёгкий дефицит сохраняется, белок и жиры не режутся.'
      : 'Подготовка: дефицит 0.25–0.75%/нед по среднему весу за 7 дней, вода и натрий стабильны.';
  return {
    kcal,
    proteinG,
    fatG,
    carbsG,
    fiberMaxG: 40,
    waterMl: base.waterMl,
    sodiumMg: base.sodiumMg,
    potassiumMg: 3500,
    phase: null,
    phaseLabel: phase.label,
    note: `🗓 ${phase.label}: ${kcal} ккал · Б/У/Ж ${proteinG}/${carbsG}/${fatG} г · 💧 ${(base.waterMl / 1000).toFixed(1)} л · Na ${base.sodiumMg} мг (стабильно). ${phaseNote}`,
  };
}

/** Адаптер целей дня → MealPlanInput генератора меню (цепочка: план → меню). */
export function prepToMealPlanInput(
  t: PeakNutritionTargets,
  opts?: { days?: number; excludePork?: boolean; excludeFish?: boolean; excludeDairy?: boolean; highCarb?: boolean },
): MealPlanInput {
  return {
    targetKcal: Math.max(800, t.kcal),
    targetProtein: Math.max(40, t.proteinG),
    targetFat: Math.max(20, t.fatG),
    targetCarbs: Math.max(20, t.carbsG),
    days: opts?.days ?? 1,
    preferences: {
      excludePork: opts?.excludePork,
      excludeFish: opts?.excludeFish,
      excludeDairy: opts?.excludeDairy,
      highCarb: opts?.highCarb,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Test Peak Week (Этап 7): проверка реакции без изменения основного плана
// ═══════════════════════════════════════════════════════════════════════════

export interface TestPeakWeekResult {
  id: string;
  planId: string;
  createdAt: string;
  showDate: string;
  /** Оценки 1-5 (плохо → отлично). */
  responses: {
    carbTolerance: number;    // переносимость углеводов
    digestion: number;        // пищеварение
    fullness: number;         // наполненность
    waterRetention: number;   // задержка воды (5 = вода ушла, 1 = сильно заливает)
    pump: number;             // пампинг
    sleep: number;            // сон
  };
  weightDeltaKg: number;      // изменение веса за тестовую неделю
  notes?: string;
  /** Итоговый вердикт для основной пик-недели. */
  verdict: 'tested_ok' | 'conservative' | 'adjust';
  recommendation: string;
}

export const TEST_PEAK_WEEK_STORAGE_KEY = 'he_bb_test_peak_weeks';

/** Прогноз результата тестовой пик-недели по ответам (детерминированный расчёт). */
export function scoreTestPeakWeek(
  responses: TestPeakWeekResult['responses'],
  weightDeltaKg: number,
): { verdict: TestPeakWeekResult['verdict']; recommendation: string } {
  const avg = (responses.carbTolerance + responses.digestion + responses.fullness + responses.pump) / 4;
  if (responses.waterRetention >= 4 && avg >= 3.5 && Math.abs(weightDeltaKg) <= 1.5) {
    return { verdict: 'tested_ok', recommendation: 'Протокол отработал стабильно: карб-загрузка и модуляция подходят. Используйте ту же схему на основной пик-неделе (strategy: tested).' };
  }
  if (responses.waterRetention <= 2 || avg <= 2 || weightDeltaKg > 2) {
    return { verdict: 'adjust', recommendation: 'Схема не подошла: залив или плохая переносимость. На основной пик-неделе — консервативный режим: стабильные вода/натрий, умеренные карбс, без агрессивных манипуляций.' };
  }
  return { verdict: 'conservative', recommendation: 'Результат смешанный: на основной пик-неделе выбирайте умеренные настройки и тестируйте ещё раз за 3-4 недели до шоу.' };
}

/** Сохранить результат тестовой пик-недели (не меняет основной план). */
export function saveTestPeakWeekResult(
  planId: string,
  showDate: string,
  responses: TestPeakWeekResult['responses'],
  weightDeltaKg: number,
  notes?: string,
): TestPeakWeekResult {
  const scored = scoreTestPeakWeek(responses, weightDeltaKg);
  const result: TestPeakWeekResult = {
    id: `testpw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    planId,
    createdAt: new Date().toISOString(),
    showDate,
    responses,
    weightDeltaKg,
    notes,
    verdict: scored.verdict,
    recommendation: scored.recommendation,
  };
  try {
    const raw = localStorage.getItem(TEST_PEAK_WEEK_STORAGE_KEY);
    const list: TestPeakWeekResult[] = raw ? (JSON.parse(raw) as TestPeakWeekResult[]) : [];
    list.unshift(result);
    localStorage.setItem(TEST_PEAK_WEEK_STORAGE_KEY, JSON.stringify(list.slice(0, 10)));
  } catch { /* storage недоступен */ }
  return result;
}

/** Последний тест для плана (для strategy: 'tested'). */
export function latestTestPeakWeek(planId: string): TestPeakWeekResult | null {
  try {
    const raw = localStorage.getItem(TEST_PEAK_WEEK_STORAGE_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw) as TestPeakWeekResult[];
    return list.find(t => t.planId === planId) ?? null; // первый в списке = самый свежий
  } catch { return null; }
}

/** Стратегия пик-недели с учётом тестового прогона. */
export function resolvePeakStrategy(plan: BBContestPrepPlan): PrepPeakStrategy {
  if (plan.testPeakWeekId) {
    const t = latestTestPeakWeek(plan.id);
    if (t) {
      if (t.verdict === 'tested_ok') return 'tested';
      if (t.verdict === 'adjust') return 'conservative';
    }
  }
  return plan.peakWeek.strategy === 'tested' ? 'conservative' : plan.peakWeek.strategy;
}

// ═══════════════════════════════════════════════════════════════════════════
// Адаптация подготовки по весу (Этап 3.2-3.3): ступенчатые корректировки,
// ОДНА переменная за раз, анализ среднего веса за 7+ дней (не 2-3 дня),
// taper/пик — без агрессивных изменений.
// ═══════════════════════════════════════════════════════════════════════════

export type PrepWeightStatus =
  | 'no_data'       // недостаточно замеров для анализа
  | 'on_track'      // темп в целевом диапазоне
  | 'too_fast'      // теряет быстрее цели (или недобор/болезнь)
  | 'too_slow'      // плато/медленнее цели
  | 'taper';        // taper/пик — корректировки не агрессивны

export interface PrepWeightAdvice {
  lastWeight: number | null;
  lastDate: string | null;
  measurements: number;              // замеров за последние 14 дней
  avg7d: number | null;              // средний вес за последние 7 дней
  avgPrev7d: number | null;          // средний вес за 7 дней до этого
  delta7d: number | null;            // кг (avg7 − avgPrev)
  delta14d: number | null;           // кг (avg7 − avg за [today-20..today-14])
  weeklyRatePct: number | null;      // фактическая скорость %/нед
  targetRatePctPerWeek: number;
  currentCalories: number;
  phase: PrepPhaseKey | null;        // фаза на referenceDate
  status: PrepWeightStatus;
  /** Прогресс к целевому весу (0-100+; null без цели/старта). */
  progressToTargetPct: number | null;
  recommendation: string;
  /** Ступень коррекции калорий (0 если не рекомендовано). */
  adjustCalories: number;
  /** Ступень коррекции кардио, мин/нед (0 если не рекомендовано). ВЗАИМНО ИСКЛЮЧАЕТ калории. */
  adjustCardioMin: number;
}

const PREP_WEIGHT_MIN_MEASUREMENTS = 2; // минимум замеров в окне для среднего

function meanWeights(entries: Array<{ date: string; weight: number }>, fromIso: string, toIso: string): number | null {
  const vals = entries
    .filter(e => e && e.date >= fromIso && e.date <= toIso && Number.isFinite(e.weight) && e.weight > 30)
    .map(e => e.weight);
  if (vals.length < PREP_WEIGHT_MIN_MEASUREMENTS) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Ступенчатая адаптация подготовки по фактической динамике веса.
 * Вход: лог веса (любой порядок — сортируется внутри), единый prep-план.
 * Анализ только СРЕДНИХ за 7-дневные окна (не реагирует на 2-3-дневные
 * колебания воды/натрия/стресса). Рекомендует менять ОДНУ переменную за раз.
 */
export function prepWeightAdvice(
  log: Array<{ date: string; weight: number }>,
  plan: BBContestPrepPlan,
  opts?: { referenceDate?: string; targetWeightKg?: number },
): PrepWeightAdvice {
  const ref = opts?.referenceDate && isValidIsoDate(opts.referenceDate) ? opts.referenceDate : isoToday();
  const sorted = [...(Array.isArray(log) ? log : [])]
    .filter(e => e && isValidIsoDate(e.date) && Number.isFinite(e.weight) && e.weight > 30)
    .sort((a, b) => a.date.localeCompare(b.date));

  const targetRate = clamp(plan.preparation.targetRatePctPerWeek, 0.25, 0.75);
  const last = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  const avg7d = meanWeights(sorted, isoAddDays(ref, -6), ref);
  const avgPrev7d = meanWeights(sorted, isoAddDays(ref, -13), isoAddDays(ref, -7));
  const avgPrev14d = meanWeights(sorted, isoAddDays(ref, -20), isoAddDays(ref, -14));
  const delta7d = avg7d != null && avgPrev7d != null ? Math.round((avg7d - avgPrev7d) * 100) / 100 : null;
  const delta14d = avg7d != null && avgPrev14d != null ? Math.round((avg7d - avgPrev14d) * 100) / 100 : null;
  const weightRef = avg7d ?? last?.weight ?? plan.preparation.startingWeightKg;
  // weeklyRatePct — в ПРОЦЕНТАХ массы тела в неделю (например −0.5 = −0.5%/нед).
  const weeklyRatePct = delta7d != null && weightRef > 0
    ? Math.round((delta7d / weightRef) * 100 * 100) / 100
    : null;

  const measurements = sorted.filter(e => e.date >= isoAddDays(ref, -13)).length;
  const phase = prepPhaseForDate(plan, ref);

  const base: PrepWeightAdvice = {
    lastWeight: last?.weight ?? null,
    lastDate: last?.date ?? null,
    measurements,
    avg7d, avgPrev7d, delta7d, delta14d,
    weeklyRatePct,
    targetRatePctPerWeek: targetRate,
    currentCalories: plan.preparation.currentCalories,
    phase: phase?.key ?? null,
    status: 'no_data' as PrepWeightStatus,
    progressToTargetPct: null,
    recommendation: '',
    adjustCalories: 0,
    adjustCardioMin: 0,
  };

  // Прогресс к целевому весу.
  const targetW = opts?.targetWeightKg != null && opts.targetWeightKg > 30 ? opts.targetWeightKg : null;
  if (targetW != null && avg7d != null) {
    const start = plan.preparation.startingWeightKg;
    if (Math.abs(start - targetW) > 0.5) {
      base.progressToTargetPct = Math.round((Math.min(start, targetW) - Math.min(avg7d, targetW)) / Math.abs(start - targetW) * 100);
    }
  }

  // ── Taper / пик: не корректируем агрессивно.
  if (phase?.key === 'taper' || phase?.key === 'peak_week' || phase?.key === 'show_day') {
    base.status = 'taper';
    base.recommendation = 'Taper/пик-неделя: калории и кардио НЕ меняем — усталость снижается, темп уже не критичен. При полном застое допустима только мягкая ступень (−100 ккал) при полном соблюдении плана и шагов.';
    base.adjustCalories = 0;
    base.adjustCardioMin = 0;
    return base;
  }

  // ── Недостаточно данных.
  if (delta7d == null || measurements < 2 || avg7d == null) {
    base.status = 'no_data';
    base.recommendation = `Записывайте вес 3-4 раза в неделю (утро, натощак). Анализ — по среднему за 7 дней: сейчас замеров за 14 дней: ${measurements}.`;
    return base;
  }

  // Целевые границы: 0.25–0.75 %/нед (по умолчанию) — допускаем ±30%.
  const slowBound = -(targetRate * 0.55);
  const fastBound = -(targetRate * 1.3);
  const lossPerWeek = weeklyRatePct ?? 0; // отрицательно = потеря

  const steps = [
    '1) Проверьте соблюдение плана (калории, шаги, кардио).',
    '2) Проверьте средние шаги и пищеварение (натрий/запоры/соль).',
    '3) Меняйте ОДНУ переменную за раз и оценивайте эффект минимум 5-7 дней.',
  ].join(' ');

  if (lossPerWeek < fastBound) {
    // Слишком быстро (или наоборот — набор на сушке).
    base.status = 'too_fast';
    base.recommendation = `Темп ${(Math.abs(lossPerWeek)).toFixed(2)}%/нед — быстрее цели (${targetRate}%/нед). Задержка воды, стресс, сон? ${steps} Шаг: +150 ккал ИЛИ −20 мин кардио/нед (одна переменная).`;
    base.adjustCalories = 150;
    base.adjustCardioMin = -20;
    return base;
  }
  if (lossPerWeek > slowBound) {
    // Слишком медленно / плато.
    base.status = 'too_slow';
    base.recommendation = `Темп ${(Math.abs(lossPerWeek)).toFixed(2)}%/нед — медленнее цели (${targetRate}%/нед)${delta14d != null && Math.abs(delta14d) < 0.3 ? ', плато 2+ недели' : ''}. ${steps} Шаг: калории −150…−200 ИЛИ кардио +15…20 мин/нед (одна переменная).`;
    base.adjustCalories = -175;
    base.adjustCardioMin = 20;
    return base;
  }
  base.status = 'on_track';
  base.recommendation = `Темп ${(Math.abs(lossPerWeek)).toFixed(2)}%/нед — в целевом диапазоне (0.25–0.75%/нед). Коррекции не нужны: продолжайте по плану.`;
  return base;
}

// ═══════════════════════════════════════════════════════════════════════════
// Post-show: контроль восстановления после соревнования
// (фаза post_show в календаре — здесь конкретный план питания/тренировок)
// ═══════════════════════════════════════════════════════════════════════════

export interface PostShowPlan {
  durationDays: number;       // 7–14
  kcal: number;               // поддерживающий уровень (после дефицита подготовки)
  proteinG: number;
  waterLiters: number;        // стабильно
  notes: string[];            // питание/добавки
  training: string[];         // тренировки
  weightCheck: string;
}

/**
 * План восстановления после шоу: питание на поддерживающем уровне,
 * стабильные вода/натрий, лёгкий возврат к тренировкам, контроль веса.
 * НЕ возвращает резких протоколов — пост-шоу не место для манипуляций.
 */
export function buildPostShowPlan(plan: BBContestPrepPlan, opts?: { referenceCalories?: number }): PostShowPlan {
  const w = plan.preparation.startingWeightKg;
  // Поддержание ≈ калории дефицита + 300–400 (дефицит ~0.5%/нед ≈ 400 ккал у 80 кг).
  const maintenance = Math.max(
    (opts?.referenceCalories && opts.referenceCalories > 1200 ? opts.referenceCalories : plan.preparation.currentCalories) + 300,
    Math.round(w * 26),
  );
  const proteinG = Math.round(w * 2.0);
  return {
    durationDays: 7,
    kcal: maintenance,
    proteinG,
    waterLiters: 3,
    notes: [
      `Калории на поддерживающем уровне (~${maintenance} ккал/день): после длительного дефицита плавно возвращайтесь к поддержанию, не уходите в профицит сразу.`,
      'Белок 2.0 г/кг сохраняется первые 1–2 недели — восстановление мышц после пик-недели.',
      'Вода и натрий стабильны: никаких резких манипуляций после шоу.',
      'Креатин и привычные добавки можно возвращать без ограничений.',
    ],
    training: [
      'Неделя 1: лёгкие full-body сессии 2–3×/нед (50–60% веса), ходьба/лёгкое кардио — удовольствие, не результат.',
      'Неделя 2: постепенный возврат к обычной схеме (объём +10–15%/нед), без отказных серий в первые дни.',
      'Позирование можно прекратить или оставить 10–15 мин/день по желанию.',
    ],
    weightCheck: `Контроль веса: допустимо +1–2 кг в первую неделю (гликоген/вода — норма). Если рост >2 кг за неделю — скорректируйте калории на −150 и оцените через 5–7 дней.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Печать сводки contest prep (HTML, XSS-безопасно)
// ═══════════════════════════════════════════════════════════════════════════

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Полная HTML-сводка contest prep для печати (фазы/тапер/пик-неделя/шоу-день/post-show). */
export function buildContestPrepPrintHtml(plan: BBContestPrepPlan): string {
  const profile = CATEGORY_PROFILES[plan.category];
  const post = buildPostShowPlan(plan);
  const peakWeek = buildPeakWeek(configFromPlan(plan));
  const timeline = buildShowTimeline(configFromPlan(plan));
  const rows = (arr: string[]): string => arr.map(n => `<li>${escHtml(n)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<title>🏁 Contest Prep — ${escHtml(plan.showDate)}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:24px;color:#111;font-size:12px;line-height:1.5}
  h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}
  table{border-collapse:collapse;width:100%;margin:6px 0}
  th,td{border:1px solid #ccc;padding:4px 8px;text-align:left;font-size:11px}
  th{background:#f4f4f5}.muted{color:#666;font-size:11px}.warn{color:#b91c1c;font-size:11px}
  ul{margin:4px 0 8px;padding-left:18px}li{margin:2px 0}
</style></head><body>
<h1>🏁 Contest Prep — бодибилдинг</h1>
<div class="muted">Шоу: ${escHtml(plan.showDate)} · ${escHtml(profile?.label ?? plan.category)} · ${plan.sex === 'female' ? 'жен' : 'муж'} · ${plan.preparation.startingWeightKg} кг · темп ${plan.preparation.targetRatePctPerWeek}%/нед</div>
<div class="muted">Подготовка ${plan.preparation.weeks} нед (финал ${plan.preparation.finalWeeks}) · taper ${plan.taper.weeks} нед · пик-неделя 7 дн · ${plan.preparation.currentCalories} ккал · ${plan.preparation.stepsPerDay} шагов · кардио ${plan.preparation.cardioMinutesPerWeek} мин/нед</div>

<h2>🗺 Фазы</h2>
<table><tr><th>Фаза</th><th>Недели</th><th>Даты</th><th>Задача</th></tr>
${plan.phases.map(p => `<tr><td><b>${escHtml(p.label)}</b></td><td>${p.key === 'show_day' ? 'день шоу' : p.key === 'post_show' ? 'после шоу' : `${p.weekStart}–${p.weekEnd}`}</td><td>${p.dateStart} — ${p.dateEnd}</td><td>${escHtml(p.note)}</td></tr>`).join('')}
</table>

<h2>📉 Кривая taper (объём ↓, интенсивность сохраняется, RIR 2–4)</h2>
<table><tr><th>Неделя</th><th>Объём</th><th>Интенсивность (вес)</th><th>RIR</th></tr>
${plan.taper.volumeProfile.map((v, i) => `<tr><td>${plan.taper.weeks - i}</td><td>${Math.round(v * 100)}%</td><td>${Math.round(plan.taper.intensityProfile[i] * 100)}%</td><td>${plan.taper.rirProfile[i]?.[0]}–${plan.taper.rirProfile[i]?.[1]}</td></tr>`).join('')}
</table>

<h2>🍚 Пик-неделя (по дням)</h2>
<table><tr><th>День</th><th>Фаза</th><th>Ккал</th><th>Б/У/Ж</th><th>💧 Вода</th><th>Na мг</th><th>🏋️ Тренировка</th><th>🎭 Позы</th></tr>
${peakWeek.map(d => `<tr><td>${d.day === 7 ? '🎬 Show' : `Д${d.day}`}</td><td>${escHtml(d.phaseLabel)}</td><td>${d.kcal}</td><td>${d.proteinG}/${d.carbsG}/${d.fatG}</td><td>${d.waterLiters} л</td><td>${d.sodiumMg}</td><td>${escHtml(d.training.type)}</td><td>${d.posingMinutes}'</td></tr>`).join('')}
</table>

<h2>🎬 Таймлайн Show Day</h2>
<table><tr><th>Время</th><th>Действие</th><th>Детали</th></tr>
${timeline.map(t => `<tr><td>${t.time}</td><td><b>${escHtml(t.action)}</b></td><td>${escHtml(t.detail)}</td></tr>`).join('')}
</table>

<h2>🔄 Post-show (${post.durationDays} дней)</h2>
<ul>${rows(post.notes)}</ul>
<div class="muted">🏋️ ${escHtml(post.training.join(' '))}</div>
<div class="muted">⚖️ ${escHtml(post.weightCheck)}</div>

<h2>⚖️ Адаптация по весу</h2>
<div class="muted">Анализ средних за 7 дней; целевой темп ${plan.preparation.targetRatePctPerWeek}%/нед. Одна переменная за раз: калории ±150–175 ИЛИ кардио ±20 мин/нед. В taper/пик корректировки запрещены.</div>

${plan.safety.warnings.length > 0 ? `<h2>⚠️ Предупреждения</h2><ul>${rows(plan.safety.warnings)}</ul>` : ''}
${plan.safety.requiresReview ? `<div class="warn">🩺 Требуется профессиональное сопровождение: ${escHtml(plan.safety.contraindications.join(', '))}. Агрессивные режимы отключены.</div>` : ''}
<div class="muted" style="margin-top:16px">Расчёт не заменяет работу с врачом и тренером. Диуретики и фармакология не назначаются.</div>
</body></html>`;
}

