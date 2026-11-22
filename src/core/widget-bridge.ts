/**
 * widget-bridge.ts — JS-фасад homescreen-виджетов APK.
 *
 * Контракт как у native-bridge: безопасен на ЛЮБОЙ платформе.
 * - native (APK): Capacitor-плагин WidgetBridge (SharedPreferences + AppWidgetManager);
 * - telegram/web: виджетов нет — вызовы молча уходят в localStorage-фолбэк
 *   (очередь и снапшоты продолжают работать для тестов/логики, UI их не показывает).
 *
 * Telegram Mini App поведением не меняется: ни один вызов не бросает наружу.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

export type WidgetKind = 'training' | 'workout' | 'timer' | 'compliance' | 'nutrition' | 'nutrition_panel' | 'water' | 'calendar' | 'notes';
export type WidgetTarget =
  | 'training'
  | 'training_run'
  | 'training_quick'
  | 'nutrition'
  | 'nutrition_scan'
  | 'nutrition_photo'
  | 'support'
  | 'calendar'
  | 'notes'
  | 'home';
export type TimerAction = 'preset' | 'start' | 'pause' | 'toggle' | 'reset';

export interface QueuedItem {
  type:
    | 'water'
    | 'water_remove'
    | 'food'
    | 'food_remove'
    | 'task'
    | 'task_add'
    | 'note_add'
    | 'set_add'
    | 'workout_start'
    | 'workout_finish';
  ml?: number;
  name?: string;
  kcal?: number;
  p?: number;
  f?: number;
  c?: number;
  meal?: string;
  /** Порция, г (необязательно; по умолчанию 100 — как в дневнике). */
  qty?: number;
  /**
   * id продукта из `FOOD_DB` (для type='food'): без него запись, добавленная с
   * виджета, выглядела в дневнике как блюдо без продукта — избранное, состав и
   * «полезность» такой записи не узнавали.
   */
  foodId?: string;
  /** Для type='food_remove': позиция внутри приёма (кнопка «✕» на виджете). */
  index?: number;
  /** Для type='food_remove' («✕» на виджете) и type='task_add': ISO-дата дня. */
  date?: string;
  /* --- Подход из виджета «Проведение» (type='set_add') --- */
  /** Упражнение, к которому относится подход (имя из плана/живой сессии). */
  exerciseName?: string;
  weight?: number;
  reps?: number;
  rpe?: number;
  rir?: number;
  /** Оценка техники 3/4/5 (как в проведении тренировки). */
  technique?: number;
  /** Пауза на груди (жим, IPF-стиль). */
  pause?: boolean;
  notes?: string;
  /** Для type='task': id задачи и её новое состояние «сделано». */
  id?: string;
  done?: boolean;
  /** Для type='task_add': дата (то же поле `date` выше), время HH:MM и приоритет. */
  time?: string | null;
  priority?: string;
  /** Для type='task_add' / 'note_add': заголовок быстрого добавления. */
  title?: string;
  /** Для type='note_add': текст заметки. */
  body?: string;
  /** Для type='note_add': пункты чек-листа из быстрого редактора. */
  checklist?: { id: string; text: string; done?: boolean }[];
  ts: number;
}

export interface TimerState {
  running: boolean;
  remainingSec: number;
  durationSec: number;
}

/**
 * Агрегат питания за период (день / неделя / месяц) для виджета аналитики.
 *
 * `days` — сколько дней периода реально содержат записи еды: это знаменатель
 * среднего «в день». Пустые дни не разбавляют среднее нулями, иначе неделя с
 * одной записью показывала бы «средне 300 ккал» вместо честного «один день».
 */
export interface NutritionPeriodStats {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  waterMl: number;
  /** Дней с записями еды в периоде. */
  days: number;
  /** Дней с записью воды в периоде. */
  waterDays: number;
}

/** Последняя запись еды дня — источник для кнопки «↩» на виджете «Питание». */
export interface NutritionLastFood {
  name: string;
  /** Подпись приёма пищи, как в дневнике (Завтрак/Обед/Ужин/Перекус). */
  meal: string;
  /** ISO-дата дня записи: «↩» снимает запись именно этого дня. */
  date?: string;
  /** Позиция внутри приёма — точный адрес записи для отмены. */
  index?: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  /** Порция, г. */
  qty?: number;
}

