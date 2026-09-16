import { describe, it, expect } from 'vitest';
import { assessArmliftHand, holdCurveFor } from '../armlift-hand.engine';

describe('PRO-6 M3: рука', () => {
  it('без замеров — просьба замерить, без флагов', () => {
    const r = assessArmliftHand({});
    expect(r.thickPenalty).toBe(false);
    expect(r.handNote).toContain('Замерь размах');
  });
  it('размах <20 — толстый гриф дорог', () => {
    const r = assessArmliftHand({ implement: 'rolling_thunder', spanCm: 19 });
    expect(r.thickPenalty).toBe(true);
    expect(r.handNote).toContain('дорогие');
  });
  it('размах >23 — щипок проверять', () => {
    const r = assessArmliftHand({ spanCm: 24 });
    expect(r.thickPenalty).toBe(false);
    expect(r.handNote).toContain('толстый гриф сидит');
  });
  it('короткий большой — сужай щипок', () => {
    const r = assessArmliftHand({ spanCm: 21, thumbCm: 10 });
    expect(r.handNote).toContain('Короткий большой');
  });
  it('Hub малой рукой — про подушечки', () => {
    const r = assessArmliftHand({ implement: 'hub', spanCm: 19 });
    expect(r.handNote).toContain('подушечк');
  });
  it('средняя рука — скидок нет', () => {
    const r = assessArmliftHand({ spanCm: 21 });
    expect(r.thickPenalty).toBe(false);
    expect(r.handNote).toContain('скидок');
  });
});

describe('PRO-6 M4: холд-кривая', () => {
  it('без пары — null', () => {
    expect(holdCurveFor(20, null)).toBeNull();
    expect(holdCurveFor(null, 60)).toBeNull();
  });
  it('оба низкие — both_low', () => {
    expect(holdCurveFor(8, 20)?.curve).toBe('both_low');
  });
  it('пик плывёт — peak_gap', () => {
    expect(holdCurveFor(8, 70)?.curve).toBe('peak_gap');
  });
  it('база сыплется — endurance_gap', () => {
    expect(holdCurveFor(25, 30)?.curve).toBe('endurance_gap');
  });
  it('целая — solid', () => {
    const r = holdCurveFor(25, 70);
    expect(r?.curve).toBe('solid');
    expect(r?.ratio).toBe(2.8);
  });
});
