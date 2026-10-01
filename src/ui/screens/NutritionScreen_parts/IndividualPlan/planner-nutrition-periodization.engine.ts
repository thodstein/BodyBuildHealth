/**
 * planner-nutrition-periodization.engine.ts — ПРОФЕССИОНАЛЬНАЯ периодизация питания.
 *
 * Зачем: движок уже умеет считать цели на КОНКРЕТНУЮ дату (контест-преп
 * `nutritionTargetsForPrepDate`, карб-периодизация `applyCarbPeriodizationMods`),
 * но пользователю/тренеру показывался только «сегодня». Профессиональный
 * планировщик обязан показывать ВЕСЬ горизонт вперёд: неделю за неделей (фазы
 * препа → taper → peak → post-show), день за днём (тренировка/отдых, тяжёлый
 * день, рефид, diet-break) с фактическими целями КБЖУ/воды/натрия.
 *
 * Этот модуль — ЧИСТАЯ функция-фасад: ничего не считает «по-своему», а
 * последовательно применяет уже существующие каноны (единый источник истины):
 *  - контест-преп: `nutritionTargetsForPrepDate` (подготовка/taper/пик/post-show);
 *  - карб-периодизация: `applyCarbPeriodizationMods` (8 режимов);
 *  - тяжёлый день: `isHeavyDayForOffset` (угли +25%, ккал +5%).
 *
 * Показанное здесь = сгенерированному дню (та же арифметика, что в
 * `IndividualPlanContext.buildOneDay`), поэтому «показано = применится».
 *
 * Детерминированная, без React/localStorage — тестируемая.
 */

import type { GoalId, CarbPeriodization } from './types';
import { applyCarbPeriodizationMods, carbPeriodizationLabel } from './planner-carb-periodization';
import {
  nutritionTargetsForPrepDate,
  prepPhaseForDate,
  isPrepRefeedDay,
  isPrepDietBreakDay,
  PREP_SODIUM_BASE_MG,
  type BBContestPrepPlan,
} from '../../../../engines/bb/bb-contest-prep.engine';
import { shiftIsoDate, parseLocalIsoDate } from '../../../../core/local-date';

// ─── Типы ────────────────────────────────────────────────────────────────────

/** База дня (совпадает с PeakNutritionBase движка препа): ккал/Б/Ж/У/вода/натрий. */
export interface PeriodizationBase {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  waterMl: number;
  sodiumMg: number;
}

export interface PeriodizationInput {
  /** ISO-дата начала горизонта (для препа — старт подготовки, иначе — сегодня). */
  startDate: string;
  /** Горизонт в неделях (1..60). */
  horizonWeeks: number;
  /** Единый план contest prep (если есть) — режим «prep»; иначе режим «general». */
  prepPlan: BBContestPrepPlan | null;
  /** Базовые цели дня (effectiveKcal/P/F/C + вода/натрий). */
  base: PeriodizationBase;
  /** Цель атлета (для лейбла и базы в general-режиме). */
  goal: GoalId;
  /** Режим периодизации углеводов (8 опций). */
  carbPeriodization: CarbPeriodization;
  /** Тренировочный ли день (offset от startDate). Единая функция графика. */
  isTrainingDayForOffset: (offset: number) => boolean;
  /** День тяжёлых ног/высокого объёма (лейбл «Пн»..«Вс»). */
  heavyTrainDay?: string | null;
  /** Лейблы дней недели ['Пн'..'Вс'] (для тяжёлого дня и подписей). */
  dayLabels?: string[];
  /** Трек post-show (recovery/reverse) — прокидывается в движок препа. */
  postShowTrack?: 'recovery' | 'reverse';
  /**
   * Запланированные спец-дни (`he_special_meals`): рефид / читмил / фастинг.
   * В general-режиме применяются ТЕ ЖЕ моды, что в генерации (Context.buildOneDay):
   * refeed ×1.12/×2.2, cheat kcal ≥×1.12, fast ≤×0.75/×0.7. В prep-режиме — только метки
   * (цели фазы задаёт prep-движок, как и в живом рационе).
   */
  specialMeals?: { date: string; type: 'refeed' | 'cheat_meal' | 'fast' | 'diet_break' }[];
  /** Дневник веса (факт) — средний вес недели рядом с целевым (prep). */
  weightLog?: { date: string; weightKg: number }[];
  /** Поддержание (TDEE) — для точного показа диет-брейк-дня (калории к поддержанию). */
  maintenanceKcal?: number;
}

