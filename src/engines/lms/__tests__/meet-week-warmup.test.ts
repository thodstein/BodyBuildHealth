/**
 * meet-week-warmup.test.ts — meet-неделя: разминка в MeetAttemptsInfo (warmupToOpener),
 * тёплые прикиды в computeMeetAttemptsFromPmRow, дедуп стратегий и warmup-шагов.
 */
import { describe, expect, it } from 'vitest';
import { warmupToOpener, MEET_WARMUP_STEPS, MEET_STRATEGY_PCT } from '../competition-attempts';
import { computeMeetAttemptsFromPmRow } from '../lms-builder.engine';
import { warmupSequence } from '../../pro/taper.engine';

describe('warmupToOpener', () => {
  it('5 шагов 40→90% от опенера, веса к 2.5 кг', () => {
    const w = warmupToOpener(200);
    expect(w).toHaveLength(5);
    expect(w[0].pct).toBe(0.4);
    expect(w[0].weight).toBe(80);
    expect(w[4].pct).toBe(0.9);
    expect(w[4].weight).toBe(180);
  });

  it('повторы: 5 до 70%, 3 до 85%, 1 дальше', () => {
    const w = warmupToOpener(200);
    expect(w[0].reps).toBe(5);   // 40%
    expect(w[1].reps).toBe(5);   // 55%
    expect(w[2].reps).toBe(3);   // 70% — пограничное (p < 0.7 false)
    expect(w[3].reps).toBe(3);   // 80%
    expect(w[4].reps).toBe(1);   // 90%
  });

  it('MEET_WARMUP_STEPS — единый канон шагов (дедуп с pro/taper.engine.warmupSequence)', () => {
    expect(MEET_WARMUP_STEPS).toEqual([0.4, 0.55, 0.7, 0.8, 0.9]);
    const seq = warmupSequence(200);
    expect(seq.map(s => s.percent)).toEqual(MEET_WARMUP_STEPS);
    expect(seq[0].weight).toBe(80);
  });
});

describe('computeMeetAttemptsFromPmRow + warmup', () => {
  it('каждый лифт несёт warmup от своего опенера', () => {
    const info = computeMeetAttemptsFromPmRow({ 'Присед': 200, 'Жим лежа': 140, 'Становая тяга': 240 }, 'balanced');
    expect(info).toBeTruthy();
    const squat = info!.lifts.find(l => /присед/i.test(l.name))!;
    expect(squat.warmup).toHaveLength(5);
    expect(squat.warmup[0].weight).toBe(Math.round(squat.opener * 0.4 / 2.5) * 2.5);
    expect(squat.warmup[4].weight).toBe(Math.round(squat.opener * 0.9 / 2.5) * 2.5);
    const dl = info!.lifts.find(l => /станов/i.test(l.name))!;
    expect(dl.warmup[0].weight).toBe(Math.round(dl.opener * 0.4 / 2.5) * 2.5);
  });

  it('стратегия прикидов — канон MEET_STRATEGY_PCT (с округлением к 2.5 кг)', () => {
    const info = computeMeetAttemptsFromPmRow({ 'Присед': 200 }, 'aggressive');
    const squat = info!.lifts[0];
    const round25 = (v: number) => Math.round(v / 2.5) * 2.5;
    expect(squat.opener).toBe(round25(200 * MEET_STRATEGY_PCT.aggressive.opener));
    expect(squat.third).toBe(round25(200 * MEET_STRATEGY_PCT.aggressive.third));
    // Агрессивная стратегия даёт более высокие прикиды, чем сбалансированная
    const bal = computeMeetAttemptsFromPmRow({ 'Присед': 210 }, 'balanced')!.lifts[0];
    const agg = computeMeetAttemptsFromPmRow({ 'Присед': 210 }, 'aggressive')!.lifts[0];
    expect(agg.third).toBeGreaterThan(bal.third);
    expect(agg.opener).toBeGreaterThan(bal.opener);
  });
});
