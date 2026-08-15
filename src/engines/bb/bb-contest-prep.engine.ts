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
// Тренировочный тапер (из Библиотеки методик)
// ═══════════════════════════════════════════════════════════════════════════

export function buildTrainingTaper(cfg: BBContestPrepConfig): TrainingTaperWeek[] {
  const v = validateBBContestPrepConfig(cfg);
  if (!v.ok) return [];
  const eff = applyForcedModes(cfg);
  const protocol = getPeakingProtocol(eff.trainingProtocol);
  const selected = protocol.weeks.slice(-eff.weeksOut);
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
  const peakWeek = buildPeakWeek({ ...cfg, showDate });
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
  opts?: { weekNumber?: number },
): BBPlanWithPrep {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return plan as BBPlanWithPrep;
  const v = validateBBContestPrepConfig(rawCfg);
  if (!v.ok) return plan as BBPlanWithPrep;
  const base = applyForcedModes(rawCfg);
  const cfg: BBContestPrepConfig = { ...base, showDate: resolveShowDate(base) };
  const existing = (plan as BBPlanWithPrep).contestPrep;

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

  for (let i = 0; i < windowLen; i++) {
    const idx = startIdx + i;
    const wk = weeks[idx];
    const t = usedTaper[i];
    if (!t) break;
    if (weekAlreadyPrepped(wk)) continue; // idempotent per-week (другое соревнование)

    // Guard: не резать уже разгруженные недели (anti-двойное снижение, как PL-taper).
    const isDeload = wk.deload === true || wk.phase === 'deload'
      || (idx > 0 && weekVolume(wk) < weekVolume(weeks[idx - 1]) * 0.6);
    if (isDeload) {
      wk.phase = wk.phase ?? 'deload';
      wk.taper = true;
      wk.prepProtocol = `Пропущена (разгрузка) — ${t.label}`;
      continue;
    }

    const rirClamp = (r: number): number => clamp(r, t.rirMin, t.rirMax);

    for (const s of wk.sessions) {
      s.exercises = s.exercises.map((e: any) => {
        const isSpec = muscleMatchesSpecialization(e.muscle, cfg.specialization);
        // ⭐ Специализация: целевая мышца щадится — объём режется мягче (×1.25 к множителю).
        const effMult = isSpec ? Math.min(1, t.volumePct * 1.25) : t.volumePct;
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
          comment: `${e.comment || ''} 📉 Тапер: ${t.label} (объём ${Math.round(effMult * 100)}%, вес ${Math.round(t.intensityPct * 100)}%).${isSpec ? ' ⭐ Спец: объём щадится.' : ''}`,
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
    // Guard только против ПРОШЛЫХ применений (peakWeek), а не против собственного
    // тапер-прохода этой недели — тапер и пик-трансформация в одном вызове совместимы.
    if (wk.peakWeek !== true) {
      const peakWeek = buildPeakWeek(cfg);
      wk.phase = 'peaking';
      wk.taper = true;
      wk.peakWeek = true;
      wk.sessions = wk.sessions.map((s: any, si: number) => toPeakWeekSession(s, si, cfg, peakWeek));
      wk.prepProtocol = `Пик-неделя: ${PHASES_BY_STRATEGY[cfg.carbLoadStrategy].map(p => PHASE_LABELS_RU[p]).join(' → ')}`;
      appliedWeeks.push(endIdx + 1);
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
