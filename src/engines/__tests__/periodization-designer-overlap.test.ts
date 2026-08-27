/**
 * Tests for P0-2 (overlap detection) + P1-2 (gap warnings) in periodization-designer.engine.ts.
 * Verifies getDesignStats reports overlaps and gaps, and addBlockToDesign/moveBlockInDesign
 * mark overlapping blocks via overlapping flag (notes stay clean).
 */
import { describe, it, expect } from 'vitest';
import {
  createEmptyDesign,
  addBlockToDesign,
  moveBlockInDesign,
  resizeBlockInDesign,
  resolveDesignOverlaps,
  getDesignStats,
  getDefaultPresetDesigns,
  type MacrocycleDesign,
} from '../periodization-designer.engine';

describe('P0-2: Periodization Designer overlap detection', () => {
  it('addBlockToDesign marks overlapping block via flag (notes clean)', () => {
    const design = createEmptyDesign('test');
    design.totalWeeks = 20;
    const d1 = addBlockToDesign(design, 'accumulation_hypertrophy', 1);
    // Block 1 covers weeks 1-4 (template weeks=4)
    expect(d1.blocks[0].startWeek).toBe(1);
    expect(d1.blocks[0].endWeek).toBe(4);
    // Add a second block starting at week 3 — overlaps with block 1
    const d2 = addBlockToDesign(d1, 'intensification', 3);
    const overlapBlock = d2.blocks.find((b) => b.phaseKey === 'intensification');
    expect(overlapBlock).toBeDefined();
    expect(overlapBlock!.overlapping).toBe(true);
    expect(overlapBlock!.notes).not.toContain('OVERLAP');
    expect(overlapBlock!.notes).not.toContain('accumulation_hypertrophy');
  });

  it('moveBlockInDesign marks overlaps via flag when moved onto existing block', () => {
    const design = createEmptyDesign('test');
    design.totalWeeks = 30;
    const d1 = addBlockToDesign(design, 'accumulation_hypertrophy', 1); // weeks 1-4
    const d2 = addBlockToDesign(d1, 'intensification', 10); // weeks 10-12
    // Move block 2 to start at week 3 — overlaps with block 1 (weeks 1-4)
    const block2Id = d2.blocks.find((b) => b.phaseKey === 'intensification')!.id;
    const d3 = moveBlockInDesign(d2, block2Id, 3);
    const moved = d3.blocks.find((b) => b.id === block2Id);
    expect(moved).toBeDefined();
    expect(moved!.overlapping).toBe(true);
    expect(moved!.notes).not.toContain('OVERLAP');
  });

  it('non-overlapping blocks do not get overlap notes', () => {
    const design = createEmptyDesign('test');
    design.totalWeeks = 30;
    const d1 = addBlockToDesign(design, 'accumulation_hypertrophy', 1); // weeks 1-4
    const d2 = addBlockToDesign(d1, 'intensification', 10); // weeks 10-12
    const block2 = d2.blocks.find((b) => b.phaseKey === 'intensification')!;
    expect(block2.notes).not.toContain('accumulation_hypertrophy');
    expect(block2.notes).not.toContain('OVERLAP');
  });
});

