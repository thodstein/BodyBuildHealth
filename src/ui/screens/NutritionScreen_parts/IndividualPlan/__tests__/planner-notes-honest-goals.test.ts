import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';

/**
 * B38 (этап 0 анализа сходимости, 2026-10): «честная отчётность».
 *
 * Две жалобы-симптома, которые пользователь читал как «сходимость >3%»:
 *  1. «Точность рациона ... У 56% / 166%» — проценты считались от ВНУТРЕННИХ
 *     carbsTotal/fatTotal (уже ужатых клиническим потолком и волной периодизации),
 *     а не от целей пользователя. День мог сойтись в 0.2%, а примечание врало.
 *  2. «Корректор дневных целей: осталось отклонение 24.8%» печаталось ДО финальных
 *     проходов (капы §3D, финальный добор), которые потом сводили день к ≤3%.
 *
 * Тест проверяет свойство: любые проценты в этих примечаниях обязаны совпадать
 * с фактическим отклонением ОТ ЦЕЛЕЙ ПОЛЬЗОВАТЕЛЯ и с финальными тоталами.
 */

const sum = (meals: any[]) => meals.reduce((s, m) => {
  const t = m.totals || {};
  return { kcal: s.kcal + (t.kcal || 0), p: s.p + (t.p || 0), f: s.f + (t.f || 0), c: s.c + (t.c || 0) };
}, { kcal: 0, p: 0, f: 0, c: 0 });

const pct = (got: number, goal: number) => (goal > 0 ? Math.abs(got - goal) / goal * 100 : 0);

const CONFIGS: any[] = [
  // будни/волна периодизации: carbsTotal уезжает от goalCarbs → старый код врал по У
  { weightKg: 90, lbmKg: 73, bodyFatPct: 19, sex: 'male', goalKcal: 3000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 380, mealsCount: 5, isTrainingDay: true, dayOffset: 2, goal: 'mass' },
  // рефид-подобный день (волна углеводов вверх)
  { weightKg: 80, lbmKg: 65, bodyFatPct: 18, sex: 'male', goalKcal: 3200, goalProteinG: 170, goalFatG: 70, goalCarbsG: 450, mealsCount: 6, isTrainingDay: true, dayOffset: 6, goal: 'mass' },
  // высокоуглеводный день (карб-форвард раскладка жиров)
  { weightKg: 75, lbmKg: 61, bodyFatPct: 17, sex: 'male', goalKcal: 3400, goalProteinG: 150, goalFatG: 75, goalCarbsG: 520, mealsCount: 5, isTrainingDay: true, dayOffset: 3, goal: 'mass' },
  // малый день покоя (carb-сплит «отдых»)
  { weightKg: 60, lbmKg: 49, bodyFatPct: 18, sex: 'female', goalKcal: 1800, goalProteinG: 120, goalFatG: 55, goalCarbsG: 190, mealsCount: 4, isTrainingDay: false, dayOffset: 1, goal: 'cutting' },
  // экстремальный объём (потолок углеводов активен)
  { weightKg: 100, lbmKg: 82, bodyFatPct: 18, sex: 'male', goalKcal: 5200, goalProteinG: 300, goalFatG: 100, goalCarbsG: 780, mealsCount: 6, isTrainingDay: true, dayOffset: 0, goal: 'mass' },
  // ЯВНЫЙ КЛИНИЧЕСКИЙ ПОТОЛОК (5 г/кг): carbsTotal = 250 против цели 400.
  // Именно здесь старый код печатал «У 58%» на дне, сошедшемся в 2%.
  { weightKg: 50, lbmKg: 40, bodyFatPct: 18, sex: 'male', goalKcal: 2405, goalProteinG: 100, goalFatG: 45, goalCarbsG: 400, mealsCount: 3, isTrainingDay: false, dayOffset: 0, goal: 'mass', manualTargetsLocked: true, carbCapGPerKg: 5 },
  // авто-режим, цель углеводов выше физиологического потолка 8 г/кг (кап активен)
  { weightKg: 80, lbmKg: 65, bodyFatPct: 18, sex: 'male', goalKcal: 4400, goalProteinG: 180, goalFatG: 70, goalCarbsG: 800, mealsCount: 4, isTrainingDay: false, dayOffset: 0, goal: 'cutting' },
  // Корректор в этом профиле сообщал «было 49%», а финал — 1.4% (фантомное примечание)
  { weightKg: 50, lbmKg: 40, bodyFatPct: 18, sex: 'male', goalKcal: 1400, goalProteinG: 110, goalFatG: 45, goalCarbsG: 139, mealsCount: 4, isTrainingDay: true, dayOffset: 0, goal: 'cutting' },
];

