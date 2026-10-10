/**
 * planner-recipe-portion-drift.test.ts — §4.4 «легаси-дрейф порций рецептурного пути».
 *
 * Дефект (docs/NUTRITION-PLANNER-PRO-AUDIT-2026-10.md): финальная «посадка»
 * рецептурного дня масштабировала ядра рецептов в коридоре ±10% (кумулятивно) —
 * авторские порции уезжали на ~12%, тогда как продуктовый путь сходится в ≤3%
 * вообще без дрейфа порций.
 *
 * Решение: коридор посадки сужен до ±5% (остаток сходимости добирают поздние
 * проходы — extremeCarbTopUp/снэки, а не распухание порции). Лок держит границу:
 * ни одна нота «⚖️ Порция … ×N%» не выходит за ±5%.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals } from '../planner-recipe-mode';
import { RECIPE_DB } from '../../../../../data/recipe-db';

const base = (over: any = {}): MealPlanInput => ({
  weightKg: 120, lbmKg: 100, bodyFatPct: 16, sex: 'male' as const,
  goalKcal: 8900, goalProteinG: 500, goalFatG: 100, goalCarbsG: 1500,
  mealsCount: 10, isTrainingDay: false, budget: 'max' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3, carbCapGPerKg: 0,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
} as any);

const assemble = (inp: MealPlanInput) => {
  const src = buildDayPlan(inp);
  const meals = (src.meals as any[]).map((m: any) => ({
    ...m, items: (m.items || []).map((i: any) => ({ ...i })), totals: { ...m.totals },
  }));
  return assembleRecipeDay({
    meals, pool: RECIPE_DB as any,
    targets: { kcal: (inp as any).goalKcal, p: (inp as any).goalProteinG, f: (inp as any).goalFatG, c: (inp as any).goalCarbsG },
    excludedIds: new Set<string>(), trainDay: !!inp.isTrainingDay, athleteWeightKg: (inp as any).weightKg,
    seed: 3, goal: 'mass', sex: 'male',
  } as any);
};

// Максимальное отклонение порции от авторской (по нотам «⚖️ Порция ×N%»).
const maxPortionDrift = (notes: string[]): number => {
  let max = 0;
  for (const n of notes) {
    const m = n.match(/×(\d+)%/);
    if (m) max = Math.max(max, Math.abs(Number(m[1]) - 100));
  }
  return max;
};

const CELLS: Array<[string, MealPlanInput]> = [
  ['R-1500 rest', base()],
  ['R-1500 train', base({ isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90, allowIntraWorkout: true })],
  ['plain 3500', base({ weightKg: 95, lbmKg: 80, goalKcal: 3600, goalProteinG: 200, goalFatG: 95, goalCarbsG: 490, goal: 'mass' })],
  ['plain 2600', base({ weightKg: 85, lbmKg: 72, goalKcal: 2600, goalProteinG: 175, goalFatG: 80, goalCarbsG: 320 })],
  ['plain 2600 s0', base({ weightKg: 85, lbmKg: 72, goalKcal: 2600, goalProteinG: 175, goalFatG: 80, goalCarbsG: 320, randomSalt: 0 })],
];

describe('§4.4/§4.6 коридор порций ≤3% и сходимость рецептурного пути', () => {
  for (const [label, inp] of CELLS) {
    it(`${label}: ни одна порция не уезжает от авторской больше чем на 3%`, () => {
      const res = assemble(inp);
      const drift = maxPortionDrift(res.notes);
      expect(drift, `ноты: ${res.notes.filter(n => /×\d+%/.test(n)).join(' | ')}`).toBeLessThanOrEqual(3);
    });
  }

  it('сходимость дня: обычные клетки ≤4%, экстрим — в честном капе', () => {
    for (const [label, inp] of CELLS) {
      const res = assemble(inp);
      const t = sumDayTotals(res.meals as any);
      const target = (inp as any).goalKcal;
      // Экстрим-R-HV — документированный honest-cap (effective-цель vs цель пользователя);
      // обычные дни — 4% порог из ЗАМЕРА (база с коридором ±10% давала 5.4% на s0 и 5.1%
      // на 3500; порог усилен относительно базы, не ослаблен).
      const isExtreme = label.startsWith('R-1500');
      const dev = Math.abs(t.kcal - target) / target * 100;
      expect(dev, `${label}: kcal ${Math.round(t.kcal)}/${target} (${dev.toFixed(1)}%)`).toBeLessThanOrEqual(isExtreme ? 30 : 4);
    }
  });

  it('§4.6: жир/углеводный перекос обычного дня сведён свопом не-ядрового сайда', () => {
    // Было (замер): plain 2600 финишировал с Ж +4.1% при У −4.0% — ребаланс молчал
    // (порог 120 ккал). Стало: не-ядровой жировой сайд меняется на углеводный носитель
    // с ккал-паритетом, оси сходятся.
    const res = assemble(CELLS.find(c => c[0] === 'plain 2600')![1]);
    const t = sumDayTotals(res.meals as any);
    const goal = { f: 80, c: 320 };
    const devF = Math.abs(t.f - goal.f) / goal.f * 100;
    const devC = Math.abs(t.c - goal.c) / goal.c * 100;
    expect(devF, `Ж ${Math.round(t.f)}/${goal.f} (${devF.toFixed(1)}%)`).toBeLessThanOrEqual(3);
    expect(devC, `У ${Math.round(t.c)}/${goal.c} (${devC.toFixed(1)}%)`).toBeLessThanOrEqual(3);
  });

  it('детерминизм: тот же вход → тот же дрейф и та же сходимость', () => {
    const a = assemble(CELLS[1][1]);
    const b = assemble(CELLS[1][1]);
    expect(maxPortionDrift(a.notes)).toBe(maxPortionDrift(b.notes));
    expect(a.deviationPct).toBe(b.deviationPct);
  });
});

/**
 * §7.2-Р (R-HV: жир ядер рецептов). Экстрим-полоса (1500У/500Б) финишировала с
 * Ж +18.9% при сходящихся kcal/P/C: жир дня на 1 г/кг структурно мал, а порция
 * ядра масштабировалась с жировым капом ×1.5 (молочная каша/шницель с яйцом
 * перебирали +9–15 г к цели приёма), нулевая жировая цель приёма (перед сном)
 * вовсе игнорировалась (фолбэк `tgt.f || 15` → ×1.7), а гейт «Жир дня ×1.05»
 * умирал ДО микро-добавки (семечки ≤25 г = +12 г жира) и не видел семечки
 * ребаланса (role 'veg'). Путь к сходимости — рецепты с меньшим жиром ядра
 * (дистанция подбора теперь весит жир ядра — carbRoomScore fOver).
 *
 * Замер «было → стало» (R-1500 rest): Ж 119 г (+18.9%) → 111 г (+9.9%);
 * kcal 8686 (−2.4%) → 8840 (−0.7%); дрейф порций 3% → 0.
 */
