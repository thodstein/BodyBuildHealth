import { describe, expect, it } from 'vitest';
import { buildArmMacrocycle } from '../../arm/arm-macrocycle.engine';
import { annualPlanFromMacro, buildAnnualBlock, buildAnnualPlan } from '../block-builders.engine';
import { loadAnnualTrainingPlan, removeAnnualTrainingPlan, saveAnnualTrainingPlan } from '../annual-training-storage';

describe('ARM annual block contract', () => {
  it('собирает ARM-блок с отдельным armPlan и пустым bbPlan', () => {
    const macro = buildArmMacrocycle({ totalWeeks: 12 });
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[0], plan, macro, { level: 'intermediate' });
    expect(built.status).toBe('built');
    expect(built.result?.kind).toBe('ARM');
    expect(built.result?.armPlan).toBeTruthy();
    expect(built.result?.bbPlan).toBeNull();
     expect(built.result?.weeks.length).toBe(plan.blocks[0].ref.weeks);
     expect((built.result?.armPlan as any)?.planSnapshotId).toBeTruthy();
     expect(built.result?.weeks[0]?.armMetadata).toBeTruthy();
     expect(built.result?.weeks[0]?.sessions[0]?.armMetadata).toBeTruthy();
     expect(built.result?.weeks[0]?.sessions[0]?.blocks[0]?.armMetadata).toBeTruthy();
     expect((built.result?.weeks[0]?.sessions[0]?.blocks[0]?.armMetadata as any)?.exerciseId).toBeTruthy();

  });

  it('проходит полный annual plan и не смешивает ARM с BB', () => {
    const macro = buildArmMacrocycle({ totalWeeks: 12 });
    const plan = annualPlanFromMacro(macro);
    const result = buildAnnualPlan(plan, macro, { level: 'intermediate' });
    expect(result.failed).toBe(0);
    expect(result.plan.direction).toBe('arm');
    expect(result.plan.blocks.every((block) => block.ref.kind === 'ARM')).toBe(true);
    expect(result.plan.blocks.every((block) => block.result?.bbPlan === null)).toBe(true);
    expect(result.plan.blocks.some((block) => !!block.result?.armPlan)).toBe(true);
  });

  it('сохраняет ARM snapshot через annual storage', () => {
    const macro = buildArmMacrocycle({ totalWeeks: 8 });
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[0], plan, macro, { level: 'intermediate' });
    const saved = saveAnnualTrainingPlan({ ...plan, blocks: [built], status: built.status });
    const loaded = loadAnnualTrainingPlan();
    expect(loaded?.blocks[0].result?.armPlan).toBeTruthy();
    expect(loaded?.blocks[0].result?.bbPlan).toBeNull();
    expect(saved.id).toBe(plan.id);
    removeAnnualTrainingPlan();
  });
});
