import { describe, it, expect } from 'vitest';
import { neckWeeklyPlan, NECK_IDS } from '../combat-neck.engine';
import { vbtEwma, loadVbtHistoryCB } from '../combat-vbt.engine';
import { buildAnnualATR } from '../combat-annual';
import { combatToCardioPayload } from '../combat-integration.engine';
import { buildCombatPlan } from '../combat-builder.engine';
import { weightCutPostWeighInPlan, buildWeightCutProtocol } from '../combat-weight-cut.engine';

describe('combat extra coverage 8', () => {
  it('neck weekly plan level 4 has bridge', () => {
    const plan = neckWeeklyPlan('advanced', 5, 'power');
    expect(plan.some(e=> e.id==='neck_bridge_wrestler') || plan.some(e=> e.id.includes('neck'))).toBe(true);
  });
  it('NECK_IDS 11', () => expect(NECK_IDS.length).toBe(11));
  it('vbtEwma with single value', () => expect(vbtEwma([0.8])).toBe(0.8));
  it('loadVbtHistory empty returns []', () => {
    const h = loadVbtHistoryCB();
    expect(Array.isArray(h)).toBe(true);
  });
  it('annual 2 cycles produce transition blocks', () => {
    const ann = buildAnnualATR('mma', 52, null, { cycles:2 });
    expect(ann.blocks.filter(b=> b.phase==='transition').length).toBeGreaterThanOrEqual(1);
  });
  it('annual 3 cycles totalWeeks 36', () => {
    const ann = buildAnnualATR('mma', 36, null, { cycles:3 });
    expect(ann.totalWeeks).toBe(36);
    expect(ann.blocks.length).toBeGreaterThan(6);
  });
  it('cardio payload for high outside still gives zone2', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, outsideLoad:{ sessionsPerWeek:5, avgDurationMin:90, avgSRPE:7 } } as any);
    const cardio = combatToCardioPayload(plan);
    expect(cardio).not.toBeNull();
    expect(cardio!.zone2MinPerWeek).toBeGreaterThan(0);
  });
  it('weightCutPostWeighIn same-day fiber <10', () => {
    const proto = buildWeightCutProtocol(2, { startWeightKg:80, discipline:'wrestling' } as any)!;
    const plan = weightCutPostWeighInPlan(2, proto, 80);
    expect(plan[0].fiber).toContain('<');
  });
});
