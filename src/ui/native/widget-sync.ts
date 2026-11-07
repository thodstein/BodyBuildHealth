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
} from '../../engines/workout-logger.engine';
import { getAdherenceStats } from '../../engines/symptom-adherence.engine';
import { calcNutrition } from '../../engines/nutrition.engine';
import { derivePAL } from '../../core/energy-pal';
import { loadWaterLog, addWater } from '../../engines/nutrition-tracker.engine';
import {
  readDiaryV2,
  writeDiaryV2,
} from '../screens/NutritionScreen_parts/diary-storage-v2';
import {
  syncTrainingWidget,
  syncComplianceWidget,
  syncNutritionWidget,
  syncCalendarWidget,
  syncNotesWidget,
  drainWidgetQueue,
  type QueuedItem,
} from '../../core/widget-bridge';
import { ruCount, RU_APPROACHES } from '../../engines/ru-plural';
import {
  readCoachPlanner,
  writeCoachPlanner,
  tasksForDate,
  overdueCoachTasks,
  updateCoachTask,
  coachTaskPriority,
} from '../../engines/coach/coach-planner.engine';
import {
  readCoachNotes,
  sortCoachNotes,
  noteChecklistProgress,
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

export interface WidgetSyncResult {
  drainedWaterMl: number;
  drainedFoods: number;
  tasksToggled: number;
  trainingOk: boolean;
  complianceOk: boolean;
  nutritionOk: boolean;
  calendarOk: boolean;
  notesOk: boolean;
}

function collectTraining(): {
  title: string; subtitle: string; meta: string;
  progress: number; live: boolean; actionLabel: string; actionTarget: string;
  nextExercise: string; weekProgress: number; lastSessionDate: string; lastSessionVolume: number;
} {
  const last = safe(() => getLastSession(), null);
  const today = todayLocalISO();
  const week = safe(() => getSessionsByWeek(getISOWeekNumber(today)).length, 0);
  const total = safe(() => getWorkoutStats().totalSessions ?? 0, 0);
  const daysPerWeek = safe(() => Number((getProfile() as any)?.settings?.training?.daysPerWeek) || 4, 4);
  const weekProgress = Math.max(0, Math.min(100, Math.round((week / Math.max(1, daysPerWeek)) * 100)));

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
  const profile = safe(() => getProfile(), null as never);
  const settings = (profile as unknown as { settings?: Record<string, Record<string, unknown>> } | null)?.settings;
  const daysPerWeek = Number((settings?.training as Record<string, unknown> | undefined)?.daysPerWeek) || 3;
  const today = todayLocalISO();
  const week = safe(() => getSessionsByWeek(getISOWeekNumber(today)).length, 0);
  return {
    pct: Math.max(0, Math.min(100, Math.round((week / Math.max(1, daysPerWeek)) * 100))),
    label: 'Тренировки недели',
    detail: `${week} из ${daysPerWeek}`,
  };
}

function collectTargets(): { kcal: number; protein: number; fats: number; carbs: number; waterMl: number } {
  const fallback = { kcal: 2500, protein: 160, fats: 70, carbs: 300, waterMl: 2500 };
  try {
    const s = (safe(() => getProfile(), null as never) as unknown as {
      settings?: Record<string, Record<string, number & string>>;
    } | null)?.settings;
    const p = (s?.personal ?? {}) as Record<string, number & string>;
    const tr = (s?.training ?? {}) as Record<string, number & string>;
    if (!p?.weight) return fallback;
    const pal = derivePAL(
      tr?.daysPerWeek as number | undefined,
      tr?.minutesPerSession as number | undefined,
    );
    const t = calcNutrition({
      weightKg: Number(p.weight),
      heightCm: Number(p.height) || 175,
      age: Number(p.age) || 30,
      sex: (p.sex as 'male' | 'female') || 'male',
      pal,
      goal: (tr?.primaryGoal as string) || 'maintenance',
    });
    return {
      kcal: t.kcal || fallback.kcal,
      protein: t.protein || fallback.protein,
      fats: t.fats || fallback.fats,
      carbs: t.carbs || fallback.carbs,
      waterMl: Math.round((t.water || 2.5) * 1000),
    };
  } catch {
    return fallback;
  }
}

function collectNutrition(): {
  kcal: number; protein: number; fat: number; carbs: number; waterMl: number;
  targetKcal: number; targetProtein: number; targetFat: number; targetCarbs: number; waterTargetMl: number;
} {
  const targets = collectTargets();
  const today = todayLocalISO();
  let kcal = 0;
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  try {
    const diary = readDiaryV2();
    const day = diary[today];
    if (day?.meals) {
      for (const items of Object.values(day.meals)) {
        for (const it of items || []) {
          kcal += it.kcal || 0;
          protein += it.p || 0;
          fat += it.f || 0;
          carbs += it.c || 0;
        }
      }
    }
  } catch {
    /* пустой дневник */
  }
  let waterMl = 0;
  try {
    waterMl = loadWaterLog().find((w) => w.date === today)?.amountMl ?? 0;
  } catch {
    /* ignore */
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs),
    waterMl,
    targetKcal: targets.kcal,
    targetProtein: targets.protein,
    targetFat: targets.fats,
    targetCarbs: targets.carbs,
    waterTargetMl: targets.waterMl,
  };
}

