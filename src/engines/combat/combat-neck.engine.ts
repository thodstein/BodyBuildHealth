/**
 * combat-neck.engine.ts — шея 2.0 для единоборств (мультипланарная, Collins 2014, BJSM Delphi 2025, UFC PI Matrix).
 * Источники: Collins +1lb=-5% concussion (J Primary Prevention), Fownes-Walpole 2025 BJSM systematic review,
 * Iron Neck multi-directional, UFC PI Neck Matrix (4 типа силы).
 * Изолировано.
 */
export type NeckPlane = 'flexion' | 'extension' | 'lateral' | 'rotation';
export type NeckMode = 'isometric' | 'dynamic' | 'eccentric' | 'pre_activation';

export interface NeckExercise {
  id: string;
  plane: NeckPlane;
  mode: NeckMode;
  sets: number;
  reps: string;
  rest: number;
  cue: string;
  rpe?: number;
}

export interface NeckLevelProg {
  level: number; // 1-4
  exercises: NeckExercise[];
  frequencyPerWeek: number;
  collinsNote: string;
}

const NECK_EXERCISES: Record<string, { name: string; plane: NeckPlane; mode: NeckMode }> = {
  neck_harness_ext: { name: 'Шея с упряжью (разгибание)', plane: 'extension', mode: 'dynamic' },
  neck_flexion: { name: 'Шея сгибание (кивок)', plane: 'flexion', mode: 'dynamic' },
  neck_lateral_flex: { name: 'Шея боковая', plane: 'lateral', mode: 'dynamic' },
  neck_rotation: { name: 'Шея ротация с резинкой', plane: 'rotation', mode: 'dynamic' },
  neck_bridge_wrestler: { name: 'Борцовский мост', plane: 'extension', mode: 'isometric' },
  neck_isometric_front: { name: 'Изометрия шеи фронтальная (стена/рука)', plane: 'flexion', mode: 'isometric' },
  neck_isometric_back: { name: 'Изометрия затылок (стена)', plane: 'extension', mode: 'isometric' },
  neck_isometric_side: { name: 'Изометрия боковая', plane: 'lateral', mode: 'isometric' },
  neck_band_rotation_isometric: { name: 'Ротация изометрия с резинкой', plane: 'rotation', mode: 'isometric' },
  neck_eccentric_flexion: { name: 'Эксцентрика шеи (медленно 3с)', plane: 'flexion', mode: 'eccentric' },
  neck_harness_rotation: { name: 'Шея ротация с упряжью', plane: 'rotation', mode: 'dynamic' },
};

export function getNeckMeta(id: string) { return NECK_EXERCISES[id] || null; }

export const NECK_IDS = Object.keys(NECK_EXERCISES);

