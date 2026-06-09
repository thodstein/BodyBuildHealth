import type { MovementPattern } from '../core/types';

export interface VariationOption {
  exerciseId: string;
  name: string;
  variationTags: string[];
  targetWeakPoint?: string;
  riskModifier: number;
  techniqueModifier: number;
  equipmentMatch: number;
  score: number;
  rationale: string;
}

const EXERCISE_VARIATIONS: Record<string, { id: string; name: string; tags: string[]; targetWeakPoint?: string; risk: number; technique: number; equipment: string[] }[]> = {
  squat: [
    { id: 'squat', name: 'Приседания со штангой', tags: ['high_bar'], risk: 2, technique: 2, equipment: ['barbell', 'rack'] },
    { id: 'front_squat', name: 'Фронтальные приседания', tags: ['front'], targetWeakPoint: 'quad', risk: 1, technique: 3, equipment: ['barbell', 'rack'] },
    { id: 'squat_ssb', name: 'Приседания ССБ', tags: ['ssb'], targetWeakPoint: 'stability', risk: 1, technique: 1, equipment: ['barbell', 'rack'] },
    { id: 'hack_squat', name: 'Гакк-приседания', tags: ['machine'], targetWeakPoint: 'quad', risk: 1, technique: 1, equipment: ['machine'] },
    { id: 'leg_press', name: 'Жим ногами', tags: ['machine'], targetWeakPoint: 'quad', risk: 1, technique: 0, equipment: ['machine'] },
    { id: 'bulgarian_split', name: 'Болгарские сплит-приседания', tags: ['unilateral', 'dumbbell'], targetWeakPoint: 'stability', risk: 1, technique: 2, equipment: ['dumbbell', 'bench'] },
  ],
  hinge: [
    { id: 'deadlift', name: 'Становая тяга', tags: ['conventional'], risk: 3, technique: 3, equipment: ['barbell'] },
    { id: 'sumo_dl', name: 'Сумо-тяга', tags: ['sumo'], targetWeakPoint: 'hip', risk: 2, technique: 2, equipment: ['barbell'] },
    { id: 'rdl', name: 'Румынская тяга', tags: ['rdl'], targetWeakPoint: 'hamstring', risk: 2, technique: 2, equipment: ['barbell'] },
    { id: 'good_morning', name: 'Гудморнинг', tags: ['good_morning'], targetWeakPoint: 'erector', risk: 3, technique: 3, equipment: ['barbell'] },
    { id: 'hip_thrust', name: 'Ягодичный мост', tags: ['glute'], targetWeakPoint: 'glute', risk: 1, technique: 1, equipment: ['barbell', 'bench'] },
  ],
  horizontal_push: [
    { id: 'bench_bar', name: 'Жим штанги лёжа', tags: ['barbell'], risk: 2, technique: 2, equipment: ['barbell', 'bench'] },
    { id: 'bench_db', name: 'Жим гантелей лёжа', tags: ['dumbbell'], targetWeakPoint: 'stability', risk: 1, technique: 2, equipment: ['dumbbell', 'bench'] },
    { id: 'incline_bar', name: 'Жим на наклонной', tags: ['incline'], targetWeakPoint: 'upper_chest', risk: 2, technique: 2, equipment: ['barbell', 'bench'] },
    { id: 'dips_chest', name: 'Отжимания на брусьях', tags: ['dip'], targetWeakPoint: 'lower_chest', risk: 3, technique: 2, equipment: ['bodyweight'] },
    { id: 'pushup', name: 'Отжимания от пола', tags: ['bodyweight'], risk: 1, technique: 1, equipment: ['bodyweight'] },
  ],
  horizontal_pull: [
    { id: 'row_bar', name: 'Тяга штанги в наклоне', tags: ['barbell'], risk: 2, technique: 2, equipment: ['barbell'] },
    { id: 'row_db', name: 'Тяга гантели одной рукой', tags: ['dumbbell', 'unilateral'], targetWeakPoint: 'stability', risk: 1, technique: 2, equipment: ['dumbbell'] },
    { id: 'seated_row', name: 'Тяга горизонтального блока', tags: ['cable'], risk: 1, technique: 1, equipment: ['cable'] },
    { id: 'row_tbar', name: 'Тяга Т-грифа', tags: ['tbar'], targetWeakPoint: 'mid_back', risk: 2, technique: 2, equipment: ['barbell'] },
  ],
  vertical_push: [
    { id: 'ohp', name: 'Жим стоя', tags: ['barbell'], risk: 2, technique: 2, equipment: ['barbell'] },
    { id: 'ohp_db', name: 'Жим гантелей стоя', tags: ['dumbbell'], targetWeakPoint: 'stability', risk: 1, technique: 2, equipment: ['dumbbell'] },
    { id: 'arnold_press', name: 'Жим Арнольда', tags: ['dumbbell'], targetWeakPoint: 'front_delt', risk: 1, technique: 2, equipment: ['dumbbell'] },
  ],
  vertical_pull: [
    { id: 'pullup', name: 'Подтягивания', tags: ['bodyweight'], risk: 2, technique: 2, equipment: ['bodyweight'] },
    { id: 'pulldown', name: 'Тяга верхнего блока', tags: ['cable'], risk: 1, technique: 1, equipment: ['cable'] },
    { id: 'chinup', name: 'Подтягивания обратным хватом', tags: ['bodyweight'], risk: 2, technique: 2, equipment: ['bodyweight'] },
  ],
  core: [
    { id: 'plank', name: 'Планка', tags: ['isometric'], risk: 1, technique: 1, equipment: ['bodyweight'] },
    { id: 'cable_rotation', name: 'Ротация с кабелем', tags: ['cable', 'rotation'], risk: 1, technique: 2, equipment: ['cable'] },
    { id: 'hanging_leg_raise', name: 'Подъёмы ног в висе', tags: ['bodyweight'], targetWeakPoint: 'lower_abs', risk: 1, technique: 2, equipment: ['bodyweight'] },
  ],
};