describe('P1-2: getDesignStats gap + overlap reporting', () => {
  it('reports gapRanges when weeks are uncovered', () => {
    const design = createEmptyDesign('test');
    design.totalWeeks = 20;
    // Block covers weeks 1-4 only → weeks 5-20 are gaps
    const d1 = addBlockToDesign(design, 'accumulation_hypertrophy', 1);
    const stats = getDesignStats(d1);
    expect(stats.gapRanges).toBeDefined();
    expect(stats.gapRanges.length).toBeGreaterThan(0);
    // weeks 5-20 should be one gap range
    expect(stats.gapRanges).toContain('5-20');
  });

  it('reports no gaps when all weeks covered', () => {
    const design = createEmptyDesign('test');
    design.totalWeeks = 4;
    const d1 = addBlockToDesign(design, 'accumulation_hypertrophy', 1); // weeks 1-4
    const stats = getDesignStats(d1);
    expect(stats.gapRanges).toBeDefined();
    expect(stats.gapRanges.length).toBe(0);
  });

  it('reports overlapWeeks when blocks overlap', () => {
    const design = createEmptyDesign('test');
    design.totalWeeks = 20;
    const d1 = addBlockToDesign(design, 'accumulation_hypertrophy', 1); // weeks 1-4
    const d2 = addBlockToDesign(d1, 'intensification', 3); // weeks 3-5, overlaps weeks 3-4
    const stats = getDesignStats(d2);
    expect(stats.overlapWeeks).toBe(2); // weeks 3 and 4
  });

  it('reports zero overlapWeeks when blocks do not overlap', () => {
    const design = createEmptyDesign('test');
    design.totalWeeks = 30;
    const d1 = addBlockToDesign(design, 'accumulation_hypertrophy', 1); // weeks 1-4
    const d2 = addBlockToDesign(d1, 'intensification', 10); // weeks 10-12
    const stats = getDesignStats(d2);
    expect(stats.overlapWeeks).toBe(0);
  });

  it('counts unique overlap weeks and does not inflate used weeks', () => {
    const design = createEmptyDesign('test');
    design.totalWeeks = 12;
    const first = addBlockToDesign(design, 'accumulation_hypertrophy', 1);
    const second = addBlockToDesign(first, 'intensification', 2);
    const third = addBlockToDesign(second, 'power', 3);
    const stats = getDesignStats(third);
    expect(stats.overlapWeeks).toBe(3);
    expect(stats.usedWeeks).toBe(4);
    expect(stats.freeWeeks).toBe(8);
  });

  it('consolidates consecutive gap weeks into ranges', () => {
    const design = createEmptyDesign('test');
    design.totalWeeks = 16;
    // Block weeks 1-4, gap 5-8, block weeks 9-11, gap 12-16
    const d1 = addBlockToDesign(design, 'accumulation_hypertrophy', 1); // 1-4
    const d2 = addBlockToDesign(d1, 'intensification', 9); // 9-11
    const stats = getDesignStats(d2);
    expect(stats.gapRanges).toContain('5-8');
    expect(stats.gapRanges).toContain('12-16');
  });
});

describe('periodization presets', () => {
  it('contains usable GPP/transition blocks and fills the requested horizon', () => {
    const presets = getDefaultPresetDesigns();
    const annual = presets.find(p => p.name === '52-нед годовой план')!;
    expect(annual.blocks.some(block => block.phaseKey === 'gpp')).toBe(true);
    expect(annual.blocks.some(block => block.phaseKey === 'transition')).toBe(true);
    expect(annual.blocks.at(-1)!.endWeek).toBe(52);
  });
});

describe('P1-3: resizeBlockInDesign clamps to totalWeeks', () => {
  it('resize does not extend endWeek beyond totalWeeks', () => {
    const design = createEmptyDesign('test');
    design.totalWeeks = 10;
    const d1 = addBlockToDesign(design, 'accumulation_hypertrophy', 1); // weeks 1-4
    // Try to resize to end at week 20 — should clamp to 10
    const d2 = resizeBlockInDesign(d1, d1.blocks[0].id, 20);
    const resized = d2.blocks[0];
    expect(resized.endWeek).toBe(10);
  });

  it('resize does not allow endWeek < startWeek', () => {
    const design = createEmptyDesign('test');
    design.totalWeeks = 10;
    const d1 = addBlockToDesign(design, 'accumulation_hypertrophy', 5); // weeks 5-8
    // Try to resize to end at week 3 — should clamp to startWeek (5)
    const d2 = resizeBlockInDesign(d1, d1.blocks[0].id, 3);
    const resized = d2.blocks[0];
    expect(resized.endWeek).toBe(5); // Math.max(block.startWeek, ...)
  });

  it('resolveDesignOverlaps moves later blocks and removes conflicts', () => {
    const design = createEmptyDesign('test');
    design.totalWeeks = 12;
    const d1 = addBlockToDesign(design, 'accumulation_hypertrophy', 1);
    const d2 = addBlockToDesign(d1, 'intensification', 3);
    const resolved = resolveDesignOverlaps(d2);
    const stats = getDesignStats(resolved);
    expect(stats.overlapWeeks).toBe(0);
    expect(resolved.blocks[1].startWeek).toBeGreaterThan(resolved.blocks[0].endWeek);
  });

  it('move clears stale overlap notes after the conflict is removed', () => {
    const design = createEmptyDesign('test');
    design.totalWeeks = 20;
    const d1 = addBlockToDesign(design, 'accumulation_hypertrophy', 1);
    const d2 = addBlockToDesign(d1, 'intensification', 3);
    const secondId = d2.blocks.find(block => block.phaseKey === 'intensification')!.id;
    const d3 = moveBlockInDesign(d2, secondId, 10);
    const second = d3.blocks.find(block => block.id === secondId)!;
    expect(second.notes).not.toContain('OVERLAP');
    expect(second.notes).not.toContain('accumulation_hypertrophy');
  });
});
