/**
 * planner-manual-convergence-and-veg-gate.test.ts
 *
 * Регрессионные замки на два требования аудита 2026-10:
 *
 *  B1  — наполнитель тарелки (добор овощей до 350 г) больше не может добавить
 *        исключённый/аллергенный овощ. Раньше здесь был хардкод broccoli/cucumber/
 *        tomato и единственной проверкой было «этого продукта ещё нет в приёме»,
 *        поэтому запрещённый продукт докладывался УЖЕ после фильтров пула.
 *
 *  B19/B20 — ручное КБЖУ работает как ручное:
 *        граммы пользователя не переписываются диетологическим полом,
 *        набор целей всегда внутренне согласован (ккал = 4Б+4У+9Ж),
 *        и день реально сходится к цели не хуже канона 3%.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDayPlan } from '../meal-plan-engine';
import { buildDayTargets } from '../planner-day-targets';
import { applyCarbWave } from '../planner-targets';
import { PLANNER_CONVERGENCE_PCT } from '../day-target-corrector';
import { FOOD_DB } from '../../../../../core/nutrition-database';

const FORBIDDEN_VEG = ['broccoli', 'cucumber', 'tomato'];

const planInput = (over: any = {}) => ({
  weightKg: 80, lbmKg: 65, bodyFatPct: 18, sex: 'male' as const,
  goalKcal: 1600, goalProteinG: 150, goalFatG: 55, goalCarbsG: 150,
  mealsCount: 3, isTrainingDay: false, trainStartMin: 17 * 60 + 30, trainDurationMin: 90,
  allowIntraWorkout: false, budget: 'medium' as const, dayOffset: 0,
  cyclePhase: 'none' as const, variety: 'medium' as const, eveningLowCarb: false,
  ...over,
} as any);

describe('B1: наполнитель тарелки уважает исключённые продукты', () => {
  // Инвариант: ни в одной конфигурации исключённый овощ не может оказаться в плане.
  it('исключённые овощи не появляются в плане ни в один из 7 дней', () => {
    const excludedIds = new Set<string>(FORBIDDEN_VEG);
    for (let d = 0; d < 7; d++) {
      const plan = buildDayPlan(planInput({ dayOffset: d, excludedIds }));
      const allIds = plan.meals.flatMap(m => m.items.map(it => it.id));
      for (const bad of FORBIDDEN_VEG) {
        expect(allIds, `исключённый овощ «${bad}» попал в план (день ${d})`).not.toContain(bad);
      }
    }
  });

  it('инвариант держится на матрице конфигураций (мал. калорийность/много приёмов → наполнитель активен)', () => {
    const excludedIds = new Set<string>(FORBIDDEN_VEG);
    const matrix: any[] = [
      { goalKcal: 1200, goalProteinG: 120, goalFatG: 40, goalCarbsG: 100, mealsCount: 6 },
      { goalKcal: 1300, goalProteinG: 130, goalFatG: 45, goalCarbsG: 110, mealsCount: 6 },
      { goalKcal: 1600, goalProteinG: 150, goalFatG: 55, goalCarbsG: 150, mealsCount: 6 },
      { goalKcal: 1800, goalProteinG: 150, goalFatG: 55, goalCarbsG: 190, mealsCount: 7 },
      { goalKcal: 2200, goalProteinG: 170, goalFatG: 70, goalCarbsG: 230, mealsCount: 6, isTrainingDay: true, allowIntraWorkout: true },
    ];
    for (const cfg of matrix) {
      for (let d = 0; d < 7; d++) {
        const plan = buildDayPlan(planInput({ ...cfg, dayOffset: d, excludedIds }));
        const allIds = plan.meals.flatMap(m => m.items.map(it => it.id));
        for (const bad of FORBIDDEN_VEG) {
          expect(allIds, `«${bad}» просочился (${JSON.stringify(cfg)}, день ${d})`).not.toContain(bad);
        }
      }
    }
  });

  it('наполнитель не ломается: разрешённые овощи при этом доступны', () => {
    // контроль осмысленности: в пуле вообще есть овощи, кроме запрещённых
    const allowedVeg = FOOD_DB.filter(f =>
      (f.category === 'vegetable' || String(f.id).startsWith('veg_')) && !FORBIDDEN_VEG.includes(f.id));
    expect(allowedVeg.length).toBeGreaterThan(5);
  });
});

describe('B19/B20: ручное КБЖУ — сходимость дня не хуже 3%', () => {
  const cases: { name: string; manual: any; weightKg: number }[] = [
    { name: 'все четыре цели заданы и согласованы', manual: { kcal: 2800, p: 180, f: 80, c: 310 }, weightKg: 90 },
    { name: 'все четыре заданы, ккал противоречит БЖУ', manual: { kcal: 3000, p: 200, f: 90, c: 300 }, weightKg: 90 },
    { name: 'только ккал + белок', manual: { kcal: 2200, p: 170, f: null, c: null }, weightKg: 85 },
    { name: 'г/кг вместо граммов', manual: { gPerKg: { protein: 2.0, fat: 0.9, carbs: 4.0 } }, weightKg: 90 },
    { name: 'низкожировой медицинский рацион (Ж 40)', manual: { kcal: 1900, p: 150, f: 40, c: 215 }, weightKg: 80 },
    { name: 'женский дефицит', manual: { kcal: 1600, p: 130, f: 45, c: 145 }, weightKg: 62 },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const t = buildDayTargets({
        weightKg: c.weightKg, kbjuMode: 'manual', manual: c.manual,
        presetGPerKg: 2.0, calcTargets: undefined as any, profileTargets: undefined as any,
        goal: 'fat_loss',
      } as any);

      // 1) набор целей обязан быть внутренне согласован (иначе сходимость недостижима)
      const aw = t.protein * 4 + t.fats * 9 + t.carbs * 4;
      expect(Math.abs(aw - t.kcal) / Math.max(1, t.kcal), `ккал ${t.kcal} vs БЖУ ${aw}`).toBeLessThanOrEqual(PLANNER_CONVERGENCE_PCT / 100);

      // 2) день, собранный под эти цели, сходится не хуже канона
      const plan = buildDayPlan(planInput({
        weightKg: c.weightKg,
        goalKcal: t.kcal, goalProteinG: t.protein, goalFatG: t.fats, goalCarbsG: t.carbs,
        mealsCount: 5, isTrainingDay: true, trainStartMin: 17 * 60 + 30, allowIntraWorkout: true,
      }));
      const tot = plan.totals;
      const dev = (got: number, goal: number) => goal > 0 ? Math.abs(got - goal) / goal * 100 : 0;
      const maxDev = Math.max(
        dev(tot.kcal, t.kcal), dev(tot.p, t.protein), dev(tot.f, t.fats), dev(tot.c, t.carbs),
      );
      expect(maxDev, `ккал ${Math.round(tot.kcal)}/${t.kcal} · Б ${tot.p}/${t.protein} · Ж ${tot.f}/${t.fats} · У ${tot.c}/${t.carbs}`)
        .toBeLessThanOrEqual(PLANNER_CONVERGENCE_PCT + 1e-6);
    });
  }

  it('B19: ручной жир 40 г не превращается в 0.8 г/кг', () => {
    const t = buildDayTargets({
      weightKg: 80, kbjuMode: 'manual', manual: { kcal: 1900, p: 150, f: 40, c: 215 },
      presetGPerKg: 2.0, goal: 'fat_loss',
    } as any);
    expect(t.fats).toBe(40); // 0.8 г/кг дало бы 64
  });

  it('B20: в плане нет «осиротевших» продуктов вне цели по калорийности', () => {
    const t = buildDayTargets({
      weightKg: 80, kbjuMode: 'manual', manual: { kcal: 1900, p: 150, f: 40, c: 215 },
      presetGPerKg: 2.0, goal: 'fat_loss',
    } as any);
    const plan = buildDayPlan(planInput({ goalKcal: t.kcal, goalProteinG: t.protein, goalFatG: t.fats, goalCarbsG: t.carbs }));
    // каждый продукт плана существует в базе и имеет непустое имя
    for (const it of plan.meals.flatMap(m => m.items)) {
      expect(it.name, `безымянный продукт ${it.id}`).toBeTruthy();
      expect(FOOD_DB.some(f => f.id === it.id), `продукт ${it.id} отсутствует в FOOD_DB`).toBe(true);
    }
  });
});

describe('B19-доп: ручное КБЖУ не масштабируется волной', () => {
  // Раньше Context умножал базовую цель (в т.ч. ручную) на dayCarbMod/dayKcalMod:
  // рефид ×2.2 и делил жир пополам, тяжёлый день ×1.25, фаза цикла ×… — то есть
  // баннер «План будет собран на: …» показывал одно, а план собирался на другое.
  const ctxSrc = readFileSync(join(__dirname, '..', 'IndividualPlanContext.tsx'), 'utf8');

  it('в ручном режиме волна нейтрализуется (ккал/углеводы = 1, рефид снят)', () => {
    expect(ctxSrc).toMatch(/if \(kbjuMode === 'manual'\) \{\s*\n\s*dayKcalMod = 1; dayCarbMod = 1; isRefeedDay = false;/);
  });

  it('заметки, обещающие ×2.2 / «углеводы выше», в ручном режиме убираются', () => {
    expect(ctxSrc).toMatch(/Ручное КБЖУ: цели дня — ровно введённые вами граммы/);
    expect(ctxSrc).toMatch(/углеводы выше\|поддержании/);
  });

  it('потолок волны не применяется к ручным граммам (пользователь — источник истины)', () => {
    expect(ctxSrc).toMatch(/allowSupercompensation: isRefeedDay \|\| kbjuMode === 'manual'/);
    // Поведенчески: с освобождением граммы проходят как есть, без среза до 12 г/кг.
    expect(applyCarbWave(700, 1, 80, { allowSupercompensation: true }).carbsG).toBe(700);
    expect(applyCarbWave(700, 1, 80, { allowSupercompensation: true }).waveClipped).toBe(false);
  });

  it('ручные цели доходят до движка без изменений и день сходится ≤3%', () => {
    // 90 кг, ручные 180Б/80Ж/310У = 2680 ккал по Атwater — «я сам знаю свои цифры».
    const t = buildDayTargets({
      weightKg: 90, kbjuMode: 'manual', manual: { kcal: 2680, p: 180, f: 80, c: 310 },
      presetGPerKg: 2.0, goal: 'maintenance',
    } as any);
    expect([t.kcal, t.protein, t.fats, t.carbs]).toEqual([2680, 180, 80, 310]);
    const plan = buildDayPlan(planInput({
      weightKg: 90, goalKcal: t.kcal, goalProteinG: t.protein, goalFatG: t.fats, goalCarbsG: t.carbs,
      mealsCount: 5, isTrainingDay: true, manualTargetsLocked: true,
    }));
    const dev = (got: number, goal: number) => goal > 0 ? Math.abs(got - goal) / goal * 100 : 0;
    const maxDev = Math.max(dev(plan.totals.kcal, t.kcal), dev(plan.totals.p, t.protein), dev(plan.totals.f, t.fats), dev(plan.totals.c, t.carbs));
    expect(maxDev, `ккал ${Math.round(plan.totals.kcal)}/${t.kcal} · Ж ${plan.totals.f}/${t.fats}`).toBeLessThanOrEqual(PLANNER_CONVERGENCE_PCT + 1e-6);
  });
});

describe('B19-доп-2: частично заполненное ручное КБЖУ сходится ≤3%', () => {
  // Требование (2026-10-30): незаполненные параметры считаются автоматически,
  // и день всё равно реально сходится к цели, а не «почти».
  const cases: { name: string; manual: any }[] = [
    { name: 'только белок', manual: { p: 170 } },
    { name: 'только жир', manual: { f: 80 } },
    { name: 'только углеводы', manual: { c: 280 } },
    { name: 'только ккал', manual: { kcal: 2400 } },
    { name: 'ккал + белок', manual: { kcal: 2400, p: 175 } },
    { name: 'ккал + жир', manual: { kcal: 2400, f: 75 } },
    { name: 'ккал + углеводы', manual: { kcal: 2400, c: 260 } },
    { name: 'белок + жир', manual: { p: 175, f: 75 } },
    { name: 'белок + углеводы', manual: { p: 175, c: 260 } },
    { name: 'жир + углеводы', manual: { f: 75, c: 260 } },
    { name: 'ничего не введено', manual: {} },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const t = buildDayTargets({
        weightKg: 85, kbjuMode: 'manual', manual: c.manual,
        presetGPerKg: 2.0, goal: 'fat_loss',
        calcTargets: { bmr: 1750, tdee: 2750, kcal: 2300, protein: 160, fats: 75, carbs: 240, adjustment: 0 },
        profileTargets: { bmr: 1750, tdee: 2600, kcal: 2400, protein: 155, fats: 72, carbs: 250, adjustment: 0 },
        trainingVolumeMinPerWeek: 300,
      } as any);

      // автодосчёт не оставляет нулей
      expect(t.protein).toBeGreaterThan(0);
      expect(t.fats).toBeGreaterThan(0);
      expect(t.carbs).toBeGreaterThan(0);

      const plan = buildDayPlan(planInput({
        weightKg: 85, goalKcal: t.kcal, goalProteinG: t.protein, goalFatG: t.fats, goalCarbsG: t.carbs,
        mealsCount: 5, isTrainingDay: true, manualTargetsLocked: true,
      }));
      const dev = (got: number, goal: number) => goal > 0 ? Math.abs(got - goal) / goal * 100 : 0;
      const maxDev = Math.max(
        dev(plan.totals.kcal, t.kcal), dev(plan.totals.p, t.protein),
        dev(plan.totals.f, t.fats), dev(plan.totals.c, t.carbs),
      );
      expect(maxDev, `${c.name}: ккал ${Math.round(plan.totals.kcal)}/${t.kcal} · Б ${plan.totals.p}/${t.protein} · Ж ${plan.totals.f}/${t.fats} · У ${plan.totals.c}/${t.carbs}`)
        .toBeLessThanOrEqual(PLANNER_CONVERGENCE_PCT + 1e-6);
    });
  }
});
