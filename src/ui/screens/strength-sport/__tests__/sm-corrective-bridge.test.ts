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
  it('buildSMSpecProtocols берёт дозу библиотечной ⭐, чужой — ранжир', () => {
    const lib = buildSMSpecProtocols(['stone_off_floor'], { stone_off_floor: 'sm_stone_off_floor_tech' }, { stone_off_floor: 'technique' }, [], []);
    expect(lib.stone_off_floor.sets).toBe(4);
    expect(lib.stone_off_floor.pct).toBeLessThanOrEqual(90);
    const rank = buildSMSpecProtocols(['yoke_walk'], { yoke_walk: 'nope' }, {}, [], []);
    expect(rank.yoke_walk.sets).toBeGreaterThan(0);
    expect(rank.yoke_walk.pct).toBeGreaterThanOrEqual(50);
    expect(buildSMSpecProtocols([], null, null)).toEqual({});
  });
});
