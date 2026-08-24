/**
 * exercise-selector.engine.ts — Интеллектуальный отбор упражнений.
 *
 * Вместо тупой сортировки по скору выбирает оптимальный сет упражнений
 * с учётом: покрытия слабых зон, разнообразия углов, суставной безопасности,
 * баланса тяни/толкай, отсутствия дублирования паттернов, доступного оборудования.
 */
import type { Exercise } from '../core/types';
import { bbExerciseTier, isInappropriateBB } from './bb/bb-exercise-tier.engine';
import { getExerciseById } from '../core/exercise-catalog';
import { EXERCISE_BIOMECHANICS_DB } from '../data/exercise-biomechanics-db';
import { getMappedBioId } from '../data/exercise-id-mapping';

/** Быстрый индекс биомеханики по id упражнения */
const BIO_MAP = new Map<string, typeof EXERCISE_BIOMECHANICS_DB[number]>();
EXERCISE_BIOMECHANICS_DB.forEach(b => { if (b && b.id) BIO_MAP.set(b.id, b); });

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
  /** Убрать осевую нагрузку (нагрузку на позвоночник): присед/становая/жим стоя/гудморнинг */
  avoidAxialLoad?: boolean;
}

/**
 * Детект осевой (компрессионной) нагрузки на позвоночник.
 * Источники: (1) БД биомеханики — spineLoad === 'high', (2) паттерны классических
 * осевых лифтов (присед со штангой, становая/мёртвая, жим стоя/армейский/OHP, гудморнинг),
 * (3) ТЯГИ В НАКЛОНЕ (штанга/гантели/T-гриф/Pendlay) — торс в сгибании под весом = осевая.
 * НЕ осевые (допустимые): жим ног/лег-пресс, болгарский/гоблет присед, машинные приседы,
 * тяги БЛОК/СИДЯ/ГРУДЬЮ К СКАМЬЕ (chest-supported), landmine, жимы сидя с гантелями.
 */
