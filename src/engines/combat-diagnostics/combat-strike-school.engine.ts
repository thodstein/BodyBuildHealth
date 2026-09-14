/**
 * combat-strike-school.engine.ts — P8 школа постановки удара + подсобка.
 * 6 ударов (jab/cross/hook/uppercut/lowkick/elbow): стойка, цепь, типовые
 * ошибки, чекпоинты, прогрессия дриллов + assistanceFor — маппинг ТОЛЬКО на
 * реальные id зала (CB_EX_META pool: медбол-ротация/кувалда/плио/жимы/тяги).
 * Новых упражнений не выдумываем. schoolDrillFor: слабая фаза → назначение.
 */

export type CombatSchoolStrike = 'jab' | 'cross' | 'hook' | 'uppercut' | 'lowkick' | 'elbow';

export const COMBAT_SCHOOL_STRIKES: CombatSchoolStrike[] = [
  'jab', 'cross', 'hook', 'uppercut', 'lowkick', 'elbow',
];

export const COMBAT_SCHOOL_LABELS: Record<CombatSchoolStrike, string> = {
  jab: 'Джеб', cross: 'Кросс', hook: 'Хук', uppercut: 'Апперкот', lowkick: 'Лоукик', elbow: 'Локоть',
};

export interface CombatSchoolCard {
  strike: CombatSchoolStrike;
  label: string;
  stance: string;
  chain: string;
  errors: string[];
  checkpoints: string[];
  drills: string[];
  assistance: string[];
}

export const STRIKE_SCHOOL: Record<CombatSchoolStrike, CombatSchoolCard> = {
  jab: {
    strike: 'jab', label: 'Джеб',
    stance: 'Боевая стойка, переднее плечо к сопернику, подбородок за плечом',
    chain: 'Толчок передней ногой → плечо доворачивает → кулак по прямой → возврат по той же линии',
    errors: ['Толкание плечом без ноги', 'Локоть оторван в сторону', 'Рука падает после удара', 'Подбородок поднят'],
    checkpoints: ['Подбородок за плечом', 'Локоть под кулаком', 'Возврат в гард <0.5 с'],
    drills: ['Бой с тенью 3×3 мин на скорость', 'Лапы: джеб-дабл 5×2 мин', 'Мешок: серии 10 джебов с возвратом'],
    assistance: ['med_ball_throw', 'push_press', 'box_jump'],
  },
  cross: {
    strike: 'cross', label: 'Кросс',
    stance: 'Закрытая стойка, вес 50/50, задняя нога заряжена',
    chain: 'Задняя нога → бедро → торс → кулак; GRF-дисбаланс 60/40 — норма',
    errors: ['Бьют только рукой', 'Не доворачивают стопу/бедро', 'Проваливаются корпусом вперёд', 'Опускают переднюю руку'],
    checkpoints: ['Доворот задней стопы', 'Плечо закрывает подбородок', 'Корпус не дальше колена'],
    drills: ['Лапы: джеб-кросс 6×3 мин', 'Мешок: акцент на доворот 5×2 мин', 'Тень с резинкой за спину 3×2 мин'],
    assistance: ['med_ball_rot_throw', 'landmine_rotation', 'sledge_hammer'],
  },
  hook: {
    strike: 'hook', label: 'Хук',
    stance: 'Компактный гард, локти на высоте кулаков',
    chain: 'Вращение на ноге → бедро → локоть 90° → жёсткий контакт → возврат дугой',
    errors: ['Замах за спину (видно)', 'Локоть ниже/выше кулака', 'Пронос мимо цели', 'Опускают вторую руку'],
    checkpoints: ['Локоть 90° на контакте', 'Кулак горизонтально', 'Вторая рука в гарде'],
    drills: ['Лапы: хук с шагом 5×2 мин', 'Мешок: короткие серии без замаха', 'Зеркало: дуга без проноса 3×2 мин'],
    assistance: ['med_ball_rot_throw', 'sledge_hammer', 'battle_rope'],
  },
  uppercut: {
    strike: 'uppercut', label: 'Апперкот',
    stance: 'Низкая посадка, спина прямая, локти близко',
    chain: 'Ноги подседают → разгибание вверх по дуге → контакт → возврат в гард',
    errors: ['Бьют только рукой снизу', 'Выпрямляют локоть полностью', 'Наклоняются вперёд', 'Опускают вторую руку'],
    checkpoints: ['Локоть не разгибать до конца', 'Ладонь к себе', 'Голова не ниже рук соперника'],
    drills: ['Лапы: апперкот с подседом 5×2 мин', 'Мешок: короткие дуги снизу', 'Тень: связка кросс-апперкот-хук'],
    assistance: ['hang_clean', 'kb_swing', 'push_press'],
  },
  lowkick: {
    strike: 'lowkick', label: 'Лоукик',
    stance: 'Шаг опорной наружу, руки в гарде, подбородок опущен',
    chain: 'Опорная на носке → голень как битой через цель → возврат в стойку',
    errors: ['Бьют стопой вместо голени', 'Не доворачивают опорную', 'Опускают руки', 'Скрещивают ноги на возврате'],
    checkpoints: ['Контакт голенью', 'Опорная на носке', 'Руки в гарде всё время'],
    drills: ['Мешок: 5×20 лоукиков с шагом', 'Лапы-пады: вход с прикрытием', 'Тень: возврат без скрещивания 3×2 мин'],
    assistance: ['squat', 'box_jump', 'farmer_carry'],
  },
  elbow: {
    strike: 'elbow', label: 'Локоть',
    stance: 'Дистанция клинча, рамка, локоть согнут',
    chain: 'Короткий разворот корпусом → жёсткий клин → возврат в рамку',
    errors: ['Замах рукой (видно)', 'Опускают вторую руку', 'Теряют рамку клинча', 'Бьют предплечьем плашмя'],
    checkpoints: ['Без замаха', 'Вторая рука контролирует', 'Возврат в рамку сразу'],
    drills: ['Лапы-пады в клинче 5×2 мин', 'Мешок вплотную: короткие клины', 'Клинч-спарринг ограниченный 3×2 мин'],
    assistance: ['neck_isometric_front', 'pullup', 'landmine_180'],
  },
};

