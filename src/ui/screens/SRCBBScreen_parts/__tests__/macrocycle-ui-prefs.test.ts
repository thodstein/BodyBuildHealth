import { describe, expect, it } from 'vitest';
import { normalizeMacrocycleUiPrefs } from '../MacrocyclePanel';

describe('macrocycle UI preferences', () => {
  it('normalizes valid display preferences', () => {
    expect(normalizeMacrocycleUiPrefs({ density: 'compact', contrast: 'high', showIcons: false })).toEqual({
      density: 'compact', contrast: 'high', showIcons: false,
    });
  });

  it('falls back safely for corrupted persisted values', () => {
    expect(normalizeMacrocycleUiPrefs(null)).toEqual({ density: 'comfortable', contrast: 'normal', showIcons: true });
    expect(normalizeMacrocycleUiPrefs({ density: 'invalid', contrast: 12, showIcons: 'false' })).toEqual({
      density: 'comfortable', contrast: 'normal', showIcons: true,
    });
  });
});
