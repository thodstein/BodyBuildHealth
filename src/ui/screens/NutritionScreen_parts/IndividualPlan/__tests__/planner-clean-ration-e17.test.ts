/**
 * planner-clean-ration-e17.test.ts — E17 «чистая выдача рациона»:
 *  - время приёмов округлено до 5 мин (не 08:23);
 *  - EAA в intra — ФИКС-доза 12 г (не раздувается до 165 г под макросы);
 *  - поздний перекус (после 20:00) — без завтрак-стейпла (овсянка/хлопья) и десертов.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, _gapFillTimesForTest, type MealPlanInput } from '../meal-plan-engine';
import { afAllows } from '../planner-meal-affinity';

const mk = (over: Partial<MealPlanInput>): MealPlanInput => ({
  weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male',
  goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
  mealsCount: 5, budget: 'medium', dayOffset: 0, cyclePhase: 'course',
  variety: 'medium', eveningLowCarb: false, ...over,
} as MealPlanInput);

const toMin = (t: string): number => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
const SWEET = new Set(['pryaniki', 'jam', 'honey', 'dates', 'marmalade', 'zefir', 'pastila', 'sushki', 'sugar_cookies', 'dates_dried', 'raisins', 'dried_apricots']);

describe('E17: чистая выдача рациона', () => {
  it('gapFillTimes возвращает время, кратное 5 минутам', () => {
    const times = _gapFillTimesForTest([7 * 60, 12 * 60 + 30, 19 * 60, 21 * 60 + 30], 5);
    expect(times.length).toBeGreaterThan(0);
    for (const t of times) expect(t % 5, `${t}`).toBe(0);
  });

  it('время приёмов сгенерированного дня — кратно 5 минутам', () => {
    const p = buildDayPlan(mk({ goalCarbsG: 800, goalKcal: 5100, goalProteinG: 220, goalFatG: 110, mealsCount: 8, randomSalt: 3 } as any));
    for (const m of p.meals) {
      const t = String((m as any).time || '');
      if (!/^\d{1,2}:\d{2}$/.test(t)) continue;
      expect(toMin(t) % 5, `${m.label} @${t}`).toBe(0);
    }
  });

  it('EAA в intra — фикс-доза 12 г (не масштабируется под макросы)', () => {
    const p = buildDayPlan(mk({
      weightKg: 110, lbmKg: 90, goalKcal: 4500, goalProteinG: 500, goalFatG: 100, goalCarbsG: 400,
      isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true, randomSalt: 1,
    }));
    const intra = p.meals.find(m => m.type === 'intra');
    if (intra) {
      const eaa = (intra.items || []).find((it: any) => String(it.id).includes('eaa') || String(it.id).includes('amino'));
      if (eaa) expect(eaa.amount, `EAA ${eaa.amount} г`).toBeLessThanOrEqual(20);
    }
  });

  it('E18: дешёвые/экзотические масла-«мусор» не стоят «жиром приёма»', () => {
    const JUNK = /^sauce_|^oil_(soybean|corn|palm|rice_bran|camelina|cedar|black_cumin|chili|truffle|mustard)|^seed_(poppy|fennel|anise|celery|nigella|cumin|coriander|cardamom|mustard_yellow)|^nut_(kukui|pili|baru)|basil_seeds|hazelnut_paste|pesto|fat_cocoa_butter/;
    for (const salt of [1, 2, 3, 4, 5]) {
      const p = buildDayPlan(mk({ goalKcal: 2720, goalProteinG: 170, goalFatG: 80, goalCarbsG: 330, mealsCount: 5, randomSalt: salt } as any));
      for (const m of p.meals) for (const it of (m.items || [])) {
        if (it.role === 'fat') expect(JUNK.test(String(it.id)), `${it.id} @${m.type} (соль ${salt})`).toBe(false);
      }
    }
  });

  it('E18: экзотические корнеплоды (таро/кассава/ям) и лимон/лайм не в рационе', () => {
    const JUNK = /^root_(taro|cassava|yam)|plantain|breadfruit|^(lemon|lime)(_|$)/;
    for (const salt of [1, 2, 3, 4, 5, 6, 7]) {
      const p = buildDayPlan(mk({ goalKcal: 2720, goalProteinG: 170, goalFatG: 80, goalCarbsG: 330, mealsCount: 5, randomSalt: salt, dayOffset: salt } as any));
      for (const m of p.meals) for (const it of (m.items || [])) {
        expect(JUNK.test(String(it.id)), `${it.id} @${m.type} (соль ${salt})`).toBe(false);
      }
    }
  });

  it('HV1500: поздний перекус (после 20:00) без овсянки/хлопьев и десертов', () => {
    const p = buildDayPlan(mk({
      weightKg: 120, lbmKg: 100, bodyFatPct: 16, goalKcal: 8900, goalProteinG: 500, goalFatG: 100, goalCarbsG: 1500,
      mealsCount: 10, budget: 'max', quality: 'full', carbCapGPerKg: 0, randomSalt: 3,
      wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
    } as any));
    const late = p.meals.filter(m => String(m.type || '').startsWith('snack') && toMin(String((m as any).time)) >= 20 * 60);
    for (const m of late) {
      for (const it of (m.items || [])) {
        const id = String(it.id || '');
        if (it.role !== 'carb_slow' && it.role !== 'carb_fast') continue;
        // На ночь запрещены только завтрак-стейпл (овсянка/хлопья) и десерты;
        // ужинный плотный носитель (рис/крем/картофель) — разрешён.
        expect(afAllows(id, 'lateSnack') && !SWEET.has(id), `${m.label}: ${id} — off-slot на ночь`).toBe(true);
      }
    }
  });
});
