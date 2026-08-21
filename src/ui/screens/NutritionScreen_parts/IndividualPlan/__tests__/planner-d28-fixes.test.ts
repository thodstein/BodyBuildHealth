/**
 * planner-d28-fixes.test.ts — D-28 раунд: жалобы пользователя на планировщик питания.
 *
 * 1. Завтрак по спортивной диетологии (каши/хлопья/яйца/творог), БЕЗ рыбы/макарон,
 *    без дубля фруктов и без «10г хлопьев + 10г лапши».
 * 2. Любимые продукты не монополизируют каждый приём (порции ≤300г, fresh-first белок).
 * 3. Peri-workout сыворотка не ужимается до 9-10г overshoot-коррекцией.
 * 4. Изотоник добавляется при дефиците Na/электролитов на ЛЮБОМ тренировочном дне.
 * 5. «Еда на работе» (portableMode) реально фильтрует пулы в pro-движке.
 * 6. «Загрузка под утреннюю тренировку»: вечер — много углеводов, минимум жиров.
 * 7. Предупреждение о нехватке приёмов пищи (<5) для распределения КБЖУ.
 * 8. Заметка о большом промежутке между приёмами (≥4.5ч) с именами приёмов.
 */

import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

const base = (overrides: any = {}): MealPlanInput => ({
  weightKg: 80, lbmKg: 66, bodyFatPct: 17, sex: 'male' as const,
  goalKcal: 2800, goalProteinG: 180, goalFatG: 75, goalCarbsG: 350,
  mealsCount: 5, isTrainingDay: false, budget: 'medium' as const, dayOffset: 0,
  cyclePhase: 'maintenance' as const, variety: 'max' as const, quality: 'full' as const,
  randomSalt: 4, wakeTime: '08:00', bedTime: '23:00', lunchTime: '13:00', dinnerTime: '19:00',
  ...overrides,
});

describe('D-28: завтрак по спортивной диетологии', () => {
  it('белок завтрака — «завтрашний» (яйца/творог/сыворотка), НЕ рыба/мясо', () => {
    for (let s = 0; s < 5; s++) {
      const p = buildDayPlan(base({ randomSalt: s }));
      const b = p.meals.find(m => m.type === 'breakfast')!;
      const proteinIds = b.items.filter(i => i.role === 'protein' || i.role === 'fast_protein').map(i => i.id).join(' ');
      // Не должно быть рыбы/морепродуктов в качестве белка завтрака.
      expect(proteinIds).not.toMatch(/sardine|salmon|cod|tuna|mackerel|fish_|shrimp|beef|chicken|turkey|pork/);
    }
  });

  it('в завтрак не попадают макароны/лапша/рис-гарниры (курируемый пул)', () => {
    for (let s = 0; s < 5; s++) {
      const p = buildDayPlan(base({ randomSalt: s, goalCarbsG: 400 }));
      const b = p.meals.find(m => m.type === 'breakfast')!;
      const ids = b.items.map(i => i.id).join(' ');
      expect(ids).not.toMatch(/pasta|noodle|macaroni|spaghetti|rice_white|rice_brown_cooked|couscous|quinoa/);
    }
  });

  it('фрукт в завтраке — один (нет дубля и «всё подряд»)', () => {
    for (let s = 0; s < 5; s++) {
      const p = buildDayPlan(base({ randomSalt: s }));
      const b = p.meals.find(m => m.type === 'breakfast')!;
      const fruits = b.items.filter(i => i.role === 'fruit');
      expect(fruits.length).toBeLessThanOrEqual(1);
    }
  });

  it('любимые «завтрашние» хлопья (rice_cream) попадают в завтрак', () => {
    const p = buildDayPlan(base({ preferredIds: new Set(['rice_cream']), breakfastStyle: 'flakes' as const }));
    const b = p.meals.find(m => m.type === 'breakfast')!;
    expect(b.items.some(i => i.id === 'rice_cream')).toBe(true);
  });
});

describe('D-28: любимые продукты не монополизируют план', () => {
  it('любимый белок не даёт порцию 300+ г и не в каждом приёме', () => {
    const p = buildDayPlan(base({ preferredIds: new Set(['salmon', 'milk', 'oats']) }));
    const allProtein = p.meals.flatMap(m => m.items.filter(i => i.role === 'protein' || i.role === 'fast_protein'));
    // Ни одна порция белка не абсурдна.
    allProtein.forEach(it => expect(it.amount).toBeLessThanOrEqual(300));
    // Любимый белок не в КАЖДОМ приёме (fresh-first).
    const salmonMeals = p.meals.filter(m => m.items.some(i => i.id === 'salmon')).length;
    expect(salmonMeals).toBeLessThanOrEqual(2);
  });

  it('D-28 П4: любимые овощи/жиры/фрукты fresh-first (не в каждом приёме)', () => {
    const p = buildDayPlan(base({ preferredIds: new Set(['broccoli', 'avocado', 'banana']) }));
    const vegOcc = p.meals.filter(m => m.items.some(i => i.id === 'broccoli')).length;
    expect(vegOcc).toBeLessThanOrEqual(2);
    const fatOcc = p.meals.filter(m => m.items.some(i => i.id === 'avocado')).length;
    expect(fatOcc).toBeLessThanOrEqual(2);
    const fruitOcc = p.meals.filter(m => m.items.some(i => i.id === 'banana')).length;
    expect(fruitOcc).toBeLessThanOrEqual(2);
  });

  it('D-28 П4: любимый продукт присутствует в плане хотя бы раз', () => {
    const p = buildDayPlan(base({ preferredIds: new Set(['broccoli', 'avocado']) }));
    expect(p.meals.some(m => m.items.some(i => i.id === 'broccoli'))).toBe(true);
    expect(p.meals.some(m => m.items.some(i => i.id === 'avocado'))).toBe(true);
  });
});

