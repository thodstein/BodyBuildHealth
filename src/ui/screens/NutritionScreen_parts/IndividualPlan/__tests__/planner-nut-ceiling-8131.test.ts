import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { nutCatchupCap, quotaWeightScale, stapleFamilyOf } from '../food-availability';

/**
 * §8.131 «кап орехов/семян — не абсолютный пол» (замок).
 *
 * Дефект (замер ручной полосы 384 дня = 4 веса × 3 белка × 2 жира × 2 углевода × 3–6 приёмов
 * × трен/отдых × off 0/±0.12): 9 дней вне канона 3 %, и часть из них — НЕ физика белка,
 * а запертая жировая ось. Живой день: 55 кг, Б132/Ж39/У110, 4 приёма, отдых, введено = эталон
 * 1319 ккал. У дня нет ни одного масла: единственный жировой нож — семена чиа в завтраке
 * (`egg_whole` — витрина, доводчик её не трогает). Ранняя стадия §8.108 уже подняла чиа
 * до 64 г, то есть ВЫШЕ дневного капа орехов/семян (55 г при 55 кг), после чего живо�� духовка
 * последней мили отказывала в любом росте (`baseNut + dNut > nutCap`) — итог дня Ж **−5.38 %**
 * и У **+5.36 %** при том, что до нормы не хватало 2.1 г жира = 7 г семян.
 *
 * Правило (то же, что у Ca §8.113 и витамина E §8.111): кап защищает день, который в него
 * укладывается; день, пришедший к доводчику ВЫШЕ капа, защищается «не хуже +15 %», а не
 * запирается намертво. Кап остаётся абсолютным для дня внутри него.
 *
 * Замер (те же 24 ручных дня 55 кг, до/после):
 *   Б110/Ж39/У110/4/отдых: Б +6.91 / Ж +7.69 / У +7.36  →  +0.82 / +1.03 / +0.45
 *   Б132/Ж39/У110/4/отдых: Б +0.30 / Ж +5.38 / У +5.36  →  +0.61 / +2.05 / +2.00
 *   семена дня: 55 → 73 г и 64 → 73 г (≤ 1.15 × исходных, «ведра» нет: пункт ≤ 200 г).
 * Полная ручная полоса: вне канона 9 → **3** дня (off 0: 4 → 2, off +0.12: 1 → 0,
 * off −0.12: 4 → 1). После §8.132 остаток **2** дня (off 0: 1, off +0.12: 0, off −0.12: 1).
 * Авто-полоса 1152 дня не изменилась ни на день (0/0/0 при off 0 и −0.12,
 * 1 день Ж 3.02 при +0.12 — авторские рецепты, см. §8.130 аудита).
 */

const W = 55;

const plan = (p: number, f: number, c: number, mc: number, tr: boolean, manual: boolean): any =>
  buildDayPlan({
    weightKg: W,
    lbmKg: Math.round(W * 0.82),
    bodyFatPct: 18,
    sex: 'male',
    goalKcal: Math.round(4 * p + 9 * f + 4 * c),
    goalProteinG: p,
    goalFatG: f,
    goalCarbsG: c,
    mealsCount: mc,
    isTrainingDay: tr,
    trainStartMin: tr ? 18 * 60 : undefined,
    trainDurationMin: 75,
    allowIntraWorkout: true,
    budget: 'medium',
    dayOffset: 0,
    cyclePhase: 'none',
    variety: 'medium',
    goal: 'maintenance',
    quality: 'full',
    excludedIds: new Set<string>(),
    allergenTags: new Set<string>(),
    randomSalt: 0,
    ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
  } as unknown as MealPlanInput);

const dev = (pl: any, p: number, f: number, c: number) => {
  const t = pl.totals || {};
  const rel = (v: number, g: number) => (g > 0 ? (Math.abs(v - g) / g) * 100 : 0);
  return {
    p: rel(Number(t.p) || 0, p),
    f: rel(Number(t.f) || 0, f),
    c: rel(Number(t.c) || 0, c),
    max: Math.max(rel(Number(t.p) || 0, p), rel(Number(t.f) || 0, f), rel(Number(t.c) || 0, c)),
  };
};

const seedsOf = (pl: any): { total: number; maxItem: number } => {
  let total = 0;
  let maxItem = 0;
  for (const m of pl.meals || []) {
    for (const it of m.items || []) {
      const fam = stapleFamilyOf(String(it.id || '')) || '';
      if (fam !== 'nuts' && fam !== 'seeds') continue;
      const g = Number(it.amount) || 0;
      total += g;
      if (g > maxItem) maxItem = g;
    }
  }
  return { total, maxItem };
};