export function isAxialLoadExercise(ex: Exercise): boolean {
  const n = (ex.name || '').toLowerCase();
  const id = (ex.id || '').toLowerCase();

  // Безопасные (НЕ осевые): машины, сидя, грудью к скамье, блоки, landmine, оси, кардио/ходьба/носилки
  if (n.includes('жим ног') || n.includes('leg press') || n.includes('пресс ног')
    || n.includes('болгар') || n.includes('bulgarian') || n.includes('гоблет')
    || n.includes('goblet') || n.includes('машина') || n.includes('machine') || n.includes('хак')
    || n.includes('сидя') || n.includes('грудью') || n.includes('chest_supported')
    || n.includes('блок') || n.includes('landmine') || n.includes('кардио')
    || n.includes('ходьб') || n.includes('осо') || n.includes('sled') || n.includes('walk') || n.includes('carry')) return false;

  // Биомеханика БД: высокая нагрузка на позвоночник
  // AUDIT-FIX: catalog-id ≠ biomech-id — резолвим через getMappedBioId
  const bioId = getMappedBioId(ex.id) || ex.id;
  const b = BIO_MAP.get(bioId);
  if (b && b.spineLoad === 'high') return true;

  // Присед (barbell/фронт на плечах) — осевой
  if (n.includes('присед') || n.includes('squat')) return true;

  // Становая / мёртвая тяга / румынская / гудморнинг — осевой (наклон со штангой).
  // FIX: убрано `мёртв`/`мертв` без уточнения — ловило "мёртвый жук" (dead_bug, кор, НЕ осевая).
  if (n.includes('станов') || /м(?:ёртв|ертв).*тяг/i.test(n) || n.includes('deadlift')
    || n.includes('румын') || n.includes('румынск') || n.includes('гудморнинг') || n.includes('good morning') || n.includes('good_morning')) return true;

  // Жим стоя / армейский / overhead (штанга над головой) — осевой
  if (n.includes('жим') && (n.includes('стоя') || n.includes('армей') || n.includes('overhead') || n.includes('над голов'))) return true;
  if (id.includes('ohp') || id.includes('overhead') || id.includes('standing_press')) return true;
  // За головой (behind the neck) — осевой + риск
  if (n.includes('за голов')) return true;

  // P10: Тяги в наклоне — НЕ все осевые. Уточнение:
  //   - chest_supported (грудью к скамье) / с опорой на скамью / single-arm с опорой — НЕ осевая
  //   - landmine (один конец штанги в петле) — НЕ осевая
  //   - тяга нижнего блока сидя (трос из-под ног к поясу) — НЕ осевая
  //   - Pendlay / штанга в наклоне без опоры / T-гриф без опоры — ОСЕВАЯ
  if (n.includes('тяга') && (n.includes('в наклоне') || n.includes('наклон') || n.includes('pendlay') || n.includes('bent'))) {
    // P10: исключаем chest-supported и с опорой
    if (n.includes('грудью') || n.includes('chest') || n.includes('опор') || n.includes('скам') || n.includes('bench') || n.includes('landmine') || n.includes('сидя')) {
      // не осевая
    } else {
      return true;
    }
  }
  // Тяга гантели в наклоне с опорой на скамью — НЕ осевая
  if (n.includes('тяга') && n.includes('гантел') && (n.includes('опор') || n.includes('скам') || n.includes('bench'))) {
    // не осевая — пропускаем
  } else if (n.includes('тяга') && n.includes('гантел') && n.includes('наклон')) {
    return true;
  }
  // T-гриф без опоры — осевая
  if (/t[\s_-]*гриф/i.test(n) && !n.includes('опор') && !n.includes('скам')) return true;

  return false;
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
const COMP_LIFT_PATTERNS = ['становая', 'рывок', 'толчок', 'пендл', 'тяга рывковая', 'тяга пендл', 'спот', 'доски', 'цепи', 'ленты', 'пины', 'конвой', 'подъём на грудь', 'взятие на грудь', 'швунг', 'push press', 'push jerk', 'clean pull', 'muscle snatch', 'power clean', 'power snatch', 'hang clean'];
function isCompetitionLift(ex: Exercise): boolean {
  // Поле в каталоге — movementPattern (НЕ movementType). Значений 'competition_lift' нет,
  // но проверка оставлена для будущих расширений.
  if ((ex as any).movementType === 'competition_lift' || (ex as any).movementPattern === 'competition_lift') return true;
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
  const { candidates, muscleGroup, count, selectedIds, selectedNames, equipment, weakZones, level, injuryProfile, type, preferEquipment, targetRir, preferBB, favoriteIds, excludeIds, avoidAxialLoad } = input;
  const _selNames = selectedNames || [];
  const _selIds = selectedIds || [];
  const _equip = equipment || [];
  const _exclIds = new Set(excludeIds || []);
  const _favIds = new Set(favoriteIds || []);
  const _avoidAxial = !!avoidAxialLoad;

  // "Убрать осевую нагрузку": осевые упражнения (тяги в наклоне,
  // гудморнинг, присед/становая) заменяем на их не-осевые
  // аналоги из цепочки substitutions (грудью-к-скамье / блочные / сидя),
  // сохраняя ту же мышечную группу. Без замены — отсеются ниже.
  let _cands: Exercise[] = candidates;
  if (_avoidAxial) {
    _cands = candidates.map(ex => {
      if (!ex || !ex.id) return ex;
      if (!isAxialLoadExercise(ex)) return ex;
      const bioId = getMappedBioId(ex.id) || ex.id;
      const b = BIO_MAP.get(bioId);
      const subs: string[] = (b && (b as any).substitutions) || [];
      for (const sid of subs) {
        // 1) прямое совпадение catalog-id  2) biomech-id → catalog через маппинг
        let alt = candidates.find(c => c && c.id === sid);
        if (!alt) alt = candidates.find(c => c && (getMappedBioId(c.id) || c.id) === sid);
        if (alt && !isAxialLoadExercise(alt)) return alt;
      }
      return ex;
    });
  }

  let pool = _cands.filter(ex => {
    if (!ex || !ex.id) return false;
    if (_selIds.includes(ex.id)) return false;
    if (_selNames.includes(ex.name)) return false;
    if (_exclIds.has(ex.id)) return false;
    if (type && type !== 'any' && ex.type !== type) return false;
    if (_avoidAxial && isAxialLoadExercise(ex)) return false;
    return true;
  });

  // Если пул пуст (например, все кандидаты — осевые) — возвращаем candidates без фильтра
  if (pool.length === 0) pool = candidates.filter(ex => ex && ex.id && !_selIds.includes(ex.id) && !_selNames.includes(ex.name));

  // Скоринг
  const scored = pool.map(ex => {
    const rationales: string[] = [];
    let score = 50; // базовый

    // 1. Покрытие слабой зоны — программа-специфично
    const wz = weakZoneScore(ex, muscleGroup, weakZones || []);
    score += wz;
    if (wz > 0) rationales.push(`Закрывает слабую зону: ${muscleGroup}`);

    // 2. Разнообразие углов — программа-специфично
    const alreadySelected = _selIds.map(id => candidates.find(c => c.id === id)).filter(Boolean) as Exercise[];
    const ad = angleDiversityScore(ex, alreadySelected, muscleGroup);
    score += ad;
    if (ad > 0) rationales.push(`Новый угол для ${muscleGroup} — разнообразие паттерна`);
    else if (ad < 0) rationales.push(`Дублирует угол для ${muscleGroup}`);

    // 3. Конфликт паттернов (-30..-10..0)
    const pc = patternConflictScore(ex, alreadySelected);
    score += pc;
    if (pc < 0) rationales.push(`Дублирует паттерн — уже есть такой угол`);

    // 4. Суставная безопасность — программа-специфично
    const js = jointSafetyScore(ex, injuryProfile || []);
    score += js;
    if (js < 0) rationales.push(`Риск для травмы — требует замены`);
    else if (js > 0) rationales.push(`Безопасно для травмы — щадящий вариант`);

    // 5. Баланс тяни/толкай — программа-специфично
    const pp = pushPullScore(ex, alreadySelected);
    score += pp;
    if (pp !== 0) rationales.push(pp > 0 ? `Баланс тяни/толкай — выравнивает программу` : `Перекос тяни/толкай — уже много такого паттерна`);

    // 5x. Любимые упражнения — программа-специфично
    if (_favIds.has(ex.id)) {
      score += 15;
      rationales.push('Любимое упражнение — приоритет в программе');
    }

    // 6. Оборудование — программа-специфично
    if (_equip.length > 0) {
      const rawEq = (ex as any).equipment;
      const exEq: string[] = Array.isArray(rawEq) ? rawEq : (rawEq ? [String(rawEq)] : []);
      const hasEquipment = exEq.length === 0 || exEq.some((eq: string) => _equip.includes(eq));
      if (!hasEquipment) {
        score -= 5;
        rationales.push(`Нет доступа к оборудованию — пропущено для этой программы`);
      }
    }

    // Бонус за предпочитаемое оборудование (фазовая фильтрация) — программа-специфично
    if (preferEquipment && preferEquipment.length > 0) {
      const rawEq = (ex as any).equipment;
      const exEq: string = Array.isArray(rawEq) ? rawEq[0] || '' : String(rawEq || '');
      if (preferEquipment.includes(exEq)) {
        score += 8;
        rationales.push(`Оборудование совпадает с фазой — приоритет для этой программы`);
      }
    }

    // Бонус для compound — программа-специфично
    if (ex.type === 'compound') score += 10;

    // ▓▓ Тиры «обычности» — программа-специфично
    const _tier = bbExerciseTier(ex);
    if (_tier === 1) { score += 8; rationales.push('Каноническое упражнение — базовый паттерн для гипертрофии'); }
    else if (_tier === 3) { score -= 15; rationales.push('Экзотика — только для опытных, не в базе этой программы'); }
    else if (_tier === 4) { score -= 40; rationales.push('Не подходит для гипертрофии в этой программе — исключено'); }
    if (isInappropriateBB(ex) && level && (level === 'beginner' || level === 'intermediate')) { score -= 30; rationales.push('Недоступно на данном уровне — требует техники'); }

    // 5b. Контекст бодибилдинга — программа-специфично
    if (preferBB && isCompetitionLift(ex)) {
      score -= 5;
      rationales.push('Соревновательный подъём — не приоритет для гипертрофии в этой программе');
    }

    // 5c. ББ-спина: hinge/бицепс-бедра лифты (становая/мёртвая/румын/гудморнинг)
    // не принадлежат тренировке спины — только ногам. Штрафуем в пуле back.
    if (preferBB && muscleGroup === 'back' && isHingePattern(ex)) {
      score -= 10;
      // rationales.push('Бодибилдинг: hinge (бицепс бедра), не спина −10'); // скрыто — внутренний скоринг, не для пользователя
    }

    // 5d. Безопасность — программа-специфично
    const exLower = ((ex.name || '') + (ex.id || '')).toLowerCase();
    const isDangerous = (
      exLower.includes('за голов') ||
      (exLower.includes('гудморнинг') && level !== 'advanced' && level !== 'enhanced') ||
      (exLower.includes('швунг') && (level === 'beginner' || level === 'intermediate')) ||
      (exLower.includes('толчок') && level === 'beginner') ||
      (exLower.includes('рывок') && level === 'beginner')
    );
    if (isDangerous && (level === 'beginner' || level === 'intermediate')) {
      score -= 30;
      rationales.push('Безопасность: опасно для уровня — заменено в этой программе');
    } else if (isDangerous) {
      score -= 10;
      rationales.push('Требует техники — осторожно в этой программе');
    }
    if (level === 'beginner' && ex.difficulty && ex.difficulty === 'advanced') score -= 10;
    if (level === 'advanced' && ex.difficulty && ex.difficulty === 'beginner') score -= 3;

    // 7. Техника — внутренний бонус, не показываем пользователю
    const hasTechnique = !!(ex as any).technique;
    if (hasTechnique) { score += 5; }
    const hasComments = !!(ex as any).comments || !!(ex as any).description;
    if (hasComments) { score += 3; }

    // 8. Уровень-сложность — программа-специфично
    if (ex.difficulty === level) { score += 5; rationales.push('Сложность соответствует уровню — оптимально для этой программы'); }
    else if (level === 'advanced' && ex.difficulty === 'intermediate') { score += 2; rationales.push('Подходит для уровня — допустимо в этой программе'); }

    // 9. Целевой RIR — программа-специфично
    if (targetRir !== undefined) {
      if (ex.type === 'compound' && targetRir <= 1) { score += 8; rationales.push('Для тяжёлой фазы (RIR ' + targetRir + ') — тяжёлое базовое в этой программе'); }
      else if (ex.type === 'isolation' && targetRir >= 3) { score += 6; rationales.push('Для накопления (RIR ' + targetRir + ') — памп-изоляция в этой программе'); }
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

  /** Detector: слишком похожие упражнения (одинаковый угол + оборудование).
   * Иерархия: ANGLE_CLASSES (bb-exercise-selection) — primary для BB (1 упр/класс), isTooSimilar — вторичный
   * для общего каталога. Если упражнения из разных ANGLE_CLASSES одного мышца — не считаются похожими,
   * даже если isTooSimilar вернёт true (разные углы приоритетнее дедупа). */
  function isTooSimilar(ex: Exercise, selected: SelectedExercise[]): boolean {
    // Проверка ANGLE_CLASSES: разные углы одной мышцы — не похожи
    try {
      const { ANGLE_CLASSES } = require('./bb/bb-exercise-selection.engine');
      const exMuscle = (ex as any).muscle || (ex as any).group || '';
      for (const s of selected) {
        const sMuscle = (s as any).muscle || (s as any).group || '';
        if (exMuscle && sMuscle && exMuscle === sMuscle && ANGLE_CLASSES[exMuscle]) {
          const exClass = ANGLE_CLASSES[exMuscle].find((ac: any) => ac.match(ex));
          const sClass = ANGLE_CLASSES[sMuscle].find((ac: any) => ac.match(s));
          if (exClass && sClass && exClass.name !== sClass.name) continue; // разные углы — не похожи
        }
      }
    } catch {}
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
      // Оба жимы на наклонной → слишком похожи, но incline vs decline — разные углы
      const isIncline = (n: string) => n.includes('наклон') && n.includes('жим') && !n.includes('отриц') && !n.includes('сниз') && !n.includes('decline');
      const isDecline = (n: string) => n.includes('наклон') && n.includes('жим') && (n.includes('отриц') || n.includes('сниз') || n.includes('decline'));
      if (isIncline(exName) && isIncline(sName)) return true;
      if (isDecline(exName) && isDecline(sName)) return true;
      // Оба разведения/кроссоверы/сведения/бабочка/пек-дек → один изолирующий паттерн груди
      const isFlyLike = (n: string) => /развод|fly|кроссов|crossover|сведен|пек.?дек|бабоч|butterfly/i.test(n);
      if (isFlyLike(exName) && isFlyLike(sName)) return true;
      // Оба пуловера / тяга прямыми руками → один паттерн широчайших
      const isPullover = (n: string) => /пуловер|pullover|пулов|прям.*рук|straight.*pull/i.test(n);
      if (isPullover(exName) && isPullover(sName)) return true;
      // Обе тяги блока одинаковые
      const exIsPulldown = (exName.includes('тяга') && exName.includes('блок')) || exName.includes('pulldown');
      const sIsPulldown = (sName.includes('тяга') && sName.includes('блок')) || sName.includes('pulldown');
      if (exIsPulldown && sIsPulldown) {
        const exWide = exName.includes('широк') || exName.includes('за голов');
        const sWide = sName.includes('широк') || sName.includes('за голов');
        if (exWide === sWide) return true; // одинаковый вариант
      }
      // Обе разгибания/сгибания ног — любой вариант считается дублем (изоляция квадров/хамсов — 1 достаточно)
      if ((exName.includes('разгиб') && sName.includes('разгиб')) ||
          (exName.includes('сгибан') && sName.includes('сгибан'))) return true;
      // BUG-B17: доп. детекторы похожести —
      // (1) Жимы стоя/над головой с разной шириной хвата (жим лёжа стоя/смит стоя)
      const exIsOhp = (exName.includes('жим') && (exName.includes('стоя') || exName.includes('над голов') || exName.includes('голов')));
      const sIsOhp = (sName.includes('жим') && (sName.includes('стоя') || sName.includes('над голов') || sName.includes('голов')));
      if (exIsOhp && sIsOhp) return true;
      // (2) Приседы с разной глубиной/вариантом (присед со штангой/гакк/фронтальный/смит — все приседы)
      const exIsSquat = exName.includes('присед') || exName.includes('squat');
      const sIsSquat = sName.includes('присед') || sName.includes('squat');
      if (exIsSquat && sIsSquat) {
        // Болгарский/сплит-присед — ОДНОГО типа, но если оба болгарские → дубль
        const exBulg = exName.includes('болгар') || exName.includes('сплит-присед') || exName.includes('split squat');
        const sBulg = sName.includes('болгар') || sName.includes('сплит-присед') || sName.includes('split squat');
        if (exBulg && sBulg) return true;
        // Если оба не болгарские (т.е. обычные приседы) → тоже дубль
        if (!exBulg && !sBulg) return true;
      }
      // (3) Махи в стороны с разным углом (стоя/наклоне/сидя — все махи в стороны)
      const exIsLateralRaise = (exName.includes('мах') || exName.includes('разведен')) && exName.includes('в сторон') || exName.includes('lateral raise');
      const sIsLateralRaise = (sName.includes('мах') || sName.includes('разведен')) && sName.includes('в сторон') || sName.includes('lateral raise');
      if (exIsLateralRaise && sIsLateralRaise) return true;
      // (4) Оба — тяги штанги/гантели в наклоне (горизонтальные тяги) → один паттерн
      const isHorRow = (n: string) => /тяга.*(штанги|гантел|т-?гриф|йейтс|пендл|мэдоус|seal)/i.test(n);
      if (isHorRow(exName) && isHorRow(sName)) return true;
    }
    return false;
  }

  for (const ex of scored) {
    if (result.length >= count) break;
    if (usedIds.has(ex.id)) continue;
    if (usedNames.has(ex.name)) continue;

    // Разнообразие: изоляция — 1 на группу, база — 2 (диверсификация углов)
    const sg = (ex as any).substitutionGroup || '';
    const sgCount = usedSubGroups.get(sg) || 0;
    const isIsoGroup = sg.includes('iso') || sg === 'lat_iso' || sg === 'dip_push';
    const sgLimit = isIsoGroup ? 1 : 2;
    if (sg && sgCount >= sgLimit) continue;

    // Диверсификация оборудования: не более 2 тросовых/блочных в сессии
    // (пока есть ещё нетросовые кандидаты для добора)
    if (isCableExercise(ex) && cableCount >= 2 && result.length < count - 1) continue;

    // Штраф за слишком похожее упражнение
    if (isTooSimilar(ex, result) && result.length < count - 1) continue;

    // Проверяем конфликт с уже выбранными
    const conflict = result.some(r => patternConflictScore(ex, [r]) < -10);
    if (conflict && result.length >= count - 1) continue;

    result.push(ex);
    usedIds.add(ex.id);
    usedNames.add(ex.name);
    if (sg) usedSubGroups.set(sg, sgCount + 1);
    if (isCableExercise(ex)) cableCount++;
  }

  // Если не набрали — добираем, но сохраняем защиту от дублей (не тупое добавление)
  if (result.length < count) {
    for (const ex of scored) {
      if (result.length >= count) break;
      if (usedIds.has(ex.id)) continue;
      if (usedNames.has(ex.name)) continue;
      const sg2 = (ex as any).substitutionGroup || '';
      const sgCount2 = usedSubGroups.get(sg2) || 0;
      const isIsoGroup2 = sg2.includes('iso') || sg2 === 'lat_iso';
      const sgLimit2 = isIsoGroup2 ? 1 : 2;
      if (sg2 && sgCount2 >= sgLimit2) continue;
      if (isTooSimilar(ex, result)) continue;
      result.push(ex);
      usedIds.add(ex.id);
      usedNames.add(ex.name);
      if (sg2) usedSubGroups.set(sg2, sgCount2 + 1);
    }
  }

  return result;
}

/** Упрощённый вызов: получить лучшие N упражнений для группы */
export function selectTopN(
  exercises: Exercise[],
  group: string,
  n: number,
  opts: { selectedIds?: string[]; equipment?: string[]; weakZones?: string[]; level?: string; injuryProfile?: string[]; type?: 'compound' | 'isolation' | 'any'; favoriteIds?: string[]; excludeIds?: string[]; avoidAxialLoad?: boolean } = {}
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
    avoidAxialLoad: opts.avoidAxialLoad,
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