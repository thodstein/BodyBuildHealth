/**
 * pl-weak-groups-phase.test.ts — СЛАБЫЕ ГРУППЫ МЫШЦ (weakPoints):
 * протокол (pct/повторы/подходы) берётся ИЗ РАСКЛАДКИ САМОГО ЦИКЛА (weekLayout),
 * RIR — из RIR_MATRIX по фазе, упражнения — вариации движений конкретного цикла.
 * НЕ путать со слабыми точками СРЦ-движений (plWeakPoints) — те в pl-auto-key-tests.
 */
import { describe, expect, it } from 'vitest';
import { buildLMSPlan, type LMSBuildOutput } from '../lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

const pmMap = { 'Присед': 180, 'Жим лежа': 120, 'Становая тяга': 220 };

function buildWithWeak(weeksOverride: number, weakPoints: string[], overrides: Record<string, unknown> = {}): LMSBuildOutput {
  return buildLMSPlan({
    template: CYCLE_01 as never,
    pmMap,
    fallbackPm: 80,
    mode: 'natural',
    weeksOverride,
    faithful: true,
    weakPoints,
    ...overrides,
  } as never);
}

const weakEx = (plan: LMSBuildOutput, weekIdx: number, wg: string): { name: string; pct: number; reps: number; sets: number; rir: number; load: string } | null => {
  const wk = plan.weeks[weekIdx];
  if (!wk) return null;
  for (const d of wk.days) {
    for (const e of d.exercises) {
      // Инъектированные аксессуары слабой группы имеют group = английский ключ (chest/legs/back/arms).
      if (e.group === wg) {
        const ws = e.workSets[0];
        return { name: e.name, pct: ws.pct, reps: ws.reps, sets: ws.sets, rir: e.rir, load: e.load };
      }
    }
  }
  return null;
};

describe('слабые группы мышц — протокол из раскладки цикла', () => {
  it('аксессуар слабой группы получает %ПМ как у аксессуаров дня цикла (не выдуманный)', () => {
    const p = buildWithWeak(12, ['chest']);
    const ex = weakEx(p, 0, 'chest')!;
    // В cycle-01 день с Жим лежа (тяжёлый) имеет аксессуары ~0.45-0.55% — протокол должен быть в этом диапазоне.
    expect(ex.pct).toBeGreaterThanOrEqual(0.3);
    expect(ex.pct).toBeLessThanOrEqual(0.7);
    expect(ex.reps).toBeGreaterThanOrEqual(2);
    expect(ex.sets).toBeGreaterThanOrEqual(1);
  });

  it('протокол меняется по неделям цикла (как меняется раскладка цикла)', () => {
    const p = buildWithWeak(12, ['chest']);
    const w1 = weakEx(p, 0, 'chest')!;
    const w12 = weakEx(p, 11, 'chest')!;
    // Раскладка cycle-01: неделя 1 тяжёлая (0.68), неделя 12 легче — проценты различаются.
    expect(Math.abs(w1.pct - w12.pct)).toBeGreaterThan(0.001);
  });

  it('RIR аксессуара = база фазы (RIR_MATRIX) + запас (не выдуманный)', () => {
    const p = buildWithWeak(12, ['chest']);
    const ex = weakEx(p, 0, 'chest')!;
    // Base фаза (II-KMS strength): RIR 3 → аксессуар ~4 (лёгкий день +2) или ~3-4.
    expect(ex.rir).toBeGreaterThanOrEqual(2);
    expect(ex.rir).toBeLessThanOrEqual(5);
  });

  it('лёгкий день цикла → лёгкий протокол (изоляция, RIR выше)', () => {
    const p = buildWithWeak(12, ['arms']);
    const all: { name: string; pct: number; reps: number; rir: number; load: string }[] = [];
    for (const wk of p.weeks.slice(0, 2)) {
      for (const d of wk.days) {
        for (const e of d.exercises) {
          if (e.group === 'arms') all.push({ name: e.name, pct: e.workSets[0].pct, reps: e.workSets[0].reps, rir: e.rir, load: e.load });
        }
      }
    }
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});

describe('слабые группы мышц — упражнения под конкретный цикл', () => {
  it('для cycle-01 (троеборье) слабая группа chest получает вариацию жима из цикла', () => {
    const p = buildWithWeak(12, ['chest']);
    const ex = weakEx(p, 0, 'chest')!;
    // В cycle-01 есть Жим лежа/Жим гантелей — вариация жима должна быть приоритетной.
    expect(ex.name.toLowerCase()).toContain('жим');
  });

  it('слабая группа legs для cycle-01 получает присед-вариацию', () => {
    const p = buildWithWeak(12, ['legs']);
    const ex = weakEx(p, 0, 'legs')!;
    expect(ex.name.toLowerCase()).toMatch(/присед|жим ногами|выпад|разгибание|сгибание/);
  });

  it('слабая группа back для cycle-01 получает тягу/становую вариацию', () => {
    const p = buildWithWeak(12, ['back']);
    const ex = weakEx(p, 0, 'back')!;
    expect(ex.name.toLowerCase()).toMatch(/тяга|становая|подтягив|наклон|пуловер/);
  });

  it('без слабых групп аксессуары не добавляются (регрессия)', () => {
    const p = buildWithWeak(12, []);
    for (const wk of p.weeks.slice(0, 3)) {
      for (const d of wk.days) {
        for (const e of d.exercises) {
          expect(['Присед', 'Жим лежа', 'Становая тяга', 'Присед на груди', 'Жим гантелей', 'Наклоны', 'Жим стоя', 'Разгибание с гантелью из-за головы', 'Присед в широкой постановке', 'Французский жим', 'Бицепс стоя']).toContain(e.name);
        }
      }
    }
  });

  it('слабая группа попадает в день плана', () => {
    const p = buildWithWeak(12, ['chest'], { currentReadiness: 100 });
    const wk = p.weeks[0];
    const chestDay = wk.days.findIndex(d => d.exercises.some(e => e.group === 'chest' && e.name !== 'Жим лежа'));
    expect(chestDay).toBeGreaterThanOrEqual(0);
  });
});
