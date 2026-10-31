import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';

/**
 * B39 (этап 3 анализа сходимости, 2026-10): жир НЕ сваливается в peri-окна.
 *
 * Замер до фикса: на дне 1240 ккал/50 кг «Пост-трен» получал 20 г оливкового масла
 * = 180 ккал (17% дневного жира); на профиле 110 кг жир дня перебирал на 8.3%
 * на всех днях. Физиология окна: предтрен ≤5 г, пост-трен и интра — практически
 * без жира (жир тормозит опорожнение желудка и ресинтез гликогена).
 *
 * Правило безопасности (иначе «было +8% → стало −14%»): страж режет ТОЛЬКО
 * перебор дня по жиру и никогда не создаёт дефицит. Поэтому в окне может остаться
 * часть перебора — но не «ведро масла», как до фикса.
 */

const sum = (meals: any[]) => meals.reduce((s, m) => {
  const t = m.totals || {};
  return { kcal: s.kcal + (t.kcal || 0), p: s.p + (t.p || 0), f: s.f + (t.f || 0), c: s.c + (t.c || 0) };
}, { kcal: 0, p: 0, f: 0, c: 0 });

const MATRIX: any[] = [
  // малый женский день: раньше пост-трен получал 20 г масла
  { weightKg: 50, lbmKg: 41, bodyFatPct: 18, sex: 'female', goalKcal: 1240, goalProteinG: 110, goalFatG: 40, goalCarbsG: 110, goal: 'cutting' },
  { weightKg: 58, lbmKg: 47, bodyFatPct: 19, sex: 'female', goalKcal: 2345, goalProteinG: 120, goalFatG: 65, goalCarbsG: 320, goal: 'mass' },
  // крупный объём: тут перебор жира дня и раньше «утекал» в окна
  { weightKg: 110, lbmKg: 88, bodyFatPct: 20, sex: 'male', goalKcal: 4110, goalProteinG: 220, goalFatG: 110, goalCarbsG: 560, goal: 'mass' },
  { weightKg: 90, lbmKg: 73, bodyFatPct: 19, sex: 'male', goalKcal: 2760, goalProteinG: 160, goalFatG: 80, goalCarbsG: 350, goal: 'maintenance' },
];

const PERI = ['preworkout', 'postworkout', 'intra'];

const build = (c: any, mealsCount: number, isTrainingDay: boolean) => buildDayPlan({
  ...c,
  mealsCount,
  isTrainingDay,
  trainStartMin: 17 * 60 + 30,
  trainDurationMin: 90,
  allowIntraWorkout: true,
  budget: 'medium',
  dayOffset: 0,
  cyclePhase: 'none',
  variety: 'medium',
  eveningLowCarb: false,
  manualTargetsLocked: true,
  carbCapGPerKg: 0,
} as any);

describe('B39: жир в peri-окнах ограничен физиологией окна', () => {
  it('в peri-окне нет жирового пункта-«ведра» (>12 г)', () => {
    let periMealsChecked = 0;
    for (const c of MATRIX) {
      for (const mc of [4, 5, 6, 7]) {
        for (const train of [true, false]) {
          const plan = build(c, mc, train);
          for (const m of plan.meals as any[]) {
            if (!PERI.includes(String(m.type))) continue;
            periMealsChecked++;
            for (const it of (m.items || []) as any[]) {
              if (it.role !== 'fat') continue;
              expect(
                it.amount,
                `${c.weightKg}кг/${mc}пр/${train ? 'трен' : 'отдых'} · ${m.label}: ${it.name} ${it.amount} г`,
              ).toBeLessThanOrEqual(12);
            }
          }
        }
      }
    }
    // матрица реально содержит peri-приёмы (иначе тест пустой)
    expect(periMealsChecked).toBeGreaterThan(20);
  });

  it('страж не «съедает» жир дня: отклонение не уходит глубже −15%', () => {
    for (const c of MATRIX) {
      for (const mc of [4, 5, 6, 7]) {
        for (const train of [true, false]) {
          const plan = build(c, mc, train);
          const t = sum(plan.meals as any[]);
          const devF = (t.f - c.goalFatG) / c.goalFatG * 100;
          expect(devF, `${c.weightKg}кг/${mc}пр/${train ? 'трен' : 'отдых'}: жир ${devF.toFixed(1)}%`)
            .toBeGreaterThan(-15);
        }
      }
    }
  });

  it('жир срезается только при переборе: на дне с дефицитом жира окна не трогаем', () => {
    // Профиль, где жир дня структурно недобирается (полы реализма) — страж
    // обязан бездействовать, иначе дефицит станет ещё глубже.
    const c = MATRIX[2]; // 110 кг, 560У
    const plan = build(c, 4, true);
    const t = sum(plan.meals as any[]);
    expect(t.f).toBeLessThan(c.goalFatG); // предусловие теста
    const postw = (plan.meals as any[]).find(m => m.type === 'postworkout');
    // в окне нет жирового пункта вовсе — резать было нечего
    const fatItems = ((postw?.items || []) as any[]).filter(x => x.role === 'fat');
    expect(fatItems.length, 'пост-трен на дефицитном по жиру дне не должен получать масло').toBe(0);
  });
});
