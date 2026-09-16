import { describe, it, expect } from 'vitest';
import { parseSmBridgePayload, buildSMSpecProtocols } from '../sm-bridge-intake';

describe('sm-corrective-bridge (C3)', () => {
  it('smPreferredCorr/smWeakCauses санитизируются (кап 6, мусор — null)', () => {
    expect(parseSmBridgePayload({}).smPreferredCorr).toBeNull();
    expect(parseSmBridgePayload({}).smWeakCauses).toBeNull();
    expect(parseSmBridgePayload({ smPreferredCorr: 'мусор' }).smPreferredCorr).toBeNull();
    const p = parseSmBridgePayload({
      smPreferredCorr: { stone_off_floor: 'sm_stone_off_floor_tech', yoke_walk: '' },
      smWeakCauses: { stone_off_floor: 'technique' },
    });
    expect(p.smPreferredCorr).toEqual({ stone_off_floor: 'sm_stone_off_floor_tech' });
    expect(p.smWeakCauses).toEqual({ stone_off_floor: 'technique' });
  });
  it('smCorrectiveDetail санитизируется (кап 9, trim, мусор — null)', () => {
    expect(parseSmBridgePayload({}).smCorrectiveDetail).toBeNull();
    expect(parseSmBridgePayload({ smCorrectiveDetail: 'не массив' }).smCorrectiveDetail).toBeNull();
    const p = parseSmBridgePayload({ smCorrectiveDetail: ['  Камень — 4×3 @65%  ', '', 123 as any, 'x'.repeat(200)] });
    expect(p.smCorrectiveDetail).toEqual(['Камень — 4×3 @65%', '123', 'x'.repeat(160)]);
    const many = Array.from({ length: 12 }, (_, i) => `line ${i}`);
    expect(parseSmBridgePayload({ smCorrectiveDetail: many }).smCorrectiveDetail!.length).toBe(9);
  });
  it('buildSMSpecProtocols берёт дозу библиотечной ⭐, чужой — ранжир', () => {    const lib = buildSMSpecProtocols(['stone_off_floor'], { stone_off_floor: 'sm_stone_off_floor_tech' }, { stone_off_floor: 'technique' }, [], []);
    expect(lib.stone_off_floor.sets).toBe(4);
    expect(lib.stone_off_floor.pct).toBeLessThanOrEqual(90);
    const rank = buildSMSpecProtocols(['yoke_walk'], { yoke_walk: 'nope' }, {}, [], []);
    expect(rank.yoke_walk.sets).toBeGreaterThan(0);
    expect(rank.yoke_walk.pct).toBeGreaterThanOrEqual(50);
    expect(buildSMSpecProtocols([], null, null)).toEqual({});
  });
  it('C5: smUnilateral санитизируется (только left/right, кап 4)', () => {
    expect(parseSmBridgePayload({}).smUnilateral).toBeNull();
    expect(parseSmBridgePayload({ smUnilateral: 'мусор' }).smUnilateral).toBeNull();
    const p = parseSmBridgePayload({
      smUnilateral: { farmers_grip: 'right', grip_support: 'left', stone_load: 'middle', yoke_walk: 'RIGHT' },
    });
    expect(p.smUnilateral).toEqual({ farmers_grip: 'right', grip_support: 'left' });
  });
  it('C6: smWaveSets санитизируется (1..10, кап 12)', () => {
    expect(parseSmBridgePayload({}).smWaveSets).toBeNull();
    expect(parseSmBridgePayload({ smWaveSets: 'мусор' }).smWaveSets).toBeNull();
    const p = parseSmBridgePayload({ smWaveSets: [3, 3, 4, 0, 99, 'x' as any, 4] });
    expect(p.smWaveSets).toEqual([3, 3, 4, 4]);
    const many = Array.from({ length: 15 }, () => 4);
    expect(parseSmBridgePayload({ smWaveSets: many }).smWaveSets!.length).toBe(12);
  });
});
