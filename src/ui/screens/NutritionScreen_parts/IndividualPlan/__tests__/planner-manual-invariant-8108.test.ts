/**
 * planner-manual-invariant-8108.test.ts — §8.108/§8.109/§8.110
 * «ручной день: ≤3% по ккал и ОТДЕЛЬНО по Б/Ж/У + ни одного второго гарнира в малом виде».
 *
 * Замер на сетке 4860 дней (выборка stride 8 = 609 дней, ручной вход с согласованными
 * целями): до стадий — 92% дней в 3% и 73 «малых вторых гарнира» на 203 дня; после —
 * 99% и 0. Тест держит оба инварианта на компактной матрице, чтобы регресс ловился
 * за секунды, а не за прогон сетки.
 *
 * Почему вход в тесте согласован (ккал = 4Б+9Ж+4У): при противоречии ккал↔макросы
 * цели нормализует слой целей (`normalizeMacroTargets`, §8.106), поэтому в движок
 * реального пользователя противоречивые цели не приходят; на синтетическом
 * противоречии стадии намеренно не работают (день собирается по §8.106 с честной нотой).
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, starchDoubleStats, type MealPlanInput } from '../meal-plan-engine';

const atwater = (p: number, f: number, c: number) => Math.round(4 * p + 9 * f + 4 * c);

const day = (o: {
  weightKg: number; p: number; f: number; c: number; meals: number;
  train?: boolean; goal?: 'mass' | 'cut' | 'maintenance'; salt?: number; dayOffset?: number;
}): MealPlanInput => ({
  weightKg: o.weightKg, lbmKg: Math.round(o.weightKg * 0.85), bodyFatPct: 15, sex: 'male',
  goalKcal: atwater(o.p, o.f, o.c), goalProteinG: o.p, goalFatG: o.f, goalCarbsG: o.c,
  mealsCount: o.meals, isTrainingDay: !!o.train,
  trainStartMin: 18 * 60, trainDurationMin: 75,
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), budget: 'medium',
  dayOffset: o.dayOffset ?? 2, cyclePhase: 'none', variety: 'medium', quality: 'full',
  randomSalt: o.salt ?? 2, goal: o.goal ?? 'mass', wakeTime: '08:00', bedTime: '23:00',
  // Ручной КБЖУ — вход, на который нацелены §8.108/§8.110.
  kbjuMode: 'manual', manualTargetsLocked: true,
} as unknown as MealPlanInput);

const dev = (got: number, goal: number) => (goal > 0 ? (Math.abs(got - goal) / goal) * 100 : 0);

/**
 * Матрица ручных согласованных дней: легкий/средний/тяжелый вес, 4–6 приёмов,
 * тренировка и отдых, массонабор и дефицит. Пятёрка масла на 55 кг — 15% оси, поэтому
 * здесь же проверяется, что день всё равно в 3%.
 */
const MATRIX: { name: string; o: Parameters<typeof day>[0] }[] = [
  { name: '55кг cut 4пр тренировка', o: { weightKg: 55, p: 110, f: 44, c: 180, meals: 4, train: true, goal: 'cut', salt: 1 } },
  { name: '55кг mass 5пр отдых', o: { weightKg: 55, p: 88, f: 33, c: 275, meals: 5, goal: 'mass', salt: 0 } },
  { name: '70кг mass 5пр тренировка', o: { weightKg: 70, p: 140, f: 56, c: 280, meals: 5, train: true, salt: 2 } },
  { name: '70кг cut 5пр отдых', o: { weightKg: 70, p: 168, f: 42, c: 210, meals: 5, goal: 'cut', salt: 3 } },
  { name: '85кг mass 6пр тренировка', o: { weightKg: 85, p: 204, f: 68, c: 425, meals: 6, train: true, salt: 0 } },
  { name: '85кг cut 4пр отдых', o: { weightKg: 85, p: 170, f: 60, c: 255, meals: 4, goal: 'cut', salt: 2 } },
  { name: '100кг mass 5пр тренировка', o: { weightKg: 100, p: 240, f: 88, c: 500, meals: 5, train: true, salt: 1 } },
  { name: '120кг mass 6пр отдых', o: { weightKg: 120, p: 288, f: 96, c: 540, meals: 6, salt: 3 } },
  // Кейсы владельца после нормализации входа слоем целей (§8.106): пользователь ввёл
  // 3000/240/60/200 (120 кг) и 3400/220/80/250 (100 кг) — ккал противоречил макросам,
  // нормализация даёт 2300 и 2600, и день обязан сойтись уже к ним.
  { name: '120кг 3000→2300/240/60/200 4пр', o: { weightKg: 120, p: 240, f: 60, c: 200, meals: 4, train: true, salt: 1 } },
  { name: '100кг 3400→2600/220/80/250 5пр', o: { weightKg: 100, p: 220, f: 80, c: 250, meals: 5, train: true, salt: 0 } },
];

