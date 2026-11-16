/**
 * planner-plan-archive.test.ts — активный план и архив предыдущих.
 *
 * Пользователь просил: сохранение плана подставляет ЕГО КБЖУ на страницу
 * Питания, а предыдущий план уходит в «Архив планов» (а не теряется).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedPlan } from '../types';
import {
  PLAN_ARCHIVE_KEY,
  ACTIVE_PLAN_KEY,
  PLAN_ARCHIVE_EVENT,
  PLAN_ARCHIVE_LIMIT,
  planTargets,
  readActivePlan,
  writeActivePlan,
  readPlanArchive,
  archivePlan,
  rotateActivePlan,
  restorePlanFromArchive,
  removeArchivedPlan,
  publishPlanTargetsFor,
} from '../planner-plan-archive';
import { readPlanTargets } from '../plan-targets-bridge';

const plan = (id: number, kcal: number, extra: Partial<SavedPlan> = {}): SavedPlan => ({
  id,
  date: `2026-11-${String(id).padStart(2, '0')}`,
  name: `План ${id}`,
  dayPlan: { totals: { kcal, p: 160, f: 70, c: 300 }, meals: [] },
  threeDayPlan: null,
  weekPlan: null,
  shoppingList: [],
  waterCalc: null,
  ...extra,
});

describe('planner-plan-archive — активный план', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('первое сохранение делает план активным, архив пуст', () => {
    expect(readActivePlan()).toBeNull();
    rotateActivePlan(plan(1, 2400));
    expect(readActivePlan()?.id).toBe(1);
    expect(readPlanArchive()).toEqual([]);
  });

  it('новый план вытесняет предыдущий активный в архив', () => {
    const first = plan(1, 2400);
    const second = plan(2, 2600);
    rotateActivePlan(first);
    rotateActivePlan(second);

    expect(readActivePlan()?.id).toBe(2);
    expect(readPlanArchive().map((p) => p.id)).toEqual([1]);
  });

  it('повторное сохранение того же плана не дублирует архив', () => {
    const p = plan(1, 2400);
    rotateActivePlan(p);
    rotateActivePlan(p);
    expect(readPlanArchive()).toEqual([]);
    expect(readActivePlan()?.id).toBe(1);
  });

  it('архив хранит планы без дублей и свежие сверху', () => {
    archivePlan(plan(1, 2000));
    archivePlan(plan(2, 2100));
    archivePlan(plan(1, 2200));
    const ids = readPlanArchive().map((p) => p.id);
    expect(ids).toEqual([1, 2]);
    expect(readPlanArchive()[0].dayPlan.totals.kcal).toBe(2200);
  });

  it('архив не растёт бесконечно — держит последние 12 планов', () => {
    for (let i = 1; i <= 20; i++) archivePlan(plan(i, 2000 + i));
    const ids = readPlanArchive().map((p) => p.id);
    expect(ids).toHaveLength(PLAN_ARCHIVE_LIMIT);
    expect(ids[0]).toBe(20);
    expect(ids[ids.length - 1]).toBe(9);
  });

  it('restore возвращает план в работу и убирает из архива', () => {
    rotateActivePlan(plan(1, 2400));
    rotateActivePlan(plan(2, 2600));

    const restored = restorePlanFromArchive(1);
    expect(restored?.id).toBe(1);
    expect(readActivePlan()?.id).toBe(1);
    // План 2 был активным — он уехал в архив вместо восстановленного.
    expect(readPlanArchive().map((p) => p.id)).toEqual([2]);
  });

  it('restore несуществующего плана ничего не меняет', () => {
    rotateActivePlan(plan(1, 2400));
    expect(restorePlanFromArchive(999)).toBeNull();
    expect(readActivePlan()?.id).toBe(1);
  });

  it('removeArchivedPlan удаляет только выбранный план', () => {
    archivePlan(plan(1, 2000));
    archivePlan(plan(2, 2100));
    removeArchivedPlan(1);
    expect(readPlanArchive().map((p) => p.id)).toEqual([2]);
  });

  it('мусор в localStorage не ломает чтение', () => {
    localStorage.setItem(ACTIVE_PLAN_KEY, '{broken');
    localStorage.setItem(PLAN_ARCHIVE_KEY, JSON.stringify([{ nope: true }, plan(3, 2300)]));
    expect(readActivePlan()).toBeNull();
    expect(readPlanArchive().map((p) => p.id)).toEqual([3]);
  });

  it('rotateActivePlan шлёт событие обновления архива', () => {
    const spy = vi.fn();
    window.addEventListener(PLAN_ARCHIVE_EVENT, spy as EventListener);
    try {
      rotateActivePlan(plan(1, 2400));
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(PLAN_ARCHIVE_EVENT, spy as EventListener);
    }
  });
});

describe('planner-plan-archive — КБЖУ плана', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('берёт фактические КБЖУ дневного плана', () => {
    expect(planTargets(plan(1, 2437))).toEqual({ kcal: 2437, protein: 160, fats: 70, carbs: 300 });
  });

  it('без дневного плана считает среднее по дням 3/7-дневки', () => {
    const p = plan(1, 0, {
      dayPlan: null,
      weekPlan: { days: [{ totals: { kcal: 2400, p: 150, f: 70, c: 300 } }, { totals: { kcal: 2600, p: 170, f: 80, c: 320 } }] },
    });
    expect(planTargets(p)).toEqual({ kcal: 2500, protein: 160, fats: 75, carbs: 310 });
  });

  it('план без КБЖУ → null и ничего не публикует', () => {
    const empty = plan(1, 0, { dayPlan: null });
    expect(planTargets(empty)).toBeNull();
    expect(publishPlanTargetsFor(empty)).toBe(false);
    expect(readPlanTargets()).toBeNull();
  });

  it('publishPlanTargetsFor обновляет цели страницы Питания', () => {
    expect(publishPlanTargetsFor(plan(1, 2780))).toBe(true);
    expect(readPlanTargets()).toEqual({ kcal: 2780, protein: 160, fats: 70, carbs: 300 });
  });

  it('writeActivePlan перезаписывает активный план', () => {
    writeActivePlan(plan(1, 2400));
    writeActivePlan(plan(2, 2500));
    expect(readActivePlan()?.id).toBe(2);
  });
});
