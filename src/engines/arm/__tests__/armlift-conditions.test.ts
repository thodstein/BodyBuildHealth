import { describe, it, expect } from 'vitest';
import { assessArmliftConditions } from '../armlift-conditions.engine';

describe('PRO-6 M5: условия замера', () => {
  it('чистые условия — в зачёт', () => {
    const r = assessArmliftConditions({ implement: 'rolling_thunder', rtVersion: 'v3' });
    expect(r.trainingOnly).toBe(false);
    expect(r.notes).toEqual([]);
  });
  it('неизвестная версия RT — тренировочный', () => {
    const r = assessArmliftConditions({ implement: 'rolling_thunder', rtVersion: 'unknown' });
    expect(r.trainingOnly).toBe(true);
    expect(r.conditionsNote).toContain('тренировочный');
  });
  it('жидкий мел + некалиброванные диски — два флага', () => {
    const r = assessArmliftConditions({ implement: 'hub', liquidChalk: true, uncalibratedPlates: true });
    expect(r.trainingOnly).toBe(true);
    expect(r.notes.length).toBe(2);
  });
  it('чужой диаметр режет %WR', () => {
    const r = assessArmliftConditions({ implement: 'rolling_thunder', rtVersion: 'v3', barDiameterMm: 50 });
    expect(r.trainingOnly).toBe(true);
    expect(r.conditionsNote).toContain('50');
  });
  it('канон 60.3 — тихо', () => {
    const r = assessArmliftConditions({ implement: 'rolling_thunder', rtVersion: 'v3', barDiameterMm: 60.3 });
    expect(r.trainingOnly).toBe(false);
  });
  it('холод — тренировочный', () => {
    const r = assessArmliftConditions({ implement: 'pinch_block', coldGym: true });
    expect(r.trainingOnly).toBe(true);
  });
});
