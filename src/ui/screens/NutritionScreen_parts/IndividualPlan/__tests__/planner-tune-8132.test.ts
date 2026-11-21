import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * §8.132 «Пол белка приёма — страж «не вынуть мясо», а не «любой грамм в приёме»» (замок).
 *
 * Дефект (разбор ручного дня полосы 384, а не догадка): пол белка приёма сравнивал
 * проекцию с `min(белок_приёма_сейчас, пол_роли)`. На дне, где в приёме уже стоит продукт
 * НИЖЕ пола по белку, это выражение превращается в «не хуже, чем сейчас», и любой ход,
 * трогающий этот продукт ради углеводов или жира, отбрасывается.
 *
 * День 55 кг, ручные Б 132 / Ж 39 / У 110, 5 приёмов, тренировка: в перекусе рис 175 г
 * (белок приёма 5.4 г при поле 8 г). Срез риса на 35 г роняет белок приёма на 0.03 г →
 * 5.37 < min(5.4, 8) → отказ. **204 отказа подряд**: троичный обмен «курица ужина −35 г +
 * семена завтрака +9 г + рис перекуса −35 г» не мог даже рассмотреться.
 *
 * Правило: пол белка приёма сторожит ход БЕЛКОВОГО ножа. Крупа или жир, несущие 0.03 г
 * «попутного» белка, его не нарушают — пол про «не вынуть мясо из приёма». Стражи
 * «белок основного приёма ≥ 15 г» и «≤ цели приёма ×1.35» остались для ВСЕХ ходов.
 *
 * Замер (полоса 384 ручных дня, до/после):
 *   день Б132/Ж39/У110/5/T:  Б +7.27 / Ж −7.95 / У +7.91  →  **+1.89 / +1.79 / +1.00**
 *   из 1152 дней полосы изменились 11, все — сдвиг ≤ 0.9 п.п., никто не ушёл из канона.
 *   Полоса: вне 3 % было 3 дня (off 0: 2, off −0.12: 1) → стало 2 (off 0: 1, off −0.12: 1).
 *
 * Что ОТКЛОНЕНО замером (записано, чтобы не пробовать снова): расширение `allowP`
 * («белок перебран + жир недобран»). Оно чинит другой день (Б88/Ж39/У110/6/отдых,
 * введено 1006: 4.43 → в канон), но выводит из канона день Б88/Ж39/У220/6/R/off −0.12:
 * было Б 2.95 / Ж 2.82 / У 2.36 → стало Б 4.89 / Ж 4.36 / У 4.86 (хуже по ВСЕМ осям),
 * и день off +0.12 уходил в Б 3.30 / У 3.18 при 0 дней вне до правки.
 */

const plan = (w: number, p: number, f: number, c: number, mc: number, tr: boolean, manual: boolean, off = 0): any => {
  const macro = Math.round(4 * p + 9 * f + 4 * c);
  return buildDayPlan({
    weightKg: w, lbmKg: Math.round(w * 0.82), bodyFatPct: 18, sex: 'male',
    goalKcal: Math.round(macro * (1 + off)), goalProteinG: p, goalFatG: f, goalCarbsG: c,
    mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined,
    trainDurationMin: 75, allowIntraWorkout: true, budget: 'medium', dayOffset: 0,
    cyclePhase: 'none', variety: 'medium', goal: off >= 0 ? 'maintenance' : 'cut', quality: 'full',
    excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
    ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
  } as unknown as MealPlanInput);
};

const dev = (pl: any, p: number, f: number, c: number) => {
  const t = pl.totals || {};
  const rel = (v: number, g: number) => (g > 0 ? (Math.abs(v - g) / g) * 100 : 0);
  const pct = { p: rel(Number(t.p) || 0, p), f: rel(Number(t.f) || 0, f), c: rel(Number(t.c) || 0, c) };
  return { ...pct, max: Math.max(pct.p, pct.f, pct.c) };
};

describe('§8.132: пол белка приёма сторожит белковый нож, а не любой грамм в приёме', () => {
  it('ручной 55 кг Б132/Ж39/У110, 5 приёмов, тренировка: было 7.27 / −7.95 / +7.91', () => {
    const d = dev(plan(55, 132, 39, 110, 5, true, true), 132, 39, 110);
    expect(d.max, `Б ${d.p.toFixed(2)} Ж ${d.f.toFixed(2)} У ${d.c.toFixed(2)}`).toBeLessThanOrEqual(3.001);
  });

  it('последняя миля не переставляется: 55 кг / Б88 Ж39 У220 / 6 приёмов / +12 % ккал', () => {
    const d = dev(plan(55, 88, 39, 220, 6, false, true, 0.12), 88, 39, 220);
    expect(d.max, `Б ${d.p.toFixed(2)} Ж ${d.f.toFixed(2)} У ${d.c.toFixed(2)}`).toBeLessThanOrEqual(3.001);
  });

  it('авто-путь вылеченного дня: ≤ 3 % по Б/Ж/У', () => {
    const d = dev(plan(55, 132, 39, 110, 5, true, false), 132, 39, 110);
    expect(d.max, `авто: Б ${d.p.toFixed(2)} Ж ${d.f.toFixed(2)} У ${d.c.toFixed(2)}`).toBeLessThanOrEqual(3.001);
  });

  it('долг-1 не растёт: Б88 Ж39 У220 / 4 / тренировка — перебор белка 8.98 (было 8.98)', () => {
    // 4 приёма тренировочного дня = 6 слотов (завтрак, перекус, обед, пред/пост, ужин),
    // цель 88 г белка = 15 г/слот при поле 25 г. Лечится квотой белка НА СБОРКЕ, не срезом.
    const d = dev(plan(55, 88, 39, 220, 4, true, true), 88, 39, 220);
    expect(d.p, `Б ${d.p.toFixed(2)}`).toBeLessThanOrEqual(9.05);
    expect(d.f, `Ж ${d.f.toFixed(2)}`).toBeLessThanOrEqual(3.001);
    expect(d.c, `У ${d.c.toFixed(2)}`).toBeLessThanOrEqual(3.001);
  });

  it('долг-2 не растёт: Б88 Ж39 У110 / 6 / отдых / введено −12 % — 4.43 (было 4.43)', () => {
    // Противоречивый вход: 1006 ккал при эталоне макросов 1143. Расширение `allowP`
    // сводило его в канон, но ломало другой день хуже (см. шапку) — правка отклонена замером.
    const d = dev(plan(55, 88, 39, 110, 6, false, true, -0.12), 88, 39, 110);
    expect(d.max, `Б ${d.p.toFixed(2)} Ж ${d.f.toFixed(2)} У ${d.c.toFixed(2)}`).toBeLessThanOrEqual(4.45);
  });

  it('«не вынуть мясо из приёма»: на обычном дне завтрак/обед/ужин держат ≥15 г белка', () => {
    const pl: any = buildDayPlan({
      weightKg: 90, lbmKg: 73, bodyFatPct: 19, sex: 'male',
      goalKcal: 3000, goalProteinG: 200, goalFatG: 80, goalCarbsG: 380,
      mealsCount: 5, isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 75,
      allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
      variety: 'medium', goal: 'maintenance', quality: 'full',
      excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
      kbjuMode: 'manual', manualTargetsLocked: true,
    } as unknown as MealPlanInput);
    for (const m of pl.meals || []) {
      if (!['breakfast', 'lunch', 'dinner'].includes(String(m.type))) continue;
      expect(Number(m.totals?.p) || 0, `${m.type}: ${Number(m.totals?.p).toFixed(1)} г`).toBeGreaterThanOrEqual(15 - 1e-9);
    }
  });
});
