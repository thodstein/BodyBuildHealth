/**
 * §8.107 — «любой вход, включая ручные цели»: что именно зафиксировано замером.
 *
 * Замер по сетке 405 дней (вес 55/70/85/100/120 × Б 1.6–2.4 × Ж 0.6–1.1 × У 1.5–5.0
 * × ккал 1.0/1.12/0.88 × 4–6 приёмов × mass/cut × трен/отдых) и 2025 тестов движка:
 *
 *  1) ЯВНАЯ цель белка — цифра пользователя. Раньше «повышение до 35% ккал на низкой
 *     калорийности» перетирало её: 55 кг / 1408 ккал / Б88 превращалось в 105–108 г,
 *     и день честно перебирал белок на 19–22%. Теперь boost работает только при
 *     goalProteinG = 0, а при заданной цели печатается нота (§8.107b).
 *  2) БЮДЖЕТЫ ПРИЁМОВ по белку сводятся к коридору цели (0…+2%): сумма бюджетов больше
 *     не может «расползтись» до 111 г при цели 88 (это давало 102–108 г в дне).
 *  3) РАСХОЖДЕНИЕ ккал ↔ макросы называется ВСЕГДА (и когда день сошёлся), с советом
 *     «добавьте ~X г углеводов или ~Y г жиров». Подмены углеводов нет (§8.106).
 *  4) ВИТРИНА «Сводка MPS» и клетчатка сверяются с ФАКТОМ тарелки последней точкой
 *     (раньше отставали на 2 г клетчатки на части дней).
 *
 * Что НЕ зафиксировано (долг, см. аудит §8.107 / B19, B18, B20):
 *  • несогласованный вход (ккал ≠ 4Б+9Ж+4У) сходится в 3% по всем 4 осям только в 20%
 *    дней (54/270; на согласованном входе — 92%, 124/135): сборка идёт под введённые
 *    ккал, а макросы требуют меньше еды. Срез излишка по углеводам (§8.107c) поднимает
 *    это с 17% (46/270) до 20%, но корень — сборка от введённых ккал (B20). Полное
 *    лечение (собирать день под 4Б+9Ж+4У) проверено и откатано: уменьшённая сборка
 *    пробивает полы реализма — 8 красных из 2025 тестов;
 *  • дубль гарнира (B18): 180/405 дней с двумя крахмалами в приёме; свёртка по
 *    углеводам 1:1 на 44%→8% дней, но ломает витрину микро/пластину и снимается.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

const atwater = (p: number, f: number, c: number) => Math.round(4 * p + 9 * f + 4 * c);
const dPct = (a: number, b: number) => (b > 0 ? (Math.abs(a - b) / b) * 100 : 0);

function mk(o: Partial<MealPlanInput> & { weightKg: number; goalKcal: number; goalProteinG: number; goalFatG: number; goalCarbsG: number }): MealPlanInput {
  return {
    lbmKg: Math.round(o.weightKg * 0.85), bodyFatPct: 15, sex: 'male',
    mealsCount: 5, isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 75,
    excludedIds: new Set<string>(), allergenTags: new Set<string>(), budget: 'medium',
    dayOffset: 2, cyclePhase: 'none', variety: 'medium', quality: 'full', randomSalt: 2,
    goal: 'mass', wakeTime: '08:00', bedTime: '23:00',
    ...o,
  } as MealPlanInput;
}

describe('§8.107 явная цель белка — цифра пользователя', () => {
  it('55 кг / 1408 ккал / Б88: белок не перетирается «35% ккал» (было +22%)', () => {
    const t: any = buildDayPlan(mk({ weightKg: 55, goalKcal: 1408, goalProteinG: 88, goalFatG: 44, goalCarbsG: 165, mealsCount: 6, goal: 'cut' })).totals;
    expect(dPct(t.p, 88), `белок ${t.p} при цели 88`).toBeLessThanOrEqual(3.5);
  });

  it('та же цель с 7 приёмами: бюджеты приёмов не «расползаются» выше цели', () => {
    const t: any = buildDayPlan(mk({ weightKg: 55, goalKcal: 1408, goalProteinG: 88, goalFatG: 44, goalCarbsG: 165, mealsCount: 7, goal: 'cut' })).totals;
    expect(dPct(t.p, 88), `белок ${t.p} при цели 88`).toBeLessThanOrEqual(6);
  });

  it('низкая калорийность без заданного белка — boost по-прежнему работает (пол MPS)', () => {
    const t: any = buildDayPlan(mk({ weightKg: 55, goalKcal: 1400, goalProteinG: 0, goalFatG: 44, goalCarbsG: 165, mealsCount: 5, goal: 'cut' })).totals;
    // 35% ккал = 490/4 = 122 г; пол MPS ниже, поэтому проверяем только «не ноль и не меньше 88».
    expect(t.p).toBeGreaterThanOrEqual(88);
  });
});

describe('§8.107 расхождение ккал ↔ макросы называется нотой ВСЕГДА', () => {
  it('несогласованный вход 3000/Б240/Ж100/У150: нота + конкретный совет', () => {
    const day = buildDayPlan(mk({ weightKg: 120, goalKcal: 3000, goalProteinG: 240, goalFatG: 100, goalCarbsG: 150, mealsCount: 4 }));
    const text = (day.notes || []).join(' | ');
    expect(text).toMatch(/⚖️ Ккал = 4Б \+ 9Ж \+ 4У/);
    expect(text).toMatch(/дают 2460 ккал/);
    expect(text).toMatch(/чтобы выйти на 3000 ккал — добавьте ~\d+ г углеводов или ~\d+ г жиров/);
    // Подмены нет: углеводы держат цифру пользователя, а не (3000−4Б−9Ж)/4 = 285.
    expect(dPct((day.totals as any).c, 150)).toBeLessThanOrEqual(10);
    // §8.107: «не сошлось» по ккал-оси не валит вину на пулы/капы — это свойство входа.
    // Нота называет оба числа: ккал против введённых и расхождение по макросам.
    expect(text).toMatch(/«Не сошлось»: ккал-ось \d+ против введённых 3000 \(\d+(\.\d+)?%\)/);
    expect(text).toMatch(/по вашим макросам день в \d+(\.\d+)?%/);
    expect(text).not.toMatch(/пулы\/капы\/полы реализма не дали закрыть цель/);
  });

  it('согласованный вход — ноты про несогласованность НЕТ', () => {
    const aw = atwater(240, 100, 150);
    const day = buildDayPlan(mk({ weightKg: 120, goalKcal: aw, goalProteinG: 240, goalFatG: 100, goalCarbsG: 150, mealsCount: 4 }));
    const text = (day.notes || []).join(' | ');
    expect(text).not.toMatch(/⚖️ Ккал = 4Б \+ 9Ж \+ 4У/);
  });
});

describe('§8.107d витрина MPS/клетчатка = факт тарелки', () => {
  it('клетчатка витрины совпадает с суммой позиций (≤1 г) на разных профилях', () => {
    const cells: Array<Partial<MealPlanInput> & { weightKg: number; goalKcal: number; goalProteinG: number; goalFatG: number; goalCarbsG: number }> = [
      { weightKg: 90, goalKcal: 3000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 340, isTrainingDay: true, randomSalt: 5 },
      { weightKg: 80, goalKcal: 2200, goalProteinG: 160, goalFatG: 70, goalCarbsG: 230, isTrainingDay: false, randomSalt: 1 },
      { weightKg: 60, goalKcal: 1700, goalProteinG: 120, goalFatG: 55, goalCarbsG: 160, isTrainingDay: true, randomSalt: 3 },
    ];
    for (const cell of cells) {
      const p: any = buildDayPlan(mk(cell));
      const fiber = (p.meals as any[]).flatMap(m => m.items || []).reduce((s, it) => s + (it.fiber || 0), 0);
      expect(Math.abs((p.mpsSummary?.fiberG ?? 0) - fiber), `${cell.weightKg}кг: витрина ${p.mpsSummary?.fiberG} vs факт ${fiber.toFixed(1)}`)
        .toBeLessThanOrEqual(1);
    }
  });
});
