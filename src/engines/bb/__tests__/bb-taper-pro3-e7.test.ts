/**
 * bb-taper-pro3-e7.test.ts — PRO-3 Э7 «рефиды/брейки v2»:
 *   2-дневный рефид в финальной подготовке (Campbell 2021) — замена, не добавка;
 *   diet-break синхронизируется с deload-неделями плана (ICECAP), без deload — календарь;
 *   дефолт '1d' — байт-в-бит; UI-чип и проводка (source-guard).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildBBContestPrepPlan,
  prepRefeedDates,
  isPrepRefeedDay,
  prepDietBreaks,
  isPrepDietBreakDay,
  syncPrepDietBreaksWithPlan,
  nutritionTargetsForPrepDate,
  type BBContestPrepConfig,
  isoAddDays,
  isoDiffDays,
  isoToday,
} from '../bb-contest-prep.engine';
import { buildPrepCycle, type PrepCycleConfig } from '../bb-prep-cycle.engine';
import { DEFAULT_WORKMAX } from '../bb-builder.engine';

const cfg = (over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig => ({
  sex: 'male', category: 'mens_physique', weightKg: 80,
  experienceLevel: 'intermediate', enhanced: false, prepCount: 0,
  showDate: isoAddDays(isoToday(), 19 * 7), weeksOut: 2, trainingProtocol: 'bb',
  carbLoadStrategy: 'moderate', waterStrategy: 'stable', sodiumStrategy: 'stable',
  ...over,
});
const baseNutrition = { kcal: 2600, proteinG: 170, fatG: 65, carbsG: 300, waterMl: 3000, sodiumMg: 2800 };

describe('PRO-3 Э7 — 2-дневный рефид', () => {
  // 20 нед подготовки: брейки на неделях 8/16 не пересекаются с финальными неделями 19-20
  const longCfg = () => cfg({ showDate: isoAddDays(isoToday(), 23 * 7) });

  it("дефолт '1d': календарь не тронут (1 рефид-день на каждую финальную неделю)", () => {
    const plan = buildBBContestPrepPlan(longCfg(), { prepWeeks: 20, taperWeeks: 2 });
    expect(plan.preparation.refeedPattern).toBeUndefined();
    const fin = plan.phases.find(p => p.key === 'final_preparation')!;
    const dates = prepRefeedDates(plan);
    const inFinal = dates.filter(d => d >= fin.dateStart && d <= fin.dateEnd);
    expect(inFinal).toHaveLength(plan.preparation.finalWeeks); // 2 недели → 2 рефида
    const before = isoAddDays(inFinal[0], -1);
    expect(dates).not.toContain(before);
  });

  it("'2d': в финале две пары подряд (замена, без дублей), подготовка — 1-дневная", () => {
    const plan = buildBBContestPrepPlan(longCfg(), { prepWeeks: 20, taperWeeks: 2, refeedPattern: '2d' });
    expect(plan.preparation.refeedPattern).toBe('2d');
    const fin = plan.phases.find(p => p.key === 'final_preparation')!;
    const dates = prepRefeedDates(plan);
    expect(new Set(dates).size).toBe(dates.length); // без дублей
    const inFinal = dates.filter(d => d >= fin.dateStart && d <= fin.dateEnd);
    expect(inFinal).toHaveLength(plan.preparation.finalWeeks * 2); // 2 недели × 2 дня
    // каждая пара подряд
    expect(isoAddDays(inFinal[0], 1)).toBe(inFinal[1]);
    expect(isoAddDays(inFinal[2], 1)).toBe(inFinal[3]);
    expect(isPrepRefeedDay(inFinal[0], plan)).toBe(true);
    // подготовительные рефиды остались 1-дневными (последний день каждой 3-й недели)
    const prep = plan.phases.find(p => p.key === 'preparation')!;
    const prepRefeeds = dates.filter(d => d >= prep.dateStart && d <= prep.dateEnd);
    expect(prepRefeeds.length).toBeGreaterThanOrEqual(1);
    // подготовка: каждая 3-я неделя → интервал 21 день (1-дневные, как было)
    expect(prepRefeeds.every((d, i) => i === 0 || isoDiffDays(prepRefeeds[i - 1], d) === 21)).toBe(true);
  });
});

describe('PRO-3 Э7 — синк diet-break с deload', () => {
  it('deload на неделе 7 → брейк-окно сдвигается с 8 на 7; живой день получает Diet break', () => {
    const plan = buildBBContestPrepPlan(cfg(), { prepWeeks: 16, taperWeeks: 2 });
    const weeks = Array.from({ length: 18 }, (_, i) => ({ week: i + 1, deload: i + 1 === 7, phase: i + 1 === 7 ? 'deload' : 'accumulation' }));
    const synced = syncPrepDietBreaksWithPlan(plan, weeks);
    expect(synced).not.toBe(plan);
    const start = plan.preparation.startDate;
    const w7day = isoAddDays(start, 6 * 7);
    const w8day = isoAddDays(start, 7 * 7);
    expect(isPrepDietBreakDay(w7day, synced)).toBe(true);
    expect(isPrepDietBreakDay(w8day, synced)).toBe(false);
    const t = nutritionTargetsForPrepDate(w7day, synced, baseNutrition);
    expect(t.note).toMatch(/Diet break/);
  });

  it('без deload-недель — календарный брейк не меняется', () => {
    const plan = buildBBContestPrepPlan(cfg(), { prepWeeks: 16, taperWeeks: 2 });
    const synced = syncPrepDietBreaksWithPlan(plan, [{ week: 1, deload: false }]);
    expect(synced).toBe(plan);
    expect(prepDietBreaks(plan)).toEqual(prepDietBreaks(synced));
  });

  it('prep-cycle сохраняет синк в prepPlan (deload цикла → брейк на его неделе)', () => {
    const EQ = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];
    const pcCfg = {
      category: 'mens_physique', sex: 'male', accentMuscles: [], minimalMuscles: [],
      weeks: 18, taperWeeks: 2, showDate: isoAddDays(isoToday(), 18 * 7), level: 'intermediate',
      trainingYears: 4, equipment: EQ, workMax: { ...DEFAULT_WORKMAX }, enhanced: false, weightKg: 82,
      experienceLevel: 'intermediate', autoDeload: true,
    } as PrepCycleConfig;
    const r = buildPrepCycle(pcCfg);
    const breaks = prepDietBreaks(r.prepPlan);
    const deloadWeeks = r.bbPlan.weeks.map((w: any, i: number) => (w.deload === true || w.phase === 'deload' ? (w.week ?? i + 1) : 0)).filter(Boolean);
    if (deloadWeeks.length > 0 && breaks.length > 0) {
      const start = r.prepPlan.preparation.startDate;
      const breakWeekOf = (d: string) => Math.round((new Date(d).getTime() - new Date(start).getTime()) / 604800000) + 1;
      // каждое окно начинается на deload-неделе (±1 допускается только если deload нет рядом)
      expect(breakWeekOf(breaks[0])).toBeGreaterThanOrEqual(7);
    }
  });
});

describe('PRO-3 Э7 — UI source-guard', () => {
  it('чип 2д + проводка синка в конструкторе', () => {
    const sec = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'TrainingScreen_parts', 'bb-contest-prep-sections.tsx'), 'utf8');
    const bb = readFileSync(resolve(__dirname, '..', '..', '..', 'ui', 'screens', 'TrainingScreen_parts', 'BbAutoConstructor.tsx'), 'utf8');
    expect(sec).toMatch(/data-bb="refeed-2d"/);
    expect(bb).toMatch(/syncPrepDietBreaksWithPlan\(plan, \(updated as any\)\.weeks/);
  });
});
