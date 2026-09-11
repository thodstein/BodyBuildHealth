import { describe, expect, it } from 'vitest';
import { barLoopFlag, barTrajectoryType, barLoopVerdict } from '../bar-path-core.engine';
import { bbBarSrdFlag, bbTrajectoryType, bbBarPathVerdict } from '../../bb/bb-bar-path.engine';
import { diagnoseBarPathFromMetrics } from '../../strength-sport/strength-sport-barpath.engine';

describe('bar-path-core (единый канон SRD 4/6)', () => {
  it('пороги: <4 ok, 4–6 warn (инклюзивно), >6 crit', () => {
    expect(barLoopFlag(3.9)).toBe('ok');
    expect(barLoopFlag(4)).toBe('warn');
    expect(barLoopFlag(6)).toBe('warn');
    expect(barLoopFlag(6.1)).toBe('crit');
  });
  it('мусор → ok/«—», без throw', () => {
    expect(barLoopFlag(NaN)).toBe('ok');
    expect(barLoopFlag(-1)).toBe('ok');
    expect(barTrajectoryType(NaN)).toBe('—');
  });
  it('типы: прямая/узкая/широкая', () => {
    expect(barTrajectoryType(1.5)).toBe('прямая');
    expect(barTrajectoryType(3)).toBe('узкая петля');
    expect(barTrajectoryType(5)).toBe('широкая петля');
  });
  it('BB-делегат побайтово совпадает с каноном', () => {
    for (const x of [0, 1.5, 2.5, 4, 5, 6, 7]) {
      expect(bbBarSrdFlag(x)).toBe(barLoopFlag(x));
      expect(bbTrajectoryType(x)).toBe(barTrajectoryType(x));
      expect(bbBarPathVerdict(x, 80)).toEqual(barLoopVerdict(x, 80));
    }
  });
  it('SS-делегат: петля через канон, тексты доменные', () => {
    const mk = (xLoop: number) => ({ xMin: -xLoop / 2, xMax: xLoop / 2, xLoop, yMax: 80, vMax: 1.8, trajectoryType: 'type1' as const });
    expect(diagnoseBarPathFromMetrics(mk(6.5), 'snatch').severity).toBe('critical');
    expect(diagnoseBarPathFromMetrics(mk(4), 'snatch').severity).toBe('warn');
    expect(diagnoseBarPathFromMetrics(mk(2), 'snatch').severity).toBe('ok');
    expect(diagnoseBarPathFromMetrics(null, 'snatch').severity).toBe('ok');
  });
});
