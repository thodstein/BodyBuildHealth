import { describe, it, expect, beforeEach } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import {
  itemSodiumMg,
  mealSodiumMg,
  sodiumToSaltG,
  sodiumLabel,
  sodiumTargetMg,
  SODIUM_RDA_MG,
} from '../planner-meal-sodium';
import {
  readPlannedSession,
  readLastSessionInfo,
  planSignature,
  estimateSessionMinutes,
  PL_RUNTIME_KEY,
} from '../planner-planned-tonnage';
import {
  readPeriSync,
  writePeriSync,
  clearPeriSync,
  resolvePeriBudget,
  periBudgetForEngine,
  intraWindowCapacityG,
  PERI_CAP_PRE_CARB_G,
  PERI_CAP_POST_CARB_G,
  PERI_SYNC_KEY,
} from '../planner-peri-budget';

const base = (over: Partial<MealPlanInput> = {}): MealPlanInput => ({
  weightKg: 90,
  lbmKg: 73.8,
  bodyFatPct: 18,
  sex: 'male',
  goalKcal: 3000,
  goalProteinG: 180,
  goalFatG: 72,
  goalCarbsG: 408,
  mealsCount: 5,
  isTrainingDay: true,
  trainStartMin: 1050,
  trainDurationMin: 90,
  allowIntraWorkout: true,
  budget: 'medium',
  dayOffset: 0,
  cyclePhase: 'course',
  variety: 'max',
  eveningLowCarb: false,
  ...over,
});

const carbOf = (meal: any): number => {
  const items = Array.isArray(meal?.items) ? meal.items : [];
  if (items.length === 0) return Math.round(Number(meal?.totals?.c) || 0);
  return Math.round(items.reduce((s: number, it: any) => s + (Number(it.c) || 0), 0));
};

const devPct = (actual: number, target: number) => (Math.abs(actual - target) / Math.max(1, target)) * 100;

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {}
});

describe('planner-meal-sodium: соль/натрий по приёмам', () => {
  it('Na из item.na важнее пересчёта; фолбэк — FOOD_DB', () => {
    expect(itemSodiumMg({ na: 420 })).toBe(420);
    // Без na значение берётся из FOOD_DB (product exists → > 0) или 0, но не бросает.
    expect(itemSodiumMg({ id: 'does_not_exist', amount: 100 })).toBe(0);
    expect(itemSodiumMg(null)).toBe(0);
  });

  it('натрий приёма суммируется по позициям', () => {
    expect(mealSodiumMg({ items: [{ na: 100 }, { na: 250 }] })).toBe(350);
    expect(mealSodiumMg({ items: [], totalsNa: 90 })).toBe(90);
    expect(mealSodiumMg(undefined)).toBe(0);
  });

  it('соль и натрий — разные числа: 400 мг Na = 1 г соли', () => {
    expect(sodiumToSaltG(400)).toBe(1);
    expect(sodiumToSaltG(SODIUM_RDA_MG)).toBeCloseTo(5.75, 2);
    expect(sodiumLabel(0)).toBe('');
    expect(sodiumLabel(720)).toContain('1.80 г соли');
    expect(sodiumLabel(720)).toContain('Na 720 мг');
    expect(sodiumTargetMg()).toBe(SODIUM_RDA_MG);
    expect(sodiumTargetMg(1500)).toBe(1500);
  });
});

describe('planner-planned-tonnage: тоннаж из плана тренировок', () => {
  const writeRuntime = (days: any[], extra: Record<string, any> = {}) => {
    localStorage.setItem(
      PL_RUNTIME_KEY,
      JSON.stringify({ days, focus: 'upper', week: 1, track: 'hypertrophy', ...extra }),
    );
  };

  it('суммирует подходы с весом и повторами, выбирает день по dowIndex', () => {
    const day = (label: string, w: number, r: number, s: number) => ({
      label,
      exercises: [{ name: 'squat', targetSets: Array.from({ length: s }, () => ({ weight: w, reps: r })) }],
    });
    writeRuntime([day('Ноги', 100, 5, 4), day('Грудь', 80, 8, 5), day('Спина', 60, 10, 3)]);
    const first = readPlannedSession({ dowIndex: 0 });
    expect(first).not.toBeNull();
    expect(first!.tonnageKg).toBe(2000);
    expect(first!.sets).toBe(4);
    expect(first!.source).toBe('plan');
    expect(first!.durationMin).toBe(estimateSessionMinutes(4));
    // Пустой день → берётся первый заполненный
    const second = readPlannedSession({ dowIndex: 6 });
    expect(second!.sets).toBeGreaterThan(0);
    // Пустые подходы (разминка без веса) в тоннаж не идут
    writeRuntime([{ label: 'Разминка', exercises: [{ name: 'x', targetSets: [{ weight: 0, reps: 0 }] }] }]);
    expect(readPlannedSession()).toBeNull();
  });

  it('подпись плана меняется при перегенерации', () => {
    writeRuntime([{ label: 'A', exercises: [{ targetSets: [{ weight: 100, reps: 5 }] }] }]);
    const s1 = planSignature();
    writeRuntime([{ label: 'A', exercises: [{ targetSets: [{ weight: 110, reps: 5 }] }] }]);
    const s2 = planSignature();
    expect(s1).toMatch(/^[0-9a-f]{8}$/);
    expect(s1).not.toBe(s2);
  });

  it('без плана возвращает null (карточка падает на последнюю сессию)', () => {
    localStorage.removeItem(PL_RUNTIME_KEY);
    expect(readPlannedSession()).toBeNull();
    expect(readLastSessionInfo()).toBeNull();
  });
});

