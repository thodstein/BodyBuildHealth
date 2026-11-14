/**
 * §8.106 — «при любом КБЖУ должно работать».
 *
 * Контракт движка:
 *  1) макросы пользователя (Б/Ж/У) НИКОГДА не переписываются;
 *  2) ккал — следствие: 4Б + 9Ж + 4У. Если введённые ккал противоречат макросам,
 *     день сходится к макросам, а про расхождение движок говорит нотой
 *     («⚖️ Ккал = 4Б + 9Ж + 4У … чтобы выйти на N ккал — добавьте ~X г углеводов»);
 *  3) при ЛЮБОМ сочетании целей день остаётся днём из еды (не «добивается» углеводами,
 *     выведенными из ккал).
 *
 * Регресс владельца: цели 3000 ккал / Б240 / Ж100 / У150 → план давал У ≈ 279
 * («+150 углеводов»), потому что углеводы молча выводились из ккал:
 * (3000 − 4×240 − 9×100)/4 = 285 г вместо заявленных 150.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, normalizeMacroTargets, type MealPlanInput } from '../meal-plan-engine';

const atwater = (p: number, f: number, c: number) => Math.round(4 * p + 9 * f + 4 * c);
const dPct = (a: number, b: number) => (b > 0 ? (Math.abs(a - b) / b) * 100 : 0);

function mk(w: number, kcal: number, p: number, f: number, c: number, meals = 5): MealPlanInput {
  return {
    weightKg: w, lbmKg: Math.round(w * 0.85), bodyFatPct: 15, sex: 'male',
    goalKcal: kcal, goalProteinG: p, goalFatG: f, goalCarbsG: c,
    mealsCount: meals, isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 75,
    excludedIds: new Set<string>(), allergenTags: new Set<string>(), budget: 'medium',
    dayOffset: 2, cyclePhase: 'none', variety: 'medium', quality: 'full', randomSalt: 2,
    goal: 'mass', wakeTime: '08:00', bedTime: '23:00',
  } as MealPlanInput;
}

describe('§8.106 ккал = 4Б + 9Ж + 4У: макросы не переписываются', () => {
  it('нормализация сохраняет макросы и приводит ккал к 4Б+9Ж+4У', () => {
    const n = normalizeMacroTargets(3000, 240, 100, 150);
    expect(n.p).toBe(240);
    expect(n.f).toBe(100);
    expect(n.c).toBe(150);           // было 285 (выведено из ккал)
    expect(n.kcal).toBe(atwater(240, 100, 150)); // 2460
    expect(n.source).toBe('macro-derived-kcal');
    expect(n.inputDeviationPct).toBeGreaterThan(3);
  });

  it('согласованные цели не трогаются вообще', () => {
    const kcal = atwater(180, 80, 345);
    const n = normalizeMacroTargets(kcal, 180, 80, 345);
    expect([n.kcal, n.p, n.f, n.c]).toEqual([kcal, 180, 80, 345]);
    expect(n.source).toBe('consistent');
  });

  it('регресс владельца: 3000/240/100/150 → углеводы держат цель, а не 285 из ккал', () => {
    const day = buildDayPlan(mk(120, 3000, 240, 100, 150, 4));
    const t = day.totals as any;
    const derivedFromKcal = Math.round((3000 - 4 * 240 - 9 * 100) / 4); // 285 — то, что было
    expect(derivedFromKcal).toBe(285);
    // Было У 279 (+86%). Стало 163 г (+8.9%): подмены нет, остаток — это излишек
    // ккал-цели (3000 при макросах 2460), который честно назван нотой (долг B19).
    expect(dPct(t.c, 150)).toBeLessThanOrEqual(10);
    expect(t.c).toBeLessThanOrEqual(190);
    expect(dPct(t.f, 100)).toBeLessThanOrEqual(3);   // жир держит цель
    const text = (day.notes || []).join(' | ');
    expect(text).toMatch(/Ккал = 4Б \+ 9Ж \+ 4У/);
    expect(text).toMatch(/чтобы выйти на 3000 ккал/);
  });

  it('те же макросы с СХОДЯЩИМИСЯ ккал (2460) — день точный по всем осям', () => {
    // «при любом КБЖУ работает»: если цели не противоречат друг другу, канон держится.
    const aw = atwater(240, 100, 150); // 2460
    const t: any = buildDayPlan(mk(120, aw, 240, 100, 150, 4)).totals;
    expect(dPct(t.c, 150)).toBeLessThanOrEqual(3);
    expect(dPct(t.f, 100)).toBeLessThanOrEqual(3);
    expect(dPct(t.p, 240)).toBeLessThanOrEqual(3);
    expect(dPct(t.kcal, aw)).toBeLessThanOrEqual(3);
  });

  it('согласованные цели держат канон по всем осям (правка их не касается)', () => {
    const cells: Array<[number, number, number, number]> = [
      [80, 160, 70, 240],
      [100, 200, 80, 300],
    ];
    for (const [w, p, f, c] of cells) {
      const aw = atwater(p, f, c);
      const t: any = buildDayPlan(mk(w, aw, p, f, c)).totals;
      expect(dPct(t.c, c), `${w}кг У`).toBeLessThanOrEqual(3);
      expect(dPct(t.f, f), `${w}кг Ж`).toBeLessThanOrEqual(3);
      expect(dPct(t.kcal, aw), `${w}кг ккал`).toBeLessThanOrEqual(3);
      expect(p - t.p, `${w}кг недобор Б`).toBeLessThanOrEqual(p * 0.03);
    }
  });

  it('несогласованный вход (±12% ккал) не уводит макросы в «выведенные из ккал»', () => {
    // Канон 3% для несогласованного входа недостижим по определению (ккал и макросы
    // противоречат друг другу). Замок фиксирует отсутствие ПОДМЕНЫ: макросы держатся
    // в пределах 10%, а углеводы никогда не прыгают к «(ккал − 4Б − 9Ж)/4».
    const cells: Array<[number, number, number, number, number]> = [
      [85, 1.12, 170, 68, 255],
      [85, 0.88, 170, 68, 255],
      [70, 1.12, 140, 56, 210],
      [100, 1.12, 200, 80, 300],
      [55, 1.12, 88, 33, 165],
    ];
    const bad: string[] = [];
    for (const [w, kf, p, f, c] of cells) {
      const aw = atwater(p, f, c);
      const kcal = Math.round(aw * kf);
      const t: any = buildDayPlan(mk(w, kcal, p, f, c)).totals;
      const derived = Math.max(0, Math.round((kcal - 4 * p - 9 * f) / 4));
      const dC = dPct(t.c, c);
      if (dC > 10) bad.push(`${w}кг: У ${t.c} vs ${c} (${dC.toFixed(1)}%)`);
      if (Math.abs(t.c - derived) < 8 && Math.abs(derived - c) > 20) bad.push(`${w}кг: У=${t.c} ≈ «выведенные из ккал» ${derived}`);
      if (dPct(t.f, f) > 12) bad.push(`${w}кг: Ж ${t.f} vs ${f} (${dPct(t.f, f).toFixed(1)}%)`);
      if (dPct(t.kcal, aw) > 12) bad.push(`${w}кг: ккал ${t.kcal} vs 4Б+9Ж+4У ${aw} (${dPct(t.kcal, aw).toFixed(1)}%)`);
    }
    expect(bad).toEqual([]);
  });
});
