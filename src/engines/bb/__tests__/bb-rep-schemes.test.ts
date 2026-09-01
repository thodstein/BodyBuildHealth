import { describe, expect, it } from 'vitest';
import {
  REP_SCHEMES,
  schemeFor,
  schemeToLoading,
  schemeLabel,
  applySchemeToPlan,
} from '../bb-rep-schemes.engine';

const weightFn = (reps: number, wm: number, rir: number, im: number) =>
  Math.round(wm * Math.max(0.4, Math.min(1, 1.0278 - 0.0278 * reps)) * Math.max(0.7, 1 - rir * 0.025) * im * 10) / 10;

const plan = () => ({
  weeks: [
    {
      week: 1,
      phase: 'accumulation',
      sessions: [
        {
          character: 'тяж',
          exercises: [
            {
              muscle: 'chest', name: 'Жим лёжа', role: 'primary', sets: 4,
              repsRange: [6, 8], rir: 2, restSeconds: 90, tempoSpec: '3-1-1-0',
              workSets: Array.from({ length: 4 }, () => ({ reps: 6, rir: 2, weight: 80 })),
            },
          ],
        },
        {
          character: 'памп',
          exercises: [
            {
              muscle: 'chest', name: 'Разводка', role: 'accessory', sets: 3,
              repsRange: [12, 15], rir: 3, restSeconds: 60, tempoSpec: '3-1-1-0',
              workSets: Array.from({ length: 3 }, () => ({ reps: 15, rir: 3, weight: 20 })),
            },
          ],
        },
      ],
    },
  ],
});

describe('bb-rep-schemes.engine', () => {
  it('schemeFor выбирает схему по контексту', () => {
    expect(schemeFor({ character: 'памп', pedProfile: { ghPlusInsulin: true } })).toBe('pump_15_20');
    expect(schemeFor({ character: 'тяж', phase: 'intensification', level: 'advanced', pedProfile: { hasAAS: true } })).toBe('dc_rp');
    expect(schemeFor({ character: 'памп', pedProfile: { hasMGF: true } })).toBe('myo_reps');
    expect(schemeFor({ character: 'тяж', focus: 'strength' })).toBe('strength_5x5');
  });

  it('schemeToLoading возвращает loading из схемы', () => {
    const s = schemeToLoading(REP_SCHEMES.dc_rp);
    expect(s.reps).toBeGreaterThan(0);
    expect(s.restSec).toBeGreaterThan(0);
    expect(s.tempo).toBeTruthy();
  });

  it('schemeLabel описывает схему', () => {
    expect(schemeLabel('dc_rp')).toContain('DC');
    expect(schemeLabel('gvt')).toContain('GVT');
  });

  it('applySchemeToPlan переписывает loading тяж-primary (не памп-accessory)', () => {
    const p = plan();
    const opts = { weightForRepMax: weightFn, workMax: { chest: 100 }, defaultWorkMax: () => 50, proWorkmaxRatio: () => undefined, intensityMult: 1 };
    const applied = applySchemeToPlan(p, REP_SCHEMES.dc_rp, 'heavy_primary', opts);
    expect(applied).toBe(1); // только жим лёжа (тяж-primary)
    const bench = p.weeks[0].sessions[0].exercises[0];
    expect(bench.repsRange).toEqual(REP_SCHEMES.dc_rp.repRange);
    expect(bench.rir).toBe(REP_SCHEMES.dc_rp.rir);
    expect(bench.restSeconds).toBe(REP_SCHEMES.dc_rp.restSec);
    expect(bench.tempoSpec).toBe(REP_SCHEMES.dc_rp.tempo);
    expect(bench.sets).toBe(4); // кап 5 сохранён
    expect(bench.workSets).toHaveLength(4);
    // разводка (памп-accessory) не тронута
    const fly = p.weeks[0].sessions[1].exercises[0];
    expect(fly.repsRange).toEqual([12, 15]);
    expect(fly.workSets[0].weight).toBe(20);
  });

  it('applySchemeToPlan применяет памп-схему только к памп-accessory', () => {
    const p = plan();
    const opts = { weightForRepMax: weightFn, workMax: { chest: 100 }, defaultWorkMax: () => 50, proWorkmaxRatio: () => undefined, intensityMult: 1 };
    const applied = applySchemeToPlan(p, REP_SCHEMES.fst7, 'pump_accessory', opts);
    expect(applied).toBe(1);
    const fly = p.weeks[0].sessions[1].exercises[0];
    expect(fly.repsRange).toEqual(REP_SCHEMES.fst7.repRange);
    const bench = p.weeks[0].sessions[0].exercises[0];
    expect(bench.repsRange).toEqual([6, 8]); // тяж не тронут
  });

  it('applySchemeToPlan пропускает deload и warmup, cap 5 сетов', () => {
    const p = plan();
    p.weeks[0].phase = 'deload';
    const opts = { weightForRepMax: weightFn, workMax: {}, defaultWorkMax: () => 50, proWorkmaxRatio: () => undefined, intensityMult: 1 };
    const applied = applySchemeToPlan(p, REP_SCHEMES.dc_rp, 'heavy_primary', opts);
    expect(applied).toBe(0);
  });
});
