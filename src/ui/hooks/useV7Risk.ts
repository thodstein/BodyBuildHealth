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

    const settings = linked.profile.settings;
    const mode = (settings.phase === 'blast' ? 'blast' :
                  settings.phase === 'cruise' ? 'cruise' :
                  settings.phase === 'cut' ? 'cut' :
                  settings.phase === 'recomp' ? 'recomp' : 'bulk') as V7RiskInput['mode'];

    const genetics: GeneticProfile = {
      COMT: settings.genetics?.COMT,
      MTHFR: settings.genetics?.MTHFR,
      ESR1: settings.genetics?.ESR1,
      AGTR1: settings.genetics?.AGTR1,
      NOS3: settings.genetics?.NOS3,
      SRD5A2: settings.genetics?.SRD5A2,
      CYP3A4: settings.genetics?.CYP3A4,
    };

    const nutrition = {
      proteinPerKg: settings.proteinPerKg ?? 1.8,
      fiberG: settings.fiberG ?? 25,
      omega3G: settings.omega3G ?? 1.5,
      sodiumG: settings.sodiumG ?? 3.5,
      potassiumG: settings.potassiumG ?? 3.0,
    };

    const training = {
      workoutsPerWeek: settings.workoutsPerWeek ?? 3,
      avgWorkoutMinutes: settings.avgWorkoutMinutes ?? 60,
      hasHIIT: settings.hasHIIT ?? false,
      volumeTonnes: settings.volumeTonnes ?? 8000,
      lissMinutesPerWeek: settings.lissMinutesPerWeek ?? 90,
    };

    const course = linked.course || [];
    const continuousWeeks = course.reduce((max, c) => Math.max(max, (c.endWeek || 12) - (c.startWeek || 0)), 0);
    const stazhWeeks = (settings.totalCycles || 0) * 12 + continuousWeeks;

    const input: V7RiskInput = {
      labs: linked.labs || [],
      course,
      genetics,
      nutrition,
      training,
      mode,
      stazhWeeks: Math.max(0, stazhWeeks),
      continuousWeeks: Math.max(0, continuousWeeks),
      sleepHours: settings.sleepHours ?? settings.baselineSleepHours ?? 7,
      stressLevel: settings.stressLevel ?? settings.baselineStressLevel ?? 5,
      activityLevel: settings.activityLevel ?? 5,
      alcoholPerWeek: settings.alcoholPerWeek ?? 0,
      smoke: settings.smoke ?? false,
      forceNoLabs: globalNoLabs,
      noLabSystems,
      // supportIds must be actual supplement IDs matching SUPPORT_REDUCTIONS keys in V7 matrix,
      // NOT system names from supportCoverage. Use profile's currentSupplements.
      supportIds: (settings.currentSupplements || []).map(s => s.id).filter(Boolean),
      mcRuns: settings.mcRuns ?? 0,
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

