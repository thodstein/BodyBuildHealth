import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * §8.57 «выравнивание тарелок» (стадия `autoMealRebalance`, по умолчанию ВЫКЛ).
 *
 * Зачем: ведро — арифметика «N приёмов × кап массы». 2065 г еды на 3000 ккал
 * (1.45 ккал/г) при 4 приёмах = 500–880 г на тарелку; раскладка (QG53) и плотные
 * носители (§8.56) вёдра не чинят без потери GL/микро, а новый приём дробит белок
 * и роняет ось «белок ядра» (замер 88.18 против 91.25).
 *
 * Что делает стадия: берёт самое тяжёлое ведро дня и переносит половину его
 * крупнейшего гарнира в самый лёгкий перекус того же дня (не в завтрак, не в
 * peri-окна, не в предсон). Число приёмов, белок, жир, микро дня не меняются.
 *
 * Замер (60 дней: 10 профилей × 4/5/6 приёмов × трен/отдых, стадия включена):
 * - обычные дни: вёдер 19 → 5, максимум тарелки 878 → 578 г, дней с 2+ вёдрами нет;
 * - экстремальные: вёдер 80 → 48, максимум 888 → 725 г, не больше 5 на день;
 * - средняя оценка дня 91.25 → 91.73, НИ ОДИН день не потерял балл;
 * - число приёмов не изменилось ни в одном дне.
 *
 * Почему стадия НЕ включена по умолчанию: перенос гарнира в чужой приём в конце
 * конвейера ломает 31 выверенный замок каплей углеводов (семейные капы, anti-repeat
 * carb-id, «моно-носитель ≤3 приёма», лимиты вторых гарниров, инсулиновые окна,
 * витрина mpsSummary). Это долг §8.57: стадия должна жить до инвариантов (в раскладке),
 * а не после них. Замок держит её математику, пока интеграция не сделана.
 */

const PROFILES: Array<{ id: string; w: number; lbm: number; bf: number; sex: 'male' | 'female'; k: number; p: number; f: number; c?: number; extreme: boolean }> = [
  { id: 'p500', w: 110, lbm: 90, bf: 18, sex: 'male', k: 4600, p: 500, f: 120, extreme: true },
  { id: 'c1500', w: 110, lbm: 90, bf: 18, sex: 'male', k: 8370, p: 300, f: 130, c: 1500, extreme: true },
  { id: 'hugeCarb', w: 100, lbm: 82, bf: 18, sex: 'male', k: 6700, p: 250, f: 100, extreme: true },
  { id: 'mass110', w: 110, lbm: 90, bf: 18, sex: 'male', k: 5200, p: 260, f: 120, extreme: true },
  { id: 'normal90', w: 90, lbm: 73, bf: 19, sex: 'male', k: 3000, p: 200, f: 80, extreme: false },
  { id: 'mid75', w: 75, lbm: 61, bf: 18, sex: 'male', k: 2400, p: 180, f: 70, extreme: false },
  { id: 'small60', w: 60, lbm: 49, bf: 18, sex: 'female', k: 1600, p: 150, f: 45, extreme: false },
  { id: 'cutF50', w: 50, lbm: 41, bf: 18, sex: 'female', k: 1240, p: 110, f: 40, extreme: false },
  { id: 'recomp80', w: 80, lbm: 65, bf: 18, sex: 'male', k: 2200, p: 200, f: 60, extreme: false },
  { id: 'keto85', w: 85, lbm: 70, bf: 18, sex: 'male', k: 2400, p: 180, f: 150, extreme: false },
];

const carbsFor = (p: { k: number; p: number; f: number; c?: number }) => (
  p.c && p.c > 0 ? p.c : Math.max(0, Math.round((p.k - 4 * p.p - 9 * p.f) / 4))
);

const build = (p: typeof PROFILES[number], mc: number, tr: boolean, rebalance: boolean): any => buildDayPlan({
  weightKg: p.w, lbmKg: p.lbm, bodyFatPct: p.bf, sex: p.sex,
  goalKcal: p.k, goalProteinG: p.p, goalFatG: p.f, goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  autoMealRebalance: rebalance,
} as unknown as MealPlanInput);

const SOLID_SKIP = new Set(['liquid', 'supplement']);
const solidG = (m: any): number => (m.items || [])
  .filter((i: any) => !SOLID_SKIP.has(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

const cells = (extreme: boolean, rebalance: boolean) => PROFILES.filter((p) => p.extreme === extreme)
  .flatMap((p) => [4, 5, 6].flatMap((mc) => [true, false].map((tr) => ({
    key: `${p.id}/${mc}/${tr ? 'тр' : 'отд'}`,
    plan: build(p, mc, tr, rebalance),
  }))));

describe('§8.57 выравнивание тарелок (`autoMealRebalance`)', () => {
  it('обычный день: вёдер ≤2 на день и ≤600 г в приёме; было 878 г', () => {
    const rows = cells(false, true);
    expect(rows).toHaveLength(36);
    const perDay = rows.map((r) => ({
      key: r.key,
      n: (r.plan.meals || []).filter((m: any) => solidG(m) > 500).length,
      max: Math.max(0, ...(r.plan.meals || []).map((m: any) => solidG(m))),
    }));
    expect(perDay.filter((r) => r.n > 2).map((r) => `${r.key}=${r.n}`).join(', ')).toBe('');
    expect(perDay.filter((r) => r.max > 600).map((r) => `${r.key}=${Math.round(r.max)}г`).join(', ')).toBe('');
  });

  it('экстремальный день: ≤5 вёдер, ≤750 г в приёме; было 888 г', () => {
    const rows = cells(true, true);
    expect(rows).toHaveLength(24);
    const perDay = rows.map((r) => ({
      key: r.key,
      n: (r.plan.meals || []).filter((m: any) => solidG(m) > 500).length,
      max: Math.max(0, ...(r.plan.meals || []).map((m: any) => solidG(m))),
    }));
    expect(perDay.filter((r) => r.n > 5).map((r) => `${r.key}=${r.n}`).join(', ')).toBe('');
    expect(perDay.filter((r) => r.max > 750).map((r) => `${r.key}=${Math.round(r.max)}г`).join(', ')).toBe('');
  });

  it('ни один день не теряет балл, число приёмов не меняется', () => {
    const off = new Map(cells(false, false).concat(cells(true, false)).map((r) => [r.key, r.plan]));
    const on = cells(false, true).concat(cells(true, true));
    expect(on).toHaveLength(60);
    const lost: string[] = [];
    const countChanged: string[] = [];
    for (const row of on) {
      const before = off.get(row.key);
      const a = Number(before?.qualityScore?.total) || 0;
      const b = Number(row.plan.qualityScore?.total) || 0;
      if (b < a) lost.push(`${row.key}: ${a}→${b}`);
      if ((before?.meals || []).length !== (row.plan.meals || []).length) {
        countChanged.push(`${row.key}: ${(before?.meals || []).length}→${(row.plan.meals || []).length}`);
      }
    }
    expect(lost.join(', ')).toBe('');
    expect(countChanged.join(', ')).toBe('');
  });
});
