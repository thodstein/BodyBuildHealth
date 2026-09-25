import { describe, expect, it } from 'vitest';
import { buildArmMacrocycle } from '../../arm/arm-macrocycle.engine';
import {
  annualPlanFromMacro,
  buildAnnualBlock,
  buildAnnualPlan,
  composeAnnualProgram,
  importProgramIntoAnnualBlock,
} from '../block-builders.engine';
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

  it('сохраняет ARM snapshot и редактируемую программу через annual storage', () => {
    const macro = buildArmMacrocycle({ totalWeeks: 8 });
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[0], plan, macro, { level: 'intermediate' });
    const saved = saveAnnualTrainingPlan({ ...plan, blocks: [built], status: built.status });
    const loaded = loadAnnualTrainingPlan();
    expect(loaded?.blocks[0].result?.armPlan).toBeTruthy();
    expect(loaded?.blocks[0].result?.program?.meta.direction).toBe('arm');
    expect(loaded?.blocks[0].result?.program?.arm?.weeks).toHaveLength(built.result!.weeks.length);
    expect(loaded?.blocks[0].result?.weeks[0]?.armMetadata).toBeTruthy();
    expect(loaded?.blocks[0].result?.bbPlan).toBeNull();
    expect(saved.id).toBe(plan.id);
    removeAnnualTrainingPlan();
  });

  it('импорт ARM-программы сохраняет armPlan и направление arm', () => {
    const macro = buildArmMacrocycle({ totalWeeks: 8 });
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualBlock(plan.blocks[0], plan, macro, { level: 'intermediate' });
    const editedProgram = built.result!.program!;
    editedProgram.arm!.weeks[0].note = 'Правка из ручного редактора';
    const imported = importProgramIntoAnnualBlock(
      { ...plan, blocks: [built] },
      built.ref.blockKey,
      editedProgram,
    );
    const result = imported.blocks[0].result;
    expect(result?.armPlan).toBe(built.result?.armPlan);
    expect(result?.program).toBe(editedProgram);
    expect(result?.program?.meta.direction).toBe('arm');
    expect(result?.weeks[0]?.note).toBe('Правка из ручного редактора');
  });

  it('композиция ARM-плана остаётся ARM, а смешанный план отклоняется', () => {
    const macro = buildArmMacrocycle({ totalWeeks: 8 });
    const plan = annualPlanFromMacro(macro);
    const built = buildAnnualPlan(plan, macro, { level: 'intermediate' }).plan;
    const composed = composeAnnualProgram(built);
    expect(composed?.meta.direction).toBe('arm');
    expect(composed?.arm?.weeks).toHaveLength(built.totalWeeks);
    expect(composed?.bb).toBeUndefined();

    const mixed = {
      ...built,
      blocks: built.blocks.map((block, index) => index === 0 ? { ...block, ref: { ...block.ref, kind: 'BB' as const } } : block),
    };
    expect(() => composeAnnualProgram(mixed)).toThrow(/ARM.*BB|ARM.*смеш/i);
  });
});
