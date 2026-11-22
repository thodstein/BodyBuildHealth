/**
 * widget-sync.ts — сборка снапшотов приложения для виджетов + разбор очереди.
 *
 * Вызывается из DashboardNative (только APK): при монтировании и при возврате
 * из фона. Telegram/web этот модуль не импортируют.
 */

import { getProfile } from '../../core/profile-manager';
import {
  getWorkoutStats,
  getLastSession,
  getSessionsByWeek,
  getISOWeekNumber,
  loadActiveSession,
  summarizeActiveSession,
  loadSessions,
  startSession,
  addExerciseToSession,
  logSet,
  saveActiveSession,
  finishSession,
  clearActiveSession,
  type WorkoutSession,
} from '../../engines/workout-logger.engine';
import { isBodyweightExercise } from '../../engines/movement-pattern';
import { getAdherenceStats } from '../../engines/symptom-adherence.engine';
import { calcNutrition } from '../../engines/nutrition.engine';
import { derivePAL } from '../../core/energy-pal';
import { loadWaterLog, addWater, removeWater } from '../../engines/nutrition-tracker.engine';
import { readDiaryV2, writeDiaryV2, onDiaryChangeV2 } from '../screens/NutritionScreen_parts/diary-storage-v2';
import {
  readPlanTargets,
  PLAN_TARGETS_EVENT,
} from '../screens/NutritionScreen_parts/IndividualPlan/plan-targets-bridge';
import {
  syncTrainingWidget,
  syncComplianceWidget,
  syncNutritionWidget,
  syncCalendarWidget,
  syncNotesWidget,
  syncWorkoutWidget,
  drainWidgetQueue,
  type NotesWidgetSnapshot,
  type QueuedItem,
  type WorkoutWidgetExercise,
  type WorkoutWidgetSnapshot,
  type NutritionPeriodStats,
  type NutritionLastFood,
  type NutritionDayItem,
  type NutritionDaySnapshot,
  type NutritionQuickFood,
  type NutritionFoodItem,
  pushNutritionFoods,
  nutritionFoodsVersion,
  WIDGET_DAY_ITEMS_CAP,
} from '../../core/widget-bridge';
import { resolveFavorites } from '../screens/NutritionScreen_parts/diary/food-favorites';
import { withDiaryItemQty } from '../screens/NutritionScreen_parts/diary/diary-item-qty';
import { MEAL_PRESETS } from '../screens/NutritionScreen_parts/diary/hooks/useDiaryMealTypes';
import { FOOD_DB } from '../../core/nutrition-database';
import { ruCount, RU_APPROACHES } from '../../engines/ru-plural';
import {
  readCoachPlanner,
  writeCoachPlanner,
  tasksForDate,
  tasksInRange,
  overdueCoachTasks,
  updateCoachTask,
  addCoachTask,
  coachTaskPriority,
} from '../../engines/coach/coach-planner.engine';
import {
  readCoachNotes,
  writeCoachNotes,
  sortCoachNotes,
  noteAttachments,
  noteChecklistProgress,
  addCoachNote,
  isCoachNoteDeleted,
  type CoachNotesStore,
} from '../../engines/coach/coach-notes.engine';

export type WidgetNavTarget = 'training' | 'nutrition' | 'support' | 'calendar' | 'notes' | 'home';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    const v = fn();
    return v === undefined || v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

function todayLocalISO(d = new Date()): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function isoFromTs(ts: number): string {
  try {
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return todayLocalISO();
    return todayLocalISO(d);
  } catch {
    return todayLocalISO();
  }
}

/** Сдвиг календарного дня без UTC (локальная дата остаётся локальной). */
export function addDaysIso(iso: string, days: number): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return todayLocalISO(new Date(y, m - 1, d + days));
  } catch {
    return iso;
  }
}

export interface WidgetSyncResult {
  drainedWaterMl: number;
  /** Сколько воды сняли кнопкой «−» на виджете. */
  drainedWaterRemovedMl: number;
  drainedFoods: number;
  /** Сколько записей еды отменили кнопкой «↩» на виджете. */
  drainedFoodsRemoved: number;
  tasksToggled: number;
  /** Новые задачи, добавленные из быстрого редактора виджета. */
  tasksAdded: number;
  /** Новые заметки, добавленные из быстрого редактора виджета. */
  notesAdded: number;
  /** Подходы, записанные с виджета «Проведение тренировки». */
  setsAdded: number;
  workoutsStarted: number;
  workoutsFinished: number;
  trainingOk: boolean;
  workoutOk: boolean;
  complianceOk: boolean;
  nutritionOk: boolean;
  calendarOk: boolean;
  notesOk: boolean;
}

function collectTraining(): {
  title: string;
  subtitle: string;
  meta: string;
  progress: number;
  live: boolean;
  actionLabel: string;
  actionTarget: string;
  nextExercise: string;
  weekProgress: number;
  lastSessionDate: string;
  lastSessionVolume: number;
} {
  const last = safe(() => getLastSession(), null);
  const today = todayLocalISO();
  const week = safe(() => getSessionsByWeek(getISOWeekNumber(today)).length, 0);
  const total = safe(() => getWorkoutStats().totalSessions ?? 0, 0);
  const targetDays = weeklyTargetDays();
  const weekProgress = Math.max(0, Math.min(100, Math.round((week / Math.max(1, targetDays)) * 100)));

  // Живая сессия: прогресс по факту подходов + действие «+ Сет».
  try {
    const active = summarizeActiveSession(loadActiveSession());
    if (active) {
      return {
        title: `● Идёт · ${active.focus}`,
        subtitle: `${active.currentExercise || 'Тренировка'} · ${active.setsDone} подх.`,
        meta: `${active.volumeKg.toLocaleString()} кг · ${active.progressPct}%`,
        progress: active.progressPct,
        live: true,
        actionLabel: '+ Сет',
        actionTarget: 'training_quick',
        nextExercise: active.currentExercise || '',
        weekProgress,
        lastSessionDate: '',
        lastSessionVolume: 0,
      };
    }
  } catch {
    /* живой сессии нет — показываем историю */
  }

  if (!last) {
    return {
      title: 'Тренировка',
      subtitle: week > 0 ? `На неделе: ${week}` : 'План недели ждёт',
      meta: total > 0 ? `всего ${total}` : 'Health Engine',
      progress: 0,
      live: false,
      actionLabel: '▶ Начать',
      actionTarget: 'training_run',
      nextExercise: '',
      weekProgress,
      lastSessionDate: '',
      lastSessionVolume: 0,
    };
  }
  const vol = last.totalVolume > 0 ? ` · ${(last.totalVolume / 1000).toFixed(1)} т` : '';
  return {
    title: last.focus || 'Тренировка',
    subtitle: `${last.date} · ${ruCount(last.totalSets, RU_APPROACHES)}${vol}`,
    meta: `на неделе ${week} · всего ${total}`,
    progress: 0,
    live: false,
    actionLabel: '▶ Начать',
    actionTarget: 'training_run',
    nextExercise: '',
    weekProgress,
    lastSessionDate: last.date || '',
    lastSessionVolume: last.totalVolume || 0,
  };
}

function collectCompliance(): { pct: number; label: string; detail: string } {
  const adherence = safe(() => getAdherenceStats(), null as never);
  if (adherence && adherence.activeCount > 0) {
    return {
      pct: Math.max(0, Math.min(100, Math.round(adherence.adherence7d ?? 0))),
      label: 'Приверженность БАД · 7 дн',
      detail: `назначений: ${adherence.activeCount}`,
    };
  }
  const targetDays = weeklyTargetDays();
  const today = todayLocalISO();
  const week = safe(() => getSessionsByWeek(getISOWeekNumber(today)).length, 0);
  return {
    pct: Math.max(0, Math.min(100, Math.round((week / Math.max(1, targetDays)) * 100))),
    label: 'Тренировки недели',
    detail: `${week} из ${targetDays}`,
  };
}

/**
 * Цель недели по тренировкам — один источник для всех виджетов: число дней
 * в разрешённом плане (`he_pl_runtime.days`), иначе профильный `daysPerWeek`,
 * иначе 4. Раньше «Тренировки недели» делились на 3, а прогресс тренировочного
 * виджета — на 4, поэтому один и тот же прогресс выглядел по-разному.
 */
