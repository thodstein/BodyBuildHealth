/**
 * exercise-selector.engine.ts — Интеллектуальный отбор упражнений.
 *
 * Вместо тупой сортировки по скору выбирает оптимальный сет упражнений
 * с учётом: покрытия слабых зон, разнообразия углов, суставной безопасности,
 * баланса тяни/толкай, отсутствия дублирования паттернов, доступного оборудования.
 */
import type { Exercise } from '../core/types';
import { getExerciseById } from '../core/exercise-catalog';

export interface SelectorInput {
  /** Доступные упражнения (уже отфильтрованные по группе мышц) */
  candidates: Exercise[];
  /** Целевая группа мышц */
  muscleGroup: string;
  /** Сколько упражнений нужно выбрать */
  count: number;
  /** Уже выбранные упражнения (для избегания конфликтов) */
  selectedIds: string[];
  /** Доступное оборудование */
  equipment: string[];
  /** Слабые зоны (пауза внизу, замок и т.д.) */
  weakZones?: string[];
  /** Уровень */
  level: string;
  /** Профиль травм (плечо, колено, спина) */
  injuryProfile?: string[];
  /** Тип: compound, isolation, или any */
  type?: 'compound' | 'isolation' | 'any';
}

export interface SelectedExercise extends Exercise {
  selectionScore: number;
  selectionRationale: string[];
}

/** Силовая кривая: определяет слабые зоны по группе мышц */
function getWeakZonesForGroup(group: string, weakZones: string[]): string[] {
  const zoneMap: Record<string, string[]> = {
    chest:  ['stretch', 'mid_range', 'lockout'],
    back:   ['stretch', 'mid_range', 'contraction'],
    legs:   ['bottom', 'mid_range', 'lockout'],
    quads:  ['bottom', 'stretch'],
    hamstrings: ['stretch', 'contraction'],
    glutes: ['bottom', 'lockout'],
    shoulders: ['stretch', 'lockout'],
    arms:   ['stretch', 'contraction'],
    biceps: ['stretch', 'contraction'],
    triceps: ['stretch', 'lockout'],
  };
  return (zoneMap[group] || ['mid_range']).filter(z => weakZones.includes(z));
}

/** Плоскость движения упражнения */
function getExercisePlane(ex: Exercise): 'horizontal_push' | 'vertical_push' | 'horizontal_pull' | 'vertical_pull' | 'squat' | 'hinge' | 'carry' | 'isolation' {
  const name = (ex.name || '').toLowerCase();
  const id = (ex.id || '').toLowerCase();
  if (id.includes('squat') || name.includes('присед') || name.includes('press') || name.includes('жим ног')) return 'squat';
  if (id.includes('deadlift') || name.includes('тяга') && (name.includes('станов') || name.includes('мертв')) || name.includes('рум') || name.includes('good morning')) return 'hinge';
  if (id.includes('bench') || name.includes('жим') && (name.includes('лёжа') || name.includes('гантел') || name.includes('штанг')) || name.includes('push') && !name.includes('pull')) return 'horizontal_push';
  if (id.includes('ohp') || name.includes('жим') && (name.includes('стоя') || name.includes('сидя') || name.includes('армей')) || name.includes('вертика')) return 'vertical_push';
  if (name.includes('тяга') && (name.includes('гориз') || name.includes('штан') || name.includes('гантел') || name.includes('блок') || name.includes('канат'))) return 'horizontal_pull';
  if (name.includes('тяга') && (name.includes('вертика') || name.includes('верх') || name.includes('подтяг'))) return 'vertical_pull';
  return 'isolation';
}

/** Оценить конфликтность с уже выбранными упражнениями */
function patternConflictScore(ex: Exercise, selected: Exercise[]): number {
  const plane = getExercisePlane(ex);
  const selectedPlanes = selected.map(getExercisePlane);
  const sameCount = selectedPlanes.filter(p => p === plane).length;
  // Штраф за дублирование одного и того же паттерна
  if (sameCount >= 2) return -30;
  if (sameCount >= 1) return -10;
  return 0;
}

/** Оценить суставную безопасность */
function jointSafetyScore(ex: Exercise, injuryProfile: string[]): number {
  if (!injuryProfile || injuryProfile.length === 0) return 0;
  const exName = (ex.name || '').toLowerCase();
  const exId = (ex.id || '').toLowerCase();
  let penalty = 0;

  if (injuryProfile.includes('shoulder') || injuryProfile.includes('плеч')) {
    if (exId.includes('behind_neck') || exId.includes('french_press') || exName.includes('франц') || exName.includes('за голов')) penalty -= 20;
    // Жимовые вариации с гантелями менее травматичны для плеч
    if (exName.includes('жим') && exName.includes('гантел')) penalty += 5;
  }
  if (injuryProfile.includes('knee') || injuryProfile.includes('колен')) {
    if (exId.includes('leg_extension') || exName.includes('разгибан') || exName.includes('экстенз')) penalty -= 15;
    // Приседания со штангой vs фронтальные
    if (exName.includes('присед') && exName.includes('фронт')) penalty += 10;
  }
  if (injuryProfile.includes('back') || injuryProfile.includes('спин') || injuryProfile.includes('поясн')) {
    if (exId.includes('good_morning') || exName.includes('наклоны') && exName.includes('штанг')) penalty -= 20;
    if (exName.includes('румын')) penalty -= 10;
    if (exName.includes('тяга') && (exName.includes('блок') || exName.includes('гантел')) && !exName.includes('станов')) penalty += 5;
  }
  return penalty;
}

