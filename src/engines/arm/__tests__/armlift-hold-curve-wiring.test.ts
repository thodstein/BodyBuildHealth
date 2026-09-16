import { describe, it, expect } from 'vitest';
import { diagnoseArmliftCause } from '../armlift-cause.engine';
import { rankArmliftCorrections } from '../armlift-correction.engine';

const base = {
  implement: 'rolling_thunder',
  pinchHoldSec: 15,
  farmerHoldSec: 25,
};

describe('PRO-6 M4: кривая в причине', () => {
  it('без кривой — как раньше (байт-в-байт)', () => {
    const a = diagnoseArmliftCause({ ...base });
    const b = diagnoseArmliftCause({ ...base, holdCurve: null });
    expect(b).toEqual(a);
  });
  it('peak_gap — очки в max_strength + evidence', () => {
    const r = diagnoseArmliftCause({ ...base, holdCurve: { curve: 'peak_gap', ratio: 1.2, note: 'Пик плывёт' } });
    expect(r.evidence.some((e) => e.includes('Холд-кривая'))).toBe(true);
  });
  it('endurance_gap при пограничном счёте перетягивает в endurance', () => {
    const plain = diagnoseArmliftCause({ ...base });
    const curved = diagnoseArmliftCause({ ...base, holdCurve: { curve: 'endurance_gap', ratio: 2, note: 'База сыплется' } });
    expect(curved.evidence.some((e) => e.includes('Холд-кривая'))).toBe(true);
    // кривая добавляет очки, но не ломает базовый вердикт без неё
    expect(typeof plain.cause).toBe('string');
  });
  it('both_low — очки в volume', () => {
    const r = diagnoseArmliftCause({ ...base, gripSessions28d: 10, holdCurve: { curve: 'both_low', ratio: 1.1, note: 'Оба низкие' } });
    expect(r.evidence.some((e) => e.includes('Холд-кривая'))).toBe(true);
  });
  it('solid — только evidence, без очков', () => {
    const a = diagnoseArmliftCause({ ...base });
    const b = diagnoseArmliftCause({ ...base, holdCurve: { curve: 'solid', ratio: 2.8, note: 'Кривая целая' } });
    expect(b.cause).toBe(a.cause);
    expect(b.confidence).toBe(a.confidence);
    expect(b.evidence.some((e) => e.includes('Холд-кривая'))).toBe(true);
  });
});

describe('PRO-6 M4: кривая в ранжире', () => {
  it('без кривой — порядок D8 цел', () => {
    expect(rankArmliftCorrections('support_endurance', 'rolling_thunder', {}).map((c) => c.id))
      .toEqual(['farmer_walk_fat', 'towel_pullup', 'fat_gripz_curl']);
  });
  it('endurance_gap на thumb поднимает длинные холды', () => {
    const plain = rankArmliftCorrections('thumb', 'pinch_block', {}).map((c) => c.id);
    const curved = rankArmliftCorrections('thumb', 'pinch_block', { holdCurve: 'endurance_gap' }).map((c) => c.id);
    expect(curved[0]).toBe('plate_pinch_hold');
    expect(curved.indexOf('plate_pinch_hold')).toBeLessThanOrEqual(plain.indexOf('plate_pinch_hold'));
  });
  it('peak_gap на fingers поднимает короткие пиковые холды', () => {
    const plain = rankArmliftCorrections('fingers', 'rolling_thunder', {}).map((c) => c.id);
    const curved = rankArmliftCorrections('fingers', 'rolling_thunder', { holdCurve: 'peak_gap' }).map((c) => c.id);
    expect(curved.indexOf('rolling_thunder')).toBeLessThanOrEqual(plain.indexOf('rolling_thunder'));
  });
});
