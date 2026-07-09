// ============================================================
// V7 Risk Integration Hook
// ============================================================

import { useMemo } from 'react';
import { runV7Simulation, type V7RiskInput, type V7RiskResult } from '../../engines/risk-engine-v7';
import type { RiskResult } from '../../core/types';
import type { GeneticProfile } from '../../engines/risk-engine-v7-matrix';

import { useDataLink } from '../../core/data-link';
import { getGlobalNoLabs, getNoLabsSystems } from '../screens/LabsScreen';

export function useV7Risk(): { v7Result: V7RiskResult | null; legacyResult: RiskResult | null } {
  const linked = useDataLink();
  const globalNoLabs = getGlobalNoLabs();
  const noLabSystems = getNoLabsSystems();

  const v7Result = useMemo<V7RiskResult | null>(() => {
    if (!linked.profile) return null;

    const s = linked.profile.settings as any;
    const mode = ((s.pharma?.phase === 'blast' ? 'blast' :
                  s.pharma?.phase === 'cruise' ? 'cruise' :
                  s.pharma?.phase === 'cut' ? 'cut' :
                  s.pharma?.phase === 'recomp' ? 'recomp' : 'bulk') as V7RiskInput['mode']);

    const genetics: GeneticProfile = {
      COMT: s.health?.genetics?.COMT,
      MTHFR: s.health?.genetics?.MTHFR,
      ESR1: s.health?.genetics?.ESR1,
      AGTR1: s.health?.genetics?.AGTR1,
      NOS3: s.health?.genetics?.NOS3,
      SRD5A2: s.health?.genetics?.SRD5A2,
      CYP3A4: s.health?.genetics?.CYP3A4,
    };

    const nutrition = {
      proteinPerKg: s.nutrition?.proteinPerKg ?? 1.8,
      fiberG: s.nutrition?.fiberG ?? 25,
      omega3G: s.nutrition?.omega3G ?? 1.5,
      sodiumG: s.nutrition?.sodiumG ?? 3.5,
      potassiumG: s.nutrition?.potassiumG ?? 3.0,
    };

    const training = {
      workoutsPerWeek: s.training?.daysPerWeek ?? 3,
      avgWorkoutMinutes: s.training?.minutesPerSession ?? 60,
      hasHIIT: s.system?.hasHIIT ?? false,
      volumeTonnes: s.system?.volumeTonnes ?? 8000,
      lissMinutesPerWeek: s.system?.lissMinutesPerWeek ?? 90,
    };

    const course = linked.course || [];
    const continuousWeeks = course.reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 0);
    const stazhWeeks = (s.pharma?.totalCycles || 0) * 12 + continuousWeeks;

    const input: V7RiskInput = {
      labs: linked.labs || [],
      course,
      genetics,
      nutrition,
      training,
      mode,
      stazhWeeks: Math.max(0, stazhWeeks),
      continuousWeeks: Math.max(0, continuousWeeks),
      sleepHours: s.lifestyle?.sleepHours ?? 7,
      stressLevel: s.lifestyle?.stressLevel ?? 5,
      activityLevel: s.lifestyle?.activityLevel ?? 5,
      alcoholPerWeek: s.nutrition?.alcoholPerWeek ?? 0,
      smoke: s.lifestyle?.smoke ?? false,
      forceNoLabs: globalNoLabs,
      noLabSystems,
      // supportIds must be actual supplement IDs matching SUPPORT_REDUCTIONS keys in V7 matrix,
      // NOT system names from supportCoverage. Use profile's currentSupplements.
      supportIds: (s.nutrition.currentSupplements || []).map((s_: any) => s_.id).filter(Boolean),
      mcRuns: s.system.mcRuns ?? 0,
    };

    try {
      return runV7Simulation(input);
    } catch (e) {
      console.error('V7 Risk Engine error:', e);
      return null;
    }
  }, [linked.profile, linked.labs, linked.course, linked.supportCoverage, linked.activeDrugs, globalNoLabs, noLabSystems]);

  const legacyResult = v7Result?.legacyResult ?? null;

  return { v7Result, legacyResult };
}