/** Оценить покрытие слабой зоны */
function weakZoneScore(ex: Exercise, group: string, weakZones: string[]): number {
  if (!weakZones || weakZones.length === 0) return 0;
  const exName = (ex.name || '').toLowerCase();
  const exId = (ex.id || '').toLowerCase();
  let score = 0;

  // Определяем какие зоны покрывает упражнение
  const weakForGroup = getWeakZonesForGroup(group, weakZones);

  // Stretch (растянутое положение)
  if (weakForGroup.includes('stretch') || weakForGroup.includes('bottom')) {
    if (exName.includes('paused') || exName.includes('пауз') || exId.includes('pause') ||
        exName.includes('deep') || exName.includes('глубок') || exName.includes('full_range') ||
        exName.includes('растяж') || exName.includes('stretch')) score += 10;
    // Приседания (дно), жим (низ)
    if (group === 'chest' && (exName.includes('жим') || exName.includes('развод'))) score += 5;
    if (group === 'legs' && (exName.includes('присед') || exName.includes('squat'))) score += 5;
  }
  // Lockout (замыкание)
  if (weakForGroup.includes('lockout')) {
    if (exId.includes('close_grip') || exName.includes('узк') || exName.includes('j' ) ||
        (group === 'triceps' && (exName.includes('франц') || exName.includes('разгибан')))) score += 10;
    if (group === 'legs' && (exName.includes('разгибан') || exName.includes('extension') || exId.includes('leg_extension'))) score += 8;
  }
  // Contraction (пик)
  if (weakForGroup.includes('contraction')) {
    if (exId.includes('cable') || exName.includes('блок') || exName.includes('crossover') ||
        exName.includes('кроссов') || exName.includes('концентр')) score += 8;
  }

  return score;
}

/** Оценить разнообразие углов */
function angleDiversityScore(ex: Exercise, selected: Exercise[], group: string): number {
  if (selected.length === 0) return 5; // первое упражнение — хорошо
  const exName = (ex.name || '').toLowerCase();
  const selectedNames = selected.map(s => (s.name || '').toLowerCase());

  // Определяем угол
  type Angle = 'neutral' | 'incline' | 'decline' | 'flat' | 'vertical';
  const nameToAngle = (n: string): Angle => {
    if (n.includes('incline') || n.includes('наклон') || n.includes('верх')) return 'incline';
    if (n.includes('decline') || n.includes('сниз') || n.includes('ниж')) return 'decline';
    if (n.includes('flat') || n.includes('гориз') || n.includes('лёжа')) return 'flat';
    if (n.includes('vertical') || n.includes('вертика') || n.includes('стоя') || n.includes('сидя')) return 'vertical';
    return 'neutral';
  };
  const angle = nameToAngle(exName);
  const usedAngles = selectedNames.map(n => nameToAngle(n));

  if (usedAngles.includes(angle)) return -5; // дублирование угла
  return 10; // новый угол
}

/** Оценить баланс тяни/толкай */
function pushPullScore(ex: Exercise, selected: Exercise[]): number {
  const plane = getExercisePlane(ex);
  if (plane === 'isolation') return 0;

  const isPush = plane === 'horizontal_push' || plane === 'vertical_push';
  const isPull = plane === 'horizontal_pull' || plane === 'vertical_pull';

  const selectedPushes = selected.filter(s => {
    const p = getExercisePlane(s);
    return p === 'horizontal_push' || p === 'vertical_push';
  }).length;
  const selectedPulls = selected.filter(s => {
    const p = getExercisePlane(s);
    return p === 'horizontal_pull' || p === 'vertical_pull';
  }).length;

  if (isPush && selectedPushes > selectedPulls + 1) return -10;
  if (isPull && selectedPulls > selectedPushes + 1) return -10;
  if (isPush && selectedPushes <= selectedPulls) return 5;
  if (isPull && selectedPulls <= selectedPushes) return 5;
  return 0;
}

