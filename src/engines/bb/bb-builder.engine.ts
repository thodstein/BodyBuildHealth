/**
 * bb-builder.engine.ts вЂ” РіРµРЅРµСЂР°С‚РѕСЂ Р±РѕРґРёР±РёР»РґРёРЅРі-РїР»Р°РЅР° РёР· СЂР°СЃРєР»Р°РґРєРё СЂРѕС‚Р°С†РёРё (Р­С‚Р°Рї BB6, РїРѕР»РЅС‹Р№ СЂРµС„Р°РєС‚РѕСЂ 3.1).
 * РЎРІСЏР·С‹РІР°РµС‚: bb-split-patterns (СЂР°СЃРїРёСЃР°РЅРёРµ) + bb-day-types (С‚СЏР¶/РїР°РјРї/РїРµСЂРІРёС‡РЅР°СЏ-РґРѕР±РёРІРєР°) +
 * volume-landmarks (MEV/MAV/MRV) + rir-matrix (RIR-РїСЂРѕРіСЂРµСЃСЃРёСЏ РїРѕ РЅРµРґРµР»СЏРј) + selection/volume/loading СЃР»РѕРё.
 *
 * Р›РѕРіРёРєР° (РѕР±РЅРѕРІР»РµРЅР°):
 *  - MAV РјС‹С€С† Р±РµСЂС‘С‚СЃСЏ РёР· volume-landmarks, РјР°СЃС€С‚Р°Р±РёСЂСѓРµС‚СЃСЏ РїРѕРґ РґР»РёРЅСѓ СЂРѕС‚Р°С†РёРё + trainingVolumeMode high (+25% РґР°Р¶Рµ РґР»СЏ РјР°РєСЃР°).
 *  - РљР°Р¶РґР°СЏ РјС‹С€С†Р° РІ СЂРѕС‚Р°С†РёРё: РѕРґРЅР° СЃРµСЃСЃРёСЏ = РїРµСЂРІРёС‡РЅР°СЏ (С‚СЏР¶, ~65% MAV), РґСЂСѓРіРёРµ = РґРѕР±РёРІРєР° (РїР°РјРї, ~35%).
 *    forearms/traps (forceDayType) вЂ” РІСЃРµРіРґР° С‚СЏР¶; РЅРѕРіРё С‚РµРїРµСЂСЊ РњРћР“РЈРў Р±С‹С‚СЊ РїР°РјРї-РґРЅС‘Рј (P0-4 audit 2026-07).
 *    РќРѕРіРё 2Г—/РЅРµРґ: С‚СЏР¶ quads+РїР°РјРї hams+РёРєСЂС‹ / С‚СЏР¶ hams+РїР°РјРї quads+РёРєСЂС‹ РґР»СЏ РІСЃРµС… СѓСЂРѕРІРЅРµР№.
 *  - РЎРµС‚С‹/СЂРµРїС‹/RIR РїРѕ С…Р°СЂР°РєС‚РµСЂСѓ: С‚СЏР¶ 5-8/RIR1-2; РїР°РјРї 12-20/RIR3; Р»С‘Рі 10-15/RIR4.
 *  - PPL: Push в†’ РїР°РјРї РјР°С…Рё СЃСЂРµРґРЅСЏСЏ РґРµР»СЊС‚Р° 3Г—15-20 3-2-1-1 optional, Pull в†’ Р»С‘Р¶Р° РЅР° РЅР°РєР»РѕРЅРЅРѕР№ 3Г—15-20 3-2-1-1 optional.
 *  - Р’РµСЃ = workMax Г— %1RM(RIR, reps). РќРµРґРµР»Рё 2..N: RIR в†“ (rir-matrix) в†’ РІРµСЃ в†‘.
 */

import { SPLIT_PATTERNS, getPattern, sessionsOf, type SplitPattern, type ScheduleDay } from './bb-split-patterns';
import { FORCE_HEAVY_GROUPS, resolveCharacter, TAG_MUSCLES, type DayCharacter, type MuscleSlot } from './bb-day-types';
import { getAllVolumeLandmarks, getVolumeLandmarks, normLevel, type TrainingLevel, type MuscleVolumeLandmarks } from '../volume-landmarks.engine';
import { calibratedLandmarksFor, loadMEVCalibration, type MEVCalibration } from './bb-mev-calibration.engine';
import { tempoFor, REST_BY_CHARACTER, type TempoSpec } from './bb-tempo-rest';
import { aggregateBBVolume, computeMuscleBalance } from './bb-volume.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { selectExercisesSmart, isAxialLoadExercise } from '../exercise-selector.engine';
import { trueMuscleOf, musclesForRole, derivePattern } from '../movement-pattern';
import { PCT_FOR_RIR, S_MRV_FACTOR } from '../rir-table';
import type { PEDAdaptation, CourseIntensity } from './bb-ped-adaptation.engine';
import type { Injury } from '../manual-plan-builder';
import { prescribeLoad, applyPostPhaseProcessing, type LoadStrategy, type IntensityTechnique, type DeloadType } from './bb-autocoach.engine';
import { applyFeedbackToBuild, autoUpdateWeakPoints, autoReplaceOnPlateau, computePerMuscleACWR, applyDiaryVolumeCorrection } from './bb-progression-feedback.engine';
import { extractMesocycleProgression, applyWeightProgression, applyVolumeProgression, wasInPreviousMeso, type MesocycleProgression } from './bb-mesocycle-progression.engine';
import { buildExerciseInstructions, formatExerciseInstructions, cleanInstructionsText, tempoExplain } from './bb-exercise-instructions.engine';
import { loadSessions as loadWorkoutSessions } from '../workout-logger.engine';
import { warmupRampFor } from '../warmup-ramp.engine';
import { getActiveInjuries, getExcludedMuscles, getGradedInjuries, getInjuryVolumeFactor } from '../manual-plan-builder';
import { findGentleSubstitutions } from '../exercise-substitution.engine';
import { computeVolumeLandmarks, type VolumeLandmarkRow } from '../volume-landmarks.engine';
// Р¤Р°Р·РѕРІР°СЏ РїРµСЂРёРѕРґРёР·Р°С†РёСЏ (distributePhases) вЂ” Р•Р”РРќР«Р™ РёСЃС‚РѕС‡РЅРёРє RIR/С„Р°Р·/deload РґР»СЏ Р‘Р‘-РїР»Р°РЅР°.
// РРјРїРѕСЂС‚ distributePhases/getPhaseVolumeMult РёР· UI-РјРѕРґСѓР»СЏ РЅР°РјРµСЂРµРЅРЅС‹Р№: СЌС‚Рѕ РєР°РЅРѕРЅРёС‡РµСЃРєР°СЏ
// СЂРµР°Р»РёР·Р°С†РёСЏ, РєРѕС‚РѕСЂСѓСЋ РёСЃРїРѕР»СЊР·СѓРµС‚ Рё СЂСѓС‡РЅРѕР№ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ (phase-periodization).
import { distributePhases, PHASE_CONFIGS, getPhaseConfig, getPhaseVolumeMult, type BBPhase } from '../periodization';
import { orderSessionExercises, type SessionMethodology } from './bb-session-order.engine';
import { type BBTrainingFocus, FOCUS_RIR_TABLE } from './bb-goal-types';
import { clampRir } from './bb-utils';
import { isInappropriateBB, bbExerciseTier } from './bb-exercise-tier.engine';
import { ANGLE_CLASSES, lengthenedBonus, ensureStrictGroupCoverage } from './bb-exercise-selection.engine';
import { loadSRPESessions } from '../../engines/pro/srpe-store';
import { acuteChronicRatio, toDailyLoads } from '../../engines/pro/training-load.engine';
import type { Macrocycle, MacroPhase, BBMacrocycle, BBMacroPhase } from '../lms/macrocycle.engine';
import { syncBBPlanSetShape, validateBBPlan } from './bb-validator.engine';
import { finalizeBBPlan } from './bb-finalize.engine';
import { buildBBVolumeTarget, type BBVolumeTarget, computeRegimeMrvMult, computeMrvMult, regimeMrvMultFor, computeBBRecoveryScore, computeBBWeeklyBudget, sessionLimitsFor, computeBBRecoveryMultiplier, computeBBNutritionMultiplier, perExerciseCap } from './bb-volume.engine';
import { buildBBExpandedSummary } from './bb-summary.engine';
import { jointGuardScorePenalty, jointGuardActive } from './bb-joint-guard.engine';
import { insulinWindowActive } from './bb-insulin-window.engine';
import { recommendPEDMethodology, applyPEDMethodologyToPlan } from './bb-ped-methodology.engine';
import { REP_SCHEMES, schemeFor, schemeToLoading, applySchemeToPlan } from './bb-rep-schemes.engine';
import type { BBRotationReport } from './bb-rotation.engine';
import type { BBSessionCost } from './bb-fatigue.engine';
import type { BBPlanReport } from './bb-report.engine';
import { applyDUPOverlay, type DUPConfig } from './bb-dup.engine';
import type { BBPlanValidationResult } from './bb-validator.engine';
import { isMobilityRestricted } from './bb-mobility.engine';
import { resolveSpecialization, specializationVolumeFactor, specializationEmphasisFactor, specializationMrvFactor, isSpecializationWeak, isSpecializationFocus, canonicalMuscle, buildSpecializationSchedule, specResForWeekSchedule, tradeoffForWeek, specializationScheduleText, type SpecializationResolution, type SpecializationBlock } from './bb-specialization.engine';
import { applyTradeoffToPlan } from './bb-tradeoff.engine';

// P7: РїСЂРёРѕСЂРёС‚РµС‚ equipment РїРѕ С„Р°Р·Рµ (С„РѕСЂРјРёСЂСѓРµС‚ РїСЂРѕРїРѕСЂС†РёСЋ compound/isolation/cable/machine РёР· PHASE_CONFIGS)
export const PHASE_EQUIPMENT_PREF: Record<string, string[]> = {
  accumulation: ['cable', 'dumbbell', 'machine', 'barbell'],
  intensification: ['barbell', 'machine', 'dumbbell', 'cable'],
  peaking: ['barbell', 'machine', 'dumbbell', 'cable'],
  deload: ['cable', 'bodyweight', 'dumbbell', 'machine'],
};

export type BBGoal = 'mass' | 'cut' | 'recomp' | 'maintenance' | 'strength_mass';
export type BBVolumeGoal = 'mev' | 'mav' | 'mrv';

export interface MusclePlan {
  muscle: string; resolved: string; role: 'primary' | 'accessory';
  sets: number; exerciseCount: number; rir: number;
  reps: number; weight: number; pool: any[]; exDatas: any[]; selType: string;
  rationaleMap: Map<string, string>;
  phaseEquip?: string[];
}

export interface BBBuilderInput {
  patternId: string;
  level: string;                 // beginner/intermediate/advanced/enhanced
  /** Р РµР°Р»СЊРЅС‹Р№ СЃС‚Р°Р¶ СЃРёР»РѕРІС‹С… С‚СЂРµРЅРёСЂРѕРІРѕРє. РќРµ Р·Р°РјРµРЅСЏРµС‚СЃСЏ СЏСЂР»С‹РєРѕРј level. */
  trainingYears?: number;
  /** РЎРїРѕСЃРѕР±РЅРѕСЃС‚СЊ Рє bodyweight-СѓРїСЂР°Р¶РЅРµРЅРёСЏРј. Р•СЃР»Рё РЅРµС‚ РґР°РЅРЅС‹С… вЂ” РїРѕРґС‚СЏРіРёРІР°РЅРёСЏ
   *  РЅРµ СЃС‚Р°РІСЏС‚СЃСЏ РєР°Рє primary; РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ pulldown/assisted РІРјРµСЃС‚Рѕ РЅРёС…. */
  bodyweightCapability?: {
    pullUpsStrict?: number;
    chinUpsStrict?: number;
    dipsStrict?: number;
    pushUpsStrict?: number;
    weightedPullUpLoad?: number;
    assistedPullUpLoad?: number;
  };
  goal: BBGoal;
  weeks: number;                 // РґР»РёС‚РµР»СЊРЅРѕСЃС‚СЊ РјРµР·РѕС†РёРєР»Р°
  workMax?: Record<string, number>; // СЂР°Р±РѕС‡РёР№ РјР°РєСЃРёРјСѓРј РЅР° РјС‹С€С†Сѓ/РґРІРёР¶РµРЅРёРµ (РєРі)
  weakPoints?: string[];         // РѕС‚СЃС‚Р°СЋС‰РёРµ РіСЂСѓРїРїС‹ в†’ MAVв†‘
  focusGroup?: string;           // РіСЂСѓРїРїР° СЃРїРµС†РёР°Р»РёР·Р°С†РёРё в†’ MAVв†‘в†‘
  volumeGoal?: BBVolumeGoal;     // С†РµР»СЊ РїРѕ РѕР±СЉС‘РјСѓ: MEV | MAV | MRV
  specialization?: boolean;      // true = СЃР»Р°Р±С‹Рµ РЅР° MAV+10%, РѕСЃС‚Р°Р»СЊРЅС‹Рµ РЅР° MEV
  /** РЇРІРЅРѕРµ СЂР°СЃРїРёСЃР°РЅРёРµ Р±Р»РѕРєРѕРІ СЃРїРµС†РёР°Р»РёР·Р°С†РёРё (РЅРµРґРµР»Рё + С†РµР»Рё 1-2 РјС‹С€С†С‹; [] = Р±Р°Р»Р°РЅСЃ).
   *  Р‘РµР· РЅРµРіРѕ: РѕРґРёРЅ Р±Р»РѕРє 6-10 РЅРµРґ, Р·Р°С‚РµРј РІРѕР·РІСЂР°С‚ Рє Р±Р°Р»Р°РЅСЃСѓ. */
  specializationSchedule?: SpecializationBlock[];
  injuries?: Injury[];           // С‚СЂР°РІРјС‹ вЂ” РіСЂСѓРїРїС‹ СЃ Р°РєС‚РёРІРЅРѕР№ С‚СЂР°РІРјРѕР№ РёСЃРєР»СЋС‡Р°СЋС‚СЃСЏ РёР· РїР»Р°РЅР°
  planStartWeek?: string;        // ISO-РґР°С‚Р° РЅР°С‡Р°Р»Р° РјРµР·РѕС†РёРєР»Р° (РЅРµРґРµР»СЏ 1) вЂ” РґР»СЏ per-week РѕС†РµРЅРєРё С‚СЂР°РІРј (fix F)
  favoriteExercises?: string[];  // Р›СЋР±РёРјС‹Рµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ вЂ” +15 РїСЂРёРѕСЂРёС‚РµС‚ РїСЂРё РѕС‚Р±РѕСЂРµ
  excludedExercises?: string[];  // РќРµР»СЋР±РёРјС‹Рµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ вЂ” РїРѕР»РЅРѕСЃС‚СЊСЋ РёСЃРєР»СЋС‡Р°СЋС‚СЃСЏ РёР· РїСѓР»Р°
  avoidAxialLoad?: boolean;      // РЈР±СЂР°С‚СЊ РѕСЃРµРІСѓСЋ РЅР°РіСЂСѓР·РєСѓ (РїСЂРёСЃРµРґ/СЃС‚Р°РЅРѕРІР°СЏ/Р¶РёРј СЃС‚РѕСЏ/РіСѓРґРјРѕСЂРЅРёРЅРі)
  /** РњРµРЅСЊС€Рµ РјРЅРѕРіРѕСЃСѓСЃС‚Р°РІРЅС‹С…: Р·Р°РјРµРЅСЏС‚СЊ РїСЂРёСЃРµРґв†’РіР°РєРє/Р¶РёРј РЅРѕРіР°РјРё, С‚СЏРіСѓ С€С‚Р°РЅРіРёв†’РЎРјРёС‚,
   *  С‚СЏРіСѓ РіР°РЅС‚РµР»РµР№в†’РЅР° Р»Р°РІРєРµ Рё С‚.Рґ. (РјР°С€РёРЅР°/РїРѕРґРґРµСЂР¶Р°РЅРЅС‹Рµ РІРјРµСЃС‚Рѕ СЃРІРѕР±РѕРґРЅС‹С…). */
  fewerCompound?: boolean;
  /** Р РµР¶РёРј РІР°СЂРёР°С‚РёРІРЅРѕСЃС‚Рё СѓРїСЂР°Р¶РЅРµРЅРёР№:
   *  - forbid (Р·Р°РїСЂРµС‚): СЃС‚СЂРѕРіРѕ РѕРґРЅРё Рё С‚Рµ Р¶Рµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ РєР°Р¶РґСѓСЋ РЅРµРґРµР»СЋ;
   *  - strict (СЃС‚СЂРѕРіРёР№): СЃРјРµРЅР° СЂР°Р· РІ 4 РЅРµРґРµР»Рё;
   *  - variety (СЂР°Р·РЅРѕРѕР±СЂР°Р·РёРµ): СЃРјРµРЅР° СѓРїСЂР°Р¶РЅРµРЅРёСЏ РјРµР¶РґСѓ СЃРµСЃСЃРёСЏРјРё, СЃРѕС…СЂР°РЅСЏСЏ РЅР°РіСЂСѓР·РєСѓ Рё РїР°С‚С‚РµСЂРЅ. */
  rotationMode?: 'forbid' | 'strict' | 'variety';
  /** РРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ С‚СЂРµРЅРёРЅРіР° вЂ” СѓРїСЂР°РІР»СЏРµС‚ РѕС‚РґС‹С…РѕРј/РїР»РѕС‚РЅРѕСЃС‚СЊСЋ/РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµРј:
   *  - light: РѕС‚РґС‹С… +20% (РЅРёР·РєР°СЏ РїР»РѕС‚РЅРѕСЃС‚СЊ, Р±РѕР»СЊС€Рµ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ);
   *  - moderate: Г—1.0 (СЃС‚Р°РЅРґР°СЂС‚);
   *  - high: РѕС‚РґС‹С… в€’20% (РІС‹СЃРѕРєР°СЏ РїР»РѕС‚РЅРѕСЃС‚СЊ). */
  intensityLevel?: 'light' | 'moderate' | 'high';
  /** Р Р°Р·СЂРµС€РёС‚СЊ СЃРёР»РѕРІС‹Рµ Р»РёС„С‚С‹ (СЃС‚Р°РЅРѕРІР°СЏ/СЃСѓРјРѕ/Р¶РёРј СЃС‚РѕСЏ/Р°СЂРјРµР№СЃРєРёР№) вЂ” РўРћР›Р¬РљРћ РІ
   *  СЃРёР»РѕРІРѕРј С†РёРєР»Рµ (goal=strength_mass) Рё С‚РѕР»СЊРєРѕ РїРѕ РєРЅРѕРїРєРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ. */
  allowStrengthLifts?: boolean;
  sex?: 'male' | 'female';       // РџРѕР» вЂ” РґР»СЏ РїСЂРёРѕСЂРёС‚РµС‚Р° glutes РІ РЅРѕР¶РЅС‹Рµ РґРЅРё (Р¶РµРЅСЃРєРёР№ СЃРїР»РёС‚)
  intensityTechnique?: IntensityTechnique; // Рџ6: С‚РµС…РЅРёРєР° РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚Рё РґР»СЏ РєР°Р¶РґРѕРіРѕ primary
  autoDeload?: boolean;          // Р°РІС‚Рѕ-РґРµР»РѕРґ РїРѕ ACWR
  deloadType?: DeloadType;       // С‚РёРї РґРµР»РѕРґР° (pump/strength/rest)
  loadStrategy?: LoadStrategy;   // СЃС‚СЂР°С‚РµРіРёСЏ РїСЂРѕРіСЂРµСЃСЃРёРё РЅР°РіСЂСѓР·РєРё
  autoRegResult?: {              // СЂРµР·СѓР»СЊС‚Р°С‚ Р°РІС‚РѕСЂРµРіСѓР»СЏС†РёРё (РѕР±СЉС‘Рј/РІРµСЃ/RIR)
    volumeMultiplier: number;
    topSetPctMultiplier: number;
    rirShift: number;
  };
  /** Р”РѕР·С‹ PED (РјРі/РЅРµРґ РёР»Рё РњР•/РґРµРЅСЊ РёР»Рё РјРєРі). РљР»СЋС‡Рё: 'AAS','insulin','MGF','IGF1','GH'.
   *  Dose-aware: 250 РјРі РђРђРЎ в‰  2000 РјРі РђРђРЎ РїРѕ РІР»РёСЏРЅРёСЋ РЅР° MRV. */
  pedDoses?: Record<string, number>;
  /** РРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ РєСѓСЂСЃР° вЂ” РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Р№ MRV boost (mild 1.0 / moderate 1.04 / heavy 1.08). */
  courseIntensity?: CourseIntensity;
  /** Р”РѕСЃС‚СѓРїРЅРѕРµ РѕР±РѕСЂСѓРґРѕРІР°РЅРёРµ (С€С‚Р°РЅРіР°/РіР°РЅС‚РµР»Рё/Р±Р»РѕРє/РјР°С€РёРЅР°/РіРёСЂРё/СЃРІРѕР№ РІРµСЃ) вЂ” С„РёР»СЊС‚СЂ РѕС‚Р±РѕСЂР° СѓРїСЂР°Р¶РЅРµРЅРёР№. */
  equipment?: string[];
  /** РњРµС‚РѕРґРёРєР° РїРѕСЂСЏРґРєР° СѓРїСЂР°Р¶РЅРµРЅРёР№ РІ СЃРµСЃСЃРёРё (compound_first РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ; pre_exhaust вЂ” РёР·РѕР»СЏС†РёСЏ РѕСЃРЅРѕРІРЅРѕР№ РјС‹С€С†С‹ РїРµСЂРІРѕР№). */
  methodology?: SessionMethodology;
  /** P0-5 (audit 2026-07): РјРЅРѕР¶РёС‚РµР»СЊ MRV РїРѕ РґР°РЅРЅС‹Рј Р»Р°Р±РѕСЂР°С‚РѕСЂРёРё (0.7-1.0).
   *  РСЃС‚РѕС‡РЅРёРє: labTrainingAdjust(linked.labAnalysis).mrvMultiplier (UI-side).
   *  РџСЂРёРјРµРЅСЏРµС‚СЃСЏ РџРћРЎР›Р• PED-РјРЅРѕР¶РёС‚РµР»СЏ: effectiveMrvMult = pedMrvMult Г— labMrvMultiplier.
   *  ALTв†‘/CRPв†‘/HCTв†‘/РЅРёР·РєРёР№ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅ в†’ СЃРЅРёР¶РµРЅРёРµ РґРѕРїСѓСЃС‚РёРјРѕРіРѕ РѕР±СЉС‘РјР°. */
  labMrvMultiplier?: number;
  /** P0-5: С‚РµРєСЃС‚РѕРІС‹Рµ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёСЏ Р»Р°Р±РѕСЂР°С‚РѕСЂРёРё (РїСЂРѕР±СЂР°СЃС‹РІР°СЋС‚СЃСЏ РІ rationale РїР»Р°РЅР°). */
  labWarnings?: string[];
  /** P0-5: СЂРµРєРѕРјРµРЅРґР°С†РёСЏ РїРѕ РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚Рё РёР· Р»Р°Р±РѕСЂР°С‚РѕСЂРёРё (РїСЂРѕР±СЂР°СЃС‹РІР°РµС‚СЃСЏ РІ rationale). */
  labIntensityNote?: string;
  /** Р¤Р°Р·Р° 4.28: СЂСѓС‡РЅРѕР№ РѕРІРµСЂСЂР°Р№Рґ РјРЅРѕР¶РёС‚РµР»СЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ (0.6вЂ“1.5) РёР· РІРёР·Р°СЂРґР°.
   *  РЈРјРЅРѕР¶Р°РµС‚ РЅРµРґРµР»СЊРЅС‹Р№ Р±СЋРґР¶РµС‚ Рё MRV-РєР°РїС‹ РїРѕРІРµСЂС… РјРµС‚СЂРёРє РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ (СЃРѕРЅ/HRV/СЃС‚СЂРµСЃСЃ). */
  recoveryMultOverride?: number;
  /** РўРёРї С‚СЂРµРЅРёСЂРѕРІРєРё: strength/hypertrophy/endurance. Р’Р»РёСЏРµС‚ РЅР° RIR/reps/tempo РїРѕ Schoenfeld 2021/2022. */
  trainingFocus?: BBTrainingFocus;
  /** % Р¶РёСЂР° РІ С‚РµР»Рµ (0-50). Р’Р»РёСЏРµС‚ РЅР° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ: >25% в†’ MRVГ—0.9 (Helms 2022). */
  bodyFat?: number;
  /** Р–РёСЂРѕРІР°СЏ РјР°СЃСЃР° С‚РµР»Р° РІ РєРі. Р§РµРј РІС‹С€Рµ LBM, С‚РµРј Р±РѕР»СЊС€Рµ РѕР±СЉС‘Рј СЃРїРѕСЃРѕР±РµРЅ РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ (Helms 2022). */
  leanMass?: number;
  /** HRV (РјСЃ). >70 = high readiness, 50-70 = medium, <50 = low (Plews 2022). */
  hrvMs?: number;
  /** Р§Р°СЃС‹ СЃРЅР° Р·Р° РЅРѕС‡СЊ. >7 = high, 6-7 = medium, <6 = low (Watson 2022). */
  sleepHours?: number;
  /** РЎСѓР±СЉРµРєС‚РёРІРЅС‹Р№ СЃС‚СЂРµСЃСЃ 1-10. Low(1-3)=high readiness, Medium(4-6)=medium, High(7-10)=low (Kreher 2022). */
  stressLevel?: number;
  /** РњРЅРѕР¶РёС‚РµР»СЊ СЌРєСЃС†РµРЅС‚СЂРёС‡РµСЃРєРѕР№ РЅР°РіСЂСѓР·РєРё. 1.0 = РЅРѕСЂРјР°, 1.1-1.2 = eccentric overload (Schoenfeld 2021). */
  eccentricMult?: number;
  /** РџСЂРѕС„РёС†РёС‚ РєР°Р»РѕСЂРёР№ (РєРєР°Р»/РґРµРЅСЊ). 250-500 = РѕРїС‚РёРјР°Р»СЊРЅС‹Р№ СЂРѕСЃС‚ (Helms 2014). */
  calorieSurplus?: number;
  /** Р‘РµР»РѕРє Рі/РєРі. 1.6-2.2 = РѕРїС‚РёРјР°Р»СЊРЅРѕ (Helms 2022). <1.0 в†’ СЃРЅРёР¶РµРЅРёРµ MRV. */
  proteinPerKg?: number;
  /** PRO: РѕРіСЂР°РЅРёС‡РµРЅРёСЏ РјРѕР±РёР»СЊРЅРѕСЃС‚Рё вЂ” С„РёР»СЊС‚СЂ СѓРїСЂР°Р¶РЅРµРЅРёР№ РїРѕ Р±РёРѕРјРµС…Р°РЅРёРєРµ.
   *  'shoulder' вЂ” РѕРіСЂР°РЅРёС‡РµРЅРЅР°СЏ РїР»РµС‡РµРІР°СЏ РјРѕР±РёР»СЊРЅРѕСЃС‚СЊ в†’ РёСЃРєР»СЋС‡РёС‚СЊ overhead press, behind neck.
   *  'hip' вЂ” РѕРіСЂР°РЅРёС‡РµРЅРЅР°СЏ С‚Р°Р·РѕР±РµРґСЂРµРЅРЅР°СЏ РјРѕР±РёР»СЊРЅРѕСЃС‚СЊ в†’ РёСЃРєР»СЋС‡РёС‚СЊ deep squats, prefer hack squat.
   *  'ankle' вЂ” РѕРіСЂР°РЅРёС‡РµРЅРЅР°СЏ РіРѕР»РµРЅРѕСЃС‚РѕРїРЅР°СЏ РјРѕР±РёР»СЊРЅРѕСЃС‚СЊ в†’ prefer leg press over squat.
   *  'lower_back' вЂ” РїСЂРѕР±Р»РµРјС‹ СЃ РїРѕСЏСЃРЅРёС†РµР№ в†’ РёСЃРєР»СЋС‡РёС‚СЊ conventional deadlift, barbell row.
   *  'wrist' вЂ” РїСЂРѕР±Р»РµРјС‹ СЃ Р·Р°РїСЏСЃС‚СЊСЏРјРё в†’ РёСЃРєР»СЋС‡РёС‚СЊ straight-bar curl, prefer cable. */
  mobilityRestrictions?: string[];
  /** PRO: РїСЂРµРґС‹РґСѓС‰РёР№ РјРµР·РѕС†РёРєР» вЂ” РґР»СЏ auto-progress РІРµСЃРѕРІ, СЂРѕС‚Р°С†РёРё СѓРїСЂР°Р¶РЅРµРЅРёР№, РѕР±СЉС‘РјРЅРѕР№ РїСЂРѕРіСЂРµСЃСЃРёРё.
   *  Р•СЃР»Рё РїРµСЂРµРґР°РЅ, buildBBPlan РёР·РІР»РµРєР°РµС‚ РёР· РЅРµРіРѕ: peak-week РІРµСЃР° в†’ СЃС‚Р°СЂС‚РѕРІС‹Рµ РІРµСЃР° +2.5-5РєРі,
   *  СЃРїРёСЃРѕРє СѓРїСЂР°Р¶РЅРµРЅРёР№ в†’ СЂРѕС‚Р°С†РёСЏ (РёР·Р±РµРіР°РµРј РїРѕРІС‚РѕСЂРѕРІ), per-muscle volume в†’ +1-2 СЃРµС‚Р°. */
  previousPlan?: BBPlan;
  /** Р¤Р°Р·Р° 2.7: cooldown-РёСЃС‚РѕСЂРёСЏ СѓРїСЂР°Р¶РЅРµРЅРёР№ (РёРјРµРЅР° + РїР°С‚С‚РµСЂРЅС‹), РЅРµРґР°РІРЅРѕ
   *  РёСЃРїРѕР»СЊР·РѕРІР°РЅРЅС‹С… РІ РїСЂРѕС€Р»С‹С… РїР»Р°РЅР°С…/РґРЅРµРІРЅРёРєРµ. РџРѕРґР°С‘С‚СЃСЏ РІ buildSession РєР°Рє
   *  СЂРѕС‚Р°С†РёРѕРЅРЅРѕРµ В«РїРѕРЅРёР¶РµРЅРёРµ РїСЂРёРѕСЂРёС‚РµС‚Р°В» (РјСЏРіРєРѕРµ РёР·Р±РµРіР°РЅРёРµ РїРѕРІС‚РѕСЂРѕРІ РІ С‚РµС‡РµРЅРёРµ
   *  cooldown-РѕРєРЅР°), СЃРѕРІРјРµСЃС‚РёРјРѕ СЃ cross-meso rotation. */
  cooldownHistory?: Array<{ exerciseName: string; pattern?: string }>;
  /** РЎСѓРїРµСЂСЃРµС‚С‹-Р°РЅС‚Р°РіРѕРЅРёСЃС‚С‹ (РіСЂСѓРґСЊв†”СЃРїРёРЅР°, Р±РёС†РµРїСЃв†”С‚СЂРёС†РµРїСЃ, РєРІР°РґСЂС‹в†”С…Р°РјСЃС‹). */
  supersetMode?: 'none' | 'antagonist' | 'same_muscle' | 'giant';
  /** РЎС…РµРјР° РѕР±СЉС‘РјР° РїР°РјРї-РёР·РѕР»СЏС†РёР№: GVT 10Г—10 / FST-7 / 8Г—8 Gironda. */
  volumeScheme?: 'standard' | 'gvt' | 'fst7' | 'gironda';
  /** РћР±СЉС‘РјРЅС‹Р№ vs РѕР±С‹С‡РЅС‹Р№ вЂ” РєРЅРѕРїРєР° СЃ РїРѕСЏСЃРЅРµРЅРёРµРј, РєР°РїС‹ РѕС‚ СѓСЂРѕРІРЅСЏ */
  trainingVolumeMode?: 'standard' | 'high';
  /** BFR-СЂРµР¶РёРј: РѕРєРєР»СЋР·РёСЏ 20-30% 1RM, 30-15-15-15, 30СЃ. РўРѕР»СЊРєРѕ РґР»СЏ РїР°РјРї-РёР·РѕР»СЏС†РёР№, С‚СЏР¶ РЅРµ С‚СЂРѕРіР°РµС‚. */
  bfrMode?: boolean;
  /** Blast/Cruise: 8РЅ blast (Г—1.15) / 4РЅ cruise (Г—0.85), РїРѕРІС‚РѕСЂСЏРµС‚СЃСЏ. Auto = РїРѕ РґРѕР·Р°Рј. */
  blastCruiseEnabled?: boolean;
  blastWeeks?: number; // РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ 8
  cruiseWeeks?: number; // РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ 4
  /** Epic A: РїРµСЂСЃРѕРЅР°Р»СЊРЅР°СЏ РєР°Р»РёР±СЂРѕРІРєР° MEV (bb-mev-calibration.engine). РћРІРµСЂСЂР°Р№Рґ
   *  РїРѕРїСѓР»СЏС†РёРѕРЅРЅС‹С… landmarks РІРЅСѓС‚СЂРё СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… РєР°РїРѕРІ (РїРѕС‚РѕР»РѕРє MRV РЅРµ СЂР°СЃС‚С‘С‚ РІС‹С€Рµ +30%).
   *  Р•СЃР»Рё РЅРµ РїРµСЂРµРґР°РЅ вЂ” buildBBPlan Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё С‡РёС‚Р°РµС‚ РёР· С…СЂР°РЅРёР»РёС‰Р° he_bb_mev_calibration. */
  mevCalibration?: MEVCalibration | null;
}

/**
 * РћР±СЉС‘РјРЅС‹Р№ РїСЂРѕС„РёР»СЊ СЃРїРёРЅС‹ РґР»СЏ РїСЂРѕРґРІРёРЅСѓС‚С‹С… Р°С‚Р»РµС‚РѕРІ.
 * Р’ СЃС‚Р°СЂРѕР№ РІРµСЂСЃРёРё enhanced РјРµРЅСЏР» РІ РѕСЃРЅРѕРІРЅРѕРј С‡РёСЃР»Рѕ СѓРїСЂР°Р¶РЅРµРЅРёР№, РЅРѕ РЅРµ РёРјРµР»
 * РѕС‚РґРµР»СЊРЅРѕРіРѕ РЅРµРґРµР»СЊРЅРѕРіРѕ Р±СЋРґР¶РµС‚Р° back. Р—РґРµСЃСЊ СЃС‚Р°Р¶ РѕРіСЂР°РЅРёС‡РёРІР°РµС‚ РґРѕСЃС‚СѓРїРЅС‹Р№
 * enhanced-РѕР±СЉС‘Рј: PED РЅРµ РїСЂРµРІСЂР°С‰Р°РµС‚ РЅРѕРІРёС‡РєР° РІ pro Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.
 */
function backVolumeProfile(level: string, trainingYears?: number): { targetMult: number; capMult: number; extraExercises: number } {
  const years = Number.isFinite(trainingYears) ? Math.max(0, trainingYears as number) : 0;
  if (level !== 'enhanced') return { targetMult: 1, capMult: 1, extraExercises: 0 };
  if (years >= 6) return { targetMult: 2.20, capMult: 2.20, extraExercises: 3 };
  if (years >= 3) return { targetMult: 1.80, capMult: 1.80, extraExercises: 2 };
  if (years >= 1) return { targetMult: 1.15, capMult: 1.15, extraExercises: 0 };
  return { targetMult: 1, capMult: 1, extraExercises: 0 };
}

/**
 * РћР±СЉС‘РјРЅС‹Р№ РїСЂРѕС„РёР»СЊ РЅРѕРі РґР»СЏ РїСЂРѕРґРІРёРЅСѓС‚С‹С… Р°С‚Р»РµС‚РѕРІ.
 */
function legVolumeProfile(level: string, trainingYears?: number): { targetMult: number; capMult: number; extraExercises: number } {
  const years = Number.isFinite(trainingYears) ? Math.max(0, trainingYears as number) : 0;
  if (level !== 'enhanced') return { targetMult: 1, capMult: 1, extraExercises: 0 };
  if (years >= 6) return { targetMult: 1.80, capMult: 1.80, extraExercises: 2 };
  if (years >= 3) return { targetMult: 1.45, capMult: 1.45, extraExercises: 1 };
  if (years >= 1) return { targetMult: 1.15, capMult: 1, extraExercises: 0 };
  return { targetMult: 1, capMult: 1, extraExercises: 0 };
}

/**
 * РћР±СЉС‘РјРЅС‹Р№ РїСЂРѕС„РёР»СЊ РіСЂСѓРґРё/РїР»РµС‡ РґР»СЏ РїСЂРѕРґРІРёРЅСѓС‚С‹С… Р°С‚Р»РµС‚РѕРІ.
 * Р“СЂСѓРґСЊ С‚СЂРµР±СѓРµС‚ СЂР°Р·РЅС‹С… СѓРіР»РѕРІ (РїР»РѕСЃРєРёР№/РЅР°РєР»РѕРЅРЅС‹Р№/СЂР°СЃС‚СЏРЅСѓС‚С‹Р№), Р° РїР»РµС‡Рё вЂ”
 * СЂР°Р·РґРµР»РµРЅРёСЏ front/mid/rear СЃ СѓС‡С‘С‚РѕРј РєРѕСЃРІРµРЅРЅРѕР№ РЅР°РіСЂСѓР·РєРё РѕС‚ Р¶РёРјРѕРІ.
 */
function torsoVolumeProfile(level: string, trainingYears?: number): { targetMult: number; capMult: number; extraExercises: number } {
  const years = Number.isFinite(trainingYears) ? Math.max(0, trainingYears as number) : 0;
  if (level !== 'enhanced') return { targetMult: 1, capMult: 1, extraExercises: 0 };
  if (years >= 6) return { targetMult: 1.60, capMult: 1.60, extraExercises: 1 };
  if (years >= 3) return { targetMult: 1.35, capMult: 1.35, extraExercises: 1 };
  if (years >= 1) return { targetMult: 1.12, capMult: 1.12, extraExercises: 0 };
  return { targetMult: 1, capMult: 1, extraExercises: 0 };
}


export interface BBSet {
  reps: number;
  rir: number;
  weight: number;   // РєРі
  technique?: string;
  tempo?: string;       // PRO: РЅРѕС‚Р°С†РёСЏ С‚РµРјРїР° (РЅР°РїСЂ. "2-1-1-0")
  restSeconds?: number; // PRO: РѕС‚РґС‹С… РјРµР¶РґСѓ РїРѕРґС…РѕРґР°РјРё
}

export interface BBExercise {
  muscle: string;
  name: string;         // Р”РѕР±Р°РІР»РµРЅРѕ: РєРѕРЅРєСЂРµС‚РЅРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ РёР· РєР°С‚Р°Р»РѕРіР°
  role: 'primary' | 'accessory';
  character: DayCharacter;
  sets: number;
  repsRange: [number, number];
  rir: number;
  workSets: BBSet[];
  exerciseName?: string;
  exerciseType?: string;    // 'compound' | 'isolation' | 'cable' | 'machine' etc. вЂ” РґР»СЏ prescribeLoad
  tempoSpec?: string;       // PRO: РЅРѕС‚Р°С†РёСЏ С‚РµРјРїР° РёР· bb-tempo-rest
  restSeconds?: number;     // PRO: РѕС‚РґС‹С… РјРµР¶РґСѓ РїРѕРґС…РѕРґР°РјРё
  comment?: string;         // PRO: С‚СЂРµРЅРµСЂСЃРєРёР№ РєРѕРјРјРµРЅС‚Р°СЂРёР№ (СЂРѕР»СЊ/СЃР»Р°Р±С‹Рµ/С„Р°Р·Р°/РЅР°РіСЂСѓР·РєР°)
  warmupSets?: { load: number; reps: number }[]; // PRO: СЂР°Р·РјРёРЅРѕС‡РЅС‹Рµ РїРѕРґС…РѕРґС‹ (РґР»СЏ compounds)
  rationale?: string;       // PRO: РїРѕС‡РµРјСѓ РІС‹Р±СЂР°РЅРѕ РёРјРµРЅРЅРѕ СЌС‚Рѕ СѓРїСЂР°Р¶РЅРµРЅРёРµ
  /** РЎС‚СЂСѓРєС‚СѓСЂРёСЂРѕРІР°РЅРЅР°СЏ РёРЅСЃС‚СЂСѓРєС†РёСЏ РёР· Exercise Lab, Р±РµР· РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё РїР°СЂСЃРёС‚СЊ comment. */
  executionProfile?: import('./bb-exercise-instructions.engine').ExerciseInstructionProfile;
  backSubgroup?: 'back_width' | 'back_thickness' | 'upper_back' | 'rear_delts' | 'traps' | 'erectors';
  /** Р”РµС‚Р°Р»СЊРЅР°СЏ РїРѕРґРіСЂСѓРїРїР° РґР»СЏ UI-РґРµС‚Р°Р»РёР·Р°С†РёРё (РєР»РёРє РїРѕ РјС‹С€С†Рµ в†’ РїРѕРґРіСЂСѓРїРїС‹). РћРїС†РёРѕРЅР°Р»СЊРЅРѕ, РЅРµ РІР»РёСЏРµС‚ РЅР° Р»РѕРіРёРєСѓ РѕС‚Р±РѕСЂР°. */
  subgroup?: string;
  chestSubgroup?: 'chest_upper' | 'chest_mid' | 'chest_lower';
  movementPattern?: string;
  /** Р Р°Р·РјРёРЅРѕС‡РЅРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ РЅР° С†РµР»РµРІСѓСЋ РіСЂСѓРїРїСѓ (3Г—10-15 Р»С‘РіРєРёС…). РќРµ РІС…РѕРґРёС‚ РІ РѕР±СЉС‘Рј/Р±СЋРґР¶РµС‚. */
  warmupActivator?: boolean;
  /** РЎСѓРїРµСЂСЃРµС‚-Р°РЅС‚Р°РіРѕРЅРёСЃС‚: РёРјСЏ РїР°СЂС‚РЅС‘СЂР° РїРѕ РїР°СЂРµ (РіСЂСѓРґСЊв†”СЃРїРёРЅР°, Р±РёС†РµРїСЃв†”С‚СЂРёС†РµРїСЃ Рё С‚.Рґ.). */
  supersetWith?: string;
  /** Р¤Р°Р·Р° 2.8: РЅРѕРјРµСЂ СЃСѓРїРµСЂСЃРµС‚-РіСЂСѓРїРїС‹ (РѕР±С‰РёР№ Сѓ РїР°СЂС‚РЅС‘СЂРѕРІ) вЂ” РїР»РµРµСЂ С‡РµСЂРµРґСѓРµС‚ A1/B1/A2/B2. */
  supersetGroup?: number;
  /** Р¤Р°Р·Р° 2.8: РїРѕР·РёС†РёСЏ РІ РїР°СЂРµ (0=РїРµСЂРІС‹Р№, 1=РІС‚РѕСЂРѕР№) вЂ” С‡РµСЂРµРґРѕРІР°РЅРёРµ A/B. */
  supersetSlot?: 0 | 1;
  /** РћРїС†РёРѕРЅР°Р»СЊРЅС‹Рµ СЃРµС‚С‹ В«РїСЂРё РЅР°Р»РёС‡РёРё СЃРёР»В» (вљЎ): Р·Р°РґРЅСЏСЏ РґРµР»СЊС‚Р° +4, Р±РёС†РµРїСЃ +3.
   *  РќРµ РІС…РѕРґСЏС‚ РІ С†РµР»РµРІРѕР№ РјРёРЅРёРјСѓРј Рё РІ MRV-РіР°СЂР°РЅС‚РёСЋ; СЃСЂРµР·Р°СЋС‚СЃСЏ РїРµСЂРІС‹РјРё Р±СЋРґР¶РµС‚РѕРј. */
  optional?: boolean;
}

export interface BBSession {
  day: number;             // 1-based РІ СЂРѕС‚Р°С†РёРё
  weekOffset: number;      // Р°Р±СЃРѕР»СЋС‚РЅС‹Р№ РґРµРЅСЊ СЃ СѓС‡С‘С‚РѕРј РїРѕРІС‚РѕСЂРѕРІ СЂРѕС‚Р°С†РёРё
  character: DayCharacter;
  sessionTag?: string;
  exercises: BBExercise[];
}

export interface BBWeek {
  week: number;
  phase?: BBPhase;
  deload?: boolean;
  taper?: boolean;
  sessions: BBSession[];
}

/** Р”РµС‚Р°Р»СЊРЅР°СЏ РїРѕРґРіСЂСѓРїРїР° СѓРїСЂР°Р¶РЅРµРЅРёСЏ вЂ” display-only, РЅРµ РІР»РёСЏРµС‚ РЅР° РѕС‚Р±РѕСЂ/MRV. */
export function deriveExerciseSubgroup(muscle: string, name: string, backSubgroup?: string): string | undefined {
  const n = String(name || '').toLowerCase();
  const m = String(muscle || '').toLowerCase();
  if (m === 'chest') {
    if (/РЅР°РєР»РѕРЅ.*РІРµСЂС…|РІРµСЂС….*РіСЂСѓРґ|incline.*press|incline.*dumbbell|Р¶РёРј.*РЅР°РєР»РѕРЅ/i.test(n)) return 'chest_upper';
    if (/РѕС‚СЂРёС†Р°С‚|decline|Р±СЂСѓСЃСЊ|dip/i.test(n)) return 'chest_lower';
    return 'chest_mid';
  }
  if (m === 'back') {
    if (backSubgroup) return String(backSubgroup);
    if (/РїРѕРґС‚СЏРі|pull.?up|chin|С‚СЏРіР°.*РІРµСЂС…|lat.?pull|РІРµСЂС‚РёРєР°Р»СЊ/i.test(n)) return 'back_width';
    if (/С‚СЏРіР°.*РіР°РЅС‚РµР»|С‚СЏРіР°.*С€С‚Р°РЅ|row|РіРѕСЂРёР·РѕРЅС‚/i.test(n)) return 'back_thickness';
    if (/С€СЂР°Рі|shrug/i.test(n)) return 'traps';
    if (/Р·Р°РґРЅ.*РґРµР»СЊС‚|rear.?delt|face.?pull/i.test(n)) return 'rear_delts';
    if (/СЂР°Р·РіРёР±|extension|good.?morning|РіРёРїРµСЂСЌРєСЃС‚РµРЅР·/i.test(n)) return 'erectors';
    return 'upper_back';
  }
  if (m === 'shoulders') {
    if (/Р¶РёРј|press|Р°СЂРјРµР№|overhead|РІРѕРµРЅРЅС‹Р№/i.test(n) && !/РјР°С…/i.test(n)) return 'delt_front';
    if (/Р·Р°РґРЅ|rear|РѕР±СЂР°С‚РЅ/i.test(n)) return 'delt_rear';
    if (/РјР°С…|lateral|РѕС‚РІРµРґРµРЅРёРµ|raise|РїРѕРґСЉРµРј/i.test(n)) return 'delt_mid';
    return 'delt_mid';
  }
  if (m === 'biceps') {
    if (/РјРѕР»РѕС‚|hammer/i.test(n)) return 'biceps_brachialis';
    if (/РЅР°РєР»РѕРЅ|incline/i.test(n)) return 'biceps_long';
    if (/СЃРєРѕС‚С‚|РїСЂРѕРїРѕРІРµРґ|preacher|РєРѕРЅС†РµРЅС‚СЂ/i.test(n)) return 'biceps_short';
    return 'biceps_long';
  }
  if (m === 'triceps') {
    if (/РЅР°Рґ.*РіРѕР»РѕРІ|overhead|С„СЂР°РЅС†СѓР·/i.test(n)) return 'triceps_long';
    if (/РєР°РЅР°С‚|РІРµСЂС‘РІРє|pushdown|Р±Р»РѕРє/i.test(n)) return 'triceps_lateral';
    return 'triceps_medial';
  }
  if (m === 'quads') {
    if (/СЂР°Р·РіРёР±|extension/i.test(n)) return 'quads_rectus';
    if (/С„СЂРѕРЅС‚|front/i.test(n)) return 'quads_vastus';
    return 'quads_mid';
  }
  if (m === 'hamstrings') {
    if (/СЃРіРёР±|curl|Р»РµР¶Р°|СЃРёРґСЏ/i.test(n)) return 'ham_biceps';
    if (/СЂСѓРјС‹РЅ|rdl|РјС‘СЂС‚РІ|РјРµСЂС‚РІ/i.test(n)) return 'ham_semi';
    return 'ham_mid';
  }
  if (m === 'glutes') {
    if (/СЏРіРѕРґРёС‡.*РјРѕСЃС‚|hip.?thrust|glute.?bridge/i.test(n)) return 'glutes_max';
    if (/РѕС‚РІРµРґРµРЅРёРµ|abduct/i.test(n)) return 'glutes_med';
    return 'glutes_max';
  }
  if (m === 'calves') return 'calves_soleus';
  if (m === 'abs') return 'abs_upper';
  if (m === 'forearms') return 'forearms_flex';
  if (m === 'traps') return 'traps_upper';
  return undefined;
}

export interface BBPlan {
  pattern: SplitPattern;
  weeks: BBWeek[];
  rotationMuscleVolume: Record<string, number>; // MAVГ—СЂРѕС‚Р°С†РёСЏ РЅР° РјС‹С€С†Сѓ
  rationale: string[];
  /** P2-4: СѓСЂРѕРІРµРЅСЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (РґР»СЏ bb-metrics Р±РµР· duck-typing). */
  level?: string;
  /** Volume-landmarks (MEV/MAV/MRV) РїРѕ РїРёРєРѕРІРѕР№ РЅРµРґРµР»Рµ вЂ” РµРґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє, РєР°Рє РІ PL/СЂСѓС‡РЅРѕРј. */
  volumeLandmarks?: VolumeLandmarkRow[];
  /** Р§Р°СЃС‚РѕС‚Р° С‚СЂРµРЅРёСЂРѕРІРѕРє РєР°Р¶РґРѕР№ РјС‹С€С†С‹ РІ РЅРµРґРµР»СЋ (1Г—/2Г—/3Г—) вЂ” РєР»СЋС‡РµРІРѕР№ С„Р°РєС‚РѕСЂ РіРёРїРµСЂС‚СЂРѕС„РёРё. */
  muscleFrequency?: Record<string, number>;
  volumeTargets?: Record<string, BBVolumeTarget>;
  rotationReport?: BBRotationReport;
  fatigueReport?: Array<{ week: number; sessions: Array<BBSessionCost> }>;
  weeklyVolume?: Record<number, Record<string, { directSets: number; effectiveSets: number; fatigueWeightedSets: number }>>;
  report?: BBPlanReport;
  balanceReport?: import('./bb-balance.engine').BBBalanceReport;
  validation?: BBPlanValidationResult;
  /** Р¤Р°РєС‚РёС‡РµСЃРєРёР№ per-muscle MRV-РєР°Рї РїРѕСЃР»Рµ РІСЃРµС… РјРЅРѕР¶РёС‚РµР»РµР№ (PED/recovery/lab/СЃС‚Р°Р¶).
   *  РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІР°Р»РёРґР°С‚РѕСЂРѕРј РІРјРµСЃС‚Рѕ landmarks.mrv, РєРѕС‚РѕСЂС‹Р№ РЅРµ СѓС‡РёС‚С‹РІР°РµС‚
   *  enhanced/СЃС‚Р°Р¶РµРІС‹Рµ РјРЅРѕР¶РёС‚РµР»Рё. */
  mrvByMuscle?: Record<string, number>;
  /** PED-Р°РґР°РїС‚Р°С†РёСЏ (РґРѕР·С‹ в†’ MRV/РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ) вЂ” СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ РїР»Р°РЅРµ РґР»СЏ
   *  injury-РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёР№: СЃСѓСЃС‚Р°РІРЅР°СЏ РЅР°РіСЂСѓР·РєР° РїСЂРё PED-РёРЅС‚РµРЅСЃРёС„РёРєР°С†РёРё РІС‹С€Рµ
   *  (СЃСѓС…РѕР¶РёР»РёСЏ/СЃРІСЏР·РєРё РЅРµ СѓСЃРїРµРІР°СЋС‚ Р·Р° РјС‹С€РµС‡РЅС‹Рј СЂРѕСЃС‚РѕРј). */
  pedAdaptation?: {
    combinedMrvMultiplier: number;
    combinedRecoveryMultiplier: number;
    activePEDs: string[];
    pedDoses: Record<string, number>;
    risks: string[];
  };
  safetyConstraints?: {
    equipment?: string[];
    excludedExercises?: string[];
    excludedMuscles?: string[];
    avoidAxialLoad?: boolean;
  };
  /** РљРѕРЅС‚РµРєСЃС‚ СЃРїРµС†РёР°Р»РёР·Р°С†РёРё Рё Р»РёРјРёС‚РѕРІ вЂ” СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ РїР»Р°РЅРµ, С‡С‚РѕР±С‹ РїРѕРІС‚РѕСЂРЅР°СЏ
   *  С„РёРЅР°Р»РёР·Р°С†РёСЏ (РїРѕСЃР»Рµ СЂСѓС‡РЅС‹С… РїСЂР°РІРѕРє РІ В«РљРѕСЂСЂРµРєС†РёРёВ») РЅРµ С‚РµСЂСЏР»Р° РґРѕРЅРѕСЂСЃРєСѓСЋ
   *  РїРѕР»РёС‚РёРєСѓ Рё РЅРµ РІРѕР·РІСЂР°С‰Р°Р»Р° РѕР±СЉС‘Рј РґРѕРЅРѕСЂР°Рј. */
  specializationSchedule?: import('./bb-specialization.engine').SpecializationSchedule;
  priorityMuscles?: string[];
  mrvMultiplier?: number;
  maxWorkingSets?: number;
  maxExercises?: number;
  gradedMuscles?: string[];
  mobilityRestrictions?: string[];
  /** Р Р°СЃС€РёСЂРµРЅРЅР°СЏ РЅРµРґРµР»СЊРЅР°СЏ СЃРІРѕРґРєР° СЃРµС‚РѕРІ (РїРѕ РјС‹С€С†Р°Рј: СЃРµСЃСЃРёРё/СЂР°Р±РѕС‡РёРµ/СЂР°Р·РјРёРЅРѕС‡РЅС‹Рµ/РїР°С‚С‚РµСЂРЅС‹). */
  expandedSummary?: import('./bb-summary.engine').BBExpandedSummary;
  // РџРѕР»РЅС‹Р№ СЃР»РµРїРѕРє РІС‹Р±СЂР°РЅРЅС‹С… РєРЅРѕРїРѕРє вЂ” С‡С‚РѕР±С‹ РѕС‚С‡С‘С‚ СЃРѕРѕС‚РІРµС‚СЃС‚РІРѕРІР°Р» СЂРµР°Р»СЊРЅС‹Рј РЅР°СЃС‚СЂРѕР№РєР°Рј (Р° РЅРµ В«РѕС‚ РЅРѕРІРёС‡РєР°В»)
  trainingVolumeMode?: 'standard' | 'high';
  volumeGoal?: string;
  goal?: string;
  trainingFocus?: string;
  methodology?: string;
  supersetMode?: string;
  volumeScheme?: string;
  dupMode?: string;
  trainingYears?: number;
  courseIntensity?: string;
  bfrMode?: boolean;
  blastCruiseEnabled?: boolean;
  blastWeeks?: number;
  cruiseWeeks?: number;
  inputSnapshot?: {
    level?: string;
    goal?: string;
    trainingVolumeMode?: 'standard' | 'high';
    volumeGoal?: string;
    trainingFocus?: string;
    methodology?: string;
    supersetMode?: string;
    volumeScheme?: string;
    dupMode?: string;
    trainingYears?: number;
    courseIntensity?: string;
    fewerCompound?: boolean;
    rotationMode?: string;
    intensityLevel?: string;
    avoidAxialLoad?: boolean;
    equipment?: string[];
    injuries?: any[];
    mobilityRestrictions?: string[];
    favoriteExercises?: string[];
    excludedExercises?: string[];
    autoDeload?: boolean;
    deloadType?: string;
    loadStrategy?: string;
    eccentricMult?: number;
    calorieSurplus?: number;
    proteinPerKg?: number;
    labMrvMultiplier?: number;
    bodyFat?: number;
    leanMass?: number;
    hrvMs?: number;
    sleepHours?: number;
    stressLevel?: number;
    weakPoints?: string[];
    focusGroup?: string;
  };
}

/**
 * РђРіСЂРµРіР°С†РёСЏ РѕР±СЉС‘РјР° BB-РїР»Р°РЅР° РїРѕ РіСЂСѓРїРїР°Рј РјС‹С€С† Рё СЃСЂР°РІРЅРµРЅРёРµ СЃ volume-landmarks (MEV/MAV/MRV).
 * Р‘РµСЂС‘С‚СЃСЏ РїРёРєРѕРІР°СЏ РїРѕ СЃСѓРјРјР°СЂРЅРѕРјСѓ РѕР±СЉС‘РјСѓ РЅРµРґРµР»СЏ (РЅР°РёР±РѕР»РµРµ РЅР°РіСЂСѓР¶РµРЅРЅР°СЏ) вЂ” В«С…СѓРґС€РёР№ СЃР»СѓС‡Р°Р№В».
 * PRO-РєР»СЋС‡Рё РјС‹С€С† (delt_front/mid/rear Рё С‚.Рї.) РєРѕР»Р»Р°РїСЃРёСЂСѓСЋС‚СЃСЏ Рє РєР°РЅРѕРЅРёС‡РµСЃРєРѕРјСѓ EN-РєР»СЋС‡Сѓ.
 */
export function getBBVolumeLandmarks(plan: BBPlan, level: string, pedMrvMult = 1): VolumeLandmarkRow[] {
  let peakIdx = 0, peakTotal = -1;
  const weekGroups: Record<number, Record<string, number>> = {};
  const shoulderHead = (ex: any): string => {
    if (ex.muscle !== 'shoulders') return collapseKey(ex.muscle);
    const nm = String(ex.name || '').toLowerCase();
    if (/Р·Р°РґРЅ|rear|РѕР±СЂР°С‚РЅ|Р»РёС†.*С‚СЏРіР°|face.*pull/i.test(nm)) return 'delt_rear';
    if (/Р¶РёРј|press|Р°СЂРјРµР№|overhead|РІРѕРµРЅРЅС‹Р№/i.test(nm) && !/РјР°С…|lateral|РѕС‚РІРµРґРµРЅ/i.test(nm)) return 'delt_front';
    if (/РјР°С…|lateral|РѕС‚РІРµРґРµРЅ|raise|РїРѕРґСЉРµРј/i.test(nm)) return 'delt_mid';
    return 'delt_mid';
  };
  plan.weeks.forEach((wk, i) => {
    const g: Record<string, number> = {};
    for (const s of wk.sessions) for (const ex of s.exercises) {
      const ck = ex.muscle === 'shoulders' ? shoulderHead(ex) : collapseKey(ex.muscle);
      g[ck] = (g[ck] || 0) + (ex.sets || 0);
    }
    weekGroups[i] = g;
    const total = Object.values(g).reduce((a, b) => a + b, 0);
    if (total > peakTotal) { peakTotal = total; peakIdx = i; }
  });
  const peak = weekGroups[peakIdx] || {};
  return computeVolumeLandmarks(peak, level, { labMult: pedMrvMult, peakWeek: peakIdx + 1 });
}

// sessionTag -> РјС‹С€С†С‹ (РєР°РЅРѕРЅРёС‡РµСЃРєРёРµ EN-РєР»СЋС‡Рё) вЂ” РёРјРїРѕСЂС‚РёСЂРѕРІР°РЅС‹ РёР· bb-day-types (FIX-8, РµРґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє)

/** РџСЂРѕРІРµСЂРёС‚СЊ, СЏРІР»СЏРµС‚СЃСЏ Р»Рё СѓРїСЂР°Р¶РЅРµРЅРёРµ Р·Р°РґРЅРµР№ РґРµР»СЊС‚РѕР№ (rear delt).
 *  Р’РєР»СЋС‡Р°РµС‚ Рё В«С‡РёСЃС‚С‹РµВ» rear-delt РґРІРёР¶РµРЅРёСЏ, Рё РєРѕРјР±РёРЅРёСЂРѕРІР°РЅРЅС‹Рµ СЃСЂРµРґРЅСЏСЏ+Р·Р°РґРЅСЏСЏ
 *  (Lu raise, Y-raise) вЂ” РѕРЅРё РїРѕ С„Р°РєС‚Сѓ РЅР°РіСЂСѓР¶Р°СЋС‚ Р·Р°РґРЅСЋСЋ РґРµР»СЊС‚Сѓ РЅР°СЂР°РІРЅРµ СЃРѕ СЃСЂРµРґРЅРµР№
 *  Рё РґРѕР»Р¶РЅС‹ РёСЃРєР»СЋС‡Р°С‚СЊСЃСЏ РёР· Push/Chest-РґРЅРµР№ С‚Р°Рє Р¶Рµ, РєР°Рє face pull/rear delt fly. */
export function isRearDeltExercise(name: string): boolean {
  return /РЅР°РєР»РѕРЅ.*РґРµР»СЊС‚|rear|С‚СЏРіР°.*Р»РёС†|face.*pull|Р±Р°Р±РѕС‡РєР°|Р·Р°РґРЅ.*РґРµР»СЊС‚|РѕР±СЂР°С‚РЅ.*СЃРІРµРґРµРЅ|РѕР±СЂР°С‚РЅ.*Р±Р°Р±РѕС‡|lu.?raise|y-raise|y raise/i.test(name || '');
}
/** РџСЂРѕРІРµСЂРёС‚СЊ, СЏРІР»СЏРµС‚СЃСЏ Р»Рё РґРµРЅСЊ Push/Chest/Shoulders (РЅРµ Pull/Back). */
function isPushDayTag(sessionTag: string): boolean {
  const t = (sessionTag || '').toLowerCase();
  return t.includes('push') || t === 'chest' || (t.includes('shoulders') && !t.includes('pull'));
}

/**
 * Р“СЂР°РЅСѓР»СЏСЂРЅС‹Рµ СЃР»Р°Р±С‹Рµ РіСЂСѓРїРїС‹ в†’ РєРѕРЅРєСЂРµС‚РЅС‹Рµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ РґР»СЏ РїСЂРёРѕСЂРёС‚РµС‚Р°.
 * РџСЂРё РІС‹Р±РѕСЂРµ weakPoint='delt_mid' вЂ” РјР°С…Рё РІ СЃС‚РѕСЂРѕРЅС‹ РїРѕР»СѓС‡Р°СЋС‚ +20 Рє СЃРєРѕСЂСѓ.
 * РџСЂРё РІС‹Р±РѕСЂРµ weakPoint='back_width' вЂ” РїРѕРґС‚СЏРіРёРІР°РЅРёСЏ/РїСѓР»Р»РґР°СѓРЅС‹ РїРѕР»СѓС‡Р°СЋС‚ +20.
 * РџСЂРё РІС‹Р±РѕСЂРµ weakPoint='chest_upper' вЂ” Р¶РёРјС‹ РЅР° РЅР°РєР»РѕРЅРЅРѕР№ РїРѕР»СѓС‡Р°СЋС‚ +20.
 */
const WEAK_EXERCISE_BONUS: Record<string, (name: string) => boolean> = {
  chest_upper: (n) => /Р¶РёРј.*(РЅР°РєР»РѕРЅ|incline|РІРµСЂС…)|incline.*press/i.test(n),
  chest_lower: (n) => /Р¶РёРј.*(СЃРЅРёР·|decline|РѕС‚СЂРёС†)|decline.*press/i.test(n),
  back_width: (n) => /РїРѕРґС‚СЏРі|pull.?up|С‚СЏРіР°.*РІРµСЂС…|lat.?pull|РїСѓР»Р»РґР°СѓРЅ/i.test(n),
  back_thickness: (n) => /С‚СЏРіР°.*(РЅР°РєР»РѕРЅ|С€С‚Р°РЅРі|РіР°РЅС‚РµР»|РіСЂСѓРґ|РїРѕСЏСЃ)|row/i.test(n) && !/РІРµСЂС…|РїРѕРґС‚СЏРі/i.test(n),
  delt_front: (n) => /Р¶РёРј.*(СЃС‚РѕСЏ|СЃРёРґСЏ|Р°СЂРјРµР№|overhead)|РєСѓР±РёС‡РµСЃРє/i.test(n),
  delt_mid: (n) => /РјР°С….*(СЃС‚РѕСЂРѕРЅСѓ|РіР°РЅС‚РµР»|Р±Р»РѕРє|РєСЂРѕСЃСЃРѕРІ)|lateral.*raise|РѕС‚РІРµРґРµРЅРёРµ/i.test(n),
  delt_rear: (n) => isRearDeltExercise(n),
  glutes: (n) => /СЏРіРѕРґРёС‡РЅ.*РјРѕСЃС‚|hip.?thrust|glute.?bridge|РѕС‚РІРµРґРµРЅ.*РЅРѕРі|kick.?back/i.test(n),
  hamstrings: (n) => /СЃРіРёР±Р°РЅ.*РЅРѕРі|leg.?curl|СЂСѓРјС‹РЅ|rdl/i.test(n),
  quads: (n) => /РїСЂРёСЃРµРґ|squat|Р¶РёРј.*РЅРѕРі|leg.?press|СЂР°Р·РіРёР±Р°РЅ.*РЅРѕРі/i.test(n),
  calves: (n) => /РїРѕРґСЉС‘Рј.*РЅРѕСЃРє|РїРѕРґСЉРµРј.*РЅРѕСЃРє|calf/i.test(n),
  biceps: (n) => /СЃРіРёР±Р°РЅ.*СЂСѓРє|Р±РёС†РµРїСЃ|curl|РјРѕР»РѕС‚/i.test(n),
  triceps: (n) => /СЂР°Р·РіРёР±Р°РЅ.*СЂСѓРє|С‚СЂРёС†РµРїСЃ|pushdown|С„СЂР°РЅС†СѓР·/i.test(n),
  forearms: (n) => /Р·Р°РїСЏСЃС‚|РїСЂРµРґРїР»РµС‡|wrist|РїСЂРѕРЅР°С†/i.test(n),
  traps: (n) => /С€СЂР°Рі/i.test(n),
  abs: (n) => /СЃРєСЂСѓС‡РёРІР°РЅ|crunch|РїСЂРµСЃСЃ|РїРѕРґСЉС‘Рј.*РЅРѕРі|РїРѕРґСЉРµРј.*РЅРѕРі/i.test(n),
};

/** РџРѕР»СѓС‡РёС‚СЊ Р±РѕРЅСѓСЃ Рє СЃРєРѕСЂСѓ РґР»СЏ СѓРїСЂР°Р¶РЅРµРЅРёСЏ РїРѕ РіСЂР°РЅСѓР»СЏСЂРЅРѕР№ СЃР»Р°Р±РѕР№ РіСЂСѓРїРїРµ. */
function weakExerciseBonus(exName: string, weakPoints: string[]): number {
  let bonus = 0;
  for (const wp of weakPoints) {
    const matcher = WEAK_EXERCISE_BONUS[wp];
    if (matcher && matcher(exName)) bonus += 20;
  }
  return bonus;
}

/** РњР°РїРїРёРЅРі РіСЂР°РЅСѓР»СЏСЂРЅС‹С… СЃР»Р°Р±С‹С… РіСЂСѓРїРї РІ РєР°РЅРѕРЅРёС‡РµСЃРєРёРµ РјС‹С€С†С‹ (РґР»СЏ РѕР±СЉС‘РјР°/MRV).
 *  P0-3 (audit 2026-08): СЌРєСЃРїРѕСЂС‚РёСЂРѕРІР°РЅ РґР»СЏ РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ РІ cycle-to-plan / bb-weakpoint / bb-selector,
 *  С‡С‚РѕР±С‹ РіСЂР°РЅСѓР»СЏСЂРЅС‹Рµ СЃР»Р°Р±С‹Рµ РіСЂСѓРїРїС‹ (chest_upper, back_width, delt_mid) РєРѕСЂСЂРµРєС‚РЅРѕ
 *  РјР°РїРїРёР»РёСЃСЊ РІ РєР°РЅРѕРЅРёС‡РµСЃРєРёРµ РјС‹С€С†С‹ (chest, back, shoulders) РїСЂРё РїСЂРѕРІРµСЂРєР°С…. */
export const WEAK_TO_MUSCLE: Record<string, string> = {
  chest: 'chest', chest_upper: 'chest', chest_lower: 'chest',
  back: 'back', back_width: 'back', back_thickness: 'back',
  shoulders: 'shoulders', delt_front: 'shoulders', delt_mid: 'shoulders', delt_rear: 'shoulders',
  quads: 'quads', hamstrings: 'hamstrings', glutes: 'glutes', calves: 'calves',
  biceps: 'biceps', triceps: 'triceps', forearms: 'forearms',
  abs: 'abs', traps: 'traps',
  lower_back: 'back', neck: 'traps',
};

/** Р”Р»СЏ РєР°РєРёС… РјС‹С€С† РІ BB-РєРѕРЅС‚РµРєСЃС‚Рµ Р’РЎР•Р“Р”Рђ Р±СЂР°С‚СЊ С‚РѕР»СЊРєРѕ РёР·РѕР»СЏС†РёСЋ (РЅРµС‚ compound Р°РЅР°Р»РѕРіРѕРІ). */
const ALWAYS_ISOLATION: Set<string> = new Set(['calves', 'forearms', 'abs']);

/** P0-1: arms muscle set вЂ” РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІ buildSession (budget reserve) Рё buildBBPlan (arm guarantee). */
const ARM_MUSCLES_SET = new Set(['biceps', 'triceps', 'forearms']);

// "Р—РѕР»РѕС‚РѕР№ СЃС‚Р°РЅРґР°СЂС‚" Р‘Р‘-СѓРїСЂР°Р¶РЅРµРЅРёР№ (РјР°РєСЃРёРјР°Р»СЊРЅРѕ СЌС„С„РµРєС‚РёРІРЅС‹Рµ РґР»СЏ РіРёРїРµСЂС‚СЂРѕС„РёРё).
// РџСЂРёРѕСЂРёС‚РёР·РёСЂСѓСЋС‚СЃСЏ РІ generic-РїР»Р°РЅР°С… (Р±РµР· СЃРїРµС†РёР°Р»РёР·Р°С†РёРё/СЃР»Р°Р±С‹С… С‚РѕС‡РµРє).
// Р‘Р‘-Р»РѕРіРёРєР°: РЅР°РєР»РѕРЅРЅС‹Р№ Р¶РёРј > РїР»РѕСЃРєРёР№ (РІРµСЂС… РіСЂСѓРґРё вЂ” РѕС‚СЃС‚Р°СЋС‰Р°СЏ Сѓ Р±РѕР»СЊС€РёРЅСЃС‚РІР°),
// РіР°РєРє/РЎРјРёС‚-РїСЂРёСЃРµРґ > СЃРІРѕР±РѕРґРЅС‹Р№ РїСЂРёСЃРµРґ (Р±РµР·РѕРїР°СЃРЅРѕСЃС‚СЊ РїРѕСЏСЃРЅРёС†С‹, РёР·РѕР»СЏС†РёСЏ РєРІР°РґСЂРёС†РµРїСЃР°).
// Р’РќРРњРђРќРР•: ID РґРѕР»Р¶РЅС‹ СЃРѕРІРїР°РґР°С‚СЊ СЃ СЂРµР°Р»СЊРЅС‹РјРё id РІ exercise-catalog.ts. Р Р°РЅРµРµ Р·РґРµСЃСЊ Р±С‹Р»Рё
// РІС‹РґСѓРјР°РЅРЅС‹Рµ ID (barbell_row/t_bar_row/lat_pulldown/overhead_press/dumbbell_lateral_raise/
// barbell_curl/dumbbell_curl/tricep_pushdown/bench_press/incline_barbell_press/...),
// РёР·-Р·Р° С‡РµРіРѕ Р±СѓСЃС‚ +50 РЅРёРєРѕРіРґР° РЅРµ СЃСЂР°Р±Р°С‚С‹РІР°Р» вЂ” СЂРµР°Р»СЊРЅС‹Р№ РєР°С‚Р°Р»РѕРі РёСЃРїРѕР»СЊР·СѓРµС‚
// row_bar/row_tbar/pulldown/ohp/lateral_raise/curl_bar/curl_db/tricep_pushdown_*/bench_bar/incline_bar/...
const PREFERRED_BB_EXERCISES = new Set([
  // Р“СЂСѓРґСЊ вЂ” РЅР°РєР»РѕРЅРЅС‹Рµ РїСЂРёРѕСЂРёС‚РµС‚ (РІРµСЂС… РіСЂСѓРґРё СЂР°СЃС‚С‘С‚ С…СѓР¶Рµ, С‡РµРј СЃСЂРµРґРЅСЏСЏ/РЅРёР¶РЅСЏСЏ).
  // Р‘СЂСѓСЃСЊСЏ РќР• РїСЂРёРѕСЂРёС‚РµС‚: РґР»СЏ СЂР°СЃС‚СЏР¶РєРё/РёР·РѕР»СЏС†РёРё РїСЂРёРѕСЂРёС‚РµС‚РЅС‹ СЂР°Р·РІРѕРґРєРё Рё РєСЂРѕСЃСЃРѕРІРµСЂ.
  'incline_bar', 'incline_db', 'bench_bar', 'bench_db',
  'machine_chest_press', 'machine_incline_press',
  'fly_cable', 'fly_db', 'fly_incline_db', 'crossover_cable', 'pec_deck', 'butterfly',
  // РЎРїРёРЅР° вЂ” С‚СЏР¶С‘Р»С‹Рµ compound-С‚СЏРіРё РїСЂРёРѕСЂРёС‚РµС‚ (king of back: barbell row + T-bar + pulldown)
  'row_bar', 'row_tbar', 'row_db', 'row_chest_supported', 'row_seal', 'row_pendlay', 'yates_row',
  'pulldown', 'pulldown_wide', 'pullup', 'chinup', 'pullup_wide', 'pulldown_vbar',
  // РќРѕРіРё вЂ” РіР°РєРє/РЎРјРёС‚/Р»РµРі-РїСЂРµСЃСЃ РїСЂРёРѕСЂРёС‚РµС‚ (Р±РµР·РѕРїР°СЃРЅРѕСЃС‚СЊ РїРѕСЏСЃРЅРёС†С‹, РёР·РѕР»СЏС†РёСЏ)
  'hack_squat', 'squat_smith', 'leg_press', 'bulgarian_split_squat', 'walking_lunge', 'walking_lunge_db',
  'rdl', 'deadlift_romanian', 'leg_curl', 'leg_ext',
  // РџР»РµС‡Рё вЂ” РєР»Р°СЃСЃРёС‡РµСЃРєРёРµ Р¶РёРјС‹ РїРµСЂРµРґ СЃРѕР±РѕР№ РїСЂРёРѕСЂРёС‚РµС‚ (РЅРµ Р°СЂРјРµР№СЃРєРёР№ Р¶РёРј СЃС‚РѕСЏ):
  // Smith press РїРµСЂРµРґ СЃРѕР±РѕР№, С€РёСЂРѕРєРёР№ С…РІР°С‚ РІ Smith, Р¶РёРјС‹ РіР°РЅС‚РµР»РµР№.
  'ohp_seated_bar', 'ohp_seated_db', 'db_press', 'smith_shoulder_press',
  'lateral_raise', 'lateral_raise_cable', 'lateral_raise_machine',
  // Р СѓРєРё
  'tricep_pushdown_rope', 'tricep_pushdown_bar', 'curl_bar', 'curl_db', 'hammer_curl',
  // РРєСЂС‹/РџСЂРµСЃСЃ
  'calf_raise', 'crunch',
]);

// РЎР»РёС€РєРѕРј СЃРїРµС†РёС„РёС‡РµСЃРєРёРµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ (РёСЃРєР»СЋС‡Р°С‚СЊ РґР»СЏ generic РїР»Р°РЅР°, РµСЃР»Рё РЅРµС‚ weak point).
// "Р–РёРј РѕР±СЂР°С‚РЅС‹Рј С…РІР°С‚РѕРј" вЂ” РїСЂРёРјРµСЂ РёР· Р·Р°РїСЂРѕСЃР°: РјР°Р»Рѕ СЌС„С„РµРєС‚РёРІРµРЅ РґР»СЏ РѕР±С‰РµРіРѕ СЂР°Р·РІРёС‚РёСЏ РіСЂСѓРґРё.
// Р–РёРјС‹ РІ РЅРµРіР°С‚РёРІРЅРѕРј/РѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕРј РЅР°РєР»РѕРЅРµ (decline) вЂ” РЅРёР·РєР°СЏ РїСЂР°РєС‚РёС‡РµСЃРєР°СЏ С†РµРЅРЅРѕСЃС‚СЊ РґР»СЏ
// РіРёРїРµСЂС‚СЂРѕС„РёРё РіСЂСѓРґРё: РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊ + РЅР°РєР»РѕРЅ 30В° СѓР¶Рµ РїРѕРєСЂС‹РІР°СЋС‚ РІРµСЃСЊ РѕР±СЉС‘Рј.
const BLACKLIST_GENERIC = new Set([
  'bench_press_reverse_grip', 'reverse_grip_bench_press',
  'underhand_grip_lat_pulldown',
  'wide_grip_bench_press',
  'smith_machine_squat',
  'leg_press_machine_close_stance',
  'machine preacher_curl',
  // decline-Р¶РёРјС‹ (РєРѕРјРїР°СѓРЅРґС‹): РЅРёР·РєР°СЏ С†РµРЅРЅРѕСЃС‚СЊ РґР»СЏ generic-РјР°СЃСЃС‹
  'decline_bar', 'decline_db', 'machine_decline_press', 'smith_decline',
  // РїСѓР»РѕРІРµСЂС‹ (РіСЂСѓРґСЊ-РіСЂСѓРїРїР°, РЅРѕ РґРІРёР¶РµРЅРёРµ вЂ” С‚СЏРіР° С€РёСЂРѕС‡Р°Р№С€РёС…): РЅРµ РІ РіСЂСѓРґСЊ
  'dumbbell_pullover', 'db_pullover_cross_bench',
]);

// Р”РµС‚Р°Р»СЊРЅС‹Рµ РёРЅСЃС‚СЂСѓРєС†РёРё РїРѕ РІС‹РїРѕР»РЅРµРЅРёСЋ (СѓРіР»С‹, С…РІР°С‚, С‚РµС…РЅРёРєР°).
// Р—Р°РјРµРЅСЏСЋС‚ Р°Р±СЃС‚СЂР°РєС‚РЅС‹Рµ "РїРѕСЃС‚РѕСЏРЅРЅС‹Р№ С‚РµРјРї" РЅР° РєРѕРЅРєСЂРµС‚РЅС‹Рµ РєРѕРјР°РЅРґС‹.
// FIX-A8: dual-key lookup вЂ” EN id (bench_press) + RU name (Р¶РёРј С€С‚Р°РЅРіРё Р»С‘Р¶Р°).
// buildExComment СЃРЅР°С‡Р°Р»Р° РёС‰РµС‚ РїРѕ exerciseId (EN), РїРѕС‚РѕРј РїРѕ RU-РёРјРµРЅРё.
const EXECUTION_NOTES: Record<string, string> = {
  // EN IDs (canonical from EXERCISE_CATALOG)
  bench_press: "Р›РѕРІРєР°: РЅР° С€РёСЂРёРЅРµ РїР»РµС‡. РҐРІР°С‚: РїСЂСЏРјРѕР№. Р›РѕРєС‚Рё: С‡СѓС‚СЊ РїРѕРґ РіСЂРёС„РѕРј (РЅРµ РІ СЃС‚РѕСЂРѕРЅС‹). РћРїСѓСЃРєР°Р№С‚Рµ РґРѕ РєР°СЃР°РЅРёСЏ РіСЂСѓРґРё.",
  incline_barbell_press: "РЎРєР°РјСЊСЏ: 30-45 РіСЂР°РґСѓСЃРѕРІ. Р›РѕРІРєР°: С‡СѓС‚СЊ С€РёСЂРµ РїР»РµС‡. РЎРїРёРЅР°: РїР»РѕС‚РЅРѕ РїСЂРёР¶Р°С‚Р°.",
  dumbbell_bench_press: "РҐРІР°С‚: РЅРµР№С‚СЂР°Р»СЊРЅС‹Р№ (Р»Р°РґРѕРЅРё РґСЂСѓРі Рє РґСЂСѓРіСѓ). РћРїСѓСЃРєР°Р№С‚Рµ РґРѕ СЂР°СЃС‚СЏР¶РµРЅРёСЏ РіСЂСѓРґРё.",
  squat: "РЎС‚РѕРїС‹: РЅР° С€РёСЂРёРЅРµ РїР»РµС‡. РЎРїРёРЅР°: РїСЂСЏРјР°СЏ, РЅР°С‚СЏР¶РµРЅРёРµ. Р“Р»СѓР±РёРЅР°: РїР°СЂР°Р»Р»РµР»СЊРЅРѕ РїРѕР»Сѓ. Р’Р·РіР»СЏРґ: РІРїРµСЂС‘Рґ.",
  leg_press: "РЎС‚РѕРїС‹: РЅР° РїР»Р°С‚С„РѕСЂРјРµ, РїР»РµС‡Рё Р·Р°С‰РёС‰РµРЅС‹. Р“Р»СѓР±РёРЅР°: РґРѕ 90 РіСЂР°РґСѓСЃРѕРІ РІ РєРѕР»РµРЅСЏС….",
  romanian_deadlift: "РЎРїРёРЅР°: РїСЂСЏРјР°СЏ. Р“СЂРёС„: Р±Р»РёР·РєРѕ Рє РіРѕР»РµРЅСЏРј. Р’Р·РіР»СЏРґ: РІРїРµСЂС‘Рґ. РќРµ РєСЂСѓРіР»РёС‚СЊ СЃРїРёРЅСѓ!",
  deadlift: "РҐРІР°С‚: РїРѕ С€РёСЂРёРЅРµ РїР»РµС‡ РёР»Рё СЂР°Р·РЅРѕСЃС‚РѕСЂРѕРЅРЅРёР№. РЎРїРёРЅР°: РїСЂСЏРјР°СЏ, РіСЂСѓРґСЊ РІРїРµСЂС‘Рґ.",
  barbell_row: "РќР°РєР»РѕРЅ: 45-60 РіСЂР°РґСѓСЃРѕРІ. РўСЏРіР° Рє РЅРёР·Сѓ Р¶РёРІРѕС‚Р°. Р›РѕРєС‚Рё: РІРґРѕР»СЊ С‚СѓР»РѕРІРёС‰Р°.",
  dumbbell_row: "РќР°РєР»РѕРЅ: РѕРїРѕСЂР° РЅР° СЃРєР°РјСЊСЋ. РўСЏРіР° Рє РїРѕСЏСЃСѓ. Р СѓРєРё РїР°СЂР°Р»Р»РµР»СЊРЅРѕ.",
  lat_pulldown: "РҐРІР°С‚: С€РёСЂРѕРєРёР№. РўСЏРЅРёС‚Рµ Рє РІРµСЂС…Сѓ РіСЂСѓРґРё. РќРµ СЂР°СЃРєР°С‡РёРІР°Р№С‚РµСЃСЊ РєРѕСЂРїСѓСЃРѕРј.",
  pull_up: "РҐРІР°С‚: С€РёСЂРѕРєРёР№. РџРѕРґР±РѕСЂРѕРґРѕРє РЅР°Рґ РїРµСЂРµРєР»Р°РґРёРЅРѕР№. РћРїСѓСЃРєР°Р№С‚Рµ РґРѕ РїРѕС‡С‚Рё РїРѕР»РЅРѕРіРѕ РІС‹РїСЂСЏРјР»РµРЅРёСЏ СЂСѓРє.",
  overhead_press: "РҐРІР°С‚: С‡СѓС‚СЊ С€РёСЂРµ РїР»РµС‡. Р’С‹Р¶РёРјР°Р№С‚Рµ РЅР°Рґ РіРѕР»РѕРІРѕР№. РќРµ РїСЂРѕРіРёР±Р°Р№С‚РµСЃСЊ РІ РїРѕСЏСЃРЅРёС†Рµ.",
  arnold_press: "РҐРІР°С‚: РЅРµР№С‚СЂР°Р»СЊРЅС‹Р№. Р’С‹Р¶РёРјР°Р№С‚Рµ РІРІРµСЂС…, СЂР°Р·РІРѕСЂР°С‡РёРІР°СЏ Р»Р°РґРѕРЅСЏРјРё РѕС‚ СЃРµР±СЏ РїСЂРё РїРѕРґСЉРµРјРµ.",
  tricep_pushdown: "РҐРІР°С‚: СѓР·РєРёР№ V-РѕР±СЂР°Р·РЅС‹Р№. Р›РѕРєС‚Рё РїСЂРёР¶Р°С‚С‹ Рє РєРѕСЂРїСѓСЃСѓ. РћРїСѓСЃРєР°Р№С‚Рµ РјРµРґР»РµРЅРЅРѕ, РІРІРµСЂС… РІР·СЂС‹РІРЅРѕ.",
  lying_tricep_extension: "РҐРІР°С‚: EZ-РіСЂРёС„. Р›РѕРєС‚Рё РЅР°РїСЂР°РІР»РµРЅС‹ РІ РїРѕС‚РѕР»РѕРє (РЅРµ СЂР°Р·РІРѕРґРёС‚Рµ РІ СЃС‚РѕСЂРѕРЅС‹!).",
  barbell_curl: "РҐРІР°С‚: РЅР° С€РёСЂРёРЅРµ РїР»РµС‡. Р›РѕРєС‚Рё РїСЂРёР¶Р°С‚С‹. РќРµ СЂР°СЃРєР°С‡РёРІР°Р№С‚РµСЃСЊ РєРѕСЂРїСѓСЃРѕРј.",
  dumbbell_curl: "Р§РµСЂРµРґСѓР№С‚Рµ СЃСѓРїРёРЅР°С†РёСЋ (Р»Р°РґРѕРЅРё РґСЂСѓРі Рє РґСЂСѓРіСѓ, РЅРµР№С‚СЂР°Р»СЊРЅС‹Р№).",
  leg_curl: "РћРїСѓСЃРєР°Р№С‚Рµ РјРµРґР»РµРЅРЅРѕ (СЌРєСЃС†РµРЅС‚СЂРёРєР°), РїРѕРґРЅРёРјР°Р№С‚Рµ Р±С‹СЃС‚СЂРѕ (РєРѕРЅС†РµРЅС‚СЂРёРєР°).",
  leg_extension: "Р’С‹РїСЂСЏРјР»СЏР№С‚Рµ РїРѕР»РЅРѕСЃС‚СЊСЋ (РІРІРµСЂС…Сѓ Р·Р°РґРµСЂР¶РєР° 0.5 СЃРµРє).",
  calf_raise: "РњР°РєСЃРёРјСѓРј СЂР°СЃС‚СЏР¶РµРЅРёСЏ РІРЅРёР·Сѓ, СЃС‚РѕР№С‚Рµ РЅР° РЅРѕСЃРєР°С… 1 СЃРµРє РІРІРµСЂС…Сѓ.",
  crunch: "РџРѕРґРЅРёРјР°Р№С‚Рµ Р»РѕРїР°С‚РєРё СЃ РїРѕР»Р°. Р СѓРєРё Р·Р° РіРѕР»РѕРІРѕР№. Р”РІРёР¶РµРЅРёРµ РєРѕСЂРѕС‚РєРѕРµ, РєРѕРЅС†РµРЅС‚СЂРёСЂРѕРІР°РЅРЅРѕРµ.",
  incline_dumbbell_press: "РЎРєР°РјСЊСЏ: 30-45 РіСЂР°РґСѓСЃРѕРІ. Р“Р°РЅС‚РµР»Рё: РЅРµР№С‚СЂР°Р»СЊРЅС‹Р№ С…РІР°С‚. РћРїСѓСЃРєР°Р№С‚Рµ РґРѕ СЂР°СЃС‚СЏР¶РµРЅРёСЏ РІРµСЂС…РЅРµР№ РіСЂСѓРґРё.",
  t_bar_row: "РҐРІР°С‚: С€РёСЂРѕРєРёР№. Р“СЂСѓРґСЊ РѕРїРёСЂР°РµС‚СЃСЏ РЅР° РїРѕРґСѓС€РєСѓ. РўСЏРЅРёС‚Рµ Р»РѕРєС‚СЏРјРё, СЃРІРѕРґРёС‚Рµ Р»РѕРїР°С‚РєРё.",
  chin_up: "РҐРІР°С‚: РѕР±СЂР°С‚РЅС‹Р№ (Р»Р°РґРѕРЅРё Рє СЃРµР±Рµ). РџРѕРґР±РѕСЂРѕРґРѕРє РЅР°Рґ РїРµСЂРµРєР»Р°РґРёРЅРѕР№. Р‘РёС†РµРїСЃ+СЃРїРёРЅР°.",
  dumbbell_lunge: "РЁР°Рі: РґР»РёРЅРЅС‹Р№. РљРѕР»РµРЅРѕ РїРµСЂРµРґРЅРµР№ РЅРѕРіРё РЅРµ РІС‹С…РѕРґРёС‚ Р·Р° РЅРѕСЃРѕРє. РљРѕСЂРїСѓСЃ РІРµСЂС‚РёРєР°Р»СЊРЅРѕ.",
  dumbbell_lateral_raise: "Р‘РµР· СЂР°СЃРєР°С‡РєРё. Р›РѕРєС‚Рё С‡СѓС‚СЊ СЃРѕРіРЅСѓС‚С‹. РџРѕРґРЅРёРјР°Р№С‚Рµ РґРѕ СѓСЂРѕРІРЅСЏ РїР»РµС‡. Р‘РѕР»СЊС€РѕР№ РїР°Р»РµС† РІРЅРёР·.",
  hack_squat: "РЎРїРёРЅР° РїР»РѕС‚РЅРѕ РїСЂРёР¶Р°С‚Р° Рє РїРѕРґСѓС€РєРµ. РЎС‚РѕРїС‹: РЅР° С€РёСЂРёРЅРµ РїР»РµС‡, Р±Р»РёР¶Рµ Рє РІРµСЂС…Сѓ РїР»Р°С‚С„РѕСЂРјС‹. Р“Р»СѓР±РёРЅР°: РґРѕ 90В° РІ РєРѕР»РµРЅСЏС…. РќРµ РѕС‚СЂС‹РІР°С‚СЊ С‚Р°Р·.",
  smith_squat: "РЎРїРёРЅР° РїСЂСЏРјР°СЏ, РіСЂРёС„ РїРѕ С‚СЂР°РµРєС‚РѕСЂРёРё РЎРјРёС‚Р°. РЎС‚РѕРїС‹ С‡СѓС‚СЊ РІРїРµСЂС‘Рґ РѕС‚ РєРѕСЂРїСѓСЃР° (СЃРЅРёР¶Р°РµС‚ РЅР°РіСЂСѓР·РєСѓ РЅР° РєРѕР»РµРЅРё). Р“Р»СѓР±РёРЅР°: РїР°СЂР°Р»Р»РµР»СЊРЅРѕ.",
  bulgarian_split_squat: "Р—Р°РґРЅСЏСЏ РЅРѕРіР° РЅР° СЃРєР°РјСЊРµ. РЁР°Рі РїРµСЂРµРґРЅРµР№: СЃСЂРµРґРЅРёР№. РљРѕР»РµРЅРѕ РЅРµ РІС‹С…РѕРґРёС‚ Р·Р° РЅРѕСЃРѕРє. РљРѕСЂРїСѓСЃ РІРµСЂС‚РёРєР°Р»СЊРЅРѕ. Р“Р°РЅС‚РµР»СЊ РІ РѕРґРЅРѕР№ СЂСѓРєРµ РёР»Рё РїРѕ Р±РѕРєР°Рј.",
  // RU name fallbacks (РґР»СЏ СѓРїСЂР°Р¶РЅРµРЅРёР№, РіРґРµ id РјРѕР¶РµС‚ РЅРµ СЃРѕРІРїР°РґР°С‚СЊ)
  'Р¶РёРј С€С‚Р°РЅРіРё Р»С‘Р¶Р°': "Р›РѕРІРєР°: РЅР° С€РёСЂРёРЅРµ РїР»РµС‡. РҐРІР°С‚: РїСЂСЏРјРѕР№. Р›РѕРєС‚Рё: С‡СѓС‚СЊ РїРѕРґ РіСЂРёС„РѕРј. РћРїСѓСЃРєР°Р№С‚Рµ РґРѕ РєР°СЃР°РЅРёСЏ РіСЂСѓРґРё.",
  'Р¶РёРј РіР°РЅС‚РµР»РµР№ Р»С‘Р¶Р°': "РҐРІР°С‚: РЅРµР№С‚СЂР°Р»СЊРЅС‹Р№. РћРїСѓСЃРєР°Р№С‚Рµ РґРѕ СЂР°СЃС‚СЏР¶РµРЅРёСЏ РіСЂСѓРґРё.",
  'Р¶РёРј РіР°РЅС‚РµР»РµР№ РЅР° РЅР°РєР»РѕРЅРЅРѕР№ СЃРєР°РјСЊРµ': "РЎРєР°РјСЊСЏ: 30-45В°. Р“Р°РЅС‚РµР»Рё: РЅРµР№С‚СЂР°Р»СЊРЅС‹Р№ С…РІР°С‚. РћРїСѓСЃРєР°Р№С‚Рµ РґРѕ СЂР°СЃС‚СЏР¶РµРЅРёСЏ РІРµСЂС…РЅРµР№ РіСЂСѓРґРё.",
  'Р¶РёРј РЅРѕРіР°РјРё': "РЎС‚РѕРїС‹: РЅР° РїР»Р°С‚С„РѕСЂРјРµ, РїР»РµС‡Рё Р·Р°С‰РёС‰РµРЅС‹. Р“Р»СѓР±РёРЅР°: РґРѕ 90В° РІ РєРѕР»РµРЅСЏС….",
  'СЂСѓРјС‹РЅСЃРєР°СЏ С‚СЏРіР°': "РЎРїРёРЅР°: РїСЂСЏРјР°СЏ. Р“СЂРёС„: Р±Р»РёР·РєРѕ Рє РіРѕР»РµРЅСЏРј. РќРµ РєСЂСѓРіР»РёС‚СЊ СЃРїРёРЅСѓ!",
  'С‚СЏРіР° С€С‚Р°РЅРіРё РІ РЅР°РєР»РѕРЅРµ': "РќР°РєР»РѕРЅ: 45-60В°. РўСЏРіР° Рє РЅРёР·Сѓ Р¶РёРІРѕС‚Р°. Р›РѕРєС‚Рё: РІРґРѕР»СЊ С‚СѓР»РѕРІРёС‰Р°.",
  'С‚СЏРіР° РІРµСЂС…РЅРµРіРѕ Р±Р»РѕРєР°': "РҐРІР°С‚: С€РёСЂРѕРєРёР№. РўСЏРЅРёС‚Рµ Рє РІРµСЂС…Сѓ РіСЂСѓРґРё. РќРµ СЂР°СЃРєР°С‡РёРІР°Р№С‚РµСЃСЊ.",
  'РїРѕРґС‚СЏРіРёРІР°РЅРёСЏ': "РҐРІР°С‚: С€РёСЂРѕРєРёР№. РџРѕРґР±РѕСЂРѕРґРѕРє РЅР°Рґ РїРµСЂРµРєР»Р°РґРёРЅРѕР№. РћРїСѓСЃРєР°Р№С‚Рµ РґРѕ РїРѕС‡С‚Рё РїРѕР»РЅРѕРіРѕ РІС‹РїСЂСЏРјР»РµРЅРёСЏ.",
  'Р°СЂРјРµР№СЃРєРёР№ Р¶РёРј': "РҐРІР°С‚: С‡СѓС‚СЊ С€РёСЂРµ РїР»РµС‡. Р’С‹Р¶РёРјР°Р№С‚Рµ РЅР°Рґ РіРѕР»РѕРІРѕР№. РќРµ РїСЂРѕРіРёР±Р°Р№С‚РµСЃСЊ РІ РїРѕСЏСЃРЅРёС†Рµ.",
  'Р¶РёРј СЃС‚РѕСЏ': "РҐРІР°С‚: С‡СѓС‚СЊ С€РёСЂРµ РїР»РµС‡. Р’С‹Р¶РёРјР°Р№С‚Рµ РЅР°Рґ РіРѕР»РѕРІРѕР№. РќРµ РїСЂРѕРіРёР±Р°Р№С‚РµСЃСЊ РІ РїРѕСЏСЃРЅРёС†Рµ.",
  'СЂР°Р·РіРёР±Р°РЅРёРµ СЂСѓРє РЅР° Р±Р»РѕРєРµ': "РҐРІР°С‚: СѓР·РєРёР№ V-РѕР±СЂР°Р·РЅС‹Р№. Р›РѕРєС‚Рё РїСЂРёР¶Р°С‚С‹. РћРїСѓСЃРєР°Р№С‚Рµ РјРµРґР»РµРЅРЅРѕ, РІРІРµСЂС… РІР·СЂС‹РІРЅРѕ.",
  'С„СЂР°РЅС†СѓР·СЃРєРёР№ Р¶РёРј': "РҐРІР°С‚: EZ-РіСЂРёС„. Р›РѕРєС‚Рё РЅР°РїСЂР°РІР»РµРЅС‹ РІ РїРѕС‚РѕР»РѕРє (РЅРµ СЂР°Р·РІРѕРґРёС‚Рµ РІ СЃС‚РѕСЂРѕРЅС‹!).",
  'РїРѕРґСЉС‘Рј С€С‚Р°РЅРіРё РЅР° Р±РёС†РµРїСЃ': "РҐРІР°С‚: РЅР° С€РёСЂРёРЅРµ РїР»РµС‡. Р›РѕРєС‚Рё РїСЂРёР¶Р°С‚С‹. РќРµ СЂР°СЃРєР°С‡РёРІР°Р№С‚РµСЃСЊ.",
  'СЃРіРёР±Р°РЅРёРµ РЅРѕРі': "РћРїСѓСЃРєР°Р№С‚Рµ РјРµРґР»РµРЅРЅРѕ (СЌРєСЃС†РµРЅС‚СЂРёРєР°), РїРѕРґРЅРёРјР°Р№С‚Рµ Р±С‹СЃС‚СЂРѕ (РєРѕРЅС†РµРЅС‚СЂРёРєР°).",
  'СЂР°Р·РіРёР±Р°РЅРёРµ РЅРѕРі': "Р’С‹РїСЂСЏРјР»СЏР№С‚Рµ РїРѕР»РЅРѕСЃС‚СЊСЋ (РІРІРµСЂС…Сѓ Р·Р°РґРµСЂР¶РєР° 0.5 СЃРµРє).",
  'РїРѕРґСЉС‘Рј РЅР° РЅРѕСЃРєРё': "РњР°РєСЃРёРјСѓРј СЂР°СЃС‚СЏР¶РµРЅРёСЏ РІРЅРёР·Сѓ, СЃС‚РѕР№С‚Рµ РЅР° РЅРѕСЃРєР°С… 1 СЃРµРє РІРІРµСЂС…Сѓ.",
  'СЃРєСЂСѓС‡РёРІР°РЅРёСЏ': "РџРѕРґРЅРёРјР°Р№С‚Рµ Р»РѕРїР°С‚РєРё СЃ РїРѕР»Р°. Р СѓРєРё Р·Р° РіРѕР»РѕРІРѕР№. Р”РІРёР¶РµРЅРёРµ РєРѕСЂРѕС‚РєРѕРµ.",
  'РІС‹РїР°РґС‹ СЃ РіР°РЅС‚РµР»СЏРјРё': "РЁР°Рі: РґР»РёРЅРЅС‹Р№. РљРѕР»РµРЅРѕ РїРµСЂРµРґРЅРµР№ РЅРѕРіРё РЅРµ РІС‹С…РѕРґРёС‚ Р·Р° РЅРѕСЃРѕРє. РљРѕСЂРїСѓСЃ РІРµСЂС‚РёРєР°Р»СЊРЅРѕ.",
  'РјР°С…Рё РіР°РЅС‚РµР»СЏРјРё РІ СЃС‚РѕСЂРѕРЅС‹': "Р‘РµР· СЂР°СЃРєР°С‡РєРё. Р›РѕРєС‚Рё С‡СѓС‚СЊ СЃРѕРіРЅСѓС‚С‹. РџРѕРґРЅРёРјР°Р№С‚Рµ РґРѕ СѓСЂРѕРІРЅСЏ РїР»РµС‡.",
  'РіР°РєРє-РїСЂРёСЃРµРґР°РЅРёСЏ': "РЎРїРёРЅР° РїР»РѕС‚РЅРѕ РїСЂРёР¶Р°С‚Р°. РЎС‚РѕРїС‹: РЅР° С€РёСЂРёРЅРµ РїР»РµС‡. Р“Р»СѓР±РёРЅР°: РґРѕ 90В° РІ РєРѕР»РµРЅСЏС….",
  'Р±РѕР»РіР°СЂСЃРєРёРµ СЃРїР»РёС‚-РїСЂРёСЃРµРґР°РЅРёСЏ': "Р—Р°РґРЅСЏСЏ РЅРѕРіР° РЅР° СЃРєР°РјСЊРµ. РЁР°Рі РїРµСЂРµРґРЅРµР№: СЃСЂРµРґРЅРёР№. РљРѕР»РµРЅРѕ РЅРµ РІС‹С…РѕРґРёС‚ Р·Р° РЅРѕСЃРѕРє.",
  'Р¶РёРј РіР°РЅС‚РµР»РµР№ СЃРёРґСЏ': "РҐРІР°С‚: РЅРµР№С‚СЂР°Р»СЊРЅС‹Р№. Р’С‹Р¶РёРјР°Р№С‚Рµ РІРІРµСЂС…. РќРµ РїСЂРѕРіРёР±Р°Р№С‚РµСЃСЊ РІ РїРѕСЏСЃРЅРёС†Рµ.",
  'С‚СЏРіР° РЅРёР¶РЅРµРіРѕ Р±Р»РѕРєР°': "РўСЏРіР° Рє РїРѕСЏСЃСѓ. Р›РѕРєС‚Рё РІРґРѕР»СЊ С‚СѓР»РѕРІРёС‰Р°. РЎРІРѕРґРёС‚Рµ Р»РѕРїР°С‚РєРё.",
  'Р¶РёРј РІ С‚СЂРµРЅР°Р¶С‘СЂРµ': "РҐРІР°С‚: РЅРµР№С‚СЂР°Р»СЊРЅС‹Р№/РїСЂСЏРјРѕР№. РЎРїРёРЅР° РїР»РѕС‚РЅРѕ РїСЂРёР¶Р°С‚Р°. РљРѕРЅС‚СЂРѕР»СЊ РЅРµРіР°С‚РёРІРЅРѕР№ С„Р°Р·С‹.",
  'Р¶РёРј РІ С‚СЂРµРЅР°Р¶С‘СЂРµ РЅР° РЅР°РєР»РѕРЅРЅРѕР№': "РЎРєР°РјСЊСЏ: 30-45В°. РљРѕРЅС‚СЂРѕР»СЊ РЅРµРіР°С‚РёРІРЅРѕР№ С„Р°Р·С‹. РћРїСѓСЃРєР°Р№С‚Рµ РґРѕ СЂР°СЃС‚СЏР¶РµРЅРёСЏ РІРµСЂС…РЅРµР№ РіСЂСѓРґРё.",
  'СЃРІРµРґРµРЅРёРµ РІ С‚СЂРµРЅР°Р¶С‘СЂРµ': "РЎРІРѕРґРёС‚Рµ СЂСѓРєРё РґРѕ РєР°СЃР°РЅРёСЏ. РљРѕРЅС‚СЂРѕР»СЊ РЅРµРіР°С‚РёРІРЅРѕР№ С„Р°Р·С‹. Р Р°СЃС‚СЏР¶РµРЅРёРµ РІ СЃС‚Р°СЂС‚РѕРІРѕР№ РїРѕР·РёС†РёРё.",
  'СЃРІРµРґРµРЅРёРµ СЂСѓРє РІ РєСЂРѕСЃСЃРѕРІРµСЂРµ': "РЎРІРѕРґРёС‚Рµ СЂСѓРєРё РґРѕ РєР°СЃР°РЅРёСЏ. РљРѕРЅС‚СЂРѕР»СЊ РЅРµРіР°С‚РёРІРЅРѕР№ С„Р°Р·С‹. Р Р°СЃС‚СЏР¶РµРЅРёРµ РІ СЃС‚Р°СЂС‚РѕРІРѕР№ РїРѕР·РёС†РёРё.",
  'РѕС‚Р¶РёРјР°РЅРёСЏ РЅР° Р±СЂСѓСЃСЊСЏС…': "РљРѕСЂРїСѓСЃ: РЅР°РєР»РѕРЅ РІРїРµСЂС‘Рґ (РіСЂСѓРґСЊ) РёР»Рё РІРµСЂС‚РёРєР°Р»СЊРЅРѕ (С‚СЂРёС†РµРїСЃ). РћРїСѓСЃРєР°Р№С‚РµСЃСЊ РґРѕ РїР°СЂР°Р»Р»РµР»Рё РїР»РµС‡ РїРѕР»Сѓ.",
  'РіРёРїРµСЂСЌРєСЃС‚РµРЅР·РёСЏ': "РЎРїРёРЅР°: РїСЂСЏРјР°СЏ. РќРµ РїРµСЂРµСЂР°Р·РіРёР±Р°Р№С‚РµСЃСЊ РІ РІРµСЂС…РЅРµР№ С‚РѕС‡РєРµ. Р”РІРёР¶РµРЅРёРµ РєРѕРЅС‚СЂРѕР»РёСЂСѓРµРјРѕРµ.",
  'СЏРіРѕРґРёС‡РЅС‹Р№ РјРѕСЃС‚': "РЎС‚РѕРїС‹: РЅР° С€РёСЂРёРЅРµ РїР»РµС‡. РўР°Р·: РІРІРµСЂС… РґРѕ РїРѕР»РЅРѕРіРѕ СЂР°Р·РіРёР±Р°РЅРёСЏ. РџРёРєРѕРІРѕРµ СЃРѕРєСЂР°С‰РµРЅРёРµ 1 СЃРµРє.",
  'С€СЂР°РіРё СЃРѕ С€С‚Р°РЅРіРѕР№': "РџР»РµС‡Рё: РІРІРµСЂС… Рє СѓС€Р°Рј. Р‘РµР· РІСЂР°С‰РµРЅРёСЏ. Р—Р°РґРµСЂР¶РєР° 1 СЃРµРє РІРІРµСЂС…Сѓ.",
  'С€СЂР°РіРё СЃ РіР°РЅС‚РµР»СЏРјРё': "РџР»РµС‡Рё: РІРІРµСЂС… Рє СѓС€Р°Рј. Р‘РµР· РІСЂР°С‰РµРЅРёСЏ. Р—Р°РґРµСЂР¶РєР° 1 СЃРµРє РІРІРµСЂС…Сѓ.",
};

// FIX-B4: lengthenedBonus вЂ” РёРјРїРѕСЂС‚РёСЂРѕРІР°РЅ РёР· bb-exercise-selection.engine.ts (РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє).
// Schoenfeld 2022, Maeo 2023: РґР»РёРЅР° РјС‹С€С†С‹ РїСЂРё РЅР°С‚СЏР¶РµРЅРёРё вЂ” РєР»СЋС‡РµРІРѕР№ РґСЂР°Р№РІРµСЂ РіРёРїРµСЂС‚СЂРѕС„РёРё.
// RDL > stiff-leg deadlift, incline curl > preacher curl, sissy squat > leg extension.
// P2-4: trainingFocus РјРѕРґСѓР»РёСЂСѓРµС‚ Р±РѕРЅСѓСЃ вЂ” strength РјРµРЅСЊС€Рµ Р·Р°Р±РѕС‚РёС‚ СЂР°СЃС‚СЏР¶РµРЅРёРµ
// (РјРµС…Р°РЅРёС‡РµСЃРєРѕРµ РЅР°С‚СЏР¶РµРЅРёРµ РІР°Р¶РЅРµРµ), endurance Р±РѕР»СЊС€Рµ (РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєРёР№ СЃС‚СЂРµСЃСЃ + СЂР°СЃС‚СЏР¶РµРЅРёРµ).

/** Р Р°РЅРі СѓРїСЂР°Р¶РЅРµРЅРёСЏ РїРѕ "С‚СЏР¶РµСЃС‚Рё" вЂ” РѕРїСЂРµРґРµР»СЏРµС‚ РїРѕСЂСЏРґРѕРє РІРЅСѓС‚СЂРё СѓРіР»Р°.
 *  compound barbell (1) > compound dumbbell (2) > compound machine (3) >
 *  compound cable (4) > compound bodyweight (5) > isolation (6) > one-arm (7).
 *  РџРµСЂРІРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ РІ РґРЅРµ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ СЃР°РјС‹Рј С‚СЏР¶С‘Р»С‹Рј (РЅР°РёР±РѕР»СЊС€РµРµ РјРµС…Р°РЅРёС‡РµСЃРєРѕРµ РЅР°С‚СЏР¶РµРЅРёРµ). */
function strengthRank(ex: any): number {
  const n = (ex.name || '').toLowerCase();
  const eq = String(ex.equipment || '').toLowerCase();
  const isOneArm = /РѕРґРЅРѕР№ СЂСѓРєРѕР№|РѕРґРЅРѕР№ СЂСѓРєРµ|single.?arm|unilateral/i.test(n);
  const isCompound = ex.type === 'compound';
  if (isOneArm) return 7;
  if (!isCompound) return 6;
  if (eq.includes('barbell') || eq.includes('smith')) return 1;
  if (eq.includes('dumbbell')) return 2;
  if (eq.includes('machine')) return 3;
  if (eq.includes('cable')) return 4;
  if (eq.includes('bodyweight') || eq.includes('suspension')) return 5;
  return 5;
}

/** РџСЂРѕРІРµСЂРёС‚СЊ, СЏРІР»СЏРµС‚СЃСЏ Р»Рё СѓРїСЂР°Р¶РЅРµРЅРёРµ Р·Р°РґРЅРµР№ РґРµР»СЊС‚РѕР№ (rear delt). */
/**
 * BB-JUNK: СѓРїСЂР°Р¶РЅРµРЅРёСЏ, РЅРµ РїРѕРґС…РѕРґСЏС‰РёРµ РґР»СЏ РіРёРїРµСЂС‚СЂРѕС„РёР№РЅРѕРіРѕ Р±РѕРґРёР±РёР»РґРёРЅРіР°.
 * Р РµР°Р±РёР»РёС‚Р°С†РёСЏ/РєРѕСЂ-СЃС‚Р°Р±РёР»СЊРЅРѕСЃС‚СЊ/С„СѓРЅРєС†РёРѕРЅР°Р»РєР°: pallof, bird dog, monster walks,
 * РїР»Р°РЅРєРё (РёР·РѕРјРµС‚СЂРёРєР°), copenhagen, spiderman, jack, walkout, superman.
 * Р­С‚Рё СѓРїСЂР°Р¶РЅРµРЅРёСЏ РЅРµ РґР°СЋС‚ РјРµС…Р°РЅРёС‡РµСЃРєРѕРіРѕ РЅР°С‚СЏР¶РµРЅРёСЏ/РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєРѕРіРѕ СЃС‚СЂРµСЃСЃР° РґР»СЏ СЂРѕСЃС‚Р° РјС‹С€С†.
 * Р Р°Р·СЂРµС€РµРЅС‹: СЃРєСЂСѓС‡РёРІР°РЅРёСЏ (crunch), РїРѕРґСЉС‘Рј РЅРѕРі, РіРёРїРµСЂСЌРєСЃС‚РµРЅР·РёСЏ (СЏРіРѕРґРёС†С‹/СЂР°Р·РіРёР±Р°С‚РµР»Рё СЃРїРёРЅС‹).
 */
const BB_JUNK_PATTERNS: RegExp = /РїР°Р»Р»РѕС„|pallof|bird.?dog|РїС‚РёС†.*СЃРѕР±Р°Рє|monster.?walk|СЂРµР·РёРЅ|banded|band.?walk|РїР»Р°РЅРє|plank|copenhagen|РєРѕРїРµРЅРіР°РіРµРЅ|spiderman|С‡РµР»РѕРІРµРє.?РїР°СѓРє|plank.?jack|РїР»Р°РЅРє.*РїСЂС‹Р¶Рє|walkout|С€Р°РіР°СЋС‰.*РїР»Р°РЅРє|СЃСѓРїРµСЂРјРµРЅ|superman|gator.?walk|Р°Р»Р»РёРіР°С‚РѕСЂ|inchworm|РіСѓСЃРµРЅРёС†|dead.?bug|РјС‘СЂС‚РІ.*Р¶СѓРє|РјРµСЂС‚РІ.*Р¶СѓРє|РјРµРґР±РѕР»|med.?ball|medicine.?ball|Р±СЂРѕСЃРѕРє.*РјСЏС‡|СЂСѓР±Рє.*РґСЂРѕРІ|СЂСѓР±Рє.*РґРµСЂРµРІ|wood.?chop|СЂРѕС‚Р°С†РёРѕРЅ|rotational|bradford|Р±СЂСЌРґС„РѕСЂРґ|РЅР°РєР»РѕРЅ.*СЃРёРґСЏ.*С€С‚Р°РЅРі|seated.*good.?morning|РѕС‚Р¶РёРјР°РЅРёСЏ.*(?:РѕС‚ РїРѕР»|РѕС‚ СЃРєР°Рј|РЅР° РєРѕР»РµРЅ|РѕС‚ РєРѕР»РµРЅ)|push.?up|СЂСѓСЃСЃРє.*С‚РІРёСЃС‚|russian.?twist|С‚СЏРіР°.*Р·Р° РіРѕР»РѕРІ|pulldown.*behind|pike.*РѕС‚Р¶РёРј|pike.*push|РёРЅРґРёР№СЃРє|hindu.*push|СЃРєРѕР»СЊР¶РµРЅ.*СЃС‚РµРЅ|wall.?slide|РєСѓР±Р°РЅ|cuban|РјРµР»СЊРЅРёС†.*РіРёСЂ|windmill|РїСѓРіР°Р»Рѕ|scarecrow|Р¶РёРј.*РіРёСЂ|kb.?press|bent.?press|РЅР°РєР»РѕРЅРЅ.*Р¶РёРј.*РіРёСЂ|Р»СЌРЅРґРјР°Р№РЅ|landmine|РІРёСЃ.*РїРѕР»РѕС‚РµРЅ|РІРёСЃ.*РіСЂРёС„|РІРёСЃ.*С‚СѓСЂРЅРёРє|l.?СЃРёС‚|l.?sit|СЂР°СЃС‚СЏР¶Рє|stretch|РјРѕР±РёР»СЊРЅ|mobility|РєРѕС€Рє.*РєРѕСЂРѕРІР°|cat.?cow|РєРѕР»РµСЃРѕ|ab.?wheel|РіРѕСЂРЅ.*РєР»СЋС‡|mountain.*climb|90\/90|world.?greatest| Р№РѕРіР°|yoga/i;

/** РџСЂРѕРІРµСЂРёС‚СЊ, СЏРІР»СЏРµС‚СЃСЏ Р»Рё СѓРїСЂР°Р¶РЅРµРЅРёРµ BB-РјСѓСЃРѕСЂРѕРј (РЅРµ РґР»СЏ РіРёРїРµСЂС‚СЂРѕС„РёРё). */
function isBBJunk(ex: any): boolean {
  const n = (ex.name || '').toLowerCase();
  const id = (ex.id || '').toLowerCase();
  // Weighted push-ups вЂ” РІР°Р»РёРґРЅРѕРµ Р‘Р‘-СѓРїСЂР°Р¶РЅРµРЅРёРµ (РЅРµ РјСѓСЃРѕСЂ), РґР°Р¶Рµ РµСЃР»Рё СЃРѕРґРµСЂР¶РёС‚ pushup
  if (/РѕС‚Р¶РёРјР°РЅ.*(?:РІРµСЃ|РѕС‚СЏРіРѕС‰|РїРѕСЏСЃ|Р±Р»РёРЅ|weight|belt)/i.test(n) || /push.?up.*(?:weight|РІРµСЃ|belt|РѕС‚СЏРіРѕС‰)/i.test(n) || /weight.*push.?up|РІРµСЃ.*РѕС‚Р¶РёРјР°РЅ/i.test(n)) {
    return false;
  }
  if (BB_JUNK_PATTERNS.test(n) || BB_JUNK_PATTERNS.test(id)) {
    // РСЃРєР»СЋС‡РµРЅРёСЏ: Р±СЂСѓСЃСЊСЏ/dips вЂ” СЌС‚Рѕ Р‘Р‘-СѓРїСЂР°Р¶РЅРµРЅРёСЏ, РЅРµ РѕС‚Р¶РёРјР°РЅРёСЏ
    if (/Р±СЂСѓСЃ|dip/.test(n) && !/РѕС‚Р¶РёРј.*РѕС‚ РїРѕР»|narrow|Р°Р»РјР°Р·/i.test(n)) return false;
    // РћР±СЂР°С‚РЅС‹Рµ РѕС‚Р¶РёРјР°РЅРёСЏ РѕС‚ СЃРєР°РјСЊРё = bench dips (С‚СЂРёС†РµРїСЃ) вЂ” РѕРє РґР»СЏ Р‘Р‘
    if (/РѕР±СЂР°С‚РЅ.*РѕС‚Р¶РёРј|bench.*dip/i.test(n)) return false;
    return true;
  }
  // РР·РѕРјРµС‚СЂРёС‡РµСЃРєРёРµ РїР»Р°РЅРєРё/СѓРіРѕР»РєРё вЂ” РЅРµ РґР»СЏ РіРёРїРµСЂС‚СЂРѕС„РёРё (РЅРѕ РїРѕРґСЉС‘Рј РЅРѕРі РІ РІРёСЃРµ вЂ” OK РґР»СЏ abs)
  if (/РїР»Р°РЅРє|plank|СѓРіРѕР»РѕРє|l[\s_-]?sit|hollow.?hold|Р»РѕРґРѕС‡Рє|boat/.test(n) && !/РїРѕРґСЉС‘Рј РЅРѕРі|leg.?raise|СЃРєСЂСѓС‡РёРІР°РЅ|crunch|РїСЂРµСЃСЃ.*РјР°С€Рё|РїР°СѓРє/.test(n)) return true;
  return false;
}

/** PRO: Biomechanics-based filtering вЂ” РёСЃРєР»СЋС‡РёС‚СЊ СѓРїСЂР°Р¶РЅРµРЅРёСЏ РїРѕ РѕРіСЂР°РЅРёС‡РµРЅРёСЏРј РјРѕР±РёР»СЊРЅРѕСЃС‚Рё.
 *  Р•РґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє вЂ” bb-mobility.engine.ts (РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ Рё bb-finalize).
 *  Р РµСЌРєСЃРїРѕСЂС‚ РґР»СЏ РѕР±СЂР°С‚РЅРѕР№ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё (cycle-to-plan.ts). */
export { MOBILITY_PATTERNS, isMobilityRestricted } from './bb-mobility.engine';
/** РњР°РїРїРёРЅРі PRO-РјС‹С€С† РІ group РєР°С‚Р°Р»РѕРіР° РґР»СЏ getExercisesByGroup(). */
const PRO_MUSCLE_TO_GROUP: Record<string, string> = {
  delt_front: 'shoulders', delt_mid: 'shoulders', delt_rear: 'shoulders',
  traps: 'back', calves: 'legs', glutes: 'legs', abs: 'core', forearms: 'arms',
  quads: 'legs', hamstrings: 'legs', biceps: 'arms', triceps: 'arms',
  chest: 'chest', back: 'back', shoulders: 'shoulders', legs: 'legs',
  arms: 'arms', core: 'core',
};
function catalogGroupFor(muscle: string): string {
  return PRO_MUSCLE_TO_GROUP[muscle] || muscle;
}
/** Р РѕРґРёС‚РµР»СЊСЃРєРёРµ РјС‹С€С†С‹: delt_front в†’ shoulders (РґР»СЏ weakPoints-РѕР±СЂР°С‚РЅРѕР№ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё). */
const PARENT_MUSCLE: Record<string, string> = {
  delt_front: 'shoulders', delt_mid: 'shoulders', delt_rear: 'shoulders',
};
/** РџСЂРѕРІРµСЂРёС‚СЊ, СЏРІР»СЏРµС‚СЃСЏ Р»Рё РјС‹С€С†Р° СЃР»Р°Р±РѕР№ (СЃ СѓС‡С‘С‚РѕРј РіСЂР°РЅСѓР»СЏСЂРЅС‹С… РіСЂСѓРїРї).
 *  P0-3 (audit 2026-08): СЌРєСЃРїРѕСЂС‚РёСЂРѕРІР°РЅ РґР»СЏ РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ РІ cycle-to-plan / bb-weakpoint / bb-selector.
 *  РџРѕРґРґРµСЂР¶РёРІР°РµС‚ РјР°РїРїРёРЅРі: chest_upper в†’ chest, back_width в†’ back, delt_mid в†’ shoulders. */
export function isWeak(muscle: string, weakPoints: string[]): boolean {
  if (weakPoints.includes(muscle)) return true;
  // Р“СЂР°РЅСѓР»СЏСЂРЅС‹Рµ: delt_mid в†’ shoulders, chest_upper в†’ chest, back_width в†’ back
  const parent = WEAK_TO_MUSCLE[muscle];
  if (parent && weakPoints.includes(parent)) return true;
  // РћР±СЂР°С‚РЅРѕРµ: shoulders weak в†’ delt_front/mid/rear С‚РѕР¶Рµ weak
  for (const wp of weakPoints) {
    const wpParent = WEAK_TO_MUSCLE[wp];
    if (wpParent === muscle) return true;
  }
  return weakPoints.includes(PARENT_MUSCLE[muscle] ?? '');
}
function musclesForTag(tag?: string): string[] {
  if (!tag) return [];
  if (TAG_MUSCLES[tag]) return TAG_MUSCLES[tag];
  return [];
}
/** fix Z: РєР»СЋС‡ РєРѕР»Р»Р°РїСЃР° РґР»СЏ РґРµРґСѓРїР»РёРєР°С†РёРё.
 *  P0-2 (audit 2026-08): РіСЂР°РЅСѓР»СЏСЂРЅС‹Рµ СЃР»Р°Р±С‹Рµ РіСЂСѓРїРїС‹ (chest_upper, chest_lower,
 *  back_width, back_thickness) РєРѕР»Р»Р°РїСЃРёСЂСѓСЋС‚СЃСЏ Рє РєР°РЅРѕРЅРёС‡РµСЃРєРѕР№ РјС‹С€С†Рµ, С‡С‚РѕР±С‹
 *  landmarksForRotation РЅР°С€С‘Р» Р·Р°РїРёСЃСЊ Рё РѕР±СЉС‘Рј РїР»Р°РЅРёСЂРѕРІР°Р»СЃСЏ РєРѕСЂСЂРµРєС‚РЅРѕ.
 *  Р’РђР–РќРћ РґР»СЏ PPL: delt_front/mid/rear вЂ” С‚СЂРё РїСѓС‡РєР° РїР»РµС‡ РёРґСѓС‚ СЂР°Р·РґРµР»СЊРЅРѕ:
 *  Push в†’ РїРµСЂРµРґРЅСЏСЏ+СЃСЂРµРґРЅСЏСЏ, Pull в†’ Р·Р°РґРЅСЏСЏ. Р”Р»СЏ PPL РЅРµ СЃС…Р»РѕРїС‹РІР°РµРј РёС… РІ shoulders,
 *  СЃС‡РёС‚Р°РµРј РєР°Р¶РґС‹Р№ РїСѓС‡РѕРє РѕС‚РґРµР»СЊРЅРѕ (2Г—/РЅРµРґ РєР°Р¶РґС‹Р№), РёРЅР°С‡Рµ shoulders 4Г— РІРјРµСЃС‚Рѕ 2+2. */
function collapseKey(muscle: string): string {
  // Р”Р»СЏ PPL Рё РІРѕРѕР±С‰Рµ вЂ” РґРµР»СЊС‚РѕРІРёРґРЅС‹Рµ РїСѓС‡РєРё СЃС‡РёС‚Р°РµРј РѕС‚РґРµР»СЊРЅРѕ, Сѓ РЅРёС… СЃРІРѕРё landmarks Рё С‡Р°СЃС‚РѕС‚Р°
  if (muscle === 'delt_front' || muscle === 'delt_mid' || muscle === 'delt_rear') return muscle;
  // P0-2: РіСЂР°РЅСѓР»СЏСЂРЅС‹Рµ РіСЂСѓРїРїС‹ в†’ РєР°РЅРѕРЅРёС‡РµСЃРєРёРµ РјС‹С€С†С‹
  const canonical = WEAK_TO_MUSCLE[muscle];
  if (canonical && canonical !== muscle) return canonical;
  return muscle;
}
/** fix Z: РґРµРґСѓРїР»РёС†РёСЂСѓРµС‚ PRO-РєР»СЋС‡Рё С‚РµРіР° РїРѕ collapseKey.
 *  Р’РѕР·РІСЂР°С‰Р°РµС‚ {group, repKey}: group = collapseKey (РєР»СЋС‡ РґР»СЏ volumeRotation/output),
 *  repKey = РїРµСЂРІС‹Р№ PRO-РєР»СЋС‡ РіСЂСѓРїРїС‹ (РґР»СЏ workMax/FORCE_HEAVY.pool). */
interface MuscleGroupPlan { group: string; repKey: string; }
function dedupeMuscles(tag: string | undefined, excluded: Set<string>, focusGroup?: string, allowFocusInjection = true): MuscleGroupPlan[] {
  const out: MuscleGroupPlan[] = [];
  const seen = new Set<string>();
  const muscles = [...musclesForTag(tag)];
  // FIX-A4: РµСЃР»Рё focusGroup Р·Р°РґР°РЅ Рё РµРіРѕ РЅРµС‚ РІ СЃРїРёСЃРєРµ РјС‹С€С† С‚РµРіР° вЂ” РґРѕР±Р°РІРёС‚СЊ.
  // Р­С‚Рѕ РіР°СЂР°РЅС‚РёСЂСѓРµС‚ С‡С‚Рѕ РјС‹С€С†Р° СЃРїРµС†РёР°Р»РёР·Р°С†РёРё (РЅР°РїСЂРёРјРµСЂ glutes РІ FullBody) РїРѕР»СѓС‡РёС‚ СѓРїСЂР°Р¶РЅРµРЅРёСЏ.
  if (allowFocusInjection && focusGroup && !muscles.includes(focusGroup) && !excluded.has(focusGroup)) {
    muscles.push(focusGroup);
  }
  for (const m of muscles) {
    if (excluded.has(m) || excluded.has(collapseKey(m))) continue;
    const ck = collapseKey(m);
    if (seen.has(ck)) continue;
    seen.add(ck);
    out.push({ group: ck, repKey: m });
  }
  return out;
}

// РљРѕСЌС„С„РёС†РёРµРЅС‚С‹ workMax РґР»СЏ PRO-РјС‹С€С† (% РѕС‚ СЂРѕРґРёС‚РµР»СЊСЃРєРѕР№ РіСЂСѓРїРїС‹)
const PRO_WORKMAX_RATIO: Record<string, (wm: Record<string, number>) => number> = {
  delt_front: wm => (wm['shoulders'] || DEFAULT_WORKMAX['shoulders']) * 0.50,
  delt_mid:   wm => (wm['shoulders'] || DEFAULT_WORKMAX['shoulders']) * 0.45,
  delt_rear:  wm => (wm['shoulders'] || DEFAULT_WORKMAX['shoulders']) * 0.35,
  traps:      wm => (wm['back'] || 100) * 0.55,
  forearms:   wm => (wm['arms'] || wm['biceps'] || 60) * 0.45,
  abs:        wm => wm['core'] || 40,
};

/**
 * P1-4 (audit 2026-07): Brzycki inverse %1RM formula.
 * weight = 1RM Г— (1.0278 в€’ 0.0278 Г— reps)
 * Р‘РѕР»РµРµ СЂРµРї-РєРѕСЂСЂРµРєС‚РЅР°СЏ, С‡РµРј PCT_FOR_RIR[rir] (РєРѕС‚РѕСЂР°СЏ РґР°С‘С‚ ~80% РґР»СЏ RIR 3,
 * РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ target reps). Р”Р»СЏ 18 reps в†’ ~52% (СЂРµР°Р»РёСЃС‚РёС‡РЅРѕ РґР»СЏ РїР°РјРї),
 * РґР»СЏ 6 reps в†’ ~86% (С‚СЏР¶), РґР»СЏ 10 reps в†’ ~75%.
 * RIR-РєРѕСЂСЂРµРєС†РёСЏ: +1 RIR в‰€ в€’2.5% РІРµСЃР° (С‡РµСЂРµР· РјРЅРѕР¶РёС‚РµР»СЊ rirAdj).
 */
export function weightForRepMax(reps: number, workMax: number, rir: number, intensityMult: number): number {
  // Brzycki: 1RM = weight / (1.0278 в€’ 0.0278 Г— reps) в†’ weight = 1RM Г— (1.0278 в€’ 0.0278 Г— reps)
  const brzycki = Math.max(0.4, Math.min(1.0, 1.0278 - 0.0278 * reps));
  // RIR-РєРѕСЂСЂРµРєС†РёСЏ: RIR 0 = 100% Р±rzycki, RIR 4 = ~90% (в€’2.5% Р·Р° РєР°Р¶РґС‹Р№ RIR)
  const rirAdj = Math.max(0.7, 1 - rir * 0.025);
  return Math.round(workMax * brzycki * rirAdj * intensityMult * 10) / 10;
}

/**
 * Р¤Р°Р·Р° 1.4: С‚РѕРї-СЃРµС‚ + back-off СЃРµС‚С‹.
 * РџСЂРѕ-РїСЂР°РєС‚РёРєР° вЂ” РїРµСЂРІС‹Р№ (С‚РѕРї) СЃРµС‚ СѓРїСЂР°Р¶РЅРµРЅРёСЏ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ СЃ Р±Р°Р·РѕРІС‹Рј РІРµСЃРѕРј (С†РµР»РµРІРѕР№ RIR),
 * РїРѕСЃР»РµРґСѓСЋС‰РёРµ СЃРµС‚С‹ вЂ” СЃ в€’10вЂ“15% (back-off), С‡С‚РѕР±С‹ РЅР°РєРѕРїРёС‚СЊ РѕР±СЉС‘Рј Р±РµР· РїРѕС‚РµСЂРё С‚РµС…РЅРёРєРё/РѕС‚РєР°Р·Р°.
 * РџСЂРёРјРµРЅСЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ Рє primary-СѓРїСЂР°Р¶РЅРµРЅРёСЏРј РЅР° С‚СЏР¶-РґРЅСЏС… (РќР• deload), СЃ в‰Ґ2 СЃРµС‚Р°РјРё.
 * РњР°С€РёРЅС‹/РєР°Р±РµР»Рё РґРµСЂР¶Р°С‚ РјРµРЅСЊС€Рµ СЃРЅРёР¶РµРЅРёРµ, С‡РµРј СЃРІРѕР±РѕРґРЅС‹Рµ РІРµСЃР° (СЃС‚Р°Р±РёР»СЊРЅР°СЏ С‚СЂР°РµРєС‚РѕСЂРёСЏ).
 */
export function backoffWeights(baseWeight: number, setCount: number, isCompound: boolean, isDeload: boolean, character: string): number[] {
  const n = Math.max(1, setCount);
  if (isDeload || n < 2 || character !== 'С‚СЏР¶') return Array.from({ length: n }, () => baseWeight);
  const drop = isCompound ? 0.10 : 0.075; // compound в€’10%, РёР·РѕР»СЏС†РёСЏ в€’7.5%
  return Array.from({ length: n }, (_, i) => (i === 0 ? baseWeight : Math.round(baseWeight * (1 - drop) * 10) / 10));
}

/**
 * RIR СѓРїСЂР°Р¶РЅРµРЅРёСЏ РІ Р‘Р‘-РїР»Р°РЅРµ = С„Р°Р·Р° + С…Р°СЂР°РєС‚РµСЂ РґРЅСЏ + training focus.
 * strength: RIR 1-2 (Schoenfeld 2021), hypertrophy: RIR 2-3 (Roberts 2022), endurance: RIR 3-4.
 * РџР°РјРї РІСЃРµРіРґР° в‰Ґ3 (Schoenfeld 2017: metabolic stress, РЅРµ failure).
 * + PED-РґСЂРёС„С‚: enhanced (-1.5) Р±С‹СЃС‚СЂРµРµ Рє РѕС‚РєР°Р·Сѓ, GH solo (-0.5) РјРµРґР»РµРЅРЅРµРµ (СЃСѓСЃС‚Р°РІС‹).
 */
export function bbRir(resolved: DayCharacter, phase: BBPhase, phaseWeek: number, focus?: BBTrainingFocus, pedDoses?: Record<string, number>, level?: string): number {
  const cfg = focus ? FOCUS_RIR_TABLE[focus] : FOCUS_RIR_TABLE.hypertrophy;
  // Phase adjustment: intensification/peaking в†’ base-1, deload в†’ forced 4
  let base = cfg.base;
  if (phase === 'deload') base = 4;
  else if (phase === 'intensification') base = Math.max(0, base - 1);
  // B1: peaking РќР• СЃРЅРёР¶Р°РµС‚ base РЅР° 1 вЂ” РїСѓСЃС‚СЊ drift РµСЃС‚РµСЃС‚РІРµРЅРЅС‹Рј РѕР±СЂР°Р·РѕРј РґРѕРІРѕРґРёС‚ RIR
  // РґРѕ 0 Рє РєРѕРЅС†Сѓ РїРёРєР°. Р Р°РЅРµРµ base-1 РґР°РІР°Р»Рѕ RIR=0 РґР»СЏ Р’РЎР•РҐ РЅРµРґРµР»СЊ peaking (3 РЅРµРґРµР»Рё
  // РЅР° failure вЂ” РЅР°СЂСѓС€Р°РµС‚ supercompensation, Zatsiorsky 2006). РўРµРїРµСЂСЊ:
  // strength base=1: W1=1, W2=0, W3=0 (1 СЃСѓР±РјР°РєСЃ. РЅРµРґРµР»СЏ РїРµСЂРµРґ РїРёРєРѕРј).
  // hypertrophy base=2: W1=2, W2=1, W3=1 (РјСЏРіРєРёР№ РїРёРє).
  // Per-week RIR drift: driftPer2Weeks applies every 2 weeks of the SAME phase.
  // strength/hypertrophy: drift=-1 в†’ RIR drops 1 every 2 weeks (W1=base, W2=base-1, W3=base-1, W4=base-2).
  // endurance: drift=0 в†’ RIR stays constant (metabolic focus, no neural peaking).
  // PED-РґСЂРёС„С‚: enhanced (-1.5) Р±С‹СЃС‚СЂРµРµ, GH solo (-0.5) РјРµРґР»РµРЅРЅРµРµ.
  let driftPer2 = cfg.driftPer2Weeks;
  if (pedDoses) {
    const aas = Number((pedDoses as any)['AAS'] || 0);
    const gh = Number((pedDoses as any)['GH'] || 0);
    const hasAAS = aas >= 500;
    const hasGH = gh >= 2;
    const isEnhanced = level === 'enhanced' || hasAAS;
    if (isEnhanced && driftPer2 === -1) driftPer2 = -1.5;
    else if (hasGH && !hasAAS && driftPer2 === -1) driftPer2 = -0.5;
  }
  const drift = Math.floor(phaseWeek / 2);
  const driftable = Math.max(0, base + driftPer2 * drift);
  let rir = resolved === 'С‚СЏР¶' ? driftable : driftable + 1;
  if (phase === 'deload') rir = Math.max(3, Math.min(4, rir));
  if (resolved === 'РїР°РјРї') rir = Math.max(cfg.pumpRir, rir);
  return clampRir(rir);
}

/** Р“СЂСѓРїРїС‹, РїРѕР»СѓС‡Р°СЋС‰РёРµ 2 РёР·РѕР»РёСЂСѓСЋС‰РёС… СѓРїСЂР°Р¶РЅРµРЅРёСЏ (Р°РєС†РµРЅС‚ РґРµС‚Р°Р»РёР·Р°С†РёРё) вЂ” fix B.
 *  РџРѕРєСЂС‹РІР°РµРј Рё PRO-РєР»СЋС‡Рё (delt_front/bicepsвЂ¦), Рё group-РєР»СЋС‡Рё (shoulders/armsвЂ¦),
 *  РїРѕСЃРєРѕР»СЊРєСѓ РІ РїР»Р°РЅРµ РјРѕРіСѓС‚ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊСЃСЏ РѕР±Р° РІРёРґР°. */
const ACCESSORY_2X_GROUPS = new Set<string>([
  'delt_front', 'delt_mid', 'delt_rear', 'biceps', 'triceps', 'forearms',
  'shoulders', 'arms', 'calves', 'abs',
]);
/**
 * Р”РѕР»СЏ РѕР±СЉС‘РјР° РјС‹С€С†С‹ РЅР° РћР”РќРЈ СЃРµСЃСЃРёСЋ (fix C + P5):
 * - 1 СЃРµСЃСЃРёСЏ/РЅРµРґ в†’ РІСЃСЏ С†РµР»СЊ РЅР° СЌС‚Сѓ СЃРµСЃСЃРёСЋ, РЅРѕ cap MAVГ—1.3 (Р°РЅС‚Рё-РїРµСЂРµС‚СЂРµРЅ).
 *   Р Р°РЅСЊС€Рµ: 1.5Г— MAV в†’ РґР»СЏ chest=21 СЃРµС‚/РґРµРЅСЊ, С‡С‚Рѕ РІ 1.5 СЂР°Р·Р° РІС‹С€Рµ РЅРѕСЂРјС‹ РґР»СЏ 1Г—/РЅРµРґ РіСЂСѓРїРїС‹.
 *   Schoenfeld BJ et al. (2016, J Sports Sci): 1Г—/РЅРµРґ chest 12-16 СЃРµС‚РѕРІ РѕРїС‚РёРјСѓРј, >20 вЂ” РЅРµС‚ РґР°РЅРЅС‹С….
 * - 2 СЃРµСЃСЃРёРё/РЅРµРґ в†’ primary 1.4Г—, accessory 0.6Г— (СЃР±Р°Р»Р°РЅСЃРёСЂРѕРІР°РЅРѕ).
 * - в‰Ґ3 СЃРµСЃСЃРёРё/РЅРµРґ в†’ primary 1.5Г—, accessory 0.75Г— (compound С‰РµРґСЂРѕ, РёР·РѕР»СЏС†РёСЏ 3-4Г—N).
 * РС‚РѕРіРѕРІС‹Р№ РЅРµРґРµР»СЊРЅС‹Р№ РѕР±СЉС‘Рј РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ РєР°РїР°РµС‚СЃСЏ РїРѕ MRV РІ normalizeWeekMrv.
 */
function sessionShareFor(mavRot: number, sessionsPerWeek: number, role: 'primary' | 'accessory', muscle?: string, pedAdapt?: PEDAdaptation, isFemale?: boolean): number {
  // PED boost РґР»СЏ accessory arms/shoulders вЂ” РЅР° РєСѓСЂСЃРµ РЅСѓР¶РµРЅ Р±РѕР»СЊС€РёР№ РѕР±СЉС‘Рј
  const pedArmBoost = pedAdapt && pedAdapt.combinedMrvMultiplier >= 1.3 && muscle && ['triceps', 'biceps', 'shoulders', 'forearms'].includes(muscle) ? 1.4 : 1.0;
  // Glute boost РґР»СЏ Р¶РµРЅС‰РёРЅ: glutes РїРѕР»СѓС‡Р°СЋС‚ +20% РѕР±СЉС‘РјР° (Р¶РµРЅСЃРєР°СЏ С„РёР·РёРѕР»РѕРіРёСЏ вЂ” Р±РѕР»СЊС€РёР№ РіРёРїРµСЂС‚СЂРѕС„РёС‡РµСЃРєРёР№ РїРѕС‚РµРЅС†РёР°Р» СЏРіРѕРґРёС‡РЅС‹С…).
  const gluteBoost = isFemale && muscle === 'glutes' ? 1.2 : 1.0;
  const finalMult = pedArmBoost * gluteBoost;
  // P0-1: arms (biceps/triceps/forearms) вЂ” accessory factor РїРѕРІС‹С€РµРЅ СЃ 0.6 РґРѕ 0.85.
  // Р Р°РЅСЊС€Рµ: biceps MAV=8, 2Г—/РЅРµРґ в†’ 8/2Г—0.6=2.4 в†’ 2 СЃРµС‚Р°/СЃРµСЃСЃРёСЋ в†’ 1 СЃРµС‚ РЅР° СѓРїСЂР°Р¶РЅРµРЅРёРµ (СЂР°Р·РјРёРЅРєР°!).
  // Schoenfeld 2016: РјРёРЅРёРјСѓРј 2-3 СЂР°Р±РѕС‡РёС… СЃРµС‚Р° РЅР° СѓРїСЂР°Р¶РЅРµРЅРёРµ, 8-12 СЃРµС‚РѕРІ/РЅРµРґ РЅР° РјС‹С€С†Сѓ.
  // Arms вЂ” РјР°Р»С‹Рµ РјС‹С€С†С‹, РЅРѕ С‚СЂРµР±СѓСЋС‚ dedicated РѕР±СЉС‘РјР°, Р° РЅРµ РѕСЃС‚Р°С‚РѕС‡РЅРѕРіРѕ (РєР°Рє РіСЂСѓРґРЅС‹Рµflyes).
  const isArmMuscle = muscle === 'biceps' || muscle === 'triceps' || muscle === 'forearms';
  if (sessionsPerWeek <= 1) {
    // P5 + BUG-B2: cap РЅР° 1Г—/РЅРµРґ вЂ” Schoenfeld 2016 РѕРїС‚РёРјСѓРј 12-16 СЃРµС‚РѕРІ/РґРµРЅСЊ РґР»СЏ advanced.
    const gluteFactor = isFemale && muscle === 'glutes' ? 1.4 : 1.0;
    if (role === 'accessory') {
      const accFactor = isArmMuscle ? 0.7 : 0.5;
      return Math.max(3, Math.min(Math.round(mavRot * accFactor * gluteFactor), 8));
    }
    return Math.min(Math.round(mavRot * 1.0 * gluteFactor), 16);
  }
  if (sessionsPerWeek === 2) {
    const base = mavRot / 2;
    const factor = role === 'primary' ? 1.4 : (isArmMuscle ? 0.85 : 0.6);
    return Math.max(isArmMuscle ? 3 : 1, Math.round(base * factor * finalMult));
  }
  // 3+ СЃРµСЃСЃРёРё/РЅРµРґ вЂ” Schoenfeld 2016: РїСЂРё РІС‹СЃРѕРєРѕР№ С‡Р°СЃС‚РѕС‚Рµ РєР°Р¶РґС‹Р№ РїРѕРґС…РѕРґ С†РµРЅРЅРµРµ
  // (frequency bonus), РїРѕСЌС‚РѕРјСѓ РЅР° СЃРµСЃСЃРёСЋ РЅСѓР¶РЅРѕ РњР•РќР¬РЁР• РѕР±СЉС‘РјР°, С‡РµРј РїСЂРё 2Г—/РЅРµРґ.
  // Р Р°РЅСЊС€Рµ: primary factor=1.5 (>1.4 РїСЂРё 2Г—/РЅРµРґ) в†’ 3Г—/РЅРµРґ РґР°РІР°Р»Рѕ Р‘РћР›Р¬РЁР• РЅР° СЃРµСЃСЃРёСЋ.
  // РўРµРїРµСЂСЊ: factor=1.2 (<1.4) вЂ” РѕС‚СЂР°Р¶Р°РµС‚ СЂР°СЃРїСЂРµРґРµР»РµРЅРёРµ MAV РЅР° Р±РѕР»СЊС€Рµ СЃРµСЃСЃРёР№.
  const base = mavRot / sessionsPerWeek;
  const factor = role === 'primary' ? 1.2 : (isArmMuscle ? 0.85 : 0.65);
  return Math.max(isArmMuscle ? 2 : 1, Math.round(base * factor * finalMult));
}

/** fix D: РЅРµРґРµР»СЊРЅС‹Р№ РєР°Рї РѕР±СЉС‘РјР° РєР°Р¶РґРѕР№ РјС‹С€С†С‹ РїРѕ РµС‘ РёСЃС‚РёРЅРЅРѕРјСѓ MRV (РїРѕСЃР»Рµ РІСЃРµС… РјРЅРѕР¶РёС‚РµР»РµР№).
 *  + per-exercise РєР°Рї: РјР°РєСЃРёРјСѓРј 8 СЃРµС‚РѕРІ РЅР° СѓРїСЂР°Р¶РЅРµРЅРёРµ (Р‘Р‘-РїСЂР°РєС‚РёРєР°).
 *  C6: isDeload вЂ” РІРѕ РІСЂРµРјСЏ deload floor=2 РќР• РїСЂРёРјРµРЅСЏРµС‚СЃСЏ (4 СѓРїСЂ Г— 2 = 8 СЃРµС‚РѕРІ
 *  РЅР°СЂСѓС€Р°РµС‚ intended deload ~4-6 СЃРµС‚РѕРІ). floor=1 РґР»СЏ deload, floor=2 РґР»СЏ СЂР°Р±РѕС‡РёС… РЅРµРґРµР»СЊ. */
export function normalizeWeekMrv(weekSessions: BBSession[], mrvByMuscle: Record<string, number>, isDeload: boolean = false, opts?: { level?: string; trainingYears?: number }): void {
  const syncWorkSets = (ex: BBExercise): void => {
    const target = Math.max(0, ex.sets || 0);
    const current = Array.isArray(ex.workSets) ? ex.workSets : [];
    if (current.length > target) {
      ex.workSets = current.slice(0, target);
    } else if (current.length < target && current.length > 0) {
      const template = current[current.length - 1];
      ex.workSets = [...current, ...Array.from({ length: target - current.length }, () => ({ ...template }))];
    }
  };
  const sums: Record<string, { total: number; exs: BBExercise[] }> = {};
  for (const s of weekSessions) {
    for (const ex of s.exercises) {
      // Р Р°Р·РјРёРЅРѕС‡РЅРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ РЅРµ СѓС‡Р°СЃС‚РІСѓРµС‚ РІ MRV-РєР°РїР°С… Рё РѕР±СЉС‘РјРµ.
      if ((ex as any).warmupActivator) continue;
      const info = sums[ex.muscle] || (sums[ex.muscle] = { total: 0, exs: [] });
      info.total += ex.sets;
      info.exs.push(ex);
    }
  }
  for (const [m, info] of Object.entries(sums)) {
    // Per-exercise cap: РµРґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє perExerciseCap (8 РґР»СЏ enhanced 3+ back/chest/quads, РёРЅР°С‡Рµ 5)
    // BUG-B8: РґР»СЏ РјР°Р»С‹С… РјС‹С€С† (forearms/calves/abs) cap = 6 вЂ” РѕРЅРё РЅРµ С‚СЂРµР±СѓСЋС‚
    // Р±РѕР»СЊС€РѕРіРѕ РѕР±СЉС‘РјР° Р·Р° РѕРґРЅРѕ СѓРїСЂР°Р¶РЅРµРЅРёРµ (Schoenfeld: small muscles 4-6 СЃРµС‚РѕРІ/СѓРїСЂ).
    // P1-4: per-exercise FLOOR вЂ” РјРёРЅРёРјСѓРј 2 СЃРµС‚Р° (1 СЃРµС‚ = СЂР°Р·РјРёРЅРєР°, РЅРµ СЂР°Р±РѕС‡РёР№ РѕР±СЉС‘Рј).
    const perExCapFor = (muscle: string) => (opts?.level ? perExerciseCap(opts.level, muscle, opts.trainingYears) : 5);
    const floor = isDeload ? 1 : 2; // C6: deload floor=1, СЂР°Р±РѕС‡Р°СЏ РЅРµРґРµР»СЏ floor=2
    for (const ex of info.exs) {
      const cap = perExCapFor(ex.muscle);
      if (ex.sets > cap) ex.sets = cap;
      if (ex.sets < floor) ex.sets = floor;
      syncWorkSets(ex);
    }
    // РџРµСЂРµСЃС‡РёС‚Р°С‚СЊ total РїРѕСЃР»Рµ per-exercise РєР°РїР°
    info.total = info.exs.reduce((s, ex) => s + ex.sets, 0);
    // MRV-РєР°Рї
    const cap = mrvByMuscle[m];
    if (cap && info.total > cap) {
      // D2: Per-day volume budget with redistribution.
      // Р•СЃР»Рё РґР°Р¶Рµ РїСЂРё floor=2 РґР»СЏ РІСЃРµС… СѓРїСЂР°Р¶РЅРµРЅРёР№ СЃСѓРјРјР° > cap, СѓРґР°Р»РёС‚СЊ РїРѕСЃР»РµРґРЅРёРµ
      // (accessory/РїР°РјРї) СѓРїСЂР°Р¶РЅРµРЅРёСЏ С†РµР»РёРєРѕРј, Р° РЅРµ СЂРµР·Р°С‚СЊ РґРѕ 1 СЃРµС‚Р°.
      // Р­С‚Рѕ РґР°С‘С‚ С‡РёСЃС‚С‹Р№ РїР»Р°РЅ Р±РµР· 1-set "СЂР°Р·РјРёРЅРѕС‡РЅС‹С…" СѓРїСЂР°Р¶РЅРµРЅРёР№.
      const minTotal = info.exs.length * floor; // C6: deload floor=1, РёРЅР°С‡Рµ 2
      if (minTotal > cap) {
        // РЈРґР°Р»РёС‚СЊ РїРѕСЃР»РµРґРЅРёРµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ РїРѕРєР° sum(floor Г— remaining) <= cap
        // РЎРѕСЂС‚РёСЂСѓРµРј: primary РїРµСЂРІС‹РјРё (accessory СѓРґР°Р»СЏРµРј СЂР°РЅСЊС€Рµ).
        // BUG-FIX: РґРѕР±Р°РІР»РµРЅР° РІС‚РѕСЂРёС‡РЅР°СЏ СЃРѕСЂС‚РёСЂРѕРІРєР° РїРѕ strengthRank вЂ” compound
        // СѓРїСЂР°Р¶РЅРµРЅРёСЏ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ СЂР°РЅСЊС€Рµ isolation (compound РґР°С‘С‚ Р±РѕР»СЊС€Рµ РіРёРїРµСЂС‚СЂРѕС„РёРё).
        const sortedExs = [...info.exs].sort((a, b) => {
          if (a.role === 'primary' && b.role !== 'primary') return -1;
          if (a.role !== 'primary' && b.role === 'primary') return 1;
          // РћРґРёРЅР°РєРѕРІР°СЏ СЂРѕР»СЊ в†’ compound СЂР°РЅСЊС€Рµ isolation (РјРµРЅСЊС€РёР№ rank = С‚СЏР¶РµР»РµРµ = СЃРѕС…СЂР°РЅСЏРµРј)
          return strengthRank(a) - strengthRank(b);
        });
        const toRemove: BBExercise[] = [];
        let keptCount = info.exs.length;
        // BUG-FIX: РіР°СЂР°РЅС‚РёСЂРѕРІР°С‚СЊ РјРёРЅРёРјСѓРј 1 СѓРїСЂР°Р¶РЅРµРЅРёРµ (floor СЃРµС‚РѕРІ) РґР°Р¶Рµ РµСЃР»Рё cap < floor.
        // Р Р°РЅСЊС€Рµ РїСЂРё cap=0 РёР»Рё cap=1 СѓРґР°Р»СЏР»РёСЃСЊ Р’РЎР• СѓРїСЂР°Р¶РЅРµРЅРёСЏ в†’ РјС‹С€С†Р° Р±РµР· РѕР±СЉС‘РјР°.
        while (keptCount * floor > cap && keptCount > 1) {
          const removed = sortedExs.pop()!;
          toRemove.push(removed);
          keptCount--;
        }
        // РЈРґР°Р»РёС‚СЊ РёР· СЃРµСЃСЃРёР№
        for (const ex of toRemove) {
          for (const s of weekSessions) {
            const idx = s.exercises.indexOf(ex);
            if (idx >= 0) {
              s.exercises.splice(idx, 1);
              // D2: explicit rationale вЂ” РїРѕС‡РµРјСѓ СѓРїСЂР°Р¶РЅРµРЅРёРµ СѓРґР°Р»РµРЅРѕ
              if (!ex.comment) ex.comment = '';
              ex.comment += ` | вљ  РСЃРєР»СЋС‡РµРЅРѕ: MRV=${cap} СЃРµС‚РѕРІ/РЅРµРґ РґР»СЏ ${m} РґРѕСЃС‚РёРіРЅСѓС‚. РЈРїСЂР°Р¶РЅРµРЅРёРµ СѓРґР°Р»РµРЅРѕ РґР»СЏ СЃРѕР±Р»СЋРґРµРЅРёСЏ Р±СЋРґР¶РµС‚Р° РѕР±СЉС‘РјР°.`;
            }
          }
        }
        // РџРµСЂРµСЃС‡РёС‚Р°С‚СЊ РґР»СЏ РѕСЃС‚Р°РІС€РёС…СЃСЏ
        info.exs = info.exs.filter(e => !toRemove.includes(e));
        info.total = info.exs.reduce((s, ex) => s + ex.sets, 0);
        if (info.total <= cap) continue; // СѓР¶Рµ РІ РЅРѕСЂРјРµ
      }
      // P0-2: РїСЂРѕРїРѕСЂС†РёРѕРЅР°Р»СЊРЅРѕРµ СЂР°СЃРїСЂРµРґРµР»РµРЅРёРµ СЃ РѕСЃС‚Р°С‚РєРѕРј (round СЃСЉРµРґР°РµС‚ РєР°Рї).
      // Р Р°РЅСЊС€Рµ: factor=24/26=0.923, round(4Г—0.923)=round(3.69)=4 в†’ РЅРёС‡РµРіРѕ РЅРµ РёР·РјРµРЅРёР»РѕСЃСЊ.
      // РўРµРїРµСЂСЊ: floor РґР»СЏ Р±РѕР»СЊС€РёРЅСЃС‚РІР° + СЂР°СЃРїСЂРµРґРµР»РµРЅРёРµ РѕСЃС‚Р°С‚РєР° РЅР° РїРµСЂРІС‹Рµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ.
      const target = cap;
      const factor = target / info.total;
      let allocated = 0;
      const rawSets = info.exs.map(ex => ex.sets * factor);
      // FIX-A7: floor=2 (РЅРµ 1) вЂ” 1 СЃРµС‚ = СЂР°Р·РјРёРЅРєР°, РЅРµ СЂР°Р±РѕС‡РёР№ РѕР±СЉС‘Рј (Schoenfeld 2016: РјРёРЅРёРјСѓРј 2-3 СЂР°Р±РѕС‡РёС… СЃРµС‚Р°).
      // C6: deload в†’ floor=1 (СЂР°Р·РіСЂСѓР·РєР° РґРѕРїСѓСЃРєР°РµС‚ 1 СЃРµС‚ РЅР° СѓРїСЂР°Р¶РЅРµРЅРёРµ).
      const floored = rawSets.map(v => Math.max(floor, Math.floor(v)));
      allocated = floored.reduce((s, v) => s + v, 0);
      // Р•СЃР»Рё allocated > target (РјР°Р»Рѕ СѓРїСЂР°Р¶РЅРµРЅРёР№, РІСЃРµ в‰Ґfloor), СѓСЂРµР·Р°РµРј РїРѕСЃР»РµРґРЅРёРµ РґРѕ floor.
      let overflow = allocated - target;
      for (let i = info.exs.length - 1; i >= 0 && overflow > 0; i--) {
        const cut = Math.min(overflow, Math.max(0, floored[i] - floor));
        floored[i] -= cut;
        overflow -= cut;
      }
      // Р Р°СЃРїСЂРµРґРµР»РёС‚СЊ РѕСЃС‚Р°С‚РѕРє (target - allocated) РЅР° РїРµСЂРІС‹Рµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ (compound primary РїРµСЂРІС‹РјРё)
      let remainder = target - floored.reduce((s, v) => s + v, 0);
      for (let i = 0; i < info.exs.length && remainder > 0; i++) {
        floored[i]++;
        remainder--;
      }
      for (let i = 0; i < info.exs.length; i++) {
        info.exs[i].sets = Math.max(floor, floored[i]);
        syncWorkSets(info.exs[i]);
      }
    }
  }
}

/** РџСЂРµРґСѓРїСЂРµР¶РґРµРЅРёСЏ Рѕ СЂРёСЃРєР°С… РґР»СЏ РєРѕРЅРєСЂРµС‚РЅС‹С… СѓРїСЂР°Р¶РЅРµРЅРёР№. */
function exerciseRiskWarning(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('СЃС‚Р°РЅРѕРІР°СЏ') || n.includes('РјС‘СЂС‚РІР°СЏ') || n.includes('РјРµСЂС‚РІР°СЏ'))
    return 'вљ  РџРѕСЏСЃРЅРёС†Р°: СЃС‚СЂРѕРіР°СЏ С‚РµС…РЅРёРєР°, РЅРµ РєСЂСѓРіР»РёС‚СЊ СЃРїРёРЅСѓ. РџСЂРё Р±РѕР»Рё вЂ” Р·Р°РјРµРЅРёС‚СЊ РЅР° РіРёРїРµСЂСЌРєСЃС‚РµРЅР·РёСЋ.';
  if (n.includes('РїСЂРёСЃРµРґ') && !n.includes('РіР°РЅС‚РµР»') && !n.includes('РіСѓРґРјРѕСЂ'))
    return 'вљ  РљРѕР»РµРЅРё РЅРµ РІС‹С…РѕРґСЏС‚ Р·Р° РЅРѕСЃРєРё, СЃРїРёРЅР° РїСЂСЏРјР°СЏ. РџСЂРё РґРёСЃРєРѕРјС„РѕСЂС‚Рµ вЂ” Р·Р°РјРµРЅРёС‚СЊ РЅР° Р¶РёРј РЅРѕРіР°РјРё.';
  if (n.includes('РіСѓРґРјРѕСЂРЅРёРЅРі') || (n.includes('РЅР°РєР»РѕРЅ') && n.includes('С€С‚Р°РЅРі')))
    return 'вљ  Р’С‹СЃРѕРєРёР№ СЂРёСЃРє РїРѕСЏСЃРЅРёС†С‹. РЎРїРёРЅР° РїСЂСЏРјР°СЏ, РєРѕР»РµРЅРё С‡СѓС‚СЊ СЃРѕРіРЅСѓС‚С‹. РўРѕР»СЊРєРѕ РґР»СЏ РїСЂРѕРґРІРёРЅСѓС‚С‹С….';
  if (n.includes('С‚СЏРіР°') && n.includes('С€С‚Р°РЅРіРё') && n.includes('РЅР°РєР»РѕРЅРµ'))
    return 'вљ  РџРѕСЏСЃРЅРёС†Р°: РґРµСЂР¶Р°С‚СЊ СЃРїРёРЅСѓ РїСЂСЏРјРѕР№, РЅРµ РґС‘СЂРіР°С‚СЊ РІРµСЃ. РџСЂРё Р±РѕР»Рё вЂ” Р·Р°РјРµРЅРёС‚СЊ РЅР° С‚СЏРіСѓ Р±Р»РѕРєР°.';
  if (n.includes('Р¶РёРј') && (n.includes('СЃС‚РѕСЏ') || n.includes('СЃРёРґСЏ') || n.includes('Р°СЂРјРµР№СЃРєРёР№')))
    return 'вљ  РџР»РµС‡РµРІРѕР№ СЃСѓСЃС‚Р°РІ: РЅРµ РѕРїСѓСЃРєР°С‚СЊ РіСЂРёС„ РЅРёР¶Рµ РїРѕРґР±РѕСЂРѕРґРєР°. РџСЂРё Р±РѕР»Рё вЂ” Р·Р°РјРµРЅРёС‚СЊ РЅР° Р¶РёРј РіР°РЅС‚РµР»РµР№.';
  if (n.includes('С„СЂР°РЅС†СѓР·СЃРєРёР№') || (n.includes('СЂР°Р·РіРёР±') && n.includes('Р»С‘Р¶Р°')))
    return 'вљ  Р›РѕРєС‚РµРІРѕР№ СЃСѓСЃС‚Р°РІ: РЅРµ РїРµСЂРµСЂР°Р·РіРёР±Р°С‚СЊ. РџСЂРё Р±РѕР»Рё вЂ” Р·Р°РјРµРЅРёС‚СЊ РЅР° СЂР°Р·РіРёР±Р°РЅРёСЏ РЅР° Р±Р»РѕРєРµ.';
  return '';
}

/** РџРѕСЃС‚СЂРѕРёС‚СЊ С‚СЂРµРЅРµСЂСЃРєРёР№ РєРѕРјРјРµРЅС‚Р°СЂРёР№ Рє СѓРїСЂР°Р¶РЅРµРЅРёСЋ. */
function buildExComment(
  muscle: string, name: string, role: 'primary' | 'accessory',
  character: DayCharacter, sets: number, reps: number, weight: number, rir: number,
  weakPoints: string[], focusGroup: string | undefined,
  phase: BBPhase, tempo: string, restSec: number,
  isSubstituted: boolean,
  exerciseId?: string,
  trainingFocus?: BBTrainingFocus,
  selectionRationale?: string,
): string {
  const parts: string[] = [];
  const label = role === 'primary' ? 'рџЋЇ РћСЃРЅРѕРІРЅРѕРµ' : 'рџ“Њ Р”РѕР±РёРІРѕС‡РЅРѕРµ';
  parts.push(`${label}: ${muscle}`);
  // РџСЂРѕРіСЂР°РјРј-СЃРїРµС†РёС„РёС‡РЅС‹Р№ РєРѕРЅС‚РµРєСЃС‚: РїРѕС‡РµРјСѓ РёРјРµРЅРЅРѕ СЌС‚Рѕ СѓРїСЂР°Р¶РЅРµРЅРёРµ РґР»СЏ СЌС‚РѕР№ РїСЂРѕРіСЂР°РјРјС‹
  const weakMatch = weakPoints.find(wp => {
    const fn = WEAK_EXERCISE_BONUS[wp];
    return fn ? fn(name) : false;
  });
  if (weakMatch) {
    const ru = { chest_upper: 'РІРµСЂС… РіСЂСѓРґРё', chest_lower: 'РЅРёР· РіСЂСѓРґРё', back_width: 'С€РёСЂРёРЅР° СЃРїРёРЅС‹', back_thickness: 'С‚РѕР»С‰РёРЅР° СЃРїРёРЅС‹', delt_mid: 'СЃСЂРµРґРЅСЏСЏ РґРµР»СЊС‚Р°', delt_front: 'РїРµСЂРµРґРЅСЏСЏ РґРµР»СЊС‚Р°', delt_rear: 'Р·Р°РґРЅСЏСЏ РґРµР»СЊС‚Р°', quads: 'РєРІР°РґСЂРёС†РµРїСЃ', hamstrings: 'Р±РёС†РµРїСЃ Р±РµРґСЂР°', glutes: 'СЏРіРѕРґРёС†С‹', calves: 'РёРєСЂС‹', biceps: 'Р±РёС†РµРїСЃ', triceps: 'С‚СЂРёС†РµРїСЃ' } as Record<string,string>;
    parts.push(`рџ”Ґ РћС‚СЃС‚Р°СЋС‰Р°СЏ В«${weakMatch}В» (${ru[weakMatch] || weakMatch}) в†’ РІС‹Р±СЂР°РЅРѕ РїРѕ СѓРіР»Сѓ/РїР°С‚С‚РµСЂРЅСѓ`);
  } else if (isWeak(muscle, weakPoints)) {
    parts.push('рџ”Ґ РћС‚СЃС‚Р°СЋС‰Р°СЏ РіСЂСѓРїРїР°');
  }
  if (focusGroup && (muscle === focusGroup || isWeak(muscle, [focusGroup]))) parts.push('в­ђ РЎРїРµС†РёР°Р»РёР·Р°С†РёСЏ');
  if (isSubstituted) parts.unshift('вљ  Р—Р°РјРµРЅР° (С‚СЂР°РІРјР°):');
  const phaseNames: Record<string, string> = { accumulation: 'РќР°РєРѕРїР»РµРЅРёРµ', intensification: 'РРЅС‚РµРЅСЃРёС„РёРєР°С†РёСЏ', deload: 'Р Р°Р·РіСЂСѓР·РєР°', peaking: 'РџРёРє' };
  const charLabel = character === 'С‚СЏР¶' ? 'С‚СЏР¶' : character === 'РїР°РјРї' ? 'РїР°РјРї' : 'Р»С‘Рі';
  parts.push(`${phaseNames[phase] || phase}, RIR ${rir} (${charLabel}) вЂ” РґР»СЏ СЌС‚РѕР№ РїСЂРѕРіСЂР°РјРјС‹`);
  parts.push(`${sets}Г—${reps} @ ${weight} РєРі вЂ” РёРјРµРЅРЅРѕ С‚Р°Рє РІ СЌС‚РѕРј РґРЅРµ/РЅРµРґРµР»Рµ`);
  // РџРѕС‡РµРјСѓ РІС‹Р±СЂР°РЅРѕ вЂ” РїСЂРѕРіСЂР°РјРјР°-СЃРїРµС†РёС„РёС‡РЅРѕ, Р±РµР· РјСѓСЃРѕСЂР° СЃРєРѕСЂРёРЅРіР°
  if (selectionRationale) {
    const filtered = selectionRationale.split(';').map(s=>s.trim()).filter(s=> s && !/\+8|в€’15|в€’40|РќРµ РґР»СЏ РґРµС„РѕР»С‚РЅРѕР№|Р­РєР·РѕС‚РёРєР°/i.test(s) && !/Р”РµС‚Р°Р»СЊРЅР°СЏ С‚РµС…РЅРёРєР°|РњРµС‚РѕРґРёС‡РµСЃРєРѕРµ СЃРѕРїСЂРѕРІРѕР¶РґРµРЅРёРµ/i.test(s)).join(' В· ');
    if (filtered) parts.push(`РџРѕС‡РµРјСѓ РІ СЌС‚РѕР№ РїСЂРѕРіСЂР°РјРјРµ: ${filtered} вЂ” Р·Р°РєСЂС‹РІР°РµС‚ ${muscle} (${name}) РІ ${phase} ${charLabel}`);
  }
  
  // РљРѕРЅРєСЂРµС‚РЅС‹Рµ РёРЅСЃС‚СЂСѓРєС†РёРё вЂ” РїСЂРёРјРµРЅРёРјРѕ РёРјРµРЅРЅРѕ Рє СЌС‚РѕРјСѓ СѓРїСЂР°Р¶РЅРµРЅРёСЋ РІ СЌС‚РѕРј РґРЅРµ РїСЂРѕРіСЂР°РјРјС‹
  const execNote = exerciseId
    ? EXECUTION_NOTES[exerciseId] || EXECUTION_NOTES[name] || EXECUTION_NOTES[(name || '').toLowerCase()]
    : EXECUTION_NOTES[name] || EXECUTION_NOTES[(name || '').toLowerCase()];
  if (execNote) parts.push(`РљР°Рє РґРµР»Р°С‚СЊ РІ СЌС‚РѕР№ РїСЂРѕРіСЂР°РјРјРµ: ${execNote}`);
  
  const warn = exerciseRiskWarning(name);
  if (warn) parts.push(warn);
  // РљРѕСЂРѕС‚РєР°СЏ РїСЂРѕРіСЂР°РјРјР°-СЃРїРµС†РёС„РёС‡РЅР°СЏ РёРЅСЃС‚СЂСѓРєС†РёСЏ (Р±РµР· generic РїР°С‚С‚РµСЂРЅ/РїРѕСЂСЏРґРѕРє)
  const instr = buildExerciseInstructions({
    exerciseId,
    exerciseName: name,
    muscle,
    role,
    phase,
    trainingFocus,
    tempo,
    restSeconds: restSec,
  });
  const progInstrParts: string[] = [];
  if (instr.cues.length) progInstrParts.push(`РўРµС…РЅРёРєР°: ${instr.cues.slice(0,2).join('; ')}`);
  progInstrParts.push(`РўРµРјРї: ${instr.tempo}${tempoExplain(instr.tempo) ? ` (${tempoExplain(instr.tempo)})` : ''}, РѕС‚РґС‹С… ${instr.restSeconds || restSec}СЃ вЂ” РёРјРµРЅРЅРѕ РґР»СЏ СЌС‚РѕРіРѕ СЃРµС‚Р° РІ РїСЂРѕРіСЂР°РјРјРµ`);
  if (instr.stretch) progInstrParts.push(`Р Р°СЃС‚СЏР¶РµРЅРёРµ: ${instr.stretch}`);
  if (instr.peak) progInstrParts.push(`РџРёРє: ${instr.peak}`);
  if (instr.mistakes.length) progInstrParts.push(`РћС€РёР±РєРё РІ СЌС‚РѕР№ РїСЂРѕРіСЂР°РјРјРµ: ${instr.mistakes.slice(0,2).join('; ')}`);
  parts.push(progInstrParts.join(' В· '));
  return cleanInstructionsText(parts.join('. '));
}

/** Р Р°Р·РјРёРЅРѕС‡РЅР°СЏ РїРёСЂР°РјРёРґР° РґР»СЏ compound СѓРїСЂР°Р¶РЅРµРЅРёР№.
 *  РљР°РЅРѕРЅ: warmup-ramp.engine (РіСЂРёС„ 20Г—15 в†’ 50%Г—10 в†’ 70%Г—5 в†’ 80%Г—3 в†’ 90%Г—1).
 *  Р•РґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє вЂ” warmupRampFor; Р·РґРµСЃСЊ С‚РѕР»СЊРєРѕ РґРµР»РµРіРёСЂРѕРІР°РЅРёРµ (СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ). */
export function buildWarmup(workWeight: number, isCompound: boolean): { load: number; reps: number }[] {
  return warmupRampFor(workWeight, isCompound);
}

// BUG-B13/B21: STRETCH_DB Рё addStretching СѓРґР°Р»РµРЅС‹ РєР°Рє РјС‘СЂС‚РІС‹Р№ РєРѕРґ (РІС‹Р·РѕРІ Р·Р°РєРѕРјРјРµРЅС‚РёСЂРѕРІР°РЅ СЃ Jul 16).
// Р Р°СЃС‚СЏР¶РєР° РЅРµ РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє Р‘Р‘-РіРёРїРµСЂС‚СЂРѕС„РёРё Рё Р·Р°РЅРёРјР°Р»Р° СЃР»РѕС‚С‹ РІ РїР»Р°РЅРµ.

// fix E: СЂРµР°Р»РёСЃС‚РёС‡РЅС‹Рµ Р·РЅР°С‡РµРЅРёСЏ workMax РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ (РєРі) вЂ” РёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ,
// С‚РѕР»СЊРєРѕ РµСЃР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РІРІС‘Р» СЃРІРѕРё СЂР°Р±РѕС‡РёРµ РјР°РєСЃРёРјСѓРјС‹. РЈР±РёСЂР°РµС‚ РјР°РіРёС‡РµСЃРєРёР№ В«80В»
// Рё РґР°С‘С‚ РѕСЃРјС‹СЃР»РµРЅРЅС‹Рµ РІРµСЃР° РІ СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅРѕРј РїР»Р°РЅРµ РґР°Р¶Рµ Р±РµР· РІРІРѕРґР°.
export const DEFAULT_WORKMAX: Record<string, number> = {
  chest: 100, back: 120, shoulders: 70, arms: 50,
  quads: 140, hamstrings: 100, glutes: 150, calves: 90, abs: 80, traps: 90,
  delt_front: 70, delt_mid: 70, delt_rear: 70, forearms: 45,
  biceps: 45, triceps: 50,
  lower_back: 120, neck: 70,
};
export const defaultWorkMax = (key: string): number => {
  const collapsed = collapseKey(key);
  const val = DEFAULT_WORKMAX[collapsed] ?? DEFAULT_WORKMAX[key];
  if (val === undefined) {
    // C7: warn РЅР° РЅРµРёР·РІРµСЃС‚РЅС‹Р№ РєР»СЋС‡ вЂ” РїРѕРјРѕРіР°РµС‚ РѕС‚Р»РѕРІРёС‚СЊ РѕРїРµС‡Р°С‚РєРё РІ muscle names.
    console.warn(`[BB] defaultWorkMax: unknown muscle key "${key}" (collapsed: "${collapsed}"), using fallback 80kg`);
    return 80;
  }
  return val;
};

/**
 * C10: TAG_PRIMARY_MUSCLES вЂ” РІС‹РЅРµСЃРµРЅРѕ РёР· buildSession РЅР° СѓСЂРѕРІРµРЅСЊ РјРѕРґСѓР»СЏ.
 * Р—Р°РІРёСЃРёС‚ С‚РѕР»СЊРєРѕ РѕС‚ dayInRotation (РґР»СЏ С‡РµСЂРµРґРѕРІР°РЅРёСЏ quads/hamstrings РЅР° Legs-РґРЅСЏС…).
 * Р Р°РЅРµРµ СЂРµРєРѕРЅСЃС‚СЂСѓРёСЂРѕРІР°Р»РѕСЃСЊ РїСЂРё РєР°Р¶РґРѕРј РІС‹Р·РѕРІРµ buildSession (~100+ СЂР°Р· РЅР° РїР»Р°РЅ).
 */
function getTagPrimaryMuscles(legDayIndex: number, highVolumeLegs = false): Record<string, Set<string>> {
  const legPrimary = highVolumeLegs ? new Set(['quads', 'hamstrings', 'glutes']) : (legDayIndex % 2 === 0 ? new Set(['quads', 'glutes']) : new Set(['hamstrings', 'glutes']));
  const lowerPrimary = highVolumeLegs ? new Set(['quads', 'hamstrings', 'glutes', 'calves']) : (legDayIndex % 2 === 0 ? new Set(['quads', 'glutes', 'calves']) : new Set(['hamstrings', 'glutes', 'calves']));
  return {
    Chest: new Set(['chest']),
    Back: new Set(['back']),
    Shoulders: new Set(['shoulders']),
    Arms: new Set(['biceps', 'triceps', 'forearms']),
    Legs: legPrimary,
    Push: new Set(['chest', 'shoulders', 'triceps']),
    Pull: new Set(['back', 'biceps', 'traps']),
    ChestBack: new Set(['chest', 'back']),
    ShouldersArms: new Set(['shoulders', 'biceps', 'triceps', 'forearms']),
    Upper: new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']),
    Lower: lowerPrimary,
    FullBody: new Set(['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'arms']),
    Torso: new Set(['chest', 'back', 'shoulders']),
    Limbs: new Set(['quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'calves']),
    UpperPower: new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']),
    LowerPower: new Set(['quads', 'hamstrings', 'glutes', 'calves']),
    UpperHyp: new Set(['chest', 'back', 'shoulders', 'biceps', 'triceps']),
    LowerHyp: new Set(['quads', 'hamstrings', 'glutes', 'calves']),
    // A1: LegsBiceps вЂ” primary = quads (legs) + biceps (arms). Hamstrings/calves = accessory.
    // Р Р°РЅРµРµ biceps РѕС‚СЃСѓС‚СЃС‚РІРѕРІР°Р» РІ TAG_PRIMARY в†’ РІСЃРµРіРґР° accessory РЅР° СЃРІРѕС‘Рј В«РґРµРґРёС†РёРЅРЅРѕРјВ» РґРЅРµ.
    LegsBiceps: new Set(['quads', 'biceps']),
    Glutes: new Set(['glutes', 'hamstrings']),
    GlutesHams: new Set(['glutes', 'hamstrings']),
  };
}

/** 3.1 вЂ” РІС‹РЅРµСЃРµРЅРЅС‹Рµ СЃР»РѕРё: volume/selection/loading вЂ” РµРґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РґР»СЏ buildSession Рё С‚РµСЃС‚РѕРІ. */
export function computeMuscleSets(muscle: string, baseSets: number, opts: { level: string; trainingYears?: number; phase: string; role: string; muscleVolumeRotation: Record<string, number>; isHeavy?: boolean }): number {
  let sets = baseSets;
  // High-volume enhanced РјРёРЅРёРјСѓРјС‹ вЂ” РїСЂСЏРјРѕР№ Р±СЋРґР¶РµС‚, РЅРµ РѕСЃС‚Р°С‚РѕРє РїРѕСЃР»Рµ РґСЂСѓРіРёС… РіСЂСѓРїРї
  if (opts.level === 'enhanced' && (opts.trainingYears ?? 0) >= 3 && opts.phase !== 'deload') {
    if (muscle === 'back') sets = Math.max(sets, (opts.trainingYears ?? 0) >= 6 ? 22 : 18);
    if (muscle === 'chest' && opts.isHeavy) sets = Math.max(sets, (opts.trainingYears ?? 0) >= 6 ? 18 : 14);
    if (['quads', 'hamstrings', 'glutes'].includes(muscle)) sets = Math.max(sets, (opts.trainingYears ?? 0) >= 6 ? 20 : 14);
    if (muscle === 'glutes' && opts.isHeavy) sets = Math.max(sets, (opts.trainingYears ?? 0) >= 6 ? 8 : 6);
    if (['biceps', 'triceps'].includes(muscle) && opts.isHeavy) sets = Math.max(sets, (opts.trainingYears ?? 0) >= 6 ? 8 : 6);
  }
  // Natural advanced вЂ” СЃРїРёРЅР° РјРёРЅРёРјСѓРј 10 РІ Upper
  if (opts.level === 'advanced' && muscle === 'back' && opts.phase !== 'deload') sets = Math.max(sets, 10);
  // Indirect overlap вЂ” РїСЂСЏРјС‹Рµ СЂСѓРєРё СЃРЅРёР¶Р°СЋС‚СЃСЏ РµСЃР»Рё С‚СЏРі/Р¶РёРјРѕРІ РјРЅРѕРіРѕ (РєРѕСЃРІРµРЅРЅС‹Р№ СѓР¶Рµ Р·Р°РєСЂС‹РІР°РµС‚)
  if (muscle === 'biceps') {
    const pullSets = opts.muscleVolumeRotation['back'] || 0;
    if (pullSets >= 40) sets = Math.min(sets, Math.round(pullSets * 0.12));
    else if (pullSets >= 24) sets = Math.min(sets, Math.round(pullSets * 0.15));
    else if (pullSets >= 14) sets = Math.min(sets, Math.round(pullSets * 0.2));
  }
  if (muscle === 'triceps') {
    const pushSets = (opts.muscleVolumeRotation['chest'] || 0) + (opts.muscleVolumeRotation['shoulders'] || 0);
    if (pushSets >= 40) sets = Math.min(sets, Math.round(pushSets * 0.12));
    else if (pushSets >= 24) sets = Math.min(sets, Math.round(pushSets * 0.15));
    else if (pushSets >= 14) sets = Math.min(sets, Math.round(pushSets * 0.2));
  }
  // Р¤Р°Р·РѕРІР°СЏ РјРѕРґСѓР»СЏС†РёСЏ СѓР¶Рµ РїСЂРёРјРµРЅРµРЅР° РІ sessionShareFor, Р·РґРµСЃСЊ С‚РѕР»СЊРєРѕ cap
  return Math.max(1, Math.min(5, sets));
}

export interface SelectExercisesForMuscleOpts {
  sessionSelectedIds: string[];
  sessionSelectedNames: string[];
  equipment: string[];
  weakZones: string[];
  level: string;
  injuryProfile: string[];
  type: 'compound' | 'isolation' | 'any';
  targetRir: number;
  favoriteIds: string[];
  excludeIds: string[];
  avoidAxialLoad?: boolean;
  preferEquipment: string[];
}

/** 3.1 вЂ” РІС‹РЅРµСЃРµРЅРЅС‹Р№ СЃР»РѕР№ selection: РІС‹Р±РѕСЂ СѓРїСЂР°Р¶РЅРµРЅРёР№ С‡РµСЂРµР· selectExercisesSmart +
 *  С„РёРєСЃР°С†РёСЏ РІС‹Р±СЂР°РЅРЅС‹С… id/РёРјС‘РЅ РІ СЃРµСЃСЃРёРѕРЅРЅС‹Рµ СЃРїРёСЃРєРё (С‚Рµ Р¶Рµ РјСѓС‚Р°С†РёРё, С‡С‚Рѕ Р±С‹Р»Рё inline). */
export function selectExercisesForMuscle(pool: any[], muscle: string, count: number, opts: SelectExercisesForMuscleOpts): any[] {
  const selected = selectExercisesSmart({
    candidates: pool, muscleGroup: muscle, count,
    selectedIds: opts.sessionSelectedIds, selectedNames: opts.sessionSelectedNames,
    equipment: opts.equipment, weakZones: opts.weakZones, level: opts.level,
    injuryProfile: opts.injuryProfile, type: opts.type,
    targetRir: opts.targetRir,
    preferBB: true,
    favoriteIds: opts.favoriteIds, excludeIds: opts.excludeIds,
    avoidAxialLoad: opts.avoidAxialLoad,
    preferEquipment: opts.preferEquipment,
  });
  for (const s of selected) { if (s && s.id) opts.sessionSelectedIds.push(s.id); if (s && s.name) opts.sessionSelectedNames.push(s.name); }
  return selected;
}

export interface BuildExercisePoolOpts {
  level: string;
  /** РСЃС‚РёРЅРЅС‹Рµ РјС‹С€С†С‹ РїСѓР»Р° (musclesForRole(repKey)) вЂ” С„РёР»СЊС‚СЂ РїРѕ trueMuscleOf. */
  roleMuscles: string[];
  /** РўРµРі СЃРµСЃСЃРёРё вЂ” РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ С„РёР»СЊС‚СЂС‹ push/pull/legs. */
  sessionTag?: string;
  allowExotic: boolean;
  allowStrengthLifts?: boolean;
  isPurePull: boolean;
  equipmentList: string[];
  excludeIds: string[];
  avoidAxialLoad?: boolean;
  mobilityRestrictions?: string[];
  bodyweightCapability?: BBBuilderInput['bodyweightCapability'];
  favoriteIds: string[];
  muscle: string;
  focusGroup?: string;
  weakPoints: string[];
  fewerCompound?: boolean;
  /** PED РґР»СЏ joint-guard (GH+AAS) вЂ” РЅРµ Р»РѕРјР°РµС‚ С‚СЏР¶/РїР°РјРї, С‚РѕР»СЊРєРѕ РѕС‚Р±РѕСЂ. */
  pedDoses?: Record<string, number>;
  labMrvMultiplier?: number;
}

/** 3.1 вЂ” РІС‹РЅРµСЃРµРЅРЅС‹Р№ СЃР»РѕР№ selection: РїРѕСЃС‚СЂРѕРµРЅРёРµ СЃРєРѕСЂРёСЂРѕРІР°РЅРЅРѕРіРѕ РїСѓР»Р° СѓРїСЂР°Р¶РЅРµРЅРёР№.
 *  Р’РєР»СЋС‡Р°РµС‚: РёСЃС‚РёРЅРЅРѕ-РјС‹С€РµС‡РЅС‹Р№ С„РёР»СЊС‚СЂ + РєРѕРЅС‚РµРєСЃС‚ СЃРµСЃСЃРёРё + fallback-РїСѓР» +
 *  BB-С„РёР»СЊС‚СЂ + _score (BB-РїСЂРёРѕСЂРёС‚РµС‚) + generic-Р±Р»СЌРєР»РёСЃС‚. */
export function buildExercisePool(muscle: string, role: string, opts: BuildExercisePoolOpts): any[] {
  const tag = (opts.sessionTag || '').toLowerCase();
  let pool = EXERCISE_CATALOG.filter((ex: any) => {
    const tm = trueMuscleOf(ex);
    if (tm === null || !opts.roleMuscles.includes(tm)) return false;
    if (isBBJunk(ex)) return false;
    { const _t = bbExerciseTier(ex); if (_t === 4 || (!opts.allowExotic && _t === 3)) return false; }
    // РЎС‚Р°РЅРѕРІР°СЏ/СЃСѓРјРѕ/Р¶РёРј СЃС‚РѕСЏ вЂ” С‚РѕР»СЊРєРѕ РІ СЃРёР»РѕРІРѕРј С†РёРєР»Рµ Рё РїРѕ РєРЅРѕРїРєРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ.
    if (opts.allowStrengthLifts !== true) {
      const n = (ex.name || '').toLowerCase();
      if (n.includes('СЃС‚Р°РЅРѕРІР°СЏ') || n.includes('СЃСѓРјРѕ') || n.includes('Р°СЂРјРµР№СЃРєРёР№') || n.includes('Р¶РёРј СЃС‚РѕСЏ') || n.includes('С€РІСѓРЅРі') || n.includes('РјРµСЂС‚РІ')) return false;
    }
    if (!opts.isPurePull && tm === 'shoulders' && isRearDeltExercise(ex.name)) return false;
    if (opts.avoidAxialLoad && ex.name && isAxialLoadExercise(ex as any)) return false;
    if (opts.mobilityRestrictions && isMobilityRestricted(ex, opts.mobilityRestrictions)) return false;
    // Bodyweight capability: РїРѕРґС‚СЏРіРёРІР°РЅРёСЏ РЅРµ СЃС‚Р°РІСЏС‚СЃСЏ Р±РµР· РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅРѕР№
    // СЃРїРѕСЃРѕР±РЅРѕСЃС‚Рё РЅРё РІ РєР°РєСѓСЋ СЂРѕР»СЊ вЂ” Р·Р°РјРµРЅСЏСЋС‚СЃСЏ pulldown/РјР°С€РёРЅРѕР№.
    if (/РїРѕРґС‚СЏРі|pull.?up|chin.?up/i.test(ex.name || '')) {
      const cap = opts.bodyweightCapability;
      const canPullUp = cap && ((cap.pullUpsStrict ?? 0) >= 5 || (cap.chinUpsStrict ?? 0) >= 5 || (cap.weightedPullUpLoad ?? 0) > 0);
      if (!canPullUp) return false;
    }
    if (opts.equipmentList.length > 0) {
      const rawEq = ex.equipment;
      const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
      // bodyweight РІСЃРµРіРґР° СЂР°Р·СЂРµС€С‘РЅ (РЅРµ С‚СЂРµР±СѓРµС‚ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ)
      if (exEq.length > 0 && !exEq.includes('bodyweight') && !exEq.some(eq => opts.equipmentList.includes(eq))) return false;
    }
    if (opts.excludeIds.includes(ex.id) || opts.excludeIds.includes(ex.name)) return false;
    return true;
  });
  // Р¤РёР»СЊС‚СЂ РїРѕ РєРѕРЅС‚РµРєСЃС‚Сѓ СЃРµСЃСЃРёРё (РґРѕРї. СЃС‚СЂР°С…РѕРІРєР°, РІ РѕСЃРЅРѕРІРЅРѕРј РёРЅРµСЂС‚РµРЅ РїРѕСЃР»Рµ
  // С„РёР»СЊС‚СЂР°С†РёРё РїРѕ РёСЃС‚РёРЅРЅРѕР№ РјС‹С€С†Рµ)
  pool = pool.filter(ex => {
    const n = (ex.name || '').toLowerCase();
    if (tag.includes('push') || tag === 'chest' || tag === 'shoulders') {
      if (n.includes('С‚СЏРіР°')||n.includes('СЃС‚Р°РЅРѕРІР°СЏ')||n.includes('РјС‘СЂС‚РІР°СЏ')||n.includes('РјРµСЂС‚РІР°СЏ')||n.includes('РіРёРїРµСЂСЌРєСЃС‚РµРЅР·')||n.includes('С„РµСЂРјРµСЂ')||n.includes('carry')||n.includes('rdl')||n.includes('romanian')||n.includes('deadlift')||n.includes('good morning')||n.includes('РіСѓРґРјРѕСЂРЅРёРЅРі')) return false;
    }
    if (tag.includes('pull') || tag === 'back') {
      if (n.includes('Р¶РёРј')&&!n.includes('РЅРѕРіР°РјРё')||n.includes('press')||n.includes('СЂР°Р·РіРёР±')||n.includes('extension')) return false;
    }
    if (tag === 'legs' || tag === 'lower') {
      // Р Р°РЅСЊС€Рµ: `n.includes('С‚СЏРіР°')` Р±Р»РѕРєРёСЂРѕРІР°Р»Рѕ Р’РЎР• С‚СЏРіРё РґР»СЏ РЅРѕР¶РЅРѕРіРѕ РґРЅСЏ (РІРєР»СЋС‡Р°СЏ RDL).
      // РўРµРїРµСЂСЊ СЂРµР»РµР№-Р±Р»РѕРєРёСЂРѕРІРєР° 'С‚СЏРіР°' РґР»СЏ РІСЃРµРіРѕ С‡С‚Рѕ РќР• РѕС‚РЅРѕСЃРёС‚СЃСЏ Рє Р‘Р‘-РїРѕР·Р°-С†РµРїРё (RDL/РјС‘СЂС‚РІР°СЏ
      // РЅР° РїСЂСЏРјС‹С… РЅРѕРіР°С…/РіСѓРґРјРѕСЂРЅРёРЅРі/РіРёРїРµСЂСЌРєСЃС‚РµРЅР·РёСЏ/РѕР±СЂР°С‚РЅР°СЏ РіРёРїРµСЂ). Р­С‚Рё Р»РёС„С‚С‹ СЂР°Р·СЂРµС€РµРЅС‹ РІ
      // С…Р°РјСЃС‚СЂРёРЅРі/РїРѕСЏСЃРЅРёС‡РЅС‹С… РґРЅСЏС… вЂ” РёРЅР°С‡Рµ С…Р°РјСЃС‚СЂРёРЅРіРё РѕСЃС‚Р°СЋС‚СЃСЏ С‚РѕР»СЊРєРѕ СЃ leg_curl (РёР·РѕР»СЏС†РёСЏ).
      // РџР°С‚С‚РµСЂРЅ `РўСЏРіР° С€С‚Р°РЅРіРё РІ РЅР°РєР»РѕРЅРµ` (row) в†’ РІСЃС‘ РµС‰С‘ Р±Р»РѕРєРёСЂСѓРµС‚СЃСЏ (BB-posterior РЅРµ СЃРѕРІРїР°РґР°РµС‚).
      const isBbPosteriorChain = /СЂСѓРјС‹РЅ|РјС‘СЂС‚РІ|stiff.?leg|РјС‘СЂС‚РІ.*РІ СЃРјРёС‚Рµ|РјС‘СЂС‚РІ.*РЅР° РїСЂСЏРј|РјС‘СЂС‚РІ.*РЅР° РѕРґРЅРѕР№|РіСѓРґРјРѕСЂРЅРёРЅРі|good.?morning|rdl|РіРёРїРµСЂСЌРєСЃС‚РµРЅР·|РѕР±СЂР°С‚РЅ.*РіРёРїРµСЂ|reverse.?hyper/.test(n);
      if ((n.includes('Р¶РёРј') && !n.includes('РЅРѕРіР°РјРё')) || (!isBbPosteriorChain && n.includes('С‚СЏРіР°')) || n.includes('РїРѕРґС‚СЏРі') || n.includes('Р±РёС†РµРїСЃ') || n.includes('С‚СЂРёС†РµРїСЃ')) return false;
    }
    return true;
  });
  // Р•СЃР»Рё РїРѕСЃР»Рµ С„РёР»СЊС‚СЂР° РїСѓР» РѕРїСѓСЃС‚РµР» вЂ” fallback РЅР° С‚РѕС‚ Р¶Рµ РёСЃС‚РёРЅРЅС‹Р№-РјС‹С€РµС‡РЅС‹Р№ РїСѓР»
  if (pool.length === 0) pool = EXERCISE_CATALOG.filter((ex: any) => {
    const tm = trueMuscleOf(ex);
    if (tm === null || !opts.roleMuscles.includes(tm)) return false;
    if (isBBJunk(ex)) return false;
    { const _t = bbExerciseTier(ex); if (_t === 4 || (!opts.allowExotic && _t === 3)) return false; }
    // B12: equipment-fallback РўРћР›Р¬РљРћ РµСЃР»Рё РѕР±РѕСЂСѓРґРѕРІР°РЅРёРµ РќР• СѓРєР°Р·Р°РЅРѕ РёР»Рё СЃРѕРІРїР°РґР°РµС‚ (РёРЅР°С‡Рµ вЂ” РЅРµС‚ СѓРїСЂР°Р¶РЅРµРЅРёР№).
    if (opts.equipmentList.length > 0) {
      const rawEq = ex.equipment;
      const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
      if (exEq.length > 0 && !exEq.includes('bodyweight') && !exEq.some(eq => opts.equipmentList.includes(eq))) return false;
    }
    // B5: avAxial вЂ” РґР°Р¶Рµ РІ fallback РќР• Р±РµСЂС‘Рј РѕСЃРµРІС‹Рµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ
    if (opts.avoidAxialLoad && ex.name && isAxialLoadExercise(ex)) return false;
    // Bodyweight capability вЂ” Рё РІ fallback РЅРµ Р±РµСЂС‘Рј РїРѕРґС‚СЏРіРёРІР°РЅРёСЏ Р±РµР· СЃРїРѕСЃРѕР±РЅРѕСЃС‚Рё.
    if (/РїРѕРґС‚СЏРі|pull.?up|chin.?up/i.test(ex.name || '')) {
      const cap = opts.bodyweightCapability;
      const canPullUp = cap && ((cap.pullUpsStrict ?? 0) >= 5 || (cap.chinUpsStrict ?? 0) >= 5 || (cap.weightedPullUpLoad ?? 0) > 0);
      if (!canPullUp) return false;
    }
    if (!opts.isPurePull && tm === 'shoulders' && isRearDeltExercise(ex.name)) return false;
    if (opts.mobilityRestrictions && isMobilityRestricted(ex, opts.mobilityRestrictions)) return false;
    if (opts.excludeIds.includes(ex.id) || opts.excludeIds.includes(ex.name)) return false;
    return true;
  });
  // в”Ѓв”Ѓв”Ѓ BB: РјРёРЅРёРјР°Р»СЊРЅС‹Р№ С„РёР»СЊС‚СЂ non-BB СѓРїСЂР°Р¶РЅРµРЅРёР№ (РІСЃРµРіРґР°, РЅРµ С‚РѕР»СЊРєРѕ generic) в”Ѓв”Ѓв”Ѓ
  pool = pool.filter((ex: any) => {
    const n = (ex.name || '').toLowerCase();
    const id = (ex.id || '').toLowerCase();
    if (/РЅР°Рґ РіРѕР»РѕРІ|overhead.*squat|РїРёСЃС‚РѕР».*РїСЂРёСЃРµРґ|pistol.*squat/i.test(n)) return false;
    return true;
  });
  // в”Ѓв”Ѓв”Ѓ joint-guard: РЅРµ Р»РѕРјР°РµС‚ С‚СЏР¶/РїР°РјРї, С‚РѕР»СЊРєРѕ С€С‚СЂР°С„СѓРµС‚ axial/high-stress РІ РїСѓР»Рµ в”Ѓв”Ѓв”Ѓ
  // Р“Р°СЂРґ СЂР°Р±РѕС‚Р°РµС‚ РЅР° СѓСЂРѕРІРЅРµ РѕС‚Р±РѕСЂР°, Р° РЅРµ С…Р°СЂР°РєС‚РµСЂР° РґРЅСЏ (С‚СЏР¶ РѕСЃС‚Р°С‘С‚СЃСЏ С‚СЏР¶, РЅРѕ СЃ РјР°С€РёРЅРѕР№).
  const _jgHasGH = !!opts.pedDoses && Number((opts.pedDoses as any)['GH']) > 0;
  const _jgHasAAS = !!opts.pedDoses && Number((opts.pedDoses as any)['AAS']) > 0;
  const _jgInput = { hasGH: _jgHasGH, ghDose: Number((opts.pedDoses as any)?.['GH'] || 0), hasAAS: _jgHasAAS, aasDose: Number((opts.pedDoses as any)?.['AAS'] || 0), hasInsulin: !!opts.pedDoses && Number((opts.pedDoses as any)['insulin']) > 0, labMrvMultiplier: opts.labMrvMultiplier as any };
  const _jgActive = jointGuardActive(_jgInput);

  // в”Ѓв”Ѓв”Ѓ _score: BB-РїСЂРёРѕСЂРёС‚РµС‚ Р’РЎР•Р“Р”Рђ (РЅРµ С‚РѕР»СЊРєРѕ generic) в”Ѓв”Ѓв”Ѓ
  // Р“Р°РєРє/РЎРјРёС‚ > СЃРІРѕР±РѕРґРЅС‹Р№ РїСЂРёСЃРµРґ, РЅР°РєР»РѕРЅРЅС‹Р№ Р¶РёРј > РїР»РѕСЃРєРёР№, СЃС‚Р°РЅРґР°СЂС‚РЅС‹Рµ
  // compound'С‹ РїСЂРёРѕСЂРёС‚РµС‚РЅС‹. Р­С‚РѕС‚ СЃРєРѕСЂ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ multi-angle diversity
  // РґР»СЏ РІС‹Р±РѕСЂР° Р»СѓС‡С€РµРіРѕ СѓРїСЂР°Р¶РЅРµРЅРёСЏ РёР· РєР°Р¶РґРѕРіРѕ СѓРіР»Р°.
  pool = pool.map((ex: any) => {
    let score = 0;
    const n = (ex.name || '').toLowerCase();
    const id = (ex.id || '').toLowerCase();
    if (PREFERRED_BB_EXERCISES.has(ex.id)) score += 50;
    else if (opts.favoriteIds.includes(ex.id)) score += 20;
    if (id.includes('incline') || n.includes('РЅР°РєР»РѕРЅ')) score += 15;
    if (id.includes('hack') || n.includes('РіР°РєРє')) score += 15;
    if (id.includes('smith') && id.includes('squat')) score += 10;
    // Р‘РѕРґРёР±РёР»РґРёРЅРі-РѕСЃРЅРѕРІС‹: РЅР°РєР»РѕРЅРЅС‹Р№ Р¶РёРј (С€С‚Р°РЅРіР°) вЂ” РіР»Р°РІРЅС‹Р№ РґР»СЏ РіСЂСѓРґРё; С€РёСЂРѕРєРёР№ С…РІР°С‚
    // РІРµСЂС‚РёРєР°Р»СЊРЅРѕР№ С‚СЏРіРё вЂ” РґР»СЏ С€РёСЂРѕС‡Р°Р№С€РёС…. РџРѕРІС‹С€Р°РµРј РёС… РїСЂРёРѕСЂРёС‚РµС‚.
    if (muscle === 'chest' && /РЅР°РєР»РѕРЅ|incline/.test(n) && /С€С‚Р°РЅРі|barbell|РіР°РЅС‚РµР»|dumbbell/.test(n)) score += 12;
    if (muscle === 'back' && /РІРµСЂС…Рё|РІРµСЂС…РЅ.*Р±Р»РѕРє|РїСѓР»Р»РґР°СѓРЅ|pulldown|РїРѕРґС‚СЏРі/.test(n) && /С€РёСЂРѕРє|wide/.test(n)) score += 12;
    // РњРµРЅСЊС€Рµ РјРЅРѕРіРѕСЃСѓСЃС‚Р°РІРЅС‹С… (РєРЅРѕРїРєР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ): РјР°С€РёРЅР°/РЎРјРёС‚/РїРѕРґРґРµСЂР¶Р°РЅРЅС‹Рµ РІС‹С€Рµ,
    // СЃРІРѕР±РѕРґРЅС‹Рµ compound РЅРёР¶Рµ вЂ” РїСЂРёСЃРµРґ в†’ РіР°РєРє/Р¶РёРј РЅРѕРіР°РјРё, С‚СЏРіР° С€С‚Р°РЅРіРё в†’ РЎРјРёС‚ Рё С‚.Рґ.
    if (opts.fewerCompound) {
      if (/РјР°С€РёРЅ|С‚СЂРµРЅР°Р¶|machine|РіР°РєРє|hack|СЃРјРёС‚|smith|РїРѕРґРґРµСЂР¶Р°РЅ|chest.?supported|seal/.test(n)) score += 20;
      if (/РїСЂРёСЃРµРґ|squat|С‚СЏРіР°.*С€С‚Р°РЅРі|С‚СЏРіР°.*РЅР°РєР»РѕРЅ|row.*barbell|Р¶РёРј.*С€С‚Р°РЅРі|bench.*press/.test(n)) score -= 25;
    }
    if ((id === 'bench_press' || id === 'barbell_bench_press') && !id.includes('incline')) score -= 10;
    if ((id === 'squat' || id === 'barbell_squat' || id === 'back_squat') && !id.includes('hack') && !id.includes('smith')) score -= 10;
    // Р РµРґРєРёРµ/СЃРїРµС†РёС„РёС‡РЅС‹Рµ РІР°СЂРёР°С†РёРё (РЅРµ РґР»СЏ РјР°СЃСЃРѕРЅР°Р±РѕСЂР°)
    if (n.includes('РѕР±СЂР°С‚РЅ') || n.includes('РѕР±СЂР°С‚') || n.includes('reverse')) score -= 10;
    if (n.includes('СѓР·РєРёР№') || n.includes('СѓР·Рє') || n.includes('narrow')) score -= 5;
    // РћРґРЅРѕСЃС‚РѕСЂРѕРЅРЅРёРµ РІР°СЂРёР°РЅС‚С‹ (СЂСѓРјС‹РЅСЃРєР°СЏ РЅР° РѕРґРЅРѕР№ РЅРѕРіРµ, С‚СЏРіР° РѕРґРЅРѕР№ СЂСѓРєРѕР№) вЂ”
    // РјРµРЅРµРµ РїСЂРёРѕСЂРёС‚РµС‚РЅС‹ РґР»СЏ РјСѓР¶С‡РёРЅ/РјР°СЃСЃС‹: РєР»Р°СЃСЃРёС‡РµСЃРєРёРµ РґРІСѓСЃС‚РѕСЂРѕРЅРЅРёРµ
    // РґР°СЋС‚ Р±РѕР»СЊС€Рµ РјРµС…Р°РЅРёС‡РµСЃРєРѕРіРѕ РЅР°С‚СЏР¶РµРЅРёСЏ Рё СЃС‚Р°Р±РёР»СЊРЅРѕР№ РїСЂРѕРіСЂРµСЃСЃРёРё.
    if (/РЅР° РѕРґРЅРѕР№ РЅРѕРі|РѕРґРЅРѕР№ РЅРѕРіРѕР№|single.?leg|one.?leg/i.test(n)) score -= 20;
    if (/РѕРґРЅРѕР№ СЂСѓРє|РѕРґРЅРѕР№ СЂСѓРєРѕР№|one.?arm|single.?arm/i.test(n) && !muscle.includes('back')) score -= 10;
    // Р‘СЂСѓСЃСЊСЏ вЂ” РЅРµ РїСЂРёРѕСЂРёС‚РµС‚ РіСЂСѓРґРё (С‚СЂРёС†РµРїСЃ-РґРѕРјРёРЅР°РЅС‚РЅС‹, РїРµСЂРµРіСЂСѓР¶Р°СЋС‚ РїР»РµС‡Рѕ);
    // РґР»СЏ СЂР°СЃС‚СЏР¶РєРё РїСЂРёРѕСЂРёС‚РµС‚РЅС‹ СЂР°Р·РІРѕРґРєРё Рё РєСЂРѕСЃСЃРѕРІРµСЂ.
    if (muscle === 'chest' && /Р±СЂСѓСЃ|dip/i.test(n)) score -= 20;
    // РђСЂРјРµР№СЃРєРёР№ Р¶РёРј СЃС‚РѕСЏ вЂ” РџР›-РґРІРёР¶РµРЅРёРµ: РїСЂРµРґРїРѕС‡С‚РёС‚РµР»СЊРЅС‹ РєР»Р°СЃСЃРёС‡РµСЃРєРёРµ Р¶РёРјС‹
    // РїРµСЂРµРґ СЃРѕР±РѕР№ (Smith С€РёСЂРѕРєРёРј С…РІР°С‚РѕРј, Р¶РёРјС‹ РіР°РЅС‚РµР»РµР№).
    if (/Р°СЂРјРµР№СЃРє|Р¶РёРј.*СЃС‚РѕСЏ|standing.*press|military/i.test(n)) score -= 25;
    // Joint-guard С€С‚СЂР°С„ (РЅРµ РјРµРЅСЏРµС‚ С…Р°СЂР°РєС‚РµСЂ РґРЅСЏ, С‚РѕР»СЊРєРѕ РѕС‚Р±РѕСЂ)
    if (_jgActive) score += jointGuardScorePenalty(ex, _jgInput);
    return { ...ex, _score: score };
  }).sort((a: any, b: any) => (b._score || 0) - (a._score || 0));
  // Generic-РїР»Р°РЅ (Р±РµР· СЃРїРµС†РёР°Р»РёР·Р°С†РёРё/СЃР»Р°Р±С‹С… С‚РѕС‡РµРє): СѓР±РёСЂР°РµРј СЃР»РёС€РєРѕРј СЃРїРµС†РёС„РёС‡РЅС‹Рµ РІР°СЂРёР°С†РёРё
  // (РѕР±СЂР°С‚РЅС‹Р№ С…РІР°С‚, СѓР·РєР°СЏ СЃС‚РѕР№РєР°) вЂ” РѕРЅРё СѓР¶Рµ РѕС€С‚СЂР°С„РѕРІР°РЅС‹ РІ _score, РЅРѕ РїСЂРё generic
  // Р±РµР· weak-point Р»СѓС‡С€Рµ РёС… РїРѕР»РЅРѕСЃС‚СЊСЋ РёСЃРєР»СЋС‡РёС‚СЊ.
  const isGeneric = !opts.focusGroup && !opts.weakPoints.some(wp => {
    const parent = WEAK_TO_MUSCLE[wp];
    return wp === muscle || (parent && parent === muscle);
  });
  if (isGeneric) {
    pool = pool.filter((ex: any) => {
      const id = (ex.id || '').toLowerCase();
      const n = (ex.name || '').toLowerCase();
      const isBlacklisted = Array.from(BLACKLIST_GENERIC).some(bid =>
        id.includes(bid) || n.includes(bid.replace(/_/g, ' ')));
      if (isBlacklisted) return false;
      // РџСѓР»РѕРІРµСЂ вЂ” СЌС‚Рѕ С‚СЏРіР° (С€РёСЂРѕС‡Р°Р№С€РёРµ), Р° РЅРµ РіСЂСѓРґРЅР°СЏ РёР·РѕР»СЏС†РёСЏ: РЅРµ СЃС‚Р°РІРёРј РІ РіСЂСѓРґСЊ.
      // (РєР°С‚Р°Р»РѕРі-group 'chest', РЅРѕ РїРѕ РґРІРёР¶РµРЅРёСЋ вЂ” lat-СѓРїСЂР°Р¶РЅРµРЅРёРµ; РґСѓР±Р»РёСЂСѓРµС‚ РіСЂСѓРґРЅС‹Рµ РёР·РѕР»СЏС†РёРё)
      if (muscle === 'chest' && /РїСѓР»РѕРІРµСЂ|pullover/.test(n)) return false;
      // Р“СЂСѓРґСЊ: Р±СЂСѓСЃСЊСЏ РЅРµ РїСЂРёРѕСЂРёС‚РµС‚ (С‚СЂРёС†РµРїСЃ-РґРѕРјРёРЅР°РЅС‚РЅС‹, РїРµСЂРµРіСЂСѓР¶Р°СЋС‚ РїР»РµС‡Рѕ).
      // Р”Р»СЏ СЂР°СЃС‚СЏР¶РєРё РїСЂРёРѕСЂРёС‚РµС‚РЅС‹ СЂР°Р·РІРѕРґРєРё Рё РєСЂРѕСЃСЃРѕРІРµСЂ.
      if (muscle === 'chest' && /Р±СЂСѓСЃ|dip/i.test(n)) return false;
      // Р‘РёС†РµРїСЃ Р±РµРґСЂР°: РєР»Р°СЃСЃРёС‡РµСЃРєР°СЏ СЂСѓРјС‹РЅСЃРєР°СЏ С‚СЏРіР° РґРІСѓРјСЏ РЅРѕРіР°РјРё РїСЂРёРѕСЂРёС‚РµС‚РЅР°;
      // РѕРґРЅРѕСЃС‚РѕСЂРѕРЅРЅРёР№ РІР°СЂРёР°РЅС‚ вЂ” СЃРїРµС†РёС„РёС‡РЅР°СЏ РІР°СЂРёР°С†РёСЏ, РЅРµ РґР»СЏ generic-РјР°СЃСЃС‹.
      if (muscle === 'hamstrings' && /РЅР° РѕРґРЅРѕР№ РЅРѕРі|РѕРґРЅРѕР№ РЅРѕРіРѕР№|single.?leg|one.?leg/i.test(n)) return false;
      return true;
    });
  }
  return pool;
}

export interface BuildSessionParams {
  sched: ScheduleDay; dayInRotation: number; week: number;
  muscleVolumeRotation: Record<string, number>;
  muscleSessionCount: Record<string, number>;
  musclePrimaryAssigned: Set<string>;
  workMax: Record<string, number>; weakPoints: string[]; focusGroup?: string;
  pedAdapt?: PEDAdaptation;
  dailyCap?: number;
  level?: string;
  injuryProfile?: string[];
  injuredMuscles?: Set<string>;
  excludedMuscles?: Set<string>;
  gradedInjuries?: Injury[];
  today?: string;
  phase?: BBPhase;
  phaseWeek?: number;
  mrvRot?: number;
  preSelectedIds?: string[];
  preSelectedNames?: string[];
  rotationBlockIds?: string[];
  favoriteIds?: string[];
  excludeIds?: string[];
  avoidAxialLoad?: boolean;
  equipmentList?: string[];
  methodology?: SessionMethodology;
  isFemale?: boolean;
  intensityTechnique?: IntensityTechnique;
  autoDeload?: boolean;
  loadStrategy?: LoadStrategy;
  autoRegResult?: { volumeMultiplier: number; topSetPctMultiplier: number; rirShift: number };
  specialization?: boolean;
  /** РџСЂРѕРїСѓСЃС‚РёС‚СЊ Р¶С‘СЃС‚РєРёРµ РіСЂСѓРїРїС‹ Р·Р°РјРµРЅС‹ (cross-meso continuity вЂ” РІРµСЃР° РїСЂРѕРіСЂРµСЃСЃРёСЂСѓСЋС‚ РїРѕ РёРјРµРЅРё). */
  skipStrictCoverage?: boolean;
  pedDoses?: Record<string, number>;
  labMrvMultiplier?: number;
  courseIntensity?: CourseIntensity;
  onCourse?: boolean;
  sex?: 'male' | 'female';
  weekLocalUsed?: Map<string, Set<string>>;
  primaryBySlot?: Map<string, string>;
  trainingFocus?: BBTrainingFocus;
  eccentricMult?: number;
  mobilityRestrictions?: string[];
  trainingYears?: number;
  bodyweightCapability?: BBBuilderInput['bodyweightCapability'];
  fewerCompound?: boolean;
  allowStrengthLifts?: boolean;
  rotationMode?: 'forbid' | 'strict' | 'variety';
  intensityLevel?: 'light' | 'moderate' | 'high';
  legDayIndex?: number;
}

function buildSession(
  sched: ScheduleDay, dayInRotation: number, week: number,
  muscleVolumeRotation: Record<string, number>,
  muscleSessionCount: Record<string, number>,
  musclePrimaryAssigned: Set<string>,
  workMax: Record<string, number>, weakPoints: string[], focusGroup?: string,
  pedAdapt?: PEDAdaptation,
  dailyCap: number = 12,
  level: string = 'intermediate',
  injuryProfile: string[] = [],
  injuredMuscles: Set<string> = new Set(),
  excludedMuscles: Set<string> = new Set(),
  gradedInjuries: Injury[] = [],
  today: string = '',
  phase: BBPhase = 'accumulation',
  phaseWeek: number = 1,
  mrvRot: number = 0,
  preSelectedIds: string[] = [],
  preSelectedNames: string[] = [],
  rotationBlockIds: string[] = [],
  favoriteIds: string[] = [],
  excludeIds: string[] = [],
  avoidAxialLoad: boolean = false,
  equipmentList: string[] = [],
  methodology: SessionMethodology = 'compound_first',
  isFemale: boolean = false,
  intensityTechnique?: IntensityTechnique,
  autoDeload?: boolean,
  loadStrategy?: LoadStrategy,
  autoRegResult?: { volumeMultiplier: number; topSetPctMultiplier: number; rirShift: number },
  specialization?: boolean,
  pedDoses?: Record<string, number>,
  labMrvMultiplier?: number,
  courseIntensity?: CourseIntensity,
  onCourse: boolean = false,
  sex: 'male' | 'female' = 'male',
  weekLocalUsed: Map<string, Set<string>> = new Map(),
  primaryBySlot: Map<string, string> = new Map(),
  trainingFocus?: BBTrainingFocus,
  eccentricMult?: number,
  mobilityRestrictions?: string[],
  trainingYears?: number,
  bodyweightCapability?: BBBuilderInput['bodyweightCapability'],
  fewerCompound?: boolean,
  allowStrengthLifts?: boolean,
  rotationMode?: 'forbid' | 'strict' | 'variety',
  intensityLevel?: 'light' | 'moderate' | 'high',
  legDayIndex: number = 0,
  skipStrictCoverage?: boolean,
): BBSession {
  const character = sched.character as DayCharacter;
  // РРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ С‚СЂРµРЅРёРЅРіР° в†’ РјРЅРѕР¶РёС‚РµР»СЊ РѕС‚РґС‹С…Р° (РїР»РѕС‚РЅРѕСЃС‚СЊ/РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ).
  const intensityRestMult = intensityLevel === 'light' ? 1.2 : intensityLevel === 'high' ? 0.8 : 1.0;
  // Р’ СЂРµР¶РёРјРµ В«Р·Р°РїСЂРµС‚В» РёСЃРїРѕР»СЊР·СѓРµРј РєРѕРЅСЃС‚Р°РЅС‚РЅСѓСЋ РЅРµРґРµР»СЋ РґР»СЏ РѕС‚Р±РѕСЂР° СѓРїСЂР°Р¶РЅРµРЅРёР№ вЂ”
  // СЃС‚СЂРѕРіРѕ С‚Рµ Р¶Рµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ РєР°Р¶РґСѓСЋ РЅРµРґРµР»СЋ.
  const selWeek = rotationMode === 'forbid' ? 1 : week;
  // Р•РґРёРЅС‹Р№ СЂРµР·РѕР»РІРµСЂ Р°РєС†РµРЅС‚РѕРІ РґР»СЏ per-session Р»РѕРіРёРєРё (Р±РµР· СЃС‚СЌРєРёРЅРіР° 1.2Г—1.3).
  const specRes = resolveSpecialization(focusGroup, weakPoints, specialization);
    // Focus-РіСЂСѓРїРїР° РёРЅР¶РµРєС‚РёСЂСѓРµС‚СЃСЏ РІ СЃРµСЃСЃРёСЋ, С‚РѕР»СЊРєРѕ РµСЃР»Рё С‚РµРі СЃРѕРІРјРµСЃС‚РёРј:
    // FullBody вЂ” РІСЃРµРіРґР°, Legs/Lower вЂ” С‚РѕР»СЊРєРѕ РґР»СЏ РЅРѕРі/СЏРіРѕРґРёС†,
    // Upper/Push/Pull вЂ” С‚РѕР»СЊРєРѕ РґР»СЏ РІРµСЂС…РЅРёС… РіСЂСѓРїРї.
    const focusIsLegs = !!focusGroup && ['quads', 'hamstrings', 'glutes', 'calves'].includes(collapseKey(focusGroup));
    const focusIsUpper = !!focusGroup && ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'traps', 'arms'].includes(collapseKey(focusGroup));
    const tagHasFocus = !!focusGroup && (
      musclesForTag(sched.sessionTag).some(m => collapseKey(m) === collapseKey(focusGroup))
      || /FullBody/.test(sched.sessionTag || '')
      || (/Legs|Lower|Glute/i.test(sched.sessionTag || '') && focusIsLegs)
      || (/Upper|Push|Pull|Chest|Back|Shoulders|Arms/i.test(sched.sessionTag || '') && focusIsUpper)
    );
    const musclePlans = dedupeMuscles(sched.sessionTag, excludedMuscles, focusGroup, tagHasFocus);
  const exercises: BBExercise[] = [];

  // BUG-B11: leadMuscle РґР»СЏ orderSessionExercises вЂ” РѕСЃРЅРѕРІРЅР°СЏ РјС‹С€С†Р° РґРЅСЏ (РїРµСЂРІС‹Р№ compound).
  // Р Р°РЅСЊС€Рµ: orderSessionExercises Р±СЂР°Р» tagMuscles[0] в†’ FullBody РІСЃРµРіРґР° 'chest' РґР°Р¶Рµ РІ РґРµРЅСЊ РЅРѕРі.
  // РўРµРїРµСЂСЊ: РІС‹С‡РёСЃР»СЏРµРј leadMuscle РћР”РРќ СЂР°Р· РґР»СЏ СЃРµСЃСЃРёРё Рё РїРµСЂРµРґР°С‘Рј РІ orderSessionExercises.
  const LEAD_MUSCLE: Record<string, string> = {
    Chest: 'chest', Back: 'back', Shoulders: 'shoulders', Arms: 'triceps',
    Push: 'chest', Pull: 'back', ChestBack: 'chest', ShouldersArms: 'shoulders',
    Upper: 'chest', UpperPower: 'chest', UpperHyp: 'chest',
    Torso: 'chest', Limbs: 'quads', LegsBiceps: 'quads', Glutes: 'glutes', GlutesHams: 'glutes',
    Legs: legDayIndex % 2 === 0 ? 'quads' : 'hamstrings',
    Lower: legDayIndex % 2 === 0 ? 'quads' : 'hamstrings',
    LowerPower: legDayIndex % 2 === 0 ? 'quads' : 'hamstrings',
    LowerHyp: legDayIndex % 2 === 0 ? 'quads' : 'hamstrings',
    FullBody: '', // FullBody вЂ” РѕСЃРѕР±С‹Р№ СЃР»СѓС‡Р°Р№: primary РѕРїСЂРµРґРµР»СЏРµС‚СЃСЏ РїРѕ musclePrimaryAssigned
  };
  const sessionLeadMuscle = LEAD_MUSCLE[sched.sessionTag || ''] || ((musclePlans[0] as any)?.group || '');
  // FB primary distribution вЂ” Р’РќРЈРўР Р buildSession (РЅР°РґС‘Р¶РЅРµРµ, С‡РµРј РІ buildBBPlan).
  // Day 1: chest+back primary, Day 2: legs primary, Day 3: shoulders+arms primary.
  // Р‘Р»РѕРєРёСЂСѓРµРј РЅРµ-fbPrimary РјС‹С€С†С‹ Р”Рћ С†РёРєР»Р°, С‡С‚РѕР±С‹ РѕРЅРё РЅРµ РїРѕР»СѓС‡РёР»Рё role='primary'.
  if (sched.sessionTag === 'FullBody') {
    musclePrimaryAssigned.clear();
    const fbSchedule = [['chest', 'back'], ['quads', 'hamstrings'], ['shoulders', 'arms']];
    const fbPrimary = fbSchedule[(dayInRotation - 1) % fbSchedule.length];
    for (const mp of musclePlans) {
      if (!fbPrimary.includes(mp.group)) musclePrimaryAssigned.add(mp.group);
    }
  }
  // S-MRV: РЎРёСЃС‚РµРјРЅС‹Р№ Р±СЋРґР¶РµС‚ СѓС‚РѕРјР»РµРЅРёСЏ РЅР° РґРµРЅСЊ.
  // Р¤РѕСЂРјСѓР»Р°: dailyCap Г— S_MRV_FACTOR Г— regimeMult Г— levelMult.
  // Р РµР¶РёРј-РјРЅРѕР¶РёС‚РµР»СЊ (Г—2 РЅР° РєСѓСЂСЃРµ) СЂР°СЃС‚СЏРіРёРІР°РµС‚ РґРЅРµРІРЅРѕР№ Р±СЋРґР¶РµС‚, С‡С‚РѕР±С‹ multi-group
  // РґРЅРё (Upper: РіСЂСѓРґСЊ+СЃРїРёРЅР° РѕР±Р° РіР»Р°РІРЅС‹РјРё, ~50-60 СЃРµС‚РѕРІ РЅР° РєСѓСЂСЃРµ) РІРјРµС‰Р°Р»Рё РѕР±Рµ
  // РіР»Р°РІРЅС‹Рµ РјС‹С€С†С‹, Р° РЅРµ РіРѕР»РѕРґР°Р»Рё (СЂР°РЅРµРµ СЃРїРёРЅР° СЃСЉРµРґР°Р»Р° Р±СЋРґР¶РµС‚, РіСЂСѓРґСЊ вЂ” 18 СЃРµС‚РѕРІ).
  const levelMultMap: Record<string, number> = { beginner: 0.9, intermediate: 1.0, advanced: 1.15, enhanced: 1.3 };
  const levelMult = levelMultMap[level] ?? 1.0;
  // Р­РєР·РѕС‚РёРєР° (РіРёСЂСЏ/РѕР»РёРјРї/СЃС‚СЂРѕРЅРіРјРµРЅ/РјРѕР±РёР»РёС‚Рё) вЂ” С‚РѕР»СЊРєРѕ РґР»СЏ advanced/enhanced; РєР°РЅРѕРЅРёРєР° РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ.
  const allowExotic = level === 'advanced' || level === 'enhanced';
  const dayRegimeMult = computeMrvMult({ onCourse: !!(pedAdapt && pedAdapt.activePEDs && pedAdapt.activePEDs.length > 0), courseIntensity: pedAdapt?.courseIntensity, doseAwareMrv: pedAdapt?.combinedMrvMultiplier });
  const dayFatigueBudget = Math.round(dailyCap * S_MRV_FACTOR * dayRegimeMult * levelMult);
  
  // Pre-calculate each muscle's expected volume to allocate budget proportionally
  const plans: MusclePlan[] = [];
  let totalExpectedFatigue = 0;
  const sessionSelectedIds: string[] = [...preSelectedIds, ...rotationBlockIds];
  const sessionSelectedNames: string[] = [...preSelectedNames];
  const rotationNamesSet = new Set(preSelectedNames); // cross-session rotation only (excludes prior days/weeks, not this session's own picks)
  // РЈ РѕРїС‹С‚РЅРѕРіРѕ enhanced-РїСЂРѕС„РёР»СЏ СЂРѕС‚Р°С†РёСЏ СѓРїСЂР°Р¶РЅРµРЅРёР№ СЃРїРёРЅС‹ РЅРµ РґРѕР»Р¶РЅР° РѕСЃС‚Р°РІР»СЏС‚СЊ
  // РІС‚РѕСЂСѓСЋ back-СЃРµСЃСЃРёСЋ СЃ РѕРґРЅРёРј РґРІРёР¶РµРЅРёРµРј. РџРѕРІС‚РѕСЂ СЂР°Р·СЂРµС€С‘РЅ РјРµР¶РґСѓ СЃРµСЃСЃРёСЏРјРё,
  // РЅРѕ РІРЅСѓС‚СЂРё РѕРґРЅРѕР№ СЃРµСЃСЃРёРё dedupe РїРѕ С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕРјСѓ РїР°С‚С‚РµСЂРЅСѓ РѕСЃС‚Р°С‘С‚СЃСЏ.
  const relaxBackRotation = level === 'enhanced' && (trainingYears ?? 0) >= 3;
  
  for (const mp of musclePlans) {
    const muscle = mp.group;      // РєР°С‚Р°Р»РѕРі-РіСЂСѓРїРїР° (shoulders/arms/back/legs/coreвЂ¦)
    const repKey = mp.repKey;     // РїРµСЂРІС‹Р№ PRO-РєР»СЋС‡ РіСЂСѓРїРїС‹ (delt_front/biceps/вЂ¦)
    // РџРѕР»РЅРѕСЃС‚СЊСЋ РёСЃРєР»СЋС‡С‘РЅРЅС‹Рµ РіСЂСѓРїРїС‹ РїСЂРѕРїСѓСЃРєР°РµРј (dedupeMuscles СѓР¶Рµ РѕС‚С„РёР»СЊС‚СЂРѕРІР°Р», РґСѓР±Р»РёСЂСѓРµРј СЃС‚СЂР°С…РѕРІРєСѓ)
    if (excludedMuscles.has(repKey)) continue;
    // Р“СЂР°РґРёСЂРѕРІР°РЅРЅС‹Рµ С‚СЂР°РІРјС‹: РЅРµ РїСЂРѕРїСѓСЃРєР°РµРј, РЅРѕ РїСЂРёРјРµРЅРёРј Р·Р°РјРµРЅСѓ РЅРёР¶Рµ
    const isGraded = gradedInjuries.some(inj => collapseKey(inj.muscle) === muscle);
    const injuryFactor = gradedInjuries.find(inj => collapseKey(inj.muscle) === muscle);

    let resolved = resolveCharacter(repKey, character);
    // Legs 2Г—/РЅРµРґ РґР»СЏ Р’РЎР•РҐ СѓСЂРѕРІРЅРµР№: С‚СЏР¶ РѕРґРЅРѕР№ + РїР°РјРї РґСЂСѓРіРѕР№ + РёРєСЂС‹ (С„РёРєСЃ РїРѕ РўР—)
    if (/Legs|Lower/.test(sched.sessionTag || '') && (muscle === 'quads' || muscle === 'hamstrings')) {
      const isHeavyQuadsDay = legDayIndex % 2 === 0;
      const shouldBeHeavy = (muscle === 'quads' && isHeavyQuadsDay) || (muscle === 'hamstrings' && !isHeavyQuadsDay);
      if (!shouldBeHeavy) resolved = 'РїР°РјРї';
    }
    let role: 'primary' | 'accessory' = 'accessory';
    // РљР°РєРёРµ РјС‹С€С†С‹ СЏРІР»СЏСЋС‚СЃСЏ "РіР»Р°РІРЅС‹РјРё" РґР»СЏ РєР°Р¶РґРѕРіРѕ С‚РµРіР° СЃРµСЃСЃРёРё.
    // РћСЃС‚Р°Р»СЊРЅС‹Рµ РјС‹С€С†С‹ С‚РµРіР° вЂ” РґРѕР±РёРІРѕС‡РЅС‹Рµ (accessory), РґР°Р¶Рµ РµСЃР»Рё С‚СЏР¶-РґРµРЅСЊ.
    // Р­С‚Рѕ РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚: delt_front=primary РІ Chest-РґРЅРµ в†’ Р±Р»РѕРєРёСЂСѓРµС‚ Shoulders-РґРµРЅСЊ.
    // C10: РІС‹РЅРµСЃРµРЅРѕ РІ getTagPrimaryMuscles (РјРѕРґСѓР»СЊРЅС‹Р№ СѓСЂРѕРІРµРЅСЊ) вЂ” Р±РµР· СЂРµРєРѕРЅСЃС‚СЂСѓРєС†РёРё РЅР° РєР°Р¶РґС‹Р№ РІС‹Р·РѕРІ.
    const TAG_PRIMARY_MUSCLES = getTagPrimaryMuscles(legDayIndex, level === 'enhanced' && (trainingYears ?? 0) >= 3);
    const tagPrimaries = sched.sessionTag ? TAG_PRIMARY_MUSCLES[sched.sessionTag] : undefined;
    // Glute priority РґР»СЏ Р¶РµРЅС‰РёРЅ РР›Р РїСЂРё focusGroup='glutes': glutes РІСЃРµРіРґР° primary РІ Р»СЋР±РѕРј РЅРѕР¶РЅРѕРј РґРЅРµ.
    // РўР°РєР¶Рµ РґР»СЏ FullBody вЂ” glutes РґРѕР±Р°РІР»СЏРµС‚СЃСЏ РІ fbPrimaryToday РїСЂРё focus.
    const isGlutePriority = (isFemale || focusGroup === 'glutes') && muscle === 'glutes' && /leg|lower|glute|limbs|fullbody/i.test(sched.sessionTag || '');
    const isMainMuscle = !tagPrimaries || tagPrimaries.has(muscle) || isGlutePriority;
    const SMALL_NEVER_PRIMARY = new Set(['traps', 'forearms', 'calves']);
    // FB: РїСЂРѕРІРµСЂРёС‚СЊ, СЏРІР»СЏРµС‚СЃСЏ Р»Рё РјС‹С€С†Р° fbPrimary РґР»СЏ СЌС‚РѕРіРѕ РґРЅСЏ.
    // Р•СЃР»Рё РЅРµС‚ вЂ” РќР• primary, РґР°Р¶Рµ РµСЃР»Рё musclePrimaryAssigned РїРѕС‡РµРјСѓ-С‚Рѕ РЅРµ СЃСЂР°Р±РѕС‚Р°Р».
    // РРЎРљР›Р®Р§Р•РќРР•: focusGroup вЂ” РјС‹С€С†Р° СЃРїРµС†РёР°Р»РёР·Р°С†РёРё Р’РЎР•Р“Р”Рђ РґРѕРїСѓСЃРєР°РµС‚СЃСЏ РґРѕ primary (РґР°Р¶Рµ РІ FullBody).
    const fbPrimaryToday = sched.sessionTag === 'FullBody'
      ? [['chest', 'back'], ['quads', 'hamstrings'], ['shoulders', 'arms']][(dayInRotation - 1) % 3]
      : null;
    const fbAllowsPrimary = fbPrimaryToday ? (fbPrimaryToday.includes(muscle) || muscle === focusGroup) : true;
    // в… Primary-dominance: РІ multi-day С‚РѕР»СЊРєРѕ lead-РјС‹С€С†Р° (back РІ Pull, chest РІ Push)
    // РґРѕР»Р¶РЅР° СЃС‚Р°С‚СЊ primary. Р Р°РЅСЊС€Рµ Р›Р®Р‘РђРЇ mainMuscle РІ С‚СЏР¶-РґРЅРµ (biceps/traps РІ Pull,
    // triceps РІ Push) РїРѕР»СѓС‡Р°Р»Р° primary в†’ exerciseCount=4 Рё sessionShareFor factor=1.4
    // в†’ accessories РїРµСЂРµРІРµС€РёРІР°Р»Рё lead-РјС‹С€С†Сѓ (back=3ex vs biceps+traps+delt=7ex).
    // РўРµРїРµСЂСЊ: primary РЅР°Р·РЅР°С‡Р°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РµСЃР»Рё РµС‰С‘ РЅРµС‚ primary (size===0) РР›Р СЌС‚Рѕ
    // lead-РјС‹С€С†Р° РґРЅСЏ. WeakPoints РѕР±С…РѕРґСЏС‚ С‡РµСЂРµР· РѕС‚РґРµР»СЊРЅРѕРµ СѓСЃР»РѕРІРёРµ РЅРёР¶Рµ.
    // РРЎРљР›Р®Р§Р•РќРР•: dual-primary С‚РµРіРё (ChestBack, ShouldersArms, Upper, Torso) вЂ” 2 primary
    // (chest+back, shoulders+arms), РёРЅР°С‡Рµ back=1ex РІ ChestBack вЂ” РЅРµРґРѕРїСѓСЃС‚РёРјРѕ.
    const DUAL_PRIMARY_TAGS = new Set(['ChestBack', 'ShouldersArms', 'Upper', 'UpperPower', 'UpperHyp', 'Torso', 'LegsBiceps']);
    // Р”Р»СЏ РѕРїС‹С‚РЅРѕРіРѕ enhanced: Lower-РґРµРЅСЊ РїРѕР»СѓС‡Р°РµС‚ 2 primary (quads+hamstrings),
    // Р° РЅРµ С‚РѕР»СЊРєРѕ РѕРґРЅСѓ РіСЂСѓРїРїСѓ РїРѕ СЂРѕС‚Р°С†РёРё. Р­С‚Рѕ РґР°С‘С‚ РѕР±РµРёРј РіСЂСѓРїРїР°Рј РїРѕР»РЅРѕС†РµРЅРЅС‹Р№ Р±СЋРґР¶РµС‚.
    const highVolumeLegsSession = level === 'enhanced' && (trainingYears ?? 0) >= 3 && /Legs|Lower|LowerPower|LowerHyp/.test(sched.sessionTag || '');
    const maxPrimaries = highVolumeLegsSession ? 4 : (DUAL_PRIMARY_TAGS.has(sched.sessionTag || '') ? 2 : 1);
    // Р”Р»СЏ high-volume legs: quads РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ primary РґР°Р¶Рµ РµСЃР»Рё hamstrings
    // СѓР¶Рµ Р·Р°РЅСЏР» primary-СЃР»РѕС‚. Р‘РµР· СЌС‚РѕРіРѕ quads РІСЃРµРіРґР° accessory РІ С‡С‘С‚РЅС‹Рµ РґРЅРё.
    const forceLegsPrimary = highVolumeLegsSession && ['quads', 'hamstrings', 'glutes'].includes(muscle);
    // Р”Р»СЏ high-volume enhanced РіСЂСѓРґСЊ/СЃРїРёРЅР°-РґРЅРµР№ (Upper/ChestBack/Push): РіСЂСѓРґСЊ вЂ”
    // СЃРѕ-РіР»Р°РІРЅР°СЏ СЃРѕ СЃРїРёРЅРѕР№, primary РІ РћР‘Р•РРҐ СЃРµСЃСЃРёСЏС… (С‚СЏР¶ Рё РїР°РјРї). Р‘РµР· СЌС‚РѕРіРѕ РіСЂСѓРґСЊ
    // РІ РїР°РјРї-Upper РѕСЃС‚Р°С‘С‚СЃСЏ accessory (1 СѓРїСЂ) Рё РіРѕР»РѕРґР°РµС‚ (18/РЅРµРґ РІРјРµСЃС‚Рѕ ~40).
    const highVolumeTorsoSession = level === 'enhanced' && (trainingYears ?? 0) >= 3 && /Upper|Chest|Push|ChestBack|Torso/.test(sched.sessionTag || '');
    const forceTorsoPrimary = highVolumeTorsoSession && muscle === 'chest';
    // focusGroup: РјС‹С€С†Р° СЃРїРµС†РёР°Р»РёР·Р°С†РёРё РїРѕР»СѓС‡Р°РµС‚ primary-СЃР»РѕС‚ РґР°Р¶Рµ РµСЃР»Рё maxPrimaries РґРѕСЃС‚РёРіРЅСѓС‚.
    const isFocusMuscle = focusGroup && (muscle === focusGroup || isWeak(muscle, [focusGroup]));
    if (!musclePrimaryAssigned.has(muscle) && (resolved === 'С‚СЏР¶' || forceTorsoPrimary) && isMainMuscle && !SMALL_NEVER_PRIMARY.has(muscle) && fbAllowsPrimary && (musclePrimaryAssigned.size < maxPrimaries || muscle === sessionLeadMuscle || isFocusMuscle || forceLegsPrimary || forceTorsoPrimary)) {
      role = 'primary'; musclePrimaryAssigned.add(muscle);
    }
    // High-volume legs: РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ primary РґР»СЏ quads/hamstrings/glutes
    // РґР°Р¶Рµ РµСЃР»Рё maxPrimaries СѓР¶Рµ РґРѕСЃС‚РёРіРЅСѓС‚.
    if (forceLegsPrimary && !musclePrimaryAssigned.has(muscle) && !SMALL_NEVER_PRIMARY.has(muscle)) {
      role = 'primary'; musclePrimaryAssigned.add(muscle);
    }
    // РЎР»Р°Р±С‹Рµ РіСЂСѓРїРїС‹ (weakPoints): СЃС‚СЂСѓРєС‚СѓСЂРЅРѕРµ РїРѕРІС‹С€РµРЅРёРµ РґРѕ primary вЂ”
    // compound-РїРµСЂРІС‹Рј + Р±РѕР»СЊС€Рµ СѓРїСЂР°Р¶РЅРµРЅРёР№ + РѕР±СЉС‘Рј, Р° РЅРµ С‚РѕР»СЊРєРѕ +15 РІ СЃРєРѕСЂРёРЅРіРµ.
    // Р‘Р•Р— РїСЂРѕРІРµСЂРєРё musclePrimaryAssigned: СЃР»Р°Р±С‹Рµ РјС‹С€С†С‹ РїРѕР»СѓС‡Р°СЋС‚ primary РІ РљРђР–Р”РћР™
    // СЃРµСЃСЃРёРё (РґРІРѕР№РЅРѕР№ СЃС‚РёРјСѓР» РІ РЅРµРґРµР»СЋ: С‚СЏР¶ + РїР°РјРї в†’ РѕР±Р° СЃ compound-РїРµСЂРІС‹Рј).
    if (isMainMuscle && isWeak(muscle, weakPoints)) {
      role = 'primary'; musclePrimaryAssigned.add(muscle);
    }
    // focusGroup: РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ primary РІ Р»СЋР±РѕР№ СЃРµСЃСЃРёРё, РіРґРµ РјС‹С€С†Р° РїСЂРёСЃСѓС‚СЃС‚РІСѓРµС‚.
    if (isFocusMuscle && !excludedMuscles.has(repKey)) {
      role = 'primary'; musclePrimaryAssigned.add(muscle);
    }
    // Small FORCE_HEAVY muscles (traps/forearms/calves) never lead a day вЂ” always accessory
    // unless they're the day's explicit lead. Stops shrugs / wrist-curls stealing the primary
    // lead on pump days.
    if (role === 'primary' && SMALL_NEVER_PRIMARY.has(muscle)) role = 'accessory';
    // Force the day's lead compound muscle to primary so the session opens with a big compound
    // (bench / squat / row / OHP / close-grip bench) instead of a small isolation on pump days.
    const leadMuscle = sessionLeadMuscle;
    if (muscle === leadMuscle && !excludedMuscles.has(repKey)) { role = 'primary'; musclePrimaryAssigned.add(muscle); }
    const mavRot = muscleVolumeRotation[muscle] || 0;
    const sessionsForMuscle = muscleSessionCount[muscle] || 1;
    let sets = sessionShareFor(mavRot, sessionsForMuscle, role, muscle, pedAdapt, isFemale);
    // 3.1 вЂ” РІС‹РЅРµСЃРµРЅРЅС‹Р№ СЃР»РѕР№ volume: high-volume РјРёРЅРёРјСѓРјС‹ + indirect overlap
    sets = computeMuscleSets(muscle, sets, { level, trainingYears, phase, role, muscleVolumeRotation, isHeavy: /Upper|Chest|Push|Legs|Lower/.test(sched.sessionTag || '') });
    const specVol = specializationEmphasisFactor(muscle, specRes);
    if (specVol !== 1) sets = Math.round(sets * specVol);
    // Р¤Р°Р·РѕРІР°СЏ РјРѕРґСѓР»СЏС†РёСЏ РѕР±СЉС‘РјР° (deload/intensification/peaking СЃРЅРёР¶Р°СЋС‚)
    sets = Math.round(sets * getPhaseVolumeMult(phase));
    // MEV-РіР°СЂР°РЅС‚РёСЏ РЅР° СЌС‚Р°РїРµ СЂР°СЃРїСЂРµРґРµР»РµРЅРёСЏ: РјС‹С€С†Р° РЅРµ РѕРїСѓСЃРєР°РµС‚СЃСЏ РЅРёР¶Рµ MEV/С‡Р°СЃС‚РѕС‚Р°
    // РІ СЂР°Р±РѕС‡РµР№ С„Р°Р·Рµ (РёРЅР°С‡Рµ natural-РїР»Р°РЅС‹ РїРѕР»СѓС‡Р°СЋС‚ deficit, Р° fill РЅРµ РјРѕР¶РµС‚
    // РґРѕР±Р°РІРёС‚СЊ вЂ” СЃРµСЃСЃРёРё РЅР° Р»РёРјРёС‚Рµ). Deload вЂ” РёСЃРєР»СЋС‡РµРЅРёРµ (РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ).
    if (phase !== 'deload') {
      const mevGuard = getVolumeLandmarks(level, muscle)?.mev ?? 0;
      if (mevGuard > 0 && sessionsForMuscle > 0) {
        const perSessionMeV = Math.max(2, Math.ceil(mevGuard / sessionsForMuscle));
        if (sets < perSessionMeV) sets = perSessionMeV;
      }
    }
    // РџСЂРѕ-РїСЂР°РІРёР»Рѕ: РјР°РєСЃРёРјСѓРј 5 СЂР°Р±РѕС‡РёС… СЃРµС‚РѕРІ РЅР° СѓРїСЂР°Р¶РЅРµРЅРёРµ (РѕР±СЉС‘Рј РґРѕР±РёРІР°РµС‚СЃСЏ
    // РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹РјРё СѓРїСЂР°Р¶РЅРµРЅРёСЏРјРё/РїР°С‚С‚РµСЂРЅР°РјРё, Р° РЅРµ 6-8 РїРѕРґС…РѕРґР°РјРё РІ РѕРґРЅРѕРј).
    if (sets > 5) sets = 5;
    // MRV-РєР°Рї: РѕРґРЅР° СЃРµСЃСЃРёСЏ РЅРµ РїСЂРµРІС‹С€Р°РµС‚ РЅРµРґРµР»СЊРЅС‹Р№ MRV РјС‹С€С†С‹ (fix D)
    if (mrvRot > 0) sets = Math.max(1, Math.min(sets, mrvRot));
    // P1: reps/tempo/rest Р±РµСЂСѓС‚СЃСЏ РёР· С„Р°Р·РѕРІРѕРіРѕ РєРѕРЅС„РёРіР° СЃ СѓС‡С‘С‚РѕРј trainingFocus вЂ” РµРґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє.
    // (Р Р°РЅРµРµ РґСѓР±Р»СЊ: buildSession СЃС‚Р°РІРёР» charReps в†’ applyPostPhaseProcessing РїРµСЂРµР·Р°РїРёСЃС‹РІР°Р»).
    const phaseCfg = getPhaseConfig(phase, trainingFocus);
    const isAccessory = role === 'accessory';
    const [baseMin, baseMax] = phaseCfg.repRange;
    // Р‘Р°Р·РѕРІС‹Рµ reps: primary = cfg.repRange; accessory = +2 Рє РјРёРЅ, +5 Рє РјР°РєСЃ (РїР°РјРїРёРЅРі)
    const repMin = isAccessory ? baseMin + 2 : baseMin;
    const repMax = isAccessory ? baseMax + 5 : baseMax;
    // FIX-B1: phaseRepShift вЂ” rep range РґРІРёРіР°РµС‚СЃСЏ РїРѕ РЅРµРґРµР»СЏРј РІРЅСѓС‚СЂРё С„Р°Р·С‹.
    // РљР°Рє RIR РґСЂРёС„С‚РёС‚ РІРЅРёР· (drift = floor(phaseWeek/2)), С‚Р°Рє Рё reps СЃРЅРёР¶Р°СЋС‚СЃСЏ
    // РґР»СЏ РїРѕРґРґРµСЂР¶Р°РЅРёСЏ РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚Рё. W1 accumulation = 12 reps, W3 = 11, W5 = 10.
    // deload вЂ” Р±РµР· shift (recovery, РІС‹СЃРѕРєРёР№ reps СЃРѕС…СЂР°РЅС‘РЅ).
    const repShift = phase === 'deload' ? 0 : Math.floor(phaseWeek / 2);
    const shiftedMin = Math.max(3, repMin - repShift);
    const shiftedMax = Math.max(shiftedMin + 2, repMax - repShift);
    // B4: РґР»СЏ non-deload С„Р°Р· РёСЃРїРѕР»СЊР·СѓРµРј shiftedMin (РЅРёР¶РЅСЏСЏ РіСЂР°РЅРёС†Р°) РІРјРµСЃС‚Рѕ midpoint.
    // Р Р°РЅРµРµ midpoint accumulation [10,15] = 12 = repCap РІ prescribeLoad в†’ РЅРµРґРµР»СЏ 2
    // СЃСЂР°Р·Сѓ РїРѕР»СѓС‡Р°Р»Р° +5% РІРµСЃ Рё reps=8 (РЅРµС‚ РѕРєРЅР° РґР»СЏ rep progression).
    // РўРµРїРµСЂСЊ: W1=10, W2=11, W3=12 (prescribeLoad), W4=8+weight jump вЂ” РєРѕСЂСЂРµРєС‚РЅС‹Р№
    // double progression СЃ 3 РЅРµРґРµР»СЏРјРё rep buildup. Deload СЃРѕС…СЂР°РЅСЏРµС‚ midpoint
    // (Р±РѕР»СЊС€Рµ reps = Р»РµРіС‡Рµ РІРµСЃ РґР»СЏ СЂР°Р·РіСЂСѓР·РєРё).
    const reps = phase === 'deload' ? Math.round((shiftedMin + shiftedMax) / 2) : shiftedMin;
    // RIR: bbRir (СѓС‡РёС‚С‹РІР°РµС‚ phase + phaseWeek + С…Р°СЂР°РєС‚РµСЂ + PED РґСЂРёС„С‚). Р”РµР»РѕРґ в†’ RIR 3-4.
    const rir = bbRir(resolved, phase, phaseWeek, trainingFocus, pedDoses, level);
    const wm = workMax[repKey] || PRO_WORKMAX_RATIO[repKey]?.(workMax) || defaultWorkMax(repKey);
    // P1-4 (audit 2026-07): Brzycki inverse %1RM formula вЂ” СЂРµРї-РєРѕСЂСЂРµРєС‚РЅС‹Р№ РІРµСЃ.
    // Р Р°РЅСЊС€Рµ: weight = workMax Г— intensityMult Г— PCT_FOR_RIR[rir] (РЅРµ СѓС‡РёС‚С‹РІР°Р»Р° reps).
    // РўРµРїРµСЂСЊ: weight = workMax Г— (1.0278 в€’ 0.0278 Г— reps) Г— rirAdj Г— intensityMult.
    // Р”Р»СЏ 18 reps в†’ ~52% (РїР°РјРї), РґР»СЏ 6 reps в†’ ~86% (С‚СЏР¶), РґР»СЏ 10 reps в†’ ~75%.
    const pct = PCT_FOR_RIR[rir] ?? 0.9; // fallback РµСЃР»Рё Brzycki РЅРµ РїРѕРґС…РѕРґРёС‚
    let weight = weightForRepMax(reps, wm, rir, phaseCfg.intensityMultiplier);
    // P4: Eccentric overload (Schoenfeld 2021) - advanced/enhanced can handle 110-120% eccentric
    if (eccentricMult && eccentricMult > 1.0 && role === 'primary') {
      weight = Math.round(weight * eccentricMult * 10) / 10;
    }
    // P1-8 (audit 2026-07): pre_exhaust methodology в†’ compound weight Г—0.90.
    // РџРѕСЃР»Рµ pre-exhaust РёР·РѕР»СЏС†РёРё С†РµР»РµРІР°СЏ РјС‹С€С†Р° СѓР¶Рµ СѓС‚РѕРјР»РµРЅР° в†’ compound Fails РЅРёР¶Рµ
    // РѕР±С‹С‡РЅРѕРіРѕ РЅР° ~10-15% (Augustsson 2003; Gentil 2013). РђРІС‚Рѕ-СЃРЅРёР¶РµРЅРёРµ РІРµСЃР° compound.
    if (methodology === 'pre_exhaust' && role === 'primary') {
      weight = Math.round(weight * 0.90 * 10) / 10;
    }
    const accessoryCount = ACCESSORY_2X_GROUPS.has(muscle) ? 2 : 1;
    // exerciseCount Р·Р°РІРёСЃРёС‚ РѕС‚ СѓСЂРѕРІРЅСЏ Р PED вЂ” РЅР° РєСѓСЂСЃРµ Р±РѕР»СЊС€Рµ С‚СЏР¶С‘Р»С‹С… compounds.
    // Р’ multi-РґРЅСЏС… (Push/Pull СЃ 3+ РјС‹С€С†Р°РјРё) РѕРіСЂР°РЅРёС‡РёС‚СЊ big muscle primary РґРѕ 3 вЂ”
    // РѕСЃС‚Р°РІРёС‚СЊ Р±СЋРґР¶РµС‚ РґР»СЏ arms. Р’ solo-РґРЅСЏС… (Chest/Back) вЂ” 4 (РІСЃСЏ СЃРµСЃСЃРёСЏ РЅР° РѕРґРЅСѓ РјС‹С€С†Сѓ).
    const isMultiDay = musclePlans.length > 2;
    const pedBoost = pedAdapt ? Math.max(0, Math.round((pedAdapt.combinedMrvMultiplier - 1.0) / 0.2)) : 0;
    // B13: levelBase РјРѕРЅРѕС‚РѕРЅРЅРѕ СЂР°СЃС‚С‘С‚ СЃ СѓСЂРѕРІРЅРµРј (beginner=1, intermediate=2, advanced=3, enhanced=4).
    const levelBase = level === 'beginner' ? 1 : level === 'intermediate' ? 2 : level === 'enhanced' ? 4 : 3;
    const isSingleFreq = (muscleSessionCount[muscle] || 1) === 1;
    const isArm = ['triceps','biceps','shoulders','forearms','arms'].includes(muscle);
    const isLeg = ['quads','hamstrings','glutes','calves'].includes(muscle);
    const onPED = pedAdapt ? pedAdapt.combinedMrvMultiplier >= 1.3 : false;
    // в… E: РЎРЅРёР¶РµРЅ exerciseCount вЂ” РєР°С‡РµСЃС‚РІРѕ > РєРѕР»РёС‡РµСЃС‚РІРѕ.
    // Primary: 2-4 СѓРїСЂ РЅР° РјС‹С€С†Сѓ (3 РґР»СЏ multi-day, 4 single-freq natural, 5 PED single-freq)
    // Accessory: 1-2 СѓРїСЂ (2 РґР»СЏ arms РЅР° PED)
    // FIX (Р‘Р°Рі 2): СЂР°РЅРµРµ ACCESSORY_2X_GROUPS (delt/biceps/triceps/forearms/shoulders/arms/calves/abs)
    // РЅРµ РІРєР»СЋС‡Р°Р» chest/back/quads/hamstrings/glutes вЂ” Сѓ СЌС‚РёС… Р±РѕР»СЊС€РёС… РјС‹С€С† accessory РІСЃРµРіРґР°
    // Р±С‹Р» exerciseCount=1, РїРѕСЌС‚РѕРјСѓ diversity-Р»РѕРіРёРєР° РІС‹Р±РёСЂР°Р»Р° РћР”РќРћ СѓРїСЂР°Р¶РЅРµРЅРёРµ (РІСЃРµРіРґР° РїРµСЂРІС‹Р№
    // angle-class = fly/СЂР°СЃС‚СЏР¶РєР° РґР»СЏ РіСЂСѓРґРё). Р Р°СЃС€РёСЂСЏРµРј ACCESSORY_2X_GROUPS РЅР° big-muscle
    // accessory С‚РѕР¶Рµ вЂ” РґР°С‘С‚ 2 РёР·РѕР»СЏС†РёРё РЅР° РґРѕР±РёРІРєСѓ, С‡С‚Рѕ СѓСЃС‚СЂР°РЅСЏРµС‚ В«РѕРґРЅР° Рё С‚Р° Р¶Рµ СЂР°СЃС‚СЏР¶РєР°В».
    const isBigMuscle = ['chest','back','quads','hamstrings','glutes','shoulders'].includes(muscle);
    // в… Primary-dominance fix: primary РјС‹С€С†Р° РґРЅСЏ РґРѕР»Р¶РЅР° РёРјРµС‚СЊ Р±РѕР»СЊС€Рµ СѓРїСЂР°Р¶РЅРµРЅРёР№, С‡РµРј
    // Р»СЋР±Р°СЏ accessory. Р Р°РЅСЊС€Рµ РІ multi-day (Pull: back/biceps/shoulders/traps/forearms)
    // primary=3, Р° accessories СЃСѓРјРјР°СЂРЅРѕ = 2+2+2+1 = 7 (back=3 vs accessories=7 вЂ” Р±СЂРµРґ!).
    // РўРµРїРµСЂСЊ: multi-day primary = 4 (РґРѕРјРёРЅРёСЂСѓРµС‚), multi-day accessory = 1 (РґРѕР±РёРІРєР°),
    // РєСЂРѕРјРµ biceps/triceps РЅР° PED (=2). Р’ solo-day (1-2 РјС‹С€С†С‹) вЂ” РєР°Рє СЂР°РЅСЊС€Рµ (accessory=2).
    const backProfile = muscle === 'back' ? backVolumeProfile(level, trainingYears) : { targetMult: 1, capMult: 1, extraExercises: 0 };
    const legProfile = muscle === 'quads' || muscle === 'hamstrings' || muscle === 'glutes' ? legVolumeProfile(level, trainingYears) : { targetMult: 1, capMult: 1, extraExercises: 0 };
    const torsoProfile = muscle === 'chest' || muscle === 'shoulders' ? torsoVolumeProfile(level, trainingYears) : { targetMult: 1, capMult: 1, extraExercises: 0 };
    let exerciseCount = role === 'primary'
      ? (isMultiDay ? 4 : (isSingleFreq ? (onPED ? 4 : 3) : (onPED ? 5 : 4)))
      : (isMultiDay
          ? (isArm && onPED && (muscle === 'biceps' || muscle === 'triceps') ? (level === 'enhanced' && (trainingYears ?? 0) >= 3 ? 1 : 2) : 1)
          : (isArm && onPED ? 4 : (isArm ? 2 : (isBigMuscle ? 2 : 1))));
    // P3: Level-based exerciseCount (Schoenfeld 2022: advanced в†’ more exercises for detail)
    if (levelBase <= 1 && exerciseCount > 2) exerciseCount = Math.max(2, exerciseCount - 1);
    else if (levelBase >= 4 && role === 'primary') exerciseCount = Math.min(8, exerciseCount + 1);
    if (muscle === 'back' && role === 'primary' && backProfile.extraExercises > 0) {
      exerciseCount = Math.min(8, exerciseCount + backProfile.extraExercises);
    }
    // РћРїС‹С‚РЅС‹Р№ enhanced: РЅРѕРіРё РїРѕР»СѓС‡Р°СЋС‚ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ РєР°С‡РµСЃС‚РІРµРЅРЅС‹Рµ СЃР»РѕС‚С‹
    // (РЅРµ С‚РѕР»СЊРєРѕ РѕРґРёРЅ РїСЂРёСЃРµРґ + РёР·РѕР»СЏС†РёСЏ).
    if (['quads', 'hamstrings', 'glutes'].includes(muscle) && role === 'primary' && legProfile.extraExercises > 0) {
      exerciseCount = Math.min(8, exerciseCount + legProfile.extraExercises);
    }
    // РћРїС‹С‚РЅС‹Р№ enhanced: РіСЂСѓРґСЊ/РїР»РµС‡Рё РїРѕР»СѓС‡Р°СЋС‚ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Р№ РєР°С‡РµСЃС‚РІРµРЅРЅС‹Р№ СЃР»РѕС‚
    // РґР»СЏ СЂР°Р·РЅС‹С… СѓРіР»РѕРІ Р¶РёРјР°/РјР°С…РѕРІ, Р° РЅРµ С‚РѕР»СЊРєРѕ РѕРґРёРЅ Р¶РёРј.
    if (['chest', 'shoulders'].includes(muscle) && role === 'primary' && torsoProfile.extraExercises > 0) {
      exerciseCount = Math.min(8, exerciseCount + torsoProfile.extraExercises);
    }
    // Р’ Upper/Lower back РјРѕР¶РµС‚ Р±С‹С‚СЊ РЅРµ lead-РјС‹С€С†РµР№, РЅРѕ РѕРїС‹С‚РЅС‹Р№ enhanced
    // РїСЂРѕС„РёР»СЊ РІСЃС‘ СЂР°РІРЅРѕ С‚СЂРµР±СѓРµС‚ РїРѕР»РЅРѕС†РµРЅРЅРѕРіРѕ back-Р±Р»РѕРєР°, Р° РЅРµ РѕРґРЅРѕРіРѕ
    // СЃР»СѓС‡Р°Р№РЅРѕРіРѕ СѓРїСЂР°Р¶РЅРµРЅРёСЏ РјРµР¶РґСѓ РіСЂСѓРґСЊСЋ Рё СЂСѓРєР°РјРё.
    if (muscle === 'back' && trainingYears !== undefined && trainingYears >= 3 && level === 'enhanced' && role === 'primary') {
      exerciseCount = Math.max(exerciseCount, trainingYears >= 6 ? 7 : 6);
    }
    if (muscle === 'back' && trainingYears !== undefined && trainingYears >= 3 && level === 'enhanced' && role === 'accessory') {
      exerciseCount = Math.max(exerciseCount, trainingYears >= 6 ? 6 : 5);
    }
    // в… B: focusGroup/weakPoint вЂ” Р±РѕР»СЊС€Рµ РЎР•РўРћР’ (РЅРµ СѓРїСЂР°Р¶РЅРµРЅРёР№).
    // РћР±СЉС‘Рј СѓР¶Рµ СѓСЃРёР»РµРЅ С‡РµСЂРµР· sessionShareFor (Г—1.2 weak, Г—1.3 focus).
    // exerciseCount РќР• РїРѕРІС‹С€Р°РµРј вЂ” РєР°С‡РµСЃС‚РІРѕ > РєРѕР»РёС‡РµСЃС‚РІРѕ.
    // selType: primary в†’ compound; accessory в†’ isolation (РЅРѕ РЅР° enhanced/РєСѓСЂСЃРµ вЂ”
    // accessory РјРѕР¶РµС‚ Р±С‹С‚СЊ compound РґР»СЏ Р±РѕР»СЊС€РµРіРѕ РјРµС…Р°РЅРёС‡РµСЃРєРѕРіРѕ РЅР°С‚СЏР¶РµРЅРёСЏ).
    // triceps/biceps РІ Push/Pull-РґРЅСЏС… РјРѕРіСѓС‚ РїРѕР»СѓС‡РёС‚СЊ compound (Р¶РёРј СѓР·РєРёРј С…РІР°С‚РѕРј,
    // РїРѕРґС‚СЏРіРёРІР°РЅРёСЏ РѕР±СЂР°С‚РЅС‹Рј С…РІР°С‚РѕРј) РїСЂРё PED MRVГ—1.3+.
    const allowAccessoryCompound = pedAdapt ? pedAdapt.combinedMrvMultiplier >= 1.3 : false;
    const selType = ALWAYS_ISOLATION.has(muscle) ? 'isolation'
      : (role === 'primary' ? 'compound' : (allowAccessoryCompound && (muscle === 'triceps' || muscle === 'biceps' || muscle === 'back') ? 'compound' : 'isolation'));
    // РџРђРњРџ-РґРЅРё: РґР»СЏ РіР»Р°РІРЅС‹С… РјС‹С€С† СЃРµСЃСЃРёРё СЂР°Р·СЂРµС€РёС‚СЊ compound РІ РїСѓР»Рµ,
    // С‡С‚РѕР±С‹ РїРµСЂРІРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ Р±С‹Р»Рѕ Р±Р°Р·РѕРІС‹Рј (compound-first РїРѕСЂСЏРґРѕРє),
    // РґР°Р¶Рµ РµСЃР»Рё СЂРѕР»СЊ accessory. Р‘РµР· СЌС‚РѕРіРѕ РїР°РјРї-РґРµРЅСЊ РѕС‚РєСЂС‹РІР°РµС‚СЃСЏ РёР·РѕР»СЏС†РёРµР№.
     const highVolumeBack = muscle === 'back' && level === 'enhanced' && (trainingYears ?? 0) >= 3;
     const effectiveSelType = highVolumeBack ? 'any' : ((role === 'accessory' && character === 'РїР°РјРї' && isMainMuscle) ? 'any' : selType);
    // РљРѕСЂРµРЅСЊ С„РёРєСЃР°: РїСѓР» СЃС‚СЂРѕРёС‚СЃСЏ РїРѕ РРЎРўРРќРќРћР™ РјС‹С€С†Рµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ (movementPattern +
    // targetMuscle), Р° РЅРµ РїРѕ РєРѕРјРїРѕР·РёС‚РЅРѕР№ РіСЂСѓРїРїРµ РєР°С‚Р°Р»РѕРіР°. Р­С‚Рѕ СѓСЃС‚СЂР°РЅСЏРµС‚
    // РЅРµРІРµСЂРЅСѓСЋ Р°С‚СЂРёР±СѓС†РёСЋ (leg curl в†’ В«calvesВ», farmer walk в†’ В«bicepsВ»,
    // good morning в†’ В«quadsВ») Рё РёСЃРєР»СЋС‡Р°РµС‚ РџР›-РґРІРёР¶РµРЅРёСЏ (carry/hinge/СЃС‚Р°РЅРѕРІР°СЏ).
    // 3.1 вЂ” РІС‹РЅРµСЃРµРЅРЅС‹Р№ СЃР»РѕР№ selection: buildExercisePool (РїСѓР» + fallback + СЃРєРѕСЂ + generic-С„РёР»СЊС‚СЂ)
    const roleMuscles = musclesForRole(repKey);
    const tag = (sched.sessionTag || '').toLowerCase();
    const isPurePull = /pull|back/.test(tag) && !/push|chest/.test(tag);
    let pool = buildExercisePool(muscle, role, {
      level, roleMuscles, sessionTag: sched.sessionTag, allowExotic,
      allowStrengthLifts, isPurePull, equipmentList, excludeIds,
      avoidAxialLoad, mobilityRestrictions, bodyweightCapability,
      favoriteIds, muscle, focusGroup, weakPoints, fewerCompound,
      pedDoses, labMrvMultiplier,
    });
    // Pro primary: С‚РѕР»СЊРєРѕ РєР°РЅРѕРЅРёС‡РµСЃРєРёРµ tier 1, РёРЅР°С‡Рµ tier 1-2, С‡С‚РѕР±С‹ hex/svend/TRX РЅРµ Р»РµР·Р»Рё РІ primary Pro
    if (role === 'primary' && (level === 'advanced' || level === 'enhanced')) {
      const tier1 = pool.filter(e => bbExerciseTier(e) === 1);
      if (tier1.length >= exerciseCount) pool = tier1;
      else {
        const tier12 = pool.filter(e => bbExerciseTier(e) <= 2);
        if (tier12.length >= exerciseCount) pool = tier12;
      }
    }

    // 3.1 вЂ” РІС‹РЅРµСЃРµРЅРЅС‹Р№ СЃР»РѕР№ selection: selectExercisesForMuscle (selectExercisesSmart + С„РёРєСЃР°С†РёСЏ РІС‹Р±РѕСЂР°)
    let selected = selectExercisesForMuscle(pool, muscle, exerciseCount, {
      sessionSelectedIds, sessionSelectedNames,
      equipment: equipmentList, weakZones: weakPoints, level, injuryProfile,
      type: effectiveSelType, targetRir: rir,
      favoriteIds, excludeIds, avoidAxialLoad,
      preferEquipment: PHASE_EQUIPMENT_PREF[phase],
    });
    let exDatas = selected.length > 0 ? selected : [pool[0] || { id: muscle, name: muscle, fatigueCost: 5, _score: 0 }];
    // Keep the first compound stable for the same session slot across weeks;
    // accessory movements remain eligible for phase rotation.
    const primarySlot = `${phase}|${sched.sessionTag || dayInRotation}|${muscle}`;
    const stablePrimary = primaryBySlot.get(primarySlot);
    if (stablePrimary && (muscle === sessionLeadMuscle || (exDatas[0] as any)?.type === 'compound')) {
      const stable = pool.find(ex => ex.name === stablePrimary);
      if (stable) {
        exDatas = [stable, ...exDatas.filter(ex => ex.name !== stable.name)].slice(0, exerciseCount);
      }
    } else if ((exDatas[0] as any)?.type === 'compound' && muscle !== 'traps' && muscle !== 'calves' && muscle !== 'forearms') {
      primaryBySlot.set(primarySlot, (exDatas[0] as any).name);
    }
    // Freshness guard: РЅРµ РїРѕРІС‚РѕСЂСЏС‚СЊ СѓРїСЂР°Р¶РЅРµРЅРёРµ РІ С‚РѕР№ Р¶Рµ РЅРµРґРµР»Рµ РЅР° С‚РѕР№ Р¶Рµ РјС‹С€С†Рµ.
     {
       const weekUsedForMuscle = weekLocalUsed.get(muscle) || new Set<string>();
       const fresh = exDatas.filter(d => !weekUsedForMuscle.has((d as any).name || ''));
       // Р”Р»СЏ high-volume enhanced back РЅРµ СЃРѕРєСЂР°С‰Р°РµРј РІС‚РѕСЂРѕР№ back-РґРµРЅСЊ РґРѕ
       // РѕРґРЅРѕРіРѕ СѓРїСЂР°Р¶РЅРµРЅРёСЏ РёР·-Р·Р° freshness-guard: РїРѕРІС‚РѕСЂ РїР°С‚С‚РµСЂРЅР° РјРµР¶РґСѓ
       // СЃРµСЃСЃРёСЏРјРё РґРѕРїСѓСЃС‚РёРј, Р° РЅРµРґРѕР±РѕСЂ РЅРµРґРµР»СЊРЅРѕРіРѕ Р±СЋРґР¶РµС‚Р° вЂ” РЅРµС‚.
        // High-volume enhanced РїСЂРѕС„РёР»Рё РЅРµ РґРѕР»Р¶РЅС‹ С‚РµСЂСЏС‚СЊ СѓРїСЂР°Р¶РЅРµРЅРёРµ РёР·-Р·Р°
        // РЅРµРґРµР»СЊРЅРѕР№ СЂРѕС‚Р°С†РёРё: РѕР±СЉС‘Рј СЂР°СЃРїСЂРµРґРµР»СЏРµС‚СЃСЏ РїРѕ СЂРµР°Р»СЊРЅС‹Рј РґРІРёР¶РµРЅРёСЏРј,
        // Р° РЅРµ РїСЂРµРІСЂР°С‰Р°РµС‚СЃСЏ РІ 1 СѓРїСЂР°Р¶РЅРµРЅРёРµ Г— РЅРµСЃРєРѕР»СЊРєРѕ РїРѕРґС…РѕРґРѕРІ.
        const preserveHighVolume = level === 'enhanced' && (trainingYears ?? 0) >= 3 &&
          ['back', 'quads', 'hamstrings', 'glutes', 'chest', 'shoulders'].includes(muscle);
        if (fresh.length > 0 && !preserveHighVolume) exDatas = fresh;
      for (const d of exDatas) weekUsedForMuscle.add((d as any).name || '');
      weekLocalUsed.set(muscle, weekUsedForMuscle);
    }
    // Phase-aware equipment hard bias: РµСЃР»Рё РїРµСЂРІРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ РќР• РёР· preferred-СЃРїРёСЃРєР° С„Р°Р·С‹ вЂ”
    // РїРѕРґРЅРёРјР°РµРј Р±Р»РёР¶Р°Р№С€РµРµ РїРѕРґС…РѕРґСЏС‰РµРµ РЅР° РїРµСЂРІРѕРµ РјРµСЃС‚Рѕ (РЅРµ СѓРґР°Р»СЏСЏ РѕСЃС‚Р°Р»СЊРЅС‹Рµ).
    {
      const phaseEquip = PHASE_EQUIPMENT_PREF[phase] || ['barbell','dumbbell','machine','cable'];
      if (phaseEquip.length > 0 && exDatas.length > 1) {
        const firstEq = String((exDatas[0] as any)?.equipment || '').toLowerCase();
        const firstOk = phaseEquip.some(eq => firstEq.includes(eq));
        if (!firstOk) {
          const betterIdx = exDatas.findIndex((d: any) => {
            const eq = String(d.equipment || '').toLowerCase();
            return phaseEquip.some(p => eq.includes(p));
          });
          if (betterIdx > 0) { const [moved] = exDatas.splice(betterIdx, 1); exDatas.unshift(moved); }
        }
      }
    }
    // Movement-pattern diversity: РјРёРЅРёРјСѓРј 2 СѓРЅРёРєР°Р»СЊРЅС‹С… РїР°С‚С‚РµСЂРЅР° РІ СЃРµСЃСЃРёРё.
    {
      const patts = new Set(exDatas.map(d => derivePattern(d as any)));
      if (patts.size < 2 && pool.length > 1) {
        const usedNames = new Set(exDatas.map(d => (d as any).name || ''));
        const alt = pool.find(d => !usedNames.has((d as any).name || '') && !patts.has(derivePattern(d as any)) && !rotationNamesSet.has((d as any).name || '') && !sessionSelectedNames.includes((d as any).name || ''));
        if (alt && exDatas.length > 0) { exDatas[exDatas.length - 1] = alt; patts.add(derivePattern(alt)); }
      }
    }
    // РЎРѕС…СЂР°РЅСЏРµРј rationale РІС‹Р±РѕСЂР° РґР»СЏ РєР°Р¶РґРѕРіРѕ СѓРїСЂР°Р¶РЅРµРЅРёСЏ
    const rationaleMap = new Map<string, string>();
    for (const s of selected) {
      if (s.selectionRationale?.length) rationaleMap.set(s.name, s.selectionRationale.join('; '));
    }

    // Shoulders diversity: РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ 1 Р¶РёРј (front) + 1 РјР°С…Рё (mid) + РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ Р·Р°РґРЅСЏСЏ (rear).
    // Rear delt вЂ” РўРћР›Р¬РљРћ РІ Pull/Back-РґРЅСЏС… (РіРґРµ РѕРЅР° РµСЃС‚РµСЃС‚РІРµРЅРЅРѕ СЂР°Р±РѕС‚Р°РµС‚ СЃРѕ СЃРїРёРЅРѕР№).
    // Р’ Push/Chest/Shoulders-РґРЅСЏС… вЂ” С‚РѕР»СЊРєРѕ press + lateral (mid delt), Р±РµР· rear.
    // РЎРњР•Р©Р•РќРР•: СЂР°Р·РЅРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ РёР· РєР°Р¶РґРѕРіРѕ РїСѓС‡РєР° РґР»СЏ СЂР°Р·РЅС‹С… СЃРµСЃСЃРёР№/РЅРµРґРµР»СЊ
    if (muscle === 'shoulders' && exerciseCount >= 2 && pool.length >= 2) {
      const isPress = (e: any) => /Р¶РёРј|press|Р°СЂРјРµР№|overhead/i.test(e.name || '');
      const isLateral = (e: any) => /РјР°С…|РїРѕРґСЉРµРј|РѕС‚РІРµРґРµРЅРёРµ|lateral|raise|side/i.test(e.name || '');
      const isRear = (e: any) => isRearDeltExercise(e.name || '');
      // Rear delt С‚РѕР»СЊРєРѕ РІ Pull/Back-РґРЅСЏС…
      const tag = (sched.sessionTag || '').toLowerCase();
      const allowRear = tag.includes('pull') || tag.includes('back') || tag === 'back';
      const presses = pool.filter(e => isPress(e) && !isLateral(e) && !isRear(e) && !sessionSelectedIds.includes(e.id) && !sessionSelectedNames.includes(e.name)).sort((a,b) => bbExerciseTier(a) - bbExerciseTier(b));
      const laterals = pool.filter(e => isLateral(e) && !isPress(e) && !isRear(e) && !sessionSelectedIds.includes(e.id) && !sessionSelectedNames.includes(e.name)).sort((a,b) => bbExerciseTier(a) - bbExerciseTier(b));
      const rears = allowRear ? pool.filter(e => isRear(e) && !isPress(e) && !isLateral(e) && !sessionSelectedIds.includes(e.id) && !sessionSelectedNames.includes(e.name)).sort((a,b) => bbExerciseTier(a) - bbExerciseTier(b)) : [];
      const diverse: any[] = [];
      // Press (front delt) вЂ” 1-2 СѓРїСЂР°Р¶РЅРµРЅРёСЏ РµСЃР»Рё primary
      if (presses.length > 0) {
        const p1 = (selWeek*31+dayInRotation*17) % presses.length;
        diverse.push(presses[p1]); sessionSelectedIds.push(presses[p1].id); sessionSelectedNames.push(presses[p1].name);
        // РќР° enhanced вЂ” 2 Р¶РёРјР° (СЂР°Р·РЅС‹Рµ СѓРіР»С‹)
        if (exerciseCount >= 4 && presses.length > 1) {
          const p2 = (p1 + 1 + Math.floor(presses.length / 2)) % presses.length;
          if (presses[p2] && !diverse.some(d => d.id === presses[p2].id)) {
            diverse.push(presses[p2]); sessionSelectedIds.push(presses[p2].id); sessionSelectedNames.push(presses[p2].name);
          }
        }
      }
      // Lateral (mid delt) вЂ” 1-2 СѓРїСЂР°Р¶РЅРµРЅРёСЏ (РІСЃРµРіРґР°, mid delt РЅСѓР¶РЅР° РІРѕ РІСЃРµС… РґРЅСЏС… РїР»РµС‡)
      if (laterals.length > 0) {
        const l1 = (selWeek*31+dayInRotation*17+7) % laterals.length;
        diverse.push(laterals[l1]); sessionSelectedIds.push(laterals[l1].id); sessionSelectedNames.push(laterals[l1].name);
        // РќР° enhanced вЂ” 2 РјР°С…Р° (СЂР°Р·РЅС‹Рµ СѓРіР»С‹/СЃРЅР°СЂСЏРґС‹)
        if (exerciseCount >= 4 && laterals.length > 1) {
          const l2 = (l1 + 2) % laterals.length;
          if (laterals[l2] && !diverse.some(d => d.id === laterals[l2].id)) {
            diverse.push(laterals[l2]); sessionSelectedIds.push(laterals[l2].id); sessionSelectedNames.push(laterals[l2].name);
          }
        }
      }
      // Rear delt вЂ” С‚РѕР»СЊРєРѕ РІ Pull/Back
      if (allowRear && rears.length > 0) {
        const r1 = (selWeek*31+dayInRotation*17+13) % rears.length;
        diverse.push(rears[r1]); sessionSelectedIds.push(rears[r1].id); sessionSelectedNames.push(rears[r1].name);
      }
      // Р”РѕР±СЂР°С‚СЊ РґРѕ exerciseCount РµСЃР»Рё РЅРµ С…РІР°С‚РёР»Рѕ.
      // Р’РђР–РќРћ: РІ Push/Chest-РґРЅСЏС… РёСЃРєР»СЋС‡Р°РµРј rear delt (РѕРЅР° С‚СЂРµРЅРёСЂСѓРµС‚СЃСЏ РІ Pull-РґРЅРµ).
      for (const e of pool) {
        if (diverse.length >= exerciseCount) break;
        if (!diverse.some(d => d.id === e.id) && !sessionSelectedIds.includes(e.id)) {
          // Р—Р°РїСЂРµС‚ rear delt РІ РЅРµ-Pull-РґРЅСЏС…
          if (!allowRear && isRear(e)) continue;
          diverse.push(e); sessionSelectedIds.push(e.id); sessionSelectedNames.push(e.name);
        }
      }
      if (diverse.length >= exerciseCount) {
        exDatas = diverse.slice(0, exerciseCount);
        // P4: РґРёС„С„РµСЂРµРЅС†РёСЂСѓРµРј СЂР°Р±РѕС‡РёР№ РІРµСЃ РїРѕ РїСѓС‡РєР°Рј РґРµР»СЊС‚С‹ (Р¶РёРј С‚СЏР¶РµР»РµРµ РјР°С…РѕРІ/Р·Р°РґРЅРµР№ РґРµР»СЊС‚С‹).
        // PRO_WORKMAX_RATIO: delt_front 0.50, delt_mid 0.45, delt_rear 0.35 в†’
        // РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ delt_front: РіРѕР»РѕРІРЅРѕР№ РєРѕСЌС„С„РёС†РёРµРЅС‚ 1.0 / 0.9 / 0.7.
        // P5: РґРёС„С„РµСЂРµРЅС†РёСЂСѓРµРј RIR вЂ” Р¶РёРј С‚СЏР¶ (Р±Р°Р·РѕРІС‹Р№ RIR), РјР°С…Рё/Р·Р°РґРЅСЏСЏ РґРµР»СЊС‚Р° РїР°РјРї (RIR+1).
        for (const d of exDatas) {
          let headRatio = 1.0, headRirDelta = 0;
          if (isPress(d) && !isLateral(d) && !isRear(d)) { headRatio = 1.0; headRirDelta = 0; }
          else if (isLateral(d) && !isPress(d) && !isRear(d)) { headRatio = 0.9; headRirDelta = 1; }
          else if (isRear(d) && !isPress(d) && !isLateral(d)) { headRatio = 0.7; headRirDelta = 1; }
          (d as any)._effWeight = Math.round(weight * headRatio * 10) / 10;
          (d as any)._deltRir = Math.min(5, rir + headRirDelta);
        }
      }
    }

    // P9: MULTI-ANGLE diversity вЂ” РіР°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅРѕРµ РїРѕРєСЂС‹С‚РёРµ СЂР°Р·РЅС‹С… СѓРіР»РѕРІ/РїР°С‚С‚РµСЂРЅРѕРІ.
    // Р”Р»СЏ РєР°Р¶РґРѕР№ РјС‹С€С†С‹ вЂ” 3-4 СЂР°Р·РЅС‹С… СѓРіР»Р°/РїР°С‚С‚РµСЂРЅР°, РЅРµ РїСЂРѕСЃС‚Рѕ "compound + isolation".
    // Р­С‚Рѕ СѓСЃС‚СЂР°РЅСЏРµС‚ "3 Р¶РёРјР° Р»С‘Р¶Р° РїРѕРґСЂСЏРґ" Рё РѕР±РµСЃРїРµС‡РёРІР°РµС‚ РїРѕР»РЅРѕС†РµРЅРЅРѕРµ СЂР°Р·РІРёС‚РёРµ.
    // ANGLE_CLASSES РёРјРїРѕСЂС‚РёСЂРѕРІР°РЅ РёР· bb-exercise-selection.engine.ts (РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РёСЃС‚РёРЅС‹).
    if (exerciseCount >= 2 && pool.length >= 2 && muscle !== 'shoulders') {
      const classes = ANGLE_CLASSES[muscle];
      if (classes && classes.length > 0) {
        const diverse: any[] = [];
        const usedIds = new Set<string>();
        const usedClassIdx = new Set<number>();
        // Р‘РµСЂС‘Рј РїРѕ 1 СѓРїСЂР°Р¶РЅРµРЅРёСЋ РёР· РєР°Р¶РґРѕРіРѕ СѓРіР»Р°, РїРѕРєР° РЅРµ РЅР°Р±РµСЂС‘Рј exerciseCount.
        // РЎРѕСЂС‚РёСЂРѕРІРєР° РІРЅСѓС‚СЂРё СѓРіР»Р°: compound barbell в†’ dumbbell в†’ machine в†’ cable в†’ one-arm.
        // РџРµСЂРІРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ РјС‹С€С†С‹ = СЃР°РјРѕРµ С‚СЏР¶С‘Р»РѕРµ (РјР°РєСЃРёРјР°Р»СЊРЅРѕРµ РјРµС…Р°РЅРёС‡РµСЃРєРѕРµ РЅР°С‚СЏР¶РµРЅРёРµ).
        for (let ci = 0; ci < classes.length; ci++) {
          const ac = classes[ci];
          if (diverse.length >= exerciseCount) break;
           let candidates = pool.filter(e => ac.match(e) && !usedIds.has(e.id) && (relaxBackRotation && muscle === 'back' ? true : !rotationNamesSet.has(e.name)));
          // _score BB-РїСЂРёРѕСЂРёС‚РµС‚ Р’РЎР•Р“Р”Рђ (hack +15 > barbell -10, incline +15 > flat -10)
          // FIX-B4: lengthenedBonus вЂ” +10 РґР»СЏ СѓРїСЂР°Р¶РЅРµРЅРёР№ РІ СЂР°СЃС‚СЏРЅСѓС‚РѕР№ РїРѕР·РёС†РёРё
          // (Schoenfeld 2022, Maeo 2023: lengthened-position в†’ Р±РѕР»СЊС€Рµ РіРёРїРµСЂС‚СЂРѕС„РёРё).
          candidates = candidates.sort((a, b) => {
            const sa = (a as any)._score ?? 0;
            const sb = (b as any)._score ?? 0;
            const la = lengthenedBonus(a.name || '', trainingFocus);
            const lb = lengthenedBonus(b.name || '', trainingFocus);
            const saTotal = sa + la;
            const sbTotal = sb + lb;
            if (saTotal !== sbTotal) return sbTotal - saTotal;
            const rankDiff = strengthRank(a) - strengthRank(b);
            if (rankDiff !== 0) return rankDiff;
            // tie-break by coaching tier: canonical (barbell bench) before acceptable (reverse-grip bench)
            // so a niche/advanced lift doesn't lead a day over the canonical compound at the same load.
            const tierDiff = bbExerciseTier(a) - bbExerciseTier(b);
            if (tierDiff !== 0) return tierDiff;
            const weakDiff = weakExerciseBonus(b.name || '', weakPoints) - weakExerciseBonus(a.name || '', weakPoints);
            return weakDiff;
          });
          if (candidates.length > 0) {
            // Р”Р»СЏ РїРµСЂРІРѕРіРѕ СѓРїСЂР°Р¶РЅРµРЅРёСЏ (ci=0) вЂ” РІСЃРµРіРґР° Р±СЂР°С‚СЊ СЃР°РјРѕРµ С‚СЏР¶С‘Р»РѕРµ (rank 1-2).
            // Р”Р»СЏ РїРѕСЃР»РµРґСѓСЋС‰РёС… вЂ” offset РґР»СЏ РІР°СЂРёР°С‚РёРІРЅРѕСЃС‚Рё РјРµР¶РґСѓ РЅРµРґРµР»СЏРјРё.
            const offset = ci === 0 ? 0 : (selWeek * 31 + dayInRotation * 17 + ci * 7) % Math.max(1, candidates.length);
            const pick = candidates[offset];
            diverse.push(pick);
            usedIds.add(pick.id);
            usedClassIdx.add(ci);
            sessionSelectedIds.push(pick.id);
            sessionSelectedNames.push(pick.name);
          }
        }
        // Fallback: РµСЃР»Рё РєР»Р°СЃСЃ РїСѓСЃС‚ (РІСЃРµ РёСЃРєР»СЋС‡РµРЅС‹ СЂРѕС‚Р°С†РёРµР№) вЂ” РІР·СЏС‚СЊ РёР· РєР»Р°СЃСЃР° Р±РµР· С„РёР»СЊС‚СЂР° СЂРѕС‚Р°С†РёРё
        for (let ci = 0; ci < classes.length; ci++) {
          const ac = classes[ci];
          if (diverse.length >= exerciseCount) break;
          if (usedClassIdx.has(ci)) continue;
           let candidates = pool.filter(e => ac.match(e) && !usedIds.has(e.id));
          candidates = candidates.sort((a, b) => {
            const sa = (a as any)._score ?? 0;
            const sb = (b as any)._score ?? 0;
            if (sa !== sb) return sb - sa;
            const rankDiff = strengthRank(a) - strengthRank(b);
            if (rankDiff !== 0) return rankDiff;
            const tierDiff = bbExerciseTier(a) - bbExerciseTier(b);
            if (tierDiff !== 0) return tierDiff;
            return weakExerciseBonus(b.name || '', weakPoints) - weakExerciseBonus(a.name || '', weakPoints);
          });
          if (candidates.length > 0) {
            const offset = ci === 0 ? 0 : (selWeek * 31 + dayInRotation * 17 + ci * 7 + 3) % Math.max(1, candidates.length);
            const pick = candidates[offset];
            diverse.push(pick);
            usedIds.add(pick.id);
            usedClassIdx.add(ci);
            sessionSelectedIds.push(pick.id);
            sessionSelectedNames.push(pick.name);
          }
        }
        // Р”РѕР±СЂР°С‚СЊ РёР· РѕСЃС‚Р°С‚РєР° РїСѓР»Р°, РµСЃР»Рё РЅРµ РЅР°Р±СЂР°Р»Рё вЂ” С‚РѕР»СЊРєРѕ РёР· РЅРµРёСЃРїРѕР»СЊР·РѕРІР°РЅРЅС‹С… СѓРіР»РѕРІ (РЅРµ РґСѓР±Р»РёСЂСѓРµРј РїР°С‚С‚РµСЂРЅ)
        for (const e of pool) {
          if (diverse.length >= exerciseCount) break;
          if (usedIds.has(e.id) || sessionSelectedIds.includes(e.id)) continue;
          const clsIdx = classes.findIndex(c => c.match(e));
          if (clsIdx >= 0 && usedClassIdx.has(clsIdx)) continue;
          diverse.push(e); usedIds.add(e.id);
          if (clsIdx >= 0) usedClassIdx.add(clsIdx);
          sessionSelectedIds.push(e.id); sessionSelectedNames.push(e.name);
        }
        if (diverse.length >= Math.min(2, exerciseCount)) {
          exDatas = diverse.slice(0, exerciseCount);
        }
        // Lead-muscle compound does not rotate: the day's main lift (RDL / close-grip bench /
        // OHP / squat) opens the session even if it was used in a prior session this week вЂ”
        // main lifts repeat; variety is for accessories. Stops an isolation (leg curl / french
        // press) leading an alternate hamstrings / arms day after rotation exhausts the compound.
        if (muscle === leadMuscle && exDatas.length > 0 && (exDatas[0] as any).type !== 'compound') {
          const ciComp = exDatas.findIndex((d: any) => (d as any).type === 'compound');
          if (ciComp > 0) { const [c] = exDatas.splice(ciComp, 1); exDatas.unshift(c); }
          else {
            const comp = pool.find((d: any) => (d as any).type === 'compound' && !usedIds.has((d as any).id) && !sessionSelectedIds.includes((d as any).id));
            if (comp) { exDatas[0] = comp; usedIds.add(comp.id); sessionSelectedIds.push(comp.id); sessionSelectedNames.push(comp.name); }
          }
        }
      }
    }

    // Back high-volume composition: РµСЃР»Рё rotation/selector РѕСЃС‚Р°РІРёР»Рё СЃР»РёС€РєРѕРј
    // РјР°Р»Рѕ РґРІРёР¶РµРЅРёР№, РґРѕР±РёСЂР°РµРј С‚РѕР»СЊРєРѕ РЅРµРїРѕРІС‚РѕСЂСЏСЋС‰РёРµСЃСЏ С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅС‹Рµ РєР»Р°СЃСЃС‹.
    if (muscle === 'back' && level === 'enhanced' && (trainingYears ?? 0) >= 3) {
      const targetExercises = Math.min((trainingYears ?? 0) >= 6 ? 7 : 6, exerciseCount);
      const used = new Set(exDatas.map(e => e.id));
      for (const ac of ANGLE_CLASSES.back) {
        if (exDatas.length >= targetExercises) break;
        const candidate = [...pool, ...EXERCISE_CATALOG].find(e => !used.has(e.id) && trueMuscleOf(e) === 'back' && !isBBJunk(e) && ac.match(e));
        if (!candidate) continue;
        exDatas.push(candidate);
        used.add(candidate.id);
      }
    }

    // Per-exercise weight modifier. Evidence-based:
    //  - РЅР°РєР»РѕРЅ 30В°: -5-10% vs flat (Biel 2017), РЅРµ -15%
    //  - РјР°С€РёРЅР°: СЃС‚Р°Р±РёР»СЊРЅРµРµ в†’ 1RM ~85% СЃРІРѕР±РѕРґРЅС‹С… (Schoenfeld 2021)
    //  - РєР°Р±РµР»СЊ: ~80% СЃРІРѕР±РѕРґРЅС‹С… (constant tension, Schoenfeld 2021)
    //  - РЎРјРёС‚: ~90% (С„РёРєСЃРёСЂРѕРІР°РЅРЅР°СЏ С‚СЂР°РµРєС‚РѕСЂРёСЏ, Р±РѕР»СЊС€Рµ СЃС‚Р°Р±РёР»СЊРЅРѕСЃС‚Рё)
    //  - РіР°РЅС‚РµР»Рё: ~80% (СЃС‚Р°Р±РёР»РёР·Р°С†РёСЏ, РЅРµР№С‚СЂР°Р»СЊРЅС‹Р№ С…РІР°С‚)
    function weightModFor(exName: string): number {
      const n = (exName || '').toLowerCase();
      if (n.includes('РіР°РЅС‚РµР»') || n.includes('dumbbell')) return 0.80;
      if (n.includes('РЅР°РєР»РѕРЅ') || n.includes('incline')) return 0.95;
      if (n.includes('СЃРјРёС‚') || n.includes('smith')) return 0.90;
      if (n.includes('С‚СЂРµРЅ') || n.includes('РјР°С€РёРЅ') || n.includes('machine')) return 0.85;
      if (n.includes('Р±Р»РѕРє') || n.includes('РєР°Р±РµР»СЊ') || n.includes('cable') || n.includes('РєСЂРѕСЃСЃРѕРІ')) return 0.80;
      return 1.0;
    }
    for (const d of exDatas) (d as any)._weightMod = weightModFor((d as any).name || '');

    // P0-1 (audit 2026-07): _pumpOverride РЈР‘Р РђРќ вЂ” РјРµС…Р°РЅРёС‡РµСЃРєРѕРµ РЅР°С‚СЏР¶РµРЅРёРµ (Schoenfeld 2010/2017,
    // РїРѕСЃР»РµРґРЅРёР№ С‚СЏР¶-СЃРµС‚ вЂ” РіР»Р°РІРЅС‹Р№ РґСЂР°Р№РІРµСЂ РіРёРїРµСЂС‚СЂРѕС„РёРё). РџР°РјРї РґРѕР±РёСЂР°РµС‚СЃСЏ РѕС‚РґРµР»СЊРЅРѕР№ РёР·РѕР»СЏС†РёРµР№
    // С‡РµСЂРµР· A1 pump-finisher / fix K (L1501-1558, L1943-2000), Р° РЅРµ Р—РђРњР•РќРЇР•Рў С‚СЏР¶.

    // P1 + BUG-B7: DUP-РІРѕР»РЅР° РїРѕРІС‚РѕСЂРµРЅРёР№ РІРЅСѓС‚СЂРё С„Р°Р·С‹ (РЅРµРґРµР»СЊРЅР°СЏ РІР°СЂРёР°С†РёСЏ).
    // Р Р°РЅРЅРёРµ РЅРµРґРµР»Рё С„Р°Р·С‹ в†’ Р±РѕР»СЊС€Рµ РїРѕРІС‚РѕСЂРµРЅРёР№ (РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєРёР№ СЃС‚СЂРµСЃСЃ),
    // РїРѕР·РґРЅРёРµ в†’ РјРµРЅСЊС€Рµ (РјРµС…Р°РЅРёС‡РµСЃРєРѕРµ РЅР°С‚СЏР¶РµРЅРёРµ). РђРЅР°Р»РѕРі getDupReps РІ phase-periodization.
    // BUG-B7: РІ deload reps РґРѕР»Р¶РЅС‹ Р РђРЎРўР (recovery), Р° РЅРµ РїР°РґР°С‚СЊ.
    //   Р Р°РЅСЊС€Рµ: offset = -floor((phaseWeek-1)Г—1.5) в†’ РІСЃРµРіРґР° РѕС‚СЂРёС†Р°С‚РµР»СЊРЅС‹Р№ в†’
    //   deload wk4 = 12-4 = 8 (РІРјРµСЃС‚Рѕ 16-20 recovery-РїРѕРІС‚РѕСЂРѕРІ).
    // РўРµРїРµСЂСЊ: deload в†’ +offset (СЂР°СЃС‚С‘Рј Рє РєРѕРЅС†Сѓ deload-РЅРµРґРµР»Рё = РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ),
    //          accumulation/intensification/peaking в†’ -offset (РјРµС…Р°РЅРёС‡РµСЃРєРѕРµ РЅР°С‚СЏР¶РµРЅРёРµ СЂР°СЃС‚С‘С‚).
    const dupSign = phase === 'deload' ? +1 : -1;
    const dupRepsOffset = phaseCfg && phaseWeek > 1 ? dupSign * Math.floor((phaseWeek - 1) * 1.5) : 0;

    // P7: phaseExerciseMix вЂ” РїСЂРёРѕСЂРёС‚РµС‚ equipment РїРѕ С„Р°Р·Рµ (accumulationв†’cable, peakingв†’barbell).
    // Р­С‚Рѕ С„РѕСЂРјРёСЂСѓРµС‚ РїСЂРѕРїРѕСЂС†РёСЋ compound/isolation/cable/machine, Р·Р°СЏРІР»РµРЅРЅСѓСЋ РІ PHASE_CONFIGS.
    const phaseEquip = PHASE_EQUIPMENT_PREF[phase] || ['barbell', 'dumbbell', 'machine', 'cable'];

    // Р–С‘СЃС‚РєРёРµ РіСЂСѓРїРїС‹ Р·Р°РјРµРЅС‹ (С‚СЂРµР±РѕРІР°РЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ): РєР°Р¶РґР°СЏ РіСЂСѓРїРїР° РјС‹С€С†С‹,
    // РґРѕСЃС‚СѓРїРЅР°СЏ РІ РїСѓР»Рµ, РѕР±СЏР·Р°РЅР° Р±С‹С‚СЊ РїСЂРµРґСЃС‚Р°РІР»РµРЅР° РІ СЃРµСЃСЃРёРё primary-РјС‹С€С†С‹
    // (СЂРѕС‚Р°С†РёСЏ вЂ” РІРЅСѓС‚СЂРё РіСЂСѓРїРїС‹; Р·Р°РјРµРЅР° Р±РµР· РёР·РјРµРЅРµРЅРёСЏ С‡РёСЃР»Р° СѓРїСЂР°Р¶РЅРµРЅРёР№).
    // РЎРїРµС†РёР°Р»РёР·Р°С†РёСЏ: РїРѕРєСЂС‹С‚РёРµ С‚РѕР»СЊРєРѕ РґР»СЏ С†РµР»РµРІС‹С… РјС‹С€С† РЅРµРґРµР»Рё (РЅРµ-С†РµР»Рё РґРµСЂР¶Р°С‚ MEV).
    const isSpecTarget = specialization
      ? (isWeak(muscle, weakPoints) || (focusGroup ? collapseKey(focusGroup) === muscle : false))
      : true;
    if (isSpecTarget && !skipStrictCoverage) {
      ensureStrictGroupCoverage(exDatas, pool, muscle, exerciseCount, sessionSelectedIds, sessionSelectedNames, { isPrimary: role === 'primary' });
    }

    const expectedFatigue = exerciseCount * (sets / exerciseCount) * (((exDatas[0] as any)?.fatigueCost || 5));
    totalExpectedFatigue += expectedFatigue;
    plans.push({ muscle, resolved, role, sets, exerciseCount, rir, reps, weight, pool, exDatas, selType, rationaleMap, phaseEquip });
  }

  // FB: С„РёРЅР°Р»СЊРЅР°СЏ РїСЂРѕРІРµСЂРєР° вЂ” Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅС‹Рµ РјС‹С€С†С‹ РќР• РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ primary.
  // Р•СЃР»Рё РїРѕ РєР°РєРѕР№-С‚Рѕ РїСЂРёС‡РёРЅРµ role='primary' РґР»СЏ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅРѕР№ РјС‹С€С†С‹ вЂ” РїРѕРЅРёР·РёС‚СЊ РґРѕ accessory.
  if (sched.sessionTag === 'FullBody') {
    const fbSchedule = [['chest', 'back'], ['quads', 'hamstrings'], ['shoulders', 'arms']];
    const fbPrimary = fbSchedule[(dayInRotation - 1) % fbSchedule.length];
    for (const pl of plans) {
      if (!fbPrimary.includes(pl.muscle) && pl.role === 'primary') {
        pl.role = 'accessory';
      }
    }
  }

  // Apply substitution for graded injuries: replace exercises and adjust loads
  for (const pl of plans) {
    const phaseCfg = getPhaseConfig(phase, trainingFocus);
    const isGraded = gradedInjuries.some(inj => collapseKey(inj.muscle) === pl.muscle);
    const injuryFactor = gradedInjuries.find(inj => collapseKey(inj.muscle) === pl.muscle);
    if (isGraded && injuryFactor) {
      const postInjuryVolPct = getInjuryVolumeFactor(injuryFactor, today || todayStr());
      const postInjuryWtPct = injuryFactor.weightPct ?? 1.0;
      const newExDatas: any[] = [];
      for (const exData of pl.exDatas) {
        // BUG-FIX (С‰Р°РґСЏС‰РёР№ СЂРµР¶РёРј): РґР»СЏ Р“Р РђР”РР РћР’РђРќРќРћР™ С‚СЂР°РІРјС‹ (exclude=false) РјС‹С€С†Р°
        // РґРѕР»Р¶РЅР° РћРЎРўРђР’РђРўР¬РЎРЇ РІ РїР»Р°РЅРµ вЂ” Р·Р°РјРµРЅСЏРµРј РЅР° Р±РµР·РѕРїР°СЃРЅСѓСЋ Р°Р»СЊС‚РµСЂРЅР°С‚РёРІСѓ РўРћР™ Р–Р•
        // РіСЂСѓРїРїС‹ (findGentleSubstitutions), Р° РќР• РЅР° СѓРїСЂР°Р¶РЅРµРЅРёРµ РґСЂСѓРіРѕР№ РјС‹С€С†С‹.
        // findSubstitutions Р·РґРµСЃСЊ РёСЃРїРѕР»СЊР·РѕРІР°Р»СЃСЏ РѕС€РёР±РѕС‡РЅРѕ: РѕРЅ СѓРІРѕРґРёС‚ СѓРїСЂР°Р¶РЅРµРЅРёСЏ
        // С‚СЂР°РІРјРёСЂРѕРІР°РЅРЅРѕР№ РіСЂСѓРїРїС‹ РЅР° Р”Р РЈР“РР• РјС‹С€С†С‹ (РїРѕР»РЅРѕРµ РёСЃРєР»СЋС‡РµРЅРёРµ), РїРѕСЌС‚РѕРјСѓ
        // С‚СЂР°РІРјРёСЂРѕРІР°РЅРЅР°СЏ РјС‹С€С†Р° РЅРµ РїРѕР»СѓС‡Р°Р»Р° СЂР°Р±РѕС‚Сѓ РІРѕРѕР±С‰Рµ.
        const subs = findGentleSubstitutions((exData as any).name || exData.id, pl.muscle);
        if (subs.length > 0) {
          // РЎР°РјР°СЏ РјСЏРіРєР°СЏ Р·Р°РјРµРЅР° (min volumePct) вЂ” РіР°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅРѕРµ СЃРЅРёР¶РµРЅРёРµ РЅР°РіСЂСѓР·РєРё
          const sortedSubs = [...subs].sort((a, b) => (a.volumePct || 1) - (b.volumePct || 1));
          const sub = sortedSubs[0];
          const subEx = sub.exercise;
          // Keep most plan data, overwrite weight/sets/reps
          newExDatas.push({
            ...(subEx as any),
            substitutionWeightPct: sub.weightPct * postInjuryWtPct,
            substitutionVolumePct: sub.volumePct * postInjuryVolPct,
            repsCap: injuryFactor.repsCap ?? (sub as any).repsCap ?? (exData as any).repsCap,
            originalName: (exData as any).name,
            substitutionReason: sub.reason,
            substituted: sub.exercise.name !== ((exData as any).name || exData.id),
          });
        } else {
          newExDatas.push({
            ...(exData as any),
            substitutionWeightPct: postInjuryWtPct,
            substitutionVolumePct: postInjuryVolPct,
            repsCap: injuryFactor.repsCap ?? (exData as any).repsCap,
          });
        }
      }
      // РћРіСЂР°РЅРёС‡РёРІР°РµРј РїСѓР» Р·Р°РјРµРЅ РёСЃС…РѕРґРЅС‹Рј С‡РёСЃР»РѕРј СѓРїСЂР°Р¶РЅРµРЅРёР№ (exerciseCount),
      // РёРЅР°С‡Рµ РёР·РѕР»РёСЂРѕРІР°РЅРЅР°СЏ РјС‹С€С†Р° РїСЂРё С‚СЂР°РІРјРµ СЂР°Р·РґСѓРІР°РµС‚СЃСЏ РґРѕ 2-3 СѓРїСЂР°Р¶РЅРµРЅРёР№
      // (findSubstitutions РІРѕР·РІСЂР°С‰Р°РµС‚ РґРѕ 3 РєР°РЅРґРёРґР°С‚РѕРІ) вЂ” РѕР±СЉС‘Рј Р РђРЎРўРЃРў РІРјРµСЃС‚Рѕ СЃРЅРёР¶РµРЅРёСЏ.
      // РљСЂРѕРјРµ С‚РѕРіРѕ, СЃРЅРёР¶Р°РµРј С‡РёСЃР»Рѕ СѓРїСЂР°Р¶РЅРµРЅРёР№ РЅР° С‚СЂР°РІРјРёСЂРѕРІР°РЅРЅРѕР№ РіСЂСѓРїРїРµ РЅР° 1
      // (СЂРµР°Р»СЊРЅР°СЏ СЂР°Р·РіСЂСѓР·РєР°, Р° РЅРµ С‚РѕР»СЊРєРѕ РІРµСЃ/РѕР±СЉС‘Рј РєР°Р¶РґРѕРіРѕ СѓРїСЂР°Р¶РЅРµРЅРёСЏ).
      const injuredExCount = Math.max(1, pl.exerciseCount - 1);
      pl.exDatas = newExDatas.slice(0, injuredExCount);
    }
  }

  // Process each muscle with proportional budget.
  // P0-1: СЂРµР·РµСЂРІРёСЂСѓРµРј Р±СЋРґР¶РµС‚ РґР»СЏ arms (biceps/triceps) Р”Рћ С‚РѕРіРѕ, РєР°Рє chest/back РµРіРѕ РїРѕС‚СЂР°С‚СЏС‚.
  // Р Р°РЅСЊС€Рµ: chest/back Р·Р°Р±РёСЂР°Р»Рё РІРµСЃСЊ fatigue budget в†’ biceps/triceps РїРѕР»СѓС‡Р°Р»Рё 0 СѓРїСЂР°Р¶РЅРµРЅРёР№.
  const armPlans = plans.filter(p => ARM_MUSCLES_SET.has(p.muscle));
  // Indirect arm overlap: Р¶РёРјС‹ РґР°СЋС‚ С‚СЂРёС†РµРїСЃСѓ ~0.5 effective sets РЅР° РєР°Р¶РґС‹Р№ СЃРµС‚,
  // С‚СЏРіРё РґР°СЋС‚ Р±РёС†РµРїСЃСѓ ~0.5. Р­С‚Рѕ РґРѕР»Р¶РЅРѕ СЃРЅРёР¶Р°С‚СЊ РїСЂСЏРјРѕР№ РѕР±СЉС‘Рј СЂСѓРє, Р° РЅРµ
  // РґРѕР±Р°РІР»СЏС‚СЊСЃСЏ РїРѕРІРµСЂС….
  let indirectBiceps = 0;
  let indirectTriceps = 0;
  for (const pl of plans) {
    if (ARM_MUSCLES_SET.has(pl.muscle)) continue;
    const n = (pl.exDatas[0]?.name || '').toLowerCase();
    const totalSets = pl.sets || 0;
    if (/Р¶РёРј|bench|press|dip|РѕС‚Р¶РёРј.*Р±СЂСѓСЃ|Р¶РёРј.*СѓР·Рє|close.?grip/i.test(n) && !/РЅРѕРі|leg|СЃРіРёР±Р°РЅ|curl/i.test(n)) {
      indirectTriceps += totalSets * 0.45;
    }
    if (/РїРѕРґС‚СЏРі|pull.?up|chin|С‚СЏРіР°|row|РїСѓР»Р»РґР°СѓРЅ|РІРµСЂС…РЅ.*Р±Р»РѕРє|lat.?pull/i.test(n) && !/Р»РёС†|face/i.test(n)) {
      indirectBiceps += totalSets * 0.4;
    }
  }
  // Р‘Р°Р·РѕРІС‹Р№ СЂРµР·РµСЂРІ РґР»СЏ СЂСѓРє СЃРЅРёР¶Р°РµС‚СЃСЏ РїСЂРѕРїРѕСЂС†РёРѕРЅР°Р»СЊРЅРѕ РєРѕСЃРІРµРЅРЅРѕР№ РЅР°РіСЂСѓР·РєРµ.
  // Р•СЃР»Рё РєРѕСЃРІРµРЅРЅС‹Р№ РѕР±СЉС‘Рј СѓР¶Рµ РїРѕРєСЂС‹РІР°РµС‚ 50% target вЂ” РїСЂСЏРјРѕР№ РѕР±СЉС‘Рј СЃРѕРєСЂР°С‰Р°РµС‚СЃСЏ.
  const armReserveBudget = armPlans.length * 6 * 5; // 6 sets (2 ex Г— 3 sets) Г— fatigueCost 5 per arm muscle
  let availableBudget = dayFatigueBudget;
  if (armPlans.length > 0 && availableBudget > armReserveBudget) {
    availableBudget -= armReserveBudget; // СЂРµР·РµСЂРІРёСЂСѓРµРј РґР»СЏ arms
  }
  let armAllocatedBudget = 0;
  for (const pl of plans) {
    const phaseCfg = getPhaseConfig(phase, trainingFocus);
    const [adjMin, adjMax] = phaseCfg.repRange;
    const isAcc = pl.role === 'accessory';
    const repMin = isAcc ? adjMin + 2 : adjMin;
    const repMax = isAcc ? adjMax + 5 : adjMax;
    const isArmMuscle = ARM_MUSCLES_SET.has(pl.muscle);
    // Indirect overlap reduction: РµСЃР»Рё Р¶РёРјС‹/С‚СЏРіРё СѓР¶Рµ РґР°Р»Рё СЃСѓС‰РµСЃС‚РІРµРЅРЅС‹Р№
    // РєРѕСЃРІРµРЅРЅС‹Р№ РѕР±СЉС‘Рј, РїСЂСЏРјРѕР№ РѕР±СЉС‘Рј СЂСѓРє СЃРЅРёР¶Р°РµС‚СЃСЏ, Р° РЅРµ РґРѕР±Р°РІР»СЏРµС‚СЃСЏ РїРѕРІРµСЂС….
    const indirectOverlap = pl.muscle === 'biceps' ? indirectBiceps : pl.muscle === 'triceps' ? indirectTriceps : 0;
    const indirectReduction = indirectOverlap > 8 ? 0.5 : indirectOverlap > 4 ? 0.75 : 1.0;
    // P0-1: РґР»СЏ arms вЂ” РёСЃРїРѕР»СЊР·СѓРµРј Р·Р°СЂРµР·РµСЂРІРёСЂРѕРІР°РЅРЅС‹Р№ Р±СЋРґР¶РµС‚ РЅР°РїСЂСЏРјСѓСЋ (РЅРµ РїСЂРѕРїРѕСЂС†РёРѕРЅР°Р»СЊРЅРѕ totalExpectedFatigue).
    // Р Р°РЅСЊС€Рµ: muscleBudget = floor(15 Г— 1 Г— 3 Г— 5 / 130) = 1 (chest/back СЂР°Р·РјС‹РІР°СЋС‚ СЂРµР·РµСЂРІ).
    // РўРµРїРµСЂСЊ: arms РїРѕР»СѓС‡Р°СЋС‚ РіР°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅС‹Р№ budget = armReserve / armPlans.length.
    const armBudgetPerMuscle = armPlans.length > 0 ? (armReserveBudget / armPlans.length) : 0;
    const budgetSource = isArmMuscle ? armBudgetPerMuscle * indirectReduction : availableBudget;
    const muscleBudget = isArmMuscle
      ? Math.max(armBudgetPerMuscle, 15) // РјРёРЅРёРјСѓРј 3 СЃРµС‚Р° Г— 5 fatigue
      : (totalExpectedFatigue > 0
        ? Math.floor(budgetSource * pl.exerciseCount * Math.max(1, Math.round(pl.sets / pl.exerciseCount)) * ((pl.exDatas[0] as any)?.fatigueCost || 5) / totalExpectedFatigue)
        : Math.floor(budgetSource / Math.max(1, plans.length)));
    // Solo-РґРЅРё (1-2 РјС‹С€С†С‹): 90% Р±СЋРґР¶РµС‚Р°; multi-РґРЅРё: 60% (70% РЅР° PED вЂ” Р±РѕР»СЊС€Рµ recovery).
    const highVolumeBack = pl.muscle === 'back' && level === 'enhanced' && (trainingYears ?? 0) >= 3;
    // Natural advanced: СЃРїРёРЅР° РІ Upper-РґРЅСЏС… РЅРµ РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РѕСЃС‚Р°С‚РєРѕРј РїРѕСЃР»Рµ РіСЂСѓРґРё.
    const balancedBack = pl.muscle === 'back' && level === 'advanced';
    const highVolumeLegs = ['quads', 'hamstrings', 'glutes'].includes(pl.muscle) && level === 'enhanced' && (trainingYears ?? 0) >= 3;
    const highVolumeTorso = ['chest', 'shoulders'].includes(pl.muscle) && level === 'enhanced' && (trainingYears ?? 0) >= 3;
    const highVolumeArms = ['biceps', 'triceps'].includes(pl.muscle) && level === 'enhanced' && (trainingYears ?? 0) >= 3;
    const budgetCapPct = plans.length <= 2 ? 0.90 : (pedAdapt && pedAdapt.combinedRecoveryMultiplier >= 1.3 ? 0.70 : 0.60);
    let remainingBudget = highVolumeBack
      ? Math.max(muscleBudget, pl.sets * 6)
      : balancedBack
        ? Math.max(muscleBudget, pl.sets * 6)
        : highVolumeLegs
          // РќРµР·Р°РІРёСЃРёРјС‹Р№ budget floor: quads РЅРµ РјРѕР¶РµС‚ Р·Р°Р±СЂР°С‚СЊ РІРµСЃСЊ РєРѕС‚С‘Р»,
          // РѕСЃС‚Р°РІРёРІ hamstrings/glutes СЃ РѕРґРЅРёРј СѓРїСЂР°Р¶РЅРµРЅРёРµРј.
          ? Math.max(muscleBudget, (trainingYears ?? 0) >= 6 ? 120 : 90)
          : highVolumeTorso
            ? Math.max(muscleBudget, pl.sets * 6)
            : highVolumeArms
              ? Math.max(muscleBudget, 30) // РјРёРЅРёРјСѓРј 6 СЃРµС‚РѕРІ Г— 5 fatigue
              : Math.max(1, Math.min(muscleBudget, Math.floor(budgetSource * (isArmMuscle ? 1.0 : budgetCapPct))));
    // High-volume legs: fatigue budget РЅРµ РґРѕР»Р¶РµРЅ СЂРµР·Р°С‚СЊ РЅРѕРіРё РґРѕ РѕСЃС‚Р°С‚РєР°.
    // РњРёРЅРёРјСѓРј вЂ” С†РµР»РµРІС‹Рµ СЃРµС‚С‹ Г— fatigueCost, Р° РЅРµ РїСЂРѕРїРѕСЂС†РёСЏ РѕС‚ РѕР±С‰РµРіРѕ Р±СЋРґР¶РµС‚Р°.
    if (highVolumeLegs && remainingBudget < pl.sets * 5) {
      remainingBudget = pl.sets * 5;
    }
    // Р“Р°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅС‹Р№ РјРёРЅРёРјСѓРј РґР»СЏ arms/shoulders вЂ” РЅР° PED РЅСѓР¶РЅРѕ РјРёРЅРёРјСѓРј 3-4 СЃРµС‚Р°
    // РґР°Р¶Рµ РµСЃР»Рё Р±СЋРґР¶РµС‚ РјР°Р» (chest Р·Р°Р±РёСЂР°Р» Р±РѕР»СЊС€СѓСЋ С‡Р°СЃС‚СЊ). Р‘РµР· СЌС‚РѕРіРѕ triceps РїРѕР»СѓС‡Р°РµС‚ 1 СЃРµС‚.
    // minBudget = fatigueCost(5) Г— minSets(3-4) Г— minExercises(2) = 30-40
    const isArmOrShoulder = ['triceps', 'biceps', 'shoulders', 'forearms'].includes(pl.muscle);
    const minSetsArms = isArmOrShoulder && pedAdapt && pedAdapt.combinedMrvMultiplier >= 1.3 ? 4 : 3;
    const minExercisesArms = isArmOrShoulder && pedAdapt && pedAdapt.combinedMrvMultiplier >= 1.3 ? 2 : 1;
    const minBudgetForArms = isArmOrShoulder ? minSetsArms * minExercisesArms * ((pl.exDatas[0] as any)?.fatigueCost || 5) : 0;
    if (isArmOrShoulder && remainingBudget < minBudgetForArms) {
      remainingBudget = minBudgetForArms;
    }
    // Р”Р»СЏ primary Р±РѕР»СЊС€РёС… РјС‹С€С† (chest/back/quads) вЂ” РѕРіСЂР°РЅРёС‡РёС‚СЊ per-exercise sets РґРѕ 5
    // С‡С‚РѕР±С‹ РЅРµ Р·Р°Р±РёСЂР°С‚СЊ РІРµСЃСЊ Р±СЋРґР¶РµС‚ (7 sets РЅР° Р¶РёРј = 35 fatigue = РІРµСЃСЊ РґРµРЅСЊ)
    
    for (const exData of pl.exDatas) {
      const wPct = (exData as any).substitutionWeightPct ?? 1.0;
      const vPct = (exData as any).substitutionVolumePct ?? 1.0;
      const isSubstituted = (exData as any).substituted === true;
      const repsCap = (exData as any).repsCap ?? 20;
      // P1-4: РјРёРЅРёРјСѓРј 2 СЃРµС‚Р° РЅР° СѓРїСЂР°Р¶РЅРµРЅРёРµ (1 СЃРµС‚ = СЂР°Р·РјРёРЅРєР°, РЅРµ СЂР°Р±РѕС‡РёР№ РѕР±СЉС‘Рј РґР»СЏ РіРёРїРµСЂС‚СЂРѕС„РёРё).
       // back target СѓР¶Рµ РјР°СЃС€С‚Р°Р±РёСЂРѕРІР°РЅ РЅР° РЅРµРґРµР»СЊРЅРѕРј prescription-СѓСЂРѕРІРЅРµ РІС‹С€Рµ;
       // РЅРµ СѓРјРЅРѕР¶Р°РµРј РєР°Р¶РґС‹Р№ exercise РїРѕРІС‚РѕСЂРЅРѕ, РёРЅР°С‡Рµ СЃС‚Р°Р¶ РґР°РІР°Р» Р±С‹ РґРІРѕР№РЅРѕР№ boost.
       const setCap = (pl.muscle === 'back' && level === 'advanced' && !(trainingYears !== undefined && (trainingYears as number) >= 3)) ? 8
         : (['quads', 'hamstrings', 'glutes'].includes(pl.muscle) && level === 'advanced' && !(trainingYears !== undefined && (trainingYears as number) >= 3)) ? 8
         : 5;
       const exSetsRaw = Math.round(Math.round(pl.sets / pl.exDatas.length) * vPct);
       // РњРёРЅРёРјСѓРј 3 СЃРµС‚Р° РЅР° СѓРїСЂР°Р¶РЅРµРЅРёРµ РґР»СЏ enhanced 3+ вЂ” 2 СЃРµС‚Р° РЅРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ
       // РґР»СЏ РіРёРїРµСЂС‚СЂРѕС„РёРё РѕРїС‹С‚РЅРѕРіРѕ Р°С‚Р»РµС‚Р°.
       const exMin = level === 'enhanced' && (trainingYears ?? 0) >= 3 ? 3 : 2;
       const exSets = Math.max(exMin, Math.min(setCap, exSetsRaw));
      const exWeight = (exData as any)._effWeight ?? pl.weight;
      const finalRir = isSubstituted ? Math.min(pl.rir + 1, 4) : ((exData as any)._deltRir ?? pl.rir);
      const cost = ((exData as any)?.fatigueCost || 5) * exSets;
      // P1: tempo/rest/reps Р±РµСЂСѓС‚СЃСЏ РёР· PHASE_CONFIGS[phase] (РЅРµ charReps/REST_BY_CHARACTER).
      // Accessory РїРѕР»СѓС‡Р°РµС‚ С‡СѓС‚СЊ РјРµРЅСЊС€Рµ РѕС‚РґС‹С…Р° (РјРёРЅСѓСЃ 30СЃ), primary вЂ” Р±Р°Р·Сѓ.
      // FIX-B2: per-exercise tempo override (РїСЂРѕС„-С‚СЂРµРЅРµСЂ РЅР°Р·РЅР°С‡Р°РµС‚ СЂР°Р·РЅС‹Р№ С‚РµРјРї СЂР°Р·РЅС‹Рј СѓРїСЂ).
      const exName = (exData as any)?.name || (exData as any)?.id || '';
      const tempoOverride = tempoFor(pl.resolved as DayCharacter, undefined, phase, exName);
      const tempoStr = tempoOverride.notation;
      const baseRest = phaseCfg.restBase;
      // P5: Rest progression. РќР°РєРѕРїР»РµРЅРёРµ/РёРЅС‚РµРЅСЃРёС„РёРєР°С†РёСЏ/РїРёРє в†’ -15s/РЅРµРґ (РїР»РѕС‚РЅРѕСЃС‚СЊ СЂР°СЃС‚С‘С‚).
      // Р”РµР»РѕРґ в†’ +30СЃ (РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ: Р±РѕР»СЊС€Рµ РѕС‚РґС‹С…Р° = РјРµРЅСЊС€Рµ СѓС‚РѕРјР»РµРЅРёСЏ, Schoenfeld 2016).
      // FIX: РёСЃРїРѕР»СЊР·СѓРµРј phaseWeek (РЅРµ absolute week) вЂ” РїСЂРѕРіСЂРµСЃСЃРёСЏ СЂРµСЃС‚Р°СЂС‚СѓРµС‚ СЃ РєР°Р¶РґРѕР№ С„Р°Р·РѕР№,
      // РєР°Рє RIR drift. Р Р°РЅРµРµ week=9 в†’ restProgression=120СЃ в†’ baseRest-120=0 в†’ clamped to 60
      // РЅР° РІСЃРµР№ С„Р°Р·Рµ intensification. РўРµРїРµСЂСЊ phaseWeek=1-4 в†’ max 45s СЃРѕРєСЂР°С‰РµРЅРёСЏ.
      const restProgression = phase === 'deload' ? -30 : Math.max(0, (phaseWeek - 1) * 15);
      const exRestBase = phase === 'deload'
        ? Math.min(180, (pl.role === 'accessory' ? baseRest : baseRest + 30) - restProgression)
        : Math.max(60, (pl.role === 'accessory' ? Math.max(45, baseRest - 30) : baseRest) - restProgression);
      // РРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ С‚СЂРµРЅРёРЅРіР°: light в†’ Р±РѕР»СЊС€Рµ РѕС‚РґС‹С…Р°, high в†’ РјРµРЅСЊС€Рµ (РїР»РѕС‚РЅРѕСЃС‚СЊ).
      const exRest = Math.round(exRestBase * intensityRestMult);
      if (remainingBudget < cost) {
        const reduced = Math.max(2, Math.floor(remainingBudget / ((exData as any)?.fatigueCost || 5)));
        const adjustedSets = Math.min(exSets, reduced);
        const adjCost = ((exData as any)?.fatigueCost || 5) * adjustedSets;
        remainingBudget -= adjCost;
        // B1: DUP-РІРѕР»РЅР° Рё РїСЂРё РѕР±СЂРµР·РєРµ
        const dupReps: number[] = [];
        for (let k = 0; k < adjustedSets; k++) {
          let wave: number;
          if (k === 0) wave = repMin;
          else if (k === adjustedSets - 1) wave = repMax;
          else wave = k % 2 === 1 ? repMax : repMin;
          dupReps.push(Math.min(wave, repsCap));
        }
        const workSets: BBSet[] = dupReps.map((reps, i) => {
          const baseW = Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10;
          const ws = backoffWeights(baseW, dupReps.length, (exData as any).exerciseType !== 'isolation', phase === 'deload', pl.resolved as string);
          return { reps, rir: finalRir, weight: ws[i] ?? baseW, tempo: tempoStr, restSeconds: exRest };
        });
        // P0-1 (audit 2026-07): _pumpOverride СѓРґР°Р»С‘РЅ. РўСЏР¶С‘Р»С‹Р№ СЃРµС‚ РѕСЃС‚Р°С‘С‚СЃСЏ С‚СЏР¶С‘Р»С‹Рј.
        const effChar: DayCharacter = pl.resolved as DayCharacter;
        const effReps: [number, number] = [Math.min(repMin, repsCap), Math.min(repMax, repsCap)];
        exercises.push({
          muscle: trueMuscleOf(exData) || pl.muscle, name: (exData as any).name || (exData as any).id, role: pl.role, character: effChar,
          sets: adjustedSets, repsRange: effReps,
          rir: finalRir,
          workSets, exerciseName: (exData as any).name || (exData as any).id,
          exerciseType: (exData as any).exerciseType || (exData as any).type || 'compound',
          tempoSpec: tempoStr, restSeconds: exRest,
            comment: buildExComment(pl.muscle, (exData as any).id || (exData as any).name, pl.role, pl.resolved as DayCharacter, adjustedSets, Math.min(repMin, repsCap), Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, finalRir, weakPoints, focusGroup, phase, tempoStr, exRest, isSubstituted, (exData as any).id, trainingFocus, pl.rationaleMap.get((exData as any).name) || undefined),
          executionProfile: buildExerciseInstructions({ exerciseId: (exData as any).id, exerciseName: (exData as any).name || (exData as any).id, muscle: pl.muscle, role: pl.role, phase, trainingFocus, level, tempo: tempoStr, restSeconds: exRest, orderIndex: exercises.length, totalExercises: pl.exDatas.length }),
          warmupSets: buildWarmup(Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, pl.role === 'primary' || (exData as any).type === 'compound'),
          rationale: pl.rationaleMap.get((exData as any).name) || '',
        });
        continue;
      }
      remainingBudget -= cost;
      // B1: DUP-РІРѕР»РЅР° РїРѕРІС‚РѕСЂРµРЅРёР№ (Daily Undulating Periodization) вЂ” СЂРµР°Р»РёСЃС‚РёС‡РЅР°СЏ PRO-РїСЂР°РєС‚РёРєР°.
      // Р’СЃРµ 4 СЃРµС‚Р° РќР• РѕРґРёРЅР°РєРѕРІС‹Рµ. Р’РјРµСЃС‚Рѕ [r, r, r, r] РіРµРЅРµСЂРёСЂСѓРµРј [repMin, repMax, repMin, repMax, ...]
      // РёР»Рё [repMid, repMin, repMax, repMid] РґР»СЏ Р±РѕР»СЊС€РµРіРѕ СЂР°Р·РЅРѕРѕР±СЂР°Р·РёСЏ.
      const dupReps: number[] = [];
      for (let k = 0; k < exSets; k++) {
        // РЎС…РµРјР°: С‚СЏР¶С‘Р»С‹Р№ РїРµСЂРІС‹Р№ СЃРµС‚ (repMin), Р·Р°С‚РµРј С‡РµСЂРµРґРѕРІР°РЅРёРµ repMax/repMin
        let wave: number;
        if (k === 0) wave = repMin;
        else if (k === exSets - 1) wave = repMax; // РїРѕСЃР»РµРґРЅРёР№ вЂ” РІС‹СЃРѕРєРёР№ reps (finish)
        else wave = k % 2 === 1 ? repMax : repMin;
        // Fatigue-aware DUP: middle sets are nudged down after the first
        // hard set, without leaving the phase/focus rep range.
        if (k >= 2 && exSets >= 4 && phase !== 'deload') wave = Math.max(repMin, wave - 1);
        dupReps.push(Math.min(wave, repsCap));
      }
      const workSets: BBSet[] = dupReps.map((reps, i) => {
        const baseW = Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10;
        const ws = backoffWeights(baseW, dupReps.length, (exData as any).exerciseType !== 'isolation', phase === 'deload', pl.resolved as string);
        return { reps, rir: finalRir, weight: ws[i] ?? baseW, tempo: tempoStr, restSeconds: exRest };
      });
      exercises.push({
        muscle: pl.muscle, name: (exData as any).name || (exData as any).id, role: pl.role, character: pl.resolved as DayCharacter,
        sets: exSets, repsRange: [Math.min(repMin, repsCap), Math.min(repMax, repsCap)] as [number,number],
        rir: finalRir,
        workSets, exerciseName: (exData as any).name || (exData as any).id,
        exerciseType: (exData as any).exerciseType || (exData as any).type || 'compound',
        tempoSpec: tempoStr, restSeconds: exRest,
         comment: buildExComment(pl.muscle, (exData as any).id || (exData as any).name, pl.role, pl.resolved as DayCharacter, exSets, Math.min(repMin, repsCap), Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, finalRir, weakPoints, focusGroup, phase, tempoStr, exRest, isSubstituted, (exData as any).id, trainingFocus, pl.rationaleMap.get((exData as any).name) || undefined),
        executionProfile: buildExerciseInstructions({ exerciseId: (exData as any).id, exerciseName: (exData as any).name || (exData as any).id, muscle: pl.muscle, role: pl.role, phase, trainingFocus, level, tempo: tempoStr, restSeconds: exRest, orderIndex: exercises.length, totalExercises: pl.exDatas.length }),
        warmupSets: buildWarmup(Math.round(exWeight * wPct * ((exData as any)._weightMod || 1) * 10) / 10, pl.role === 'primary'),
        rationale: pl.rationaleMap.get((exData as any).name) || '',
      });
    }
  }
  // в–“в–“ РўРµС…РЅРёС‡РµСЃРєРё РіСЂР°РјРѕС‚РЅС‹Р№ РїРѕСЂСЏРґРѕРє СѓРїСЂР°Р¶РЅРµРЅРёР№ (РґРѕ РѕР±СЂРµР·РєРё РїРѕ exCap) в–“в–“
  // Р‘Р°Р·РѕРІС‹Рµ РѕСЃРЅРѕРІРЅРѕР№ РјС‹С€С†С‹ в†’ Р±Р°Р·РѕРІС‹Рµ РІС‚РѕСЂРёС‡РЅС‹С… в†’ РёР·РѕР»СЏС†РёСЏ (СЂР°СЃС‚СЏР¶РєР° РїРµСЂРІРѕР№) в†’ С„РёРЅРёС€Рё.
  // BUG-B11: РїРµСЂРµРґР°С‘Рј sessionLeadMuscle (РґР»СЏ FullBody вЂ” РїСѓСЃС‚Р°СЏ СЃС‚СЂРѕРєР°, РЅРѕ orderSessionExercises
  // РІ СЌС‚РѕРј СЃР»СѓС‡Р°Рµ fallback РЅР° РїРµСЂРІС‹Р№ primary+С‚СЏР¶ exercise в†’ РєРѕСЂСЂРµРєС‚РЅРѕ РґР»СЏ FB day 2/3).
  const _ordered = orderSessionExercises(exercises, {
    sessionTag: sched.sessionTag,
    methodology,
    primaryMuscle: sessionLeadMuscle || undefined,
    priorityMuscles: [...weakPoints, ...(focusGroup ? [focusGroup] : [])],
  });
  exercises.length = 0; exercises.push(..._ordered);
  // РџРѕСЃР»Рµ С„РёРЅР°Р»СЊРЅРѕР№ СЃРѕСЂС‚РёСЂРѕРІРєРё РѕР±РЅРѕРІР»СЏРµРј РїРѕСЂСЏРґРѕРє РІ С‚СЂРµРЅРµСЂСЃРєРѕР№ РёРЅСЃС‚СЂСѓРєС†РёРё.
  // Р­С‚Рѕ С‚РѕС‡РЅРµРµ, С‡РµРј РїРѕСЂСЏРґРѕРє РґРѕ orderSessionExercises: РјРµС‚РѕРґРёРєР° РјРѕР¶РµС‚ РїРµСЂРµСЃС‚Р°РІРёС‚СЊ
  // primary/accessory, stretch-biased Рё priority-muscle СѓРїСЂР°Р¶РЅРµРЅРёСЏ.
  exercises.forEach((exercise, index) => {
    const orderText = exercise.role === 'primary'
      ? (index === 0 ? 'РїРµСЂРІРѕРµ РѕСЃРЅРѕРІРЅРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ РґРЅСЏ' : `РѕСЃРЅРѕРІРЅРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ в„–${index + 1} РІ РґРЅРµ`)
      : `СѓРїСЂР°Р¶РЅРµРЅРёРµ в„–${index + 1} РІ РґРЅРµ, РїРѕСЃР»Рµ Р±Р°Р·РѕРІС‹С… РґРІРёР¶РµРЅРёР№`;
    if (exercise.comment) exercise.comment = exercise.comment.replace(/РџРѕСЂСЏРґРѕРє: [^.]+/, `РџРѕСЂСЏРґРѕРє: ${orderText}`);
    if (exercise.executionProfile) exercise.executionProfile.order = orderText;
  });

  // РљР°Рї СѓРїСЂР°Р¶РЅРµРЅРёР№ РІ СЃРµСЃСЃРёРё: РїСЂРѕСЃС‚Рѕ Р±РµСЂС‘Рј РїРµСЂРІС‹Рµ exCap РёР· СѓР¶Рµ РѕС‚СЃРѕСЂС‚РёСЂРѕРІР°РЅРЅРѕРіРѕ РјР°СЃСЃРёРІР°.
  // РЎРѕСЂС‚РёСЂРѕРІРєР° РІС‹С€Рµ СѓР¶Рµ РіР°СЂР°РЅС‚РёСЂСѓРµС‚: primary в†’ accessory, РјС‹С€С†Р° РґРЅСЏ в†’ РѕСЃС‚Р°Р»СЊРЅС‹Рµ.
  // P0-1: exCap Р·Р°РІРёСЃРёС‚ РѕС‚ С‡РёСЃР»Р° РјС‹С€С† РІ РґРЅРµ вЂ” 5 РјС‹С€С† РїРѕ 2 СѓРїСЂР°Р¶РЅРµРЅРёСЏ = 10 РјРёРЅРёРјСѓРј.
  // Р Р°РЅСЊС€Рµ exCap=8 в†’ biceps/triceps РѕС‚СЂРµР·Р°Р»РёСЃСЊ РІ Upper РґРЅСЏС… (5 РјС‹С€С†).
  // РўРµРїРµСЂСЊ: exCap = max(8, musclePlans.length Г— 2) вЂ” РіР°СЂР°РЅС‚РёСЏ 2 СѓРїСЂР°Р¶РЅРµРЅРёР№ РЅР° РјС‹С€С†Сѓ.
  const exCap = Math.max(8, Math.min(12, musclePlans.length * 2));
  if (exercises.length > exCap) {
    exercises.length = exCap;
  }
  // P0-1: arm guarantee РїРµСЂРµРЅРµСЃРµРЅР° РІ С„РёРЅР°Р»СЊРЅСѓСЋ РїРѕСЃС‚-РѕР±СЂР°Р±РѕС‚РєСѓ (РїРѕСЃР»Рµ РІСЃРµС… РѕР±СЂРµР·РѕРє/dedup).

  // в–“в–“ A1: Pump-finisher СЃР»Р°Р±С‹С… РіСЂСѓРїРї (СЃС‚СЂСѓРєС‚СѓСЂРЅР°СЏ РґРѕР±РёРІРєР° РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєРёРј СЃС‚СЂРµСЃСЃРѕРј) в–“в–“
  // Р•СЃР»Рё РІ С‚РµРєСѓС‰РµР№ СЃРµСЃСЃРёРё СЃР»Р°Р±Р°СЏ РіСЂСѓРїРїР° СѓР¶Рµ РїСЂРµРґСЃС‚Р°РІР»РµРЅР° (РЅРѕ РЅРµ primary СЌС‚РѕР№ СЃРµСЃСЃРёРё) вЂ”
  // РґРѕР±Р°РІРёС‚СЊ 1 РїР°РјРї-СЃРµС‚ РІ РєРѕРЅС†Рµ (3Г—15-20 @ 50% workMax, RIR 4). Р­С‚Рѕ РЅРµ "РјРЅРѕР¶РёС‚РµР»СЊ",
  // Р° СЃС‚СЂСѓРєС‚СѓСЂРЅР°СЏ С‚СЂРµРЅРµСЂСЃРєР°СЏ С‚РµС…РЅРёРєР°: РґРѕР±РёРІР°РЅРёРµ РјС‹С€С†С‹ РїРѕСЃР»Рµ РѕСЃРЅРѕРІРЅРѕРіРѕ РѕР±СЉС‘РјР°.
  // Skip РµСЃР»Рё РґРµРЅСЊ-СЃРµСЃСЃРёСЏ СѓР¶Рµ Р±Р»РёР·РєР° Рє exCap (Р·Р°С‰РёС‚Р° РѕС‚ РїРµСЂРµРіСЂСѓР·РєРё)
  let SESSION_USED = exercises.length;
  const SESSION_FINAL_CAP = Math.min(exCap, SESSION_USED + 2);
  if (weakPoints.length > 0 && SESSION_USED < SESSION_FINAL_CAP) {
    const sessionMusclesPush = new Set(exercises.map(e => e.muscle));
    const tagPush = (sched.sessionTag || '').toLowerCase();
    const isLegsDay = tagPush === 'legs' || tagPush.startsWith('lower');
    const isUpperDay = !isLegsDay;
    // С‚РѕР»СЊРєРѕ СЃР»Р°Р±С‹Рµ РіСЂСѓРїРїС‹ СЃРѕРІРјРµСЃС‚РёРјС‹Рµ СЃ РґРЅС‘Рј
    for (const wp of weakPoints) {
      if (SESSION_USED >= SESSION_FINAL_CAP) break;
      const isWpLegs = ['quads','hamstrings','glutes','calves'].includes(wp);
      const isWpUpper = ['chest','back','shoulders','biceps','triceps','forearms','arms'].includes(wp);
      if (isWpLegs && !isLegsDay) continue;
      if (isWpUpper && !isUpperDay) continue;
      // РќРµ РґРµР»Р°С‚СЊ finisher РµСЃР»Рё СЌС‚Р° РіСЂСѓРїРїР° СѓР¶Рµ primary СЃРµРіРѕРґРЅСЏ (РµСЃС‚СЊ Р±РѕР»СЊС€РѕР№ compound-РѕР±СЉС‘Рј вЂ”
      // finisher С‚РѕР»СЊРєРѕ РґР»СЏ accessory РјС‹С€С†С‹)
      const isPrimaryToday = exercises.some(e => e.role === 'primary' && e.muscle === wp);
      if (isPrimaryToday) continue;
      // РќРµ РґРµР»Р°С‚СЊ finisher, РµСЃР»Рё РЅРµ Р±С‹Р»Рѕ accessory СЌС‚РѕР№ РіСЂСѓРїРїС‹ СЃРµРіРѕРґРЅСЏ (РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєРёР№
      // СЃС‚РёРјСѓР» Р±РµР· РїСЂРµРґС€РµСЃС‚РІСѓСЋС‰РµРіРѕ Р±Р°Р·РѕРІРѕРіРѕ РѕР±СЉС‘РјР° вЂ” РЅРµСЌС„С„РµРєС‚РёРІРЅРѕ)
      if (!sessionMusclesPush.has(wp)) continue;
      const seenNamesList = new Set(exercises.map(e => e.name));
      const pumpPool = EXERCISE_CATALOG.filter((ex: any) => {
        const tm = trueMuscleOf(ex);
        if (tm === null || tm !== wp) return false;
        if (seenNamesList.has(ex.name)) return false;
        if (isBBJunk(ex)) return false;
      { const _t = bbExerciseTier(ex); if (_t === 4 || (!allowExotic && _t === 3)) return false; }
        const n = (ex.name || '').toLowerCase();
        if (n.includes('СЃС‚Р°РЅРѕРІР°СЏ') || n.includes('Р¶РёРј СЃС‚РѕСЏ') || n.includes('Р°СЂРјРµР№')) return false;
        if (equipmentList.length > 0) {
          const rawEq = ex.equipment;
          const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
          if (exEq.length > 0 && !exEq.some(eq => equipmentList.includes(eq))) return false;
        }
        return true;
      });
      if (pumpPool.length === 0) continue;
      const iso = pumpPool.find((e: any) => e.type === 'isolation') || pumpPool[0];
      const wm = workMax[wp] || PRO_WORKMAX_RATIO[wp]?.(workMax) || defaultWorkMax(wp);
      const wu = Math.round(wm * 0.50 * 10) / 10; // 50% workMax вЂ” РїР°РјРї-С„РёРЅРёС€РµСЂ
      exercises.push({
        muscle: wp, name: iso.name, role: 'accessory', character: 'РїР°РјРї',
        sets: 3, repsRange: [15, 20], rir: 4,
        workSets: Array.from({length: 3}, () => ({ reps: 15, rir: 4, weight: wu, tempo: '2-1-2-0', restSeconds: 45 })),
        exerciseName: iso.name, tempoSpec: '2-1-2-0', restSeconds: 45,
        comment: `рџ”Ґ Weak pump-finisher: ${iso.name}, 3Г—15 @${wu} РєРі RIR 4 вЂ” РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєРёР№ СЃС‚СЂРµСЃСЃ РЅР° РѕС‚СЃС‚Р°СЋС‰СѓСЋ РіСЂСѓРїРїСѓ.`,
        warmupSets: [], rationale: 'Pump finisher РґР»СЏ СЃР»Р°Р±РѕР№ РіСЂСѓРїРїС‹',
      });
      seenNamesList.add(iso.name);
      SESSION_USED++;
    }
  }

  // The shared order engine is intentionally the last ordering authority.
  // Do not add a second role/equipment sort here: it can move a weak-point
  // isolation ahead of the day's primary compound and undo methodology rules.
  const finalOrdered = orderSessionExercises(exercises, {
    sessionTag: sched.sessionTag,
    methodology,
    primaryMuscle: sessionLeadMuscle || undefined,
    priorityMuscles: [...weakPoints, ...(focusGroup ? [focusGroup] : [])],
  });
  exercises.length = 0;
  exercises.push(...finalOrdered);

  // РџРѕРґРіСЂСѓРїРїС‹ РґР»СЏ UI-РґРµС‚Р°Р»РёР·Р°С†РёРё вЂ” display-only, РїРѕСЃР»Рµ С„РёРЅР°Р»СЊРЅРѕР№ СЃРѕСЂС‚РёСЂРѕРІРєРё
  for (const ex of exercises) {
    if (!(ex as any).subgroup) {
      const sg = deriveExerciseSubgroup(ex.muscle, ex.name, (ex as any).backSubgroup as string | undefined);
      if (sg) {
        (ex as any).subgroup = sg;
        if (ex.muscle === 'chest' && sg.startsWith('chest_')) (ex as any).chestSubgroup = sg as any;
        if (ex.muscle === 'back' && !(ex as any).backSubgroup) (ex as any).backSubgroup = sg as any;
      }
    }
  }

  // Р”РѕР±Р°РІР»СЏРµРј СЂР°СЃС‚СЏР¶РєСѓ РІ РєРѕРЅРµС† СЃРµСЃСЃРёРё (РґРёРЅР°РјРёС‡РµСЃРєР°СЏ СЂР°СЃС‚СЏР¶РєР° РґР»СЏ РѕСЃРЅРѕРІРЅС‹С… РіСЂСѓРїРї РјС‹С€С†)
  // BUG-B13/B21: Stretching СѓРґР°Р»С‘РЅ (РјС‘СЂС‚РІС‹Р№ РєРѕРґ СЃ Jul 16 вЂ” РЅРµ Р‘Р‘-РіРёРїРµСЂС‚СЂРѕС„РёСЏ, Р·Р°РЅРёРјР°Р» СЃР»РѕС‚С‹).

  return { day: dayInRotation, weekOffset: 0, character, sessionTag: sched.sessionTag, exercises };
}

/** РћР±С‘СЂС‚РєР° СЃ С‚РёРїРёР·РёСЂРѕРІР°РЅРЅС‹Рј РѕР±СЉРµРєС‚РѕРј вЂ” СЂРµС€Р°РµС‚ P0-2 (47 positional args в†’ type-safe). РЎС‚Р°СЂС‹Р№ РІС‹Р·РѕРІ РѕСЃС‚Р°РІР»РµРЅ РґР»СЏ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё. */
export function buildSessionWithParams(p: BuildSessionParams): BBSession {
  return buildSession(
    p.sched, p.dayInRotation, p.week,
    p.muscleVolumeRotation, p.muscleSessionCount, p.musclePrimaryAssigned,
    p.workMax, p.weakPoints, p.focusGroup,
    p.pedAdapt, p.dailyCap, p.level,
    p.injuryProfile, p.injuredMuscles, p.excludedMuscles, p.gradedInjuries,
    p.today, p.phase, p.phaseWeek, p.mrvRot,
    p.preSelectedIds, p.preSelectedNames, p.rotationBlockIds,
    p.favoriteIds, p.excludeIds,
    p.avoidAxialLoad, p.equipmentList, p.methodology, p.isFemale,
    p.intensityTechnique, p.autoDeload, p.loadStrategy, p.autoRegResult,
    p.specialization, p.pedDoses, p.labMrvMultiplier, p.courseIntensity, p.onCourse, p.sex,
    p.weekLocalUsed, p.primaryBySlot, p.trainingFocus, p.eccentricMult,
    p.mobilityRestrictions, p.trainingYears, p.bodyweightCapability,
    p.fewerCompound, p.allowStrengthLifts, p.rotationMode, p.intensityLevel, p.legDayIndex ?? 0,
    p.skipStrictCoverage,
  );
}

/** Р Р°Р·РјРёРЅРѕС‡РЅРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ РЅР° С†РµР»РµРІСѓСЋ РіСЂСѓРїРїСѓ: 3Г—10-15 Р»С‘РіРєРёС… РїРѕРІС‚РѕСЂРµРЅРёР№ (~25% workMax). */
function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** РЎРґРІРёРЅСѓС‚СЊ ISO-РґР°С‚Сѓ РЅР° N РґРЅРµР№ (fix F: per-week РѕС†РµРЅРєР° С‚СЂР°РІРј). */
function addDaysISO(from: string, days: number): string {
  const d = new Date(from + 'T00:00:00');
  if (isNaN(d.getTime())) return todayStr();
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// fix N: СЂРµР°Р»СЊРЅС‹Р№ auto-deload РїРѕ ACWR. Р§РёС‚Р°РµРј sRPE-СЃРµСЃСЃРёРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ Рё РІС‹С‡РёСЃР»СЏРµРј
// acute:chronic ratio. РџСЂРё РїРµСЂРµС‚СЂРµРЅРёСЂРѕРІР°РЅРЅРѕСЃС‚Рё (ratio > 1.5) СЂР°Р·РіСЂСѓР·РѕС‡РЅС‹Рµ РЅРµРґРµР»Рё
// РЅР°Р·РЅР°С‡Р°СЋС‚СЃСЏ С‡Р°С‰Рµ, Р° РІ РєРѕСЂРѕС‚РєРёС… РїР»Р°РЅР°С… (в‰Ґ3 РЅРµРґ) вЂ” РіР°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅРѕ РїРѕСЏРІР»СЏРµС‚СЃСЏ deload.
function computeAcwr(): number {
  try {
    const sessions = loadSRPESessions();
    if (!sessions || sessions.length < 2) return 1;
    const daily = toDailyLoads(sessions as any);
    const r = acuteChronicRatio(daily);
    return r && isFinite(r.ratio) ? r.ratio : 1;
  } catch {
    return 1;
  }
}

export function buildBBPlan(input: BBBuilderInput, pedAdapt?: PEDAdaptation): BBPlan {
  // F0 guard: weeks clamp 1-52 вЂ” РєР°РїС‹ freeze, С‚РѕР»СЊРєРѕ РІР°Р»РёРґР°С†РёСЏ РІС…РѕРґР° (РЅРµ РјРµРЅСЏРµС‚ Р»РёРјРёС‚С‹)
  if (!Number.isFinite(input.weeks) || input.weeks < 1 || input.weeks > 52) {
    console.warn(`[bb-builder] buildBBPlan: weeks=${input.weeks} РЅРµРєРѕСЂСЂРµРєС‚РЅРѕ вЂ” РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ ${Math.max(1, Math.min(52, Math.round(Number(input.weeks) || 8)))}`);
  }
  // Р§РёСЃР»РѕРІС‹Рµ РіР°СЂРґС‹ вЂ” Р·Р°С‰РёС‚Р° РѕС‚ NaN/СЌРєСЃС‚СЂРµРјР°Р»РµР№ Р±РµР· СЃРґРІРёРіР° РєР°РїРѕРІ (С‚РѕР»СЊРєРѕ clamp + warn)
  const numWarn = (name: string, v: any, min: number, max: number) => {
    if (v == null) return;
    if (!Number.isFinite(v) || v < min || v > max) console.warn(`[bb-builder] ${name}=${v} РІРЅРµ РґРёР°РїР°Р·РѕРЅР° [${min},${max}], clamp`);
  };
  numWarn('bodyFat', input.bodyFat, 3, 60);
  numWarn('leanMass', input.leanMass, 20, 150);
  numWarn('hrvMs', input.hrvMs, 10, 200);
  numWarn('sleepHours', input.sleepHours, 0, 12);
  numWarn('stressLevel', input.stressLevel, 0, 10);
  numWarn('labMrvMultiplier', input.labMrvMultiplier, 0.5, 1.5);
  numWarn('eccentricMult', input.eccentricMult, 0.8, 1.5);
  numWarn('calorieSurplus', input.calorieSurplus, -2000, 2000);
  numWarn('proteinPerKg', input.proteinPerKg, 0, 5);
  if (input.workMax) {
    for (const [k, v] of Object.entries(input.workMax)) {
      if (!Number.isFinite(v as number) || (v as number) < 0 || (v as number) > 500) {
        console.warn(`[bb-builder] workMax[${k}]=${v} РІРЅРµ [0,500], fallback`);
      }
    }
  }
  // Clamp РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ NaN-РїСЂРѕРїР°РіР°С†РёРё (РЅРµ РјРµРЅСЏРµС‚ РєР°РїС‹, С‚РѕР»СЊРєРѕ РІС…РѕРґ)
  if (Number.isFinite(input.bodyFat)) input.bodyFat = Math.max(3, Math.min(60, input.bodyFat as number));
  if (Number.isFinite(input.leanMass)) input.leanMass = Math.max(20, Math.min(150, input.leanMass as number));
  if (Number.isFinite(input.hrvMs)) input.hrvMs = Math.max(10, Math.min(200, input.hrvMs as number));
  if (Number.isFinite(input.sleepHours)) input.sleepHours = Math.max(0, Math.min(12, input.sleepHours as number));
  if (Number.isFinite(input.stressLevel)) input.stressLevel = Math.max(0, Math.min(10, input.stressLevel as number));
  if (Number.isFinite(input.labMrvMultiplier)) input.labMrvMultiplier = Math.max(0.5, Math.min(1.5, input.labMrvMultiplier as number));
  if (Number.isFinite(input.eccentricMult)) input.eccentricMult = Math.max(0.8, Math.min(1.5, input.eccentricMult as number));
  if (Number.isFinite(input.calorieSurplus)) input.calorieSurplus = Math.max(-2000, Math.min(2000, input.calorieSurplus as number));
  if (Number.isFinite(input.proteinPerKg)) input.proteinPerKg = Math.max(0, Math.min(5, input.proteinPerKg as number));
  if (input.workMax) {
    for (const [k, v] of Object.entries(input.workMax)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 500) delete (input.workMax as any)[k];
    }
  }
  const foundPattern = getPattern(input.patternId);
  if (!foundPattern) {
    console.warn(`[bb-builder] buildBBPlan: patternId="${input.patternId}" РЅРµ РЅР°Р№РґРµРЅ вЂ” fallback РЅР° SPLIT_PATTERNS[0] (${SPLIT_PATTERNS[0].id}). РџСЂРѕРІРµСЂСЊС‚Рµ, С‡С‚Рѕ РїРµСЂРµРґР°С‘С‚Рµ patternId (РЅРµ split).`);
  }
  const pattern = foundPattern || SPLIT_PATTERNS[0];
  const level = normLevel(input.level) as TrainingLevel;
  const inputWorkMax = input.workMax || {};
  // PRO: cross-mesocycle continuity вЂ” РїСЂРѕРіСЂРµСЃСЃРёСЏ РІРµСЃРѕРІ Рё РѕР±СЉС‘РјР° РёР· РїСЂРµРґС‹РґСѓС‰РµРіРѕ РїР»Р°РЅР°.
  const mesoProgression = input.previousPlan
    ? extractMesocycleProgression(input.previousPlan, level, input.goal)
    : null;
  // Epic A: РїРµСЂСЃРѕРЅР°Р»СЊРЅР°СЏ РєР°Р»РёР±СЂРѕРІРєР° MEV (СЏРІРЅС‹Р№ РІС…РѕРґ РёР»Рё Р°РІС‚Рѕ РёР· С…СЂР°РЅРёР»РёС‰Р°).
  const mevCal = input.mevCalibration !== undefined
    ? input.mevCalibration
    : (loadMEVCalibration?.() ?? null);
  /** Р›Р°РЅРґРјР°СЂРє СЃ СѓС‡С‘С‚РѕРј РєР°Р»РёР±СЂРѕРІРєРё (personal > РїРѕРїСѓР»СЏС†РёРѕРЅРЅС‹Р№), РІРЅСѓС‚СЂРё РєР°РїРѕРІ. */
  const lmFor = (m: string, rd: number): MuscleVolumeLandmarks | null =>
    calibratedLandmarksFor(level, m, rd, mevCal);
  const workMax = mesoProgression
    ? applyWeightProgression(inputWorkMax, mesoProgression)
    : inputWorkMax;
  const weakPoints = input.weakPoints || [];
  const focusGroup = input.focusGroup;
  // Р•РґРёРЅС‹Р№ СЂРµР·РѕР»РІРµСЂ Р°РєС†РµРЅС‚РѕРІ: focus/weak/specialization Р±РѕР»СЊС€Рµ РЅРµ СЃРєР»Р°РґС‹РІР°СЋС‚СЃСЏ
  // (1.2 Г— 1.3 = 1.56), top-2 СЃРїРµС†РёР°Р»РёР·Р°С†РёРё вЂ” РєР°РЅРѕРЅРёС‡РµСЃРєРёРµ, specialization Р±РµР·
  // СЃР»Р°Р±С‹С… РіСЂСѓРїРї вЂ” no-op. РЈСЂРѕРІРµРЅСЊ/СЃС‚Р°Р¶/PED/recovery/nutrition/lab/goal-РјРЅРѕР¶РёС‚РµР»Рё
  // РїСЂРёРјРµРЅСЏСЋС‚СЃСЏ РџРћР’Р•Р РҐ С„Р°РєС‚РѕСЂРѕРІ СЂРµР·РѕР»РІРµСЂР° Рё РЅРµ РјРµРЅСЏСЋС‚СЃСЏ.
  const specRes = resolveSpecialization(focusGroup, weakPoints, input.specialization);
  // Р Р°СЃРїРёСЃР°РЅРёРµ Р±Р»РѕРєРѕРІ СЃРїРµС†РёР°Р»РёР·Р°С†РёРё (РјРµС‚РѕРґРёРєР°: Р±Р»РѕРє 6-10 РЅРµРґ в†’ Р±Р°Р»Р°РЅСЃ РёР»Рё
  // СЃР»РµРґСѓСЋС‰РёР№ Р±Р»РѕРє СЃ РґСЂСѓРіРёРјРё/С‚РµРјРё Р¶Рµ С†РµР»СЏРјРё вЂ” РЅР° РІС‹Р±РѕСЂ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ).
  const specSchedule = buildSpecializationSchedule(
    focusGroup, weakPoints, input.specialization, input.weeks, input.specializationSchedule,
  );
  const sessions = sessionsOf(pattern);
  const injuries = input.injuries || [];
  const favIds = input.favoriteExercises || [];
  const exclIds = input.excludedExercises || [];
  const avAxial = input.avoidAxialLoad || false;
  const eqList = input.equipment || [];
  const backProfile = backVolumeProfile(level, input.trainingYears);
  const legProfile = legVolumeProfile(level, input.trainingYears);
  const torsoProfile = torsoVolumeProfile(level, input.trainingYears);
  // Р•РґРёРЅС‹Р№ РјРЅРѕР¶РёС‚РµР»СЊ СЂРµР¶РёРјР° (РџР•Р”/РєСѓСЂСЃ): РЅР°С‚СѓСЂР°Р» Г—1.0, РЅР° РєСѓСЂСЃРµ Г—2.0 РЅР° РіР»Р°РІРЅС‹Рµ РјС‹С€С†С‹.
  // Р—Р°РјРµРЅСЏРµС‚ СЃС‚СЌРєРёРЅРі backProfileГ—legProfileГ—torsoProfile (Г—2.2/1.8/1.6) + pedAdapt.
  const onCourse = (!!(pedAdapt && pedAdapt.activePEDs && pedAdapt.activePEDs.length > 0))
    || Object.values(input.pedDoses || {}).some(d => {
      const v = typeof d === 'string' ? parseFloat(String(d).replace(',', '.').replace(/[^0-9.\-eE]/g, '')) : Number(d);
      return Number.isFinite(v) && v > 0;
    });
  // Р¤Р°Р·Р° 2.11: РµРґРёРЅС‹Р№ MRV-РєРѕРЅРІРµР№РµСЂ вЂ” PED-РєСЂРёРІС‹Рµ (doseAwareMrv) РєР°Рє РІС…РѕРґ, РІРјРµСЃС‚Рѕ
  // РїР»РѕСЃРєРѕРіРѕ Г—2.0. РЎРѕРіР»Р°СЃСѓРµС‚ per-muscle caps СЃ landmarks/РІР°Р»РёРґР°С†РёРµР№ (СѓР±РёСЂР°РµС‚
  // СЂРёСЃРє РґРІРѕР№РЅРѕРіРѕ РјР°СЃС€С‚Р°Р±РёСЂРѕРІР°РЅРёСЏ: Р»С‘РіРєРёР№ РєСѓСЂСЃ Р±РѕР»СЊС€Рµ РЅРµ РїРѕР»СѓС‡Р°РµС‚ caps Г—2.0 РїСЂРё
  // landmarks Г—1.3).
  const regimeMult = computeMrvMult({
    onCourse,
    courseIntensity: pedAdapt?.courseIntensity || input.courseIntensity,
    doseAwareMrv: pedAdapt?.combinedMrvMultiplier,
  });
  const recoveryScore = computeBBRecoveryScore({
    bodyFat: input.bodyFat, leanMass: input.leanMass, hrvMs: input.hrvMs,
    sleepHours: input.sleepHours, stressLevel: input.stressLevel,
  });
  // Р¤Р°Р·Р° 4.28: СЂСѓС‡РЅРѕР№ РѕРІРµСЂСЂР°Р№Рґ РјРЅРѕР¶РёС‚РµР»СЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ РёР· РІРёР·Р°СЂРґР°.
  const recoveryMultOverride = Number.isFinite(input.recoveryMultOverride) ? Math.max(0.6, Math.min(1.5, input.recoveryMultOverride as number)) : 1;
  const weeklyBudget = Math.round(computeBBWeeklyBudget({
    onCourse,
    courseIntensity: pedAdapt?.courseIntensity || input.courseIntensity,
    recoveryScore,
    calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg,
    labMrvMultiplier: input.labMrvMultiplier,
  }) * recoveryMultOverride);
  const sessLimits = sessionLimitsFor({
    onCourse,
    courseIntensity: pedAdapt?.courseIntensity || input.courseIntensity,
    recoveryScore,
    calorieSurplus: input.calorieSurplus, proteinPerKg: input.proteinPerKg,
    labMrvMultiplier: input.labMrvMultiplier,
    level, trainingYears: input.trainingYears, trainingVolumeMode: input.trainingVolumeMode,
  }, { id: pattern.id, sessionGroups: sessions.length });

  const today = todayStr();
  const excludedMuscles = getExcludedMuscles(injuries, today);
  const gradedInjuries = getGradedInjuries(injuries, today);
  // РћР±С‰РёР№ РїСѓР» С‚СЂР°РІРјРёСЂРѕРІР°РЅРЅС‹С… РјС‹С€С† (РґР»СЏ injuryProfile вЂ” РїРµСЂРµРґР°С‘С‚СЃСЏ РІ selectExercisesSmart)
  const injuredMuscles = new Set([...excludedMuscles, ...gradedInjuries.map(inj => inj.muscle)]);
  const injuryProfile = [...injuredMuscles];

  // Р’С‹С‡РёСЃР»СЏРµРј dailyCap (max РіСЂСѓРїРї РІ РґРµРЅСЊ) РґР»СЏ S-MRV-Р±СЋРґР¶РµС‚Р° вЂ” РїРѕ РґРµРґСѓРїР»РёС†РёСЂРѕРІР°РЅРЅС‹Рј РєР°С‚Р°Р»РѕРі-РіСЂСѓРїРїР°Рј (fix Z)
  const maxGroupsPerSession = Math.max(1, ...sessions.map(s => dedupeMuscles(s.sessionTag, excludedMuscles).length));
  const dailyCap = level === 'enhanced' && (input.trainingYears ?? 0) >= 3
    ? Math.max(14, Math.min(22, Math.round(8 + maxGroupsPerSession * 3)))
    : Math.max(10, Math.min(16, Math.round(8 + maxGroupsPerSession * 2)));

  // fix Z + BUG-B5 + PPL shoulder split: muscleSessionCount РєР»СЋС‡РѕРј СЏРІР»СЏРµС‚СЃСЏ collapseKey,
  // РЅРѕ РґР»СЏ PPL РїР»РµС‡Рё РёРґСѓС‚ СЂР°Р·РґРµР»СЊРЅРѕ: Push в†’ РїРµСЂРµРґРЅСЏСЏ+СЃСЂРµРґРЅСЏСЏ (delt_front/delt_mid), Pull в†’ Р·Р°РґРЅСЏСЏ (delt_rear).
  // РџРѕСЌС‚РѕРјСѓ РґР»СЏ PPL РЅРµ СЃС…Р»РѕРїС‹РІР°РµРј delt_* РІ shoulders, СЃС‡РёС‚Р°РµРј РєР°Р¶РґС‹Р№ РїСѓС‡РѕРє РѕС‚РґРµР»СЊРЅРѕ:
  // PPL 6Г— (2Г—Push + 2Г—Pull) в†’ delt_front 2Г—, delt_mid 2Г—, delt_rear 2Г—, Р° РЅРµ shoulders 4Г—.
  const isPPL = pattern.id.toLowerCase().includes('ppl');
  const collapseForCount = (m: string): string => (isPPL && m.startsWith('delt_') ? m : collapseKey(m));
  const muscleSessionCount: Record<string, number> = {};
  for (const s of sessions) {
    const seenThisSession = new Set<string>();
    for (const m of musclesForTag(s.sessionTag)) {
      const ck = collapseForCount(m);
      if (excludedMuscles.has(m)) continue;
      if (seenThisSession.has(ck)) continue; // РґРµРґСѓРї РІРЅСѓС‚СЂРё РѕРґРЅРѕР№ СЃРµСЃСЃРёРё (РґР»СЏ РЅРµ-PPL СЃС…Р»РѕРїС‹РІР°РµС‚ С„СЂРѕРЅ+РјРёРґ)
      seenThisSession.add(ck);
      muscleSessionCount[ck] = (muscleSessionCount[ck] || 0) + 1;
    }
  }

  const muscleVolumeRotation: Record<string, number> = {};
  const mrvByMuscle: Record<string, number> = {};
  const volumeTargets: Record<string, BBVolumeTarget> = {};
  // Recovery/nutrition вЂ” РµРґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РёР· bb-volume.engine (fix F1: СѓР±РёСЂР°РµРј РґСѓР±Р»Рё)
  const recoveryMult = computeBBRecoveryMultiplier({
    bodyFat: input.bodyFat,
    leanMass: input.leanMass,
    hrvMs: input.hrvMs,
    sleepHours: input.sleepHours,
    stressLevel: input.stressLevel,
  });
  const nutritionMult = computeBBNutritionMultiplier({
    calorieSurplus: input.calorieSurplus,
    proteinPerKg: input.proteinPerKg,
  });
  // РћР±С‰Р°СЏ С†РµРїРѕС‡РєР° РјРѕРґРёС„РёРєР°С‚РѕСЂРѕРІ С†РµР»РµРІРѕРіРѕ РѕР±СЉС‘РјР° (СѓСЂРѕРІРµРЅСЊ/СЃС‚Р°Р¶/PED/lab/meso) вЂ”
  // РїСЂРёРјРµРЅСЏРµС‚СЃСЏ Рє Р›Р®Р‘РћРњРЈ РІР°СЂРёР°РЅС‚Сѓ С†РµР»РµРІРѕРіРѕ РѕР±СЉС‘РјР° (СЃРїРµС†-Р±Р»РѕРє РёР»Рё Р±Р°Р»Р°РЅСЃ).
  const applyRotationModifiers = (m: string, v: number): number => {
    // Goalв†’РѕР±СЉС‘Рј: cut 0.72 (РґРµС„РёС†РёС‚ -28%), recomp 0.92 (СЂРµРєРѕРјРї ~ -8%), maintenance 0.80 (MV),
    // mass 1.05, strength_mass 1.03 (С‡СѓС‚СЊ РЅРёР¶Рµ mass вЂ” СЃРёР»Р°дје…€). Р Р°Р·Р»РёС‡Р°РµРј recomp vs maintenance.
    if (input.goal === 'cut') v = Math.round(v * 0.72);
    else if (input.goal === 'recomp') v = Math.round(v * 0.92);
    else if (input.goal === 'maintenance') v = Math.round(v * 0.80);
    else if (input.goal === 'mass') v = Math.round(v * 1.05);
    else if (input.goal === 'strength_mass') v = Math.round(v * 1.03);
    // Р•РґРёРЅС‹Р№ РјРЅРѕР¶РёС‚РµР»СЊ СЂРµР¶РёРјР° (РџР•Р”/РєСѓСЂСЃ): Г—2 РЅР° РіР»Р°РІРЅС‹Рµ РјС‹С€С†С‹, РћР”РќРћ РїСЂРёРјРµРЅРµРЅРёРµ.
    // Р—Р°РјРµРЅСЏРµС‚ СЃС‚СЌРєРёРЅРі pedAdapt.combinedMrvMultiplier Г— backProfile/legProfile/torsoProfile.
    v = Math.round(v * regimeMrvMultFor(m, regimeMult));
    // P0-5: Р»Р°Р±РѕСЂР°С‚РѕСЂРЅР°СЏ РєРѕСЂСЂРµРєС†РёСЏ - СЃРЅРёР¶РµРЅРёРµ РѕР±СЉС‘РјР° РїСЂРё ALT/CRP/HCT/РіРѕСЂРјРѕРЅР°С…
    v = Math.round(v * (input.labMrvMultiplier ?? 1));
    // PRO: cross-mesocycle volume progression вЂ” +1-2 СЃРµС‚Р° per muscle РёР· РїСЂРµРґС‹РґСѓС‰РµРіРѕ РјРµР·Рѕ
    if (mesoProgression) {
      v = applyVolumeProgression(m, v, mesoProgression);
    }
    // РћР±СЉС‘РјРЅС‹Р№ С‚СЂРµРЅРёРЅРі вЂ” +25-35% РґР°Р¶Рµ РґР»СЏ РјР°РєСЃ РѕРїС‹С‚Р° (СЂР°РЅРµРµ high С‚РѕР»СЊРєРѕ СЃС‚Р°РІРёР» volumeGoal=mrv, РґР»СЏ max РѕРїС‹С‚Р° mrv СѓР¶Рµ Р±С‹Р» вЂ” СЌС„С„РµРєС‚Р° 0)
    if (input.trainingVolumeMode === 'high') {
      const boost = level === 'enhanced' && (input.trainingYears ?? 0) >= 6 ? 1.35 : level === 'enhanced' ? 1.30 : 1.25;
      v = Math.round(v * boost);
    }
    return v;
  };
  // Р‘Р°Р·РѕРІС‹Р№ С†РµР»РµРІРѕР№ РѕР±СЉС‘Рј РјС‹С€С†С‹ РґР»СЏ СЂРµР·РѕР»РІРµСЂР° (СЃРїРµС†-Р±Р»РѕРє РёР»Рё Р±Р°Р»Р°РЅСЃ).
  const baseRotationFor = (m: string, lm: { mav: number; mev: number; mrv: number }, res: SpecializationResolution): number => {
    if (res.active) {
      // Р¤РѕРєСѓСЃ-РјС‹С€С†Р° РІ СЃРїРµС†-Р±Р»РѕРєРµ: MAV (РµС‘ СЌРјС„Р°Р·РёСЃ Г—1.3 РїСЂРёРјРµРЅРёС‚СЃСЏ per-session,
      // Р±РµР· СЃС‚СЌРєРёРЅРіР° 1.1Г—1.3). Р¦РµР»Рё Р±Р»РѕРєР°: MAV Г— (1.0 + 0.1Г—Р·РѕРЅ) вЂ” РѕРґРЅР° Р·РѕРЅР°
      // Г—1.1, РґРІРµ Р·РѕРЅС‹ РѕРґРЅРѕР№ РјС‹С€С†С‹ (delt_mid+delt_rear) Г—1.2. РћСЃС‚Р°Р»СЊРЅС‹Рµ:
      // РїРѕРґРґРµСЂР¶РёРІР°СЋС‰РёР№ РѕР±СЉС‘Рј MEV (РїРµСЂРµСЂР°СЃРїСЂРµРґРµР»РµРЅРёРµ В«volume bucketВ»).
      // Р”Р»СЏ PPL РґРµР»СЊС‚С‹ СЃС‡РёС‚Р°РµРј РїРѕ РєР°РЅРѕРЅРёС‡РµСЃРєРѕР№ РіСЂСѓРїРїРµ (shoulders), С‡С‚РѕР±С‹ 2 РїСѓС‡РєР° РґР°Р»Рё Г—1.2 РєР°Р¶РґРѕРјСѓ.
      if (res.focus && m === canonicalMuscle(res.focus)) return lm.mav;
      const canonicalM = canonicalMuscle(m);
      const heads = res.targets.filter(t => canonicalMuscle(t) === canonicalM).length;
      if (heads > 0) return Math.round(lm.mav * Math.min(1.3, 1.0 + 0.1 * heads));
      return lm.mev;
    }
    if (input.volumeGoal === 'mev') return lm.mev;
    if (input.volumeGoal === 'mrv') return lm.mrv;
    return lm.mav;
  };
  for (const m of Object.keys(muscleSessionCount)) {
    const lm = lmFor(m, pattern.rotationDays);
    if (lm) {
      let v = baseRotationFor(m, lm, specRes);
      v = applyRotationModifiers(m, v);
      v = muscleVolumeRotation[m] = v;
      volumeTargets[m] = buildBBVolumeTarget({
        muscle: m,
        frequency: muscleSessionCount[m] || 1,
        landmarks: lm,
        rotationSets: v,
        volumeGoal: input.volumeGoal || 'mav',
        weakPoint: isSpecializationWeak(m, specRes),
        focus: isSpecializationFocus(m, specRes),
        // BUG-FIX: recoveryMultiplier СѓР¶Рµ РїСЂРёРјРµРЅС‘РЅ Рє rotationSets (v) РЅР° СЃС‚СЂРѕРєР°С… РІС‹С€Рµ
        // (v *= recoveryMult * nutritionMult * pedAdapt * labMrvMultiplier * goal).
        // РџРµСЂРµРґР°С‘Рј 1.0 С‡С‚РѕР±С‹ РёР·Р±РµР¶Р°С‚СЊ РґРІРѕР№РЅРѕРіРѕ РїСЂРёРјРµРЅРµРЅРёСЏ.
        // MRV cap (mrvByMuscle[m]) РІС‹С‡РёСЃР»СЏРµС‚СЃСЏ РѕС‚РґРµР»СЊРЅРѕ РЅР° СЃС‚СЂРѕРєРµ 1977 СЃ СѓС‡С‘С‚РѕРј recovery.
        recoveryMultiplier: 1,
      });
      // fix D: РёСЃС‚РёРЅРЅС‹Р№ MRV вЂ” РїРѕС‚РѕР»РѕРє РґР»СЏ РєР°РїР°.
      // fix C: РґР»СЏ РѕС‚СЃС‚Р°СЋС‰РёС…/С„РѕРєСѓСЃ-РіСЂСѓРїРї РїРѕРґРЅРёРјР°РµРј РїРѕС‚РѕР»РѕРє РІ С‚Р°РєС‚ РѕР±СЉС‘РјРЅРѕРјСѓ
      // Р±СѓСЃС‚Сѓ (weak Г—1.2, focus Г—1.3), РёРЅР°С‡Рµ normalizeWeekMrv СЃС‚РёСЂР°РµС‚ Р°РєС†РµРЅС‚.
      // PED: Р±Р°Р·РѕРІС‹Р№ MRV СѓРјРЅРѕР¶Р°РµС‚СЃСЏ РЅР° combinedMrvMultiplier Р”Рћ РєРѕСЂСЂРµРєС‚РёСЂРѕРІРѕРє
      // РќРѕРіРё: РЅРµРґРµР»СЊРЅС‹Р№ РєР°Рї РјР°СЃС€С‚Р°Р±РёСЂСѓРµС‚СЃСЏ С‡Р°СЃС‚РѕС‚РѕР№ СЃРµСЃСЃРёР№ (3Г—/РЅРµРґ РїРµСЂРµРЅРѕСЃРёС‚СЃСЏ
      // Р»СѓС‡С€Рµ, С‡РµРј С‚РѕС‚ Р¶Рµ РѕР±СЉС‘Рј Р·Р° 2Г— вЂ” СЂР°СЃРїСЂРµРґРµР»С‘РЅРЅС‹Р№ РѕР±СЉС‘Рј, Helms 2019).
      const legFreqMult = ['quads', 'hamstrings', 'glutes'].includes(m) ? Math.max(1, (muscleSessionCount[m] || 1) / 2) : 1;
      // Р•РґРёРЅС‹Р№ СЂРµР¶РёРј-РјРЅРѕР¶РёС‚РµР»СЊ (Г—2 РЅР° РєСѓСЂСЃРµ РЅР° РіР»Р°РІРЅС‹Рµ РјС‹С€С†С‹) вЂ” Р±РµР· СЃС‚СЌРєРёРЅРіР°
      // pedAdapt Г— backProfile/legProfile/torsoProfile capMult.
      let capMrv = Math.round(lm.mrv * regimeMrvMultFor(m, regimeMult) * (input.labMrvMultiplier ?? 1) * recoveryMult * nutritionMult * legFreqMult * recoveryMultOverride);
      if (input.trainingVolumeMode === 'high') {
        const capBoost = level === 'enhanced' && (input.trainingYears ?? 0) >= 6 ? 1.25 : 1.15;
        capMrv = Math.round(capMrv * capBoost);
      }
      // Р СѓРєРё/СЏРіРѕРґРёС†С‹/РїР»РµС‡Рё: РїСЂРё Р±РѕР»СЊС€РёС… С‚СЏРіР°С…/Р¶РёРјР°С…/РїСЂРёСЃРµРґР°РЅРёСЏС… РєРѕСЃРІРµРЅРЅС‹Р№
      // РѕР±СЉС‘Рј Р·Р°РєСЂС‹РІР°РµС‚ С‡Р°СЃС‚СЊ target, РЅРѕ РїРѕС‚РѕР»РѕРє С‚РѕР¶Рµ РґРѕР»Р¶РµРЅ СЂР°СЃС‚Рё СЃРѕ СЃС‚Р°Р¶РµРј
      // (РёРЅР°С‡Рµ Р»РѕР¶РЅС‹Р№ MRV-overflow РЅР° enhanced-РїР»Р°РЅР°С…).
      if (['biceps', 'triceps', 'glutes', 'shoulders'].includes(m) && input.trainingYears !== undefined && input.trainingYears >= 3) {
        capMrv = Math.round(capMrv * (input.trainingYears >= 8 ? 1.8 : input.trainingYears >= 6 ? 1.6 : 1.3));
      }
      const specMrv = specializationMrvFactor(m, specRes);
      if (specMrv !== 1) capMrv = Math.round(capMrv * specMrv);
      // Blast/Cruise: РїРѕС‚РѕР»РѕРє РґРѕР»Р¶РµРЅ РїРѕР·РІРѕР»СЏС‚СЊ blast-РЅРµРґРµР»СЋ (+15%), РёРЅР°С‡Рµ blast overflow
      if (input.blastCruiseEnabled) capMrv = Math.round(capMrv * 1.15);
      mrvByMuscle[m] = capMrv;
    }
  }
  // B6: СЂР°СЃС€РёСЂСЏРµРј mrvByMuscle РґР»СЏ PRO-РєР»СЋС‡РµР№ (delt_front/mid/rear, forearms, traps,
  // lower_back, abs, calves) Рё СЂСѓРє (biceps/triceps вЂ” РІ СЃРїР»РёС‚Р°С… СЃ 'arms' РѕРЅРё РЅРµ
  // РїРѕРїР°РґР°СЋС‚ РІ muscleSessionCount, РЅРѕ РєР°Рї РЅСѓР¶РµРЅ РґР»СЏ РІР°Р»РёРґР°С†РёРё/РєР°РїРѕРІ СѓРїСЂР°Р¶РЅРµРЅРёР№).
  const PRO_KEYS = ['delt_front', 'delt_mid', 'delt_rear', 'forearms', 'traps', 'lower_back', 'abs', 'calves', 'biceps', 'triceps'];
  for (const m of PRO_KEYS) {
    if (mrvByMuscle[m]) continue;
    // BUG-FIX: РїСЂРѕРІРµСЂСЏРµРј excludedMuscles РґР»СЏ PRO-РєР»СЋС‡РµР№ (Рё РёС… collapseKey).
    // Р Р°РЅСЊС€Рµ С‚СЂР°РІРјРёСЂРѕРІР°РЅРЅС‹Рµ PRO-РјС‹С€С†С‹ (РЅР°РїСЂРёРјРµСЂ forearms) РїРѕР»СѓС‡Р°Р»Рё MRV cap,
    // Рё normalizeWeekMrv РїС‹С‚Р°Р»СЃСЏ РєР°РїР°С‚СЊ СѓРїСЂР°Р¶РЅРµРЅРёСЏ РґР»СЏ РЅРёС….
    if (excludedMuscles.has(m) || excludedMuscles.has(collapseKey(m))) continue;
    const lm = lmFor(m, pattern.rotationDays);
    if (lm) {
      let capMrv = Math.round(lm.mrv * regimeMrvMultFor(m, regimeMult) * (input.labMrvMultiplier ?? 1) * recoveryMult * nutritionMult * recoveryMultOverride);
      // Р СѓРєРё/СЏРіРѕРґРёС†С‹/РїР»РµС‡Рё: РєРѕСЃРІРµРЅРЅС‹Р№ РѕР±СЉС‘Рј РѕС‚ С‚СЏРі/Р¶РёРјРѕРІ С‚СЂРµР±СѓРµС‚ СЃС‚Р°Р¶РµРІС‹Р№ РєР°Рї-Р±СѓСЃС‚.
      if (['biceps', 'triceps'].includes(m) && input.trainingYears !== undefined && input.trainingYears >= 3) {
        capMrv = Math.round(capMrv * (input.trainingYears >= 8 ? 1.8 : input.trainingYears >= 6 ? 1.6 : 1.3));
      }
      const specMrvPro = specializationMrvFactor(m, specRes);
      if (specMrvPro !== 1) capMrv = Math.round(capMrv * specMrvPro);
      if (input.blastCruiseEnabled) capMrv = Math.round(capMrv * 1.15);
      mrvByMuscle[m] = capMrv;
    }
  }

  // Р¦РµР»РµРІС‹Рµ РѕР±СЉС‘РјС‹ РґР»СЏ РѕСЃС‚Р°Р»СЊРЅС‹С… Р±Р»РѕРєРѕРІ СЂР°СЃРїРёСЃР°РЅРёСЏ (РґСЂСѓРіРёРµ С†РµР»Рё / Р±Р°Р»Р°РЅСЃ):
  // РѕРґРЅР° РєР°СЂС‚Р° РЅР° СѓРЅРёРєР°Р»СЊРЅС‹Р№ РЅР°Р±РѕСЂ С†РµР»РµР№. РџРµСЂРІРёС‡РЅР°СЏ РєР°СЂС‚Р° (muscleVolumeRotation)
  // СѓР¶Рµ РїРѕСЃС‡РёС‚Р°РЅР° РІС‹С€Рµ; РєР°РїС‹/targets СЃС‚СЂРѕСЏС‚СЃСЏ РїРѕ РїРµСЂРІРёС‡РЅРѕРјСѓ Р±Р»РѕРєСѓ.
  const rotationMapByKey = new Map<string, Record<string, number>>();
  rotationMapByKey.set(specRes.targets.join('|'), muscleVolumeRotation);
  for (const block of specSchedule.blocks) {
    const key = block.targets.join('|');
    if (rotationMapByKey.has(key)) continue;
    const res: SpecializationResolution = block.targets.length > 0
      ? { targets: block.targets, focus: specRes.focus, weak: block.targets, active: true }
      : { targets: [], focus: specRes.focus, weak: [], active: false };
    const map: Record<string, number> = {};
    for (const m of Object.keys(muscleSessionCount)) {
      const lm = lmFor(m, pattern.rotationDays);
      if (!lm) continue;
      map[m] = applyRotationModifiers(m, baseRotationFor(m, lm, res));
    }
    rotationMapByKey.set(key, map);
  }
  // Р’СЃРµ С†РµР»Рё РІСЃРµС… Р±Р»РѕРєРѕРІ (РґР»СЏ feeders/РєРѕРјРїРµРЅСЃР°С†РёРё СЃР»Р°Р±С‹С… РіСЂСѓРїРї РїРѕ РІСЃРµРјСѓ РїР»Р°РЅСѓ).
  const allSpecTargets = Array.from(new Set(specSchedule.blocks.flatMap(b => b.targets)));

  // Р¤Р°Р·РѕРІР°СЏ РїРµСЂРёРѕРґРёР·Р°С†РёСЏ (distributePhases) вЂ” Р•Р”РРќР«Р™ РёСЃС‚РѕС‡РЅРёРє RIR/deload (fix A)
  // fix N: deload-С‡Р°СЃС‚РѕС‚Р° Р·Р°РІРёСЃРёС‚ РѕС‚ СЂРµР°Р»СЊРЅРѕР№ РЅР°РіСЂСѓР·РєРё (ACWR). РџСЂРё ratio>1.5 вЂ”
  // СѓС‡Р°С‰Р°РµРј СЂР°Р·РіСЂСѓР·РєСѓ (РєР°Р¶РґС‹Рµ 3 РЅРµРґ) Рё РіР°СЂР°РЅС‚РёСЂСѓРµРј deload РґР°Р¶Рµ РІ РєРѕСЂРѕС‚РєРёС… РїР»Р°РЅР°С… (в‰Ґ3 РЅРµРґ).
  // P2: РґР»СЏ РїР»Р°РЅРѕРІ 4-5 РЅРµРґ вЂ” РїРѕСЃР»РµРґРЅСЏСЏ РЅРµРґРµР»СЏ = РґРµР»РѕРґ (4-РЅРµРґ РїР»Р°РЅ Р±РµР· СЂР°Р·РіСЂСѓР·РєРё = РїРµСЂРµС‚СЂРµРЅ).
  // Р”Р»СЏ в‰Ґ6 РЅРµРґ вЂ” СЃС‚Р°РЅРґР°СЂС‚РЅР°СЏ С‡Р°СЃС‚РѕС‚Р° РєР°Р¶РґС‹Рµ 4 РЅРµРґ.
  // Р”Р»СЏ <4 РЅРµРґ вЂ” РґРµР»РѕРґР° РЅРµС‚ (СЃР»РёС€РєРѕРј РєРѕСЂРѕС‚РєРёР№ С†РёРєР»).
  const acwrRatio = computeAcwr();
  let deloadFreq = 0;
  let forceFinalDeload = false;
  if (input.weeks >= 6) {
    deloadFreq = 4;
  } else if (input.weeks >= 4) {
    forceFinalDeload = true;
  }
  // P0-7 (audit 2026-07): ACWR thresholds вЂ” 1.3 = caution (display only),
  // 1.5 = enforce deload (Grgic 2020; optimum 0.8-1.3, caution 1.3-1.5, danger >1.5).
  const acwrCaution = acwrRatio > 1.3 && acwrRatio <= 1.5 && input.weeks >= 3;
  const acwrDanger = acwrRatio > 1.5 && input.weeks >= 3;
  if (acwrDanger) {
    deloadFreq = Math.max(1, Math.min(deloadFreq || 3, 3));
  }
  const phaseDist = distributePhases(input.weeks, deloadFreq, input.goal || 'mass', input.trainingFocus);
  // P2: РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅС‹Р№ С„РёРЅР°Р»СЊРЅС‹Р№ РґРµР»РѕРґ РґР»СЏ 4-5 РЅРµРґ РїР»Р°РЅРѕРІ (С‡РµСЂРµР· Р·Р°РјРµРЅСѓ РїРѕСЃР»РµРґРЅРµР№ РЅРµРґРµР»Рё)
  if (forceFinalDeload && input.weeks >= 4) {
    const lastIdx = phaseDist.findIndex(pd => pd.startWeek === input.weeks);
    if (lastIdx >= 0) {
      phaseDist[lastIdx] = { phase: 'deload', startWeek: input.weeks, endWeek: input.weeks, weeks: [input.weeks], config: getPhaseConfig('deload', input.trainingFocus) };
    }
  }
  const phaseByWeek = new Map<number, BBPhase>();
  // Store the phase for every week in the block, not only its first week.
  // Otherwise weeks inside a multi-week phase silently fall back to
  // accumulation and receive the wrong volume/RIR/tempo.
  for (const pd of phaseDist) {
    for (const week of pd.weeks) phaseByWeek.set(week, pd.phase);
  }
  const phaseWeekCounter: Record<string, number> = { accumulation: 0, intensification: 0, deload: 0, peaking: 0 };

  const weeks: BBWeek[] = [];
  // FIX-1: Р РѕС‚Р°С†РёСЏ СѓРїСЂР°Р¶РЅРµРЅРёР№ вЂ” РќРђРљРђРџР›РР’РђР•Рў РёСЃРїРѕР»СЊР·РѕРІР°РЅРЅС‹Рµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ РІРµСЃСЊ РїР»Р°РЅ.
  // РќР• СЃР±СЂР°СЃС‹РІР°РµРј РєР°Р¶РґС‹Рµ 4 РЅРµРґ вЂ” РІРјРµСЃС‚Рѕ СЌС‚РѕРіРѕ selectExercisesSmart РёСЃРєР»СЋС‡Р°РµС‚
  // РІСЃРµ СЂР°РЅРµРµ РёСЃРїРѕР»СЊР·РѕРІР°РЅРЅС‹Рµ в†’ РЅРµРґРµР»Рё РїРѕР»СѓС‡Р°СЋС‚ Р РђР—РќР«Р• СѓРїСЂР°Р¶РЅРµРЅРёСЏ (СЂРѕС‚Р°С†РёСЏ).
  // Fallback: РµСЃР»Рё РїСѓР» РёСЃС‡РµСЂРїР°РЅ (РІСЃРµ РёСЃРєР»СЋС‡РµРЅС‹) вЂ” selectExercisesSmart РІРµСЂРЅС‘С‚ 0,
  // С‚РѕРіРґР° buildSession РѕС‡РёСЃС‚РёС‚ rotationIds РґР»СЏ СЌС‚РѕР№ РјС‹С€С†С‹ Рё РїРµСЂРµСЃРѕР±РµСЂС‘С‚.
  const rotationUsedByMuscle = new Map<string, string[]>(); // muscle в†’ [exerciseName, ...]
  const primaryBySlot = new Map<string, string>();
  const weekRotationByMuscle = new Map<string, Set<string>>(); // muscle в†’Set<name> РІРЅСѓС‚СЂРё РЅРµРґРµР»Рё
  const prevWeekUsedByMuscle = new Map<string, Set<string>>(); // muscle в†’Set<name> Р·Р° РїСЂРµРґС‹РґСѓС‰СѓСЋ РЅРµРґРµР»СЋ
  // fix L: РїР°С‚С‚РµСЂРЅС‹ РґРІРёР¶РµРЅРёР№, СѓР¶Рµ Р·Р°РґРµР№СЃС‚РІРѕРІР°РЅРЅС‹Рµ РґР»СЏ РѕС‚СЃС‚Р°СЋС‰РёС… РіСЂСѓРїРї РІРЅСѓС‚СЂРё С‚РµРєСѓС‰РµР№ РЅРµРґРµР»Рё.
  // РЎР±СЂР°СЃС‹РІР°РµС‚СЃСЏ РєР°Р¶РґСѓСЋ РЅРµРґРµР»СЋ; РїРѕР·РІРѕР»СЏРµС‚ РЅРµ РїРѕРІС‚РѕСЂСЏС‚СЊ РѕРґРёРЅ Рё С‚РѕС‚ Р¶Рµ РїР°С‚С‚РµСЂРЅ РЅР° СЂР°Р·РЅС‹С… РґРЅСЏС….
  const weekWeakPatterns = new Map<string, Set<string>>(); // weakMuscle в†’ Set<pattern>

  for (let w = 1; w <= input.weeks; w++) {
    // P5: Volume progression MEVв†’MAVв†’MRV (Helms 2022)
    // Week 1 = 0.85Г— (MEV), mid = 1.0Г— (MAV), last = 1.10Г— (MRV), deload = 0.6Г—
    const weekPhase = phaseByWeek.get(w) || 'accumulation';
    const baseWeekVolumeMult = weekPhase === 'deload' ? 0.6
      : Math.min(1.10, 0.85 + ((w - 1) / Math.max(1, input.weeks - 1)) * 0.25);
    // Blast/Cruise: 8РЅ blast Г—1.15 / 4РЅ cruise Г—0.85 (РїРѕРІС‚РѕСЂСЏРµС‚СЃСЏ), С‚РѕР»СЊРєРѕ РїСЂРё РІРєР».
    let blastMult = 1;
    if (input.blastCruiseEnabled) {
      const blast = Math.max(1, Math.min(12, input.blastWeeks ?? 8));
      const cruise = Math.max(1, Math.min(12, input.cruiseWeeks ?? 4));
      const cycle = blast + cruise;
      const pos = (w - 1) % cycle;
      blastMult = pos < blast ? 1.15 : 0.85;
    }
    const weekVolumeMult = baseWeekVolumeMult * blastMult;
    // РђРєС†РµРЅС‚С‹ РќР•Р”Р•Р›Р РїРѕ СЂР°СЃРїРёСЃР°РЅРёСЋ Р±Р»РѕРєРѕРІ СЃРїРµС†РёР°Р»РёР·Р°С†РёРё (С†РµР»Рё Р±Р»РѕРєР° РёР»Рё Р±Р°Р»Р°РЅСЃ).
    const weekSpec = specResForWeekSchedule(specSchedule, w);
    const weekRotation = rotationMapByKey.get(weekSpec.targets.join('|')) || muscleVolumeRotation;
    const scaledVolumeRotation: Record<string, number> = {};
    for (const [m, v] of Object.entries(weekRotation)) {
      scaledVolumeRotation[m] = Math.round(v * weekVolumeMult);
    }
    // Р РѕС‚Р°С†РёСЏ: РќР• СЃР±СЂР°СЃС‹РІР°РµРј вЂ” РЅР°РєР°РїР»РёРІР°РµРј РІСЃРµ РёСЃРїРѕР»СЊР·РѕРІР°РЅРЅС‹Рµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ
    // (РєР°Р¶РґР°СЏ РЅРµРґРµР»СЏ РїРѕР»СѓС‡Р°РµС‚ РЅРѕРІС‹Рµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ, РїРѕРєР° РїСѓР» РЅРµ РёСЃС‡РµСЂРїР°РЅ)
    // fix L: РїР°С‚С‚РµСЂРЅС‹ РѕС‚СЃС‚Р°СЋС‰РёС… РіСЂСѓРїРї СЃР±СЂР°СЃС‹РІР°СЋС‚СЃСЏ СЂР°Р· РІ РЅРµРґРµР»СЋ (СЃРІРµР¶РёР№ РІС‹Р±РѕСЂ РґРІРёР¶РµРЅРёР№)
    weekWeakPatterns.clear();
    const musclePrimaryAssigned = new Set<string>(); // в†ђ СЃР±СЂР°СЃС‹РІР°РµС‚СЃСЏ РљРђР–Р”РЈР® РЅРµРґРµР»СЋ
    const weekUsedByMuscle = new Map<string, Set<string>>(); // muscle в†’Set<name> РІРЅСѓС‚СЂРё РЅРµРґРµР»Рё
    const weekLocalUsed = new Map<string, Set<string>>(); // F0 fix: shared per-week dedup for buildSession
    const weekSessions: BBSession[] = [];
    const phase = phaseByWeek.get(w) || 'accumulation';
    phaseWeekCounter[phase] = (phaseWeekCounter[phase] || 0) + 1;
    const phaseWeek = phaseWeekCounter[phase];
    // Soft freshness: СѓРїСЂР°Р¶РЅРµРЅРёСЏ РїСЂРµРґС‹РґСѓС‰РµР№ РЅРµРґРµР»Рё вЂ” РІ С€С‚СЂР°С„РЅРѕРј СЃРїРёСЃРєРµ (РЅРµ С…Р°СЂРґ-Р±Р»РѕРє).
    const prevWeekNames = (() => {
      const out: string[] = [];
      for (const set of prevWeekUsedByMuscle.values()) out.push(...set);
      return out;
    })();
    // FB-СЂРѕС‚Р°С†РёСЏ: Р·Р°РїСЂРµС‰Р°РµРј РїРѕРІС‚РѕСЂ СѓРїСЂР°Р¶РЅРµРЅРёР№ РјРµР¶РґСѓ РґРЅСЏРјРё
    const fbUsedIds: string[] = [];
    const fbUsedNames: string[] = [];
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      // FB primary distribution РїРµСЂРµРЅРµСЃС‘РЅ Р’РќРЈРўР Р buildSession (РЅР°РґС‘Р¶РЅРµРµ).
      const isFB = s.sessionTag === 'FullBody';
      // fix Z: sessMuscles РїРѕ collapseKey (delt headsв†’shoulders) РґР»СЏ mrvByMuscle-lookup
      const sessMuscles = [...new Set(musclesForTag(s.sessionTag).map(m => collapseKey(m)))];
      // Р РѕС‚Р°С†РёСЏ: СЃРѕР±РёСЂР°РµРј ID СѓРїСЂР°Р¶РЅРµРЅРёР№, РёСЃРїРѕР»СЊР·РѕРІР°РЅРЅС‹С… СЂР°РЅРµРµ РґР»СЏ СЌС‚РёС… РјС‹С€С†.
      // rotationUsedByMuscle С…СЂР°РЅРёС‚ exerciseName (РёРјРµРЅР°) в†’ РєРѕРЅРІРµСЂС‚РёСЂСѓРµРј РІ IDs РґР»СЏ selectExercisesSmart.
      const rotationIds: string[] = [];
      const rotationNames: string[] = [];
      for (const m of sessMuscles) {
        const prevNames = rotationUsedByMuscle.get(m) || [];
        rotationNames.push(...prevNames);
        // РљРѕРЅРІРµСЂС‚РёСЂРѕРІР°С‚СЊ РёРјРµРЅР° РІ IDs С‡РµСЂРµР· РєР°С‚Р°Р»РѕРі
        for (const name of prevNames) {
          const cat = EXERCISE_CATALOG.find((e: any) => e.name === name);
          if (cat && cat.id) rotationIds.push(cat.id);
        }
      }
      // PRO: cross-mesocycle rotation вЂ” РґРѕР±Р°РІР»СЏРµРј СѓРїСЂР°Р¶РЅРµРЅРёСЏ РёР· РїСЂРµРґС‹РґСѓС‰РµРіРѕ РјРµР·Рѕ
      // РІ rotationNames (РјСЏРіРєРѕРµ РїРѕРЅРёР¶РµРЅРёРµ РїСЂРёРѕСЂРёС‚РµС‚Р°, РЅРµ РїРѕР»РЅС‹Р№ Р·Р°РїСЂРµС‚).
      if (mesoProgression) {
        for (const name of mesoProgression.previousExercises) {
          if (!rotationNames.includes(name)) rotationNames.push(name);
        }
      }
      // Р¤Р°Р·Р° 2.7: cooldown-РёСЃС‚РѕСЂРёСЏ РёР· РїСЂРѕС€Р»С‹С… РїР»Р°РЅРѕРІ/РґРЅРµРІРЅРёРєР° вЂ” С‚Рµ Р¶Рµ РјСЏРіРєРёРµ
      // РёРјРµРЅР° СЂРѕС‚Р°С†РёРё, С‡С‚Рѕ Рё cross-meso (РёР·Р±РµРіР°РµРј РїРѕРІС‚РѕСЂРѕРІ РІ cooldown-РѕРєРЅРµ).
      if (Array.isArray(input.cooldownHistory)) {
        for (const c of input.cooldownHistory) {
          const n = c?.exerciseName;
          if (n && !rotationNames.includes(n)) rotationNames.push(n);
        }
      }
      // Solo-РґРЅРё (1-2 РіСЂСѓРїРїС‹ РјС‹С€С†): СѓРІРµР»РёС‡РёРІР°РµРј Р±СЋРґР¶РµС‚ РЅР° 50% вЂ” РІСЃСЏ СЌРЅРµСЂРіРёСЏ РґРЅСЏ РёРґС‘С‚ РЅР° СЌС‚Рё РјС‹С€С†С‹
      // fix I: С„Р°Р·РѕРІР°СЏ РјРѕРґСѓР»СЏС†РёСЏ РѕР±СЉС‘РјР° вЂ” deload/peak СЂРµР°Р»СЊРЅРѕ СЃРЅРёР¶Р°СЋС‚ С‡РёСЃР»Рѕ СЃРµС‚РѕРІ (РЅРµ С‚РѕР»СЊРєРѕ RIR).
      // Р‘СЋРґР¶РµС‚ СЃРµСЃСЃРёРё РјР°СЃС€С‚Р°Р±РёСЂСѓРµС‚СЃСЏ РїРѕ volumeMultiplier С„Р°Р·С‹ (focus-aware), MRV-РїРѕС‚РѕР»РѕРє РЅРµ С‚СЂРѕРіР°РµРј.
      const phaseVol = getPhaseVolumeMult(phase, input.trainingFocus) ?? 1.0;
      const sessDailyCap = Math.round((sessMuscles.length <= 2 ? dailyCap * 1.5 : dailyCap) * phaseVol);
      const mrvRot = Math.max(12, ...sessMuscles.map(m => mrvByMuscle[m] || 0));
      // fix F: per-week РѕС†РµРЅРєР° С‚СЂР°РІРј РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ РґР°С‚С‹ РЅРµРґРµР»Рё (Р° РЅРµ С‚РѕР»СЊРєРѕ В«СЃРµРіРѕРґРЅСЏВ»).
      // РўСЂР°РІРјР° СЃ from > РґР°С‚С‹ РЅРµРґРµР»Рё РµС‰С‘ РЅРµР°РєС‚РёРІРЅР°; С‚СЂР°РІРјР° СЃ to < РґР°С‚С‹ РЅРµРґРµР»Рё СѓР¶Рµ Р·Р°Р¶РёР»Р°.
      const weekDate = input.planStartWeek ? addDaysISO(input.planStartWeek, (w - 1) * 7) : today;
      const weekExcluded = getExcludedMuscles(injuries, weekDate);
      const weekGraded = getGradedInjuries(injuries, weekDate);
       const weekInjuryProfile = [...new Set([...weekExcluded, ...weekGraded.map(inj => inj.muscle)])];
        const legDaysInWeek = sessions.filter(ss => /Legs|Lower/.test((ss as any).sessionTag || '')).length;
        const legDayIndex = legDaysInWeek === 1 ? (w % 2) : sessions.slice(0, i).filter(ss => /Legs|Lower/.test((ss as any).sessionTag || '')).length;
        const sess = buildSessionWithParams({ sched: s, dayInRotation: i + 1, legDayIndex, week: w, muscleVolumeRotation: scaledVolumeRotation, muscleSessionCount, musclePrimaryAssigned, workMax, weakPoints: weekSpec.weak, focusGroup: weekSpec.focus || undefined, pedAdapt, dailyCap: sessDailyCap, level, injuryProfile: weekInjuryProfile, injuredMuscles: new Set(weekInjuryProfile), excludedMuscles: weekExcluded, gradedInjuries: weekGraded, today: weekDate, phase, phaseWeek, mrvRot, preSelectedIds: isFB ? fbUsedIds : [], preSelectedNames: [...(isFB ? fbUsedNames : []), ...rotationNames], rotationBlockIds: rotationIds, favoriteIds: favIds, excludeIds: exclIds, avoidAxialLoad: avAxial, equipmentList: eqList, methodology: input.methodology, isFemale: input.sex === 'female', intensityTechnique: undefined, autoDeload: undefined, loadStrategy: undefined, autoRegResult: undefined, specialization: undefined, pedDoses: input.pedDoses, labMrvMultiplier: input.labMrvMultiplier, courseIntensity: input.courseIntensity, onCourse, sex: input.sex, weekLocalUsed, primaryBySlot, trainingFocus: input.trainingFocus, eccentricMult: input.eccentricMult, mobilityRestrictions: input.mobilityRestrictions, trainingYears: input.trainingYears, bodyweightCapability: input.bodyweightCapability, fewerCompound: input.fewerCompound, allowStrengthLifts: input.allowStrengthLifts, rotationMode: input.rotationMode, intensityLevel: input.intensityLevel, skipStrictCoverage: !!mesoProgression });
      sess.weekOffset = (w - 1) * pattern.rotationDays + (i + 1);
      // FB: СЃРѕР±РёСЂР°РµРј ID Рё РёРјРµРЅР° СѓРїСЂР°Р¶РЅРµРЅРёР№ РґР»СЏ Р·Р°РїСЂРµС‚Р° РїРѕРІС‚РѕСЂРѕРІ
      if (isFB) for (const ex of sess.exercises) {
        if (ex.exerciseName) { fbUsedIds.push(ex.exerciseName); fbUsedNames.push(ex.exerciseName); }
      }
      // Р РѕС‚Р°С†РёСЏ: Р·Р°РїРѕРјРёРЅР°РµРј С‚РѕР»СЊРєРѕ accessory-СѓРїСЂР°Р¶РЅРµРЅРёСЏ РґР»СЏ СЃР»РµРґСѓСЋС‰РёС… РЅРµРґРµР»СЊ.
      // Primary lifts are deliberately stable across the phase block; putting
      // them into the rotation blacklist made the main compound change weekly.
      // BUG-B19: РїСЂРё РЅР°РєРѕРїР»РµРЅРёРё РЅР° 12-РЅРµРґ РїР»Р°РЅРµ РїСѓР» СѓРїСЂР°Р¶РЅРµРЅРёР№ РёСЃС‡РµСЂРїС‹РІР°РµС‚СЃСЏ в†’ fallback РЅР°
      // РїРѕРІС‚РѕСЂ СѓРїСЂР°Р¶РЅРµРЅРёР№. РЎР±СЂР°СЃС‹РІР°РµРј РєР°Р¶РґС‹Рµ 4 РЅРµРґРµР»Рё (СЂРѕС‚Р°С†РёСЏ РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ), СЃРѕС…СЂР°РЅСЏСЏ СЃРІРµР¶РµСЃС‚СЊ.
      const rotationMode = input.rotationMode || 'variety';
      if (rotationMode === 'strict' && w > 1 && (w - 1) % 4 === 0) {
        // РћСЃС‚Р°РІР»СЏРµРј С‚РѕР»СЊРєРѕ РїРѕСЃР»РµРґРЅРёРµ 4 РЅРµРґРµР»Рё СѓРїСЂР°Р¶РЅРµРЅРёР№ (СЃРІРµР¶Р°СЏ РїР°РјСЏС‚СЊ)
        for (const [m, arr] of rotationUsedByMuscle) {
          if (arr.length > 8) rotationUsedByMuscle.set(m, arr.slice(-8));
        }
      }
      // В«Р—Р°РїСЂРµС‚В» (forbid): accessory-СѓРїСЂР°Р¶РЅРµРЅРёСЏ РќР• СЂРѕС‚РёСЂСѓСЋС‚СЃСЏ вЂ” СЃС‚СЂРѕРіРѕ С‚Рµ Р¶Рµ РєР°Р¶РґСѓСЋ РЅРµРґРµР»СЋ.
      if (rotationMode !== 'forbid') {
        for (const ex of sess.exercises) {
          if (ex.role === 'primary') continue;
          const m = collapseKey(ex.muscle);
          if (!rotationUsedByMuscle.has(m)) rotationUsedByMuscle.set(m, []);
          const arr = rotationUsedByMuscle.get(m)!;
          if (ex.exerciseName && !arr.includes(ex.exerciseName)) arr.push(ex.exerciseName);
        }
      }
      // fix L: С„РёРєСЃРёСЂСѓРµРј РїР°С‚С‚РµСЂРЅС‹ РѕСЃРЅРѕРІРЅС‹С… СѓРїСЂР°Р¶РЅРµРЅРёР№ РѕС‚СЃС‚Р°СЋС‰РёС… РіСЂСѓРїРї СЌС‚РѕР№ РЅРµРґРµР»Рё,
      // С‡С‚РѕР±С‹ С„РёРґРµСЂ-СЃРµС‚С‹ (fix J) Рё РґРѕР±РёРІРєРё РЅРµ РїРѕРІС‚РѕСЂСЏР»Рё С‚РѕС‚ Р¶Рµ РїР°С‚С‚РµСЂРЅ РґРІРёР¶РµРЅРёСЏ.
      for (const ex of sess.exercises) {
        const exm = collapseKey(ex.muscle);
        if (isWeak(exm, weakPoints) && !Array.from(weekExcluded).includes(exm)) {
          const cat = (EXERCISE_CATALOG as any[]).find((c: any) => c.name === ex.exerciseName);
          if (cat) {
            if (!weekWeakPatterns.has(exm)) weekWeakPatterns.set(exm, new Set());
            weekWeakPatterns.get(exm)!.add(derivePattern(cat));
          }
        }
      }
      // fix J: С„РёРґРµСЂ-СЃРµС‚С‹ РґР»СЏ РѕС‚СЃС‚Р°СЋС‰РёС… РіСЂСѓРїРї вЂ” РёР·РѕР»СЏС†РёСЏ РІС‹СЃРѕРєРёРј РїРѕРІС‚РѕСЂРµРЅРёРµРј (grease-the-groove
      // С„РёРЅРёС€РµСЂ) РІ РґРЅРё, РіРґРµ СЃР»Р°Р±Р°СЏ РіСЂСѓРїРїР° СѓР¶Рµ С‚СЂРµРЅРёСЂСѓРµС‚СЃСЏ. Р”РѕР±РёРІРѕС‡РЅРѕРµ РєСЂРѕРІРµРЅР°РїРѕР»РЅРµРЅРёРµ Р±РµР· СЂРѕСЃС‚Р° fatigue.
      const addedFeeders = new Set<string>();
      for (const wm of sessMuscles) {
        if (!isWeak(wm, weakPoints)) continue;
        if (Array.from(weekExcluded).includes(wm)) continue;
        if (addedFeeders.has(wm)) continue;
        // РўРѕС‡РЅРѕРµ СЃРѕРІРїР°РґРµРЅРёРµ РїРѕ СЃС‹СЂРѕРјСѓ muscle (РёР»Рё collapseKey) + РёР·РѕР»СЏС†РёСЏ: РёСЃРєР»СЋС‡Р°РµРј
        // В«С‡СѓР¶РёРµВ» С‚СЏРіРѕРІС‹Рµ РґРІРёР¶РµРЅРёСЏ, РѕС€РёР±РѕС‡РЅРѕ РїРѕРјРµС‡РµРЅРЅС‹Рµ РєР°Рє СЌС‚Р° РіСЂСѓРїРїР°.
        const feederPool = (EXERCISE_CATALOG as any[]).filter((e: any) => {
          const raw = e.group;
          const mg = collapseKey(trueMuscleOf(e) || raw);
          if (raw !== wm && mg !== wm) return false;
          if (e.exerciseType !== 'isolation' && e.type !== 'isolation') return false;
          if (isBBJunk(e)) return false;
          // Equipment filter (same as main pool)
          if (eqList.length > 0) {
            const rawEq = e.equipment;
            const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
            if (exEq.length > 0 && !exEq.some(eq => eqList.includes(eq))) return false;
          }
          if (avAxial && isAxialLoadExercise(e as any)) return false; // РѕСЃРµРІР°СЏ РёСЃРєР»СЋС‡РµРЅР°
          // Rear delt РќР• РІ Push/Chest-РґРЅСЏС… (С‚РѕР»СЊРєРѕ РІ Pull/Back)
          if (isPushDayTag(s.sessionTag || '') && isRearDeltExercise(e.name)) return false;
          return true;
        });
        if (!feederPool.length) continue;
        // fix L: РїР°С‚С‚РµСЂРЅС‹, СѓР¶Рµ РёСЃРїРѕР»СЊР·РѕРІР°РЅРЅС‹Рµ РґР»СЏ СЌС‚РѕР№ РѕС‚СЃС‚Р°СЋС‰РµР№ РіСЂСѓРїРїС‹ РЅР° С‚РµРєСѓС‰РµР№ РЅРµРґРµР»Рµ.
        if (!weekWeakPatterns.has(wm)) weekWeakPatterns.set(wm, new Set());
        const usedPatterns = weekWeakPatterns.get(wm)!;
        // Р Р°РЅР¶РёСЂСѓРµРј: РїСЂРёРѕСЂРёС‚РµС‚ вЂ” РёР·РѕР»СЏС†РёРё РёРјРµРЅРЅРѕ СЌС‚РѕР№ РіСЂСѓРїРїС‹ (РїР»РµС‡Рѕ/РіСЂСѓРґСЊ/СЃРїРёРЅР°...),
        // С€С‚СЂР°С„ вЂ” В«С‡СѓР¶РёРµВ» С‚СЏРіРѕРІС‹Рµ РґРІРёР¶РµРЅРёСЏ, РѕС€РёР±РѕС‡РЅРѕ РїРѕРјРµС‡РµРЅРЅС‹Рµ РєР°Рє СЌС‚Р° РіСЂСѓРїРїР°,
        // Рё вЂ” РєСЂРёС‚РёС‡РЅРѕ вЂ” РїРѕРІС‚РѕСЂ СѓР¶Рµ Р·Р°РґРµР№СЃС‚РІРѕРІР°РЅРЅРѕРіРѕ РїР°С‚С‚РµСЂРЅР° РІРЅСѓС‚СЂРё РЅРµРґРµР»Рё (fix L).
        const scoreFeeder = (e: any): number => {
          const nm = (e.name || '').toLowerCase();
          let s = 0;
          if (/(РїР»РµС‡|РґРµР»СЊС‚|Р»Р°С‚РµСЂР°Р»|РѕС‚РІРѕРґ|РјР°С…|СЂР°Р·РІРѕРґ|fly|raise|lateral|rear|face ?pull|РїРµСЂРµРґРЅСЏСЏ|Р·Р°РґРЅСЏСЏ)/.test(nm)) s += 3;
          if (/(С‚СЏРіР°|pull|row|РЅР°РєР»РѕРЅ|РїСЂРёСЃРµРґ|Р¶РёРј|СЃС‚Р°РЅРѕРІ|РѕС‚Р¶РёРј)/.test(nm)) s -= 3;
          if (e.exerciseType === 'isolation' || e.type === 'isolation') s += 1;
          if (usedPatterns.has(derivePattern(e))) s -= 100;
          return s;
        };
        feederPool.sort((a, b) => scoreFeeder(b) - scoreFeeder(a));
        const fData: any = feederPool[0];
        if (!fData) continue;
        const fName = fData.name || fData.id;
        // Р”РµРґСѓРї: РЅРµ РґРѕР±Р°РІР»СЏС‚СЊ, РµСЃР»Рё С‚Р°РєРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ СѓР¶Рµ РµСЃС‚СЊ РІ РґРЅРµ (РѕСЃРЅРѕРІРЅРѕРµ РёР»Рё С„РёРґРµСЂ)
        if (sess.exercises.some(e => e.exerciseName === fName) || addedFeeders.has(fName)) continue;
        // РќРµ РґРѕР±Р°РІР»СЏРµРј РІС‚РѕСЂРѕР№ РёР·РѕР»РёСЂСѓСЋС‰РёР№ РїР°С‚С‚РµСЂРЅ С‚РѕР№ Р¶Рµ РјС‹С€С†С‹ РІ РѕРґРёРЅ РґРµРЅСЊ (3 РїСѓР»РѕРІРµСЂР°/3 СЂР°Р·РіРёР±Р°РЅРёСЏ)
        const fPat = derivePattern(fData);
        if (sess.exercises.some(e => collapseKey(e.muscle) === wm && derivePattern({ name: e.exerciseName || e.name, group: e.muscle, type: (e as any).exerciseType } as any) === fPat)) continue;
        const fBase = (workMax as any)[wm] || DEFAULT_WORKMAX[wm] || 50;
        const feederWeight = Math.max(5, Math.round(fBase * 0.3 * 10) / 10);
        const fTempo = tempoFor('РїР°РјРї', undefined, phase);
        // Realistic weak-feeder: 2Г—15-20 (Р° РЅРµ 1Г—18) вЂ” РґР°С‘С‚ Р·РЅР°С‡РёРјС‹Р№ РѕР±СЉС‘Рј РґР»СЏ РґРѕСЃС‚РёР¶РµРЅРёСЏ MEV.
        const feederSetCount = 2;
        sess.exercises.push({
          muscle: wm, name: fName, role: 'accessory' as const, character: 'РїР°РјРї' as DayCharacter,
          sets: feederSetCount, repsRange: [15, 20] as [number, number], rir: 3,
          workSets: Array.from({ length: feederSetCount }, () => ({ reps: 18, rir: 3, weight: feederWeight, tempo: fTempo.notation, restSeconds: 30 })),
          exerciseName: fName, tempoSpec: fTempo.notation, restSeconds: 30,
          comment: `Р¤РёРґРµСЂ-СЃРµС‚ (grease-the-groove) РґР»СЏ РѕС‚СЃС‚Р°СЋС‰РµР№ РіСЂСѓРїРїС‹ ${wm}: 2Г—15-20 RIR 3 @${feederWeight}РєРі, ~30% СЂР°Р±РѕС‡РµРіРѕ РІРµСЃР°, РїР°РјРїРёРЅРі.`,
          warmupSets: [], rationale: 'РђРєС†РµРЅС‚ РЅР° РѕС‚СЃС‚Р°СЋС‰СѓСЋ РіСЂСѓРїРїСѓ: РґРѕР±РёРІРѕС‡РЅС‹Р№ РєСЂРѕРІРµРЅР°РїРѕР»РЅРёС‚РµР»СЊРЅС‹Р№ СЃРµС‚ РІ РєРѕРЅС†Рµ РґРЅСЏ.',
        });
        addedFeeders.add(wm);
        addedFeeders.add(fName);
        usedPatterns.add(derivePattern(fData));
      }
      // fix K: РїР°РјРї-С„РёРЅРёС€РµСЂ РґР»СЏ РїРµСЂРІРёС‡РЅС‹С… РіСЂСѓРїРї, Сѓ РєРѕС‚РѕСЂС‹С… РґРµРЅСЊ вЂ” С‚РѕР»РєРѕ В«С‚СЏР¶В» (Р±РµР· РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєРѕРіРѕ СЃС‚СЂРµСЃСЃР°).
      // P1-1 (audit 2026-07): СѓР±СЂР°РЅ weak-gate вЂ” pump-finisher РґРѕР±Р°РІР»СЏРµС‚СЃСЏ РґР»СЏ Р’РЎР•РҐ primary muscles,
      // РЅРµ С‚РѕР»СЊРєРѕ РЅРµ-weak. Bro-split (1 РіСЂСѓРїРїР°/РґРµРЅСЊ) РёРЅР°С‡Рµ = С‚РѕР»СЊРєРѕ С‚СЏР¶С‘Р»С‹Рµ СЃРµС‚С‹ РґР»СЏ lead-muscle.
      // Schoenfeld 2018: metabolic stress work after heavy compounds +5-10% hypertrophy.
      // в… Primary-dominance fix: pump-finisher С‚РѕР»СЊРєРѕ РґР»СЏ lead-РјС‹С€С†С‹ + weakPoints.
      // Р Р°РЅСЊС€Рµ РґРѕР±Р°РІР»СЏР»СЃСЏ РґР»СЏ Р’РЎР•РҐ sessMuscles (biceps/traps РІ Pull) в†’ accessory РїРѕР»СѓС‡Р°Р»Рё
      // 2-Рµ СѓРїСЂР°Р¶РЅРµРЅРёРµ (pump) в†’ biceps=2ex РїСЂРё back=4ex, Рё СЃРµС‚С‹ accessories > primary.
      for (const pm of sessMuscles) {
        if (Array.from(weekExcluded).includes(pm)) continue;
        if (pm !== sessMuscles[0] && !isWeak(pm, weakPoints)) continue;
        if (sess.exercises.some(e => (e.muscle === pm || collapseKey(e.muscle) === pm) && (e as any).character === 'РїР°РјРї')) continue;
        const pumpPool = (EXERCISE_CATALOG as any[]).filter((e: any) => {
          const raw = e.group;
          const mg = collapseKey(trueMuscleOf(e) || raw);
          if (raw !== pm && mg !== pm) return false;
          if (e.exerciseType !== 'isolation' && e.type !== 'isolation') return false;
          if (isBBJunk(e)) return false;
          if (eqList.length > 0) {
            const rawEq = e.equipment;
            const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
            if (exEq.length > 0 && !exEq.some(eq => eqList.includes(eq))) return false;
          }
          if (avAxial && isAxialLoadExercise(e as any)) return false;
          // Rear delt РќР• РІ Push/Chest-РґРЅСЏС… (С‚РѕР»СЊРєРѕ РІ Pull/Back)
          if (isPushDayTag(s.sessionTag || '') && isRearDeltExercise(e.name)) return false;
          return true;
        });
        if (!pumpPool.length) continue;
        pumpPool.sort((a: any, b: any) => {
          const na = (a.name || '').toLowerCase(), nb = (b.name || '').toLowerCase();
          let sa = 0, sb = 0;
          if (/(РїР»РµС‡|РґРµР»СЊС‚|Р»Р°С‚РµСЂР°Р»|РѕС‚РІРѕРґ|РјР°С…|СЂР°Р·РІРѕРґ|fly|raise|lateral|rear|face ?pull|РїРµСЂРµРґРЅСЏСЏ|Р·Р°РґРЅСЏСЏ)/.test(na)) sa += 3;
          if (/(С‚СЏРіР°|pull|row|РЅР°РєР»РѕРЅ|РїСЂРёСЃРµРґ|Р¶РёРј|СЃС‚Р°РЅРѕРІ|РѕС‚Р¶РёРј)/.test(na)) sa -= 3;
          if (/(РїР»РµС‡|РґРµР»СЊС‚|Р»Р°С‚РµСЂР°Р»|РѕС‚РІРѕРґ|РјР°С…|СЂР°Р·РІРѕРґ|fly|raise|lateral|rear|face ?pull|РїРµСЂРµРґРЅСЏСЏ|Р·Р°РґРЅСЏСЏ)/.test(nb)) sb += 3;
          if (/(С‚СЏРіР°|pull|row|РЅР°РєР»РѕРЅ|РїСЂРёСЃРµРґ|Р¶РёРј|СЃС‚Р°РЅРѕРІ|РѕС‚Р¶РёРј)/.test(nb)) sb -= 3;
          return sb - sa;
        });
        const pData: any = pumpPool[0];
        if (!pData) continue;
        const pName = pData.name || pData.id;
        if (sess.exercises.some(e => e.exerciseName === pName) || addedFeeders.has(pName)) continue;
        const pPat = derivePattern(pData);
        if (sess.exercises.some(e => collapseKey(e.muscle) === pm && derivePattern({ name: e.exerciseName || e.name, group: e.muscle, type: (e as any).exerciseType } as any) === pPat)) continue;
        const pBase = (workMax as any)[pm] || DEFAULT_WORKMAX[pm] || 50;
        const pumpWeight = Math.max(5, Math.round(pBase * 0.3 * 10) / 10);
        const pTempo = tempoFor('РїР°РјРї', undefined, phase);
        // B3/B11: СЂРµР°Р»РёСЃС‚РёС‡РЅС‹Р№ pump-finisher СЃ MRV-РєР°РїРѕРј. РЎС‡РёС‚Р°РµРј С‚РµРєСѓС‰РёРµ СЃРµС‚С‹ РјС‹С€С†С‹ pm,
        // Рё СѓРјРµРЅСЊС€Р°РµРј pumpSetCount, РµСЃР»Рё РґРѕР±Р°РІР»РµРЅРёРµ 2Г—15-20 РїСЂРµРІС‹СЃРёС‚ РЅРµРґРµР»СЊРЅС‹Р№ MRV.
        const mrvCap = mrvByMuscle[pm] || 0;
        let currentForPm = 0;
        for (const ex of sess.exercises) {
          if (collapseKey(ex.muscle) === pm) currentForPm += ex.workSets?.length || ex.sets || 0;
        }
        const maxPumpSets = Math.max(0, mrvCap - currentForPm);
        const pumpSetCount = Math.min(2, maxPumpSets);
        if (pumpSetCount === 0) continue;
        sess.exercises.push({
          muscle: pm, name: pName, role: 'accessory' as const, character: 'РїР°РјРї' as DayCharacter,
          sets: pumpSetCount, repsRange: [15, 20] as [number, number], rir: 3,
          workSets: Array.from({ length: pumpSetCount }, () => ({ reps: 18, rir: 3, weight: pumpWeight, tempo: pTempo.notation, restSeconds: 30 })),
          exerciseName: pName, tempoSpec: pTempo.notation, restSeconds: 30,
          comment: `РџР°РјРї-С„РёРЅРёС€РµСЂ РґР»СЏ ${pm}: ${pumpSetCount}Г—15-20 RIR 3 @${pumpWeight}РєРі, ~30% СЂР°Р±РѕС‡РµРіРѕ РІРµСЃР°, РјРµС‚Р°Р±РѕР»РёС‡РµСЃРєРёР№ СЃС‚СЂРµСЃСЃ РІ РєРѕРЅС†Рµ С‚СЏР¶С‘Р»РѕРіРѕ РґРЅСЏ.`,
          warmupSets: [], rationale: 'Р‘Р°Р»Р°РЅСЃ С‚СЏР¶/РїР°РјРї: РґРѕР±РёРІРѕС‡РЅС‹Р№ high-rep СЃРµС‚ РґР»СЏ РіРёРїРµСЂС‚СЂРѕС„РёРё.',
        });
        addedFeeders.add(pm);
        addedFeeders.add(pName);
      }
      // Re-sort after feeders/pump-finishers to restore muscle grouping
      const reordered = orderSessionExercises(sess.exercises, {
        sessionTag: s.sessionTag,
        methodology: input.methodology as any,
        priorityMuscles: [...weakPoints, ...(focusGroup ? [focusGroup] : [])],
      });
      sess.exercises.length = 0; sess.exercises.push(...reordered);
      weekSessions.push(sess);
    }
    // fix D: РєР°РїР°РµРј РЅРµРґРµР»СЊРЅС‹Р№ РѕР±СЉС‘Рј РєР°Р¶РґРѕР№ РјС‹С€С†С‹ РїРѕ РµС‘ РёСЃС‚РёРЅРЅРѕРјСѓ MRV вЂ” РµРґРёРЅС‹Р№ perExerciseCap
    normalizeWeekMrv(weekSessions, mrvByMuscle, phase === 'deload', { level: input.level, trainingYears: input.trainingYears });
    weeks.push({ week: w, phase, deload: phase === 'deload', sessions: weekSessions });
    // Р—Р°РїРѕРјРёРЅР°РµРј СѓРїСЂР°Р¶РЅРµРЅРёСЏ СЌС‚РѕР№ РЅРµРґРµР»Рё РґР»СЏ РјСЏРіРєРѕРіРѕ freshness Р±Р»РѕРєРёСЂРѕРІРєРё СЃР»РµРґСѓСЋС‰РµР№.
    // Р’ СЂРµР¶РёРјРµ В«Р·Р°РїСЂРµС‚В» (forbid) freshness РѕС‚РєР»СЋС‡С‘РЅ вЂ” СЃС‚СЂРѕРіРѕ С‚Рµ Р¶Рµ СѓРїСЂР°Р¶РЅРµРЅРёСЏ.
    prevWeekUsedByMuscle.clear();
    if (input.rotationMode !== 'forbid') {
      for (const sess of weekSessions) {
        for (const ex of sess.exercises) {
          const m = collapseKey(ex.muscle);
          if (!prevWeekUsedByMuscle.has(m)) prevWeekUsedByMuscle.set(m, new Set());
          prevWeekUsedByMuscle.get(m)!.add(ex.exerciseName || ex.name || '');
        }
      }
    }
  }

  // FIX-2: РџСЂРѕРіСЂРµСЃСЃРёСЏ РІРµСЃРѕРІ (double_progression) вЂ” СЂРµР°Р»СЊРЅС‹Р№ РїСЂРѕРіСЂРµСЃСЃ РѕС‚ РЅРµРґРµР»Рё Рє РЅРµРґРµР»Рµ.
  // Р”Рѕ fix РІРµСЃР° РјРµРЅСЏР»РёСЃСЊ РўРћР›Р¬РљРћ РѕС‚ СЃР¶Р°С‚РёСЏ RIR (3в†’0 = +14% Р·Р° 8 РЅРµРґ), Р±РµР· РёСЃС‚РёРЅРЅРѕР№ РїРµСЂРµРіСЂСѓР·РєРё.
  // РўРµРїРµСЂСЊ РєР°Р¶РґР°СЏ СЃР»РµРґСѓСЋС‰Р°СЏ РЅРµРґРµР»СЏ Р±РµСЂС‘С‚ РІРµСЃ РїСЂРµРґС‹РґСѓС‰РµР№ Рё РїСЂРёРјРµРЅСЏРµС‚ prescribeLoad.
  // FIX-A5: prescribeLoad РІРѕР·РІСЂР°С‰Р°РµС‚ nextWeight + nextReps + nextRIR, РЅРѕ СЃС‚Р°СЂС‹Р№ РєРѕРґ
  // РїСЂРёРјРµРЅСЏР» РўРћР›Р¬РљРћ nextWeight. Р”Р»СЏ double_progression РїСЂРё currentReps < repCap
  // nextWeight = currentWeight (Р±РµР· РёР·РјРµРЅРµРЅРёСЏ!) в†’ РІРµСЃ РЅРµ СЂРѕСЃ РЅРµРґРµР»СЏРјРё.
  // РўРµРїРµСЂСЊ: РїСЂРёРјРµРЅСЏРµРј nextReps (РїСЂРѕРіСЂРµСЃСЃРёСЏ РїРѕРІС‚РѕСЂРѕРІ) Рё nextRIR (РґСЂРёС„С‚ RIR) С‚РѕР¶Рµ.
  for (let wi = 1; wi < weeks.length; wi++) {
    const prevWeek = weeks[wi - 1];
    const curWeek = weeks[wi];
    const curPhase = phaseByWeek.get(curWeek.week) || 'accumulation';
    // РџСЂРѕРїСѓСЃРєР°РµРј РґРµР»РѕРґ-РЅРµРґРµР»СЋ: РІРµСЃ РЅРµ СЂР°СЃС‚С‘С‚, РѕР±СЉС‘Рј СѓР¶Рµ СЃСЂРµР·Р°РЅ normalizeWeekMrv.
    if (curPhase === 'deload') continue;
    // C1: Р•СЃР»Рё РїСЂРµРґС‹РґСѓС‰Р°СЏ РЅРµРґРµР»СЏ Р±С‹Р»Р° deload вЂ” РёС‰РµРј РћР¦Р•РџРљРЈ РЅР°Р·Р°Рґ РґРѕ РїРµСЂРІРѕР№
    // non-deload РЅРµРґРµР»Рё (Р° РЅРµ РїСЂРѕСЃС‚Рѕ wi-2, РєРѕС‚РѕСЂР°СЏ С‚РѕР¶Рµ РјРѕР¶РµС‚ Р±С‹С‚СЊ deload).
    // Р Р°РЅРµРµ: РґРІРѕР№РЅРѕР№ deload (W2+W3) в†’ W4 Р±СЂР°Р»Р° Р±Р°Р·Сѓ РёР· W3 (deload) в†’ Р·Р°РЅРёР¶РµРЅРЅС‹Р№ СЃС‚Р°СЂС‚.
    let useWeek: typeof prevWeek | null = null;
    for (let back = wi - 1; back >= 0; back--) {
      const bk = weeks[back];
      const bkPhase = phaseByWeek.get(bk.week) || 'accumulation';
      if (bkPhase !== 'deload') { useWeek = bk; break; }
    }
    if (!useWeek) continue;
    for (const curSess of curWeek.sessions) {
      for (const curEx of curSess.exercises) {
        // B5: exact name match + fuzzy fallback РґР»СЏ rotated/substituted exercises.
        // Р Р°РЅРµРµ: pe.name === curEx.name в†’ СЃР±РѕР№ РїСЂРё СЂРѕС‚Р°С†РёРё (Р¶РёРј Р»С‘Р¶Р° в†” Р¶РёРј С€С‚Р°РЅРіРё Р»С‘Р¶Р°).
        const prevExercises = useWeek.sessions.flatMap(s => s.exercises);
        let prevEx = prevExercises.find(pe => pe.name === curEx.name && pe.muscle === curEx.muscle);
        if (!prevEx) {
          // Fuzzy: С‚Р° Р¶Рµ РјС‹С€С†Р° + РЅРѕСЂРјР°Р»РёР·РѕРІР°РЅРЅС‹Р№ token overlap в‰Ґ 2 OR substring
          const curNorm = (curEx.name || '').toLowerCase().replace(/С‘/g, 'Рµ').trim();
          const curTokens = curNorm.split(/\s+/).filter(t => t.length > 2);
          prevEx = prevExercises.find(pe => {
            if (pe.muscle !== curEx.muscle) return false;
            const peNorm = (pe.name || '').toLowerCase().replace(/С‘/g, 'Рµ').trim();
            if (curNorm === peNorm) return true;
            const overlap = curTokens.filter(t => peNorm.includes(t)).length;
            return overlap >= 2 || (curTokens.length >= 2 && overlap >= 1 && peNorm.includes(curNorm));
          });
        }
        if (!prevEx) continue;
        const maxW = workMax[curEx.muscle] || defaultWorkMax(curEx.muscle);
        const prevWs = prevEx.workSets[0];
        if (!prevWs) continue;
        const prescr = prescribeLoad(
          'double_progression',
          prevWs.weight, prevWs.reps, prevEx.rir,
          maxW, curWeek.week, input.weeks, curPhase,
          curEx.exerciseType || (curEx as any).type || 'compound',
          curEx.role,
        );
        // РџСЂРёРјРµРЅСЏРµРј weight + reps (progression). RIR РќР• С‚СЂРѕРіР°РµРј вЂ” РѕРЅ СѓРїСЂР°РІР»СЏРµС‚СЃСЏ
        // bbRir (phase-based periodization). prescribeLoad РІРѕР·РІСЂР°С‰Р°РµС‚ nextRIR,
        // РЅРѕ РѕРЅ РїСЂРµРґРЅР°Р·РЅР°С‡РµРЅ РґР»СЏ feedback-loop (plannedRir), Р° РЅРµ РґР»СЏ base progression.
        for (const ws of curEx.workSets) {
          ws.weight = Math.round(prescr.nextWeight * 10) / 10;
          ws.reps = prescr.nextReps;
        }
        // РћР±РЅРѕРІР»СЏРµРј repsRange РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ Р°РєС‚СѓР°Р»СЊРЅРѕРіРѕ РґРёР°РїР°Р·РѕРЅР°.
        if (curEx.repsRange && curEx.repsRange.length === 2) {
          curEx.repsRange = [prescr.nextReps, prescr.nextReps + 2];
        }
      }
    }
  }

  const rationale: string[] = [
    `РЎРїР»РёС‚ В«${pattern.name}В» (${pattern.rotationDays}РґРЅ СЂРѕС‚Р°С†РёСЏ, ${pattern.sessionsPerRotation} СЃРµСЃСЃРёР№)`,
    `РЈСЂРѕРІРµРЅСЊ ${level}, С†РµР»СЊ ${input.goal}, ${input.weeks} РЅРµРґ`,
    `РћР±СЉС‘Рј ${input.volumeGoal || 'MAV'}: ` + Object.entries(muscleVolumeRotation).map(([m, v]) => `${m}=${v}`).join(', '),
    ...(specSchedule.active ? [`РЎРїРµС†РёР°Р»РёР·Р°С†РёСЏ (Р±Р»РѕРєРё): ${specializationScheduleText(specSchedule)}`] : [`РЎРїРµС†РёР°Р»РёР·Р°С†РёСЏ: РЅРµС‚`]),
    `Р¤Р°Р·РѕРІР°СЏ РїРµСЂРёРѕРґРёР·Р°С†РёСЏ (distributePhases): РЅР°РєРѕРїР»РµРЅРёРµ в†’ РёРЅС‚РµРЅСЃРёС„РёРєР°С†РёСЏ${deloadFreq > 0 ? ' в†’ СЂР°Р·РіСЂСѓР·РєР° (deload)' : ''} (RIR РїРѕ С„Р°Р·Рµ + РІРѕР»РЅР°); РІРµСЃ = workMaxГ—%1RM(RIR)`,
    `РџСЂРѕРіСЂРµСЃСЃРёСЏ РІРµСЃРѕРІ: double_progression (prescribeLoad) вЂ” РµР¶РµРЅРµРґРµР»СЊРЅС‹Р№ СЂРѕСЃС‚ РѕС‚ РЅРµРґРµР»Рё Рє РЅРµРґРµР»Рµ СЃ СѓС‡С‘С‚РѕРј С„Р°Р·С‹.`,
    `Р РѕС‚Р°С†РёСЏ СѓРїСЂР°Р¶РЅРµРЅРёР№: РЅР°РєР°РїР»РёРІР°РµС‚ РёСЃРїРѕР»СЊР·РѕРІР°РЅРЅС‹Рµ РІРµСЃСЊ РїР»Р°РЅ вЂ” РЅРµРґРµР»Рё РїРѕР»СѓС‡Р°СЋС‚ Р РђР—РќР«Р• СѓРїСЂР°Р¶РЅРµРЅРёСЏ (РїРѕРєР° РїСѓР» РЅРµ РёСЃС‡РµСЂРїР°РЅ, Р·Р°С‚РµРј fallback).`,
    `S-MRV: Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ РєР°Рї РѕР±СЉС‘РјР° РЅР° РѕСЃРЅРѕРІРµ Р±СЋРґР¶РµС‚Р° СѓС‚РѕРјР»РµРЅРёСЏ СЃРµСЃСЃРёРё + РїРѕС‚РѕР»РѕРє РїРѕ MRV РјС‹С€С†С‹.`,
    ...(pedAdapt ? [`PED-Р°РґР°РїС‚Р°С†РёСЏ: MRVГ—${pedAdapt.combinedMrvMultiplier.toFixed(2)}, РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµГ—${pedAdapt.combinedRecoveryMultiplier.toFixed(2)}${pedAdapt.activePEDs.length > 0 ? ' (' + pedAdapt.perPED.map(p => `${p.ped}${p.dose > 0 ? ' ' + p.dose : ''}`).join(' + ') + (pedAdapt.courseIntensity !== 'moderate' ? ', ' + pedAdapt.courseIntensity : '') + ')' : ''}`] : []),
    ...(injuries.length > 0 ? [`РўСЂР°РІРјС‹ (per-week РїРѕ РґР°С‚Рµ РїР»Р°РЅР°${input.planStartWeek ? ` СЃРѕ СЃС‚Р°СЂС‚Р° ${input.planStartWeek}` : ''}): РёСЃРєР»СЋС‡РµРЅС‹ ${[...new Set(injuries.filter(i => i.exclude !== false).map(i => i.muscle))].join(', ') || 'вЂ”'}; РіСЂР°РґР°С†РёСЏ ${[...new Set(injuries.filter(i => i.exclude === false).map(i => i.muscle))].join(', ') || 'вЂ”'} вЂ” СѓРїСЂР°Р¶РЅРµРЅРёСЏ Р·Р°РјРµРЅСЏСЋС‚СЃСЏ РЅР° Р±РµР·РѕРїР°СЃРЅС‹Рµ Р°Р»СЊС‚РµСЂРЅР°С‚РёРІС‹ СЃ РїРѕРЅРёР¶РµРЅРЅС‹Рј РІРµСЃРѕРј/РѕР±СЉС‘РјРѕРј.`] : []),
    // P0-7: ACWR cautions
    ...(acwrCaution ? [`вљ  ACWR=${acwrRatio.toFixed(2)} вЂ” Р·РѕРЅР° РѕСЃС‚РѕСЂРѕР¶РЅРѕСЃС‚Рё (1.3-1.5). Р Р°СЃСЃРјРѕС‚СЂРёС‚Рµ СЃРЅРёР¶РµРЅРёРµ РѕР±СЉС‘РјР° РёР»Рё СЂР°Р·РіСЂСѓР·РѕС‡РЅСѓСЋ РЅРµРґРµР»СЋ.`] : []),
    ...(acwrDanger ? [`рџљЁ ACWR=${acwrRatio.toFixed(2)} вЂ” РѕРїР°СЃРЅР°СЏ Р·РѕРЅР° (>1.5). РџСЂРёРЅСѓРґРёС‚РµР»СЊРЅР°СЏ СЂР°Р·РіСЂСѓР·РєР° РєР°Р¶РґС‹Рµ 3 РЅРµРґ.`] : []),
    // P1-2: bro_5 warning
    ...(pattern.id === 'bro_5' ? [`вљ  Bro Split 5Г—/РЅРµРґ вЂ” РЅРёР·РєР°СЏ С‡Р°СЃС‚РѕС‚Р° 1Г—/РЅРµРґ РЅР° РіСЂСѓРїРїСѓ; в‰Ґ2Г—/РЅРµРґ СЂРµР·СѓР»СЊС‚Р°С‚РёРІРЅРµРµ РґР»СЏ РЅР°С‚СѓСЂР°Р»РѕРІ (Schoenfeld 2018 РјРµС‚Р°-Р°РЅР°Р»РёР·).`] : []),
  ];

  const basePlan: BBPlan = { pattern, weeks, rotationMuscleVolume: muscleVolumeRotation, rationale, volumeTargets };
  // Р‘Р°Р»Р°РЅСЃ РјС‹С€С† вЂ” РїСЂРѕС„-РѕС‚С‡С‘С‚ + Р°РІС‚РѕРїСЂР°РІРєР° (РЅРµ С‚РѕР»СЊРєРѕ rationale, РЅРѕ Рё РѕР±СЉС‘Рј)
  try {
    const weeklyAgg = aggregateBBVolume(weeks[0]?.sessions || []);
    const effMap: Record<string, { effectiveSets: number }> = {};
    for (const [k, v] of Object.entries(weeklyAgg)) effMap[k] = { effectiveSets: (v as any).effectiveSets };
    const bal = computeMuscleBalance(effMap);
    if (bal.issues.length) {
      rationale.push(...bal.issues.map(s => `вљ–пёЏ Р‘Р°Р»Р°РЅСЃ: ${s} (ratio ${Object.entries(bal.ratios).map(([kk, vv]) => `${kk}=${vv}`).join(', ')})`));
      // РђРІС‚РѕРїСЂР°РІРєР°: chest/back >1.3 в†’ +2 СЃРµС‚Р° СЃРїРёРЅРµ, quad/ham в†’ +2 РѕС‚СЃС‚Р°СЋС‰РµР№
      if (bal.ratios['chest/back'] > 1.3 && mrvByMuscle['back']) mrvByMuscle['back'] = Math.round(mrvByMuscle['back'] * 1.15);
      if (bal.ratios['chest/back'] < 0.7 && mrvByMuscle['chest']) mrvByMuscle['chest'] = Math.round(mrvByMuscle['chest'] * 1.15);
      if (bal.ratios['quad/ham'] > 1.5 && mrvByMuscle['hamstrings']) mrvByMuscle['hamstrings'] = Math.round(mrvByMuscle['hamstrings'] * 1.2);
      if (bal.ratios['quad/ham'] < 0.66 && mrvByMuscle['quads']) mrvByMuscle['quads'] = Math.round(mrvByMuscle['quads'] * 1.2);
    }
  } catch {}
  if (pedAdapt) {
    basePlan.pedAdaptation = {
      combinedMrvMultiplier: pedAdapt.combinedMrvMultiplier,
      combinedRecoveryMultiplier: pedAdapt.combinedRecoveryMultiplier,
      activePEDs: pedAdapt.activePEDs,
      pedDoses: pedAdapt.pedDoses,
      risks: pedAdapt.risks,
    };
  }
  let finalPlan = basePlan;
  // РџСЂРёРјРµРЅСЏРµРј РїРѕСЃС‚-РѕР±СЂР°Р±РѕС‚РєСѓ (С‚РµС…РЅРёРєРё/С„РёРґРµСЂС‹/Р°РІС‚Рѕ-РґРµР»РѕРґ/Р·Р°РіСЂСѓР·РєР°/Р°РІС‚РѕСЂРµРі) РІРЅСѓС‚СЂРё buildBBPlan,
  // С‡С‚РѕР±С‹ РѕР±Р° РІС‹Р·С‹РІР°СЋС‰РёС… РїСѓС‚Рё (BbAutoConstructor Рё TrainingConstructor) РїРѕР»СѓС‡Р°Р»Рё СЂРµР·СѓР»СЊС‚Р°С‚.
  // РЈСЃР»РѕРІРёРµ РїРѕРєСЂС‹РІР°РµС‚ Р’РЎР• РїСЂРёР·РЅР°РєРё, Р° РЅРµ С‚РѕР»СЊРєРѕ technique/weakPoints вЂ” РёРЅР°С‡Рµ loadStrategy
  // Рё autoDeload С‚РµСЂСЏСЋС‚СЃСЏ (Р±Р°Рі: dfa8842fb СѓР±СЂР°Р» РґСѓР±Р»СЊ-РІС‹Р·РѕРІ РёР· BbAutoConstructor, РЅРѕ РЅРµ СЂР°СЃС€РёСЂРёР» guard).
  if ((input.intensityTechnique && input.intensityTechnique !== 'none') || weakPoints.length > 0 || input.loadStrategy || input.autoDeload || input.autoRegResult) {
    finalPlan = applyPostPhaseProcessing({
      plan: basePlan,
      totalWeeks: input.weeks,
      workMax,
      loadStrategy: input.loadStrategy,
      autoDeload: input.autoDeload,
      deloadType: input.deloadType,
      acwrRatio,
      autoRegResult: input.autoRegResult,
      skipPhaseRedistribution: true,
      intensityTechnique: input.intensityTechnique && input.intensityTechnique !== 'none' ? input.intensityTechnique : undefined,
      weakPoints: weakPoints.length > 0 ? weakPoints : undefined,
      level,
    });
  }
  const pedMrvMult = (pedAdapt?.combinedMrvMultiplier ?? 1);
  // P0-5 (audit 2026-07): Р»Р°Р±РѕСЂР°С‚РѕСЂРЅР°СЏ РєРѕСЂСЂРµРєС†РёСЏ MRV.
  // labMrvMultiplier (0.7-1.0) РѕС‚ labTrainingAdjust(linked.labAnalysis).mrvMultiplier:
  // ALTв†‘/CRPв†‘/HCTв†‘/РїРѕС‡РµС‡РЅС‹Р№ СЃС‚СЂРµСЃСЃ/РЅРёР·РєРёР№ С‚РµСЃС‚РѕСЃС‚РµСЂРѕРЅ в†’ СЃРЅРёР¶РµРЅРёРµ РґРѕРїСѓСЃС‚РёРјРѕРіРѕ РѕР±СЉС‘РјР°.
  // РџСЂРёРјРµРЅСЏРµС‚СЃСЏ РџРћРЎР›Р• PED-РјРЅРѕР¶РёС‚РµР»СЏ (PED РїРѕРІС‹С€Р°РµС‚ MRV, Р»Р°Р±РѕСЂР°С‚РѕСЂРёСЏ СЃРЅРёР¶Р°РµС‚ вЂ” РЅРµР·Р°РІРёСЃРёРјС‹Рµ РѕСЃРё).
  const labMult = input.labMrvMultiplier ?? 1;
  const effectiveMrvMult = pedMrvMult * labMult;
  if (labMult < 1) {
    rationale.push(`рџ§Є Р›Р°Р±РѕСЂР°С‚РѕСЂРЅР°СЏ РєРѕСЂСЂРµРєС†РёСЏ: MRV Г—${labMult.toFixed(2)} (РїРµС‡РµРЅСЊ/РїРѕС‡РєРё/РІРѕСЃРїР°Р»РµРЅРёРµ/РіРѕСЂРјРѕРЅС‹) в†’ СЌС„С„РµРєС‚РёРІРЅС‹Р№ MRV-РјРЅРѕР¶РёС‚РµР»СЊ Г—${effectiveMrvMult.toFixed(2)}.`);
    if (input.labWarnings && input.labWarnings.length > 0) {
      rationale.push(...input.labWarnings.map(w => `вљ  ${w}`));
    }
    if (input.labIntensityNote) {
      rationale.push(`рџ§Є РРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ: ${input.labIntensityNote}`);
    }
  }
  // PRO: cross-mesocycle continuity вЂ” РѕС‚С‡С‘С‚ Рѕ РїСЂРѕРіСЂРµСЃСЃРёРё
  if (mesoProgression) {
    const musclesProgressed = Object.keys(mesoProgression.weightProgression).length;
    const avgDelta = musclesProgressed > 0
      ? Math.round(Object.values(mesoProgression.weightProgression).reduce((s, v) => s + v, 0) / musclesProgressed * 10) / 10
      : 0;
    rationale.push(`рџ”— Cross-mesocycle: РІРµСЃР° +${avgDelta} РєРі (${musclesProgressed} РјС‹С€С†), РѕР±СЉС‘Рј +${Object.values(mesoProgression.volumeDelta).filter(v => v > 0).length} РіСЂСѓРїРї, СЂРѕС‚Р°С†РёСЏ ${mesoProgression.previousExercises.length} СѓРїСЂ.`);
    if (mesoProgression.needsDeload) {
      rationale.push(`вљ  Cross-mesocycle: РїСЂРµРґС‹РґСѓС‰РёР№ РјРµР·Рѕ Р±С‹Р» РґР»РёРЅРЅС‹Рј/РѕР±СЉС‘РјРЅС‹Рј вЂ” СЂРµРєРѕРјРµРЅРґСѓРµС‚СЃСЏ deload-РЅРµРґРµР»СЏ РІ РЅР°С‡Р°Р»Рµ РЅРѕРІРѕРіРѕ РїР»Р°РЅР°.`);
    }
  }
  // Cross-day weakPoints compensation: РµСЃР»Рё СЃР»Р°Р±Р°СЏ РіСЂСѓРїРїР° РїРѕР»СѓС‡Р°РµС‚ < MEV Р·Р° РЅРµРґРµР»СЋ (РїРѕС‚РѕРјСѓ С‡С‚Рѕ
  // РЅРµ РІС…РѕРґРёС‚ РЅРё РІ РѕРґРёРЅ РґРЅРµРІРЅРѕР№ С‚РµРі), РґРѕР±Р°РІРёС‚СЊ feeder-СЃРµС‚ РІ Р±Р»РёР¶Р°Р№С€РёР№ СЂРµР»РµРІР°РЅС‚РЅС‹Р№ РґРµРЅСЊ.
  finalPlan = (weakPoints.length > 0 || allSpecTargets.length > 0)
    ? compensateCrossDayWeakPoints(finalPlan, [...new Set([...weakPoints, ...allSpecTargets])], level, workMax, eqList, effectiveMrvMult, avAxial, phaseByWeek)
    : finalPlan;
  // Final re-sort: compensateCrossDayWeakPoints may have added feeders that break grouping
  for (const w of finalPlan.weeks) {
    for (const s of w.sessions) {
      // в”Ѓв”Ѓв”Ѓ Р”Р•Р”РЈРџР›РРљРђР¦РРЇ в”Ѓв”Ѓв”Ѓ
      // 1. РўРѕС‡РЅС‹Рµ РґСѓР±Р»РёРєР°С‚С‹ РїРѕ РёРјРµРЅРё
      const seenNames = new Set<string>();
      s.exercises = s.exercises.filter(e => {
        const n = (e.exerciseName || e.name || '').toLowerCase();
        if (seenNames.has(n)) return false;
        seenNames.add(n);
        return true;
      });
      // 2. Р”СѓР±Р»РёРєР°С‚С‹ РїРѕ РїР°С‚С‚РµСЂРЅСѓ (5 СЏРіРѕРґРёС‡РЅС‹С… РјРѕСЃС‚РѕРІ в†’ РѕСЃС‚Р°РІРёС‚СЊ 2)
       const PER_MUSCLE_MAX: Record<string, number> = {
         glutes: 3, hamstrings: 3, quads: 4, chest: 4, back: (level === 'enhanced' && (input.trainingYears ?? 0) >= 3) ? 8 : 4,
        shoulders: 3, biceps: 3, triceps: 3, calves: 2, abs: 3,
        traps: 2, forearms: 2, core: 2, lower_back: 2,
      };
      const perMuscleCount: Record<string, number> = {};
      // 3. РџРѕРґСЃС‡С‘С‚ similarity: "СЏРіРѕРґРёС‡РЅС‹Р№ РјРѕСЃС‚ РЅР° СЃРєР°РјСЊРµ" ~ "СЏРіРѕРґРёС‡РЅС‹Р№ РјРѕСЃС‚ РЅР° РїРѕР»Сѓ" в†’ РѕРґРёРЅ РїР°С‚С‚РµСЂРЅ
      const patternOf = (name: string): string => {
        const n = name.toLowerCase();
        if (/РїСѓР»РѕРІРµСЂ|pullover|РїСѓР»РѕРІ|РїСЂСЏРј.*СЂСѓРє|straight.*pull/i.test(n)) return 'pullover';
        if (/СЏРіРѕРґРёС‡РЅ.*РјРѕСЃС‚|hip.?thrust|glute.?bridge/i.test(n)) return 'hip_thrust';
        if (/СЃРіРёР±Р°РЅ.*РЅРѕРі|leg.?curl/i.test(n)) return 'leg_curl';
        if (/СЂР°Р·РіРёР±Р°РЅ.*РЅРѕРі|leg.?ext/i.test(n)) return 'leg_ext';
        if (/РІС‹РїР°Рґ|lunge|Р±РѕР»РіР°СЂ|СЂРµРІРµСЂР°РЅСЃ/i.test(n)) return 'lunge';
        if (/РїСЂРёСЃРµРґ|squat/i.test(n) && !/РЅР°Рґ РіРѕР»РѕРІ|overhead|РїРёСЃС‚РѕР»/i.test(n)) return 'squat';
        if (/Р¶РёРј.*РЅРѕРі|leg.?press/i.test(n)) return 'leg_press';
        if (/Р¶РёРј.*Р»С‘Р¶|bench.*press/i.test(n) && !/РЅР°РєР»РѕРЅ|incline/i.test(n)) return 'bench_press';
        if (/Р¶РёРј.*РЅР°РєР»РѕРЅ|incline.*press/i.test(n)) return 'incline_press';
        if (/СЂР°Р·РІРѕРґ|fly|СЃРІРµРґРµРЅ|РїРµРє.?РґРµРє|butterfly|РєСЂРѕСЃСЃРѕРІРµСЂ/i.test(n)) return 'fly';
        // РџРѕРґС‚СЏРіРёРІР°РЅРёРµ Рё РІРµСЂС…РЅРёР№ Р±Р»РѕРє вЂ” РѕРґРёРЅ С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅС‹Р№ vertical-pull
        // РїР°С‚С‚РµСЂРЅ. Р Р°Р·РЅС‹Р№ С…РІР°С‚ РЅРµ РґРµР»Р°РµС‚ РёС… РґРІСѓРјСЏ РЅРµР·Р°РІРёСЃРёРјС‹РјРё СЃР»РѕС‚Р°РјРё.
        if (/РїРѕРґС‚СЏРі|pull.?up|chin|С‚СЏРіР°.*РІРµСЂС…РЅ.*Р±Р»РѕРє|lat.?pull|РїСѓР»Р»РґР°СѓРЅ|РІРµСЂС…РЅ.*Р±Р»РѕРє/i.test(n)) return 'vertical_pull';
        if (/С‚СЏРіР°.*Р»РёС†|face.?pull/i.test(n)) return 'face_pull';
        if (/С‚СЏРіР°|row|Р№РµР№С‚СЃ|seal|РїРµРЅРґР»/i.test(n) && !/РїРѕРґС‚СЏРі|Р»РёС†|СЂРµР·РёРЅ|РїСѓР»РѕРІРµСЂ|pullover/i.test(n)) return 'row';
        if (/С€СЂР°Рі/i.test(n)) return 'shrug';
        if (/РјРѕР»РѕС‚|hammer/i.test(n)) return 'hammer_curl';
        if (/РїРѕРґСЉС‘Рј.*Р±РёС†РµРїСЃ|СЃРіРёР±Р°РЅ.*Р±РёС†РµРїСЃ|СЃРіРёР±Р°РЅ.*СЂСѓРє|curl/i.test(n)) return 'biceps_curl';
        if (/Р¶РёРј.*СѓР·Рє|close.?grip/i.test(n)) return 'tricep_compound';
        if (/С„СЂР°РЅС†СѓР·|overhead|РёР·.?Р·Р° РіРѕР»РѕРІ|french/i.test(n)) return 'tricep_overhead';
        if (/pushdown|РєР°РЅР°С‚|Р±Р»РѕРє.*С‚СЂРёС†РµРїСЃ|С‚СЂРёС†РµРїСЃ.*Р±Р»РѕРє/i.test(n)) return 'tricep_pushdown';
        if (/СЂР°Р·РіРёР±Р°РЅ.*С‚СЂРёС†РµРїСЃ|tricep/i.test(n)) return 'tricep_ext';
        if (/Р¶РёРј.*Р°СЂРјРµР№СЃРє|Р¶РёРј.*standing|Р¶РёРј.*СЃРёРґСЏ|arnold|Р°СЂРЅРѕР»СЊРґ|Р¶РёРј.*РіР°РЅС‚РµР».*СЃС‚РѕСЏ|Р¶РёРј.*РіР°РЅС‚РµР».*СЃРёРґСЏ|ohp|Р¶РёРј.*СЃРјРёС‚Рµ.*СЃРёРґСЏ/i.test(n)) return 'shoulder_press';
        if (/Р»СЌРЅРґРјР°Р№РЅ|landmine/i.test(n)) return 'landmine_press';
        if (/РјР°С…|raise|РѕС‚РІРµРґРµРЅ|СЂР°Р·РІРµРґРµРЅ/i.test(n) && /РЅР°РєР»РѕРЅ|Р·Р°РґРЅ|rear/i.test(n)) return 'rear_delt';
        if (/РјР°С…|raise|РІ СЃС‚РѕСЂРѕРЅ|lateral/i.test(n)) return 'lateral_raise';
        if (/РїРѕРґСЉС‘Рј.*РЅРѕСЃРє|calf/i.test(n)) return 'calf_raise';
        if (/СЃРіРёР±Р°РЅ.*Р·Р°РїСЏСЃС‚|СЂР°Р·РіРёР±Р°РЅ.*РєРёСЃС‚|СЃРіРёР±Р°РЅ.*РїСЂРµРґРїР»РµС‡|forearm|wrist/i.test(n)) return 'forearm';
        if (/СЃРєСЂСѓС‡РёРІ|crunch/i.test(n)) return 'crunch';
        if (/РѕС‚Р¶РёРјР°РЅ.*Р±СЂСѓСЃ|dip/i.test(n)) return 'dips';
        return n; // СѓРЅРёРєР°Р»СЊРЅРѕРµ РёРјСЏ = СѓРЅРёРєР°Р»СЊРЅС‹Р№ РїР°С‚С‚РµСЂРЅ
      };
      const perPatternCount: Record<string, number> = {};
      // в… C: РњР°Р»С‹Рµ РјС‹С€С†С‹ вЂ” РјР°РєСЃ 1 СѓРїСЂР°Р¶РЅРµРЅРёРµ РѕРґРЅРѕРіРѕ РїР°С‚С‚РµСЂРЅР° (РґРѕСЃС‚Р°С‚РѕС‡РЅРѕ),
      // РєСЂСѓРїРЅС‹Рµ вЂ” РјР°РєСЃ 2 (СЂР°Р·РЅС‹Рµ СѓРіР»С‹ Р¶РёРјР°/С‚СЏРіРё вЂ” РЅРѕСЂРјР°Р»СЊРЅРѕ), РёР·РѕР»СЏС†РёСЏ РІСЃРµРіРґР° 1
      const SINGLE_PATTERN_MUSCLES = new Set(['glutes', 'calves', 'traps', 'forearms', 'abs', 'biceps', 'triceps', 'shoulders', 'delt_front', 'delt_mid', 'delt_rear']);
      const ISOLATION_PATTERNS = new Set(['fly', 'pullover', 'leg_ext', 'leg_curl', 'calf_raise', 'lateral_raise', 'rear_delt', 'hammer_curl', 'biceps_curl', 'tricep_ext', 'tricep_overhead', 'tricep_pushdown', 'tricep_compound', 'forearm', 'crunch', 'shrug', 'face_pull', 'hip_thrust', 'dips']);
      s.exercises = s.exercises.filter(e => {
        const m = collapseKey(e.muscle || '');
        const name = (e.exerciseName || e.name || '');
        const pat = patternOf(name);
        const muscleCap = PER_MUSCLE_MAX[m] ?? 4;
        // РљР°Рї РїРѕ РїР°С‚С‚РµСЂРЅСѓ: РёР·РѕР»СЏС†РёСЏ РІСЃРµРіРґР° 1 (3 РїСѓР»РѕРІРµСЂР°/3 СЂР°Р·РіРёР±Р°РЅРёСЏ вЂ” СѓР¶Р°СЃ), РІРµСЂС‚РёРєР°Р»СЊ СЃРїРёРЅС‹ 1 (2 РґР»СЏ РѕРїС‹С‚РЅС‹С… enhanced), РёРЅР°С‡Рµ 1 РґР»СЏ РјР°Р»С‹С…, 2 РґР»СЏ РєСЂСѓРїРЅС‹С… РєРѕРјРїР°СѓРЅРґРѕРІ (3 РґР»СЏ СЃРїРёРЅС‹ Сѓ РѕРїС‹С‚РЅС‹С…)
        let patMax = 2;
        if (ISOLATION_PATTERNS.has(pat)) patMax = 1;
        else if (m === 'back' && (pat === 'vertical_pull' || pat === 'pulldown' || pat === 'pullup')) patMax = (level === 'enhanced' && (input.trainingYears ?? 0) >= 3) ? 2 : 1;
        else if (m === 'back' && pat === 'row') patMax = (level === 'enhanced' && (input.trainingYears ?? 0) >= 3) ? 3 : 2;
        else if (SINGLE_PATTERN_MUSCLES.has(m)) patMax = 1;
        else patMax = 2;
        const patKey = m + ':' + pat;
        const curPat = perPatternCount[patKey] || 0;
        if (curPat + 1 > patMax) return false;
        const curMuscle = perMuscleCount[m] || 0;
        if (curMuscle + 1 > muscleCap) return false;
        perPatternCount[patKey] = curPat + 1;
        perMuscleCount[m] = curMuscle + 1;
        return true;
      });
      // Re-sort РїРѕСЃР»Рµ РґРµРґСѓРїР»РёРєР°С†РёРё (СЃ СЃРѕС…СЂР°РЅРµРЅРёРµРј РјРµС‚РѕРґРёРєРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ вЂ” pre_exhaust/post_exhaust).
      // Р Р°РЅРµРµ Р·РґРµСЃСЊ РІС‹Р·С‹РІР°Р»СЃСЏ orderSessionExercises Р‘Р•Р— methodology, С‡С‚Рѕ СЃР±СЂР°СЃС‹РІР°Р»Рѕ pre_exhaust
      // РѕР±СЂР°С‚РЅРѕ РІ compound_first вЂ” РІС‹Р±РѕСЂ РјРµС‚РѕРґРёРєРё РІ UI РЅРµ РёРјРµР» СЌС„С„РµРєС‚Р° РЅР° С„РёРЅР°Р»СЊРЅС‹Р№ РїРѕСЂСЏРґРѕРє.
      const reordered = orderSessionExercises(s.exercises, {
        sessionTag: s.sessionTag || '',
        methodology: input.methodology,
        priorityMuscles: [...weakPoints, ...(focusGroup ? [focusGroup] : [])],
      });
      s.exercises.length = 0; s.exercises.push(...reordered);
      // P0-1: РёС‚РѕРіРѕРІС‹Р№ РєР°Рї вЂ” РїСЂРѕС„РµСЃСЃРёРѕРЅР°Р»СЊРЅС‹Р№ РїСЂРµРґРµР» 6-10 СѓРїСЂР°Р¶РЅРµРЅРёР№ РЅР° СЃРµСЃСЃРёСЋ.
      // Р Р°РЅСЊС€Рµ: max(9, min(13, musclesГ—2)) в†’ FullBody (6 РјС‹С€С† Г— 2 = 12, cap 12) = 19 СѓРїСЂР°Р¶РЅРµРЅРёР№!
      // РўРµРїРµСЂСЊ: max(6, min(10, muscles+2)) в†’ FullBody (6+2=8) = 8 СѓРїСЂР°Р¶РЅРµРЅРёР№. РџСЂРѕС„РµСЃСЃРёРѕРЅР°Р»
      // СЃС‚Р°РІРёС‚ 6-8 СѓРїСЂР°Р¶РЅРµРЅРёР№ РІ РїРѕР»РЅС‹Р№ РґРµРЅСЊ, 4-6 РІ СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹Р№.
      const sessMuscleCount = new Set(s.exercises.map(e => collapseKey(e.muscle))).size;
       const highVolumeEnhanced = level === 'enhanced' && (input.trainingYears ?? 0) >= 3;
       const finalCap = highVolumeEnhanced
         ? Math.max(10, Math.min(16, sessMuscleCount + 7))
         : Math.max(6, Math.min(10, sessMuscleCount + 2));
      if (s.exercises.length > finalCap) {
        s.exercises.length = finalCap;
      }
      // P0-1: С„РёРЅР°Р»СЊРЅР°СЏ РіР°СЂР°РЅС‚РёСЏ arms вЂ” РџРћРЎР›Р• РІСЃРµС… РѕР±СЂРµР·РѕРє (exCap, finalCap, dedup).
      // Р•СЃР»Рё biceps/triceps Р±С‹Р»Рё РѕС‚СЂРµР·Р°РЅС‹ вЂ” РґРѕР±Р°РІР»СЏРµРј РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ 1 СѓРїСЂР°Р¶РЅРµРЅРёРµ РЅР° РєР°Р¶РґРѕРµ.
      const dayMusclePlans = dedupeMuscles(s.sessionTag, new Set());
      const dayArmMuscles = new Set(dayMusclePlans.filter(mp => ARM_MUSCLES_SET.has(mp.group)).map(mp => mp.group));
      if (dayArmMuscles.size > 0) {
        const presentM = new Set(s.exercises.map(e => e.muscle));
        const wPhase = phaseByWeek.get(w.week) || 'accumulation';
        for (const m of dayArmMuscles) {
          if (presentM.has(m)) continue;
          // РќР°Р№С‚Рё РёР·РѕР»СЏС†РёСЋ РЅР° СЌС‚Сѓ РјС‹С€С†Сѓ РІ РєР°С‚Р°Р»РѕРіРµ
          const pool = (EXERCISE_CATALOG as any[]).filter((e: any) => {
            const mg = collapseKey(trueMuscleOf(e) || e.group || '');
            if (mg !== m) return false;
            if (e.exerciseType !== 'isolation' && e.type !== 'isolation') return false;
            if (isBBJunk(e)) return false;
            if (isInappropriateBB(e)) return false;
            if (eqList?.length && e.equipment && !eqList.includes(e.equipment)) return false;
            return true;
          });
          if (!pool.length) continue;
          const fData = pool[0];
          const fName = fData.name || fData.id;
          const fBase = (workMax as any)[m] || DEFAULT_WORKMAX[m] || 50;
          const armSets = 3;
          const pcfg = getPhaseConfig(wPhase as any, input.trainingFocus);
          const armReps = Math.round((pcfg.repRange[0] + pcfg.repRange[1]) / 2) + 2;
          const armWeight = Math.round(fBase * pcfg.intensityMultiplier * 0.88 * 10) / 10;
          s.exercises.push({
            muscle: m, name: fName, role: 'accessory' as const,
            character: 'РїР°РјРї' as DayCharacter, sets: armSets,
            repsRange: [pcfg.repRange[0] + 2, pcfg.repRange[1] + 5] as [number, number],
            rir: 3,
            workSets: Array.from({ length: armSets }, () => ({ reps: armReps, rir: 3, weight: armWeight, tempo: pcfg.tempo, restSeconds: Math.max(45, pcfg.restBase - 30) })),
            exerciseName: fName,
            tempoSpec: pcfg.tempo, restSeconds: Math.max(45, pcfg.restBase - 30),
            comment: `рџЋЇ Arm-guarantee: ${m} вЂ” P0-1 (arms Р·Р°С‰РёС‰РµРЅС‹ РѕС‚ РѕР±СЂРµР·РєРё exCap/finalCap/dedup).`,
            warmupSets: [], rationale: 'Arm guarantee: P0-1',
          });
        }
      }
    }
    // P0-2: С„РёРЅР°Р»СЊРЅС‹Р№ MRV-РєР°Рї РџРћРЎР›Р• РІСЃРµС… РјРѕРґРёС„РёРєР°С†РёР№ (dedup, feeders, re-sort).
    // Р Р°РЅСЊС€Рµ normalizeWeekMrv РІС‹Р·С‹РІР°Р»СЃСЏ РґРѕ compensateCrossDayWeakPoints/dedup,
    // Рё feeders/dedup РјРѕРіР»Рё РґРѕР±Р°РІРёС‚СЊ РѕР±СЉС‘Рј РІС‹С€Рµ MRV.
    normalizeWeekMrv(w.sessions, mrvByMuscle, w.phase === 'deload' || !!w.deload);
  }
  // P1-5: auto-MEV-feeder вЂ” РјС‹С€С†С‹ СЃ РѕР±СЉС‘РјРѕРј < MEV РїРѕР»СѓС‡Р°СЋС‚ feeder РІ Р±Р»РёР¶Р°Р№С€РёР№ СЂРµР»РµРІР°РЅС‚РЅС‹Р№ РґРµРЅСЊ.
  // РђРєС‚СѓР°Р»СЊРЅРѕ РґР»СЏ bro_5 (calves=2, glutes=4 РїСЂРё MEV=8) Рё РґСЂСѓРіРёС… 1Г—/РЅРµРґ СЃРїР»РёС‚РѕРІ.
  // Р‘РµСЂС‘Рј РїРµСЂРІСѓСЋ РЅРµРґРµР»СЋ РєР°Рє РѕР±СЂР°Р·РµС† (РІСЃРµ РЅРµРґРµР»Рё РѕРґРёРЅР°РєРѕРІС‹ РїРѕ СЃС‚СЂСѓРєС‚СѓСЂРµ Р±РµР· weakPoints).
  if (finalPlan.weeks.length > 0) {
    const wk1 = finalPlan.weeks[0];
    const normLvl = normLevel(level);
    const autoFeedMuscles = ['calves', 'glutes', 'abs', 'forearms', 'hamstrings', 'shoulders', 'biceps', 'triceps'];
    for (const m of autoFeedMuscles) {
      // BUG-FIX: auto-MEV-feeder РќР• РґРѕР»Р¶РµРЅ РґРѕР±Р°РІР»СЏС‚СЊ СѓРїСЂР°Р¶РЅРµРЅРёСЏ РґР»СЏ РёСЃРєР»СЋС‡С‘РЅРЅС‹С…
      // С‚СЂР°РІРјР°РјРё РјС‹С€С† (exclude=true) РёР»Рё РІ С‰Р°РґСЏС‰РµРј СЂРµР¶РёРјРµ (graded вЂ” РѕР±СЉС‘Рј
      // СЃРЅРёР¶РµРЅ РЅР°РјРµСЂРµРЅРЅРѕ) вЂ” РёРЅР°С‡Рµ В«legs excludeВ» РІРѕР·РІСЂР°С‰Р°Р»Рѕ РЅРѕРіРё РІ РїР»Р°РЅ,
      // Р° С‰Р°РґСЏС‰РёР№ СЂРµР¶РёРј СЂР°Р·РґСѓРІР°Р»СЃСЏ РґРѕ MEV.
      if (excludedMuscles.has(m) || excludedMuscles.has(collapseKey(m))) continue;
      if (gradedInjuries.some(inj => collapseKey(inj.muscle) === m)) continue;
      let weekSets = 0;
      for (const s of wk1.sessions) for (const e of s.exercises) if (collapseKey(e.muscle) === m) weekSets += e.sets;
      const lm = getVolumeLandmarks(normLvl, m);
      if (!lm) continue;
      const targetMEV = Math.round(lm.mev * effectiveMrvMult);
      if (weekSets >= targetMEV) continue;
      // РќР°Р№С‚Рё Р±Р»РёР¶Р°Р№С€РёР№ РґРµРЅСЊ СЃ СЌС‚РѕР№ РјС‹С€С†РµР№ (РёР»Рё СЃРѕРІРјРµСЃС‚РёРјС‹Р№ С‚РµРі)
      const allowedTags = WEAKPOINT_DAY_TAGS[m] ?? ['Legs', 'Lower', 'FullBody'];
      let bestSlot: BBSession | null = null;
      let bestScore = -Infinity;
      for (const w of finalPlan.weeks) {
        for (const s of w.sessions) {
          const tag = (s.sessionTag || '').toLowerCase();
          if (!allowedTags.some(at => tag.includes(at.toLowerCase()))) continue;
          const score = s.exercises.length * 10;
          if (score > bestScore) { bestScore = score; bestSlot = s; }
        }
      }
      if (!bestSlot) continue;
      // РќР°Р№С‚Рё РёР·РѕР»СЏС†РёСЋ РЅР° СЌС‚Сѓ РјС‹С€С†Сѓ
      const feederPool = (EXERCISE_CATALOG as any[]).filter((e: any) => {
        const mg = collapseKey(trueMuscleOf(e) || e.group || '');
        if (mg !== m) return false;
        if (e.exerciseType !== 'isolation' && e.type !== 'isolation') return false;
        if (isBBJunk(e)) return false;
        if (isInappropriateBB(e)) return false;
        if (eqList?.length && e.equipment && !eqList.includes(e.equipment)) return false;
        if (avAxial && isAxialLoadExercise(e as any)) return false;
        return true;
      });
      if (!feederPool.length) continue;
      feederPool.sort((a, b) => (a.name?.length || 0) - (b.name?.length || 0));
      const fBase = (workMax as any)[m] || DEFAULT_WORKMAX[m] || 50;
      const feederWeight = Math.max(5, Math.round(fBase * 0.3 * 10) / 10);
  const fTempo = tempoFor('РїР°РјРї', undefined, phaseByWeek.get(wk1.week) || 'accumulation');
  const need = Math.max(2, targetMEV - weekSets);
      // P1-5: РјР°РєСЃРёРјСѓРј 5 СЃРµС‚РѕРІ РЅР° РѕРґРЅРѕ СѓРїСЂР°Р¶РЅРµРЅРёРµ (РїСЂРѕ-РѕР±СЉС‘Рј РґРѕР±РёРІР°РµС‚СЃСЏ
      // СѓРїСЂР°Р¶РЅРµРЅРёСЏРјРё, Р° РЅРµ 6-8 РїРѕРґС…РѕРґР°РјРё РІ РѕРґРЅРѕРј РґРІРёР¶РµРЅРёРё); РѕСЃС‚Р°С‚РѕРє вЂ” РІС‚РѕСЂС‹Рј.
      const perExCapM = 5;
      const useTwoEx = need > perExCapM && feederPool.length >= 2;
      const setsPerEx = useTwoEx ? Math.ceil(need / 2) : Math.min(need, perExCapM);
      const fData = feederPool[0];
      const fName = fData.name || fData.id;
      const fData2 = useTwoEx ? feederPool[1] : null;
      const fName2 = fData2 ? (fData2.name || fData2.id) : null;
      // Р”РѕР±Р°РІРёС‚СЊ feeder РІ РєР°Р¶РґСѓСЋ РЅРµРґРµР»СЋ
      for (const w of finalPlan.weeks) {
        for (const s of w.sessions) {
          const tag = (s.sessionTag || '').toLowerCase();
          if (!allowedTags.some(at => tag.includes(at.toLowerCase()))) continue;
          if (s.exercises.some(e => e.name === fName)) continue;
          s.exercises.push({
            muscle: m, name: fName, role: 'accessory' as const, character: 'РїР°РјРї' as DayCharacter,
            sets: setsPerEx, repsRange: [15, 20] as [number, number], rir: 3,
            workSets: Array.from({ length: setsPerEx }, () => ({ reps: 18, rir: 3, weight: feederWeight, tempo: fTempo.notation, restSeconds: 30 })),
            exerciseName: fName, tempoSpec: fTempo.notation, restSeconds: 30,
            comment: `Auto-MEV-feeder РґР»СЏ ${m}: ${setsPerEx}Г—15-20 RIR 3 @${feederWeight}РєРі (РЅРµРґРµР»СЊРЅС‹Р№ РѕР±СЉС‘Рј ${weekSets} < MEV ${targetMEV}).`,
            warmupSets: [], rationale: 'MEV coverage: auto-feeder.',
          });
          // Р’С‚РѕСЂРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ (РµСЃР»Рё need > perExCap)
          if (useTwoEx && fName2 && !s.exercises.some(e => e.name === fName2)) {
            s.exercises.push({
              muscle: m, name: fName2, role: 'accessory' as const, character: 'РїР°РјРї' as DayCharacter,
              sets: need - setsPerEx, repsRange: [15, 20] as [number, number], rir: 3,
              workSets: Array.from({ length: need - setsPerEx }, () => ({ reps: 18, rir: 3, weight: feederWeight, tempo: fTempo.notation, restSeconds: 30 })),
              exerciseName: fName2, tempoSpec: fTempo.notation, restSeconds: 30,
              comment: `Auto-MEV-feeder (2) РґР»СЏ ${m}: ${need - setsPerEx}Г—15-20 RIR 3 @${feederWeight}РєРі.`,
              warmupSets: [], rationale: 'MEV coverage: auto-feeder (2-Рµ СѓРїСЂР°Р¶РЅРµРЅРёРµ).',
            });
          }
          break; // С‚РѕР»СЊРєРѕ РѕРґРёРЅ РґРµРЅСЊ
        }
      }
    }
    // Р¤РёРЅР°Р»СЊРЅС‹Р№ MRV-РєР°Рї РїРѕСЃР»Рµ auto-feeders
    for (const w of finalPlan.weeks) normalizeWeekMrv(w.sessions, mrvByMuscle, w.phase === 'deload' || !!w.deload);
  }
  // P0-6 (audit 2026-07): feedback-driven rebuild РёР· РґРЅРµРІРЅРёРєР°.
  // 1) autoUpdateWeakPoints: e1RM-С‚СЂРµРЅРґ в†’ exit/add СЃР»Р°Р±С‹С… РіСЂСѓРїРї
  // 2) applyFeedbackToBuild: РІРµСЃР°/RIR/reps РёР· С„Р°РєС‚Р° (prescribeLoad СЃ С„Р°РєС‚РѕРј РєР°Рє current)
  // 3) autoReplaceOnPlateau: e1RM flat 4+ РЅРµРґ в†’ Р·Р°РјРµРЅР° primary РЅР° Р°Р»СЊС‚РµСЂРЅР°С‚РёРІСѓ
  // Р’СЃРµ С‚СЂРё вЂ” С‚РѕР»СЊРєРѕ РїСЂРё РЅР°Р»РёС‡РёРё WorkoutSession-РґР°РЅРЅС‹С… РІ РґРЅРµРІРЅРёРєРµ.
  const workoutSessions = loadWorkoutSessions();
  if (workoutSessions.length > 0) {
    // 1) Auto-weakPoints update
    const weakUpdate = autoUpdateWeakPoints(weakPoints, workoutSessions, workMax);
    if (weakUpdate.changes.length > 0) {
      rationale.push(...weakUpdate.changes);
    }
    // 2) Feedback-driven rebuild (РІРµСЃР° РёР· С„Р°РєС‚Р°)
    finalPlan = applyFeedbackToBuild(finalPlan, workoutSessions, workMax, input.loadStrategy || 'double_progression');
    // Р¤Р°Р·Р° 2.10: Р·Р°РјРєРЅСѓС‚СЊ per-muscle ACWR + adherence РІ РћР‘РЄРЃРњ (СЃРµС‚С‹ РїРµСЂРµРіСЂСѓР¶РµРЅРЅРѕР№
    // РјС‹С€С†С‹ в†“, adherence<80% в†’ РјР°СЃС€С‚Р°Р±). No-op Р±РµР· РґРЅРµРІРЅРёРєР°.
    const volCorrection = applyDiaryVolumeCorrection(finalPlan, workoutSessions);
    if (volCorrection.changes.length > 0) {
      finalPlan = volCorrection.plan;
      rationale.push(...volCorrection.changes);
    }
    // 3) Auto-replace РЅР° РїР»Р°С‚Рѕ
    const plateauResult = autoReplaceOnPlateau(finalPlan, workoutSessions);
    if (plateauResult.changes.length > 0) {
      finalPlan = plateauResult.plan;
      rationale.push(...plateauResult.changes);
    }
    // 4) Per-muscle ACWR вЂ” per-muscle sets ratio (this-week / 4-week-avg).
    // Р РµР»РµРІР°РЅС‚РЅРµРµ РѕР±С‰РµРіРѕ sRPE-ACWR РґР»СЏ Р‘Р‘: РѕРґРЅР° РјС‹С€С†Р° РјРѕР¶РµС‚ Р±С‹С‚СЊ РїРµСЂРµС‚СЂРµРЅРёСЂРѕРІР°РЅР°
    // РїСЂРё РЅРѕСЂРјР°Р»СЊРЅРѕРј РѕР±С‰РµРј ACWR. Warnings в†’ rationale.
    const perMuscleAcwr = computePerMuscleACWR(workoutSessions);
    const dangerMuscles = Object.entries(perMuscleAcwr).filter(([, v]) => v.zone === 'dangerous');
    const cautionMuscles = Object.entries(perMuscleAcwr).filter(([, v]) => v.zone === 'caution');
    if (dangerMuscles.length > 0) {
      rationale.push(`рџљЁ Per-muscle ACWR danger: ${dangerMuscles.map(([m, v]) => `${m}=${v.ratio}`).join(', ')} вЂ” СЃРЅРёР·РёС‚СЊ РѕР±СЉС‘Рј РґР»СЏ СЌС‚РёС… РіСЂСѓРїРї.`);
    }
    if (cautionMuscles.length > 0) {
      rationale.push(`вљ  Per-muscle ACWR caution: ${cautionMuscles.map(([m, v]) => `${m}=${v.ratio}`).join(', ')} вЂ” РєРѕРЅС‚СЂРѕР»РёСЂРѕРІР°С‚СЊ РѕР±СЉС‘Рј.`);
    }
  }
  // рџ”Ѓ Р”РѕРЅРѕСЂСЃРєРѕРµ РїРµСЂРµСЂР°СЃРїСЂРµРґРµР»РµРЅРёРµ СЃРїРµС†РёР°Р»РёР·Р°С†РёРё (С†РµР»СЊ Р·Р° СЃС‡С‘С‚ РґРѕРЅРѕСЂРѕРІ).
  // РЎР»РѕР№ РџРћР’Р•Р РҐ СЂР°СЃСЃС‡РёС‚Р°РЅРЅРѕРіРѕ РѕР±СЉС‘РјР°: Р±Р°Р·РѕРІС‹Рµ РєРѕСЌС„С„РёС†РёРµРЅС‚С‹ РЅРµ РјРµРЅСЏСЋС‚СЃСЏ.
  if (specSchedule.active) {
    const tradeoffReports = applyTradeoffToPlan(
      finalPlan,
      w => tradeoffForWeek(specSchedule, w),
      w => specResForWeekSchedule(specSchedule, w).targets,
      {
        level,
        mrvByMuscle,
        workMax,
        equipment: eqList,
        maxExercisesPerSession: sessLimits.maxExercises,
        maxWorkingSetsPerSession: sessLimits.maxWorkingSets,
      },
    );
    for (const report of tradeoffReports) {
      if (report.removedSets > 0 || report.transferredSets > 0) {
        rationale.push(`рџ”Ѓ Р”РѕРЅРѕСЂСЃРєРѕРµ РїРµСЂРµСЂР°СЃРїСЂРµРґРµР»РµРЅРёРµ (РЅРµРґ ${report.week}): РґРѕРЅРѕСЂС‹ [${report.donors.join(', ')}] вЂ” СЃРЅСЏС‚Рѕ ${report.removedSets} СЃРµС‚РѕРІ, РїРµСЂРµРЅРµСЃРµРЅРѕ ${report.transferredSets}, РЅРµ РёСЃРїРѕР»СЊР·РѕРІР°РЅРѕ ${report.unusedSets}${report.notes.length ? ` (${report.notes.join('; ')})` : ''}.`);
      }
    }
  }
  const volumeLandmarks = getBBVolumeLandmarks(finalPlan, level, effectiveMrvMult);
  // muscleFrequency: muscleSessionCount СЃРѕРґРµСЂР¶РёС‚ С‡РёСЃР»Рѕ СЃРµСЃСЃРёР№ РЅР° РјС‹С€С†Сѓ Р·Р° СЂРѕС‚Р°С†РёСЋ (= РЅРµРґРµР»СЏ РґР»СЏ 7-РґРЅ РїР°С‚С‚РµСЂРЅРѕРІ)
  const muscleFrequency: Record<string, number> = {};
  for (const [m, count] of Object.entries(muscleSessionCount)) {
    muscleFrequency[collapseKey(m)] = count;
  }
  // P2-1: С‡Р°СЃС‚РѕС‚Р° РјС‹С€С† РІ rationale (РєР»СЋС‡РµРІРѕР№ С„Р°РєС‚РѕСЂ РіРёРїРµСЂС‚СЂРѕС„РёРё вЂ” Schoenfeld 2018).
  const freqSummary = Object.entries(muscleFrequency)
    .filter(([, f]) => f > 0)
    .map(([m, f]) => `${m}=${f}Г—`)
    .join(', ');
  if (freqSummary) rationale.push(`Р§Р°СЃС‚РѕС‚Р° РЅР° РіСЂСѓРїРїСѓ/РЅРµРґ: ${freqSummary}`);
  // Exercise cap is enforced by the shared finalizer's priority-aware
  // fatigue budget. Do not truncate the array here: raw tail deletion can
  // remove the only exercise for a muscle or a protected primary.
  const output = {
    ...finalPlan,
    level,
    volumeLandmarks,
    muscleFrequency,
    volumeTargets,
    mrvByMuscle,
    // Р Р°СЃС€РёСЂРµРЅРЅР°СЏ РЅРµРґРµР»СЊРЅР°СЏ СЃРІРѕРґРєР° СЃРµС‚РѕРІ (РїРѕ РјС‹С€С†Р°Рј: СЃРµСЃСЃРёРё/СЂР°Р±РѕС‡РёРµ/СЂР°Р·РјРёРЅРѕС‡РЅС‹Рµ/РїР°С‚С‚РµСЂРЅС‹).
    expandedSummary: buildBBExpandedSummary(finalPlan),
    // РљРѕРЅС‚РµРєСЃС‚ СЃРїРµС†РёР°Р»РёР·Р°С†РёРё/Р»РёРјРёС‚РѕРІ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ РїР»Р°РЅРµ РґР»СЏ РїРѕРІС‚РѕСЂРЅРѕР№
    // С„РёРЅР°Р»РёР·Р°С†РёРё (revalidate РїРѕСЃР»Рµ СЂСѓС‡РЅС‹С… РїСЂР°РІРѕРє).
    specializationSchedule: specSchedule,
    priorityMuscles: [...new Set([...weakPoints, ...allSpecTargets, ...(focusGroup ? [focusGroup] : [])])],
    mrvMultiplier: effectiveMrvMult,
    maxWorkingSets: sessLimits.maxWorkingSets,
    maxExercises: sessLimits.maxExercises,
    gradedMuscles: [...new Set(gradedInjuries.map(inj => inj.muscle))],
    mobilityRestrictions: input.mobilityRestrictions,
    trainingVolumeMode: input.trainingVolumeMode || 'standard',
    volumeGoal: input.volumeGoal,
    goal: input.goal,
    trainingFocus: input.trainingFocus,
    methodology: input.methodology,
    supersetMode: input.supersetMode,
    volumeScheme: input.volumeScheme,
    dupMode: (input as any).dupMode,
    trainingYears: input.trainingYears,
    courseIntensity: input.courseIntensity || pedAdapt?.courseIntensity,
    bfrMode: input.bfrMode,
    blastCruiseEnabled: input.blastCruiseEnabled,
    blastWeeks: input.blastWeeks,
    cruiseWeeks: input.cruiseWeeks,
    inputSnapshot: {
      level: input.level,
      goal: input.goal,
      trainingVolumeMode: input.trainingVolumeMode || 'standard',
      volumeGoal: input.volumeGoal,
      trainingFocus: input.trainingFocus,
      methodology: input.methodology,
      supersetMode: input.supersetMode,
      volumeScheme: input.volumeScheme,
      dupMode: (input as any).dupMode,
      trainingYears: input.trainingYears,
      courseIntensity: input.courseIntensity || pedAdapt?.courseIntensity,
      fewerCompound: input.fewerCompound,
      rotationMode: input.rotationMode,
      intensityLevel: input.intensityLevel,
      avoidAxialLoad: input.avoidAxialLoad,
      equipment: input.equipment,
      injuries: input.injuries,
      mobilityRestrictions: input.mobilityRestrictions,
      favoriteExercises: input.favoriteExercises,
      excludedExercises: input.excludedExercises,
      autoDeload: input.autoDeload,
      deloadType: input.deloadType,
      loadStrategy: input.loadStrategy,
      eccentricMult: input.eccentricMult,
      calorieSurplus: input.calorieSurplus,
      proteinPerKg: input.proteinPerKg,
      labMrvMultiplier: input.labMrvMultiplier,
      bodyFat: input.bodyFat,
      leanMass: input.leanMass,
      hrvMs: input.hrvMs,
      sleepHours: input.sleepHours,
      stressLevel: input.stressLevel,
      weakPoints,
      focusGroup,
      bfrMode: input.bfrMode,
      blastCruiseEnabled: input.blastCruiseEnabled,
      blastWeeks: input.blastWeeks,
      cruiseWeeks: input.cruiseWeeks,
    },
  };
  syncBBPlanSetShape(output);
  const validation =   validateBBPlan(output, { level, trainingYears: input.trainingYears });
  const validationWarnings = validation.issues
    .filter(issue => issue.level === 'warning')
    // Р›РѕР¶РЅС‹Рµ warning РЅР° СЌС‚РѕР№ СЃС‚Р°РґРёРё: weeklyVolume РїРµСЂРµСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ РІ finalize
    // РїРѕСЃР»Рµ allocation/taper, Р° РєР°Рї-Р°РґР¶СѓСЃС‚ (cap-adjust) СЂРµР¶РµС‚ effective РїРѕ
    // С„Р°РєС‚Сѓ. Р¤РёРЅР°Р»СЊРЅР°СЏ РІР°Р»РёРґР°С†РёСЏ РґР°С‘С‚ РєРѕСЂСЂРµРєС‚РЅС‹Рµ Р·РЅР°С‡РµРЅРёСЏ.
    .filter(issue => issue.code !== 'target_volume_deficit' && issue.code !== 'effective_mrv_overflow')
    .slice(0, 20)
    .map(issue => `вљ  Р’Р°Р»РёРґР°С†РёСЏ: ${issue.message}`);
  if (validationWarnings.length > 0) {
    const seen = new Set(output.rationale);
    for (const w of validationWarnings) if (!seen.has(w)) { seen.add(w); output.rationale.push(w); }
  }
  let finalized = finalizeBBPlan(output, {
    reorder: true,
    methodology: input.methodology,
    priorityMuscles: [...new Set([...weakPoints, ...allSpecTargets, ...(focusGroup ? [focusGroup] : [])])],
    specializationSchedule: specSchedule,
    level,
    volumeGoal: input.volumeGoal,
    phaseSafety: true,
    controlledRotation: true,
    equipment: eqList,
    excludedExercises: exclIds,
    avoidAxialLoad: avAxial,
    excludedMuscles: [...excludedMuscles],
    gradedMuscles: [...new Set(gradedInjuries.map(inj => inj.muscle))],
    gradedInjuries: gradedInjuries.map(inj => ({ muscle: inj.muscle, exclude: inj.exclude, weightPct: inj.weightPct, volumePct: inj.volumePct, repsCap: inj.repsCap })),
    mobilityRestrictions: input.mobilityRestrictions,
    ensureMinimumVolume: true,
    workMax,
    mrvMultiplier: effectiveMrvMult,
    checkOrder: true,
    // Р’С‹СЃРѕРєРѕРѕР±СЉС‘РјРЅС‹Р№ РїСЂРµРґРµР» РїСЂРёРјРµРЅСЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё СЏРІРЅРѕ РїРµСЂРµРґР°РЅРЅРѕРј СЃС‚Р°Р¶Рµ
    // enhanced-Р°С‚Р»РµС‚Р°; РЅР°С‚СѓСЂР°Р»СЊРЅС‹Рµ Рё legacy-РІС‹Р·РѕРІС‹ СЃРѕС…СЂР°РЅСЏСЋС‚ 24/10.
    maxWorkingSets: sessLimits.maxWorkingSets,
    maxExercises: sessLimits.maxExercises,
    trainingYears: input.trainingYears,
    bodyweightCapability: input.bodyweightCapability,
    supersetMode: input.supersetMode,
    volumeScheme: input.volumeScheme,
  });
  // PED-РјРµС‚РѕРґРёРєР° + insulin window + rep-СЃС…РµРјС‹: overlay РїРѕСЃР»Рµ С„РёРЅР°Р»РёР·Р°С†РёРё, РЅРµ Р»РѕРјР°РµС‚ С‚СЏР¶/РїР°РјРї.
  // Joint-guard СѓР¶Рµ РѕС‚СЂР°Р±РѕС‚Р°Р» РЅР° СѓСЂРѕРІРЅРµ РїСѓР»Р° (buildExercisePool), Р·РґРµСЃСЊ вЂ” С‚РѕР»СЊРєРѕ rationale/РїРѕРґСЃРєР°Р·РєРё.
  try {
    const pedsForMeth: any[] = pedAdapt?.activePEDs || (onCourse ? (Object.keys(input.pedDoses || {}).filter(k => Number((input.pedDoses as any)[k]) > 0) as any) : []);
    if (pedsForMeth.length > 0 || (input.pedDoses && Object.keys(input.pedDoses).length > 0)) {
      const methInput: any = { peds: pedsForMeth, pedDoses: input.pedDoses || {}, level, goal: input.goal, focus: input.trainingFocus, targetMuscles: specRes?.active ? specRes.targets : [] };
      const meth = recommendPEDMethodology(methInput);
      // Insulin window: С‚РѕР»СЊРєРѕ РїР°РјРї-РґРЅРё РїРѕР»СѓС‡Р°СЋС‚ РїРѕРґСЃРєР°Р·РєСѓ (С‚СЏР¶ РЅРµ С‚СЂРѕРіР°РµРј)
      const ghDose = Number((input.pedDoses as any)?.['GH'] || 0);
      const insDose = Number((input.pedDoses as any)?.['insulin'] || 0);
      const hasGH = pedsForMeth.includes('GH' as any);
      const hasIns = pedsForMeth.includes('insulin' as any);
      // Р”РѕР±Р°РІР»СЏРµРј РїРµСЂРё-WO Рё joint rationale (РЅРµ РјРµРЅСЏРµРј С…Р°СЂР°РєС‚РµСЂ)
      let withMeth = applyPEDMethodologyToPlan(finalized, meth);
      if (hasGH || hasIns) {
        const winRationale = hasGH && hasIns && ghDose >= 2 && insDose >= 5 ? `рџ’‰ GH+insulin РѕРєРЅРѕ: РїР°РјРї-РґРЅРё вЂ” intra 30-60Рі + 10Рі EAA (С‚СЏР¶ РґРЅРё Р±РµР· РёР·РјРµРЅРµРЅРёР№)` : null;
        if (winRationale && !withMeth.rationale.includes(winRationale)) withMeth.rationale.push(winRationale);
      }
      // MGF/IGF1 Р»РѕРєР°Р»СЊРЅРѕ: РїРѕРјРµС‚РєР° Рё rationale РѕР±СЂР°Р±Р°С‚С‹РІР°СЋС‚СЃСЏ applyPEDMethodologyToPlan
      // (С†РµР»РµРІС‹Рµ РјС‹С€С†С‹ РїРµСЂРµРґР°РЅС‹ РІ targetMuscles РёР· specRes вЂ” Р¤Р°Р·Р° 2.9).
      // Rep-СЃС…РµРјС‹: РїРѕРґСЃРєР°Р·РєР°, РЅРµ С„РѕСЂСЃРёСЂРѕРІР°РЅРёРµ (СЃРѕС…СЂР°РЅСЏРµРј С‚РµРєСѓС‰РёРµ reps, РґРѕР±Р°РІР»СЏРµРј label)
      // Р’С‹Р±РёСЂР°РµРј СЃС…РµРјСѓ РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РІ rationale (РЅРµ РїРµСЂРµРїРёСЃС‹РІР°РµРј repsRange)
      const heavyScheme = meth.recommendedScheme.heavy;
      const pumpScheme = meth.recommendedScheme.pump;
      if (heavyScheme || pumpScheme) {
        const hs = heavyScheme ? REP_SCHEMES[heavyScheme] : null;
        const ps = pumpScheme ? REP_SCHEMES[pumpScheme] : null;
        if (hs) withMeth.rationale.push(`рџ“‹ РЎС…РµРјР° С‚СЏР¶: ${hs.nameRu} ${hs.repRange[0]}-${hs.repRange[1]} RIR${hs.rir} (${hs.evidence})`);
        if (ps) withMeth.rationale.push(`рџ“‹ РЎС…РµРјР° РїР°РјРї: ${ps.nameRu} ${ps.repRange[0]}-${ps.repRange[1]} RIR${ps.rir} (${ps.evidence})`);
        // Р¤Р°Р·Р° 1.1: rep-СЃС…РµРјС‹ РїСЂРёРјРµРЅСЏСЋС‚СЃСЏ Рє Р Р•РђР›Р¬РќРћР™ Р·Р°РіСЂСѓР·РєРµ (РЅРµ С‚РѕР»СЊРєРѕ rationale).
        // РўСЏР¶-primary в†’ СЃС…РµРјР° С‚СЏР¶; РїР°РјРї-accessory в†’ СЃС…РµРјР° РїР°РјРї. РРЅРІР°СЂРёР°РЅС‚С‹: cap 5 СЃРµС‚РѕРІ,
        // deload Рё warmup РЅРµ С‚СЂРѕРіР°СЋС‚СЃСЏ, РІРµСЃ РїРµСЂРµСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ РїРѕ Brzycki РѕС‚ workMax.
        const schemeOpts = {
          weightForRepMax,
          workMax,
          defaultWorkMax,
          proWorkmaxRatio: (m: string) => PRO_WORKMAX_RATIO[m] as any,
          intensityMult: 1,
        };
        // РџСЂРёРјРµРЅСЏРµРј rep-СЃС…РµРјСѓ Рє Р Р•РђР›Р¬РќРћР™ Р·Р°РіСЂСѓР·РєРµ. Р’Р°Р¶РЅРѕ: РґРµС„РѕР»С‚РЅР°СЏ СЃС…РµРјР° РїР°РјРї
        // (hypertrophy_8_12, РєРѕС‚РѕСЂСѓСЋ schemeFor РІРѕР·РІСЂР°С‰Р°РµС‚ Р±РµР· СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅРѕРіРѕ PED-РїСЂРѕС„РёР»СЏ)
        // РќР• РґРѕР»Р¶РЅР° РїРµСЂРµРїРёСЃС‹РІР°С‚СЊ РїР°РјРї-РґРЅРё вЂ” РїР°РјРї РґРµСЂР¶РёС‚ 12-20 РїРѕРІС‚РѕСЂРѕРІ. РџСЂРёРјРµРЅСЏРµРј РїР°РјРї-СЃС…РµРјСѓ
        // С‚РѕР»СЊРєРѕ РµСЃР»Рё СЌС‚Рѕ СЂРµР°Р»СЊРЅР°СЏ РїР°РјРї-СЃС…РµРјР° (min РїРѕРІС‚РѕСЂРѕРІ в‰Ґ 12: pump/fst7/gvt/myo/bfr/lengthened).
        const isRealPumpScheme = !!ps && ps.repRange[0] >= 12;
        const heavyApplied = applySchemeToPlan(withMeth, hs, 'heavy_primary', schemeOpts);
        const pumpApplied = isRealPumpScheme ? applySchemeToPlan(withMeth, ps, 'pump_accessory', schemeOpts) : 0;
        if (heavyApplied > 0 || pumpApplied > 0) {
          withMeth.rationale.push(`вљ™пёЏ РЎС…РµРјС‹ РїСЂРёРјРµРЅРµРЅС‹ Рє Р·Р°РіСЂСѓР·РєРµ: ${heavyApplied} С‚СЏР¶-primary + ${pumpApplied} РїР°РјРї-accessory (reps/rest/tempo/РІРµСЃ РїРµСЂРµСЃС‡РёС‚Р°РЅС‹).`);
        }
      }
      // Р’СЃРµ СЃРїР»РёС‚С‹ Р°РґР°РїС‚РёСЂСѓСЋС‚СЃСЏ: РїРѕРєР°Р·Р°С‚СЊ Р°РґР°РїС‚РёСЂРѕРІР°РЅРЅС‹Р№ РѕР±СЉС‘Рј РґР»СЏ РІС‹Р±СЂР°РЅРЅРѕРіРѕ СЃРїР»РёС‚Р°
      const adaptNote = `рџ”„ РЎРїР»РёС‚ В«${pattern.name}В» Р°РґР°РїС‚РёСЂРѕРІР°РЅ: С†РµР»РµРІС‹Рµ РѕР±СЉС‘РјС‹ РїРµСЂРµСЃС‡РёС‚Р°РЅС‹ РїРѕРґ С„Р°СЂРјСѓ (СЂРµР¶РёРј Г—${regimeMult.toFixed(2)}, Р±СЋРґР¶РµС‚ ${weeklyBudget} СЃРµС‚РѕРІ/РЅРµРґ) вЂ” РІСЃРµ СЃРїР»РёС‚С‹ РјР°СЃС€С‚Р°Р±РёСЂСѓСЋС‚СЃСЏ, РІС‹Р±РѕСЂ СЃРѕС…СЂР°РЅС‘РЅ`;
      if (!withMeth.rationale.includes(adaptNote)) withMeth.rationale.push(adaptNote);
      finalized = withMeth;
    } else {
      finalized.rationale.push(`рџ”„ РЎРїР»РёС‚ В«${pattern.name}В» Р°РґР°РїС‚РёСЂРѕРІР°РЅ: Р±СЋРґР¶РµС‚ ${weeklyBudget} СЃРµС‚РѕРІ/РЅРµРґ (РЅР°С‚СѓСЂР°Р») вЂ” РІСЃРµ СЃРїР»РёС‚С‹ РјР°СЃС€С‚Р°Р±РёСЂСѓСЋС‚СЃСЏ РїРѕРґ СЂРµР¶РёРј`);
    }
  } catch (e) { /* ped overlay РЅРµ РґРѕР»Р¶РµРЅ Р»РѕРјР°С‚СЊ РїР»Р°РЅ */ }

  // BFR-СЂРµР¶РёРј: РѕРєРєР»СЋР·РёСЏ 20-30% 1RM, 30-15-15-15, 30СЃ вЂ” С‚РѕР»СЊРєРѕ РїР°РјРї-РёР·РѕР»СЏС†РёРё, С‚СЏР¶ РЅРµ С‚СЂРѕРіР°РµС‚.
  if (input.bfrMode) {
    let bfrApplied = 0;
    for (const week of finalized.weeks) {
      if ((week as any).phase === 'deload' || (week as any).deload) continue;
      for (const sess of week.sessions) {
        if (sess.character !== 'РїР°РјРї' && sess.character !== 'Р»С‘Рі') continue;
        for (const ex of sess.exercises) {
          if ((ex as any).warmupActivator) continue;
          if (ex.role !== 'accessory') continue;
          const isIso = (ex as any).exerciseType === 'isolation' || (ex as any).type === 'isolation' || /СЂР°Р·РіРёР±Р°РЅ|СЃРіРёР±Р°РЅ|curl|raise|fly|РјР°С…|СЂР°Р·РІРѕРґ|С€СЂР°Рі|pushdown|СЃРєСЂСѓС‡РёРІ|РѕС‚РІРµРґРµРЅ|СЃРІРµРґРµРЅ|face.?pull|С‚СЏРіР°.*Р»РёС†/i.test(ex.name || '');
          if (!isIso) continue;
          // BFR: 4 СЃРµС‚Р° 30-15-15-15 @ 25% workMax, RIR 2-3, rest 30СЃ, tempo 2-1-1-0
          const baseW = workMax[ex.muscle] || 50;
          const bfrW = Math.max(5, Math.round(baseW * 0.25 * 10) / 10);
          ex.sets = 4;
          ex.repsRange = [15, 30];
          ex.rir = 2;
          ex.restSeconds = 30;
          ex.tempoSpec = '2-1-1-0';
          ex.workSets = [
            { reps: 30, rir: 2, weight: bfrW, tempo: '2-1-1-0', restSeconds: 30 },
            { reps: 15, rir: 2, weight: bfrW, tempo: '2-1-1-0', restSeconds: 30 },
            { reps: 15, rir: 2, weight: bfrW, tempo: '2-1-1-0', restSeconds: 30 },
            { reps: 15, rir: 3, weight: bfrW, tempo: '2-1-1-0', restSeconds: 30 },
          ];
          if (!ex.comment?.includes('BFR')) ex.comment = `${ex.comment || ''} | рџ©ё BFR 30-15-15-15 @${bfrW}РєРі (20-30% 1RM, 30СЃ)`.trim().replace(/^\|\s*/, '');
          bfrApplied++;
        }
      }
    }
    if (bfrApplied > 0) finalized.rationale.push(`рџ©ё BFR-СЂРµР¶РёРј: ${bfrApplied} РїР°РјРї-РёР·РѕР»СЏС†РёР№ РїРµСЂРµРІРµРґРµРЅС‹ РІ 30-15-15-15 @25% (С‚СЏР¶ РґРЅРё Р±РµР· РёР·РјРµРЅРµРЅРёР№)`);
  }
  if (input.blastCruiseEnabled) {
    const bw = input.blastWeeks ?? 8, cw = input.cruiseWeeks ?? 4;
    finalized.rationale.push(`рџ”„ Blast/Cruise: ${bw}РЅ Г—1.15 (blast) / ${cw}РЅ Г—0.85 (cruise), РїРѕРІС‚РѕСЂСЏРµС‚СЃСЏ вЂ” РѕР±СЉС‘Рј РІРѕР»РЅР°РјРё, С‚СЏР¶/РїР°РјРї СЃРѕС…СЂР°РЅРµРЅС‹`);
  }

  // РЎР»Р°Р±С‹Рµ РіСЂСѓРїРїС‹: +1 СѓРїСЂР°Р¶РЅРµРЅРёРµ (3-4 СЃРµС‚Р°) РЅР° РѕС‚СЃС‚Р°СЋС‰РёР№ РІРёРґ, Р‘Р•Р— СѓС‡С‘С‚Р° РєР°РїР° (optional вљЎ).
  // Р”РѕР±Р°РІР»СЏРµС‚СЃСЏ РџРћРЎР›Р• С„РёРЅР°Р»РёР·Р°С†РёРё, С‡С‚РѕР±С‹ С„РёРЅР°Р»РёР·Р°С‚РѕСЂ РЅРµ СЃСЂРµР·Р°Р» РµРіРѕ.
  // Р­С‚Рѕ РќР• СЃРїРµС†РёР°Р»РёР·Р°С†РёСЏ (Р·Р°Р±РёСЂР°РµС‚ РєР°Рї Сѓ РґСЂСѓРіРёС…) вЂ” Р»РёС€СЊ СЃРјРµС‰РµРЅРёРµ Р±Р°Р»Р°РЅСЃР° РїР°С‚С‚РµСЂРЅРѕРІ.
  if (weakPoints.length > 0) {
    for (const week of finalized.weeks) {
      if (week.phase === 'deload') continue;
      for (const sess of week.sessions) {
        const sessMuscles = new Set(sess.exercises.map(e => collapseKey(e.muscle)));
        const usedNames = new Set(sess.exercises.map(e => e.exerciseName || e.name || ''));
        for (const wp of weakPoints) {
          const cw = collapseKey(wp);
          if (!sessMuscles.has(cw)) continue;
          // BUG-FIX (audit 2026-08): optional-СѓРїСЂР°Р¶РЅРµРЅРёРµ Р”Р РЈР“РћР™ РјС‹С€С†С‹ (PPL-С„РёРЅРёС€РµСЂС‹
          // РґРµР»СЊС‚) РЅРµ РґРѕР»Р¶РЅРѕ Р±Р»РѕРєРёСЂРѕРІР°С‚СЊ weak-optional СЌС‚РѕР№ РјС‹С€С†С‹. РџСЂРѕРІРµСЂСЏРµРј
          // С‚РѕР»СЊРєРѕ optional С‚РѕР№ Р¶Рµ РјС‹С€С†С‹.
          if (sess.exercises.some((e: any) => (e as any).optional && collapseKey(e.muscle) === cw)) continue;
          // РЎР»Р°Р±Р°СЏ РіСЂСѓРїРїР° Рё СЃРїРµС†РёР°Р»РёР·Р°С†РёСЏ вЂ” СЂР°Р·РЅС‹Рµ РІРµС‰Рё: РµСЃР»Рё РјС‹С€С†Р° РЈР–Р• СЏРІР»СЏРµС‚СЃСЏ
          // СЃРїРµС†РёР°Р»РёР·Р°С†РёРµР№ (focus), РЅРµ РґРѕР±Р°РІР»СЏРµРј РµР№ РµС‰С‘ Рё weak-optional (+1) вЂ” РёРЅР°С‡Рµ РґРІРѕР№РЅРѕР№ Р°РєС†РµРЅС‚.
          if (focusGroup && collapseKey(focusGroup) === cw) continue;
          if (specRes.active && specRes.targets.some((t: any) => canonicalMuscle(t) === cw)) continue;
          const iso = EXERCISE_CATALOG.find((ex: any) => {
            const tm = trueMuscleOf(ex);
            if (!tm || collapseKey(tm) !== cw) return false;
            if (usedNames.has(ex.name)) return false;
            if (isBBJunk(ex)) return false;
            if (eqList.length > 0) {
              const rawEq = ex.equipment;
              const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
              if (exEq.length > 0 && !exEq.some(eq => eqList.includes(eq))) return false;
            }
            return true;
          });
          if (!iso) break;
          const wm = workMax[cw] || defaultWorkMax(cw);
          const weight = Math.round((wm || 40) * 0.6 * 10) / 10;
          const workSets = Array.from({ length: 3 }, () => ({ reps: 12, rir: 3, weight, tempo: '3-1-1-0', restSeconds: 60 }));
          // BUG-FIX (audit 2026-08): 21s РїСЂРё СЃРїРµС†РёР°Р»РёР·Р°С†РёРё Р±РёС†РµРїСЃР° вЂ” weak-optional
          // РґРѕР±Р°РІР»СЏРµС‚СЃСЏ РџРћРЎР›Р• post-phase, С‚РµС…РЅРёРєР° РЅР° РЅРµРіРѕ РЅРµ РЅР°РІРµС€РёРІР°РµС‚СЃСЏ. РЎС‚Р°РІРёРј
          // РІСЂСѓС‡РЅСѓСЋ (РјРµС‚РѕРґРёРєР° Р±РёС†РµРїСЃР°: 7 РЅРёР¶РЅРёС… + 7 РІРµСЂС…РЅРёС… + 7 РїРѕР»РЅС‹С…).
          if (input.intensityTechnique === 'twenty_ones' && cw === 'biceps') {
            workSets[workSets.length - 1].reps = 21;
            (workSets[workSets.length - 1] as any).technique = 'twenty_ones';
          }
          sess.exercises.push({
            muscle: cw, name: iso.name, role: 'accessory', character: 'РїР°РјРї',
            sets: 3, repsRange: [12, 15], rir: 3,
            workSets,
            exerciseName: iso.name, tempoSpec: '3-1-1-0', restSeconds: 60,
            optional: true,
            comment: `вљЎ РЎР»Р°Р±Р°СЏ РіСЂСѓРїРїР°: +1 ${iso.name} (3Г—12) Р±РµР· СѓС‡С‘С‚Р° РєР°РїР° вЂ” Р°РєС†РµРЅС‚ РЅР° РѕС‚СЃС‚Р°СЋС‰СѓСЋ С‡Р°СЃС‚СЊ.${input.intensityTechnique === 'twenty_ones' && cw === 'biceps' ? ' В· рџЋЇ 21s: 7 РЅРёР¶РЅРёС… + 7 РІРµСЂС…РЅРёС… + 7 РїРѕР»РЅС‹С… РїРѕРІС‚РѕСЂРѕРІ' : ''}`,
            warmupSets: [], rationale: 'Optional: СЃР»Р°Р±Р°СЏ РіСЂСѓРїРїР° +20% (Р±РµР· СЂР°СЃС…РѕРґРѕРІР°РЅРёСЏ РєР°РїР° РґСЂСѓРіРёС… РјС‹С€С†)',
          });
          break;
        }
      }
    }
  }
  // Final strict muscle grouping after all feeders/optional (fix chest-shoulders-chest, biceps-triceps-biceps)
  for (const week of finalized.weeks) {
    for (const sess of week.sessions) {
      const ordered = orderSessionExercises(sess.exercises, {
        sessionTag: sess.sessionTag,
        methodology: input.methodology,
        priorityMuscles: [...weakPoints, ...(focusGroup ? [focusGroup] : [])],
      });
      sess.exercises.length = 0;
      sess.exercises.push(...ordered);
    }
  }
  return finalized;
}

/**
 * РЇРІРЅС‹Р№ DUP-РІР°СЂРёР°РЅС‚ РіРµРЅРµСЂР°С†РёРё. РћР±С‹С‡РЅС‹Р№ buildBBPlan СЃРѕС…СЂР°РЅСЏРµС‚ РїСЂРµР¶РЅРµРµ
 * РїРѕРІРµРґРµРЅРёРµ, Р° undulating periodization РІРєР»СЋС‡Р°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ С‡РµСЂРµР· СЌС‚РѕС‚ API.
 */
export function buildBBPlanWithDUP(
  input: BBBuilderInput,
  dup: DUPConfig,
  pedAdapt?: PEDAdaptation,
): BBPlan {
  const plan = buildBBPlan(input, pedAdapt);
  return applyDUPOverlay(plan, dup);
}

/* в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ Cross-Day WeakPoints Compensation в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

/** РљР°СЂС‚Р°: СЃР»Р°Р±Р°СЏ РјС‹С€С†Р° в†’ РїРѕРґС…РѕРґСЏС‰РёРµ С‚РµРіРё РґРЅРµР№, РєСѓРґР° РјРѕР¶РЅРѕ РІСЃС‚Р°РІРёС‚СЊ feeder. */
const WEAKPOINT_DAY_TAGS: Record<string, string[]> = {
  chest:        ['Push', 'Upper', 'FullBody', 'Chest'],
  back:         ['Pull', 'Upper', 'FullBody', 'Back'],
  shoulders:    ['Push', 'Pull', 'Upper', 'FullBody', 'Shoulders'],
  delt_front:   ['Push', 'Upper', 'FullBody', 'Shoulders'],
  delt_mid:     ['Push', 'Upper', 'FullBody', 'Shoulders'],
  delt_rear:    ['Pull', 'Upper', 'FullBody', 'Shoulders'],
  biceps:       ['Pull', 'Upper', 'FullBody', 'Arms'],
  triceps:      ['Push', 'Upper', 'FullBody', 'Arms'],
  forearms:     ['Pull', 'Upper', 'FullBody', 'Arms'],
  traps:        ['Pull', 'Upper', 'FullBody', 'Back'],
  quads:        ['Legs', 'Lower', 'FullBody'],
  hamstrings:   ['Legs', 'Lower', 'FullBody'],
  glutes:       ['Legs', 'Lower', 'FullBody'],
  calves:       ['Legs', 'Lower', 'FullBody'],
  abs:          ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'FullBody', 'Core'],
  core:         ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'FullBody', 'Core'],
};

/** Cross-day РєРѕРјРїРµРЅСЃР°С†РёСЏ: РµСЃР»Рё СЃР»Р°Р±Р°СЏ РјС‹С€С†Р° РїРѕР»СѓС‡Р°РµС‚ < MEV Р·Р° РЅРµРґРµР»СЋ, РґРѕР±Р°РІР»СЏРµС‚ feeder РІ Р±Р»РёР¶Р°Р№С€РёР№ СЂРµР»РµРІР°РЅС‚РЅС‹Р№ РґРµРЅСЊ. */
function compensateCrossDayWeakPoints(
  plan: BBPlan,
  weakPoints: string[],
  level: string,
  workMax: Record<string, number>,
  equipment: string[],
  pedMrvMult: number,
  avAxial: boolean = false,
  phaseByWeek?: Map<number, BBPhase>,
): BBPlan {
  if (!plan.weeks || plan.weeks.length === 0) return plan;
  const weeks = plan.weeks.map((w) => ({ week: w.week, sessions: w.sessions.map((s) => ({ ...s, exercises: [...s.exercises] })) }));
  const normLvl = normLevel(level);
  const usedAcrossWeeks = new Set<string>(); // (weekIdx|sessionIdx|exName) вЂ” РіР»РѕР±Р°Р»СЊРЅР°СЏ РґРµРґСѓРїР»РёРєР°С†РёСЏ РїРѕ РїР»Р°РЅСѓ

  // BUG-B1: СЃС‡РёС‚Р°РµРј РѕР±СЉС‘Рј PER-WEEK (Р° РЅРµ Р·Р° РІРµСЃСЊ РїР»Р°РЅ).
  // Р Р°РЅСЊС€Рµ: totalSets СЃСѓРјРјРёСЂРѕРІР°Р» РІСЃРµ РЅРµРґРµР»Рё в†’ 12-РЅРµРґ РїР»Р°РЅ chest=6Г—12=72 >> MEV=8 в†’ feeder РќРРљРћР“Р”Рђ.
  // РўРµРїРµСЂСЊ: РґР»СЏ РєР°Р¶РґРѕР№ РЅРµРґРµР»Рё РѕС‚РґРµР»СЊРЅРѕ РїСЂРѕРІРµСЂСЏРµРј < MEV Рё РґРѕР±Р°РІР»СЏРµРј feeder РІ СЌС‚Сѓ РєРѕРЅРєСЂРµС‚РЅСѓСЋ РЅРµРґРµР»СЋ.
  for (const wpRaw of weakPoints) {
    const wp = collapseKey(wpRaw);
    const lm = getVolumeLandmarks(normLvl, wp);
    if (!lm) continue;
    const targetMEV = Math.round(lm.mev * (pedMrvMult || 1));
    const allowedTags = WEAKPOINT_DAY_TAGS[wp] ?? ['Upper', 'FullBody'];

    // РРґС‘Рј РїРѕ РєР°Р¶РґРѕР№ РЅРµРґРµР»Рµ РѕС‚РґРµР»СЊРЅРѕ
    for (let wi = 0; wi < weeks.length; wi++) {
      // РЎС‡РёС‚Р°РµРј РЅРµРґРµР»СЊРЅС‹Р№ РѕР±СЉС‘Рј РїРѕ СЃР»Р°Р±РѕР№ РјС‹С€С†Рµ
      let weekSets = 0;
      for (const s of weeks[wi].sessions) {
        for (const ex of s.exercises) {
          if (collapseKey(ex.muscle) === wp) weekSets += ex.workSets?.length || ex.sets || 0;
        }
      }
      if (weekSets >= targetMEV) continue; // СЌС‚Р° РЅРµРґРµР»СЏ СѓР¶Рµ РґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РЅР°РіСЂСѓР¶РµРЅР°

      // B2: РїСЂРёРѕСЂРёС‚РµС‚ РґРЅСЋ, РІ РєРѕС‚РѕСЂРѕРј РјС‹С€С†Р° РЈР–Р• РµСЃС‚СЊ, РЅРѕ РѕР±СЉС‘Рј < MEV (РґРѕР±РёРІР°РµРј РґРѕ MEV).
      // РўРѕР»СЊРєРѕ РµСЃР»Рё С‚Р°РєРѕРіРѕ РґРЅСЏ РЅРµС‚ вЂ” РёС‰РµРј РґРµРЅСЊ Р±РµР· РјС‹С€С†С‹ (cross-day compensation).
      let bestSlot: { weekIdx: number; sessionIdx: number; session: any } | null = null;
      let bestScore = -Infinity;
      // РЎРЅР°С‡Р°Р»Р° вЂ” РґРЅРё РЎ РјС‹С€С†РµР№ (РґРѕР±РёС‚СЊ РґРѕ MEV)
      for (let si = 0; si < weeks[wi].sessions.length; si++) {
        const sess = weeks[wi].sessions[si];
        const tag = (sess.sessionTag || '').toLowerCase();
        if (!allowedTags.some(at => tag.includes(at.toLowerCase()))) continue;
        const hasMuscle = sess.exercises.some((e: any) => collapseKey(e.muscle) === wp);
        if (!hasMuscle) continue; // РІ СЌС‚РѕР№ РёС‚РµСЂР°С†РёРё РёС‰РµРј С‚РѕР»СЊРєРѕ РґРЅРё РЎ РјС‹С€С†РµР№
        const key = `${wi}|${si}|${wp}`;
        if (usedAcrossWeeks.has(key)) continue;
        const score = sess.exercises.length * 10 + (si === weeks[wi].sessions.length - 1 ? 5 : 0);
        if (score > bestScore) { bestScore = score; bestSlot = { weekIdx: wi, sessionIdx: si, session: sess }; }
      }
      // B2 fallback: РµСЃР»Рё РґРµРЅСЊ РЎ РјС‹С€С†РµР№ РЅРµ РЅР°Р№РґРµРЅ вЂ” РёС‰РµРј РґРµРЅСЊ Р‘Р•Р— РјС‹С€С†С‹ (cross-day)
      if (!bestSlot) {
        bestScore = -Infinity;
        for (let si = 0; si < weeks[wi].sessions.length; si++) {
          const sess = weeks[wi].sessions[si];
          const tag = (sess.sessionTag || '').toLowerCase();
          if (!allowedTags.some(at => tag.includes(at.toLowerCase()))) continue;
          if (sess.exercises.some((e: any) => collapseKey(e.muscle) === wp)) continue; // СѓР¶Рµ РµСЃС‚СЊ
          const key = `${wi}|${si}|${wp}`;
          if (usedAcrossWeeks.has(key)) continue;
          const score = sess.exercises.length * 10 + (si === weeks[wi].sessions.length - 1 ? 5 : 0);
          if (score > bestScore) { bestScore = score; bestSlot = { weekIdx: wi, sessionIdx: si, session: sess }; }
        }
      }
      if (!bestSlot) continue;

      // Р’С‹Р±СЂР°С‚СЊ feeder-СѓРїСЂР°Р¶РЅРµРЅРёРµ: РёР·РѕР»СЏС†РёСЏ РЅР° wp, РЅРµ rear-delt РІ push, РЅРµ junk
      const feederPool = (EXERCISE_CATALOG as any[]).filter((e: any) => {
        const raw = e.group;
        const mg = collapseKey(trueMuscleOf(e) || raw);
        if (raw !== wp && mg !== wp) return false;
        if (e.exerciseType !== 'isolation' && e.type !== 'isolation') return false;
        if (isBBJunk(e)) return false;
        if (isInappropriateBB(e)) return false;
        if (equipment?.length && e.equipment && !equipment.includes(e.equipment)) return false;
        if (avAxial && isAxialLoadExercise(e as any)) return false;
        if (isRearDeltExercise(e.name) && (bestSlot.session.sessionTag || '').toLowerCase().includes('push')) return false;
        return true;
      });
      if (!feederPool.length) continue;
      // Р‘РµСЂС‘Рј СЃР°РјРѕРµ РєРѕСЂРѕС‚РєРѕРµ (РјРёРЅРёРјРёР·РёСЂСѓРµРј РІСЂРµРјСЏ) РёР·РѕР»СЏС†РёРѕРЅРЅРѕРµ СѓРїСЂР°Р¶РЅРµРЅРёРµ
      feederPool.sort((a, b) => (a.name?.length || 0) - (b.name?.length || 0));
      const fData = feederPool[0];
      const fName = fData.name || fData.id;
      const fBase = (workMax as any)[wp] || DEFAULT_WORKMAX[wp] || 50;
      const feederWeight = Math.max(5, Math.round(fBase * 0.3 * 10) / 10);
  const fTempo = tempoFor('РїР°РјРї', undefined, phaseByWeek?.get(weeks[bestSlot.weekIdx].week) || 'accumulation');
  const feederSetCount = 2;
  bestSlot.session.exercises.push({
        muscle: wp, name: fName, role: 'accessory' as const, character: 'РїР°РјРї' as DayCharacter,
        sets: feederSetCount, repsRange: [15, 20] as [number, number], rir: 3,
        workSets: Array.from({ length: feederSetCount }, () => ({ reps: 18, rir: 3, weight: feederWeight, tempo: fTempo.notation, restSeconds: 30 })),
        exerciseName: fName, tempoSpec: fTempo.notation, restSeconds: 30,
        comment: `Cross-day weak-point feeder РґР»СЏ ${wp}: 2Г—15-20 RIR 3 @${feederWeight}РєРі, РґРѕР±РёРІРѕС‡РЅС‹Р№ РїР°РјРї-СЃРµС‚ РІ Р±Р»РёР¶Р°Р№С€РµРј СЂРµР»РµРІР°РЅС‚РЅРѕРј РґРЅРµ (РЅРµРґРµР»СЊРЅС‹Р№ РѕР±СЉС‘Рј < MEV ${targetMEV}).`,
        warmupSets: [], rationale: 'Weak-point coverage: РІСЃС‚Р°РІРєР° feeder-СЃРµС‚РѕРІ, С‡С‚РѕР±С‹ РґРѕСЃС‚РёС‡СЊ MEV.',
      });
      usedAcrossWeeks.add(`${bestSlot.weekIdx}|${bestSlot.sessionIdx}|${wp}`);
    } // for wi
  } // for wpRaw
  return { ...plan, weeks };
}

/* в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ РџСЂРёРјРµРЅРµРЅРёРµ РјР°РєСЂРѕС†РёРєР»Р° Рє Р‘Р‘-РїР»Р°РЅСѓ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */

/**
 * РџСЂРёРјРµРЅРёС‚СЊ С„Р°Р·С‹ РјР°РєСЂРѕС†РёРєР»Р° (5 С„Р°Р·: endurance/strength/peak/competition/transition)
 * Рє СЃСѓС‰РµСЃС‚РІСѓСЋС‰РµРјСѓ BBPlan. РџРµСЂРµСЂР°СЃРїСЂРµРґРµР»СЏРµС‚ РѕР±СЉС‘Рј/РёРЅС‚РµРЅСЃРёРІРЅРѕСЃС‚СЊ РїРѕ РЅРµРґРµР»СЏРј.
 *
 * Р›РѕРіРёРєР°:
 *  - Р”Р»СЏ РєР°Р¶РґРѕР№ РЅРµРґРµР»Рё РїР»Р°РЅР° РЅР°С…РѕРґРёРј РјР°РєСЂРѕ-Р±Р»РѕРє (РїРѕ weekOffset+weeks).
 *  - РњР°РїРїРёРј MacroPhase в†’ BBPhase С‡РµСЂРµР· phase-bridge (enduranceв†’accumulation, Рё С‚.Рґ.).
 *  - РџСЂРёРјРµРЅСЏРµРј getPhaseVolumeMult() Рє РєРѕР»-РІСѓ СЃРµС‚РѕРІ РЅР° СѓРїСЂР°Р¶РЅРµРЅРёРµ.
 *  - РљРѕСЂСЂРµРєС‚РёСЂСѓРµРј RIR: competition/peaking в†’ RIRв†’0-1, transition/deload в†’ +3, РѕСЃС‚Р°Р»СЊРЅС‹Рµ в†’ Р±Р°Р·РѕРІС‹Р№.
 *  - РљРѕСЂСЂРµРєС‚РёСЂСѓРµРј deload-С„Р»Р°Рі: transition/deload в†’ deload=true.
 *  - Р’РѕР·РІСЂР°С‰Р°РµРј РќРћР’Р«Р™ РїР»Р°РЅ (immutable). РЎС‚Р°СЂС‹Р№ РЅРµ С‚СЂРѕРіР°РµРј.
 */
export function applyMacrocycleToBBPlan(plan: BBPlan, macro: Macrocycle | BBMacrocycle): BBPlan {
  if (!macro?.blocks || macro.blocks.length === 0 || plan.weeks.length === 0) return plan;

  const isBbMacro = 'trainingFocus' in macro;
  if (isBbMacro) {
    return applyBbMacroToBBPlan(plan, macro as BBMacrocycle);
  }

  // PL-РјР°РєСЂРѕС†РёРєР» (Macrocycle, 5 С„Р°Р·)
  const findBlockForWeek = (weekNum: number) => {
    for (const block of macro.blocks) {
      if (weekNum >= block.weekOffset && weekNum < block.weekOffset + block.weeks) return block;
    }
    return null;
  };

  const macroPhaseToBBPhase: Record<MacroPhase, BBPhase> = {
    endurance: 'accumulation',
    strength: 'intensification',
    peak: 'peaking',
    competition: 'peaking',
    transition: 'deload',
  };

  const newWeeks = plan.weeks.map((wk, wi) => {
    const weekNum = wi + 1;
    const block = findBlockForWeek(weekNum);
    if (!block) return wk;
    const bbPhase: BBPhase = macroPhaseToBBPhase[block.phase] ?? 'accumulation';
    const volMult = getPhaseVolumeMult(bbPhase);
    const isDeload = bbPhase === 'deload';
    const blockWeek = weekNum - block.weekOffset + 1;
    const periodicDeload = !isDeload
      && (block.phase === 'endurance' || block.phase === 'strength')
      && blockWeek % 4 === 0;
    const rirShift = bbPhase === 'peaking' ? -2 : bbPhase === 'deload' ? +3 : 0;
    const sessions = wk.sessions.map((ses) => ({
      ...ses,
      exercises: ses.exercises.map((ex) => {
        const effectiveVolMult = periodicDeload ? volMult * 0.6 : volMult;
        const effectiveRirShift = periodicDeload ? Math.max(rirShift, 2) : rirShift;
        const targetSets = Math.max(1, Math.round((ex.sets || 0) * effectiveVolMult));
        const newRir = Math.max(0, Math.min(5, (ex.rir ?? 2) + effectiveRirShift));
        const workSets = Array.from({ length: targetSets }, (_, i) => {
          const src = ex.workSets[i];
          if (src) {
            return { ...src, rir: Math.max(0, Math.min(5, (src.rir ?? 2) + effectiveRirShift)) };
          }
          const tpl = ex.workSets[0] ?? { reps: 8, rir: 2, weight: 0, restSeconds: 90 };
          return { ...tpl, rir: Math.max(0, Math.min(5, (tpl.rir ?? 2) + effectiveRirShift)) };
        });
        return {
          ...ex,
          sets: targetSets,
          rir: newRir,
          workSets,
        };
      }).filter((ex) => !(block.phase === 'competition' && ex.role !== 'primary')),
    }));
    return { ...wk, deload: isDeload || periodicDeload, sessions };
  });

  const phaseList = macro.blocks.map(b => `${b.phase}Г—${b.weeks}`).join(' в†’ ');
  const newRationale = [...(plan.rationale ?? []), `РњР°РєСЂРѕС†РёРєР» РїСЂРёРјРµРЅС‘РЅ: ${phaseList} (С„Р°Р·С‹ РјР°РїРїРёСЂРѕРІР°РЅС‹, РѕР±СЉС‘Рј Г— ${getPhaseVolumeMult('accumulation')}/${getPhaseVolumeMult('intensification')}/${getPhaseVolumeMult('peaking')}/${getPhaseVolumeMult('deload')})`];

  return { ...plan, weeks: newWeeks, rationale: newRationale };
}

/**
 * BB-РјР°РєСЂРѕС†РёРєР» в†’ BBPlan. РџСЂРёРјРµРЅСЏРµС‚ BB-СЃРїРµС†РёС„РёС‡РЅС‹Рµ volume mult Рё RIR.
 */
function applyBbMacroToBBPlan(plan: BBPlan, macro: BBMacrocycle): BBPlan {
  const BB_VOLUME = {
    hypertrophy:   { compound: 1.0,  accessory: 1.0 },
    strength:      { compound: 0.85, accessory: 0.8 },
    contest_prep:  { compound: 0.5,  accessory: 0.3 },
    transition:    { compound: 0.5,  accessory: 0.3 },
  };
  const BB_RIR = {
    hypertrophy:  { compound: [2, 3] as [number, number], accessory: [3, 4] as [number, number] },
    strength:     { compound: [1, 2] as [number, number], accessory: [2, 3] as [number, number] },
    contest_prep: { compound: [0, 1] as [number, number], accessory: [1, 2] as [number, number] },
    transition:   { compound: [3, 4] as [number, number], accessory: [4, 5] as [number, number] },
  };

  const findBlockForWeek = (weekNum: number) => {
    for (const block of macro.blocks) {
      if (weekNum >= block.weekOffset && weekNum < block.weekOffset + block.weeks) return block;
    }
    return null;
  };

  const newWeeks = plan.weeks.map((wk, wi) => {
    const weekNum = wi + 1;
    const block = findBlockForWeek(weekNum);
    if (!block) return wk;

    const volC = BB_VOLUME[block.phase].compound;
    const volA = BB_VOLUME[block.phase].accessory;
    const [compRirMin] = BB_RIR[block.phase].compound;
    const [accRirMin] = BB_RIR[block.phase].accessory;

    const isDeload = block.phase === 'transition';
    const blockWeek = weekNum - block.weekOffset + 1;
    const periodicDeload = !isDeload
      && (block.phase === 'hypertrophy' || block.phase === 'strength')
      && blockWeek % 4 === 0;

    const sessions = wk.sessions.map((ses) => ({
      ...ses,
      exercises: ses.exercises.map((ex) => {
        const isCompound = ex.role === 'primary';
        const effectiveVol = periodicDeload
          ? (isCompound ? volC * 0.6 : volA * 0.6)
          : (isCompound ? volC : volA);

        const targetSets = Math.max(1, Math.round((ex.sets || 0) * effectiveVol));
        const targetRir = Math.max(0, Math.min(5, isCompound ? compRirMin : accRirMin));

        const workSets = Array.from({ length: targetSets }, (_, i) => {
          const src = ex.workSets[i];
          if (src) return { ...src, rir: targetRir };
          const tpl = ex.workSets[0] ?? { reps: 8, rir: 2, weight: 0, restSeconds: 90 };
          return { ...tpl, rir: targetRir };
        });

        if (block.phase === 'contest_prep' && ex.role !== 'primary') return null;

        return {
          ...ex,
          sets: targetSets,
          rir: targetRir,
          workSets,
        };
      }).filter((ex): ex is BBExercise => ex !== null),
    }));

    return { ...wk, deload: isDeload || periodicDeload, sessions };
  });

  const phaseList = macro.blocks.map(b => `${b.phase}Г—${b.weeks}`).join(' в†’ ');
  const newRationale = [...(plan.rationale ?? []), `BB-РјР°РєСЂРѕС†РёРєР» РїСЂРёРјРµРЅС‘РЅ: ${phaseList} (BB-С„Р°Р·С‹, РѕР±СЉС‘Рј Г— ${BB_VOLUME.hypertrophy.compound}/${BB_VOLUME.strength.compound}/${BB_VOLUME.contest_prep.compound}/${BB_VOLUME.transition.compound})`];

  return { ...plan, weeks: newWeeks, rationale: newRationale };
}
