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
  candidates: Exercise[];
  muscleGroup: string;
  count: number;
  selectedIds: string[];
  selectedNames?: string[];
  equipment: string[];
  weakZones?: string[];
  level: string;
  injuryProfile?: string[];
  type?: 'compound' | 'isolation' | 'any';
  /** Предпочитаемое оборудование — упражнения с ним получают +8 к скору */
  preferEquipment?: string[];
  /** Целевой RIR для фазы (0-4) — упражнения с подходящей сложностью получают бонус */
  targetRir?: number;
  /** Контекст бодибилдинга: штрафует пауэрлифт/олимпийские тяжёлые подъёмы в пользу изоляции/машин/тросов */
  preferBB?: boolean;
  /** Любимые упражнения (ID) — получают +15 к скору, приоритет при отборе */
  favoriteIds?: string[];
  /** Исключённые упражнения (ID) — полностью исключаются из пула */
  excludeIds?: string[];
}

export interface SelectedExercise extends Exercise {
  selectionScore: number;
  selectionRationale: string[];
}

/**
 * Детект соревновательных пауэрлифтинг/олимпийских подъёмов (не для бодибилдинга).
 * ВАЖНО: список ТОЛЬКО из однозначно соревновательных/олимпийских паттернов.
 * Убраны blanket-паттерны ('штанг','смит','присед','армейский','тяга штанги',
 * 'жим штанги лёжа','жимовой'), т.к. они штрафовали валидные ББ-лифты
 * (тяга штанги в наклоне — king спины, Смит, армейский жим, жим лёжа).
 */
const COMP_LIFT_PATTERNS = ['становая', 'рывок', 'толчок', 'пендл', 'тяга рывковая', 'тяга пендл', 'спот', 'доски', 'цепи', 'ленты', 'пины', 'конвой', 'подъём на грудь', 'взятие на грудь'];
function isCompetitionLift(ex: Exercise): boolean {
  if (ex.movementType === 'competition_lift') return true;
  const n = (ex.name || '').toLowerCase();
  const id = (ex.id || '').toLowerCase();
  return COMP_LIFT_PATTERNS.some(p => n.includes(p) || id.includes(p));
}

/** Hinge-паттерн (становая/мёртвая/румын/гудморнинг/наклоны со штангой) — бицепс бедра, не спина */
function isHingePattern(ex: Exercise): boolean {
  const n = (ex.name || '').toLowerCase();
  const id = (ex.id || '').toLowerCase();
  return /станов|мёртв|мертв|румын|good.?morning|гудмор/.test(n + ' ' + id) ||
    (n.includes('наклон') && n.includes('штанг'));
}

