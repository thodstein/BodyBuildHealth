import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * §8.121 «жир пери-окна — кап, а не цель» (замок витрины).
 *
 * Дефект (замер 160 дней = 10 профилей × 3–6 приёмов × трен/отдых × авто/ручной):
 * у окон `target.f` — потолок физиологии (5 г предтрен / ≤12 г пост-трен, §8.118), а UI
 * читает цель приёма как `fd ?? f`. После стражи окон предтрен реально несёт 1.5–1.7 г
 * жира, и витрина рисовала «Ж 1.7 / 5 −3» — ложный недобор: **50 бейджей на 50 днях
 * (31 % дней), worst −4.5 г**, все на предтрене. День при этом сходится, ось «жир в окне»
 * зелёная — пользователю нечего исправлять.
 *
 * Правило: у окна (preworkout/postworkout/intra/presleep и инсулин-окна) `fd = 0` —
 * «цели по жиру нет»; UI при `t <= 0` показывает просто граммы. `target.f` (кап) не
 * трогаем: его читают сборка и §8.118. Состав плана от правки не меняется.
 */

const PROFILES = [
  { id: 'p500', w: 110, k: 4600, p: 500, f: 120 },
  { id: 'c1500', w: 110, k: 8370, p: 300, f: 130, c: 1500 },
  { id: 'hugeCarb', w: 100, k: 6700, p: 250, f: 100 },
  { id: 'mass110', w: 110, k: 5200, p: 260, f: 120 },
  { id: 'normal90', w: 90, k: 3000, p: 200, f: 80 },
  { id: 'mid75', w: 75, k: 2400, p: 180, f: 70 },
  { id: 'small60', w: 60, k: 1600, p: 150, f: 45 },
  { id: 'cutF50', w: 50, k: 1240, p: 110, f: 40 },
  { id: 'recomp80', w: 80, k: 2200, p: 200, f: 60 },
  { id: 'keto85', w: 85, k: 2400, p: 180, f: 150 },
];

const WINDOWS = new Set(['preworkout', 'postworkout', 'intra', 'presleep']);

const carbsFor = (p: any) => (p.c && p.c > 0 ? p.c : Math.max(0, Math.round((p.k - 4 * p.p - 9 * p.f) / 4)));

const build = (p: any, mc: number, tr: boolean, manual: boolean): any => buildDayPlan({
  weightKg: p.w, lbmKg: Math.round(p.w * 0.82), bodyFatPct: 18, sex: 'male',
  goalKcal: p.k, goalProteinG: p.p, goalFatG: p.f, goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
} as unknown as MealPlanInput);

const DAYS = PROFILES.flatMap((p) => [4, 5, 6].flatMap((mc) => [true, false].map((tr) => ({
  key: `${p.id}/${mc}/${tr ? 'тр' : 'отд'}`,
  p, mc, tr,
  auto: build(p, mc, tr, false),
  manual: build(p, mc, tr, true),
}))));

describe('§8.121 жир окна — кап, а не цель (витрина)', () => {
  it('ни одного ложного бейджа «недобор жира» в окнах (было 50 на 160 днях)', () => {
    const bad: string[] = [];
    let windows = 0;
    for (const d of DAYS) {
      for (const plan of [d.auto, d.manual]) {
        for (const m of (plan.meals || []) as any[]) {
          if (!WINDOWS.has(String(m.type)) && !m._insulinWindow) continue;
          const t = m.target || {};
          const tv = Number((t as any).fd ?? t.f);
          const v = Number(m.totals?.f) || 0;
          if (!Number.isFinite(tv) || tv <= 0) continue;
          windows++;
          // Бейдж загорается при |факт − цель| > 3 г (UI: окно ±3 г, меньше 1 г — молчит).
          if (Math.abs(v - tv) > 3) bad.push(`${d.key} ${m.type}: Ж ${v.toFixed(1)} / ${tv}`);
        }
      }
    }
    expect(windows, 'окон с целью по жиру быть не должно').toBe(0);
    expect(bad.slice(0, 5).join(' | ')).toBe('');
  });

  it('у окон fd = 0 («цели по жиру нет»), у основных приёмов fd > 0 и Σ ≤ дневного жира', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const plan = d.auto;
      const meals = (plan.meals || []) as any[];
      let sumFd = 0;
      let regs = 0;
      for (const m of meals) {
        const isWin = WINDOWS.has(String(m.type)) || !!m._insulinWindow;
        const fd = (m.target as any)?.fd;
        if (isWin) {
          if (fd !== 0) bad.push(`${d.key} ${m.type}: fd ${String(fd)} (ожидалось 0)`);
          continue;
        }
        if (!Number.isFinite(Number(fd))) { bad.push(`${d.key} ${m.type}: fd отсутствует`); continue; }
        regs++;
        sumFd += Number(fd);
      }
      expect(regs).toBeGreaterThanOrEqual(3);
      if (sumFd > d.p.f + meals.length) bad.push(`${d.key}: Σfd ${sumFd} > цели ${d.p.f}`);
    }
    expect(bad.slice(0, 6).join(' | ')).toBe('');
  });
});