/**
 * Сколько позиций дня попадает в снапшот (и в список на виджете).
 *
 * Дневник показывает все записи. Прежний предел 20 молча отрезал хвост дня:
 * у тех, кто пишет по 10–12 позиций за приём, 21-я запись (обычно новые блюда
 * ужина) пропадала из виджета, оставаясь в дневнике. 50 — с запасом, при этом
 * снапшот остаётся компактным (7 дней × 50 строк).
 */
export const WIDGET_DAY_ITEMS_CAP = 50;

/**
 * Позиция дня для списка на виджете «Питание».
 *
 * `meal` + `index` — адрес записи в `nutrition_diary_v2` (массив приёма), по
 * нему кнопка «✕» удаляет именно эту строку, а не «последнюю вообще».
 */
export interface NutritionDayItem {
  name: string;
  kcal: number;
  /** Белки, г (порции). */
  p: number;
  /** Жиры, г. */
  f: number;
  /** Углеводы, г. */
  c: number;
  meal: string;
  index: number;
  /** Порция, г. */
  qty?: number;
  /** id продукта в `FOOD_DB`: чип «недавнее» кладёт его в очередь `food`. */
  foodId?: string;
}

/** День дневника для виджета: итоги и позиции (список + листание дат). */
export interface NutritionDaySnapshot {
  kcal: number;
  p: number;
  f: number;
  c: number;
  waterMl: number;
  items: NutritionDayItem[];
}

/** Блюдо для чипа «недавние / избранное»: тап = запись без ввода КБЖУ. */
export interface NutritionQuickFood {
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  /** Порция, г (по умолчанию 100 — как в дневнике). */
  qty?: number;
  meal?: string;
  /** id продукта в `FOOD_DB`: тап по чипу добавляет продукт, а не безымянное блюдо. */
  foodId?: string;
  /** true — из избранного (⭐), false — из недавних записей. */
  fav?: boolean;
}

/**
 * Снапшот дня для homescreen-виджета «Питание» (как сводка FatSecret):
 * остаток калорий, Б/Ж/У и вода — факт и цель.
 */
export interface NutritionWidgetSnapshot {
  kcal: number;
  targetKcal: number;
  protein: number;
  fat: number;
  carbs: number;
  targetProtein: number;
  targetFat: number;
  targetCarbs: number;
  waterMl: number;
  waterTargetMl: number;
  /**
   * Последняя запись еды за сегодня. Виджет показывает по ней кнопку «↩»:
   * отменить ошибочную порцию можно, не открывая приложение. После отмены
   * JS пересоберёт снапшот и подставит предыдущую запись.
   */
  lastFood?: NutritionLastFood;
  /**
   * Последние дни дневника (сегодня и до 6 назад), ключ — ISO-дата. Виджет
   * листает дату «‹ ›», не открывая приложение, и берёт итоги/позиции отсюда.
   */
  days?: Record<string, NutritionDaySnapshot>;
  /** Чипы быстрого добавления: избранное и недавние блюда. */
  quick?: NutritionQuickFood[];
  /**
   * Приёмы пищи дневника: пресеты и свои (`he_custom_meals`). Нативный
   * редактор еды строит по ним чипы — иначе выбор ограничен четырьмя
   * приёмами, а «Полдник» или свой приём записать с виджета нельзя.
   */
  meals?: string[];
  /**
   * Готовые агрегаты за день/неделю/месяц: нативный виджет переключает период
   * (и настраивает halves двойного виджета) без обращения к WebView.
   */
  periods?: {
    day: NutritionPeriodStats;
    week: NutritionPeriodStats;
    month: NutritionPeriodStats;
  };
}

/** Задача для виджета «Календарь» (агенда дня, как в TickTick). */
export interface CalendarWidgetTask {
  id: string;
  title: string;
  /** HH:MM или пусто. */
  time: string;
  done: boolean;
  /** none|low|medium|high — для точки приоритета. */
  priority: string;
  /**
   * Тип события: task (личное дело), training (тренировка по графику),
   * supp (приём БАД), pharma (фарма/инъекция). Неизвестное → task.
   */
  kind?: string;
}

/**
 * Задача широкого диапазона для режимов «неделя»/«месяц»: виджет рисует
 * календарь без WebView, поэтому дата едет вместе с задачей.
 */