/** Подсобка только из реального пула зала — белый список CB_EX_META. */
const REAL_POOL = new Set([
  'med_ball_throw', 'med_ball_slam', 'med_ball_rot_throw', 'sledge_hammer', 'battle_rope',
  'landmine_rotation', 'landmine_180', 'pallof_rotation_press', 'box_jump', 'push_press',
  'bench_bar', 'row_bar', 'squat', 'hang_clean', 'kb_swing', 'farmer_carry',
  'neck_isometric_front', 'pullup',
]);

export function schoolAssistanceValid(): { valid: boolean; bad: string[] } {
  const bad: string[] = [];
  for (const s of COMBAT_SCHOOL_STRIKES) {
    for (const id of STRIKE_SCHOOL[s].assistance) {
      if (!REAL_POOL.has(id)) bad.push(`${s}:${id}`);
    }
  }
  return { valid: bad.length === 0, bad };
}

export interface CombatSchoolPrescription {
  strike: CombatSchoolStrike;
  label: string;
  gapText: string;
  drills: string[];
  assistance: string[];
  text: string;
}

/** Слабая фаза/замер → назначение: 1–2 дрилла + 2–3 подсобных из зала. */
export function schoolDrillFor(
  strike: CombatSchoolStrike, gap: 'speed' | 'mass' | 'asym' | 'path',
): CombatSchoolPrescription {
  const card = STRIKE_SCHOOL[strike];
  const gapText = gap === 'speed'
    ? 'Не хватает скорости — расслабление и плио'
    : gap === 'mass'
      ? 'Масса не включается — цепь снизу и жёсткий контакт'
      : gap === 'asym'
        ? 'Слабая сторона — унилатеральная добивка'
        : 'Петля видна — укоротить траекторию';
  const drills = gap === 'mass'
    ? [card.drills[1] ?? card.drills[0], 'Мешок: акцент на доворот и опору']
    : gap === 'path'
      ? ['Зеркало: прямая линия 3×2 мин', card.drills[0]]
      : [card.drills[0], card.drills[1] ?? card.drills[0]];
  return {
    strike, label: card.label, gapText,
    drills, assistance: card.assistance.slice(0, 3),
    text: `${card.label}: ${gapText} → ${drills.join(' + ')} + зал: ${card.assistance.slice(0, 3).join(', ')}`,
  };
}
