/**
 * bb-invalid-input.test.ts — тесты невалидных и крайних входов для buildBBPlan.
 *
 * Проверяет, что генератор не падает на крайних значениях и
 * возвращает структурно валидный план (или пустой план с rationale).
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan, type BBBuilderInput } from '../bb-builder.engine';
import { makeInput, expectValidPlan } from './bb-test-helpers';

describe('BB invalid input handling', () => {
  describe('extreme weeks values', () => {
    it('weeks=4 (минимум) — план генерируется', () => {
      const plan = buildBBPlan(makeInput({ weeks: 4 }));
      expectValidPlan(plan);
      expect(plan.weeks.length).toBe(4);
    });

    it('weeks=52 (максимум, годовой план) — план генерируется', () => {
      const plan = buildBBPlan(makeInput({ weeks: 52 }));
      expectValidPlan(plan);
      expect(plan.weeks.length).toBe(52);
    });

    it('weeks=1 — план не падает (может быть пустым)', () => {
      const input = makeInput({ weeks: 1 });
      expect(() => buildBBPlan(input)).not.toThrow();
    });

    it('weeks=0 — план не падает', () => {
      const input = makeInput({ weeks: 0 });
      expect(() => buildBBPlan(input)).not.toThrow();
    });
  });

  describe('extreme bodyFat values', () => {
    it('bodyFat=0 — не падает', () => {
      expect(() => buildBBPlan(makeInput({ bodyFat: 0 }))).not.toThrow();
    });

    it('bodyFat=50 (экстремум) — не падает', () => {
      expect(() => buildBBPlan(makeInput({ bodyFat: 50 }))).not.toThrow();
    });

    it('bodyFat=25 (порог recoveryMult ×0.9) — план генерируется', () => {
      const plan = buildBBPlan(makeInput({ bodyFat: 25 }));
      expectValidPlan(plan);
    });
  });

  describe('extreme recovery metrics', () => {
    it('leanMass=0 — не падает', () => {
      expect(() => buildBBPlan(makeInput({ leanMass: 0 }))).not.toThrow();
    });

    it('leanMass=200 (экстремум) — не падает', () => {
      expect(() => buildBBPlan(makeInput({ leanMass: 200 }))).not.toThrow();
    });

    it('hrvMs=0 — не падает', () => {
      expect(() => buildBBPlan(makeInput({ hrvMs: 0 }))).not.toThrow();
    });

    it('hrvMs=200 (экстремум) — не падает', () => {
      expect(() => buildBBPlan(makeInput({ hrvMs: 200 }))).not.toThrow();
    });

    it('sleepHours=0 — не падает', () => {
      expect(() => buildBBPlan(makeInput({ sleepHours: 0 }))).not.toThrow();
    });

    it('sleepHours=12 — не падает', () => {
      expect(() => buildBBPlan(makeInput({ sleepHours: 12 }))).not.toThrow();
    });

    it('stressLevel=0 — не падает', () => {
      expect(() => buildBBPlan(makeInput({ stressLevel: 0 }))).not.toThrow();
    });

    it('stressLevel=11 (invalid) — не падает', () => {
      expect(() => buildBBPlan(makeInput({ stressLevel: 11 }))).not.toThrow();
    });
  });

  describe('extreme workMax', () => {
    it('workMax={} (пустой) — план генерируется с дефолтами', () => {
      const plan = buildBBPlan(makeInput({ workMax: {} }));
      expectValidPlan(plan);
    });

    it('workMax с частью мышц — план генерируется', () => {
      const plan = buildBBPlan(makeInput({ workMax: { chest: 100 } }));
      expectValidPlan(plan);
    });
  });

  describe('extreme equipment', () => {
    it('equipment=[] (пустой) — план генерируется (fallback на весь каталог)', () => {
      const plan = buildBBPlan(makeInput({ equipment: [] }));
      expectValidPlan(plan);
    });

    it('equipment с одним элементом — план генерируется', () => {
      const plan = buildBBPlan(makeInput({ equipment: ['barbell'] }));
      expectValidPlan(plan);
    });

    it('equipment с недоступным элементом — план генерируется', () => {
      const plan = buildBBPlan(makeInput({ equipment: ['kettlebell'] }));
      expectValidPlan(plan);
    });
  });

  describe('combined extreme values', () => {
    it('все плохие recovery метрики вместе — план генерируется', () => {
      const plan = buildBBPlan(makeInput({
        bodyFat: 35,
        leanMass: 40,
        hrvMs: 30,
        sleepHours: 4,
        stressLevel: 10,
      }));
      expectValidPlan(plan);
    });

    it('все хорошие recovery метрики вместе — план генерируется', () => {
      const plan = buildBBPlan(makeInput({
        bodyFat: 12,
        leanMass: 85,
        hrvMs: 85,
        sleepHours: 9,
        stressLevel: 1,
      }));
      expectValidPlan(plan);
    });

    it('PED + recovery + weeks=52 — план генерируется', () => {
      const plan = buildBBPlan(makeInput({
        weeks: 52,
        pedDoses: { AAS: 500, GH: 10 },
        courseIntensity: 'moderate',
        bodyFat: 15,
        hrvMs: 60,
      }));
      expectValidPlan(plan);
    });
  });

  describe('injuries edge cases', () => {
    it('множественные травмы — план генерируется', () => {
      const plan = buildBBPlan(makeInput({
        injuries: [
          { muscle: 'shoulders', exclude: true, weightPct: 0, volumePct: 0 },
          { muscle: 'lower_back', exclude: true, weightPct: 0, volumePct: 0 },
        ],
      }));
      expectValidPlan(plan);
    });

    it('все мышцы травмированы — план не падает', () => {
      const injuries = ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'biceps', 'triceps']
        .map(m => ({ muscle: m, exclude: true, weightPct: 0, volumePct: 0 }));
      expect(() => buildBBPlan(makeInput({ injuries }))).not.toThrow();
    });
  });

  describe('PED extreme doses', () => {
    it('AAS=0 (явно выключен) — план генерируется', () => {
      const plan = buildBBPlan(makeInput({ pedDoses: { AAS: 0 } }));
      expectValidPlan(plan);
    });

    it('AAS=10000 (экстремум) — план генерируется', () => {
      const plan = buildBBPlan(makeInput({ pedDoses: { AAS: 10000 }, courseIntensity: 'heavy' }));
      expectValidPlan(plan);
    });

    it('все 5 PED с большими дозами — план генерируется', () => {
      const plan = buildBBPlan(makeInput({
        pedDoses: { AAS: 2000, insulin: 40, GH: 15, MGF: 400, IGF1: 100 },
        courseIntensity: 'heavy',
      }));
      expectValidPlan(plan);
    });
  });
});