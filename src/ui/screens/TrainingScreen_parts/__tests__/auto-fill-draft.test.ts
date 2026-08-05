import { describe, expect, it } from 'vitest';
import { autoFillDraftDispatch, buildBBUserProgramFromProfile } from '../auto-fill-draft';
import { DEFAULT_PROFILE } from '../training-profile';
import { isUserProgramShape, validateProgram } from '../../../../engines/user-program/program-store';
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

describe('manual constructor JSON import shape', () => {
  it('rejects malformed records before they reach the store', () => {
    expect(isUserProgramShape(null)).toBe(false);
    expect(isUserProgramShape({ meta: { id: 'x', title: 'Broken', direction: 'bb', daysPerWeek: 4, weeks: 8 } })).toBe(false);
    expect(isUserProgramShape({ meta: { id: 'x', title: 'Broken', direction: 'unknown', daysPerWeek: 4, weeks: 8 }, bb: {} })).toBe(false);
  });

  it('accepts the three supported program shapes', () => {
    const meta = { id: 'x', title: 'Valid', direction: 'bb' as const, daysPerWeek: 4, weeks: 8 };
    expect(isUserProgramShape({ meta, bb: { weeks: [] } })).toBe(true);
    expect(isUserProgramShape({ meta: { ...meta, direction: 'pl' }, pl: { schedule: [] } })).toBe(true);
    expect(isUserProgramShape({ meta: { ...meta, direction: 'hybrid' }, hybrid: { bbWeeks: [], plRef: { sessionIndices: [] } } })).toBe(true);
  });

  it('rejects PL schedules with invalid calendar days', () => {
    expect(isUserProgramShape({
      meta: { id: 'pl', title: 'PL', direction: 'pl', daysPerWeek: 4, weeks: 8 },
      pl: { schedule: [{ sessionIdx: 0, dayOfWeek: 7 }] },
    })).toBe(false);
  });

  it('rejects BB records with damaged nested sessions or blocks', () => {
    const meta = { id: 'bb', title: 'BB', direction: 'bb' as const, daysPerWeek: 4, weeks: 8 };
    expect(isUserProgramShape({ meta, bb: { weeks: [{ sessions: null }] } })).toBe(false);
    expect(isUserProgramShape({ meta, bb: { weeks: [{ sessions: [{ id: 's', blocks: null }] }] } })).toBe(false);
    expect(isUserProgramShape({ meta, bb: { weeks: [{ sessions: [{ id: 's', blocks: [{ id: 'b', exerciseName: 'Squat', sets: null }] }] }] } })).toBe(false);
  });

  it('rejects damaged nested PL and Hybrid weeks', () => {
    const meta = { id: 'p', title: 'Program', daysPerWeek: 4, weeks: 8 };
    expect(isUserProgramShape({
      meta: { ...meta, direction: 'pl' as const },
      pl: { schedule: [], customWeeks: [{ week: 1, days: null }] },
    })).toBe(false);
    expect(isUserProgramShape({
      meta: { ...meta, direction: 'hybrid' as const },
      hybrid: { bbWeeks: [{ sessions: null }], plRef: { sessionIndices: [] } },
    })).toBe(false);
  });

  it('rejects duplicate BB editor identifiers', () => {
    const meta = { id: 'bb-ids', title: 'BB', direction: 'bb' as const, daysPerWeek: 4, weeks: 1 };
    const block = { id: 'b', exerciseName: 'Squat', sets: [] };
    expect(isUserProgramShape({
      meta,
      bb: { weeks: [{ sessions: [{ id: 's', blocks: [block] }, { id: 's', blocks: [] }] }] },
    })).toBe(false);
    expect(isUserProgramShape({
      meta,
      bb: { weeks: [{ sessions: [{ id: 's', blocks: [block, { ...block }] }] }] },
    })).toBe(false);
  });

  it('rejects duplicate PL sessions and invalid Hybrid references', () => {
    expect(isUserProgramShape({
      meta: { id: 'pl-dup', title: 'PL', direction: 'pl', daysPerWeek: 4, weeks: 8 },
      pl: { schedule: [{ sessionIdx: 0, dayOfWeek: 0 }, { sessionIdx: 0, dayOfWeek: 2 }] },
    })).toBe(false);
    expect(isUserProgramShape({
      meta: { id: 'hybrid-ref', title: 'Hybrid', direction: 'hybrid', daysPerWeek: 4, weeks: 8 },
      hybrid: { bbWeeks: [], plRef: { sessionIndices: [-1, 1] } },
    })).toBe(false);
  });

  it('rejects invalid program metadata ranges', () => {
    expect(isUserProgramShape({
      meta: { id: 'bad-meta', title: 'Bad', direction: 'bb', daysPerWeek: 0, weeks: 8 },
      bb: { weeks: [] },
    })).toBe(false);
    expect(isUserProgramShape({
      meta: { id: 'bad-meta', title: 'Bad', direction: 'bb', daysPerWeek: 4, weeks: 53 },
      bb: { weeks: [] },
    })).toBe(false);
  });
});
