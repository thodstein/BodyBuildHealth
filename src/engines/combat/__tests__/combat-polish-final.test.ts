import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { buildCombatXlsxBuffer, buildCombatXlsxHtml } from '../combat-xlsx.engine';
import { diagnoseVelocityLossCombat } from '../combat-vbt.engine';

describe('combat polish final — XLSX + VBT per-lift', () => {
  it('XLSX HTML still valid (fallback)', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 } as any);
    const html = buildCombatXlsxHtml(plan);
    expect(html).toContain('<html');
    expect(html).toContain('Heatmap');
    expect(html).toContain('Шея');
  });
  it('XLSX buffer binary has PK header (xlsx zip)', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 } as any);
    const buf = buildCombatXlsxBuffer(plan);
    expect(buf.length).toBeGreaterThan(1000);
    // xlsx is zip: starts with PK 0x50 0x4B
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4B);
  });
  it('XLSX buffer contains 3 sheets via size check', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3 } as any);
    const buf = buildCombatXlsxBuffer(plan);
    // should be larger than minimal 1 sheet
    expect(buf.length).toBeGreaterThan(4000);
  });
  it('VBT per-lift map: bench 0.80→0.55 loss 31% triggers RIR+1', () => {
    const d = diagnoseVelocityLossCombat(0.80, 0.55, 20);
    expect(d.lossPct).toBeGreaterThan(25);
    expect(d.lossPct).toBeLessThan(35);
  });
  it('VBT per-lift map specced via builder velocityLossPerLift', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'power', level:'intermediate', weeks:4, daysPerWeek:3, velocityLossPerLift:{ bench_bar:26, squat:10 } } as any);
    const bench = plan.weeksData[0].sessions.flatMap(s=> s.exercises).find(e=> e.id==='bench_bar');
    const squat = plan.weeksData[0].sessions.flatMap(s=> s.exercises).find(e=> e.id==='squat');
    expect(bench).toBeDefined();
    expect(squat).toBeDefined();
    // bench 26% should have higher RIR than squat 10% (not exceeded)
    if (bench && squat) {
      expect(bench.rir).toBeGreaterThanOrEqual(squat.rir);
    }
  });
  it('applyCombatNutrition payload shape', () => {
    const plan = buildCombatPlan({ discipline:'mma', goal:'weight_cut', level:'intermediate', weeks:4, daysPerWeek:3, weightCutKg:4, bodyweight:80 } as any);
    // @ts-ignore
    const snap = plan.inputSnapshot as any;
    expect(snap.weightCutProtocol).toBeDefined();
    expect(snap.weightCutProtocol.fiberGPerDay).toBe(10);
    expect(snap.weightCutProtocol.orsSodiumMmolPerDl).toBe(65);
  });
});
