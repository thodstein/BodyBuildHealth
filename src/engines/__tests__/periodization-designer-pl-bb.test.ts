/**
 * Tests for PL/BB split in periodization-designer.engine.ts
 * Verifies discipline-specific phase sets and presets.
 */
import { describe, it, expect } from 'vitest';
import {
  PL_PHASE_KEYS,
  BB_PHASE_KEYS,
  sportToDiscipline,
  getAllowedPhaseKeysForDiscipline,
  getAllowedPhaseKeysForSport,
  isPhaseAllowedForSport,
  createEmptyDesignForDiscipline,
  getPLPresetDesigns,
  getBBPresetDesigns,
  getPresetsForDiscipline,
  getDefaultPresetDesigns,
  type PhaseKey,
} from '../periodization-designer.engine';

describe('PL/BB discipline phase split', () => {
  it('PL excludes BB hypertrophy and conditioning', () => {
    expect(PL_PHASE_KEYS).not.toContain('accumulation_hypertrophy');
    expect(PL_PHASE_KEYS).not.toContain('conditioning');
    expect(PL_PHASE_KEYS).toContain('accumulation_strength');
    expect(PL_PHASE_KEYS).toContain('power');
    expect(PL_PHASE_KEYS).toContain('technique');
  });

  it('BB excludes PL power and technique', () => {
    expect(BB_PHASE_KEYS).not.toContain('power');
    expect(BB_PHASE_KEYS).not.toContain('technique');
    expect(BB_PHASE_KEYS).toContain('accumulation_hypertrophy');
    expect(BB_PHASE_KEYS).toContain('conditioning');
  });

  it('PL and BB each have 8 phases', () => {
    expect(PL_PHASE_KEYS.length).toBe(8);
    expect(BB_PHASE_KEYS.length).toBe(8);
  });

  it('sportToDiscipline maps correctly', () => {
    expect(sportToDiscipline('powerlifting')).toBe('pl');
    expect(sportToDiscipline('weightlifting')).toBe('pl');
    expect(sportToDiscipline('bodybuilding')).toBe('bb');
    expect(sportToDiscipline('general')).toBe('bb');
    expect(sportToDiscipline('crossfit')).toBe('bb');
  });

  it('getAllowedPhaseKeysForDiscipline returns correct sets', () => {
    expect(getAllowedPhaseKeysForDiscipline('pl')).toEqual(PL_PHASE_KEYS);
    expect(getAllowedPhaseKeysForDiscipline('bb')).toEqual(BB_PHASE_KEYS);
    expect(getAllowedPhaseKeysForSport('powerlifting')).toEqual(PL_PHASE_KEYS);
    expect(getAllowedPhaseKeysForSport('bodybuilding')).toEqual(BB_PHASE_KEYS);
  });

  it('isPhaseAllowedForSport respects discipline', () => {
    expect(isPhaseAllowedForSport('power', 'powerlifting')).toBe(true);
    expect(isPhaseAllowedForSport('power', 'bodybuilding')).toBe(false);
    expect(isPhaseAllowedForSport('conditioning', 'bodybuilding')).toBe(true);
    expect(isPhaseAllowedForSport('conditioning', 'powerlifting')).toBe(false);
    expect(isPhaseAllowedForSport('accumulation_hypertrophy', 'bodybuilding')).toBe(true);
    expect(isPhaseAllowedForSport('accumulation_hypertrophy', 'powerlifting')).toBe(false);
    expect(isPhaseAllowedForSport('technique', 'powerlifting')).toBe(true);
    expect(isPhaseAllowedForSport('technique', 'bodybuilding')).toBe(false);
  });

  it('createEmptyDesignForDiscipline sets sport and goal', () => {
    const pl = createEmptyDesignForDiscipline('pl', 'Test PL');
    expect(pl.sport).toBe('powerlifting');
    expect(pl.goal).toBe('strength');
    expect(pl.name).toBe('Test PL');
    const bb = createEmptyDesignForDiscipline('bb', 'Test BB');
    expect(bb.sport).toBe('bodybuilding');
    expect(bb.goal).toBe('hypertrophy');
    expect(bb.name).toBe('Test BB');
  });

  it('PL presets use only PL phases', () => {
    const presets = getPLPresetDesigns();
    expect(presets.length).toBeGreaterThanOrEqual(4);
    for (const p of presets) {
      expect(p.sport).toBe('powerlifting');
      for (const b of p.blocks) {
        expect(PL_PHASE_KEYS).toContain(b.phaseKey);
      }
      // preset tail filled to totalWeeks
      expect(p.blocks.at(-1)!.endWeek).toBe(p.totalWeeks);
    }
  });

  it('BB presets use only BB phases', () => {
    const presets = getBBPresetDesigns();
    expect(presets.length).toBeGreaterThanOrEqual(4);
    for (const p of presets) {
      expect(p.sport).toBe('bodybuilding');
      for (const b of p.blocks) {
        expect(BB_PHASE_KEYS).toContain(b.phaseKey);
      }
      expect(p.blocks.at(-1)!.endWeek).toBe(p.totalWeeks);
    }
  });

  it('getPresetsForDiscipline matches PL/BB helpers', () => {
    expect(getPresetsForDiscipline('pl').map(p => p.name)).toEqual(getPLPresetDesigns().map(p => p.name));
    expect(getPresetsForDiscipline('bb').map(p => p.name)).toEqual(getBBPresetDesigns().map(p => p.name));
  });

  it('legacy getDefaultPresetDesigns still contains 52-нед годовой план for backward compat', () => {
    const all = getDefaultPresetDesigns();
    const annual = all.find(p => p.name === '52-нед годовой план');
    expect(annual).toBeDefined();
    expect(annual!.blocks.some(b => b.phaseKey === 'gpp')).toBe(true);
    expect(annual!.blocks.some(b => b.phaseKey === 'transition')).toBe(true);
    expect(annual!.blocks.at(-1)!.endWeek).toBe(52);
  });

  it('PL 52-нед preset contains power/technique distinct blocks', () => {
    const pl52 = getPLPresetDesigns().find(p => p.name.includes('52-нед'));
    expect(pl52).toBeDefined();
    expect(pl52!.blocks.some(b => b.phaseKey === 'power')).toBe(true);
    expect(pl52!.blocks.some(b => b.phaseKey === 'technique')).toBe(true);
  });

  it('BB 52-нед preset contains conditioning/hypertrophy distinct blocks', () => {
    const bb52 = getBBPresetDesigns().find(p => p.name.includes('52-нед'));
    expect(bb52).toBeDefined();
    expect(bb52!.blocks.some(b => b.phaseKey === 'conditioning')).toBe(true);
    expect(bb52!.blocks.some(b => b.phaseKey === 'accumulation_hypertrophy')).toBe(true);
  });
});
