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
    // было: expect(defMob.score).toBe(defPlain.score - 15) — держалось на узком пуле из 3 кандидатов
    // стало (ROUND-9: ядро 5 кандидатов на фазу): дефицит-упражнения получают −15 и вытесняются из топ-3
    expect(plain.some(c => c.id === 'deficit_snatch')).toBe(true);
    expect(mob.some(c => c.id === 'deficit_snatch')).toBe(false);
    expect(mob[0].id).not.toBe('deficit_snatch');
    expect(mob.length).toBeGreaterThan(0);
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
  it('comp: доза −5% и силовые пики тонут (паритет библиотеки)', () => {
    const plain = rankCorrectionsForTA('snatch_off_floor');
    const comp = rankCorrectionsForTA('snatch_off_floor', { seasonPhase: 'comp' });
    expect(comp[0].protocol.pct).toBe(plain[0].protocol.pct - 5);
    // было: pullPlain/pullComp по snatch_pull (жил в топ-3 узкого пула)
    // стало (ROUND-9: 5 кандидатов): силовые пики тонут → ни один тяговый id не в топ-1,
    // а любой тяговый, попавший в оба списка, теряет ровно 10
    expect(comp[0].id).not.toMatch(/pull|squat|deadlift|press/);
    const plainScore = new Map(plain.map(c => [c.id, c.score]));
    for (const c of comp) {
      if (/pull|squat|deadlift|press/.test(c.id)) {
        expect(c.score, c.id).toBe((plainScore.get(c.id) ?? 0) - 10);
      }
    }
    expect(plain.some(c => c.id === 'snatch_pull')).toBe(true);
    // без флага — байт-в-байт
    expect(JSON.stringify(rankCorrectionsForTA('snatch_off_floor', {}))).toBe(JSON.stringify(plain));
  });
});