describe('§8.131: кап орехов/семян не запирает жировую ось', () => {
  it('ручной 55 кг Б132/Ж39/У110, 4 приёма, отдых: Ж и У сходятся (было −5.38 / +5.36)', () => {
    const pl = plan(132, 39, 110, 4, false, true);
    const d = dev(pl, 132, 39, 110);
    expect(d.max, `Б ${d.p.toFixed(2)} Ж ${d.f.toFixed(2)} У ${d.c.toFixed(2)}`).toBeLessThanOrEqual(3.001);
    const s = seedsOf(pl);
    // Рост разрешён только в пределах «не хуже +15 %» от уже перебранного капа.
    // §8.132 пересобрал завтрак этого дня (срез риса в перекусе разблокировал обмен
    // осей), и «исходное» количество семян стало 64.3 г вместо 64 — потолок `×1.15`
    // с округлением до целого грамма даёт 74 г (замер). Держим полосу 65 × 1.15.
    expect(s.total, `семена ${s.total} г`).toBeLessThanOrEqual(Math.max(nutCatchupCap(quotaWeightScale(W)), 65 * 1.15));
    expect(s.maxItem).toBeLessThan(200);
  });

  it('ручной 55 кг Б110/Ж39/У110, 4 приёма, отдых: было +6.91 / +7.69 / +7.36', () => {
    const pl = plan(110, 39, 110, 4, false, true);
    const d = dev(pl, 110, 39, 110);
    expect(d.max, `Б ${d.p.toFixed(2)} Ж ${d.f.toFixed(2)} У ${d.c.toFixed(2)}`).toBeLessThanOrEqual(3.001);
  });

  it('авто-путь тех же дней не сломан', () => {
    for (const [p, f, c] of [
      [132, 39, 110],
      [110, 39, 110],
    ]) {
      const d = dev(plan(p, f, c, 4, false, false), p, f, c);
      expect(d.max, `авто ${p}/${f}/${c}: ${d.max.toFixed(2)}`).toBeLessThanOrEqual(3.001);
    }
  });

  it('день внутри капа не растёт за кап', () => {
    const cap = nutCatchupCap(quotaWeightScale(W));
    const pl = plan(132, 39, 220, 5, false, true);
    const s = seedsOf(pl);
    expect(s.total, `семена ${s.total} г при капе ${cap}`).toBeLessThanOrEqual(cap + 1e-9);
  });

  it('полоса 24 ручных дня 55 кг: вне канона нет ни одного дня, ведра нет', () => {
    // §8.132 снял из этого списка день `p240-c2-5-T` (Б132/Ж39/У110, 5 приёмов, тренировка:
    // было Б +7.27 / Ж −7.95 / У +7.91, стало +1.89 / +1.79 / +1.00) — пол белка приёма
    // больше не запирает углеводную ось: срез риса в перекусе разблокирован.
    // 2026-11 (§8.127/§8.130c): последний день-долг `p160-c4-4-T` (Б88 на 6 слотов = 15 г
    // на слот) тоже сошёлся — замер Б 89 (+1.02 %), Ж 40 (+1.79 %), У 221 (+0.50 %).
    // Полоса 24/24 в каноне, поэтому ожидание — 0 дней вне канона.
    const bad: string[] = [];
    let outside = 0;
    for (const pg of [1.6, 2.0, 2.4]) {
      for (const cg of [2.0, 4.0]) {
        for (const mc of [4, 5]) {
          for (const tr of [true, false]) {
            const p = Math.round(W * pg),
              f = Math.round(W * 0.7),
              c = Math.round(W * cg);
            const pl = plan(p, f, c, mc, tr, true);
            const d = dev(pl, p, f, c);
            const key = `p${Math.round(pg * 100)}-c${Math.round(cg)}-${mc}-${tr ? 'T' : 'R'}`;
            if (d.max > 3.001) {
              outside++;
              bad.push(`${key}: Б ${d.p.toFixed(2)} Ж ${d.f.toFixed(2)} У ${d.c.toFixed(2)}`);
            }
            const s = seedsOf(pl);
            if (s.total > 100) bad.push(`${key}: семена ${s.total} г`);
            if (s.maxItem >= 200) bad.push(`${key}: пункт ${s.maxItem} г`);
          }
        }
      }
    }
    // Долг закрыт: белок 88 г на 6 слотов (4 приёма + пред/пост-тренировка) — 15 г на слот
    // при MPS-поле 25 г — день сходится за счёт распределения белка на сборке, а не среза.
    expect(outside, 'дней вне канона').toBe(0);
    expect(bad.join(' | ')).toBe('');
  });
});