const NECK_LEVELS: Record<number, NeckLevelProg> = {
  1: {
    level: 1,
    frequencyPerWeek: 2,
    collinsNote: 'Collins: +1 фунт (+0.45кг) = −5% риск сотрясения. Уровень 1: база изометрии 2×/нед, все 4 плоскости.',
    exercises: [
      { id: 'neck_isometric_front', plane: 'flexion', mode: 'isometric', sets: 2, reps: '20с', rest: 45, cue: 'Стена/ладонь, подбородок втянут, 50% усилия', rpe: 6 },
      { id: 'neck_isometric_back', plane: 'extension', mode: 'isometric', sets: 2, reps: '20с', rest: 45, cue: 'Затылок в стену, без прогиба', rpe: 6 },
      { id: 'neck_isometric_side', plane: 'lateral', mode: 'isometric', sets: 2, reps: '15с/стор', rest: 45, cue: 'Ладонь на висок, ухо к плечу без наклона корпуса', rpe: 6 },
      { id: 'neck_band_rotation_isometric', plane: 'rotation', mode: 'isometric', sets: 2, reps: '15с/стор', rest: 45, cue: 'Резинка за голову, взгляд вперёд, анти-ротация', rpe: 6 },
    ],
  },
  2: {
    level: 2,
    frequencyPerWeek: 3,
    collinsNote: 'Collins +1фунт=−5% сотряс: уровень 2 — динамика 3×/нед — 12-20 повт, 2с пауза, эксцентрика 2с.',
    exercises: [
      { id: 'neck_harness_ext', plane: 'extension', mode: 'dynamic', sets: 3, reps: '12-15', rest: 60, cue: 'Упряжь 5-10кг, без рывков, подбородок втянут', rpe: 7 },
      { id: 'neck_flexion', plane: 'flexion', mode: 'dynamic', sets: 3, reps: '12-15', rest: 60, cue: 'Диск/резинка, кивок 2-1-2', rpe: 7 },
      { id: 'neck_lateral_flex', plane: 'lateral', mode: 'dynamic', sets: 2, reps: '12/стор', rest: 60, cue: 'Гантель/резинка, ухо к плечу', rpe: 7 },
      { id: 'neck_band_rotation_isometric', plane: 'rotation', mode: 'isometric', sets: 3, reps: '20с/стор', rest: 45, cue: 'Анти-ротация, кор жёстко', rpe: 7 },
    ],
  },
  3: {
    level: 3,
    frequencyPerWeek: 3,
    collinsNote: 'Уровень 3: Iron Neck-подобная мульти-направленность + эксцентрика 3с, pre-activation перед спаррингом.',
    exercises: [
      { id: 'neck_harness_ext', plane: 'extension', mode: 'dynamic', sets: 3, reps: '10-12', rest: 60, cue: '10-15кг, 3с эксцентрика', rpe: 8 },
      { id: 'neck_eccentric_flexion', plane: 'flexion', mode: 'eccentric', sets: 3, reps: '8-10 (3с вниз)', rest: 60, cue: 'Медленно 3с вниз, пауза 1с', rpe: 8 },
      { id: 'neck_lateral_flex', plane: 'lateral', mode: 'dynamic', sets: 3, reps: '10/стор', rest: 60, cue: 'С паузой 1с вверху', rpe: 8 },
      { id: 'neck_harness_rotation', plane: 'rotation', mode: 'dynamic', sets: 2, reps: '10/стор', rest: 60, cue: 'Упряжь/резинка, ротация 180° контроль', rpe: 8 },
      { id: 'neck_isometric_front', plane: 'flexion', mode: 'pre_activation', sets: 1, reps: '10с ×2', rest: 30, cue: 'Pre-activation перед спаррингом: 50% ×10с фронтально', rpe: 6 },
    ],
  },
  4: {
    level: 4,
    frequencyPerWeek: 3,
    collinsNote: 'Уровень 4: advanced — борцовский мост + изометрия+динамика суперсет, Iron Neck 360°.',
    exercises: [
      { id: 'neck_bridge_wrestler', plane: 'extension', mode: 'isometric', sets: 3, reps: '20-30с', rest: 75, cue: 'Мост только продвинутым: контроль, без рывка', rpe: 8 },
      { id: 'neck_harness_ext', plane: 'extension', mode: 'dynamic', sets: 3, reps: '8-12', rest: 60, cue: 'Суперсет с изометрией боковой', rpe: 8 },
      { id: 'neck_isometric_side', plane: 'lateral', mode: 'isometric', sets: 3, reps: '20с/стор', rest: 45, cue: 'Боковая + ротация анти', rpe: 8 },
      { id: 'neck_harness_rotation', plane: 'rotation', mode: 'dynamic', sets: 3, reps: '8/стор', rest: 60, cue: '360° контроль', rpe: 8 },
      { id: 'neck_eccentric_flexion', plane: 'flexion', mode: 'eccentric', sets: 2, reps: '8 (3с)', rest: 60, cue: 'Эксцентрика 3с', rpe: 8 },
    ],
  },
};

export function neckProgressionFor(level: number): NeckLevelProg {
  const l = Math.max(1, Math.min(4, Math.round(level)));
  return NECK_LEVELS[l] || NECK_LEVELS[1];
}

export function neckWeeklyPlan(trainingLevel: string, week?: number, phase?: string): NeckExercise[] {
  const base = trainingLevel === 'beginner' ? 1 : trainingLevel === 'intermediate' ? 2 : trainingLevel === 'advanced' ? 3 : 4;
  const phaseLvl = phase === 'accumulation' || phase === 'gpp' ? base : phase === 'transmutation' || phase === 'power' ? Math.min(4, base + 0) : phase === 'realization' || phase === 'taper' ? Math.max(1, base - 1) : base;
  const prog = neckProgressionFor(phaseLvl);
  return prog.exercises;
}

export function neckVolumeCheck(weekExerciseIds: string[]): { flexion: number; extension: number; lateral: number; rotation: number; ok: boolean; modes: Record<NeckMode, number> } {
  const flexion = weekExerciseIds.filter(id => ['neck_flexion','neck_isometric_front','neck_eccentric_flexion'].includes(id)).length;
  const extension = weekExerciseIds.filter(id => ['neck_harness_ext','neck_bridge_wrestler','neck_isometric_back'].includes(id)).length;
  const lateral = weekExerciseIds.filter(id => ['neck_lateral_flex','neck_isometric_side'].includes(id)).length;
  const rotation = weekExerciseIds.filter(id => ['neck_rotation','neck_harness_rotation','neck_band_rotation_isometric'].includes(id)).length;
  const modes: Record<NeckMode, number> = { isometric: 0, dynamic: 0, eccentric: 0, pre_activation: 0 };
  for (const id of weekExerciseIds) {
    const m = NECK_EXERCISES[id];
    if (m) modes[m.mode] = (modes[m.mode] || 0) + 1;
  }
  const ok = flexion >= 1 && extension >= 1 && lateral >= 1 && rotation >= 1;
  return { flexion, extension, lateral, rotation, ok, modes };
}

export function collinsNoteForLevel(level: number): string {
  return neckProgressionFor(level).collinsNote;
}

export function ufcNeckMatrixCategory(id: string): string {
  const m = NECK_EXERCISES[id];
  if (!m) return 'general';
  if (m.mode === 'isometric') return 'Isometric Strength (UFC: Bracing)';
  if (m.mode === 'eccentric') return 'Eccentric Control (UFC: Deceleration)';
  if (m.plane === 'rotation') return 'Rotational Power (UFC: Whip)';
  return 'Dynamic Strength (UFC: Stabilization)';
}