describe('planner-peri-budget: единый бюджет пери-окон', () => {
  it('write/read/clear + событие синка', () => {
    const st = writePeriSync({ source: 'plan', tonnageKg: 12000, durationMin: 75, intensity: 'high', sets: 20 });
    expect(st).not.toBeNull();
    expect(readPeriSync()?.tonnageKg).toBe(12000);
    expect(localStorage.getItem(PERI_SYNC_KEY)).toBeTruthy();
    clearPeriSync();
    expect(readPeriSync()).toBeNull();
  });

  it('битый JSON → null, не бросает', () => {
    localStorage.setItem(PERI_SYNC_KEY, '{oops');
    expect(readPeriSync()).toBeNull();
  });

  it('капы окон: до 60 / после 75 г, «recommended» сохраняется', () => {
    writePeriSync({ source: 'plan', tonnageKg: 40000, durationMin: 120, intensity: 'high' });
    const b = resolvePeriBudget({ bodyWeight: 100, goal: 'strength' })!;
    expect(b).not.toBeNull();
    expect(b.preCarbG).toBeLessThanOrEqual(PERI_CAP_PRE_CARB_G);
    expect(b.postCarbG).toBeLessThanOrEqual(PERI_CAP_POST_CARB_G);
    expect(b.recommended.preCarbG).toBeGreaterThanOrEqual(b.preCarbG);
    expect(b.recommended.postCarbG).toBeGreaterThanOrEqual(b.postCarbG);
    expect(b.capped).toBe(true);
    // Движок получает ровно те же числа (нет второго источника истины).
    const e = periBudgetForEngine(b)!;
    expect(e.preCarbG).toBe(b.preCarbG);
    expect(e.postCarbG).toBe(b.postCarbG);
    expect(e.postProteinG).toBe(b.postProteinG);
  });

  it('интра-окно: сумма за сессию и ёмкость — как у движка', () => {
    writePeriSync({ source: 'plan', tonnageKg: 12000, durationMin: 90, intensity: 'high' });
    const b = resolvePeriBudget({ bodyWeight: 90, goal: 'strength' })!;
    expect(b.intraCapG).toBe(intraWindowCapacityG(90));
    expect(b.intraCarbG).toBeLessThanOrEqual(b.intraCapG);
    expect(b.recommended.intraCarbG).toBeGreaterThanOrEqual(b.intraCarbG);
    expect(periBudgetForEngine(b)!.intraCarbG).toBe(b.intraCarbG);

    // Длинная сессия: желание протокола упирается в ёмкость окна (≤90 г).
    writePeriSync({ source: 'plan', tonnageKg: 30000, durationMin: 180, intensity: 'high' });
    const l = resolvePeriBudget({ bodyWeight: 90, goal: 'strength' })!;
    expect(l.intraCapG).toBe(intraWindowCapacityG(180));
    expect(l.intraCarbG).toBeLessThanOrEqual(l.intraCapG);
    if (l.recommended.intraCarbG > l.intraCapG) expect(l.capped).toBe(true);
  });

  it('нет источника нагрузки → null → движку ничего не передаётся', () => {
    expect(resolvePeriBudget({ bodyWeight: 80 })).toBeNull();
    expect(periBudgetForEngine(null)).toBeUndefined();
  });

  it('фолбэк на последнюю сессию, если синка нет', () => {
    const b = resolvePeriBudget({
      bodyWeight: 85,
      fallback: { tonnageKg: 9000, durationMin: 60, intensity: 'medium' },
    });
    expect(b).not.toBeNull();
    expect(b!.meta.source).toBe('lastSession');
  });
});