export interface PeriodizationDay {
  date: string;
  offset: number;
  /** 0 = понедельник .. 6 = воскресенье. */
  weekdayIndex: number;
  weekday: string;
  isTraining: boolean;
  isHeavy: boolean;
  phaseKey: string | null;
  phaseLabel: string;
  phaseColor: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberMaxG: number;
  waterMl: number;
  sodiumMg: number;
  potassiumMg: number;
  isRefeed: boolean;
  isDietBreak: boolean;
  isPeakWeek: boolean;
  isPostShow: boolean;
  isCheat: boolean;
  isFast: boolean;
  source: 'prep' | 'general';
  note: string;
}

export interface PeriodizationWeek {
  weekIndex: number;
  dateStart: string;
  dateEnd: string;
  phaseKey: string | null;
  phaseLabel: string;
  phaseColor: string;
  avgKcal: number;
  avgProteinG: number;
  avgFatG: number;
  avgCarbsG: number;
  waterMl: number;
  sodiumMg: number;
  potassiumMg: number;
  trainingDays: number;
  heavyDays: number;
  refeedDays: number;
  dietBreakDays: number;
  peakWeek: boolean;
  postShow: boolean;
  /** Целевой вес на конец недели (prep): старт × (1 − темп%/нед)^нед; taper/пик — stage-вес; post-show — null. */
  targetWeightKg: number | null;
  /** Факт: средний вес из дневника за неделю (null — нет записей). */
  actualWeightKg: number | null;
  /** Дельта факт − цель (кг): + = выше цели; null если нет факта или цели. */
  weightDeltaKg: number | null;
}

export interface NutritionPeriodization {
  mode: 'prep' | 'general';
  startDate: string;
  horizonWeeks: number;
  showDate: string | null;
  goal: GoalId;
  carbPeriodization: CarbPeriodization;
  carbLabel: string;
  days: PeriodizationDay[];
  weeks: PeriodizationWeek[];
  summary: {
    totalDays: number;
    trainingDays: number;
    refeedDays: number;
    dietBreakDays: number;
    peakWeekDays: number;
    prepWeeks: number;
    taperWeeks: number;
    phases: { key: string; label: string; color: string; weeks: number }[];
  };
  notes: string[];
}

// ─── Константы ───────────────────────────────────────────────────────────────

export const PERIODIZATION_GOAL_RU: Record<GoalId, string> = {
  mass: 'Набор массы',
  strength: 'Сила',
  fat_loss: 'Жиросжигание',
  cutting: 'Сушка',
  post_cut: 'После сушки',
  maintenance: 'Поддержание',
  recomposition: 'Рекомпозиция',
  rehab: 'Реабилитация',
  health: 'Здоровье',
};

/** Варианты горизонта для UI (недели). «Весь преп» считается вызывающей стороной. */
export const PERIODIZATION_HORIZON_OPTIONS: { weeks: number; label: string }[] = [
  { weeks: 1, label: 'Неделя' },
  { weeks: 4, label: '4 нед' },
  { weeks: 8, label: '8 нед' },
  { weeks: 12, label: '12 нед' },
];

const DEFAULT_DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const GENERAL_PHASE_COLOR = '#00e68a';

// ─── Утилиты ─────────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const round = (v: number): number => Math.round(Number.isFinite(v) ? v : 0);

/** День недели (0 = Пн .. 6 = Вс) по ISO-дате (локально, без UTC-сдвига). */
export function weekdayIndexForIso(iso: string): number {
  const d = parseLocalIsoDate(iso);
  if (!d) return 0;
  return ((d.getDay() + 6) % 7);
}

