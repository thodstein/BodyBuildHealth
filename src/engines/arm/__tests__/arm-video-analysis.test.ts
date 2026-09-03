import { describe, it, expect } from 'vitest';
import {
  parseArmTrackCsv,
  armPathMetrics,
  classifyArmTrajectory,
  isArmRealChange,
} from '../arm-video-analysis.engine';

const HOOK_CSV = `t,x,y
0,10,5
0.1,8,6
0.2,6,7
0.3,4,8`;

const TOPROLL_CSV = `t;x;y
0;4;8
0.1;6;7
0.2;8;6
0.3;10;5`;

describe('arm-video-analysis (эпик I)', () => {
  it('парсинг , и ; + пропуск мусора', () => {
    expect(parseArmTrackCsv(HOOK_CSV).length).toBe(4);
    expect(parseArmTrackCsv(TOPROLL_CSV).length).toBe(4);
    expect(parseArmTrackCsv('t,x,y\nbad,line\n1,2')).toEqual([]);
    expect(parseArmTrackCsv('')).toEqual([]);
  });
  it('метрики: xLoop/yMax/vMax', () => {
    const m = armPathMetrics(parseArmTrackCsv(HOOK_CSV))!;
    expect(m.xLoop).toBe(6);
    expect(m.yMax).toBe(8);
    expect(m.vMax).toBeGreaterThan(0);
    expect(armPathMetrics([{ t: 0, x: 1, y: 1 }])).toBeNull();
  });
  it('классификация траектории', () => {
    expect(classifyArmTrajectory(parseArmTrackCsv(HOOK_CSV))).toBe('inside_hook');
    expect(classifyArmTrajectory(parseArmTrackCsv(TOPROLL_CSV))).toBe('outside_toproll');
    expect(classifyArmTrajectory([])).toBeNull();
  });
  it('SRD 4 — реальное изменение', () => {
    expect(isArmRealChange({ xLoop: 5, yMax: 8, vMax: 20, points: 4 }, { xLoop: 12, yMax: 8, vMax: 20, points: 4 })).toBe(true);
    expect(isArmRealChange({ xLoop: 5, yMax: 8, vMax: 20, points: 4 }, { xLoop: 7, yMax: 8, vMax: 20, points: 4 })).toBe(false);
  });
});
