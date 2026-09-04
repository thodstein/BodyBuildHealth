import { describe, it, expect } from 'vitest';
import { rankCorrectionsForTA } from '../strength-sport-ta-correction-rank.engine';

describe('TA correction rank E3', () => {
  it('топ-3 с полями и протоколом 3×5', () => {
    const top = rankCorrectionsForTA('snatch_off_floor');
    expect(top.length).toBeLessThanOrEqual(3);
    expect(top.length).toBeGreaterThan(0);
    expect(top[0].id).toBe('deficit_snatch');
    expect(top[0].protocol.sets).toBe(3);
    expect(top[0].protocol.reps).toBe(5);
    expect(top[0].protocol.pct).toBe(70);
  });
  it('оборудование mismatch исключает штангу', () => {
    const top = rankCorrectionsForTA('snatch_off_floor', { equipment: ['dumbbell'] });
    expect(top.length).toBe(0);
  });
  it('голеностоп штрафует дефицит (не первый)', () => {
    const plain = rankCorrectionsForTA('snatch_off_floor');
    const mob = rankCorrectionsForTA('snatch_off_floor', { mobilityRestrictions: ['ankle'] });
    const defPlain = plain.find(c => c.id === 'deficit_snatch')!;
    const defMob = mob.find(c => c.id === 'deficit_snatch')!;
    expect(defMob.score).toBe(defPlain.score - 15);
  });
  it('причина volume → 4×5, strength → 4×4', () => {
    const v = rankCorrectionsForTA('clean_mid', { cause: 'volume' });
    expect(v[0].protocol.sets).toBe(4);
    expect(v[0].protocol.reps).toBe(5);
    const s = rankCorrectionsForTA('clean_mid', { cause: 'strength' });
    expect(s[0].protocol.sets).toBe(4);
    expect(s[0].protocol.reps).toBe(4);
  });
  it('детерминизм: два прогона равны', () => {
    const a = JSON.stringify(rankCorrectionsForTA('jerk_dip', { cause: 'technique' }));
    const b = JSON.stringify(rankCorrectionsForTA('jerk_dip', { cause: 'technique' }));
    expect(a).toBe(b);
  });
  it('неизвестная фаза → []', () => {
    expect(rankCorrectionsForTA('nope' as any)).toEqual([]);
  });
});
