import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * §8.129 «не сошлось» говорит ФИНАЛЬНЫМИ числами (замок).
 *
 * Замер на противоречивом входе (`ккал ≠ 4Б+9Ж+4У`):
 *   вход 3200 ккал / Б190 Ж66 У380 (макросы = 2874) — нота печатала «ккал-ось 2929» и
 *   «по вашим макросам день в 7.5 %», а факт тарелки после последней мили 2885 ккал и 1.7 %.
 *   Пользователь читал провал сборки там, где день сошёлся по макросам и разошёлся только
 *   по ккал-оси (это свойство его же входа, и это уже сказано в ⚖️-ноте).
 *
 * Правило: ⚠-строка о противоречии пересобирается в последней точке (перед возвратом плана)
 * по ФАКТУ тарелки; эталон для «по вашим макросам» — снова 4Б+9Ж+4У из ЦЕЛЕЙ, не из факта.
 */

const build = (o: any): any => buildDayPlan(o as unknown as MealPlanInput);

const plan = (w: number, kcal: number, p: number, f: number, c: number, goal: string, manual = false): any => build({
  weightKg: w, lbmKg: Math.round(w * 0.82), bodyFatPct: 18, sex: 'male',
  goalKcal: kcal, goalProteinG: p, goalFatG: f, goalCarbsG: c,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal, quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
});

const conflictNote = (pl: any): string => (pl.notes || [])
  .find((n: string) => /«Не сошлось»/.test(String(n)) && /следствие противоречия/.test(String(n))) || '';

const CASES: Array<[string, number, number, number, number, number, string, boolean]> = [
  ['w75 cut 2072', 75, 2072, 120, 75, 300, 'cut', false],
  ['w95 3200', 95, 3200, 190, 66, 380, 'maintenance', false],
  ['w95 3200 руч', 95, 3200, 190, 66, 380, 'maintenance', true],
];

describe('§8.129 «не сошлось»: числа ноты = факт тарелки', () => {
  for (const [key, w, kcal, p, f, c, goal, manual] of CASES) {
    it(`${key}: ккал-ось в ноте равна фактическим ккал дня`, () => {
      const pl = plan(w, kcal, p, f, c, goal, manual);
      const note = conflictNote(pl);
      expect(note, `${key}: ноты нет`).not.toBe('');
      const factKcal = Math.round(Number(pl.totals?.kcal) || 0);
      // Числа в ноте — из ФАКТА, а не из промежуточной стадии (было 2929 при факте 2885).
      expect(note, `${key}: ${note}`).toContain(`ккал-ось ${factKcal} `);
      expect(note).toContain(`против введённых ${kcal} `);
    });

    it(`${key}: «по вашим макросам» совпадает с фактом и лежит в каноне`, () => {
      const pl = plan(w, kcal, p, f, c, goal, manual);
      const note = conflictNote(pl);
      const t = pl.totals || {};
      const macroDev = Math.max(
        Math.abs((Number(t.p) || 0) - p) / p,
        Math.abs((Number(t.f) || 0) - f) / f,
        Math.abs((Number(t.c) || 0) - c) / c,
      ) * 100;
      const shown = Number((note.match(/по вашим макросам день в ([\d.]+)%/) || [])[1]);
      expect(Number.isFinite(shown), `${key}: ${note}`).toBe(true);
      expect(shown, `${key}: нота ${shown}% против факта ${macroDev.toFixed(2)}%`)
        .toBeCloseTo(Math.round(macroDev * 10) / 10, 1);
      expect(macroDev, `${key}: макросы вне канона`).toBeLessThanOrEqual(3.001);
      // Эталон в ноте — 4Б+9Ж+4У из ЦЕЛЕЙ (а не из факта: сравнивать факт с фактом нельзя).
      expect(note).toContain(`эталон ${4 * p + 9 * f + 4 * c} ккал`);
    });
  }

  it('противоречивый вход честно помечен: dayDeviationPct по ккал-оси > 3', () => {
    const pl = plan(95, 3200, 190, 66, 380, 'maintenance');
    expect(Number(pl.deviationPct) || 0).toBeGreaterThan(3);
    expect(Boolean((pl as any).withinTolerance)).toBe(false);
  });

  it('⚖️-нота называет и цель по макросам, и ФАКТ тарелки (было только обещание)', () => {
    for (const [key, w, kcal, p, f, c, goal, manual] of CASES) {
      const pl = plan(w, kcal, p, f, c, goal, manual);
      const atw = (pl.notes || []).find((n: string) => /^⚖️ Ккал = 4Б \+ 9Ж \+ 4У/.test(String(n)));
      expect(atw, `${key}: ⚖️-ноты нет`).toBeTruthy();
      const factK = Math.round(Number(pl.totals?.kcal) || 0);
      expect(String(atw), `${key}: ${atw}`).toContain(`по тарелке ${factK} ккал`);
      expect(String(atw), `${key}: осталось обещание`).not.toMatch(/План собран под ваши макросы \(ккал \d+\)/);
      expect(String(atw)).toContain(`цель по макросам ${4 * p + 9 * f + 4 * c} ккал`);
    }
  });
});

