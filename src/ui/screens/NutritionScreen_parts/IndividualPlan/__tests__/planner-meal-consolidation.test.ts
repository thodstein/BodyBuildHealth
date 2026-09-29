import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { scoreDayComposition } from '../planner-composition-quality';

/**
 * E11 (=E3 полный): консолидация крошечных основных приёмов (<180 ккал).
 *
 * Дефект: на сушке основной приём проваливался до 110–180 ккал («показной ужин»),
 * пока другой приём дня тянул 260–460. Фикс: финальный пасс ПОСЛЕ reconciliation
 * переносит КАЛОРИИ граммами (режет углеводный носитель крупнейшего основного
 * приёма, растит углеводный носитель крошечного; пункты и белок-носители не
 * трогаются — болюс-капы/MPS-полы целы). Приёмка: донор не становится фрагментом,
 * крошечный реально вырос, число фрагментов не растёт, max-dev дня ≤ канона (3%)
 * на сошедшемся / не хуже старта на честно-несошедшемся. Иначе — откат.
 *
 * Замер (было → стало): F50-1200 R s1 ужин 154→180 (frag 1→0, comp 86→93, dev
 * 0.9→2.3% ≤ канон); F50-1200 R s2 ужин 145→180 (frag 1→0, comp 83→90, dev 1.4%);
 * M70-2000 T s2 ужин 120→180 (frag 1→0, comp 83→90, dev 1.2%). F60-1500 T s1 —
 * перенос отклонён guard'ом (день честно несошедшийся, донор/жир-ось не пускают):
 * frag остаётся 1, БЕЗ регресса композиции (анти-регресс-лок).
 * E15 (Sep 29 2026, вес-зависимый ночной белок): F50 R s1 крошек больше нет до
 * консолидации (frag 0, dev 0.2%) — пасс держим на s3 (нота «укрупнён» жива);
 * итоговая гарантия «нет крошек <180» проверяется на s1 без требования ноты.
 */

const fragOf = (p: any): Array<{ label: string; kcal: number }> =>
  (p.meals || [])
    .filter((m: any) => ['breakfast', 'lunch', 'dinner'].includes(String(m.type || '')))
    .filter((m: any) => (m.totals?.kcal || 0) > 0 && (m.totals?.kcal || 0) < 180)
    .map((m: any) => ({ label: m.label || m.type, kcal: Math.round(m.totals?.kcal || 0) }));

const f50R: MealPlanInput = {
  weightKg: 50, lbmKg: 41, bodyFatPct: 18, sex: 'female',
  goalKcal: 1200, goalProteinG: 100, goalFatG: 36, goalCarbsG: 119,
  mealsCount: 5, isTrainingDay: false, allowIntraWorkout: false,
  budget: 'medium', dayOffset: 0, cyclePhase: 'cutting', variety: 'medium', eveningLowCarb: false,
};

describe('E11: консолидация крошечных основных приёмов', () => {
  it('F50-1200 R s3: ужин укрупнён до ≥180, день в каноне, есть честная нота', () => {
    // было→стало (E15, Sep 29 2026): с вес-зависимым ночным бюджетом (20 г для 50 кг
    // вместо 28) день s1 перераспределился — крошек нет до консолидации (нота не нужна,
    // frag=0 держим отдельно); пасс по-прежнему срабатывает на s2/s3 (нота «укрупнён»).
    const p = buildDayPlan({ ...f50R, randomSalt: 3 });
    expect(fragOf(p), `фрагменты: ${JSON.stringify(fragOf(p))}`).toEqual([]);
    expect(p.withinTolerance, `dev=${p.deviationPct}%`).toBe(true);
    expect(p.deviationPct).toBeLessThanOrEqual(3);
    const dinner = p.meals.find(m => m.type === 'dinner')!;
    expect(dinner.totals.kcal).toBeGreaterThanOrEqual(180);
    expect(p.notes.some(n => n.includes('укрупнён переносом'))).toBe(true);
  });

  it('F50-1200 R s1: крошек нет (итог гарантии держится и без ноты)', () => {
    const p = buildDayPlan({ ...f50R, randomSalt: 1 });
    expect(fragOf(p), `фрагменты: ${JSON.stringify(fragOf(p))}`).toEqual([]);
    expect(p.withinTolerance, `dev=${p.deviationPct}%`).toBe(true);
  });

  it('F50-1200 R s2: ужин укрупнён, день в каноне', () => {
    const p = buildDayPlan({ ...f50R, randomSalt: 2 });
    expect(fragOf(p), `фрагменты: ${JSON.stringify(fragOf(p))}`).toEqual([]);
    expect(p.withinTolerance, `dev=${p.deviationPct}%`).toBe(true);
    expect(p.notes.some(n => n.includes('укрупнён переносом'))).toBe(true);
  });

  it('M70-2000 T s2: ужин 120→180, день в каноне', () => {
    const p = buildDayPlan({
      weightKg: 70, lbmKg: 57, bodyFatPct: 18, sex: 'male',
      goalKcal: 2000, goalProteinG: 140, goalFatG: 60, goalCarbsG: 225,
      mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
      budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'medium', eveningLowCarb: false,
      randomSalt: 2,
    });
    expect(fragOf(p), `фрагменты: ${JSON.stringify(fragOf(p))}`).toEqual([]);
    expect(p.withinTolerance, `dev=${p.deviationPct}%`).toBe(true);
  });

  it('анти-регресс: перенос отклонён guard-ом — фрагмент остаётся 1, скор не падает', () => {
    // F60-1500 T s1 (честно несошедшийся: полы peri): до E11 был frag=1 (ужин 139).
    // Первая версия пасса уводила донор под 180 и давала frag=2 (comp 79→72) —
    // лок держит: число фрагментов НЕ растёт относительно 1.
    const p = buildDayPlan({
      weightKg: 60, lbmKg: 49, bodyFatPct: 18, sex: 'female',
      goalKcal: 1500, goalProteinG: 110, goalFatG: 45, goalCarbsG: 163,
      mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
      budget: 'medium', dayOffset: 0, cyclePhase: 'cutting', variety: 'medium', eveningLowCarb: false,
      randomSalt: 1,
    });
    const frags = fragOf(p);
    expect(frags.length, `фрагменты: ${JSON.stringify(frags)}`).toBeLessThanOrEqual(1);
    // Донор (любой основной приём) не ниже пола — перенос не «съел» крупный приём.
    for (const m of p.meals.filter((mm: any) => ['breakfast', 'lunch', 'dinner'].includes(String(mm.type)))) {
      expect(m.totals.kcal, `${m.label}: ${Math.round(m.totals.kcal)} ккал`).toBeGreaterThanOrEqual(120);
    }
    // Композиция не хуже «до» (79 у этого профиля): допуск на соль/каскад E0.
    expect(scoreDayComposition(p).score).toBeGreaterThanOrEqual(75);
  });
});