/**
 * Календарь для виджета: задачи «сегодня» + просрочено. Как агенда TickTick:
 * чужие дневники не трогает, задачи берёт из того же хранилища, что и вкладка
 * «Планер» (he_coach_planner).
 */
function collectCalendar(): {
  date: string;
  dateLabel: string;
  tasks: { id: string; title: string; time: string; done: boolean; priority: string }[];
  total: number;
  done: number;
  overdue: number;
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
  return {
    date: today,
    dateLabel,
    tasks: dayTasks.slice(0, 5).map(t => ({
      id: t.id,
      title: String(t.title).slice(0, 120),
      time: t.time ?? '',
      done: !!t.done,
      priority: coachTaskPriority(t),
    })),
    total: dayTasks.length,
    done: dayTasks.filter(t => t.done).length,
    overdue,
  };
}

/** Заметки для виджета: закреплённые сверху, затем свежие. */
function collectNotes(): {
  notes: { id: string; title: string; done: number; total: number }[];
  total: number;
  pinned: number;
} {
  const store = safe(() => readCoachNotes(localStorageRef()), { version: 1 as const, items: [] });
  const sorted = safe(() => sortCoachNotes(store.items), []);
  return {
    notes: sorted.slice(0, 5).map(n => {
      const p = noteChecklistProgress(n);
      return {
        id: n.id,
        title: String(n.title || n.body.split('\n')[0] || 'Без названия').slice(0, 90),
        done: p.done,
        total: p.total,
      };
    }),
    total: store.items.length,
    pinned: store.items.filter(n => n.pinned).length,
  };
}

function localStorageRef(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Применить очередь виджета к журналам: вода -> he_water_log,
 * еда -> nutrition_diary_v2 в день из метки времени,
 * задача -> статус «сделано» в планшете (he_coach_planner).
 */
export function applyWidgetQueue(items: QueuedItem[]): { waterMl: number; foods: number; tasks: number } {
  let waterMl = 0;
  let foods = 0;
  let tasks = 0;
  for (const it of items) {
    try {
      if (it.type === 'water') {
        const ml = Math.max(0, Math.min(2000, Math.round(it.ml ?? 0)));
        if (ml > 0) {
          addWater(ml);
          waterMl += ml;
        }
      } else if (it.type === 'food' && it.name) {
        const date = isoFromTs(it.ts || Date.now());
        const diary = readDiaryV2();
        const day = diary[date] ?? { meals: {} };
        const meal = (it.meal || 'snack').slice(0, 32);
        const list = [...(day.meals[meal] ?? [])];
        list.push({
          name: String(it.name).slice(0, 120),
          kcal: Math.max(0, Math.round(it.kcal ?? 0)),
          p: Math.max(0, Math.round(it.p ?? 0)),
          f: Math.max(0, Math.round(it.f ?? 0)),
          c: Math.max(0, Math.round(it.c ?? 0)),
          qty: 100,
        });
        writeDiaryV2({ ...diary, [date]: { meals: { ...day.meals, [meal]: list } } });
        foods += 1;
      } else if (it.type === 'task' && it.id) {
        const storage = localStorageRef();
        const store = readCoachPlanner(storage);
        const next = updateCoachTask(store, String(it.id), { done: it.done === true });
        if (next !== store) {
          writeCoachPlanner(storage, next);
          tasks += 1;
        }
      }
    } catch {
      /* один битый элемент не роняет остальные */
    }
  }
  return { waterMl, foods, tasks };
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
export async function syncAllWidgets(): Promise<WidgetSyncResult> {
  let drainedWaterMl = 0;
  let drainedFoods = 0;
  let tasksToggled = 0;
  try {
    const items = await drainWidgetQueue();
    if (items.length > 0) {
      const applied = applyWidgetQueue(items);
      drainedWaterMl = applied.waterMl;
      drainedFoods = applied.foods;
      tasksToggled = applied.tasks;
    }
  } catch {
    /* очередь недоступна */
  }
  const t = collectTraining();
  const c = collectCompliance();
  const n = collectNutrition();
  const cal = collectCalendar();
  const nt = collectNotes();
  const [trainingOk, complianceOk, nutritionOk, calendarOk, notesOk] = await Promise.all([
    syncTrainingWidget(t).catch(() => false),
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
    }).catch(() => false),
    syncCalendarWidget(cal).catch(() => false),
    syncNotesWidget(nt).catch(() => false),
  ]);
  return {
    drainedWaterMl,
    drainedFoods,
    tasksToggled,
    trainingOk,
    complianceOk,
    nutritionOk,
    calendarOk,
    notesOk,
  };
}
