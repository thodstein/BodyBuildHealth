// tz-snapshot-coverage.test.ts — покрытие анализами в снапшоте калькулятора.
//
// Проход 207: `labCoverage` — производная от `labValues` (`riskLabCoverage`), а не
// самостоятельное поле. Снапшот, записанный до смены формулы, отдавал своё число,
// и карточка «Риски» печатала «5 из 46 · ×1.05» рядом с «×1.15» из модели.
import { describe, it, expect, beforeEach } from 'vitest';
import { readCalcSnapshot, writeCalcSnapshot, TZ_INPUT_KEY } from '../tz-snapshot';
import { riskLabCoverage, type TzSpecInput } from '../risk-engine-tz-spec';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
});

const baseInput = (labValues: Record<string, number>) =>
  ({ supportSubstances: [], labValues }) as unknown as TzSpecInput;

describe('снапшот: покрытие = riskLabCoverage(labValues)', () => {
  it('старое покрытие в снапшоте не читается — пересчитывается по маркерам', () => {
    const labValues = { K: 4.2, HCT: 46, GLU: 5.1 };
    // Снапшот «старой формулы»: доля рукописного списка 3/22.
    store.set(
      TZ_INPUT_KEY,
      JSON.stringify({
        input: { ...baseInput(labValues), labCoverage: 3 / 22 },
        ts: Date.now(),
        sig: 'sig',
      }),
    );
    const read = readCalcSnapshot('sig')!;
    expect(read.labCoverage).toBe(riskLabCoverage(labValues));
    // 3 маркера модели: 0.3 + 3 × 0.04 = 0.42, а не 0.136
    expect(read.labCoverage).toBeCloseTo(0.42, 6);
  });

  it('пустая карта — покрытие базы 0.3, а не сохранённое значение', () => {
    store.set(
      TZ_INPUT_KEY,
      JSON.stringify({
        input: { ...baseInput({}), labCoverage: 1 },
        ts: Date.now(),
      }),
    );
    const read = readCalcSnapshot()!;
    expect(read.labCoverage).toBeCloseTo(0.3, 6);
  });

  it('снапшот без labValues не падает: покрытие — база', () => {
    store.set(
      TZ_INPUT_KEY,
      JSON.stringify({ input: { supportSubstances: [] }, ts: Date.now() }),
    );
    const read = readCalcSnapshot();
    expect(read).not.toBeNull();
    expect(read!.labCoverage).toBeCloseTo(0.3, 6);
  });

  it('запись и чтение дают то же покрытие, что модель', () => {
    const labValues = { LDL: 3.1, HDL: 1.2, TG: 1.4 };
    writeCalcSnapshot(baseInput(labValues), 'sig');
    const read = readCalcSnapshot('sig')!;
    expect(read.labCoverage).toBe(riskLabCoverage(labValues));
  });
});
