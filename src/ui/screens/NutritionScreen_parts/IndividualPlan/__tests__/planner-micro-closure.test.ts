/**
 * planner-micro-closure.test.ts — §4.1 «призрак микро-добавки» (docs/NUTRITION-PLANNER-PRO-AUDIT-2026-10.md).
 *
 * Дефект: нота «🧬 добавлен лосось 100 г → закрытие дефицита VitD» утверждала продукт,
 * которого в финальной тарелке не было: поздние проходы (типология «овощи — 1 пункт»,
 * клетчаточный кап, P4b) ужимали/удаляли добавку, а нота оставалась с исходными граммами.
 *
 * Фикс (meal-plan-engine):
 *  1) защита _fixedGrams включается ТОЛЬКО при ккал-комнате — день на момент добавки
 *     ниже 90% цели (план аудита). Замер матрицы: пулы сходятся к макросам ДО
 *     микро-прохода, поэтому на сходящихся днях защиты нет — иначе сдвигались
 *     калиброванные локи (контроль 2830 → 2717 при прошлой попытке защиты всегда).
 *     Комната появляется на недособранных днях и в ручном режиме (ккал-цель выше
 *     формулы макросов) — там закрытие дефицита реально доезжает до тарелки;
 *  2) deferred-пересчёт ноты в конце buildDayPlan: граммы читаются с фактического
 *     item'а (payload-маркер _microClosure переживает spread-клоны корректора) —
 *     ужали → честные граммы, удалили → advisory-совет вместо лжи.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

const base = (over: any = {}): MealPlanInput => ({
  weightKg: 80, lbmKg: 68, bodyFatPct: 15, sex: 'male' as const,
  goalKcal: 3000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 380,
  mealsCount: 5, isTrainingDay: false, budget: 'medium' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3, carbCapGPerKg: 0,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
} as any);

// Первое вхождение «<цифры>г» после 🧬 — граммы добавки в ноте.
const NOTE_GRAMS = /^🧬 .*?(\d+)г/;

// Сходящиеся дни: пулы уже собрали цель — защиты нет, нота обязана быть советом.
const CONVERGED: Array<[string, MealPlanInput]> = [
  ['control3000', base({ weightKg: 90, lbmKg: 75, bodyFatPct: 14, goalKcal: 3000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 340, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90, allowIntraWorkout: true })],
  ['cut1500#0', base({ weightKg: 80, lbmKg: 68, goalKcal: 1600, goalProteinG: 170, goalFatG: 55, goalCarbsG: 145, goal: 'cut', randomSalt: 0 })],
  ['cut1500#3', base({ weightKg: 80, lbmKg: 68, goalKcal: 1600, goalProteinG: 170, goalFatG: 55, goalCarbsG: 145, goal: 'cut', randomSalt: 3 })],
  ['maint3000#3', base({ randomSalt: 3 })],
  ['mass4200#0', base({ weightKg: 110, lbmKg: 92, goalKcal: 4200, goalProteinG: 230, goalFatG: 105, goalCarbsG: 590, goal: 'mass', randomSalt: 0 })],
  ['femaleCut1500#0', base({ sex: 'female', weightKg: 58, lbmKg: 45, goalKcal: 1500, goalProteinG: 130, goalFatG: 52, goalCarbsG: 150, goal: 'cut', cyclePhase: 'luteal', randomSalt: 0 })],
  ['veget2400#3', base({ isVegetarian: true, goalKcal: 2400, goalProteinG: 155, goalFatG: 72, goalCarbsG: 280, randomSalt: 3 })],
];

// Ндособранные дни (ручной КБЖУ: ккал-цель выше формулы макросов) — есть комната,
// защита _fixedGrams включается, закрытие дефицита доезжает до тарелки.
const ROOM: Array<[string, MealPlanInput]> = [
  ['manualKcal4000', base({ kbjuMode: 'manual', manualTargetsLocked: true, goalKcal: 4000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 340 })],
  ['manualKcal4000#0', base({ kbjuMode: 'manual', manualTargetsLocked: true, goalKcal: 4000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 340, randomSalt: 0 })],
  ['manualKcal4000#7', base({ kbjuMode: 'manual', manualTargetsLocked: true, goalKcal: 4000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 340, randomSalt: 7 })],
];

const microNote = (plan: any): string | undefined =>
  (plan.notes as string[]).find(n => /закрытие дефицита|не влез в калорийность|ужат поздними/.test(n || ''));

// Фактический пункт микро-добавки в тарелке (маркер переживает клоны корректора).
const microItem = (plan: any): any =>
  (plan.meals as any[]).flatMap(m => (m.items || [])).find((it: any) => (it as any)._microClosure);

describe('§4.1 «призрак микро-добавки» — нота описывает фактическую тарелку', () => {
  for (const [label, inp] of [...CONVERGED, ...ROOM]) {
    it(`${label}: нота = факт (🧬 с реальными граммами ИЛИ совет)`, () => {
      const p = buildDayPlan(inp);
      const note = microNote(p);
      if (!note) return;
      const item = microItem(p);
      if (note.startsWith('🧬')) {
        expect(item, `${label}: нота утверждает добавку, но пункта нет в тарелке`).toBeTruthy();
        const claimed = Number((note.match(NOTE_GRAMS) || [])[1]);
        expect(Number.isFinite(claimed), `${label}: не разобрать граммы ноты: ${note}`).toBe(true);
        expect(Math.round(item.amount), `${label}: нота ${claimed}г vs тарелка ${item.amount}г`).toBe(claimed);
        if (/ужат поздними проходами/.test(note)) {
          expect(note).toMatch(/из \d+ г — ужат поздними проходами/);
        }
      } else {
        // Пункт не влез — нота НЕ утверждает продукт (совет, а не ложь).
        expect(note).toMatch(/не влез в калорийность дня/);
        expect(item).toBeFalsy();
      }
    });
  }

  it('KEPT: на дне с ккал-комнатой защита _fixedGrams держит пункт — closure работает', () => {
    const p = buildDayPlan(ROOM[0][1]);
    const note = microNote(p);
    const item = microItem(p);
    expect(note, 'ожидали 🧬-closed на дне с комнатой').toBeTruthy();
    expect(note!.startsWith('🧬')).toBe(true);
    expect(item).toBeTruthy();
    expect((item as any)._fixedGrams).toBeGreaterThan(0);
    const claimed = Number((note!.match(NOTE_GRAMS) || [])[1]);
    expect(Math.round(item.amount)).toBe(claimed);
  });

  it('калиброванный контрольный день (90кг/3000 train) byte-identical: 2830/186.6/75.8/350.3', () => {
    // Защита НЕ включается на сходящемся дне — состав дня не двигается (прошлая
    // попытка защиты «всегда» давала 2717). Нота при этом честная (совет).
    const p = buildDayPlan(CONVERGED[0][1]);
    expect(p.totals.kcal).toBe(2830);
    expect(p.totals.p).toBe(186.6);
    expect(p.totals.f).toBe(75.8);
    expect(p.totals.c).toBe(350.3);
    const note = microNote(p);
    if (note) expect(note.startsWith('🧬')).toBe(false);
  });

  it('сходящиеся дни: ни одной 🧬-ноты без пункта в тарелке', () => {
    for (const [label, inp] of CONVERGED) {
      const p = buildDayPlan(inp);
      for (const n of (p.notes as string[])) {
        if (!n.startsWith('🧬')) continue;
        const item = microItem(p);
        expect(item, `${label}: «${n}» без пункта в тарелке`).toBeTruthy();
        const claimed = Number((n.match(NOTE_GRAMS) || [])[1]);
        expect(Math.round(item!.amount), `${label}: «${n}» vs ${item!.amount}г`).toBe(claimed);
      }
    }
  });

  it('детерминизм: тот же вход → та же нота и та же тарелка', () => {
    for (const [label, inp] of [...CONVERGED, ...ROOM]) {
      const a = buildDayPlan(inp);
      const b = buildDayPlan(inp);
      expect(microNote(a), label).toBe(microNote(b));
      expect(a.totals.kcal, label).toBe(b.totals.kcal);
    }
  });

  it('план остаётся JSON-serializable (маркер не делает круговую ссылку)', () => {
    // payload-маркер лежит НА item'е и НЕ содержит его — иначе localStorage/
    // cloud-kv падали на «Converting circular structure to JSON».
    for (const [label, inp] of [...CONVERGED, ...ROOM]) {
      const p = buildDayPlan(inp);
      let json = '';
      expect(() => { json = JSON.stringify(p); }, label).not.toThrow();
      expect(json.length, label).toBeGreaterThan(100);
      const item = microItem(p);
      if (item) {
        expect(JSON.stringify((item as any)._microClosure), label).not.toContain('_microClosure');
        expect((item as any)._microClosure.item, label).toBeUndefined();
      }
    }
  });
});