function weeklyTargetDays(): number {
  const plan = safe(() => resolveWorkoutPlan(todayLocalISO()), null);
  const fromPlan = Math.round(Number(plan?.planDays) || 0);
  if (fromPlan > 0) return Math.max(1, Math.min(7, fromPlan));
  const daysPerWeek = safe(() => Number((getProfile() as any)?.settings?.training?.daysPerWeek) || 0, 0);
  return Math.max(1, Math.min(7, daysPerWeek || 4));
}

/**
 * Цели дня для виджета. Источник — тот же, что у экрана «Питание»:
 * сначала ФАКТИЧЕСКИЕ цели Плана (`he_plan_kbju_targets` — ручное КБЖУ, цель,
 * фаза, профицит, ББ-заметка), иначе профильный расчёт. Раньше виджет считал
 * только по профилю, поэтому «из 2 500 ккал» и проценты колец не совпадали с
 * дневником, где цели приходят из плана (`plan-targets-bridge`).
 *
 * Вода планом не задаётся — её цель остаётся профильной (как в «Обзоре»).
 */
function collectTargets(): { kcal: number; protein: number; fats: number; carbs: number; waterMl: number } {
  const fallback = { kcal: 2500, protein: 160, fats: 70, carbs: 300, waterMl: 2500 };
  let base = fallback;
  try {
    const s = (
      safe(() => getProfile(), null as never) as unknown as {
        settings?: Record<string, Record<string, number & string>>;
      } | null
    )?.settings;
    const p = (s?.personal ?? {}) as Record<string, number & string>;
    const tr = (s?.training ?? {}) as Record<string, number & string>;
    if (p?.weight) {
      const pal = derivePAL(tr?.daysPerWeek as number | undefined, tr?.minutesPerSession as number | undefined);
      const t = calcNutrition({
        weightKg: Number(p.weight),
        heightCm: Number(p.height) || 175,
        age: Number(p.age) || 30,
        sex: (p.sex as 'male' | 'female') || 'male',
        pal,
        goal: (tr?.primaryGoal as string) || 'maintenance',
      });
      base = {
        kcal: t.kcal || fallback.kcal,
        protein: t.protein || fallback.protein,
        fats: t.fats || fallback.fats,
        carbs: t.carbs || fallback.carbs,
        waterMl: Math.round((t.water || 2.5) * 1000),
      };
    }
  } catch {
    base = fallback;
  }
  // Цели плана читаются так же, как в `macroTargets` экрана «Питание»:
  // нет опубликованного плана — остаётся профильная база.
  const plan = readPlanTargets();
  return {
    kcal: plan ? Math.round(plan.kcal) : base.kcal,
    protein: plan ? Math.round(plan.protein) : base.protein,
    fats: plan ? Math.round(plan.fats) : base.fats,
    carbs: plan ? Math.round(plan.carbs) : base.carbs,
    waterMl: base.waterMl,
  };
}

