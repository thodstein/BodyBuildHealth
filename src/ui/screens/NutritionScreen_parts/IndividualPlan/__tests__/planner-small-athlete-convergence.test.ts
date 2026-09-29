import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { reconcileDay, reconMaxDev, type ReconMeal } from '../planner-day-reconciler';
import { nutCatchupCap, quotaWeightScale, stapleFamilyOf } from '../food-availability';

/**
 * E10 (PRO-план §8, аудит-2): сходимость МАЛЫХ атлетов — углеводная ось.
 *
 * Дефект: на F50-1200 (трен) день застревал на ~13.9% (было в аудите-2 12.4%):
 *   (а) pre-sleep slow_protein (казеин/творог) не был «крутилкой» reconciler'а —
 *       белок выше пола было НЕЧЕМ срезать, а любой рост углеводов тянет белок;
 *   (б) жадный одиночный шаг застревает: срез белка роняет жир/углеводы, рост
 *       углеводов поднимает белок — нужен ПАРНЫЙ обмен в одном принятии;
 *   (в) окно роста углеводов ×1.6 (50→80 г) физически не закрывало углеводную
 *       ось (нужны 80–125 г картофеля); дневные капы орехов/семян блокировали
 *       жировую ось целиком (bluntet-запрет), хотя комната дня почти пустая.
 *
 * Фикс: slow_protein в KNOB_ROLES (пол — граммы БЕЛКА, LBM-масштаб), парные
 * ходы «срез переполненной оси → рост недобранной», окно углеводов ×2.5,
 * комнаты роста орехов/семян от дневного катчелл-капа (делится на позиции).
 * Границы: peri-бюджеты (prew≥20/postw≥25) и MPS/EA/клетчатка не тронуты.
 * E15 (Sep 29 2026): ночной бюджет стал вес-зависимым (28 → 20 г для 50 кг) —
 * F50 T s1 max-dev 8.2→8.4% (углеводная ось s1 −0.6%→−8.4%, закрывается солью s2);
 * см. planner-presleep-weight.
 */

const mk = (id: string, role: string, amount: number, p: number, f: number, c: number): any =>
  ({ id, role, amount, p, f, c, kcal: Math.round(4 * p + 9 * f + 4 * c) });

const sum = (meals: ReconMeal[]): { kcal: number; p: number; f: number; c: number } =>
  meals.reduce((a, m) => { for (const it of m.items) { a.kcal += it.kcal || 0; a.p += it.p || 0; a.f += it.f || 0; a.c += it.c || 0; } return a; }, { kcal: 0, p: 0, f: 0, c: 0 });

describe('E10: reconciler — slow_protein и парный обмен', () => {
  it('slow_protein (pre-sleep) участвует в сведении дня и уважает пол', () => {
    // День: белок (творог pre-sleep) в переборе, углеводы в недоборе, ОДИНОЧНЫЕ
    // ходы не сходятся: срез творога роняет жир ниже цели, рост углеводов тянет
    // белок выше линии. Спасает только паrный ход.
    const meals: ReconMeal[] = [
      { type: 'presleep', items: [mk('cottage', 'slow_protein', 200, 36, 10, 4)] },
      { type: 'lunch', items: [mk('rice', 'carb_slow', 60, 4.2, 0.6, 46.8), mk('almonds', 'fat', 8, 0.8, 4, 0.8)] },
    ];
    const targets = { kcal: 606, p: 30, f: 14, c: 90 };
    const before = reconMaxDev(sum(meals), targets);
    const r = reconcileDay(meals, targets, {
      snap: (_it, g) => Math.max(0, Math.round(g / 5) * 5),
      mainProteinFloor: 40, mealProteinCap: 58, lbmKg: 41, maxIter: 12,
      // жир не растим (нужен независимый «неподвижный» источник — как орехи под капом)
      growCap: (_it, role) => (role === 'fat' ? (_it as any).amount : Infinity),
    });
    const tot = sum(r.meals);
    const cottage = r.meals.find(m => m.type === 'presleep')!.items[0];
    // Пол pre-sleep по lbm 41: 19 г белка → творог ≥ 19/0.18 ≈ 106 г; срез < 200.
    expect(cottage.amount).toBeGreaterThanOrEqual(105);
    expect(cottage.amount).toBeLessThan(200);
    expect(tot.p).toBeLessThan(41);   // белок срезан
    expect(tot.c).toBeGreaterThan(51.6); // углеводы выросли (парный ход)
    expect(r.devPct).toBeLessThan(before);
    expect(r.devPct).toBe(reconMaxDev(sum(r.meals), targets));
  });
});