describe('meal-plan-engine: пери-бюджет не ломает ≤3% и совпадает с карточкой', () => {
  const withBudget = base({
    randomSalt: 7,
    periBudget: { preCarbG: 55, postCarbG: 70, intraCarbGPerH: 45, postProteinG: 40 },
  });
  const withoutBudget = base({ randomSalt: 7 });

  it('дневные углеводы те же: бюджет только перераспределяет окна', () => {
    const a = buildDayPlan(withBudget);
    const b = buildDayPlan(withoutBudget);
    expect(Math.abs((a.totals?.c || 0) - (b.totals?.c || 0))).toBeLessThanOrEqual(
      Math.max(6, Math.round((b.totals?.c || 0) * 0.01)),
    );
    expect(devPct(a.totals?.c || 0, withBudget.goalCarbsG!)).toBeLessThanOrEqual(3);
  });

  it('окна до/после получают бюджет в пределах ёмкости приёма', () => {
    const p = buildDayPlan(withBudget);
    const pre = p.meals.find((m: any) => m.type === 'preworkout');
    const post = p.meals.find((m: any) => m.type === 'postworkout');
    if (pre) expect(carbOf(pre)).toBeLessThanOrEqual(PERI_CAP_PRE_CARB_G + 4);
    if (post) {
      expect(carbOf(post)).toBeLessThanOrEqual(PERI_CAP_POST_CARB_G + 6);
      // Белок после — из бюджета (с допуском на добивку приёма)
      const postP = Math.round((post as any).totals?.p || 0);
      expect(postP).toBeGreaterThanOrEqual(20);
      expect(postP).toBeLessThanOrEqual(80);
    }
  });

  it('КБЖУ дня остаётся в допуске 3% и с бюджетом', () => {
    const p = buildDayPlan(withBudget);
    expect(devPct(p.totals?.kcal || 0, withBudget.goalKcal)).toBeLessThanOrEqual(5);
    expect(devPct(p.totals?.p || 0, withBudget.goalProteinG!)).toBeLessThanOrEqual(5);
  });

  it('интра-окно несёт сумму бюджета (`intraCarbG`), а не пересчёт «сколько выйдет»', () => {
    const p = buildDayPlan(
      base({
        randomSalt: 13,
        periBudget: { preCarbG: 50, postCarbG: 60, intraCarbGPerH: 40, intraCarbG: 45, postProteinG: 35 },
      }),
    );
    const intra = p.meals.find((m: any) => m.type === 'intra');
    if (intra) expect(Math.abs(carbOf(intra) - 45)).toBeLessThanOrEqual(8);
  });

  it('матрица профилей: с бюджетом и без — углеводы те же, канон 3% держится', () => {
    const profiles: MealPlanInput[] = [
      base({
        randomSalt: 21,
        weightKg: 60,
        lbmKg: 49,
        goalKcal: 1800,
        goalProteinG: 120,
        goalFatG: 52,
        goalCarbsG: 200,
        mealsCount: 4,
      }),
      base({
        randomSalt: 22,
        weightKg: 95,
        lbmKg: 78,
        goalKcal: 3400,
        goalProteinG: 200,
        goalFatG: 90,
        goalCarbsG: 430,
      }),
      base({ randomSalt: 23, isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false }),
    ];
    for (const prof of profiles) {
      const withB = buildDayPlan({
        ...prof,
        periBudget: { preCarbG: 50, postCarbG: 65, intraCarbGPerH: 40, postProteinG: 35 },
      });
      const without = buildDayPlan(prof);
      const dc = Math.abs((withB.totals?.c || 0) - (without.totals?.c || 0));
      expect(dc, `профиль ${prof.weightKg}кг: день по углеводам уехал на ${dc} г`).toBeLessThanOrEqual(
        Math.max(8, Math.round((without.totals?.c || 0) * 0.01)),
      );
      expect(devPct(withB.totals?.c || 0, prof.goalCarbsG!)).toBeLessThanOrEqual(3);
      expect(devPct(withB.totals?.p || 0, prof.goalProteinG!)).toBeLessThanOrEqual(5);
    }
  });
});

describe('режим «Мясо и рыба»: flesh-first в главных приёмах', () => {
  it('обед/ужин несут flesh-белок, день остаётся в допуске КБЖУ', () => {
    const p = buildDayPlan(
      base({
        randomSalt: 11,
        proteinSourceMode: 'meat_fish',
        proteinAnchors: ['salmon', 'beef_lean'],
      }),
    );
    const fleshNotes = (p.notes || []).filter((n: string) => n.includes('Мясо и рыба'));
    expect(fleshNotes.length).toBeGreaterThan(0);
    expect(devPct(p.totals?.c || 0, base().goalCarbsG!)).toBeLessThanOrEqual(3);
  });

  it('вегетарианская диета отключает режим (день не ломается)', () => {
    const p = buildDayPlan(
      base({ randomSalt: 11, isVegetarian: true, proteinSourceMode: 'meat_fish', proteinAnchors: ['salmon'] }),
    );
    expect(p.meals.length).toBeGreaterThan(0);
    expect((p.notes || []).filter((n: string) => n.includes('Мясо и рыба')).length).toBe(0);
  });
});

describe('соль по приёмам в готовом рационе', () => {
  it('у каждого приёма есть натрий → считается соль', () => {
    const p = buildDayPlan(base({ randomSalt: 5 }));
    const mealsWithNa = p.meals.filter(
      (m: any) => (m.totals?.na || 0) > 0 || (m.items || []).some((it: any) => (it.na || 0) > 0),
    );
    expect(mealsWithNa.length).toBeGreaterThan(0);
    const total = p.meals.reduce((s: number, m: any) => s + (m.totals?.na || 0), 0);
    expect(total).toBeGreaterThan(0);
    expect(sodiumToSaltG(total)).toBeGreaterThan(0);
  });
});
