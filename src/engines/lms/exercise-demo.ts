/**
 * exercise-demo.ts — T9: медиа/демо упражнения (браузерно, без тяжёлых ассетов).
 * Агрегирует профиль упражнения из существующих движков (REUSE): exercise-catalog,
 * movement-engines (мышечная синергия/суставы/сложность), genetic-deload-technique
 * (ключи техники/ошибки/прогрессия). + лёгкая inline-SVG карта мышц в UI.
 */
import { getExerciseById, getSubstitutes, EXERCISE_CATALOG } from '../../core/exercise-catalog';
import type { Exercise } from '../../core/types';
import { getMuscleSynergy, getJointStress, estimateDifficulty, type MuscleSynergy, type JointStressProfile, type DifficultyProfile } from '../movement-engines';
import { getCues, getErrorsForExercise, getProgression } from '../genetic-deload-technique.engine';

export interface ExerciseDemo {
  id: string;
  name: string;
  group: string;
  type: string;
  equipment: string;
  difficulty: string;
  targetMuscle?: string;
  technique: string;
  comments?: string;
  pauseSeconds?: number;
  peakContraction?: boolean;
  stretchPhase?: boolean;
  synergy: MuscleSynergy;
  jointStress: JointStressProfile | null;
  difficultyProfile: DifficultyProfile | null;
  cues: ReturnType<typeof getCues>;
  commonErrors: ReturnType<typeof getErrorsForExercise>;
  progression: string[];
  substitutes: string[];
  jointStressLabel: string;
  fatigueCost: number;
}

const GROUP_TO_PRIMARY: Record<string, string[]> = {
  chest: ['pectoralis'], back: ['latissimus','trapezius'], legs: ['quadriceps','gluteus_maximus'],
  shoulders: ['deltoids'], arms: ['biceps','triceps'], core: ['rectus_abdominis'],
};

function fallbackSynergy(ex: Exercise): MuscleSynergy {
  const primary = ex.targetMuscle ? [ex.targetMuscle] : (GROUP_TO_PRIMARY[ex.group] || []);
  return { primary, secondary: [], stabilizers: [], synergists: [], antagonists: [] };
}

/** Получить демо-профиль упражнения по id или имени. */
export function getExerciseDemo(idOrName: string): ExerciseDemo | null {
  let ex = getExerciseById(idOrName);
  if (!ex) {
    const byName = EXERCISE_CATALOG.find(e => e.name.toLowerCase() === idOrName.toLowerCase());
    if (byName) ex = byName;
  }
  if (!ex) return null;

  let synergy = getMuscleSynergy(ex.id);
  if (synergy.primary.length === 0) synergy = fallbackSynergy(ex);

  let jointStress: JointStressProfile | null = null;
  let difficultyProfile: DifficultyProfile | null = null;
  try { jointStress = getJointStress(ex.id); } catch { /* id mismatch — ignore */ }
  try { const d = estimateDifficulty(ex.id); if (d && d.technicalComplexity > 0) difficultyProfile = d; } catch { /* ignore */ }

  const subs = getSubstitutes(ex.id);

  return {
    id: ex.id,
    name: ex.name,
    group: ex.group,
    type: ex.type,
    equipment: ex.equipment,
    difficulty: ex.difficulty,
    targetMuscle: ex.targetMuscle,
    technique: ex.technique || '',
    comments: ex.comments,
    pauseSeconds: ex.pauseSeconds,
    peakContraction: ex.peakContraction,
    stretchPhase: ex.stretchPhase,
    synergy,
    jointStress,
    difficultyProfile,
    cues: getCues(ex.name),
    commonErrors: getErrorsForExercise(ex.name),
    progression: getProgression(ex.name),
    substitutes: subs ? subs.substitutes.map(st => st.id) : [],
    jointStressLabel: ex.jointStress,
    fatigueCost: ex.fatigueCost,
  };
}

/** Список упражнений по группе (для пикера в UI). */
export function listExercisesByGroup(group?: string): { id: string; name: string; group: string }[] {
  const list = group ? EXERCISE_CATALOG.filter(e => e.group === group) : EXERCISE_CATALOG;
  return list.map(e => ({ id: e.id, name: e.name, group: e.group }));
}

/** Нормализация мышц → регион тела для SVG-карты. */
export type BodyRegion = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'other';
export function muscleToRegion(muscle: string): BodyRegion {
  const m = (muscle || '').toLowerCase();
  if (/pectoral|груд|chest/.test(m)) return 'chest';
  if (/latissimus|trapezius|back|спин|широч|трап/.test(m)) return 'back';
  if (/quad|hamstring|glute|leg|ног|ягод|квадр|бицепс бед|икр|calf/.test(m)) return 'legs';
  if (/deltoid|shoulder|плеч/.test(m)) return 'shoulders';
  if (/biceps|triceps|arm|рук|бицепс|трицепс|предплеч/.test(m)) return 'arms';
  if (/abdomin|oblique|core|кор|пресс|transvers/.test(m)) return 'core';
  return 'other';
}