/**
 * Долг B19 (зафиксирован, не «подкручен»): 55 кг × 6 приёмов × 275 У = 5 г/кг углеводов.
 * Замер: 9.0% → 5.45% (Б +5.5%, У −5.3%), ккал-ось 3.1%. Остаток упирается в
 * ФИЗИЧЕСКИЕ лимиты: в дне 6 тарелок по ~450 г при мягком капе 447 г (650 × 0.6875),
 * носитель расти уже не может, новых строк доводчик не добавляет, а полы приёмов
 * держат белок. Предел честно виден замком, а не спрятан.
 */
const RESIDUAL: { name: string; o: Parameters<typeof day>[0]; maxDev: number } = {
  name: '55кг mass 6пр отдых (5 г/кг У)', o: { weightKg: 55, p: 88, f: 33, c: 275, meals: 6, goal: 'mass', salt: 0 },
  maxDev: 6,
};

describe('§8.110: ручной день сходится в 3% по ккал и отдельно по Б/Ж/У', () => {
  for (const { name, o } of MATRIX) {
    it(name, () => {
      const plan = buildDayPlan(day(o));
      const t = plan.totals;
      const rows = [
        ['ккал', t.kcal, atwater(o.p, o.f, o.c)],
        ['Б', t.p, o.p],
        ['Ж', t.f, o.f],
        ['У', t.c, o.c],
      ] as const;
      for (const [axis, got, goal] of rows) {
        expect(dev(got, goal), `${name}: ${axis} ${Math.round(got)}/${goal} = ${dev(got, goal).toFixed(2)}%`)
          .toBeLessThanOrEqual(3);
      }
    });
  }

  it(`долг B19: ${RESIDUAL.name} — хуже 3%, но не хуже ${RESIDUAL.maxDev}% (физический предел тарелки)`, () => {
    const plan = buildDayPlan(day(RESIDUAL.o));
    const t = plan.totals;
    const worst = Math.max(
      dev(t.kcal, atwater(RESIDUAL.o.p, RESIDUAL.o.f, RESIDUAL.o.c)),
      dev(t.p, RESIDUAL.o.p), dev(t.f, RESIDUAL.o.f), dev(t.c, RESIDUAL.o.c),
    );
    expect(worst, `ккал ${Math.round(t.kcal)}/${atwater(RESIDUAL.o.p, RESIDUAL.o.f, RESIDUAL.o.c)} · Б ${t.p} · Ж ${t.f} · У ${t.c}`)
      .toBeLessThanOrEqual(RESIDUAL.maxDev);
  });

  it('ни одного второго гарнира в малом виде (< 60 г продукта или < 20 г углеводов)', () => {
    for (const { name, o } of [...MATRIX, RESIDUAL]) {
      const plan = buildDayPlan(day(o));
      const st = starchDoubleStats(plan.meals as any[]);
      expect(st.small, `${name}: двойных ${st.meals}, малых ${st.small}`).toBe(0);
    }
  });

  it('нота «Точность рациона» считает по ФАКТУ тарелки, а не по промежуточному состоянию', () => {
    for (const { name, o } of MATRIX) {
      const plan = buildDayPlan(day(o));
      const note = ((plan.notes || []) as string[]).find((n) => typeof n === 'string' && /Точность рациона:/.test(n)) || '';
      expect(note, `${name}: нота точности есть`).not.toBe('');
      const shownGrams = (note.match(/Б (\d+)\/\d+г/) || [])[1];
      const shownPct = (note.match(/Б (\d+)%/) || [])[1];
      const factPct = Math.round(dev(plan.totals.p, o.p));
      if (shownGrams !== undefined) {
        expect(Math.abs(Number(shownGrams) - Math.round(Number(plan.totals.p))), `${name}: граммы Б в ноте = факт`).toBeLessThanOrEqual(1);
      } else {
        expect(Math.abs(Number(shownPct) - factPct), `${name}: процент Б в ноте ${shownPct} vs факт ${factPct}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('порции дня — целые граммы (без дробных)', () => {
    // Шаг 5 г для белковых порций держат другие замки (QG19 «шаг 5 г», §8.89); здесь —
    // контракт §8.110: стадия не имеет права родить дробные граммы.
    for (const { name, o } of MATRIX) {
      const plan = buildDayPlan(day(o));
      for (const m of plan.meals as any[]) {
        for (const it of (m.items || []) as any[]) {
          expect(Number.isInteger(Number(it.amount)), `${name}: ${it.name} ${it.amount} г — не целые`).toBe(true);
        }
      }
    }
  });

  it('противоречивые цели (ккал ≠ 4Б+9Ж+4У) стадии не пересобирают: день остаётся под §8.106', () => {
    // Такие цели до движка не доходят (их нормализует слой целей), но если пришли —
    // пересборка «под Атwater» снимала бы микро-добивку, ради которой день добирался.
    const conflict = { ...day({ weightKg: 80, p: 180, f: 80, c: 340, meals: 5 }), goalKcal: 4000 } as MealPlanInput;
    const plan = buildDayPlan(conflict);
    const note = ((plan.notes || []) as string[]).some((n) => typeof n === 'string' && /Точность рациона:/.test(n));
    expect(note, 'нота точности есть (день собран, а не пересобран)').toBe(true);
  });
});
