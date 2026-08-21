/** Builds coach-facing execution notes from the Exercise Lab databases. */
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { getExerciseBio, type ExerciseBio } from '../../data/exercise-biomechanics-db';
import { getMappedBioId, getMappedIds } from '../../data/exercise-id-mapping';
import { getTargetMuscleForExercise, TARGET_MUSCLE_DB, type TargetMuscleEntry } from '../../data/target-muscle-db';

export interface ExerciseInstructionInput {
  exerciseId?: string;
  exerciseName: string;
  muscle?: string;
  role?: 'primary' | 'accessory';
  phase?: string;
  trainingFocus?: 'strength' | 'hypertrophy' | 'endurance';
  /** Уровень спортсмена — адаптирует темп/технику (новичок: безопаснее, продвинутый: про-кью). */
  level?: string;
  tempo?: string;
  restSeconds?: number;
  orderIndex?: number;
  totalExercises?: number;
  intensityTechnique?: string;
}

export interface ExerciseInstructionProfile {
  pattern: string;
  cues: string[];
  stretch?: string;
  peak?: string;
  mmc?: string;
  tempo: string;
  restSeconds?: number;
  order: string;
  progression: string;
  mistakes: string[];
  intensityTechnique?: string;
  source: 'exercise-lab' | 'catalog' | 'generic';
}

const EXERCISE_ID_ALIASES: Record<string, string> = {
  pull_down_wide: 'pulldown_wide',
  lat_pulldown_wide: 'pulldown_wide',
  incline_bench: 'incline_bar',
};

const PATTERN_RU: Record<string, string> = {
  vertical_pull: 'вертикальная тяга',
  horizontal_pull: 'горизонтальная тяга',
  horizontal_push: 'горизонтальный жим',
  vertical_push: 'вертикальный жим',
  squat: 'приседательный паттерн',
  hinge: 'тазобедренный шарнир',
  knee_flexion: 'сгибание колена',
  hip_extension: 'разгибание бедра',
  shoulder_abduction: 'отведение плеча',
  elbow_flexion: 'сгибание локтя',
  elbow_extension: 'разгибание локтя',
};

function findBio(input: ExerciseInstructionInput): { bio?: ExerciseBio; target?: TargetMuscleEntry; id?: string } {
  const catalog = input.exerciseId
    ? EXERCISE_CATALOG.find(e => e.id === input.exerciseId)
    : EXERCISE_CATALOG.find(e => e.name.toLowerCase() === input.exerciseName.toLowerCase());
  const id = input.exerciseId || catalog?.id;
  const resolvedId = id ? (EXERCISE_ID_ALIASES[id] || id) : undefined;
  const mapped = resolvedId ? getMappedBioId(resolvedId) : undefined;
  const bio = (mapped ? getExerciseBio(mapped) : undefined) || (resolvedId ? getExerciseBio(resolvedId) : undefined);
  const targetId = id && getTargetMuscleForExercise(id) ? id : resolvedId;
  let target = targetId ? getTargetMuscleForExercise(targetId) : undefined;
  if (!target && targetId) {
    target = Object.values(TARGET_MUSCLE_DB).find(entry => entry.exerciseMask.includes(targetId));
  }
  return { bio, target, id: resolvedId };
}

function catalogInstruction(input: ExerciseInstructionInput, id?: string) {
  const entry = EXERCISE_CATALOG.find(e => e.id === id || e.name.toLowerCase() === input.exerciseName.toLowerCase());
  if (!entry) return undefined;
  return {
    pattern: PATTERN_RU[entry.movementPattern || ''] || entry.movementPattern || entry.group,
    cues: entry.technique ? [entry.technique] : [],
    stretch: entry.stretchPhase ? 'Контролируйте растяжение в нижней точке без потери положения суставов.' : undefined,
    peak: entry.peakContraction ? 'В конечной точке удерживайте максимальное сокращение 1 сек.' : undefined,
    mistakes: entry.comments ? [entry.comments] : [],
  };
}

