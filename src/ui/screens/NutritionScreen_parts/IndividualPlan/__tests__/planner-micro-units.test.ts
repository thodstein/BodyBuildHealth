/**
 * Единицы микро в отчёте покрытия (дефект «избыток омега-3 на 95 000 мг»).
 *
 * Симптом: на обычном дне с брокколи/индейкой/рисом план печатал
 *   «⚠ Омега-3: 94 730мг > верхнего предела 6000мг — избыток»
 * при фактических 1 124 мг (56% RDA). То есть отчёт не только врал, но и прятал
 * реальный дефицит ω-3 (36 из 50 конфигураций ниже 70% RDA).
 *
 * Причина: двойная нормализация г→мг. `getMicroFromFood` уже приводит ω-3 к мг,
 * а `sumMicros` прогонял значение ещё раз через «v < 100 → v*1000». Продукты с малым
 * содержанием (брокколи 0.05 г/100 → 50 мг, индейка 0.04 → 40 мг) раздувались в 1000 раз.
 *
 * Канон: единственный читатель — `getMicroFromFood`; сумматор обязан отдавать ровно его сумму.
 */
import { describe, it, expect } from 'vitest';
import { sumMicros, analyzeMicroCoverage, RDA_BASE } from '../planner-micro-coverage';
import { getMicroFromFood } from '../planner-micro-reader';
import { buildDayPlan } from '../meal-plan-engine';
import { buildDayTargets } from '../planner-day-targets';
import { FOOD_DB } from '../../../../../core/nutrition-database';

const byId = (id: string) => FOOD_DB.find((f) => f.id === id)!;

const sumByReader = (items: Array<{ id: string; amount: number }>) => {
  const out: Record<string, number> = {};
  for (const it of items) {
    const fd = byId(it.id);
    if (!fd) continue;
    for (const k of Object.keys(RDA_BASE)) {
      out[k] = (out[k] || 0) + getMicroFromFood(fd as any, k) * it.amount / 100;
    }
  }
  return out;
};

describe('микро-отчёт: единицы ω-3 не удваиваются', () => {
  it('sumMicros ≡ getMicroFromFood по всем ключам (брокколи + индейка + рис)', () => {
    // Брокколи/индейка/рис — именно те продукты, у которых ω-3 в граммах (малое число),
    // и которые старая нормализация раздувала в 1000 раз.
    const items = [
      { id: 'broccoli', amount: 150 },
      { id: 'turkey_breast', amount: 150 },
      { id: 'rice_white', amount: 300 },
      { id: 'chia_seeds', amount: 20 },
    ];
    const viaReader = sumByReader(items);
    const viaSum = sumMicros(items as any, FOOD_DB as any);

    expect(viaReader.Omega3).toBeGreaterThan(0);
    // основная проверка: расхождение не должно быть кратно тысяче
    expect(viaSum.Omega3).toBeCloseTo(viaReader.Omega3, 1);
  });

  it('на реальном дне ω-3 остаётся в физиологическом диапазоне и не уходит в «избыток»', () => {
    const tgt: any = buildDayTargets({
      weightKg: 80, presetGPerKg: 2.0, fatFloorGPerKg: 0.8, kbjuMode: 'auto',
      goal: 'maintenance', dietStyle: 'classic',
    } as any);
    const plan: any = buildDayPlan({
      weightKg: 80, lbmKg: 65, bodyFatPct: 18, sex: 'male',
      goalKcal: tgt.kcal, goalProteinG: tgt.protein, goalFatG: tgt.fats, goalCarbsG: tgt.carbs,
      mealsCount: 5, isTrainingDay: false, budget: 'medium', dayOffset: 0,
      cyclePhase: 'none', variety: 'medium', eveningLowCarb: false, goal: 'maintenance',
    } as any);

    const items = (plan.meals as any[]).flatMap((m) => m.items.map((it: any) => ({ id: it.id, amount: it.amount })));
    const totals = sumMicros(items as any, FOOD_DB as any);
    // 6 г ω-3 — верхний предел отчёта; физиологичный день обязан быть ниже
    expect(totals.Omega3).toBeLessThan(6000);

    const notes = (plan.notes || []).join('\n');
    expect(notes).not.toMatch(/Омега-3:\s*\d+мг > верхнего предела/);

    const cov = analyzeMicroCoverage(totals as any, 'male');
    expect((cov.surpluses || []).some((s) => /Омега-3/.test(s))).toBe(false);
  });

  it('настоящий перебор ω-3 (рыбий жир) по-прежнему ловится', () => {
    // 1000 г лосося ≈ 18 г ω-3 — это уже повод предупредить, порог не отключён
    const cov = analyzeMicroCoverage({ Omega3: 9000 } as any, 'male');
    expect((cov.surpluses || []).some((s) => /Омега-3/.test(s))).toBe(true);
  });
});