const f50 = (over: Partial<MealPlanInput>): MealPlanInput => ({
  weightKg: 50, lbmKg: 41, bodyFatPct: 18, sex: 'female',
  goalKcal: 1200, goalProteinG: 100, goalFatG: 36, goalCarbsG: 119,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium', dayOffset: 0, cyclePhase: 'cutting', variety: 'medium', eveningLowCarb: false,
  ...over,
});

const axis = (v: number, t: number) => (t > 0 ? Math.abs(v - t) / t : 0);

describe('E10: F50-1200 — двигатель (интеграция)', () => {
  it('трен день, соль 1: углеводная ось сводится, пол pre-sleep цел, флаг честный', () => {
    // было→стало: max-dev 13.9% → 9.4% (углеводы 102.8/119 = −13.6% → 118/119);
    // остаток — физ-полы peri/pre-sleep (белок/жир ~9%) с честным флагом.
    // было→стало (E15, Sep 29 2026): ночной бюджет для 50 кг 28 → 20 г (вес-зависимый
    // 0.4 г/кг) — день перераспределился: углеводная ось s1 −0.6% → −8.4%, max-dev
    // 8.2→8.4%; ось по-прежнему закрывается солью s2 (−1.2%) — проверяем ниже.
    const inp = f50({ randomSalt: 1 });
    const p = buildDayPlan(inp);
    const dev = Math.max(
      axis(p.totals.kcal, inp.goalKcal), axis(p.totals.p, inp.goalProteinG),
      axis(p.totals.f, inp.goalFatG), axis(p.totals.c, inp.goalCarbsG),
    );
    expect(dev, `max-dev ${(dev * 100).toFixed(1)}%`).toBeLessThanOrEqual(0.10);
    // Углеводная ось сводится на соли 2 (пары/reconciler — механизм E10 цел).
    const p2 = buildDayPlan(f50({ randomSalt: 2 }));
    expect(axis(p2.totals.c, inp.goalCarbsG), `углеводы s2 ${p2.totals.c}/${inp.goalCarbsG}`).toBeLessThanOrEqual(0.03);
    // Pre-sleep: медленный белок не «обнулён» — вес-пол 50 кг (20 г) минус допуск.
    const ps = p.meals.find(m => m.type === 'presleep')!;
    const psP = ps.items.reduce((s, i) => s + i.p, 0);
    expect(psP).toBeGreaterThanOrEqual(18);
    expect(ps.items.some(i => i.role === 'slow_protein')).toBe(true);
    if (!p.withinTolerance) {
      expect(p.notes.some(n => n.includes('«Не сошлось»'))).toBe(true);
    }
  });

  it('день отдыха, соль 2: сходится ≤3% (было 11.4%)', () => {
    const inp = f50({ randomSalt: 2, isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false });
    const p = buildDayPlan(inp);
    expect(p.withinTolerance, `dev=${p.deviationPct}%`).toBe(true);
    expect(p.deviationPct).toBeLessThanOrEqual(3);
  });

  it('орехи/семена дня не превышают дневной катчелл-кап (комнаты роста)', () => {
    for (const salt of [1, 2]) {
      const p = buildDayPlan(f50({ randomSalt: salt }));
      const nutG = p.meals.flatMap(m => m.items)
        .filter(it => ['nuts', 'seeds'].includes(stapleFamilyOf(it.id) || ''))
        .reduce((s, it) => s + it.amount, 0);
      expect(nutG, `соль ${salt}: ${nutG} г`).toBeLessThanOrEqual(nutCatchupCap(quotaWeightScale(50)));
    }
  });

  it('детерминизм: та же соль → тот же день', () => {
    const a = buildDayPlan(f50({ randomSalt: 3 }));
    const b = buildDayPlan(f50({ randomSalt: 3 }));
    expect(JSON.stringify(a.meals)).toBe(JSON.stringify(b.meals));
    expect(a.deviationPct).toBe(b.deviationPct);
  });
});
