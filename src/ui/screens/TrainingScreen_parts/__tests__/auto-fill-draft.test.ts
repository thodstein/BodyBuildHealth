import { describe, expect, it } from 'vitest';
import { autoFillDraftDispatch, buildBBUserProgramFromProfile } from '../auto-fill-draft';
import { DEFAULT_PROFILE } from '../training-profile';
import { validateProgram } from '../../../../engines/user-program/program-store';
import { createBlank } from '../../../../engines/user-program/program-store';

describe('manual constructor shared BB draft builder', () => {
  it('creates a populated program with requested metadata', () => {
    const program = buildBBUserProgramFromProfile({
      title: 'Test BB', goal: 'hypertrophy', level: 'intermediate', days: 3, weeks: 8,
      prof: { ...DEFAULT_PROFILE, equipment: ['barbell', 'dumbbell'] },
      trainingFocus: 'hypertrophy',
    });
    expect(program.meta.title).toBe('Test BB');
    expect(program.meta.daysPerWeek).toBe(3);
    expect(program.meta.weeks).toBe(8);
    expect(program.meta.trainingFocus).toBe('hypertrophy');
    expect(program.bb?.weeks.length).toBeGreaterThan(0);
  });

  it('does not emit the success toast when auto-fill cannot build the direction', () => {
    const toasts: string[] = [];
    const program = createBlank('bb');
    autoFillDraftDispatch({
      program: { ...program, bb: undefined },
      prof: DEFAULT_PROFILE,
      days: 4,
      labMrvMultiplier: 1,
      update: () => undefined,
      showToast: message => toasts.push(message),
    });
    expect(toasts.some(message => message.includes('Черновик создан'))).toBe(false);
  });

  it('uses the same shared BB builder for Hybrid auto-fill', () => {
    const program = createBlank('hybrid');
    const patches: any[] = [];
    autoFillDraftDispatch({
      program,
      prof: DEFAULT_PROFILE,
      days: 4,
      labMrvMultiplier: 1,
      update: patch => patches.push(patch),
      showToast: () => undefined,
    });
    expect(patches[0]?.hybrid?.bbWeeks?.length).toBeGreaterThan(0);
  });
});

describe('manual constructor Hybrid validation', () => {
  it('reports a malformed Hybrid body', () => {
    const program = { meta: { direction: 'hybrid', title: 'Broken', daysPerWeek: 4, weeks: 8 } } as any;
    const issues = validateProgram(program);
    expect(issues.some(issue => issue.code === 'NO_HYBRID_BODY')).toBe(true);
  });

  it('accepts an empty but structurally valid Hybrid body with informational issues', () => {
    const program = {
      meta: { direction: 'hybrid', title: 'Hybrid', daysPerWeek: 4, weeks: 8 },
      hybrid: { plRef: { sourceCycleId: '', sessionIndices: [] }, bbWeeks: [], notes: '' },
    } as any;
    const issues = validateProgram(program);
    expect(issues.some(issue => issue.code === 'NO_HYBRID_BODY')).toBe(false);
    expect(issues.some(issue => issue.code === 'HYBRID_NO_BB')).toBe(true);
  });
});
