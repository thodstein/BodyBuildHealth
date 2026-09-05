import { describe, it, expect } from 'vitest';
import { IMPLEMENT_LADDER, ladderWrPct, nextImplement, transferFactor } from '../arm-implement-ladder.engine';

describe('arm TOP T3 лестница инвентаря', () => {
  it('лестница идёт support → pinch → crush', () => {
    expect(IMPLEMENT_LADDER[0]).toBe('fat_gripz');
    expect(IMPLEMENT_LADDER[1]).toBe('rolling_thunder');
    expect(IMPLEMENT_LADDER[IMPLEMENT_LADDER.length - 1]).toBe('coc_bullet');
  });
  it('%WR считается от M130.5/F77.2 для RT', () => {
    expect(ladderWrPct('rolling_thunder', 65.25, 'male')).toBe(50);
    expect(ladderWrPct('rolling_thunder', 38.6, 'female')).toBe(50);
    expect(ladderWrPct('fat_gripz', 100, 'male')).toBeNull();
  });
  it('промоушен при ≥55% RT', () => {
    const ready = nextImplement('rolling_thunder', 80, 'male');
    expect(ready.ready).toBe(true);
    expect(ready.next).toBe('apollon_axle');
    const notReady = nextImplement('rolling_thunder', 40, 'male');
    expect(notReady.ready).toBe(false);
  });
  it('неизвестный старт → Fat Gripz', () => {
    expect(nextImplement('unknown_impl', 0, 'male').next).toBe('fat_gripz');
  });
  it('трансфер RT→Axle >1, обратно <1', () => {
    expect(transferFactor('rolling_thunder', 'apollon_axle')).toBeGreaterThan(1);
    expect(transferFactor('apollon_axle', 'rolling_thunder')).toBeLessThan(1);
    expect(transferFactor('rolling_thunder', 'rolling_thunder')).toBe(1);
  });
});