/**
 * Горизонт периодизации для контест-препа: от старта подготовки до конца
 * post-show-окна (12 нед после шоу), в неделях. Для general-режима — `minWeeks`.
 */
export function prepPeriodizationHorizon(plan: BBContestPrepPlan | null, minWeeks = 4, maxWeeks = 60): number {
  if (!plan) return clamp(round(minWeeks) || 4, 1, maxWeeks);
  const start = plan.preparation?.startDate;
  const a = parseLocalIsoDate(start);
  if (!a) return clamp(round(minWeeks) || 4, 1, maxWeeks);
  const last = (plan.phases || []).reduce((acc, p) => (p.dateEnd > acc ? p.dateEnd : acc), start);
  const b = parseLocalIsoDate(last);
  if (!b) return clamp(round(minWeeks) || 4, 1, maxWeeks);
  const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return clamp(Math.ceil(days / 7), 1, maxWeeks);
}

// ─── Основная функция ────────────────────────────────────────────────────────

/**
 * Построить профессиональную периодизацию питания на горизонт вперёд.
 * Детерминированная; при невалидных входах возвращает пустую структуру.
 */
export function buildNutritionPeriodization(input: PeriodizationInput): NutritionPeriodization {
  const dayLabels = (Array.isArray(input.dayLabels) && input.dayLabels.length === 7) ? input.dayLabels : DEFAULT_DAY_LABELS;
  const horizonWeeks = clamp(round(input.horizonWeeks) || 4, 1, 60);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input.startDate)) ? input.startDate : '';
  const prepPlan = input.prepPlan || null;
  const mode: 'prep' | 'general' = prepPlan ? 'prep' : 'general';
  const base = input.base;

  const empty: NutritionPeriodization = {
    mode, startDate, horizonWeeks, showDate: prepPlan?.showDate ?? null,
    goal: input.goal, carbPeriodization: input.carbPeriodization,
    carbLabel: carbPeriodizationLabel(input.carbPeriodization),
    days: [], weeks: [],
    summary: { totalDays: 0, trainingDays: 0, refeedDays: 0, dietBreakDays: 0, peakWeekDays: 0, prepWeeks: 0, taperWeeks: 0, phases: [] },
    notes: [],
  };
  if (!startDate) return empty;

  const days: PeriodizationDay[] = [];
  for (let offset = 0; offset < horizonWeeks * 7; offset++) {
    days.push(buildDay(input, offset, startDate, prepPlan, dayLabels, base));
  }

  const weeks = aggregateWeeks(days, horizonWeeks, startDate, prepPlan, input.weightLog);
  const summary = buildSummary(days, weeks, mode);
  const notes = buildNotes(input, prepPlan, days, mode);

  return {
    mode, startDate, horizonWeeks, showDate: prepPlan?.showDate ?? null,
    goal: input.goal, carbPeriodization: input.carbPeriodization,
    carbLabel: carbPeriodizationLabel(input.carbPeriodization),
    days, weeks, summary, notes,
  };
}

