import { describe, it, expect } from 'vitest';
import {
  DESIGNER_TO_PHASE,
  MACRO_TO_PHASE,
  PHASE_TO_DESIGNER,
  PHASE_TO_MACRO,
  designerPhaseToUserPhase,
  macroPhaseToUserPhase,
  macroPhaseToLmsPhase,
  isDeloadLikePhaseKey,
  isDeloadLikeMacroPhase,
} from '../phase-bridge';
import type { PhaseKey } from '../../periodization-designer.engine';
import type { MacroPhase } from '../../lms/macrocycle.engine';
import type { Phase } from '../../user-program/user-program.types';

describe('phase-bridge: DESIGNER_TO_PHASE', () => {
  it('маппит все 10 PhaseKey в 4 Phase', () => {
    const allKeys: PhaseKey[] = [
      'accumulation_hypertrophy', 'accumulation_strength', 'intensification', 'peaking',
      'deload', 'technique', 'conditioning', 'power', 'gpp', 'transition',
    ];
    for (const k of allKeys) {
      const p = DESIGNER_TO_PHASE[k];
      expect(['accumulation', 'intensification', 'deload', 'peaking']).toContain(p);
    }
  });

  it('коллапсирует accumulation_hypertrophy и accumulation_strength в accumulation', () => {
    expect(DESIGNER_TO_PHASE.accumulation_hypertrophy).toBe('accumulation');
    expect(DESIGNER_TO_PHASE.accumulation_strength).toBe('accumulation');
  });

  it('маппит peaking→peaking, deload→deload, intensification→intensification (1:1)', () => {
    expect(DESIGNER_TO_PHASE.peaking).toBe('peaking');
    expect(DESIGNER_TO_PHASE.deload).toBe('deload');
    expect(DESIGNER_TO_PHASE.intensification).toBe('intensification');
  });

  it('коллапсирует неканонические ключи: technique/conditioning/gpp→accumulation, power→intensification, transition→deload', () => {
    expect(DESIGNER_TO_PHASE.technique).toBe('accumulation');
    expect(DESIGNER_TO_PHASE.conditioning).toBe('accumulation');
    expect(DESIGNER_TO_PHASE.gpp).toBe('accumulation');
    expect(DESIGNER_TO_PHASE.power).toBe('intensification');
    expect(DESIGNER_TO_PHASE.transition).toBe('deload');
  });
});

describe('phase-bridge: MACRO_TO_PHASE', () => {
  it('маппит все 5 MacroPhase в 4 Phase', () => {
    const allPhases: MacroPhase[] = ['endurance', 'strength', 'peak', 'competition', 'transition'];
    for (const mp of allPhases) {
      const p = MACRO_TO_PHASE[mp];
      expect(['accumulation', 'intensification', 'deload', 'peaking']).toContain(p);
    }
  });

  it('endurance→accumulation, strength→intensification, peak/competition→peaking, transition→deload', () => {
    expect(MACRO_TO_PHASE.endurance).toBe('accumulation');
    expect(MACRO_TO_PHASE.strength).toBe('intensification');
    expect(MACRO_TO_PHASE.peak).toBe('peaking');
    expect(MACRO_TO_PHASE.competition).toBe('peaking');
    expect(MACRO_TO_PHASE.transition).toBe('deload');
  });
});

describe('phase-bridge: MACRO_TO_LMS_PHASE', () => {
  it('сохраняет смысл всех фаз годового плана для LMS/UI', () => {
    expect(macroPhaseToLmsPhase('endurance')).toBe('base');
    expect(macroPhaseToLmsPhase('strength')).toBe('build');
    expect(macroPhaseToLmsPhase('peak')).toBe('peak');
    expect(macroPhaseToLmsPhase('competition')).toBe('peak');
    expect(macroPhaseToLmsPhase('transition')).toBe('deload');
  });
});

describe('phase-bridge: обратные маппинги', () => {
  it('PHASE_TO_DESIGNER даёт валидный PhaseKey для каждой Phase', () => {
    const phases: Phase[] = ['accumulation', 'intensification', 'deload', 'peaking'];
    for (const p of phases) {
      const pk = PHASE_TO_DESIGNER[p];
      expect(typeof pk).toBe('string');
      expect(DESIGNER_TO_PHASE[pk]).toBe(p);
    }
  });

  it('PHASE_TO_MACRO даёт валидный MacroPhase для каждой Phase', () => {
    const phases: Phase[] = ['accumulation', 'intensification', 'deload', 'peaking'];
    for (const p of phases) {
      const mp = PHASE_TO_MACRO[p];
      expect(typeof mp).toBe('string');
      expect(MACRO_TO_PHASE[mp]).toBe(p);
    }
  });
});

describe('phase-bridge: функции-мапперы', () => {
  it('designerPhaseToUserPhase возвращает корректный Phase для всех PhaseKey', () => {
    expect(designerPhaseToUserPhase('peaking')).toBe('peaking');
    expect(designerPhaseToUserPhase('deload')).toBe('deload');
    expect(designerPhaseToUserPhase('power')).toBe('intensification');
    expect(designerPhaseToUserPhase('transition')).toBe('deload');
  });

  it('macroPhaseToUserPhase возвращает корректный Phase для всех MacroPhase', () => {
    expect(macroPhaseToUserPhase('endurance')).toBe('accumulation');
    expect(macroPhaseToUserPhase('strength')).toBe('intensification');
    expect(macroPhaseToUserPhase('peak')).toBe('peaking');
    expect(macroPhaseToUserPhase('competition')).toBe('peaking');
    expect(macroPhaseToUserPhase('transition')).toBe('deload');
  });

  it('isDeloadLikePhaseKey: deload и transition → true, остальные → false', () => {
    expect(isDeloadLikePhaseKey('deload')).toBe(true);
    expect(isDeloadLikePhaseKey('transition')).toBe(true);
    expect(isDeloadLikePhaseKey('peaking')).toBe(false);
    expect(isDeloadLikePhaseKey('accumulation_hypertrophy')).toBe(false);
  });

  it('isDeloadLikeMacroPhase: transition → true, остальные → false', () => {
    expect(isDeloadLikeMacroPhase('transition')).toBe(true);
    expect(isDeloadLikeMacroPhase('endurance')).toBe(false);
    expect(isDeloadLikeMacroPhase('peak')).toBe(false);
  });
});