/** Границы периода для аналитики: неделя — Пн..Вс, месяц — 1..последнее число. */
function periodBounds(period: 'week' | 'month', today: string): { from: string; to: string } {
  try {
    if (period === 'week') {
      const from = addDaysIso(today, -mondayIndex(today));
      return { from, to: addDaysIso(from, 6) };
    }
    const [y, m] = today.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const mm = `${m}`.padStart(2, '0');
    return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${`${lastDay}`.padStart(2, '0')}` };
  } catch {
    return { from: today, to: today };
  }
}

/**
 * Приёмы дня в порядке дневника (Завтрак → … → Поздний перекус), а не в порядке
 * появления в JSON: иначе виджет показывал бы «Обед» раньше «Завтрака», если
 * обед записали первым. Незнакомые приёмы — в конце, в исходном порядке.
 */
function orderedMeals(meals: Record<string, unknown>): [string, any[]][] {
  const rank = (meal: string) => {
    const i = MEAL_PRESETS.indexOf(meal);
    return i < 0 ? MEAL_PRESETS.length : i;
  };
  return (Object.entries(meals) as [string, unknown][])
    .filter((entry): entry is [string, any[]] => Array.isArray(entry[1]))
    .sort((a, b) => rank(a[0]) - rank(b[0]));
}

/**
 * Порция в граммах. В дневнике `qty` бывает числом и строкой («150 г»,
 * «100,5»): `Number('150 г')` — NaN, и виджет терял вес, который дневник
 * показывает в строке. Поэтому разбираем как дневник (`qtyLabel`).
 */
function qtyGrams(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
  }
  return 0;
}

/**
 * Позиции дня для списка на виджете: порядок как в дневнике (по приёмам),
 * адрес каждой записи — `meal` + `index`. По этому адресу кнопка «✕» удаляет
 * именно эту строку, а не «последнюю вообще».
 */
function dayItems(diary: Record<string, any>, date: string): NutritionDayItem[] {
  const meals = diary?.[date]?.meals;
  if (!meals || typeof meals !== 'object') return [];
  const num = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
  const out: NutritionDayItem[] = [];
  for (const [meal, list] of orderedMeals(meals)) {
    list.forEach((item, index) => {
      if (!item || !item.name) return;
      const qty = qtyGrams(item.qty);
      const foodId = typeof item.foodId === 'string' ? item.foodId.trim().slice(0, 64) : '';
      out.push({
        name: String(item.name).slice(0, 40),
        kcal: num(item.kcal),
        p: num(item.p),
        f: num(item.f),
        c: num(item.c),
        meal: String(meal).slice(0, 32),
        index,
        ...(qty > 0 ? { qty } : {}),
        ...(foodId ? { foodId } : {}),
      });
    });
  }
  return out.slice(0, WIDGET_DAY_ITEMS_CAP);
}

/**
 * Чипы «избранное + недавние»: тап на виджете пишет блюдо в день без ввода
 * КБЖУ. Избранное идёт первым (пользователь выбрал его сам), дальше —
 * последние блюда дневника за три недели, без повторов по названию.
 */
function collectQuickFoods(diary: Record<string, any>, today: string): NutritionQuickFood[] {
  const out: NutritionQuickFood[] = [];
  const seen = new Set<string>();
  const num = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
  for (const fav of safe(() => resolveFavorites(), [])) {
    const name = String(fav.name ?? '').trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({
      name: name.slice(0, 28),
      kcal: num(fav.kcal),
      p: num(fav.protein),
      f: num(fav.fat),
      c: num(fav.carbs),
      qty: 100,
      fav: true,
      // id продукта: тап по чипу добавит именно его, а не «блюдо без продукта».
      ...(fav.id ? { foodId: String(fav.id).slice(0, 64) } : {}),
    });
    if (out.length >= 6) return out;
  }
  for (let n = 0; n < 21 && out.length < 6; n++) {
    const date = addDaysIso(today, -n);
    for (const it of dayItems(diary, date).reverse()) {
      const key = it.name.toLowerCase();
      if (seen.has(key) || it.kcal <= 0) continue;
      seen.add(key);
      out.push({
        name: it.name.slice(0, 28),
        kcal: it.kcal,
        p: it.p,
        f: it.f,
        c: it.c,
        qty: it.qty ?? 100,
        ...(it.foodId ? { foodId: it.foodId } : {}),
      });
      if (out.length >= 6) break;
    }
  }
  return out;
}

/**
 * Приёмы пищи ровно как в дневнике: пресеты плюс свои из `he_custom_meals`
 * (тот же ключ, что читает `useDiaryMealTypes`). По этому списку нативный
 * редактор еды строит чипы — иначе с виджета можно было записать только в
 * четыре приёма из девяти, а «Полдник» или свой приём попадали в «Перекус».
 */
function collectMealTypes(): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: unknown) => {
    // Не-строки в `he_custom_meals` — мусор: приёмом может быть только текст.
    if (typeof value !== 'string') return;
    const name = value.trim().slice(0, 32);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };
  MEAL_PRESETS.forEach(push);
  try {
    const raw = localStorageRef()?.getItem('he_custom_meals');
    const custom = raw ? JSON.parse(raw) : [];
    if (Array.isArray(custom)) custom.slice(0, 12).forEach(push);
  } catch {
    /* своих приёмов нет или битый JSON */
  }
  return out.slice(0, 20);
}

/** Сумма по дневнику еды + воде за диапазон дат (YYYY-MM-DD включительно). */
function sumPeriod(
  diary: Record<string, any>,
  waterLog: { date: string; amountMl: number }[],
  from: string,
  to: string,
): { kcal: number; protein: number; fat: number; carbs: number; waterMl: number; days: number; waterDays: number } {
  let kcal = 0;
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let days = 0;
  for (const [date, day] of Object.entries(diary || {})) {
    if (date < from || date > to) continue;
    const meals = (day as any)?.meals;
    if (!meals || typeof meals !== 'object') continue;
    let dayItems = 0;
    for (const items of Object.values(meals)) {
      for (const it of (items as any[]) || []) {
        kcal += Number(it?.kcal) || 0;
        protein += Number(it?.p) || 0;
        fat += Number(it?.f) || 0;
        carbs += Number(it?.c) || 0;
        dayItems += 1;
      }
    }
    if (dayItems > 0) days += 1;
  }
  let waterMl = 0;
  let waterDays = 0;
  for (const w of waterLog || []) {
    const date = String(w?.date ?? '');
    if (date < from || date > to) continue;
    const amount = Math.max(0, Number(w?.amountMl) || 0);
    if (amount > 0) waterDays += 1;
    waterMl += amount;
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs),
    waterMl,
    days,
    waterDays,
  };
}

export function collectNutrition(): {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  waterMl: number;
  targetKcal: number;
  targetProtein: number;
  targetFat: number;
  targetCarbs: number;
  waterTargetMl: number;
  /** Последняя запись еды дня — по ней виджет показывает «↩». */
  lastFood?: NutritionLastFood;
  /** Последние 7 дней: итоги и позиции — для листания дат и списка дня. */
  days: Record<string, NutritionDaySnapshot>;
  /** Чипы быстрого добавления: избранное и недавние блюда. */
  quick: NutritionQuickFood[];
  /** Приёмы пищи дневника (пресеты + свои) — чипы в нативном редакторе еды. */
  meals: string[];
  periods: {
    day: NutritionPeriodStats;
    week: NutritionPeriodStats;
    month: NutritionPeriodStats;
  };
} {
  const targets = collectTargets();
  const today = todayLocalISO();
  let diary: Record<string, any> = {};
  try {
    diary = readDiaryV2() as unknown as Record<string, any>;
  } catch {
    /* пустой дневник */
  }
  let waterLog: { date: string; amountMl: number }[] = [];
  try {
    waterLog = loadWaterLog() as unknown as { date: string; amountMl: number }[];
  } catch {
    /* нет журнала воды */
  }

  const day = sumPeriod(diary, waterLog, today, today);
  const weekRange = periodBounds('week', today);
  const monthRange = periodBounds('month', today);
  const week = sumPeriod(diary, waterLog, weekRange.from, weekRange.to);
  const month = sumPeriod(diary, waterLog, monthRange.from, monthRange.to);
  const last = lastDiaryItem(diary, today);

  // Последние 7 дней — чтобы листать дату на виджете без открытия приложения.
  const days: Record<string, NutritionDaySnapshot> = {};
  for (let n = 0; n < 7; n++) {
    const date = addDaysIso(today, -n);
    const stats = n === 0 ? day : sumPeriod(diary, waterLog, date, date);
    days[date] = {
      kcal: stats.kcal,
      p: stats.protein,
      f: stats.fat,
      c: stats.carbs,
      waterMl: stats.waterMl,
      items: dayItems(diary, date),
    };
  }

  return {
    kcal: day.kcal,
    protein: day.protein,
    fat: day.fat,
    carbs: day.carbs,
    waterMl: day.waterMl,
    targetKcal: targets.kcal,
    targetProtein: targets.protein,
    targetFat: targets.fats,
    targetCarbs: targets.carbs,
    waterTargetMl: targets.waterMl,
    days,
    quick: collectQuickFoods(diary, today),
    meals: collectMealTypes(),
    lastFood: last
      ? {
          name: String(last.item?.name ?? '').slice(0, 40),
          meal: last.meal,
          // Адрес записи: «↩» снимет именно её, а не «последнюю вообще» —
          // иначе отмена в другой приём снесла бы чужую еду.
          date: today,
          index: last.index,
          kcal: Math.max(0, Math.round(Number(last.item?.kcal) || 0)),
          protein: Math.max(0, Math.round(Number(last.item?.p) || 0)),
          fat: Math.max(0, Math.round(Number(last.item?.f) || 0)),
          carbs: Math.max(0, Math.round(Number(last.item?.c) || 0)),
          qty: qtyGrams(last.item?.qty) || undefined,
        }
      : undefined,
    periods: { day, week, month },
  };
}

/**
 * Календарь для виджета: задачи «сегодня» + просрочено. Как агенда TickTick:
 * чужие дневники не трогает, задачи берёт из того же хранилища, что и вкладка
 * «Планер» (he_coach_planner).
 *
 * Кроме личных дел календарь подхватывает график тренировок (план `he_pl_runtime`
 * + расписание из профиля), приём БАД (`he_support_plan_result` + дневник
 * `he_support_diary`) и фарму/инъекции (`he_injection_schedule` + `he_injection_diary`).
 * Нативный виджет фильтрует события по типу (чипы «Всё / Дела / Трени / БАДы / Фарма»).
 */
export type CalendarEventKind = 'task' | 'training' | 'supp' | 'pharma';

export interface CalendarEventItem {
  id: string;
  date: string;
  title: string;
  time: string;
  done: boolean;
  priority: string;
  kind: CalendarEventKind;
}

function readJsonArray(key: string): any[] {
  try {
    const raw = localStorageRef()?.getItem(key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Подпись дня плана для конкретной даты (или общая «Тренировка»). */
function planLabelForDate(
  days: any[],
  training: any,
  isoDate: string,
): { label: string; exerciseCount: number; plannedSets: number } | null {
  if (!days.length) return { label: 'Тренировка', exerciseCount: 0, plannedSets: 0 };
  const index = pickPlanDayIndex(isoDate, training, days.length);
  const day = days[index % days.length];
  if (!day) return null;
  const exercises = Array.isArray(day.exercises) ? day.exercises : [];
  const plannedSets = exercises.reduce(
    (sum: number, e: any) => sum + (Array.isArray(e?.targetSets) ? e.targetSets.length : 0),
    0,
  );
  return {
    label: String(day.label || 'Тренировка').slice(0, 40),
    exerciseCount: exercises.length,
    plannedSets,
  };
}

/** Тренировки по графику: какие дни назначены и что в них делать. */
function trainingCalendarItems(from: string, to: string, playedDates: Set<string>): CalendarEventItem[] {
  const out: CalendarEventItem[] = [];
  const training = safe(() => (getProfile() as any)?.settings?.training, null as any);
  const weekly = trainingWeekdays(training);
  if (!weekly.some(Boolean)) return out;
  const days = safe(() => {
    const runtime = JSON.parse(localStorageRef()?.getItem('he_pl_runtime') ?? 'null');
    return Array.isArray(runtime?.days) ? runtime.days.filter((d: any) => Array.isArray(d?.exercises)) : [];
  }, [] as any[]);
  const startTime =
    training?.schedule?.enabled && typeof training.schedule.startTime === 'string'
      ? String(training.schedule.startTime).slice(0, 5)
      : '';

  let iso = from;
  for (let guard = 0; guard < 400 && iso <= to; guard++) {
    if (weekly[mondayIndex(iso)]) {
      const plan = planLabelForDate(days, training, iso);
      if (plan) {
        const parts = [plan.label];
        if (plan.exerciseCount > 0) parts.push(`${plan.exerciseCount} упр.`);
        if (plan.plannedSets > 0) parts.push(`${plan.plannedSets} подх.`);
        out.push({
          id: `tr:${iso}`,
          date: iso,
          kind: 'training',
          title: parts.join(' · ').slice(0, 120),
          time: startTime,
          done: playedDates.has(iso),
          priority: 'none',
        });
      }
    }
    iso = addDaysIso(iso, 1);
  }
  return out;
}

/** Приём БАД: план из профиля + фактический дневник за прошлые дни. */
function supplementCalendarItems(today: string): CalendarEventItem[] {
  const plan = safe(() => {
    const v = JSON.parse(localStorageRef()?.getItem('he_support_plan_result') ?? '[]');
    return Array.isArray(v) ? v.filter((x: any) => typeof x === 'string') : [];
  }, [] as string[]);
  if (!plan.length) return [];
  const diary = readJsonArray('he_support_diary');
  const byDate = new Map<string, { taken: number; total: number }>();
  for (const entry of diary) {
    const date = String(entry?.date ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const subs = entry?.substances && typeof entry.substances === 'object' ? entry.substances : {};
    const keys = Object.keys(subs);
    const taken = keys.filter((k) => subs[k]?.taken).length;
    byDate.set(date, { taken, total: keys.length });
  }
  const out: CalendarEventItem[] = [];
  // Прошлое — чтобы видеть пропуски; вперёд — только неделя, иначе виджет
  // утонет в ежедневных строках «БАДы».
  for (let offset = -30; offset <= 7; offset++) {
    const date = addDaysIso(today, offset);
    const rec = byDate.get(date);
    const total = Math.max(plan.length, rec?.total ?? 0);
    const taken = rec?.taken ?? 0;
    const title = taken > 0 ? `БАДы · принято ${taken}/${total}` : `БАДы · ${plan.length} шт по плану`;
    out.push({
      id: `supp:${date}`,
      date,
      kind: 'supp',
      title: title.slice(0, 120),
      time: '',
      done: !!rec && rec.total > 0 && taken >= rec.total,
      priority: 'none',
    });
  }
  return out;
}

/** Фарма: инъекции по недельному расписанию + отметки из дневника инъекций. */
function pharmaCalendarItems(from: string, to: string): CalendarEventItem[] {
  const schedule = readJsonArray('he_injection_schedule');
  if (!schedule.length) return [];
  const diary = readJsonArray('he_injection_diary');
  const doneKeys = new Set(diary.map((e) => `${String(e?.date ?? '').slice(0, 10)}|${String(e?.substance ?? '')}`));
  const out: CalendarEventItem[] = [];
  for (const item of schedule) {
    if (!item || item.active === false) continue;
    const days = Array.isArray(item.daysOfWeek) ? item.daysOfWeek.map(Number) : [];
    if (!days.length) continue;
    const substance = String(item.substance ?? 'Инъекция').slice(0, 60);
    const dose = String(item.dose ?? '').slice(0, 20);
    let iso = from;
    for (let guard = 0; guard < 400 && iso <= to; guard++) {
      if (days.includes(mondayIndex(iso))) {
        out.push({
          id: `inj:${String(item.id ?? substance)}:${iso}`,
          date: iso,
          kind: 'pharma',
          title: `Инъекция · ${substance}${dose ? ` ${dose}` : ''}`.slice(0, 120),
          time: '',
          done: doneKeys.has(`${iso}|${substance}`),
          priority: 'high',
        });
      }
      iso = addDaysIso(iso, 1);
    }
  }
  return out;
}

export function collectCalendar(): {
  date: string;
  dateLabel: string;
  tasks: { id: string; title: string; time: string; done: boolean; priority: string; kind: string }[];
  total: number;
  done: number;
  overdue: number;
  items: CalendarEventItem[];
} {
  const today = todayLocalISO();
  let dateLabel = today;
  try {
    dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    /* подпись — удобство, дата остаётся */
  }
  const store = safe(() => readCoachPlanner(localStorageRef()), { version: 1 as const, items: [] });
  const dayTasks = safe(() => tasksForDate(store, today), []);
  const overdue = safe(() => overdueCoachTasks(store, today).length, 0);
  // Режимы «неделя»/«месяц» рисуются нативно: отдаём запас задач вокруг
  // сегодняшнего дня, чтобы листать календарь без WebView. Кап — 800 строк,
  // SharedPreferences не резиновые.
  const rangeTasks = safe(() => tasksInRange(store, addDaysIso(today, -90), addDaysIso(today, 365)), []);
  const playedDates = safe(() => new Set(loadSessions().map((s) => String(s.date ?? ''))), new Set<string>());

  const merged: CalendarEventItem[] = [];
  for (const t of rangeTasks.slice(0, 560)) {
    merged.push({
      id: t.id,
      date: t.date,
      title: String(t.title).slice(0, 120),
      time: t.time ?? '',
      done: !!t.done,
      priority: coachTaskPriority(t),
      kind: 'task',
    });
  }
  try {
    merged.push(...trainingCalendarItems(addDaysIso(today, -90), addDaysIso(today, 365), playedDates));
  } catch {
    /* график тренировок — дополнительный слой */
  }
  try {
    merged.push(...supplementCalendarItems(today));
  } catch {
    /* БАДы — дополнительный слой */
  }
  try {
    merged.push(...pharmaCalendarItems(addDaysIso(today, -90), addDaysIso(today, 365)));
  } catch {
    /* фарма — дополнительный слой */
  }
  merged.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const at = a.time || '99:99';
    const bt = b.time || '99:99';
    if (at !== bt) return at < bt ? -1 : 1;
    return a.title.localeCompare(b.title, 'ru');
  });

  return {
    date: today,
    dateLabel,
    tasks: dayTasks.slice(0, 5).map((t) => ({
      id: t.id,
      title: String(t.title).slice(0, 120),
      time: t.time ?? '',
      done: !!t.done,
      priority: coachTaskPriority(t),
      kind: 'task',
    })),
    total: dayTasks.length,
    done: dayTasks.filter((t) => t.done).length,
    overdue,
    items: merged.slice(0, 900),
  };
}

/**
 * Строки заметок для виджета: закреплённые сверху, затем свежие. Отдельной
 * функцией — чтобы состав полей можно было проверить тестом: нативная часть
 * (`NotesWidgetProvider`) читает `files` и рисует «📎».
 */
export function notesForWidget(store: CoachNotesStore): NotesWidgetSnapshot {
  // Корзина — не «заметки на сегодня»: в виджете её быть не должно,
  // иначе удалённая заметка продолжает висеть на главном экране.
  const live = store.items.filter((n) => !isCoachNoteDeleted(n));
  const sorted = safe(() => sortCoachNotes(live), []);
  return {
    notes: sorted.slice(0, 5).map((n) => {
      const p = noteChecklistProgress(n);
      const files = noteAttachments(n).length;
      return {
        id: n.id,
        // Заметка без текста, но с фото/аудио — это не «Без названия», а файл.
        title: String(n.title || n.body.split('\n')[0] || (files > 0 ? 'Заметка с фото/аудио' : 'Без названия')).slice(
          0,
          90,
        ),
        done: p.done,
        total: p.total,
        files,
      };
    }),
    total: live.length,
    pinned: live.filter((n) => n.pinned).length,
  };
}

function collectNotes() {
  const store = safe(() => readCoachNotes(localStorageRef()), { version: 1 as const, items: [] });
  return notesForWidget(store);
}

function localStorageRef(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// План тренировки дня (виджет «Проведение»)
// ═══════════════════════════════════════════════════════════════════════════

/** Один подход плана: вес/повторы/RIR из `targetSets` движка PL. */
interface PlanSetTarget {
  weight: number;
  reps: number;
  rir: number;
}

interface PlanExercise {
  name: string;
  muscleGroup: string;
  /** Дыхание: пустой массив — «по самочувствию». */
  sets: PlanSetTarget[];
  restSec: number;
}

/**
 * Разрешённый план дня: что делать сегодня.
 *
 * `he_pl_runtime` не хранит дат — только массив дней. День выбирается по
 * графику тренировок профиля (какой по счёту тренировочный день недели),
 * а если графика нет — ротацией по числу сессий на этой неделе.
 */
export interface ResolvedWorkoutPlan {
  dayIndex: number;
  label: string;
  focus: string;
  week: number;
  exercises: PlanExercise[];
  plannedSets: number;
  /** Сколько дней в плане — цель недели для прогресса виджетов. */
  planDays: number;
}

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Индекс дня недели 0=Пн..6=Вс для локальной даты YYYY-MM-DD. */
function mondayIndex(iso: string): number {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return 0;
    return (new Date(y, m - 1, d).getDay() + 6) % 7;
  } catch {
    return 0;
  }
}

/**
 * Тренировочные дни недели (Пн..Вс) — из профиля, если график включён,
 * иначе раскладка `daysPerWeek` по общепринятому шаблону.
 */
export function trainingWeekdays(training: any): boolean[] {
  const sched = training?.schedule;
  const fromList = (list: number[]) => WEEKDAY_LABELS.map((_, i) => list.includes(i));

  if (sched && sched.enabled) {
    if (sched.scheduleType === 'weekly' && Array.isArray(sched.weeklyDays) && sched.weeklyDays.length === 7) {
      return sched.weeklyDays.map((v: any) => v === true);
    }
    if (sched.scheduleType === 'eod') return fromList([0, 2, 4, 6]);
  }

  const perWeek = Math.max(1, Math.min(7, Number(training?.daysPerWeek) || 3));
  const pattern: Record<number, number[]> = {
    1: [2],
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 3, 4],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
  };
  return fromList(pattern[perWeek] || pattern[3]);
}

/** Цикл «работа/отдых» (scheduleType='pattern'): сегодня тренировочный? */
function patternTrainingToday(sched: any, iso: string): boolean {
  const work = Math.max(1, Math.min(14, Number(sched?.pattern?.work) || 2));
  const off = Math.max(0, Math.min(14, Number(sched?.pattern?.off) || 1));
  if (off === 0) return true;
  try {
    const [y, m, d] = iso.split('-').map(Number);
    const epoch = Date.UTC(2024, 0, 1);
    const dayMs = Date.UTC(y, m - 1, d) - epoch;
    const pos = ((Math.floor(dayMs / 86400000) % (work + off)) + (work + off)) % (work + off);
    return pos < work;
  } catch {
    return true;
  }
}

function rotationPlanIndex(planDays: number, iso: string): number {
  const done = safe(() => getSessionsByWeek(getISOWeekNumber(iso)).length, 0);
  return planDays > 0 ? done % planDays : 0;
}

function pickPlanDayIndex(iso: string, training: any, planDays: number): number {
  if (planDays <= 0) return 0;
  const sched = training?.schedule;
  if (sched?.enabled && sched.scheduleType === 'pattern') {
    return rotationPlanIndex(planDays, iso);
  }
  const weekly = trainingWeekdays(training);
  const positions = weekly.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (positions.length === 0) return rotationPlanIndex(planDays, iso);
  const dow = mondayIndex(iso);
  const exact = positions.indexOf(dow);
  if (exact >= 0) return exact % planDays;
  // Сегодня отдых — показываем ближайшую тренировку вперёд (по кругу).
  const next = positions.find((p) => p > dow) ?? positions[0];
  return positions.indexOf(next) % planDays;
}

/** Строка плана для одного упражнения: «4×8 · 80 кг · RIR 2». */
export function formatPlanLine(ex: PlanExercise): string {
  if (!ex.sets.length) return 'по самочувствию';
  const reps = [...new Set(ex.sets.map((s) => s.reps))].filter((r) => r > 0);
  const weights = [...new Set(ex.sets.map((s) => s.weight))].filter((w) => w > 0);
  const rirs = [...new Set(ex.sets.map((s) => s.rir))];
  const parts = [`${ex.sets.length}×${reps.length ? reps.join('/') : '—'}`];
  if (weights.length === 1) parts.push(`${weights[0]} кг`);
  else if (weights.length > 1) parts.push(`${Math.min(...weights)}–${Math.max(...weights)} кг`);
  if (rirs.length === 1) parts.push(`RIR ${rirs[0]}`);
  return parts.join(' · ');
}

function planExerciseFromRuntime(raw: any): PlanExercise {
  const sets = Array.isArray(raw?.targetSets) ? raw.targetSets : [];
  return {
    name: String(raw?.name ?? raw?.exerciseName ?? 'Упражнение').slice(0, 60),
    muscleGroup: String(raw?.muscleGroup ?? raw?.pattern ?? ''),
    sets: sets.slice(0, 12).map((s: any) => {
      const rirRaw = Number(s?.rir);
      return {
        weight: Math.max(0, Number(s?.weight) || 0),
        reps: Math.max(0, Math.min(100, Math.round(Number(s?.reps) || 0))),
        rir: Number.isFinite(rirRaw) ? Math.max(0, Math.min(20, Math.round(rirRaw))) : 2,
      };
    }),
    restSec: Math.max(0, Math.min(600, Math.round(Number(raw?.restSec ?? raw?.rest) || 0))) || 90,
  };
}

/** Прочитать `he_pl_runtime` и разрешить план на дату. */
export function resolveWorkoutPlan(dateIso = todayLocalISO()): ResolvedWorkoutPlan | null {
  const runtime = safe<{ days?: any[]; focus?: string; week?: number } | null>(
    () => JSON.parse(localStorageRef()?.getItem('he_pl_runtime') ?? 'null'),
    null,
  );
  const days = Array.isArray(runtime?.days)
    ? runtime!.days.filter((d: any) => Array.isArray(d?.exercises) && d.exercises.length > 0)
    : [];
  if (!days.length) return null;

  const training = safe(() => (getProfile() as any)?.settings?.training, null as any);
  const dayIndex = pickPlanDayIndex(dateIso, training, days.length);
  const day = days[dayIndex % days.length];
  const exercises: PlanExercise[] = (day.exercises as any[]).slice(0, 12).map(planExerciseFromRuntime);
  return {
    dayIndex,
    label: String(day.label || runtime?.focus || 'Тренировка').slice(0, 60),
    focus: String(runtime?.focus || day.label || 'Тренировка'),
    week: Math.max(1, Math.round(Number(runtime?.week) || 1)),
    exercises,
    plannedSets: exercises.reduce((s, e) => s + e.sets.length, 0),
    planDays: days.length,
  };
}

function planExerciseToSessionExercise(ex: PlanExercise) {
  return {
    id: ex.name,
    name: ex.name,
    pattern: ex.muscleGroup,
    muscleGroup: ex.muscleGroup,
  };
}

/** Живая сессия из плана: все упражнения дня уже внутри (подходов ещё нет). */
function sessionFromPlan(plan: ResolvedWorkoutPlan | null): WorkoutSession {
  const today = todayLocalISO();
  let session = startSession(plan?.label || 'Тренировка', plan?.week || getISOWeekNumber(today));
  for (const ex of plan?.exercises ?? []) {
    session = addExerciseToSession(session, planExerciseToSessionExercise(ex));
  }
  return session;
}

/** Дополнить сессию упражнениями плана, которых в ней ещё нет. */
function ensurePlanExercises(session: WorkoutSession, plan: ResolvedWorkoutPlan | null): WorkoutSession {
  if (!plan) return session;
  let next = session;
  for (const ex of plan.exercises) {
    if (!next.exercises.some((e) => e.exerciseName === ex.name)) {
      next = addExerciseToSession(next, planExerciseToSessionExercise(ex));
    }
  }
  return next;
}

/**
 * Сколько строк показывает нативный виджет «Проведение»: Android рисует
 * ROW_IDS 1..5. Больше строк мост всё равно не отобразит — лимитируем здесь,
 * чтобы снапшот не обещал шесть упражнений.
 */
export const WORKOUT_WIDGET_ROWS = 5;

/**
 * Снапшот виджета «Проведение тренировки»: упражнения назначенной сессии.
 * Приоритет — живая сессия; иначе план дня с нулевым прогрессом.
 */
export function collectWorkout(): WorkoutWidgetSnapshot {
  const today = todayLocalISO();
  const plan = safe(() => resolveWorkoutPlan(today), null);
  const active = safe(() => loadActiveSession(), null);
  const exercises: WorkoutWidgetExercise[] = [];
  const seen = new Set<string>();

  const pushExercise = (planEx: PlanExercise | null, sessionEx: WorkoutSession['exercises'][number] | null) => {
    const name = String(planEx?.name ?? sessionEx?.exerciseName ?? 'Упражнение').slice(0, 60);
    if (seen.has(name)) return;
    seen.add(name);
    const sets = sessionEx?.sets ?? [];
    const last = sets.length ? sets[sets.length - 1] : null;
    const firstTarget = planEx?.sets[0] ?? null;
    exercises.push({
      name,
      plan: planEx ? formatPlanLine(planEx) : 'вне плана',
      done: sets.length,
      planned: planEx?.sets.length ?? sets.length,
      weight: Math.max(0, Math.round(Number(last?.weightKg ?? firstTarget?.weight ?? 0))),
      reps: Math.max(0, Math.round(Number(last?.reps ?? firstTarget?.reps ?? 0))),
      rir: Math.max(0, Math.round(Number(last?.rir ?? firstTarget?.rir ?? 0))),
      restSec: planEx?.restSec ?? 90,
    });
  };

  for (const planEx of plan?.exercises ?? []) {
    const sessionEx = active?.exercises.find((e) => e.exerciseName === planEx.name) ?? null;
    pushExercise(planEx, sessionEx);
  }
  for (const sessionEx of active?.exercises ?? []) {
    pushExercise(null, sessionEx);
  }

  const setsDone = Math.max(0, Number(active?.totalSets) || 0);
  const setsPlanned = Math.max(plan?.plannedSets ?? 0, Number(active?.plannedSetsTotal) || 0, setsDone);
  const volumeKg = Math.max(0, Math.round(Number(active?.totalVolume) || 0));
  const progress =
    setsPlanned > 0 ? Math.max(0, Math.min(100, Math.round((setsDone / setsPlanned) * 100))) : setsDone > 0 ? 100 : 0;

  const live = !!active;
  const titleBase = plan?.label || active?.focus || 'Тренировка';
  const title = live ? `● ${titleBase}` : titleBase;
  const subtitle =
    !plan && !active
      ? 'План не найден — откройте Тренировку'
      : live
        ? `${setsDone}/${setsPlanned} ${ruCount(setsPlanned, RU_APPROACHES)} · ${volumeKg} кг`
        : `${exercises.length} упр. · ${setsPlanned} ${ruCount(setsPlanned, RU_APPROACHES)}`;

  return {
    title,
    subtitle,
    live,
    startedAt: active?.startTime ?? '',
    setsDone,
    setsPlanned,
    volumeKg,
    progress,
    dayIndex: plan?.dayIndex ?? 0,
    exercises: exercises.slice(0, WORKOUT_WIDGET_ROWS),
  };
}

/**
 * Только виджет «Проведение» — дешёвое обновление во время сессии (APK):
 * пересобирает ТОЛЬКО workout-снапшот и синкает его. Параллельные вызовы
 * (подход → автосейв → событие, плюс возврат из фона) не гоняются: пока
 * предыдущий синк в полёте, новый возвращает false. Исключения не вылетают —
 * виджет необязательный слой.
 */
let workoutWidgetPushInFlight = false;
export async function pushWorkoutWidget(): Promise<boolean> {
  if (workoutWidgetPushInFlight) return false;
  workoutWidgetPushInFlight = true;
  try {
    return await syncWorkoutWidget(collectWorkout());
  } catch {
    return false;
  } finally {
    workoutWidgetPushInFlight = false;
  }
}

/** Порядок применения: 0 — создание сущности, 1 — всё остальное. */
function addRank(item: { type?: string } | null | undefined): number {
  const type = item?.type;
  return type === 'task_add' || type === 'note_add' ? 0 : 1;
}

/**
 * Приёмы пищи в дневнике — русские подписи («Завтрак», «Обед»…), а нативные
 * виджеты и старые очереди присылают английские ключи. Приводим к дневнику,
 * иначе блюдо падает в невидимую секцию.
 */
export function normalizeMealKey(raw?: string | null): string {
  const v = String(raw ?? '').trim();
  const lower = v.toLowerCase();
  if (lower === 'breakfast' || v === 'Завтрак') return 'Завтрак';
  if (lower === 'lunch' || v === 'Обед') return 'Обед';
  if (lower === 'dinner' || v === 'Ужин') return 'Ужин';
  if (lower === 'snack' || v === 'Перекус') return 'Перекус';
  return v ? v.slice(0, 32) : 'Перекус';
}

/**
 * Последняя по порядку запись дня: последний элемент последнего непустого
 * приёма. Один выбор для двух задач — что показать в `lastFood` и что снять
 * кнопкой «↩», иначе виджет мог бы «отменить» не то, что обещал.
 */
function lastDiaryItem(diary: Record<string, any>, date: string): { meal: string; index: number; item: any } | null {
  const meals = diary?.[date]?.meals;
  if (!meals || typeof meals !== 'object') return null;
  let found: { meal: string; index: number; item: any } | null = null;
  for (const [meal, items] of orderedMeals(meals)) {
    if (items.length === 0) continue;
    const index = items.length - 1;
    found = { meal, index, item: items[index] };
  }
  return found;
}

/**
 * Применить очередь виджета к журналам: вода -> he_water_log,
 * еда -> nutrition_diary_v2 в день из метки времени,
 * задача -> статус «сделано» в планшете (he_coach_planner).
 */
/**
 * Плеер тренировки, смонтированный в приложении, — единственный писатель `he_workout_active_v1`.
 * Пока он открыт, подходы из виджета не пишутся в хранилище напрямую (следующий автосейв плеера
 * затёр бы их), а уходят плееру событием `he-workout-widget-set`.
 */
let workoutPlayerActive = false;
export function setWorkoutPlayerActive(active: boolean): void {
  workoutPlayerActive = active;
}
const playerActive = (): boolean => workoutPlayerActive && typeof window !== 'undefined';

export function applyWidgetQueue(items: QueuedItem[]): {
  waterMl: number;
  /** Снятая вода («−250» на виджете) — сколько реально убрали. */
  waterRemovedMl: number;
  foods: number;
  /** Отменённые записи еды («↩» на виджете). */
  foodsRemoved: number;
  /** Правки порции записи (тап по строке списка дня на виджете). */
  foodsEdited: number;
  tasks: number;
  tasksAdded: number;
  notesAdded: number;
  /** Подходы, записанные из виджета «Проведение». */
  setsAdded: number;
  workoutsStarted: number;
  workoutsFinished: number;
} {
  let waterMl = 0;
  let waterRemovedMl = 0;
  let foods = 0;
  let foodsRemoved = 0;
  let foodsEdited = 0;
  let tasks = 0;
  let tasksAdded = 0;
  let notesAdded = 0;
  let setsAdded = 0;
  let workoutsStarted = 0;
  let workoutsFinished = 0;
  // Сначала создаём быстрые задачи/заметки, потом применяем остальное:
  // иначе отметка «сделано» у только что добавленной с виджета задачи
  // пришла бы раньше создания и потерялась бы.
  const ordered = [...items].sort((a, b) => addRank(a) - addRank(b));
  for (const it of ordered) {
    try {
      if (it.type === 'water') {
        const ml = Math.max(0, Math.min(2000, Math.round(it.ml ?? 0)));
        if (ml > 0) {
          addWater(ml);
          waterMl += ml;
        }
      } else if (it.type === 'water_remove') {
        // «−250 мл» на виджете: снимаем с записи за сегодня, ниже нуля не идём.
        const ml = Math.max(0, Math.min(2000, Math.round(it.ml ?? 0)));
        if (ml > 0) {
          const today = todayLocalISO();
          const before =
            (loadWaterLog() as { date: string; amountMl: number }[]).find((e) => e.date === today)?.amountMl ?? 0;
          removeWater(ml);
          const after =
            (loadWaterLog() as { date: string; amountMl: number }[]).find((e) => e.date === today)?.amountMl ?? 0;
          waterRemovedMl += Math.max(0, before - after);
        }
      } else if (it.type === 'food' && it.name) {
        const date = isoFromTs(it.ts || Date.now());
        const diary = readDiaryV2();
        const day = diary[date] ?? { meals: {} };
        const meal = normalizeMealKey(it.meal);
        const list = [...(day.meals[meal] ?? [])];
        // Порция из нативного редактора: пустое/битое значение = 100 г, как в
        // дневнике. `Math.max(1, 0)` давал «1 г» — запись выглядела опечаткой.
        const qty = Math.round(Number(it.qty) || 0);
        // id продукта из каталога: дневник по нему узнаёт продукт (избранное,
        // состав, «полезность»), поэтому не теряем его по пути с виджета.
        const foodId = typeof it.foodId === 'string' ? it.foodId.trim().slice(0, 64) : '';
        list.push({
          name: String(it.name).slice(0, 120),
          kcal: Math.max(0, Math.round(it.kcal ?? 0)),
          p: Math.max(0, Math.round(it.p ?? 0)),
          f: Math.max(0, Math.round(it.f ?? 0)),
          c: Math.max(0, Math.round(it.c ?? 0)),
          qty: qty > 0 ? Math.min(5000, qty) : 100,
          ...(foodId ? { foodId } : {}),
        });
        writeDiaryV2({ ...diary, [date]: { meals: { ...day.meals, [meal]: list } } });
        foods += 1;
      } else if (it.type === 'food_remove') {
        // Два режима: «✕» в списке дня приходит с адресом записи
        // (дата + приём + индекс), «↩» без адреса снимает последнюю запись дня —
        // ровно ту, что виджет показывал в `lastFood`.
        const explicit = typeof it.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.date);
        const date = explicit ? String(it.date) : isoFromTs(it.ts || Date.now());
        const diary = readDiaryV2();
        const day = diary[date] ?? { meals: {} };
        const meals: Record<string, any[]> = { ...((day.meals as Record<string, any[]>) ?? {}) };
        const askedMeal = it.meal ? normalizeMealKey(it.meal) : '';
        const askedIndex = Number.isInteger(it.index) ? Number(it.index) : -1;
        const addressed = askedMeal !== '' && askedIndex >= 0;
        // Адрес есть — удаляем строго по нему. Если он не сошёлся (дневник уже
        // другой), лучше не трогать ничего: фолбэк на «последнюю» снёс бы чужую еду.
        const targeted = addressed
          ? Array.isArray(meals[askedMeal]) && askedIndex < meals[askedMeal].length
            ? { meal: askedMeal, index: askedIndex }
            : null
          : lastDiaryItem(diary, date);
        if (targeted) {
          const list = [...((meals[targeted.meal] as any[]) ?? [])];
          if (targeted.index < list.length) {
            list.splice(targeted.index, 1);
            if (list.length > 0) meals[targeted.meal] = list;
            else delete meals[targeted.meal];
            writeDiaryV2({ ...diary, [date]: { ...day, meals } });
            foodsRemoved += 1;
          }
        }
      } else if (it.type === 'food_qty') {
        // Правка порции с виджета (тап по строке списка дня). Адрес обязателен:
        // дата + приём + индекс. Если он не сошёлся с дневником, не правим
        // ничего — лучше не применить правку, чем испортить чужую запись.
        const date = typeof it.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.date) ? it.date : '';
        const meal = it.meal ? normalizeMealKey(it.meal) : '';
        const index = Number.isInteger(it.index) ? Number(it.index) : -1;
        const qty = Math.round(Number(it.qty) || 0);
        if (date && meal && index >= 0 && qty > 0) {
          const diary = readDiaryV2();
          const list = diary[date]?.meals?.[meal];
          const current = Array.isArray(list) ? list[index] : null;
          if (current) {
            const nextList = [...(list as any[])];
            // Тот же пересчёт, что в диалоге порции дневника: КБЖУ, микро и
            // состав рецепта пропорционально, остальные поля не трогаем.
            nextList[index] = withDiaryItemQty(current, Math.min(5000, qty));
            writeDiaryV2({
              ...diary,
              [date]: { ...diary[date], meals: { ...diary[date].meals, [meal]: nextList } },
            });
            foodsEdited += 1;
          }
        }
      } else if (it.type === 'task' && it.id) {
        const storage = localStorageRef();
        const store = readCoachPlanner(storage);
        const next = updateCoachTask(store, String(it.id), { done: it.done === true });
        if (next !== store) {
          writeCoachPlanner(storage, next);
          tasks += 1;
        }
      } else if (it.type === 'task_add' && it.title) {
        // Быстрый редактор виджета: задача создаётся без открытия приложения,
        // id пришёл с нативной стороны — повторный drain не плодит дубли.
        const storage = localStorageRef();
        const store = readCoachPlanner(storage);
        const res = addCoachTask(
          store,
          {
            title: it.title,
            date: it.date,
            time: it.time ?? null,
            priority: (it.priority as 'none' | 'low' | 'medium' | 'high' | undefined) ?? 'none',
            list: 'inbox',
          },
          {
            id: it.id,
            now: it.ts ? new Date(it.ts).toISOString() : undefined,
          },
        );
        if (res.task) {
          writeCoachPlanner(storage, res.store);
          tasksAdded += 1;
        }
      } else if (it.type === 'note_add' && (it.title || it.body || it.checklist?.length)) {
        const storage = localStorageRef();
        const store = readCoachNotes(storage);
        const res = addCoachNote(
          store,
          {
            title: it.title,
            body: it.body,
            checklist: it.checklist?.map((c, i) => ({
              id: c.id || `c_${i + 1}`,
              text: c.text,
              done: c.done === true,
            })),
          },
          {
            id: it.id,
            now: it.ts ? new Date(it.ts).toISOString() : undefined,
          },
        );
        if (res.note) {
          writeCoachNotes(storage, res.store);
          notesAdded += 1;
        }
      } else if (it.type === 'workout_start') {
        const plan = safe(() => resolveWorkoutPlan(todayLocalISO()), null);
        const current = loadActiveSession();
        if (!current) {
          if (saveActiveSession(sessionFromPlan(plan), plan?.plannedSets)) workoutsStarted += 1;
        } else {
          // Сессия уже идёт: ничего не начинаем, только дополняем планом дня.
          saveActiveSession(ensurePlanExercises(current, plan), plan?.plannedSets);
        }
      } else if (it.type === 'workout_finish') {
        // Плеер открыт — завершить сессию целиком умеет только он (длительность, sRPE,
        // RIR-калибровка, заминка). Просим плеер; не обработал — завершаем сами.
        if (playerActive()) {
          const relay = { handled: false };
          try {
            window.dispatchEvent(new CustomEvent('he-workout-finish-request', { detail: relay }));
          } catch {
            /* noop */
          }
          if (relay.handled) {
            workoutsFinished += 1;
            continue;
          }
        }
        const active = loadActiveSession();
        if (active) {
          finishSession(active);
          clearActiveSession();
          workoutsFinished += 1;
          // Плеер держит эту сессию в состоянии — сообщаем ему, чтобы он не завершил её повторно.
          try {
            window.dispatchEvent(new Event('he-workout-close'));
          } catch {
            /* noop */
          }
        }
      } else if (it.type === 'set_add' && it.exerciseName) {
        const name = String(it.exerciseName).slice(0, 60);
        const plan = safe(() => resolveWorkoutPlan(todayLocalISO()), null);
        const base = loadActiveSession();
        let session = base ? ensurePlanExercises(base, plan) : sessionFromPlan(plan);
        let index = session.exercises.findIndex((e) => e.exerciseName === name);
        if (index < 0) {
          // Подход по упражнению не из плана дня (или вовсе без плана) раньше
          // молча терялся. Добавляем упражнение в сессию из данных очереди:
          // запись подхода проверит logSet, при отказе ничего не сохраняем.
          session = addExerciseToSession(session, {
            id: name,
            name,
            pattern: '',
            muscleGroup: '',
          });
          index = session.exercises.length - 1;
        }
        if (index >= 0) {
          // Плеер открыт — он единственный писатель. Передаём подход ему, иначе его автосейв
          // перезапишет активную сессию без только что добавленных виджетных подходов.
          if (playerActive()) {
            const relay = {
              exerciseName: name,
              weight: Number(it.weight) || 0,
              reps: Number(it.reps) || 0,
              rir: Number(it.rir),
              rpe: Number(it.rpe),
              technique: it.technique,
              notes: it.notes,
              pause: it.pause === true,
              handled: false,
            };
            try {
              window.dispatchEvent(new CustomEvent('he-workout-widget-set', { detail: relay }));
            } catch {
              /* noop */
            }
            if (relay.handled) {
              setsAdded += 1;
              if (!base) workoutsStarted += 1;
              continue;
            }
          }
          const weight = Math.max(0, Math.min(500, Number(it.weight) || 0));
          const reps = Math.max(0, Math.min(100, Math.round(Number(it.reps) || 0)));
          // RPE/RIR — только измеренное: отсутствующий RIR раньше превращался в 0, а из него
          // синтезировался RPE 10, и подход без оценки уезжал в нагрузку как максимальный.
          const rirRaw = Number(it.rir);
          const rir = Number.isFinite(rirRaw) && rirRaw > 0 ? Math.min(20, Math.round(rirRaw)) : 0;
          const rpeRaw = Number(it.rpe);
          const rpe =
            Number.isFinite(rpeRaw) && rpeRaw > 0
              ? Math.max(0, Math.min(10, Math.round(rpeRaw * 10) / 10))
              : rir > 0
                ? Math.max(0, 10 - rir)
                : 0;
          const techniqueRaw = Number(it.technique);
          const techniqueScore =
            Number.isFinite(techniqueRaw) && techniqueRaw >= 3 && techniqueRaw <= 5
              ? Math.round(techniqueRaw)
              : undefined;
          const prevSets = session.exercises[index].sets || [];
          const nextSetNumber = prevSets.reduce((m, s) => Math.max(m, Number(s.setNumber) || 0), 0) + 1;
          // Вес 0 — «свой вес» только для упражнений без отягощения (турник/брусья/отжимания).
          // Для штанги/тренажёра такой подход должен быть отклонён, а не записан с тоннажем 0.
          const bodyweight = weight <= 0 && isBodyweightExercise({ name });
          const res = logSet(session, index, {
            setNumber: nextSetNumber,
            weightKg: weight,
            bodyweight,
            reps,
            rpe,
            rir,
            notes: String(it.notes ?? '').slice(0, 200),
            techniqueScore,
            pause: it.pause === true,
            plannedWeight: Number(it.weight) || undefined,
          });
          if (res.success) {
            saveActiveSession(res.session, plan?.plannedSets);
            setsAdded += 1;
            // Первый подход с рабочего стола сам запускает сессию.
            if (!base) workoutsStarted += 1;
          }
        }
      }
    } catch {
      /* один битый элемент не роняет остальные */
    }
  }
  return {
    waterMl,
    waterRemovedMl,
    foods,
    foodsRemoved,
    foodsEdited,
    tasks,
    tasksAdded,
    notesAdded,
    setsAdded,
    workoutsStarted,
    workoutsFinished,
  };
}

/** Только виджет тренировки — живой прогресс во время проведения (APK). */
export async function pushTrainingWidget(): Promise<boolean> {
  try {
    return await syncTrainingWidget(collectTraining());
  } catch {
    return false;
  }
}

/**
 * Полный цикл: забрать очередь -> применить -> запушить свежие снапшоты.
 * Безопасен везде; вне native виджеты просто не обновятся.
 */
/** Компактный каталог продуктов для поиска на виджете (строится один раз). */
let foodCatalogCache: NutritionFoodItem[] | null = null;
function foodCatalog(): NutritionFoodItem[] {
  if (foodCatalogCache) return foodCatalogCache;
  const num = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
  foodCatalogCache = (FOOD_DB as any[])
    .filter((f) => f && f.name && num(f.kcal) > 0)
    .map((f) => ({
      // id нужен, чтобы запись с виджета дневник узнавал как тот же продукт.
      ...(f.id ? { id: String(f.id).slice(0, 64) } : {}),
      name: String(f.name).slice(0, 48),
      kcal: num(f.kcal),
      p: num(f.protein),
      f: num(f.fat),
      c: num(f.carbs),
    }));
  return foodCatalogCache;
}

export async function syncAllWidgets(): Promise<WidgetSyncResult> {
  let drainedWaterMl = 0;
  let drainedWaterRemovedMl = 0;
  let drainedFoods = 0;
  let drainedFoodsRemoved = 0;
  let tasksToggled = 0;
  let tasksAdded = 0;
  let notesAdded = 0;
  let setsAdded = 0;
  let workoutsStarted = 0;
  let workoutsFinished = 0;
  try {
    const items = await drainWidgetQueue();
    if (items.length > 0) {
      const applied = applyWidgetQueue(items);
      drainedWaterMl = applied.waterMl;
      drainedWaterRemovedMl = applied.waterRemovedMl;
      drainedFoods = applied.foods;
      drainedFoodsRemoved = applied.foodsRemoved;
      tasksToggled = applied.tasks;
      tasksAdded = applied.tasksAdded;
      notesAdded = applied.notesAdded;
      setsAdded = applied.setsAdded;
      workoutsStarted = applied.workoutsStarted;
      workoutsFinished = applied.workoutsFinished;
    }
  } catch {
    /* очередь недоступна */
  }
  const t = collectTraining();
  const wo = collectWorkout();
  const c = collectCompliance();
  const n = collectNutrition();
  const cal = collectCalendar();
  const nt = collectNotes();
  const [trainingOk, workoutOk, complianceOk, nutritionOk, calendarOk, notesOk] = await Promise.all([
    syncTrainingWidget(t).catch(() => false),
    syncWorkoutWidget(wo).catch(() => false),
    syncComplianceWidget(c).catch(() => false),
    syncNutritionWidget({
      kcal: n.kcal,
      targetKcal: n.targetKcal,
      protein: n.protein,
      fat: n.fat,
      carbs: n.carbs,
      targetProtein: n.targetProtein,
      targetFat: n.targetFat,
      targetCarbs: n.targetCarbs,
      waterMl: n.waterMl,
      waterTargetMl: n.waterTargetMl,
      lastFood: n.lastFood,
      days: n.days,
      quick: n.quick,
      meals: n.meals,
      periods: n.periods,
    }).catch(() => false),
    syncCalendarWidget(cal).catch(() => false),
    syncNotesWidget(nt).catch(() => false),
  ]);
  // Каталог продуктов для поиска в нативном редакторе еды: уходит один раз на
  // версию FOOD_DB (иначе каждый синк гонял бы ~700 позиций через мост).
  void pushNutritionFoods(foodCatalog(), nutritionFoodsVersion(foodCatalog())).catch(() => false);
  return {
    drainedWaterMl,
    drainedWaterRemovedMl,
    drainedFoods,
    drainedFoodsRemoved,
    tasksToggled,
    tasksAdded,
    notesAdded,
    setsAdded,
    workoutsStarted,
    workoutsFinished,
    trainingOk,
    workoutOk,
    complianceOk,
    nutritionOk,
    calendarOk,
    notesOk,
  };
}

/**
 * Держит виджеты в согласии с приложением в тот же момент, а не только при
 * следующем возврате в приложение: подписывается на правки дневника питания
 * (`writeDiaryV2` → слушатели) и на публикацию целей Плана и пере-пушивает
 * снапшоты с дебаунсом (правка дня — это десятки записей подряд).
 *
 * Без этого цифры на столе отставали: пользователь добавлял еду, сворачивал
 * приложение — а виджет показывал прежние КБЖУ до следующего открытия.
 *
 * Возвращает функцию отписки.
 */
export function watchNutritionForWidgets(delayMs = 1200): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void syncAllWidgets().catch(() => {
        /* виджеты — необязательный слой */
      });
    }, delayMs);
  };
  const offDiary = onDiaryChangeV2(schedule);
  try {
    window.addEventListener(PLAN_TARGETS_EVENT, schedule);
  } catch {
    /* SSR/jsdom без window — молча */
  }
  return () => {
    if (timer) clearTimeout(timer);
    offDiary();
    try {
      window.removeEventListener(PLAN_TARGETS_EVENT, schedule);
    } catch {
      /* ignore */
    }
  };
}