function buildDay(
  input: PeriodizationInput,
  offset: number,
  startDate: string,
  prepPlan: BBContestPrepPlan | null,
  dayLabels: string[],
  base: PeriodizationBase,
): PeriodizationDay {
  const date = shiftIsoDate(startDate, offset);
  const weekdayIndex = weekdayIndexForIso(date);
  const weekday = dayLabels[weekdayIndex] || DEFAULT_DAY_LABELS[weekdayIndex];

  let isTraining = false;
  try { isTraining = !!input.isTrainingDayForOffset(offset); } catch { isTraining = false; }
  const isHeavy = !!(input.heavyTrainDay && dayLabels[weekdayIndex] === input.heavyTrainDay);

  // Единый канон периодизации углеводов (тот же, что в генерации).
  const perio = applyCarbPeriodizationMods(input.carbPeriodization, offset, isTraining);
  let dayKcalMod = perio.dayKcalMod;
  let dayCarbMod = perio.dayCarbMod;
  let isRefeedPeriodization = perio.isRefeedDay;
  if (isHeavy) { dayKcalMod *= 1.05; dayCarbMod *= 1.25; }

  // Запланированные спец-дни (he_special_meals) — те же моды, что в Context.buildOneDay.
  const special = (input.specialMeals || []).find(s => s && s.date === date) || null;
  const isCheat = special?.type === 'cheat_meal';
  const isFast = special?.type === 'fast';
  const isDietBreakSpecial = special?.type === 'diet_break';
  if (special?.type === 'refeed') { dayKcalMod = 1.12; dayCarbMod = 2.2; isRefeedPeriodization = true; }
  if (isCheat && !isRefeedPeriodization) { dayKcalMod = Math.max(dayKcalMod, 1.12); }
  if (isFast) { dayKcalMod = Math.min(dayKcalMod, 0.75); dayCarbMod = Math.min(dayCarbMod, 0.7); }
  if (isDietBreakSpecial) {
    // E23: полноценный день на поддержании — калории к TDEE, углеводы выше (дефицит пауза).
    const _maintMod = (input.maintenanceKcal && input.maintenanceKcal > 0) ? (input.maintenanceKcal / Math.max(1, base.kcal || 1)) : 1.12;
    dayKcalMod = Math.max(dayKcalMod, _maintMod);
    dayCarbMod = Math.max(dayCarbMod, 1.15);
  }

  // База дня после периодизации (та же арифметика, что в Context.buildOneDay).
  const baseKcal = Math.max(1200, base.kcal || 0);
  const baseProtein = Math.max(80, base.proteinG || 0);
  const baseFat = Math.max(30, base.fatG || 0);
  const baseCarbs = Math.max(50, base.carbsG || 0);
  const genBase = {
    kcal: round(baseKcal * dayKcalMod),
    proteinG: round(baseProtein),
    fatG: round(baseFat * (isRefeedPeriodization ? 0.5 : 1)),
    carbsG: round(baseCarbs * dayCarbMod),
    waterMl: base.waterMl || 3000,
    sodiumMg: base.sodiumMg || PREP_SODIUM_BASE_MG,
  };

  const phase = prepPlan ? prepPhaseForDate(prepPlan, date) : null;
  const inPrepWindow = !!phase;

  if (prepPlan && inPrepWindow) {
    // Профессиональный контест-преп: абсолютные цели фазы (подготовка/taper/пик/post-show).
    // База воды/натрия — канон генерации (3000 / PREP_SODIUM_BASE_MG), иначе «показано ≠ сгенерировано».
    const t = nutritionTargetsForPrepDate(
      date,
      prepPlan,
      { ...genBase, waterMl: 3000, sodiumMg: PREP_SODIUM_BASE_MG },
      { isHeavyTrainDay: isTraining, postShowTrack: input.postShowTrack },
    );
    // Фаза `peak_week` в диапазонах препа точно совпадает с 7 днями пика —
    // отдельный вызов peakWeekDayForDate/configFromPlan не нужен.
    const isPeak = phase?.key === 'peak_week';
    let isRefeed = false;
    let isDietBreak = false;
    try {
      isDietBreak = isPrepDietBreakDay(date, prepPlan);
      isRefeed = isPrepRefeedDay(date, prepPlan);
    } catch { /* ignore */ }
    return {
      date, offset, weekdayIndex, weekday, isTraining, isHeavy,
      phaseKey: phase?.key ?? null,
      phaseLabel: t.phaseLabel || phase?.label || '',
      phaseColor: phase?.color || GENERAL_PHASE_COLOR,
      kcal: t.kcal, proteinG: t.proteinG, fatG: t.fatG, carbsG: t.carbsG,
      fiberMaxG: t.fiberMaxG, waterMl: t.waterMl, sodiumMg: t.sodiumMg, potassiumMg: t.potassiumMg,
      isRefeed: isRefeed || isRefeedPeriodization,
      isDietBreak,
      isPeakWeek: isPeak || phase?.key === 'peak_week',
      isPostShow: phase?.key === 'post_show',
      isCheat,
      isFast,
      source: 'prep',
      note: t.note,
    };
  }

  // General-режим: цель + карб-периодизация (без контест-препа).
  const kcal = genBase.kcal;
  const proteinG = genBase.proteinG;
  const fatG = genBase.fatG;
  const carbsG = genBase.carbsG;
  const label = PERIODIZATION_GOAL_RU[input.goal] || 'Рацион';
  const fiberMaxG = Math.min(70, Math.max(25, round(kcal * 0.014)));
  return {
    date, offset, weekdayIndex, weekday, isTraining, isHeavy,
    phaseKey: null,
    phaseLabel: label,
    phaseColor: GENERAL_PHASE_COLOR,
    kcal, proteinG, fatG, carbsG,
    fiberMaxG,
    waterMl: base.waterMl || 3000,
    sodiumMg: base.sodiumMg || PREP_SODIUM_BASE_MG,
    potassiumMg: 3500,
    isRefeed: isRefeedPeriodization,
    isDietBreak: isDietBreakSpecial,
    isPeakWeek: false,
    isPostShow: false,
    isCheat,
    isFast,
    source: 'general',
    note: isFast
      ? '⏳ Фастинг по расписанию: калорийность снижена, окно приёмов ~8 ч.'
      : isCheat
        ? '🍔 Читмил по расписанию: калорийность дня повышена, один приём свободный (до 1500 ккал).'
        : isRefeedPeriodization
          ? '🔄 Рефид: углеводы ×2.2, жиры снижены — гликоген/лептин.'
          : perio.weekNote || (isHeavy ? '🏋️ Тяжёлый день: угли +25%, ккал +5%.' : ''),
  };
}