const build = (c: any) => buildDayPlan({
  trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium', cyclePhase: 'none', variety: 'medium', eveningLowCarb: false,
  ...c,
} as any);

describe('B38: примечания о сходимости честны к целям пользователя', () => {
  it('проценты в «Точность рациона» = отклонение от целей пользователя (не от внутренних тоталь)', () => {
    let checked = 0;
    for (const c of CONFIGS) {
      const plan = build(c);
      const t = sum(plan.meals as any[]);
      const note = (plan.notes || []).find((n: string) => n.includes('Точность рациона'));
      expect(note, `нет примечания для ${c.weightKg}кг/${c.goalCarbsG}У`).toBeTruthy();
      const m = /Б (\d+)%, Ж (\d+)%, У (\d+)%/.exec(String(note));
      if (!m) continue; // ветка «отклонение ≤2%» печатает граммы, а не проценты
      checked++;
      expect(Math.abs(Number(m[1]) - Math.round(pct(t.p, c.goalProteinG))), `Б: ${note}`).toBeLessThanOrEqual(1);
      expect(Math.abs(Number(m[2]) - Math.round(pct(t.f, c.goalFatG))), `Ж: ${note}`).toBeLessThanOrEqual(1);
      expect(Math.abs(Number(m[3]) - Math.round(pct(t.c, c.goalCarbsG))), `У: ${note}`).toBeLessThanOrEqual(1);
    }
    // тест должен реально попасть в ветку с процентами
    expect(checked).toBeGreaterThan(0);
  });

  it('если день сошёлся, «Корректор» не сообщает старое отклонение >3%', () => {
    for (const c of CONFIGS) {
      const plan = build(c);
      const t = sum(plan.meals as any[]);
      const finalDev = Math.max(
        pct(t.kcal, c.goalKcal), pct(t.p, c.goalProteinG), pct(t.f, c.goalFatG), pct(t.c, c.goalCarbsG),
      );
      const corr = (plan.notes || []).find((n: string) => n.includes('Корректор дневных целей'));
      if (!corr) continue;
      if (finalDev <= 3) {
        // сошлось — допустимо только «сведено к ≤3% … → финал X%», и X должен быть ≤3
        expect(corr, `финал ${finalDev.toFixed(1)}%: ${corr}`).toContain('сведено');
        const fm = /финал ([\d.]+)%/.exec(corr);
        expect(fm).toBeTruthy();
        expect(Number(fm![1])).toBeLessThanOrEqual(3);
      } else {
        // не сошлось — «осталось отклонение» обязано называть ФИНАЛЬНУЮ цифру
        const om = /осталось отклонение ([\d.]+)%/.exec(corr);
        if (om) {
          expect(Math.abs(Number(om[1]) - finalDev)).toBeLessThanOrEqual(1.5);
        }
      }
    }
  });

  it('отчёт не содержит устаревшего отклонения корректора при сошедшемся дне', () => {
    // Ровно тот класс, на который жаловался пользователь: день сходится, а примечание
    // называет 20-25%. Проверяем, что таких «фантомных» чисел в плане нет.
    for (const c of CONFIGS) {
      const plan = build(c);
      const t = sum(plan.meals as any[]);
      const finalDev = Math.max(
        pct(t.kcal, c.goalKcal), pct(t.p, c.goalProteinG), pct(t.f, c.goalFatG), pct(t.c, c.goalCarbsG),
      );
      const phantom = (plan.notes || []).filter((n: string) => {
        const om = /осталось отклонение ([\d.]+)%/.exec(n);
        return om && finalDev <= 3 && Number(om[1]) > 3;
      });
      expect(phantom, `фантомные примечания при финале ${finalDev.toFixed(1)}%`).toEqual([]);
    }
  });
});