/**
 * Замер полосы (960 дней: 4 веса × 3 белка × 2 жира × 2 углевода × 2 числа приёмов ×
 * трен/отдых × 5 уровней противоречия входа):
 *
 *   вход сходится (ккал = 4Б+9Ж+4У, 192 дня): все четыре оси ≤ 3 % (худшая 2.4 %) — сборка
 *   держит канон без всяких нот;
 *   вход противоречив (768 дней): макросы ≤ 3 % (худшая 2.6 %), а ккал-ось отклоняется ровно
 *   на противоречие самого входа (7.3 / 7.6 / 12.4 / 15.3 % при 6 / 6 / 12 / 12 %).
 *
 * Математика: если ккал ≠ 4Б+9Ж+4У, попасть в 3 % по ккал И по макросам одновременно нельзя —
 * одна из осей обязана уехать. План держит макросы (это граммы, введённые пользователем), а
 * ккал-ось честно называет свойством входа. Здесь закреплено, что «уехала» именно ккал-ось,
 * и уехала ровно на величину противоречия, а не больше.
 */
describe('§8.129: на противоречивом входе уезжает только ккал-ось, и ровно на противоречие', () => {
  it('полоса: макросы в каноне, ккал-ось = противоречие входа', () => {
    const bad: string[] = [];
    for (const w of [55, 95]) {
      for (const pg of [1.6, 2.4]) for (const fg of [0.7, 1.0]) for (const cg of [2.0, 4.0]) {
        for (const off of [0.12, -0.12]) {
          const p = Math.round(w * pg);
          const f = Math.round(w * fg);
          const c = Math.round(w * cg);
          const macroKcal = 4 * p + 9 * f + 4 * c;
          const kcal = Math.round(macroKcal * (1 + off));
          const pl = plan(w, kcal, p, f, c, off > 0 ? 'maintenance' : 'cut');
          const t = pl.totals || {};
          const key = `w${w}/p${pg}/f${fg}/c${cg}/off${off}`;
          const devM = Math.max(
            Math.abs((Number(t.p) || 0) - p) / p,
            Math.abs((Number(t.f) || 0) - f) / f,
            Math.abs((Number(t.c) || 0) - c) / c,
            Math.abs((Number(t.kcal) || 0) - macroKcal) / macroKcal,
          ) * 100;
          if (devM > 3.001) bad.push(`${key}: ${devM.toFixed(1)}% по макросам`);
          // Ккал-ось не может уехать дальше собственного противоречия входа (+канон 3 %).
          const devK = Math.abs((Number(t.kcal) || 0) - kcal) / kcal * 100;
          const inputGap = Math.abs(macroKcal - kcal) / kcal * 100;
          if (devK > inputGap + 3.001) bad.push(`${key}: ккал-ось ${devK.toFixed(1)}% при противоречии ${inputGap.toFixed(1)}%`);
          // И витрина это называет (⚠ есть, числа = факт).
          expect(conflictNote(pl), `${key}: ⚠-ноты нет`).toContain(`ккал-ось ${Math.round(Number(t.kcal) || 0)} `);
        }
      }
    }
    expect(bad.join(' | ')).toBe('');
  });
});