describe('§7.2-Р: жир ядер на экстрим-полосе (R-HV)', () => {
  const assembler = (label: string) => {
    const inp = CELLS.find(c => c[0] === label)![1];
    const res = assemble(inp);
    return { res, t: sumDayTotals(res.meals as any), g: inp as any };
  };

  it('R-1500 rest: жир ядра в пределах ×1.15 цели приёма — день сходится по Ж ≤11%', () => {
    const { res, t, g } = assembler('R-1500 rest');
    const devF = Math.abs(t.f - g.goalFatG) / g.goalFatG * 100;
    // было +18.9% — стало ≤11% (порция ядра не растится жиром; остаток — жир
    // не-ядровых сайдов, которые гейт §3E приводит к цели ×1.05).
    expect(devF, `Ж ${Math.round(t.f)}/${g.goalFatG} (${devF.toFixed(1)}%)`).toBeLessThanOrEqual(11);
    // Сходимость по остальным осям не хуже базлайна (≤4%).
    for (const [axis, val, goal] of [['kcal', t.kcal, g.goalKcal], ['P', t.p, g.goalProteinG], ['C', t.c, g.goalCarbsG]] as const) {
      const dev = Math.abs(val - goal) / goal * 100;
      expect(dev, `${axis} ${Math.round(val)}/${goal} (${dev.toFixed(1)}%)`).toBeLessThanOrEqual(4);
    }
    expect(maxPortionDrift(res.notes)).toBeLessThanOrEqual(3);
  });

  it('R-1500 train: сходимость не хуже базлайна ±0.8 п.п. (было dev 2.3%)', () => {
    const { res, t, g } = assembler('R-1500 train');
    const dev = Math.abs(t.kcal - g.goalKcal) / g.goalKcal * 100;
    const devP = Math.abs(t.p - g.goalProteinG) / g.goalProteinG * 100;
    const devF = Math.abs(t.f - g.goalFatG) / g.goalFatG * 100;
    const devC = Math.abs(t.c - g.goalCarbsG) / g.goalCarbsG * 100;
    expect(res.deviationPct, `dev=${res.deviationPct}`).toBeLessThanOrEqual(3.1);
    for (const [axis, d] of [['kcal', dev], ['P', devP], ['F', devF], ['C', devC]] as const) {
      expect(d, `${axis} ${d.toFixed(1)}%`).toBeLessThanOrEqual(4);
    }
  });
});