function aggregateWeeks(days: PeriodizationDay[], horizonWeeks: number, startDate: string, prepPlan: BBContestPrepPlan | null, weightLog?: { date: string; weightKg: number }[]): PeriodizationWeek[] {
  const weeks: PeriodizationWeek[] = [];
  // Целевой вес (prep): старт × (1 − темп%/нед)^нед по неделям подготовки; taper/пик держат stage-вес.
  const prepWeeks = prepPlan ? Math.max(0, Math.round(prepPlan.preparation?.weeks || 0)) : 0;
  const startWeight = prepPlan ? Number(prepPlan.preparation?.startingWeightKg) || 0 : 0;
  const rate = prepPlan ? clamp(Number(prepPlan.preparation?.targetRatePctPerWeek) || 0.5, 0.1, 1.5) / 100 : 0;
  const targetWeightForWeek = (w: number, phaseKey: string | null): number | null => {
    if (!prepPlan || startWeight <= 0) return null;
    if (phaseKey === 'post_show' || phaseKey === 'show_day') return null;
    const effectiveWeeks = Math.min(w, prepWeeks || w);
    const kg = startWeight * Math.pow(1 - rate, effectiveWeeks);
    return Math.round(kg * 10) / 10;
  };
  for (let w = 0; w < horizonWeeks; w++) {
    const slice = days.slice(w * 7, w * 7 + 7);
    if (slice.length === 0) continue;
    const n = slice.length;
    const avg = (pick: (d: PeriodizationDay) => number): number => round(slice.reduce((s, d) => s + pick(d), 0) / n);
    // Фаза недели — по первому дню (недели препа не пересекают фазы, кроме границы).
    const head = slice[0];
    const _wStart = head.date;
    const _wEnd = slice[slice.length - 1].date;
    // Факт веса недели — среднее записей дневника в диапазоне дат недели.
    let _actual: number | null = null;
    if (Array.isArray(weightLog) && weightLog.length > 0) {
      const vals = weightLog.filter(e => e && typeof e.date === 'string' && e.date >= _wStart && e.date <= _wEnd && Number.isFinite(e.weightKg) && e.weightKg > 0).map(e => e.weightKg);
      if (vals.length > 0) _actual = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
    }
    const _target = targetWeightForWeek(w + 1, head.phaseKey);
    weeks.push({
      weekIndex: w + 1,
      dateStart: head.date,
      dateEnd: slice[slice.length - 1].date,
      phaseKey: head.phaseKey,
      phaseLabel: head.phaseLabel,
      phaseColor: head.phaseColor,
      avgKcal: avg(d => d.kcal),
      avgProteinG: avg(d => d.proteinG),
      avgFatG: avg(d => d.fatG),
      avgCarbsG: avg(d => d.carbsG),
      waterMl: avg(d => d.waterMl),
      sodiumMg: avg(d => d.sodiumMg),
      potassiumMg: avg(d => d.potassiumMg),
      trainingDays: slice.filter(d => d.isTraining).length,
      heavyDays: slice.filter(d => d.isHeavy).length,
      refeedDays: slice.filter(d => d.isRefeed).length,
      dietBreakDays: slice.filter(d => d.isDietBreak).length,
      peakWeek: slice.some(d => d.isPeakWeek),
      postShow: slice.every(d => d.isPostShow),
      targetWeightKg: _target,
      actualWeightKg: _actual,
      weightDeltaKg: (_actual != null && _target != null) ? Math.round((_actual - _target) * 10) / 10 : null,
    });
  }
  return weeks;
}