export interface CalendarWidgetItem extends CalendarWidgetTask {
  /** YYYY-MM-DD локальная дата задачи. */
  date: string;
}

export interface CalendarWidgetSnapshot {
  /** YYYY-MM-DD локальная дата дня. */
  date: string;
  /** Человеческая подпись: «сб, 7 нояб.». */
  dateLabel: string;
  tasks: CalendarWidgetTask[];
  /** Всего задач на день (может быть больше, чем поместилось в tasks). */
  total: number;
  done: number;
  /** Просроченных задач (до сегодня, не закрыты). */
  overdue: number;
  /**
   * Задачи вокруг сегодняшнего дня (прошлое+будущее) для переключения
   * «день / неделя / месяц» прямо на рабочем столе. Опционально — старые
   * снапшоты без items продолжают работать.
   */
  items?: CalendarWidgetItem[];
}

/** Заметка для виджета «Заметки». */
export interface NotesWidgetNote {
  id: string;
  title: string;
  /** Прогресс чек-листа: сколько пунктов выполнено. */
  done: number;
  total: number;
  /**
   * Сколько у заметки файлов (фото/аудио). Нативная часть рисует по этому полю
   * «📎» — без него значок молча пропадёт, ошибки не будет.
   */
  files: number;
}

export interface NotesWidgetSnapshot {
  notes: NotesWidgetNote[];
  total: number;
  pinned: number;
}

/** Упражнение дня для виджета «Проведение тренировки». */
export interface WorkoutWidgetExercise {
  name: string;
  /** План строкой: «4×8 · 80 кг · RIR 2». */
  plan: string;
  /** Сколько подходов уже записано. */
  done: number;
  /** Сколько подходов в плане. */
  planned: number;
  /** Вес/повторы/RIR для подстановки в диалог (последний сет или план). */
  weight: number;
  reps: number;
  rir: number;
  /** Отдых между подходами, сек. */
  restSec: number;
}

/**
 * Снапшот «проведения тренировки»: упражнения назначенной на сегодня сессии
 * и прогресс подходов. Заполняется из живой сессии, а если её нет — из плана
 * дня (`he_pl_runtime`) по графику тренировок профиля.
 */
export interface WorkoutWidgetSnapshot {
  title: string;
  subtitle: string;
  /** Живая сессия: кнопка меняется на «Завершить». */
  live: boolean;
  /** Время начала живой сессии, HH:MM. */
  startedAt: string;
  setsDone: number;
  setsPlanned: number;
  volumeKg: number;
  progress: number;
  /** Индекс дня плана: по нему JS восстанавливает упражнения при записи сета. */
  dayIndex: number;
  exercises: WorkoutWidgetExercise[];
}

interface WidgetBridgeNative {
  syncTraining(o: {
    title: string; subtitle: string; meta: string;
    progress?: number; live?: boolean; actionLabel?: string; actionTarget?: string;
  }): Promise<{ ok: boolean }>;
  syncCompliance(o: { pct: number; label: string; detail: string }): Promise<{ ok: boolean }>;
  syncNutrition(o: NutritionWidgetSnapshot): Promise<{ ok: boolean }>;
  /** Каталог продуктов для поиска в нативном редакторе еды (пишется один раз). */
  syncNutritionFoods(o: { items: string; version: string }): Promise<{ ok: boolean }>;
  syncCalendar(o: CalendarWidgetSnapshot): Promise<{ ok: boolean }>;
  syncNotes(o: NotesWidgetSnapshot): Promise<{ ok: boolean }>;
  syncWorkout(o: WorkoutWidgetSnapshot): Promise<{ ok: boolean }>;
  queueWater(o: { ml: number }): Promise<{ ok: boolean; queue: number }>;
  queueNutrition(o: { name: string; kcal: number; p: number; f: number; c: number; meal: string; qty?: number }): Promise<{ ok: boolean; queue: number }>;
  queueTaskToggle(o: { id: string; done: boolean }): Promise<{ ok: boolean; queue: number }>;
  drainQueue(): Promise<{ items: string; count: number }>;
  queueSize(): Promise<{ queue: number }>;
  timerCommand(o: { action: string; seconds: number }): Promise<TimerState>;
  getTimerState(): Promise<TimerState>;
  getLaunchTarget(): Promise<{ target: string | null }>;
  requestPinWidget(o: { kind: string }): Promise<{ requested: boolean; reason?: string }>;
  getWidgetOpacity(): Promise<{ opacity: number }>;
  setWidgetOpacity(o: { opacity: number }): Promise<{ ok: boolean; opacity: number }>;
  refreshAll(): Promise<{ ok: boolean }>;
}