/**
 * §8.130: на противоречивом входе каркас дня строился от ВВЕДЁННЫХ ккал, хотя корректор целится
 * в 4Б+9Ж+4У. Замер (до правки): 55 кг, Б132/Ж39/У110 (эталон 1319), введено 1161 — день
 * приходил на 1325 ккал, но с Б +11.7 % и Ж −11.8 % (тарелки 185/194/361/228/357 ккал: скелет
 * «на 1161», а MPS-полы приёмов в такие тарелки не влезают). Тот же вход с ккал = 1319 давал
 * Б +0.8 % / Ж −0.8 %.
 *
 * Правило: при противоречии входа каркас строится от эталона макросов — ТОЛЬКО в сторону роста
 * (замеренный откат §8.107a «уменьшённая сборка» не включается, полы реализма целы), вердикт и
 * ноты по-прежнему считаются от ВВЕДЁННЫХ ккал, чтобы противоречие входа оставалось видимым.
 */
describe('§8.130: рост-сборка на противоречивом входе, вердикт по введённым ккал', () => {
  it('55 кг Б132/Ж39/У110: введено 1161 при эталоне 1319 — все макросы в каноне', () => {
    const pl = plan(55, 1161, 132, 39, 110, 'cut');
    const t = pl.totals || {};
    expect(Math.abs((Number(t.p) || 0) - 132) / 132, `Б ${t.p}`).toBeLessThanOrEqual(0.03);
    expect(Math.abs((Number(t.f) || 0) - 39) / 39, `Ж ${t.f}`).toBeLessThanOrEqual(0.03);
    expect(Math.abs((Number(t.c) || 0) - 110) / 110, `У ${t.c}`).toBeLessThanOrEqual(0.03);
    // Вердикт — по введённым ккал (1161), а не по эталону: день честно «не сошёлся».
    expect(Number(pl.deviationPct) || 0).toBeGreaterThan(3);
    expect(Boolean((pl as any).withinTolerance)).toBe(false);
    expect(conflictNote(pl)).toContain(`ккал-ось ${Math.round(Number(t.kcal) || 0)} против введённых 1161`);
  });

  it('ручной путь на том же входе: макросы держатся в 2 %', () => {
    const pl = plan(55, 1161, 132, 39, 110, 'cut', true);
    const t = pl.totals || {};
    const dev = Math.max(
      Math.abs((Number(t.p) || 0) - 132) / 132,
      Math.abs((Number(t.f) || 0) - 39) / 39,
      Math.abs((Number(t.c) || 0) - 110) / 110,
    );
    expect(dev, `Б ${t.p} Ж ${t.f} У ${t.c}`).toBeLessThanOrEqual(0.021);
  });

  it('полоса «введено ниже эталона» (32 дня): макросы ≤ 3 %, ккал-ось = противоречие входа', () => {
    const bad: string[] = [];
    for (const w of [55, 95]) {
      for (const pg of [1.6, 2.4]) for (const fg of [0.7, 1.0]) for (const cg of [2.0, 4.0]) {
        for (const off of [-0.06, -0.12]) {
          const p = Math.round(w * pg);
          const f = Math.round(w * fg);
          const c = Math.round(w * cg);
          const macroKcal = 4 * p + 9 * f + 4 * c;
          const kcal = Math.round(macroKcal * (1 + off));
          const pl = plan(w, kcal, p, f, c, 'cut');
          const t = pl.totals || {};
          const key = `w${w}/p${pg}/f${fg}/c${cg}/off${off}`;
          const devM = Math.max(
            Math.abs((Number(t.p) || 0) - p) / p,
            Math.abs((Number(t.f) || 0) - f) / f,
            Math.abs((Number(t.c) || 0) - c) / c,
            Math.abs((Number(t.kcal) || 0) - macroKcal) / macroKcal,
          ) * 100;
          if (devM > 3.001) bad.push(`${key}: ${devM.toFixed(2)} % по макросам (Б ${t.p} Ж ${t.f} У ${t.c})`);
          const gap = Math.abs(macroKcal - kcal) / kcal * 100;
          const devIn = Math.abs((Number(t.kcal) || 0) - kcal) / kcal * 100;
          if (devIn > gap + 3.001) bad.push(`${key}: ккал-ось ${devIn.toFixed(1)} % при противоречии ${gap.toFixed(1)} %`);
          if (Boolean((pl as any).withinTolerance) !== false) bad.push(`${key}: вердикт проглотил противоречие`);
        }
      }
    }
    expect(bad.join(' | ')).toBe('');
  });
});