describe('D-28: peri-workout сыворотка не ужимается', () => {
  it('fast_protein в pre/post не режется ниже 20 г (даже при overshoot белка)', () => {
    const p = buildDayPlan(base({ isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 90, mealsCount: 7, allowIntraWorkout: true, goalProteinG: 150, goalKcal: 2600 }));
    const periFast = p.meals.filter(m => m.type === 'preworkout' || m.type === 'postworkout')
      .flatMap(m => m.items.filter(i => i.role === 'fast_protein'));
    periFast.forEach(it => expect(it.amount).toBeGreaterThanOrEqual(20));
  });
});

describe('D-28: изотоник при дефиците Na на тренировочном дне', () => {
  it('короткая сессия без intra: изотоник добавляется в пост-трен/приём при дефиците Na', () => {
    const p = buildDayPlan(base({ isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 45, mealsCount: 5, allowIntraWorkout: false }));
    const hasIntra = p.meals.some(m => m.type === 'intra');
    expect(hasIntra).toBe(false);
    const isoItem = p.meals.flatMap(m => m.items).find(it => (it.name || '').toLowerCase().includes('изотон'));
    const isoNote = p.notes.some(n => n.includes('добавлен изотоник'));
    expect(isoItem || isoNote).toBeTruthy();
  });
});

describe('D-28: еда на работе (portableMode)', () => {
  it('portableMode исключает не-портативные продукты (супы/макароны/фастфуд)', () => {
    const p = buildDayPlan(base({ portableMode: true }));
    const ids = p.meals.flatMap(m => m.items.map(i => i.id));
    const bad = ids.filter(id => /soup|pasta|kfc|pizza|french_fries|big_mac|mayonnaise|ice_cream|coca_cola|porridge_oat|porridge_buckwheat/.test(id));
    expect(bad).toEqual([]);
  });
});

describe('D-28: загрузка под утреннюю тренировку', () => {
  it('утренняя сессия: вечер много углеводов, минимум жиров', () => {
    const p = buildDayPlan(base({ isTrainingDay: true, trainStartMin: 7 * 60, trainDurationMin: 60, mealsCount: 6, morningTrainLoad: true, goalCarbsG: 400 }));
    const d = p.meals.find(m => m.type === 'dinner')!;
    const b = p.meals.find(m => m.type === 'breakfast')!;
    expect(d.totals.c).toBeGreaterThan(b.totals.c);
    expect(d.totals.f).toBeLessThanOrEqual(12);
    expect(p.notes.some(n => n.includes('Загрузка под утреннюю тренировку'))).toBe(true);
  });
});

describe('D-28: предупреждения о распределении', () => {
  it('мало приёмов (<5) — предупреждение о неравномерном КБЖУ', () => {
    const p = buildDayPlan(base({ mealsCount: 3 }));
    expect(p.notes.some(n => n.includes('Мало приёмов пищи'))).toBe(true);
  });

  it('5+ приёмов — без предупреждения о нехватке', () => {
    const p = buildDayPlan(base({ mealsCount: 6 }));
    expect(p.notes.some(n => n.includes('Мало приёмов пищи'))).toBe(false);
  });

  it('большой промежуток (≥4.5ч) — заметка с именами приёмов', () => {
    const p = buildDayPlan(base({ mealsCount: 3, lunchTime: '13:00' }));
    expect(p.notes.some(n => /Большой интервал \d+ ч между/.test(n))).toBe(true);
  });
});

describe('D-28 П6: распределение приёмов — нет 6-часовых провалов и перекосов КБЖУ', () => {
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const maxGapH = (p: any): number => {
    const times = p.meals.map((m: any) => toMin(m.time)).sort((a: number, b: number) => a - b);
    let mx = 0;
    for (let i = 1; i < times.length; i++) mx = Math.max(mx, times[i] - times[i - 1]);
    return mx / 60;
  };

  it('5-8 приёмов (день отдыха): максимальный промежуток ≤ 5.5 ч', () => {
    for (const mc of [5, 6, 7, 8]) {
      for (let s = 0; s < 3; s++) {
        const p = buildDayPlan(base({ mealsCount: mc, randomSalt: s }));
        expect(maxGapH(p), `meals=${mc} salt=${s}`).toBeLessThanOrEqual(5.5);
      }
    }
  });

  it('тренировочный день с peri-приёмами: нет 6-часовых провалов между основными приёмами', () => {
    const p = buildDayPlan(base({ isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 90, mealsCount: 7, allowIntraWorkout: true }));
    expect(maxGapH(p)).toBeLessThanOrEqual(5.5);
  });

  it('ни один приём не превышает 50% дневных ккал (нет «обед 1400 / ужин 300»)', () => {
    for (const ov of [
      base({}),
      base({ isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 90, mealsCount: 7, allowIntraWorkout: true }),
      base({ mealsCount: 4 }),
    ]) {
      const p = buildDayPlan(ov);
      p.meals.forEach((m: any) => {
        const share = (m.totals.kcal / Math.max(1, p.totals.kcal)) * 100;
        expect(share, `${m.label}: ${m.totals.kcal} kcal`).toBeLessThanOrEqual(50);
      });
    }
  });

  it('белок приёма не превышает 60 г (нет сливания всего дневного белка в один приём)', () => {
    const p = buildDayPlan(base({}));
    p.meals.forEach((m: any) => {
      expect(m.totals.p, m.label).toBeLessThanOrEqual(60);
    });
  });
});