function buildSummary(days: PeriodizationDay[], weeks: PeriodizationWeek[], mode: 'prep' | 'general'): NutritionPeriodization['summary'] {
  const phaseMap = new Map<string, { key: string; label: string; color: string; weeks: number }>();
  for (const w of weeks) {
    const key = w.phaseKey || (mode === 'general' ? 'general' : 'unknown');
    const cur = phaseMap.get(key);
    if (cur) cur.weeks += 1;
    else phaseMap.set(key, { key, label: w.phaseLabel, color: w.phaseColor, weeks: 1 });
  }
  return {
    totalDays: days.length,
    trainingDays: days.filter(d => d.isTraining).length,
    refeedDays: days.filter(d => d.isRefeed).length,
    dietBreakDays: days.filter(d => d.isDietBreak).length,
    peakWeekDays: days.filter(d => d.isPeakWeek).length,
    prepWeeks: weeks.filter(w => w.phaseKey === 'preparation' || w.phaseKey === 'final_preparation').length,
    taperWeeks: weeks.filter(w => w.phaseKey === 'taper').length,
    phases: Array.from(phaseMap.values()),
  };
}

function buildNotes(
  input: PeriodizationInput,
  prepPlan: BBContestPrepPlan | null,
  days: PeriodizationDay[],
  mode: 'prep' | 'general',
): string[] {
  const notes: string[] = [];
  if (mode === 'prep' && prepPlan) {
    notes.push(`🏁 Контест-преп: цели подготовки рассчитаны движком bb-contest-prep (дефицит 0.25–0.75%/нед, белок из профиля категории, вода/натрий стабильны).`);
    if (input.postShowTrack === 'reverse') notes.push('🔄 Post-show: трек «reverse» (+100 ккал/нед) вместо «recovery».');
    const hasPeak = days.some(d => d.isPeakWeek);
    if (hasPeak) notes.push('🎭 Пик-неделя: деплеция → загрузка, вода/натрий стабильны (если не подтверждена модуляция), лёгкий памп.');
    const breaks = days.filter(d => d.isDietBreak).length;
    if (breaks > 0) notes.push(`🏖 Diet-break: ${breaks} дн. на поддержании (восстановление лептина/гормонов, дефицит продолжится).`);
  } else {
    notes.push('🎯 Режим цели: цели дня = база цели × карб-периодизация × тяжёлый день. Для профессионального препа постройте «🏁 Тапер ББ» — периодизация станет недельной (подготовка → taper → пик).');
  }
  notes.push(`🍚 Периодизация углеводов: «${carbPeriodizationLabel(input.carbPeriodization)}» — применена ко всем дням.`);
  return notes;
}