function defaultTempo(focus?: ExerciseInstructionInput['trainingFocus'], level?: string): string {
  const lvl = (level || '').toLowerCase();
  // Новичок: более медленный, контролируемый темп (безопаснее). Продвинутый: стандарт.
  if (lvl === 'beginner' || lvl === 'новичок') return focus === 'strength' ? '3-0-2-0' : focus === 'endurance' ? '3-0-3-0' : '3-1-2-1';
  return focus === 'strength' ? '2-0-1-0' : focus === 'endurance' ? '2-0-2-0' : '3-1-1-1';
}

function orderLabel(input: ExerciseInstructionInput): string {
  if (input.role === 'primary' && (input.orderIndex == null || input.orderIndex === 0)) return 'первое основное упражнение дня';
  if (input.role === 'primary') return 'основное упражнение после первого движения';
  if (input.intensityTechnique) return 'добивочное упражнение после базовых движений';
  return 'добивочное упражнение в конце блока мышцы';
}

/** Returns detailed instructions suitable for BBPlan.comment and exports. */
export function buildExerciseInstructions(input: ExerciseInstructionInput): ExerciseInstructionProfile {
  const { bio, target, id } = findBio(input);
  const catalog = catalogInstruction(input, id);
  const pattern = PATTERN_RU[bio?.pattern || ''] || PATTERN_RU[catalog?.pattern || ''] || bio?.pattern || catalog?.pattern || input.muscle || 'силовой паттерн';
  const labCues = [...(bio?.techniqueCues || []), ...(target?.techniqueCues || [])].filter((cue, i, all) => all.indexOf(cue) === i);
  const catalogCue = catalog?.cues?.[0];
  const cues = catalogCue
    ? [...labCues.filter(cue => cue !== catalogCue).slice(0, 4), catalogCue]
    : labCues.slice(0, 5);
  const tempo = input.tempo || target?.tempoRecommendation || defaultTempo(input.trainingFocus, input.level);
  const order = orderLabel(input);
  const lvl = (input.level || '').toLowerCase();
  const progression = input.trainingFocus === 'strength'
    ? 'Повышайте вес после выполнения всех сетов в верхней границе повторов при заданном RIR.'
    : lvl === 'beginner' || lvl === 'новичок'
      ? 'Сначала освойте технику (темп 3-1-2-1), затем добавляйте повторы до верхней границы, потом повышайте вес минимальным шагом.'
      : 'Сначала добавляйте повторы до верхней границы, затем повышайте вес минимальным шагом.';
  const source = bio || target ? 'exercise-lab' : id || EXERCISE_CATALOG.some(e => e.name === input.exerciseName) ? 'catalog' : 'generic';
  return {
    pattern,
    cues,
    stretch: target?.stretchKey || catalog?.stretch,
    peak: target?.peakKey || catalog?.peak,
    mmc: target?.mmc,
    tempo,
    restSeconds: input.restSeconds,
    order,
    progression,
    mistakes: [...(target?.commonMistakes || []), ...(catalog?.mistakes || [])].slice(0, 4),
    intensityTechnique: input.intensityTechnique,
    source: bio || target ? 'exercise-lab' : catalog ? 'catalog' : source,
  };
}

export function formatExerciseInstructions(input: ExerciseInstructionInput): string {
  const p = buildExerciseInstructions(input);
  const parts = [`Паттерн: ${p.pattern}`, `Порядок: ${p.order}`];
  if (p.cues.length) parts.push(`Техника: ${p.cues.join('; ')}`);
  if (p.stretch) parts.push(`Растяжение: ${p.stretch}`);
  if (p.peak) parts.push(`Пиковое напряжение: ${p.peak}`);
  if (p.mmc) parts.push(`Связь мышца-мозг: ${p.mmc}`);
  parts.push(`Темп: ${p.tempo}${p.restSeconds ? `, отдых ${p.restSeconds} сек` : ''}`);
  if (p.intensityTechnique) parts.push(`Техника интенсивности: ${p.intensityTechnique}`);
  parts.push(`Прогрессия: ${p.progression}`);
  if (p.mistakes.length) parts.push(`Ошибки: ${p.mistakes.slice(0, 3).join('; ')}`);
  return parts.join('. ') + '.';
}