/** Тросовое/блочное упражнение */
function isCableExercise(ex: Exercise): boolean {
  const rawEq = (ex as any).equipment;
  const eq = (Array.isArray(rawEq) ? rawEq.join(' ') : String(rawEq || '')).toLowerCase();
  const n = (ex.name || '').toLowerCase();
  return eq.includes('cable') || n.includes('блок') || n.includes('трос') || n.includes('кроссов');
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
    core:   ['mid_range'],
    abs:    ['mid_range'],
  };
  const allZones = zoneMap[group] || ['mid_range'];
  // Если weakZones содержит имена групп (не зон), вернуть ВСЕ зоны для группы
  const validZones = new Set(['stretch', 'mid_range', 'lockout', 'bottom', 'contraction']);
  const hasGroupNames = weakZones.length > 0 && weakZones.some(z => !validZones.has(z));
  if (hasGroupNames && weakZones.includes(group)) return allZones;
  return allZones.filter(z => weakZones.includes(z));
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
  const { candidates, muscleGroup, count, selectedIds, selectedNames, equipment, weakZones, level, injuryProfile, type, preferEquipment, targetRir, preferBB, favoriteIds, excludeIds } = input;
  const _selNames = selectedNames || [];
  const _exclIds = new Set(excludeIds || []);
  const _favIds = new Set(favoriteIds || []);

  let pool = candidates.filter(ex => {
    if (!ex || !ex.id) return false;
    if (selectedIds.includes(ex.id)) return false;
    if (_selNames.includes(ex.name)) return false;
    if (_exclIds.has(ex.id)) return false;
    if (type && type !== 'any' && ex.type !== type) return false;
    return true;
  });

  // Если пул пуст — возвращаем candidates без фильтра
  if (pool.length === 0) pool = candidates.filter(ex => ex && ex.id && !selectedIds.includes(ex.id) && !_selNames.includes(ex.name));

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

    // 5x. Любимые упражнения (+15)
    if (_favIds.has(ex.id)) {
      score += 15;
      rationales.push('Любимое +15');
    }

    // 6. Оборудование: предпочитаем доступное
    if (equipment.length > 0) {
      // AUDIT-FIX: в каталоге equipment может быть строкой ('barbell'), а не массивом — нормализуем.
      const rawEq = (ex as any).equipment;
      const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
      const hasEquipment = exEq.length === 0 || exEq.some((eq: string) => equipment.includes(eq));
      if (!hasEquipment) {
        score -= 5;
        rationales.push(`Нет оборудования -5`);
      }
    }

    // Бонус за предпочитаемое оборудование (фазовая фильтрация)
    if (preferEquipment && preferEquipment.length > 0) {
      const rawEq = (ex as any).equipment;
      const exEq: string = Array.isArray(rawEq) ? rawEq[0] || '' : String(rawEq || '');
      if (preferEquipment.includes(exEq)) {
        score += 8;
        rationales.push(`Приоритетное оборудование +8`);
      }
    }

    // Бонус для compound (базовые)
    if (ex.type === 'compound') score += 5;

    // 5b. Контекст бодибилдинга: штраф пауэрлифт-подъёмов
    if (preferBB && isCompetitionLift(ex)) {
      score -= 18;
      rationales.push('Бодибилдинг: не соревновательный подъём −18');
    }

    // 5c. ББ-спина: hinge/бицепс-бедра лифты (становая/мёртвая/румын/гудморнинг)
    // не принадлежат тренировке спины — только ногам. Штрафуем в пуле back.
    if (preferBB && muscleGroup === 'back' && isHingePattern(ex)) {
      score -= 25;
      rationales.push('Бодибилдинг: hinge (бицепс бедра), не спина −25');
    }

    // 5d. Безопасность: опасные упражнения для новичков/средних
    const exLower = ((ex.name || '') + (ex.id || '')).toLowerCase();
    const isDangerous = (
      exLower.includes('за голов') ||     // behind-the-neck (тяга/жим)
      (exLower.includes('гудморнинг') && level !== 'advanced' && level !== 'enhanced') ||
      (exLower.includes('швунг') && (level === 'beginner' || level === 'intermediate')) ||
      (exLower.includes('толчок') && level === 'beginner') ||
      (exLower.includes('рывок') && level === 'beginner')
    );
    if (isDangerous && (level === 'beginner' || level === 'intermediate')) {
      score -= 30;
      rationales.push('Безопасность: опасное для уровня −30');
    } else if (isDangerous) {
      score -= 10;
      rationales.push('Безопасность: требует техники −10');
    }
    if (level === 'beginner' && ex.difficulty && ex.difficulty === 'advanced') score -= 10;
    if (level === 'advanced' && ex.difficulty && ex.difficulty === 'beginner') score -= 3;

    // 7. Техника/образовательная ценность
    const hasTechnique = !!(ex as any).technique;
    if (hasTechnique) { score += 5; rationales.push('Есть техника +5'); }
    const hasComments = !!(ex as any).comments || !!(ex as any).description;
    if (hasComments) { score += 3; rationales.push('Есть описание +3'); }

    // 8. Уровень-сложность: совпадение даёт +5
    if (ex.difficulty === level) { score += 5; rationales.push('Сложность~уровню +5'); }
    else if (level === 'advanced' && ex.difficulty === 'intermediate') { score += 2; rationales.push('Подходит для advanced +2'); }

    // 9. Целевой RIR: compound с низким RIR (0-1) для тяжёлой фазы, изоляция с высоким (3-4) для накопления
    if (targetRir !== undefined) {
      if (ex.type === 'compound' && targetRir <= 1) { score += 8; rationales.push('Рекомендован для тяжёлой фазы (RIR ' + targetRir + ') +8'); }
      else if (ex.type === 'isolation' && targetRir >= 3) { score += 6; rationales.push('Рекомендован для накопления (RIR ' + targetRir + ') +6'); }
    }

    return { ...ex, selectionScore: Math.max(0, score), selectionRationale: rationales };
  });

  // Сортируем по скору
  scored.sort((a, b) => b.selectionScore - a.selectionScore);

  // Жадный отбор: берём лучшее, исключая конфликтующие
  const result: SelectedExercise[] = [];
  const usedIds = new Set<string>();
  const usedNames = new Set<string>();
  const usedSubGroups = new Map<string, number>();
  const usedAngles = new Set<string>();
  const usedEquipment = new Set<string>();
  let cableCount = 0;

  /** Detector: слишком похожие упражнения (одинаковый угол + оборудование). */
  function isTooSimilar(ex: Exercise, selected: SelectedExercise[]): boolean {
    const exName = (ex.name || '').toLowerCase();
    for (const s of selected) {
      const sName = (s.name || '').toLowerCase();
      // Оба жимы лёжа со штангой → слишком похожи
      const exIsPress = exName.includes('жим') && exName.includes('лёжа');
      const sIsPress = sName.includes('жим') && sName.includes('лёжа');
      if (exIsPress && sIsPress) {
        const exHasDumbbell = exName.includes('гантел');
        const sHasDumbbell = sName.includes('гантел');
        const exHasSmith = exName.includes('смит');
        const sHasSmith = sName.includes('смит');
        // Разные снаряды → OK
        if (exHasDumbbell !== sHasDumbbell || exHasSmith !== sHasSmith) continue;
        // Оба штанга или оба гантели → слишком похожи
        return true;
      }
      // Обе тяги блока одинаковые
      const exIsPulldown = (exName.includes('тяга') && exName.includes('блок')) || exName.includes('pulldown');
      const sIsPulldown = (sName.includes('тяга') && sName.includes('блок')) || sName.includes('pulldown');
      if (exIsPulldown && sIsPulldown) {
        const exWide = exName.includes('широк') || exName.includes('за голов');
        const sWide = sName.includes('широк') || sName.includes('за голов');
        if (exWide === sWide) return true; // одинаковый вариант
      }
      // Обе разгибания/сгибания ног
      if ((exName.includes('разгиб') && sName.includes('разгиб')) ||
          (exName.includes('сгибан') && sName.includes('сгибан'))) return true;
    }
    return false;
  }

  for (const ex of scored) {
    if (result.length >= count) break;
    if (usedIds.has(ex.id)) continue;
    if (usedNames.has(ex.name)) continue;

    // Разнообразие: не больше 2 упражнений из одной substitutionGroup
    const sg = (ex as any).substitutionGroup || '';
    const sgCount = usedSubGroups.get(sg) || 0;
    if (sg && sgCount >= 2) continue;

    // Диверсификация оборудования: не более 2 тросовых/блочных в сессии
    // (пока есть ещё нетросовые кандидаты для добора)
    if (isCableExercise(ex) && cableCount >= 2 && result.length < count - 1) continue;

    // Штраф за слишком похожее упражнение
    if (isTooSimilar(ex, result) && result.length < count - 1) continue;

    // Проверяем конфликт с уже выбранными
    const conflict = result.some(r => patternConflictScore(ex, [r]) < -20);
    if (conflict && result.length >= count - 1) continue;

    result.push(ex);
    usedIds.add(ex.id);
    usedNames.add(ex.name);
    if (sg) usedSubGroups.set(sg, sgCount + 1);
    if (isCableExercise(ex)) cableCount++;
  }

  // Если не набрали нужное количество — добираем по скору
  if (result.length < count) {
    for (const ex of scored) {
      if (result.length >= count) break;
      if (usedIds.has(ex.id)) continue;
      if (usedNames.has(ex.name)) continue;
      result.push(ex);
      usedIds.add(ex.id);
      usedNames.add(ex.name);
    }
  }

  return result;
}

/** Упрощённый вызов: получить лучшие N упражнений для группы */
export function selectTopN(
  exercises: Exercise[],
  group: string,
  n: number,
  opts: { selectedIds?: string[]; equipment?: string[]; weakZones?: string[]; level?: string; injuryProfile?: string[]; type?: 'compound' | 'isolation' | 'any'; favoriteIds?: string[]; excludeIds?: string[] } = {}
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
    favoriteIds: opts.favoriteIds,
    excludeIds: opts.excludeIds,
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
