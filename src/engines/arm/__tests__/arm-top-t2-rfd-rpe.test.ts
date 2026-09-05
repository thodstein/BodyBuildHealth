import { describe, it, expect } from 'vitest';
import { rfdStartTypeFor, speedClosesFor, buildRfdSession } from '../arm-rfd.engine';
import { gripRpePhaseFor, buildGripRpe, triageGripPain } from '../arm-grip-rpe.engine';

describe('arm TOP T2 RFD + Grip-RPE', () => {
  it('F100 ≥38% → fast, медленная сила → grind', () => {
    expect(rfdStartTypeFor({ explosivePct: 45 })).toBe('fast');
    expect(rfdStartTypeFor({ explosivePct: 15, fastPct: 40 })).toBe('grind');
    expect(rfdStartTypeFor({ fastPct: 75 })).toBe('tempo');
  });
  it('speed closes 5×3 RPE8 для продвинутых, 3× RPE7 новичкам', () => {
    expect(speedClosesFor('beginner')).toMatchObject({ sets: 3, rpe: 7, restSec: 90 });
    expect(speedClosesFor('advanced')).toMatchObject({ sets: 5, rpe: 8 });
  });
  it('RFD запрещён в deload/peaking', () => {
    expect(buildRfdSession({ phase: 'deload', explosivePct: 50 }).allowed).toBe(false);
    expect(buildRfdSession({ phase: 'intensification', explosivePct: 50 }).allowed).toBe(true);
    expect(buildRfdSession({ phase: 'intensification', explosivePct: 50 }).startType).toBe('fast');
  });
  it('фаза хвата по неделе: 1-2 volume, 3 intensification, 4 deload', () => {
    expect(gripRpePhaseFor(1)).toBe('volume');
    expect(gripRpePhaseFor(3)).toBe('intensification');
    expect(gripRpePhaseFor(4)).toBe('deload');
    expect(gripRpePhaseFor(8)).toBe('deload');
  });
  it('делоад: без негативов/максимумов, RPE≤6', () => {
    const d = buildGripRpe({ week: 4 });
    expect(d.negatives).toBeNull();
    expect(d.maxAttemptsPerWeek).toBe(0);
    expect(d.targetRpe).toBeLessThanOrEqual(6);
  });
  it('пик: 1 max-попытка + overcrush + sticking ≤3', () => {
    const p = buildGripRpe({ week: 11, phase: 'peak' });
    expect(p.maxAttemptsPerWeek).toBe(1);
    expect(p.stickingIso!.sets).toBeLessThanOrEqual(3);
    expect(p.extensor.sets).toBe(3);
  });
  it('суставная боль отменяет пик', () => {
    const p = buildGripRpe({ phase: 'peak', jointPain: true });
    expect(p.maxAttemptsPerWeek).toBe(0);
    expect(p.negatives).toBeNull();
  });
  it('триаж боли: сустав → стоп, мышца → train', () => {
    expect(triageGripPain('сустав пальца').action).toBe('stop');
    expect(triageGripPain('крепатура предплечья').action).toBe('train');
  });
});
