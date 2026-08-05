import { describe, expect, it } from 'vitest';
import { isUserBlockClipboardShape, normalizeProgramDayOfWeek } from '../ProgramEditorComponents';

describe('ProgramEditor block clipboard validation', () => {
  it('rejects malformed clipboard values', () => {
    expect(isUserBlockClipboardShape(null)).toBe(false);
    expect(isUserBlockClipboardShape({ id: 'b', type: 'accessory' })).toBe(false);
    expect(isUserBlockClipboardShape({ id: 'b', type: 'accessory', exerciseName: 'Curl', muscle: 'biceps', role: 'accessory', sets: 'bad' })).toBe(false);
  });

  it('accepts a complete block shape', () => {
    expect(isUserBlockClipboardShape({
      id: 'b', type: 'accessory', exerciseName: 'Curl', muscle: 'biceps', role: 'accessory',
      sets: [{ reps: 10, rir: 2, weight: 20 }],
    })).toBe(true);
  });

  it('rejects clipboard sets with invalid RIR or weight', () => {
    const block = { id: 'b', type: 'accessory', exerciseName: 'Curl', muscle: 'biceps', role: 'accessory', sets: [{ reps: 10, rir: 8, weight: 20 }] };
    expect(isUserBlockClipboardShape(block)).toBe(false);
    expect(isUserBlockClipboardShape({ ...block, sets: [{ reps: 10, rir: 2, weight: -1 }] })).toBe(false);
  });

  it('normalizes PL schedule days and preserves a valid fallback', () => {
    expect(normalizeProgramDayOfWeek(9)).toBe(6);
    expect(normalizeProgramDayOfWeek(-2)).toBe(0);
    expect(normalizeProgramDayOfWeek(Number.NaN, 3)).toBe(3);
  });
});
