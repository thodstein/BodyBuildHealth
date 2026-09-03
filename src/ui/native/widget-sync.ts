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
} from '../../engines/workout-logger.engine';
import { getAdherenceStats } from '../../engines/symptom-adherence.engine';
import { calcNutrition } from '../../engines/nutrition.engine';
import { derivePAL } from '../../core/data-link';
import { loadWaterLog, addWater } from '../../engines/nutrition-tracker.engine';
import {
  readDiaryV2,
  writeDiaryV2,
} from '../screens/NutritionScreen_parts/diary-storage-v2';
import {
  syncTrainingWidget,
  syncComplianceWidget,
  syncNutritionWidget,
  drainWidgetQueue,
  type QueuedItem,
} from '../../core/widget-bridge';

export type WidgetNavTarget = 'training' | 'nutrition' | 'support' | 'home';

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
  trainingOk: boolean;
  complianceOk: boolean;
  nutritionOk: boolean;
}

function collectTraining(): { title: string; subtitle: string; meta: string } {
  const last = safe(() => getLastSession(), null);
  const today = todayLocalISO();
  const week = safe(() => getSessionsByWeek(getISOWeekNumber(today)).length, 0);
  const total = safe(() => getWorkoutStats().totalSessions ?? 0, 0);
  if (!last) {
    return {
      title: 'Тренировка',
      subtitle: week > 0 ? `На неделе: ${week}` : 'План недели ждёт',
      meta: total > 0 ? `всего ${total}` : 'Health Engine',
    };
  }
  const vol = last.totalVolume > 0 ? ` · ${(last.totalVolume / 1000).toFixed(1)} т` : '';
  return {
    title: last.focus || 'Тренировка',
    subtitle: `${last.date} · ${last.totalSets} подходов${vol}`,
    meta: `на неделе ${week} · всего ${total}`,
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

function collectTargets(): { kcal: number; protein: number } {
  const fallback = { kcal: 2500, protein: 160 };
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
    return { kcal: t.kcal || fallback.kcal, protein: t.protein || fallback.protein };
  } catch {
    return fallback;
  }
}

function collectNutrition(): { kcal: number; protein: number; waterMl: number; targetKcal: number; targetProtein: number } {
  const targets = collectTargets();
  const today = todayLocalISO();
  let kcal = 0;
  let protein = 0;
  try {
    const diary = readDiaryV2();
    const day = diary[today];
    if (day?.meals) {
      for (const items of Object.values(day.meals)) {
        for (const it of items || []) {
          kcal += it.kcal || 0;
          protein += it.p || 0;
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
  return { kcal: Math.round(kcal), protein: Math.round(protein), waterMl, targetKcal: targets.kcal, targetProtein: targets.protein };
}

/**
 * Применить очередь виджета к журналам: вода -> he_water_log,
 * еда -> nutrition_diary_v2 в день из метки времени.
 */
export function applyWidgetQueue(items: QueuedItem[]): { waterMl: number; foods: number } {
  let waterMl = 0;
  let foods = 0;
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
      }
    } catch {
      /* один битый элемент не роняет остальные */
    }
  }
  return { waterMl, foods };
}

/**
 * Полный цикл: забрать очередь -> применить -> запушить свежие снапшоты.
 * Безопасен везде; вне native виджеты просто не обновятся.
 */
export async function syncAllWidgets(): Promise<WidgetSyncResult> {
  let drainedWaterMl = 0;
  let drainedFoods = 0;
  try {
    const items = await drainWidgetQueue();
    if (items.length > 0) {
      const applied = applyWidgetQueue(items);
      drainedWaterMl = applied.waterMl;
      drainedFoods = applied.foods;
    }
  } catch {
    /* очередь недоступна */
  }
  const t = collectTraining();
  const c = collectCompliance();
  const n = collectNutrition();
  const [trainingOk, complianceOk, nutritionOk] = await Promise.all([
    syncTrainingWidget(t).catch(() => false),
    syncComplianceWidget(c).catch(() => false),
    syncNutritionWidget({
      kcal: n.kcal,
      targetKcal: n.targetKcal,
      protein: n.protein,
      waterMl: n.waterMl,
    }).catch(() => false),
  ]);
  return { drainedWaterMl, drainedFoods, trainingOk, complianceOk, nutritionOk };
}