const FB_QUEUE = 'he_widget_fallback_queue';
const FB_PREFIX = 'he_widget_fallback_';

function storageGet(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    /* quota — silent */
  }
}

function storageRemove(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** True только внутри нативного Capacitor WebView (APK). */
export function isNativeWidgetHost(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

let cachedPlugin: WidgetBridgeNative | null | undefined;
function plugin(): WidgetBridgeNative | null {
  if (cachedPlugin !== undefined) return cachedPlugin;
  try {
    if (!isNativeWidgetHost()) {
      cachedPlugin = null;
      return null;
    }
    cachedPlugin = registerPlugin<WidgetBridgeNative>('WidgetBridge');
    return cachedPlugin;
  } catch {
    cachedPlugin = null;
    return null;
  }
}

/** Только для тестов: сбросить кэш плагина. */
export function resetWidgetBridgeCache(): void {
  cachedPlugin = undefined;
}

export function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function clampMl(ml: number): number {
  if (!Number.isFinite(ml) || ml <= 0) return 250;
  return Math.min(2000, Math.round(ml));
}

/** MM:SS для виджета таймера и UI. */
export function formatTimer(totalSec: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m < 10 ? '0' + m : m}:${r < 10 ? '0' + r : r}`;
}

export function parseQueueItems(raw: string): QueuedItem[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (it): it is QueuedItem =>
        !!it &&
        typeof it === 'object' &&
        (it.type === 'water' ||
          it.type === 'water_remove' ||
          it.type === 'food' ||
          it.type === 'food_remove' ||
          it.type === 'task' ||
          it.type === 'task_add' ||
          it.type === 'note_add' ||
          it.type === 'set_add' ||
          it.type === 'workout_start' ||
          it.type === 'workout_finish'),
    );
  } catch {
    return [];
  }
}

function fbReadQueue(): QueuedItem[] {
  return parseQueueItems(storageGet(FB_QUEUE) ?? '[]');
}

function fbWriteQueue(items: QueuedItem[]): void {
  try {
    storageSet(FB_QUEUE, JSON.stringify(items.slice(-50)));
  } catch {
    /* ignore */
  }
}

function fbSnapshot(key: string, value: unknown): void {
  try {
    storageSet(FB_PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function readFallbackSnapshot(key: string): unknown {
  try {
    const raw = storageGet(FB_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ---------------- sync ---------------- */

export interface TrainingWidgetInput {
  title: string;
  subtitle: string;
  meta: string;
  /** Прогресс подходов живой/последней сессии, 0..100. */
  progress?: number;
  /** Живая (незавершённая) сессия — виджет показывает «+ Сет». */
  live?: boolean;
  /** Подпись кнопки действия («+ Сет» / «▶ Начать» / «▶ Продолжить»). */
  actionLabel?: string;
  /** Deep-link кнопки: training (зона) или training_run (сразу проведение). */
  actionTarget?: string;
  /** Следующее упражнение живой сессии (для виджета). */
  nextExercise?: string;
  /** Прогресс выполнения плана недели, 0..100. */
  weekProgress?: number;
  /** Дата последней завершённой сессии. */
  lastSessionDate?: string;
  /** Тоннаж последней завершённой сессии, кг. */
  lastSessionVolume?: number;
}

export async function syncTrainingWidget(input: TrainingWidgetInput): Promise<boolean> {
  const payload = {
    title: input.title,
    subtitle: input.subtitle,
    meta: input.meta,
    progress: clampPct(input.progress ?? 0),
    live: !!input.live,
    actionLabel: (input.actionLabel ?? '').slice(0, 40),
    actionTarget: (input.actionTarget ?? '').slice(0, 40),
    nextExercise: (input.nextExercise ?? '').slice(0, 80),
    weekProgress: clampPct(input.weekProgress ?? 0),
    lastSessionDate: (input.lastSessionDate ?? '').slice(0, 16),
    lastSessionVolume: Math.max(0, Math.round(input.lastSessionVolume ?? 0)),
  };
  const p = plugin();
  if (p) {
    try {
      await p.syncTraining(payload);
      return true;
    } catch {
      /* fallback ниже */
    }
  }
  fbSnapshot('training', { ...payload, updatedAt: Date.now() });
  return false;
}

export async function syncComplianceWidget(input: {
  pct: number;
  label: string;
  detail: string;
}): Promise<boolean> {
  const pct = clampPct(input.pct);
  const p = plugin();
  if (p) {
    try {
      await p.syncCompliance({ ...input, pct });
      return true;
    } catch {
      /* fallback ниже */
    }
  }
  fbSnapshot('compliance', { ...input, pct, updatedAt: Date.now() });
  return false;
}

/** Приведение агрегата периода: только неотрицательные целые. */
function clampPeriodStats(stats?: NutritionPeriodStats): NutritionPeriodStats {
  const num = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
  return {
    kcal: num(stats?.kcal),
    protein: num(stats?.protein),
    fat: num(stats?.fat),
    carbs: num(stats?.carbs),
    waterMl: num(stats?.waterMl),
    days: num(stats?.days),
    waterDays: num(stats?.waterDays),
  };
}

/** Последняя запись еды: обрезаем строки и приводим числа к целым. */
function clampLastFood(food?: NutritionLastFood): NutritionLastFood | undefined {
  if (!food || !food.name) return undefined;
  const num = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
  const qty = num(food.qty);
  const rawIndex = Number(food.index);
  const index = food.index !== undefined && Number.isFinite(rawIndex) && rawIndex >= 0
    ? Math.round(rawIndex)
    : -1;
  const date =
    typeof food.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(food.date) ? food.date : '';
  return {
    name: String(food.name).slice(0, 40),
    meal: String(food.meal || '').slice(0, 32),
    ...(date ? { date } : {}),
    ...(index >= 0 ? { index } : {}),
    kcal: num(food.kcal),
    protein: num(food.protein),
    fat: num(food.fat),
    carbs: num(food.carbs),
    ...(qty > 0 ? { qty } : {}),
  };
}

/**
 * Дни для листания дат: только ISO-ключи, максимум 7 самых свежих, итоги и
 * позиции — неотрицательные целые. Лишние позиции не тащим: список на виджете
 * короткий, а префы не должны расти от длинного дня.
 */
function clampNutritionDays(
  days?: Record<string, NutritionDaySnapshot>,
): Record<string, NutritionDaySnapshot> | undefined {
  if (!days || typeof days !== 'object') return undefined;
  const num = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
  const out: Record<string, NutritionDaySnapshot> = {};
  const keys = Object.keys(days)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
    .sort()
    .slice(-7);
  for (const key of keys) {
    const day = days[key];
    if (!day || typeof day !== 'object') continue;
    const items = Array.isArray(day.items)
      ? day.items
          .filter((it) => it && typeof it.name === 'string' && it.name.trim())
          .slice(0, WIDGET_DAY_ITEMS_CAP)
          .map((it) => {
            const qty = num(it.qty);
            const foodId = String(it.foodId || '').slice(0, 64);
            return {
              name: String(it.name).slice(0, 40),
              kcal: num(it.kcal),
              p: num(it.p),
              f: num(it.f),
              c: num(it.c),
              meal: String(it.meal || '').slice(0, 32),
              index: num(it.index),
              ...(qty > 0 ? { qty } : {}),
              ...(foodId ? { foodId } : {}),
            };
          })
      : [];
    out[key] = {
      kcal: num(day.kcal),
      p: num(day.p),
      f: num(day.f),
      c: num(day.c),
      waterMl: num(day.waterMl),
      items,
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Чипы «недавние / избранное»: не больше 6, имя обязательно. */
function clampQuickFoods(foods?: NutritionQuickFood[]): NutritionQuickFood[] | undefined {
  if (!Array.isArray(foods)) return undefined;
  const num = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
  const out = foods
    .filter((food) => food && typeof food.name === 'string' && food.name.trim())
    .slice(0, 6)
    .map((food) => {
      const qty = num(food.qty);
      const meal = String(food.meal || '').slice(0, 32);
      const foodId = String(food.foodId || '').slice(0, 64);
      return {
        name: String(food.name).slice(0, 28),
        kcal: num(food.kcal),
        p: num(food.p),
        f: num(food.f),
        c: num(food.c),
        ...(qty > 0 ? { qty } : {}),
        ...(meal ? { meal } : {}),
        ...(foodId ? { foodId } : {}),
        ...(food.fav ? { fav: true } : {}),
      };
    });
  return out.length > 0 ? out : undefined;
}

/** Приёмы пищи для редактора еды: до 20 штук, имя не пустое, без повторов. */
function clampMealTypes(meals?: string[]): string[] | undefined {
  if (!Array.isArray(meals)) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of meals) {
    const name = String(raw ?? '').trim().slice(0, 32);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= 20) break;
  }
  return out.length > 0 ? out : undefined;
}

export async function syncNutritionWidget(input: NutritionWidgetSnapshot): Promise<boolean> {
  const payload: NutritionWidgetSnapshot = {
    ...input,
    lastFood: clampLastFood(input.lastFood),
    days: clampNutritionDays(input.days),
    quick: clampQuickFoods(input.quick),
    meals: clampMealTypes(input.meals),
    periods: input.periods
      ? {
          day: clampPeriodStats(input.periods.day),
          week: clampPeriodStats(input.periods.week),
          month: clampPeriodStats(input.periods.month),
        }
      : undefined,
  };
  const p = plugin();
  if (p) {
    try {
      await p.syncNutrition(payload);
      return true;
    } catch {
      /* fallback ниже */
    }
  }
  fbSnapshot('nutrition', { ...payload, updatedAt: Date.now() });
  return false;
}

/** Продукт каталога для поиска в нативном редакторе еды (на 100 г). */
export interface NutritionFoodItem {
  /** id продукта в `FOOD_DB`: по нему дневник узнаёт продукт (избранное, состав). */
  id?: string;
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
}

const FB_FOODS_VERSION = 'he_widget_foods_ver';

/**
 * Каталог продуктов для поиска на виджете. Пишется в SharedPreferences один
 * раз на версию: гонять ~700 позиций через мост на каждую правку дневника
 * незачем. `version` — отпечаток каталога (см. `nutritionFoodsVersion`).
 *
 * Возвращает true, если каталог реально ушёл в нативную часть.
 */
export async function pushNutritionFoods(
  items: NutritionFoodItem[],
  version: string,
): Promise<boolean> {
  const p = plugin();
  if (!p) return false;
  if (storageGet(FB_FOODS_VERSION) === version) return false;
  try {
    await p.syncNutritionFoods({ items: JSON.stringify(items), version });
    storageSet(FB_FOODS_VERSION, version);
    return true;
  } catch {
    return false;
  }
}

/**
 * Версия каталога: длина, края списка и сумма калорий — правка продукта в
 * середине базы тоже меняет отпечаток (одного «первый/последний» мало).
 *
 * Префикс `v2` — в каталоге появились id продуктов: каталог, записанный прошлой
 * версией (без id), надо переслать один раз, иначе записи с виджета так и
 * остались бы без продукта.
 */
export function nutritionFoodsVersion(items: NutritionFoodItem[]): string {
  let kcal = 0;
  for (const item of items) kcal += Math.max(0, Math.round(Number(item.kcal) || 0));
  return `v2|${items.length}|${kcal}|${items[0]?.name ?? ''}|${items[items.length - 1]?.name ?? ''}`;
}

export async function syncCalendarWidget(input: CalendarWidgetSnapshot): Promise<boolean> {
  const p = plugin();
  if (p) {
    try {
      await p.syncCalendar(input);
      return true;
    } catch {
      /* fallback ниже */
    }
  }
  fbSnapshot('calendar', { ...input, updatedAt: Date.now() });
  return false;
}

export async function syncNotesWidget(input: NotesWidgetSnapshot): Promise<boolean> {
  const p = plugin();
  if (p) {
    try {
      await p.syncNotes(input);
      return true;
    } catch {
      /* fallback ниже */
    }
  }
  fbSnapshot('notes', { ...input, updatedAt: Date.now() });
  return false;
}

export async function syncWorkoutWidget(input: WorkoutWidgetSnapshot): Promise<boolean> {
  const payload: WorkoutWidgetSnapshot = {
    ...input,
    title: (input.title ?? '').slice(0, 80),
    subtitle: (input.subtitle ?? '').slice(0, 120),
    progress: clampPct(input.progress ?? 0),
    setsDone: Math.max(0, Math.round(input.setsDone || 0)),
    setsPlanned: Math.max(0, Math.round(input.setsPlanned || 0)),
    volumeKg: Math.max(0, Math.round(input.volumeKg || 0)),
    exercises: (input.exercises ?? []).slice(0, 6).map((ex) => ({
      name: String(ex.name ?? '').slice(0, 60),
      plan: String(ex.plan ?? '').slice(0, 48),
      done: Math.max(0, Math.round(ex.done || 0)),
      planned: Math.max(0, Math.round(ex.planned || 0)),
      weight: Math.max(0, Number(ex.weight) || 0),
      reps: Math.max(0, Math.round(ex.reps || 0)),
      rir: Math.max(0, Math.round(ex.rir || 0)),
      restSec: Math.max(0, Math.round(ex.restSec || 0)),
    })),
  };
  const p = plugin();
  if (p) {
    try {
      await p.syncWorkout(payload);
      return true;
    } catch {
      /* fallback ниже */
    }
  }
  fbSnapshot('workout', { ...payload, updatedAt: Date.now() });
  return false;
}

/* ---------------- queue ---------------- */

export async function queueWaterMl(ml: number): Promise<number> {
  const clean = clampMl(ml);
  const p = plugin();
  if (p) {
    try {
      const r = await p.queueWater({ ml: clean });
      return typeof r.queue === 'number' ? r.queue : 0;
    } catch {
      /* fallback ниже */
    }
  }
  const q = fbReadQueue();
  q.push({ type: 'water', ml: clean, ts: Date.now() });
  fbWriteQueue(q);
  return Math.min(50, q.length);
}

export async function queueFood(input: {
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  meal: string;
  /** Порция, г: необязательна, дневник подставит 100 по умолчанию. */
  qty?: number;
}): Promise<number> {
  const item: QueuedItem = {
    type: 'food',
    name: String(input.name || '').slice(0, 120),
    kcal: Math.max(0, Math.round(input.kcal) || 0),
    p: Math.max(0, Math.round(input.p) || 0),
    f: Math.max(0, Math.round(input.f) || 0),
    c: Math.max(0, Math.round(input.c) || 0),
    meal: String(input.meal || 'snack').slice(0, 32),
    qty: Math.max(0, Math.min(5000, Math.round(Number(input.qty) || 0))),
    ts: Date.now(),
  };
  const p = plugin();
  if (p) {
    try {
      const r = await p.queueNutrition({
        name: item.name ?? '',
        kcal: item.kcal ?? 0,
        p: item.p ?? 0,
        f: item.f ?? 0,
        c: item.c ?? 0,
        meal: item.meal ?? 'snack',
        qty: item.qty ?? 0,
      });
      return typeof r.queue === 'number' ? r.queue : 0;
    } catch {
      /* fallback ниже */
    }
  }
  const q = fbReadQueue();
  q.push(item);
  fbWriteQueue(q);
  return Math.min(50, q.length);
}

export async function queueTaskToggle(id: string, done: boolean): Promise<number> {
  const taskId = String(id || '').slice(0, 80);
  if (!taskId) return 0;
  const p = plugin();
  if (p) {
    try {
      const r = await p.queueTaskToggle({ id: taskId, done: !!done });
      return typeof r.queue === 'number' ? r.queue : 0;
    } catch {
      /* fallback ниже */
    }
  }
  const q = fbReadQueue();
  q.push({ type: 'task', id: taskId, done: !!done, ts: Date.now() });
  fbWriteQueue(q);
  return Math.min(50, q.length);
}

export async function queueWidgetSize(): Promise<number> {
  const p = plugin();
  if (p) {
    try {
      const r = await p.queueSize();
      return typeof r.queue === 'number' ? r.queue : 0;
    } catch {
      /* fallback ниже */
    }
  }
  return fbReadQueue().length;
}

/**
 * Забрать очередь (виджет -> дневники). Возвращает элементы и очищает хранилище.
 * Вызывать при старте приложения и при возврате из фона.
 */
export async function drainWidgetQueue(): Promise<QueuedItem[]> {
  const p = plugin();
  if (p) {
    try {
      const r = await p.drainQueue();
      return parseQueueItems(r.items ?? '[]');
    } catch {
      /* fallback ниже */
    }
  }
  const q = fbReadQueue();
  storageRemove(FB_QUEUE);
  return q;
}

/* ---------------- timer ---------------- */

export async function widgetTimerCommand(
  action: TimerAction,
  seconds = 0,
): Promise<TimerState> {
  const fallback: TimerState = {
    running: action === 'preset' || action === 'start',
    remainingSec: seconds > 0 ? Math.min(3600, seconds) : 90,
    durationSec: seconds > 0 ? Math.min(3600, seconds) : 90,
  };
  const p = plugin();
  if (p) {
    try {
      const r = await p.timerCommand({ action, seconds });
      return {
        running: !!r.running,
        remainingSec: Math.max(0, Math.round(r.remainingSec ?? 0)),
        durationSec: Math.max(1, Math.round(r.durationSec ?? 90)),
      };
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function getWidgetTimerState(): Promise<TimerState> {
  const p = plugin();
  if (p) {
    try {
      const r = await p.getTimerState();
      return {
        running: !!r.running,
        remainingSec: Math.max(0, Math.round(r.remainingSec ?? 0)),
        durationSec: Math.max(1, Math.round(r.durationSec ?? 90)),
      };
    } catch {
      /* fallback ниже */
    }
  }
  return { running: false, remainingSec: 90, durationSec: 90 };
}

/* ---------------- launch target / pin ---------------- */

/** One-shot цель из тапа по виджету. null — обычный запуск. */
export async function consumeWidgetLaunchTarget(): Promise<WidgetTarget | null> {
  const p = plugin();
  if (p) {
    try {
      const r = await p.getLaunchTarget();
      const t = r.target;
      if (
        t === 'training' ||
        t === 'training_run' ||
        t === 'training_quick' ||
        t === 'nutrition' ||
        t === 'nutrition_scan' ||
        t === 'nutrition_photo' ||
        t === 'support' ||
        t === 'calendar' ||
        t === 'notes' ||
        t === 'home'
      ) {
        return t;
      }
      return null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Попросить лаунчер закрепить виджет (Android 8+, системный диалог).
 * Вне native всегда { requested: false }.
 */
export async function requestPinWidget(
  kind: WidgetKind,
): Promise<{ requested: boolean; reason?: string }> {
  const p = plugin();
  if (!p) return { requested: false, reason: 'not-native' };
  try {
    const r = await p.requestPinWidget({ kind });
    return { requested: !!r.requested, reason: r.reason };
  } catch {
    return { requested: false, reason: 'error' };
  }
}

export async function refreshAllWidgets(): Promise<boolean> {
  const p = plugin();
  if (!p) return false;
  try {
    await p.refreshAll();
    return true;
  } catch {
    return false;
  }
}

/* ---------------- прозрачность фона ---------------- */

/** Разрешённые ступени прозрачности фона виджетов (100 — плотный фон). */
export const WIDGET_OPACITIES = [100, 85, 70, 50] as const;

export function normalizeWidgetOpacity(value: number): number {
  if (!Number.isFinite(value)) return 100;
  if (value >= 100) return 100;
  if (value >= 85) return 85;
  if (value >= 70) return 70;
  return 50;
}

/** Текущая прозрачность фона виджетов (вне APK — всегда 100). */
export async function widgetOpacity(): Promise<number> {
  const p = plugin();
  if (!p) return 100;
  try {
    const r = await p.getWidgetOpacity();
    return normalizeWidgetOpacity(Number(r.opacity));
  } catch {
    return 100;
  }
}

/** Сохранить прозрачность и сразу перерисовать все виджеты. */
export async function setWidgetOpacity(opacity: number): Promise<number> {
  const next = normalizeWidgetOpacity(opacity);
  const p = plugin();
  if (!p) return next;
  try {
    const r = await p.setWidgetOpacity({ opacity: next });
    return normalizeWidgetOpacity(Number(r.opacity));
  } catch {
    return next;
  }
}