/** Главная функция: интеллектуальный отбор N упражнений */
export function selectExercisesSmart(input: SelectorInput): SelectedExercise[] {
  const { candidates, muscleGroup, count, selectedIds, equipment, weakZones, level, injuryProfile, type } = input;

  let pool = candidates.filter(ex => {
    if (!ex || !ex.id) return false;
    if (selectedIds.includes(ex.id)) return false;
    if (type && type !== 'any' && ex.type !== type) return false;
    return true;
  });

  // Если пул пуст — возвращаем candidates без фильтра
  if (pool.length === 0) pool = candidates.filter(ex => ex && ex.id && !selectedIds.includes(ex.id));

  // Скоринг
  const scored = pool.map(ex => {
    const rationales: string[] = [];
    let score = 50; // базовый

    // 1. Покрытие слабой зоны (+0..+15)
    const wz = weakZoneScore(ex, muscleGroup, weakZones || []);
    score += wz;
    if (wz > 0) rationales.push(`Покрывает слабую зону +${wz}`);

    // 2. Разнообразие углов (-5..+10)
    // Нам нужны уже выбранные упражнения — берём из selectedIds
    const alreadySelected = selectedIds.map(id => candidates.find(c => c.id === id)).filter(Boolean) as Exercise[];
    const ad = angleDiversityScore(ex, alreadySelected, muscleGroup);
    score += ad;
    if (ad > 0) rationales.push(`Новый угол +${ad}`);
    else if (ad < 0) rationales.push(`Дублирует угол ${ad}`);

    // 3. Конфликт паттернов (-30..-10..0)
    const pc = patternConflictScore(ex, alreadySelected);
    score += pc;
    if (pc < 0) rationales.push(`Конфликт паттерна ${pc}`);

    // 4. Суставная безопасность (-20..+10)
    const js = jointSafetyScore(ex, injuryProfile || []);
    score += js;
    if (js < 0) rationales.push(`Нагрузка на травму ${js}`);
    else if (js > 0) rationales.push(`Безопасно для травм +${js}`);

    // 5. Баланс тяни/толкай (-10..+5)
    const pp = pushPullScore(ex, alreadySelected);
    score += pp;
    if (pp !== 0) rationales.push(`push/pull ${pp > 0 ? '+' : ''}${pp}`);

    // 6. Оборудование: предпочитаем доступное
    if (equipment.length > 0) {
      const exEq = (ex as any).equipment || [];
      const hasEquipment = exEq.length === 0 || exEq.some((eq: string) => equipment.includes(eq));
      if (!hasEquipment) {
        score -= 5;
        rationales.push(`Нет оборудования -5`);
      }
    }

    // Бонус для compound (базовые)
    if (ex.type === 'compound') score += 5;

    // Бонус для уровня
    if (level === 'beginner' && ex.difficulty && ex.difficulty === 'advanced') score -= 10;
    if (level === 'advanced' && ex.difficulty && ex.difficulty === 'beginner') score -= 3;

    return { ...ex, selectionScore: Math.max(0, score), selectionRationale: rationales };
  });

  // Сортируем по скору
  scored.sort((a, b) => b.selectionScore - a.selectionScore);

  // Жадный отбор: берём лучшее, исключая конфликтующие
  const result: SelectedExercise[] = [];
  const usedIds = new Set<string>();

  for (const ex of scored) {
    if (result.length >= count) break;
    if (usedIds.has(ex.id)) continue;

    // Проверяем конфликт с уже выбранными
    const conflict = result.some(r => patternConflictScore(ex, [r]) < -20);
    if (conflict && result.length >= count - 1) continue; // берём только если место есть

    result.push(ex);
    usedIds.add(ex.id);
  }

  // Если не набрали нужное количество — добираем по скору
  if (result.length < count) {
    for (const ex of scored) {
      if (result.length >= count) break;
      if (usedIds.has(ex.id)) continue;
      result.push(ex);
      usedIds.add(ex.id);
    }
  }

  return result;
}

/** Упрощённый вызов: получить лучшие N упражнений для группы */
export function selectTopN(
  exercises: Exercise[],
  group: string,
  n: number,
  opts: { selectedIds?: string[]; equipment?: string[]; weakZones?: string[]; level?: string; injuryProfile?: string[]; type?: 'compound' | 'isolation' | 'any' } = {}
): SelectedExercise[] {
  return selectExercisesSmart({
    candidates: exercises,
    muscleGroup: group,
    count: n,
    selectedIds: opts.selectedIds || [],
    equipment: opts.equipment || [],
    weakZones: opts.weakZones || [],
    level: opts.level || 'intermediate',
    injuryProfile: opts.injuryProfile || [],
    type: opts.type || 'any',
  });
}

/** Функция для получения описания выбора (для UI) */
export function getSelectionRationale(selected: SelectedExercise[]): string[] {
  const lines: string[] = [];
  selected.forEach(ex => {
    if (ex.selectionRationale.length > 0) {
      lines.push(`${ex.name}: ${ex.selectionRationale.join(', ')} (score: ${ex.selectionScore})`);
    }
  });
  return lines;
}