const WEAK_POINT_VARIATION_MAP: Record<string, string[]> = {
  offthebottom: ['squat_pause', 'pin_squat'],
  lockout: ['block_pull', 'board_press', 'pin_press'],
  stability: ['tempo_squat', 'ssb_squat', 'db_bench'],
  quad: ['front_squat', 'hack_squat', 'leg_press'],
  hamstring: ['rdl', 'leg_curl', 'good_morning'],
  glute: ['hip_thrust', 'rdl', 'bulgarian_split'],
  upper_chest: ['incline_bar', 'incline_db', 'cable_fly_low'],
  lower_chest: ['dips_chest', 'decline_bar', 'cable_fly'],
  mid_back: ['row_tbar', 'seated_row', 'row_db'],
  rear_delt: ['face_pull', 'rear_delt_fly'],
};

export function selectVariation(
  pattern: MovementPattern,
  weakPoints: string[],
  equipmentAvailable: string[],
  riskFlags: Record<string, string>,
  techniqueIssues: string[]
): VariationOption {
  const baseExercises = EXERCISE_VARIATIONS[pattern];
  if (!baseExercises || baseExercises.length === 0) {
    return { exerciseId: 'unknown', name: 'Неизвестно', variationTags: [], score: 0, riskModifier: 0, techniqueModifier: 0, equipmentMatch: 0, rationale: 'Нет доступных вариаций' };
  }

  const candidates: VariationOption[] = [];

  for (const ex of baseExercises) {
    let score = 50;
    const rationale: string[] = [];

    const equipMatch = ex.equipment.every(e => equipmentAvailable.includes(e));
    if (!equipMatch) { score -= 30; rationale.push('Нет оборудования'); }
    else { score += 20; rationale.push('Оборудование доступно'); }

    if (riskFlags) {
      const hasHighRisk = Object.values(riskFlags).some(v => v === 'high');
      if (hasHighRisk && ex.risk >= 2) { score -= 20; rationale.push('Высокий риск — не рекомендуется'); }
      else if (hasHighRisk && ex.risk <= 1) { score += 10; rationale.push('Безопасная вариация'); }
    }

    if (techniqueIssues.length > 0 && ex.technique >= 2) {
      score -= 15; rationale.push('Сложная техника — не рекомендуется');
    }

    if (weakPoints.length > 0) {
      const matched = weakPoints.some(wp => {
        const variations = WEAK_POINT_VARIATION_MAP[wp] || [];
        return variations.some(v => ex.tags.includes(v));
      });
      if (matched) { score += 30; rationale.push('Компенсирует слабое место'); }
      if (ex.targetWeakPoint && weakPoints.includes(ex.targetWeakPoint)) { score += 20; rationale.push(`Целевая работа над ${ex.targetWeakPoint}`); }
    }

    candidates.push({
      exerciseId: ex.id,
      name: ex.name,
      variationTags: ex.tags,
      targetWeakPoint: ex.targetWeakPoint,
      riskModifier: ex.risk,
      techniqueModifier: ex.technique,
      equipmentMatch: equipMatch ? 1 : 0,
      score,
      rationale: rationale.join('; '),
    });
  }

  return candidates.sort((a, b) => b.score - a.score)[0];
}
