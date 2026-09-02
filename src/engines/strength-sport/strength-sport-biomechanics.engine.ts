/**
 * strength-sport-biomechanics.engine.ts — ЧИСЛОВАЯ БИОМЕХАНИКА ТА/стронга (PRO)
 *
 * Наследует WLWeakPoint как ключ, но добавляет то, чего нет в strength-sport-weakpoint.ts:
 *  angleRangeDeg: числовой диапазон ключевого сустава (для валидации video/IMU)
 *  keyJoint, weakMuscles, biomechanicalReason, corrections, loadCues, intensityPct, rationale, references
 *
 * Источники:
 *  - Gourgoulis et al. 2000/2002 — колено 129-140° (1st pull), 159-170° (2nd pull)
 *  - Garhammer 1985 — рывок vs взятие, бар path, сила на фазы
 *  - Ang & Kong 2023 Sensors 23:1171 — 6 фаз рывка, кинематика/кинетика полевая
 *  - Vorobyev 1978 — S-траектория, 3 типа
 *  - Hakkinen et al. 1984 — скандинавская биомеханика рывка/толчка
 *  - Chavda 2024 Enode — валидация IMU vs motion capture
 *
 * Чистый движок, без UI. Совместим с WL_WEAKPOINT_* (не заменяет).
 */

import type { WLWeakPoint } from './strength-sport-weakpoint';

export interface TABiomechInfo {
  weakPoint: WLWeakPoint;
  label: string;
  joint: string;
  angleRangeDeg: [number, number]; // диапазон угла ключевого сустава (градусы)
  keyJoint: string;
  weakMuscles: string[];
  biomechanicalReason: string;
  corrections: string[];
  loadCues: string;
  intensityPct: number;
  rationale: string;
  references: string[];
}

export const TA_BIOMECH: Record<WLWeakPoint, TABiomechInfo> = {
  snatch_off_floor: {
    weakPoint: 'snatch_off_floor',
    label: 'Рывок: отрыв (0-20° таз)',
    joint: 'таз / колено',
    angleRangeDeg: [0, 20],
    keyJoint: 'тазобедренный + коленный (стартовая изометрия)',
    weakMuscles: ['Квадрицепс (VMO)', 'Ягодицы', 'Разгибатели спины'],
    biomechanicalReason: 'Срыв с помоста — максимальный изометрический момент на тазобедренном (плечо силы — весь бар). Скорость низкая, требуется удержание спины и стартовой позиции. Слабый отрыв = просадка таза/округление, медленный срыв.',
    corrections: ['Тяга рывковая с дефицита (deficit_snatch)', 'Пауза-рывок у пола', 'Рывковая тяга (snatch_pull)'],
    loadCues: 'Дефицит 3-5 см увеличивает ROM срыва; пауза 2с у пола убирает инерцию и тренирует изометрию.',
    intensityPct: 0.70,
    rationale: 'Перегрузка фазы отрыва — дефицит + пауза.',
    references: ['Gourgoulis 2000', 'Garhammer 1985', 'Ang 2023'],
  },
  snatch_mid: {
    weakPoint: 'snatch_mid',
    label: 'Рывок: середина тяги (колено 60-90°)',
    joint: 'колено',
    angleRangeDeg: [60, 90],
    keyJoint: 'коленный (проход коленей)',
    weakMuscles: ['Бицепс бедра', 'Ягодицы', 'Разгибатели спины'],
    biomechanicalReason: 'Переход 1й→2й тяги, double-knee-bend: колено сгибается, таз идет вперед, бар близко. Потеря скорости на transition 0.10-0.15с определяет успех. Слабый проход = бар уходит вперед, потеря скорости.',
    corrections: ['Пауза-рывок на колене', 'Рывковая тяга + шраги', 'Румынская тяга'],
    loadCues: 'Пауза на колене 2с + тяга до взрыва — контроль transition.',
    intensityPct: 0.70,
    rationale: 'Transition — узкое место; пауза тренирует удержание.',
    references: ['Baumann 1988', 'Gourgoulis 2002', 'Enoka 1988'],
  },
  snatch_pull_under: {
    weakPoint: 'snatch_pull_under',
    label: 'Рывок: уход под штангу (плечо взрыв)',
    joint: 'плечо / таз',
    angleRangeDeg: [0, 30],
    keyJoint: 'плечевой пояс + таз (turnover)',
    weakMuscles: ['Трапеции', 'Дельты', 'Квадрицепс (сед)'],
    biomechanicalReason: 'Третья фаза (turnover): после пиковой скорости бар падает, атлет тянет себя под бар. Скорость ухода определяет высоту фиксации. Слабый turnover = высокий бар, поздний сед.',
    corrections: ['Рывок с высокого виса (high_hang_snatch)', 'Рывок классический без подседа (muscle_snatch)', 'Баланс рывковый (snatch_balance)'],
    loadCues: 'Высокий вис убирает тягу и изолирует turnover; muscle_snatch — чистая тяга руками.',
    intensityPct: 0.65,
    rationale: 'Изоляция turnover без тяги.',
    references: ['Gourgoulis 2009', 'Ho 2014'],
  },
  snatch_catch: {
    weakPoint: 'snatch_catch',
    label: 'Рывок: фиксация в седе (колено сед)',
    joint: 'колено',
    angleRangeDeg: [0, 90],
    keyJoint: 'коленный + тазобедренный (глубокий сед)',
    weakMuscles: ['Квадрицепс', 'Ягодицы', 'Кор'],
    biomechanicalReason: 'Прием в глубокий оверхед-сед (колено <90°, таз ниже параллели). Требуется мобильность и эксцентрическая сила ног. Слабый сед = завал вперед, потеря оверхеда.',
    corrections: ['Оверхед-присед (overhead_squat_v2)', 'Рывковый баланс', 'Пауза-присед (pause_squat)'],
    loadCues: 'Оверхед-сед с паузой 3с внизу — стабильность.',
    intensityPct: 0.65,
    rationale: 'Глубокий сед с оверхедом — специфика.',
    references: ['Schoenfeld 2021', 'Rabin 2017'],
  },
  snatch_overhead: {
    weakPoint: 'snatch_overhead',
    label: 'Рывок: оверхед стабильность',
    joint: 'плечо',
    angleRangeDeg: [0, 180],
    keyJoint: 'плечевой (оверхед фиксация)',
    weakMuscles: ['Дельты', 'Трапеции', 'Кор (стабилизаторы)'],
    biomechanicalReason: 'Удержание бара над головой в седе — плечо 180° флексия + внешняя ротация, грудной отдел экстензия. Потеря = бар вперед, шатание.',
    corrections: ['Оверхед-присед с паузой', 'Жимовой швунг из-за головы (behind_neck_jerk)', 'Удержания оверхеда'],
    loadCues: 'Удержание 5с в седе с оверхедом — изометрия.',
    intensityPct: 0.60,
    rationale: 'Оверхед-стабилизация — отдельный навык.',
    references: ['Bishop 2016', 'NASM OSA'],
  },
  clean_off_floor: {
    weakPoint: 'clean_off_floor',
    label: 'Взятие: отрыв',
    joint: 'таз',
    angleRangeDeg: [0, 20],
    keyJoint: 'тазобедренный (отрыв)',
    weakMuscles: ['Квадрицепс', 'Ягодицы', 'Разгибатели'],
    biomechanicalReason: 'Отрыв для взятия — угол спины выше чем рывок, нагрузка на ноги больше. ISPP — лучший предиктор всего двоеборья (81% дисперсии, Essex).',
    corrections: ['Взятие с дефицита (deficit_clean)', 'Пауза-взятие у пола', 'Тяга толчковая (clean_pull)'],
    loadCues: 'Дефицит + пауза — перегрузка отрыва.',
    intensityPct: 0.70,
    rationale: 'ISPP предиктор; дефицит — перегрузка.',
    references: ['Essex IMTP study', 'Garhammer 1985'],
  },
  clean_mid: {
    weakPoint: 'clean_mid',
    label: 'Взятие: середина (колено)',
    joint: 'колено',
    angleRangeDeg: [60, 90],
    keyJoint: 'колено (проход)',
    weakMuscles: ['Задняя цепь', 'Ягодицы', 'Разгибатели'],
    biomechanicalReason: 'Середина взятия — аналогично рывку, но бар ближе и тяжелее. Зависание = бар вперед.',
    corrections: ['Пауза-взятие на колене', 'Толчковая тяга', 'Румынская тяга'],
    loadCues: 'Пауза 2с на колене.',
    intensityPct: 0.70,
    rationale: 'Проход коленей — контроль.',
    references: ['Gourgoulis 2002'],
  },
  clean_catch: {
    weakPoint: 'clean_catch',
    label: 'Взятие: уход в сед (фронт-сед)',
    joint: 'колено',
    angleRangeDeg: [0, 90],
    keyJoint: 'колено + таз (фронт-сед)',
    weakMuscles: ['Квадрицепс', 'Кор', 'Разгибатели'],
    biomechanicalReason: 'Прием на грудь в фронтальный сед (гриф на ключицах, локти высоко). Требуется фронт-мобильность и сила ног. Слабый — завал локтей, потеря груди.',
    corrections: ['Фронтальный присед (front_squat)', 'Фронт-сед с паузой', 'Пауза-присед'],
    loadCues: 'Фронт-сед 3с внизу с локтями вверх.',
    intensityPct: 0.70,
    rationale: 'Фронт-сед — ключ к взятию.',
    references: ['Front squat literature'],
  },
  jerk_dip: {
    weakPoint: 'jerk_dip',
    label: 'Толчок: подсед (dip 8-12 см)',
    joint: 'колено',
    angleRangeDeg: [0, 12],
    keyJoint: 'коленный (dip глубина)',
    weakMuscles: ['Квадрицепс'],
    biomechanicalReason: 'Dip — полуприсед 8-12 см, скорость и глубина определяют энергию толчка. Глубокий/с медленный dip теряет упругость.',
    corrections: ['Толчковый dip (jerk_dip)', 'Пауза-толчок dip', 'Фронтальный присед'],
    loadCues: 'Контроль глубины 10 см + взрыв вверх.',
    intensityPct: 0.70,
    rationale: 'Dip — пружина толчка.',
    references: ['Teoriya.ru jerk phases', 'Harbili'],
  },
  jerk_drive: {
    weakPoint: 'jerk_drive',
    label: 'Толчок: выталкивание (drive)',
    joint: 'плечо / таз',
    angleRangeDeg: [0, 30],
    keyJoint: 'таз + плечо (взрыв)',
    weakMuscles: ['Дельты', 'Трицепс', 'Ноги (drive)'],
    biomechanicalReason: 'Drive — взрывное разгибание ног + толчок плеч. Пиковая мощность. Слабый drive = низкий выброс, недолет.',
    corrections: ['Толчковый жим (push_press)', 'Толчок с груди (push_jerk)', 'Жим из-за головы'],
    loadCues: 'Пуш-пресс с акцентом на ноги.',
    intensityPct: 0.70,
    rationale: 'Drive — ноги + плечи.',
    references: ['Garhammer'],
  },
  jerk_lockout: {
    weakPoint: 'jerk_lockout',
    label: 'Толчок: фиксация (локоть)',
    joint: 'локоть',
    angleRangeDeg: [0, 180],
    keyJoint: 'локтевой (фиксация)',
    weakMuscles: ['Трицепс', 'Дельты', 'Кор'],
    biomechanicalReason: 'Фиксация — разведение ног (ножницы) + локти в замок. Требуется быстрота и стабильность. Слабый = дожим руками, потеря баланса.',
    corrections: ['Толчок в ножницы (split_jerk)', 'Восстановление толчка (jerk_recovery)', 'Жим с упоров (pin_press)'],
    loadCues: 'Ножницы с паузой 3с — фиксация.',
    intensityPct: 0.65,
    rationale: 'Ножницы + фиксация.',
    references: ['Jerk literature'],
  },
  squat_bottom: {
    weakPoint: 'squat_bottom',
    label: 'Присед: внизу (яма)',
    joint: 'колено',
    angleRangeDeg: [0, 90],
    keyJoint: 'колено + таз (яма)',
    weakMuscles: ['Квадрицепс', 'Ягодицы'],
    biomechanicalReason: 'Яма — максимальный коленный момент, потеря скорости = завал. Связан с ankle dorsiflexion (<35° → heel rise).',
    corrections: ['Пауза-присед', 'Темповой присед 5-3-0', 'Фронтальный присед'],
    loadCues: 'Пауза 3с в яме.',
    intensityPct: 0.70,
    rationale: 'Яма — колено + мобильность.',
    references: ['Schoenfeld 2021', 'Rabin 2017'],
  },
  squat_mid: {
    weakPoint: 'squat_mid',
    label: 'Присед: середина',
    joint: 'бедро',
    angleRangeDeg: [90, 130],
    keyJoint: 'таз (середина)',
    weakMuscles: ['Ягодицы', 'Приводящие'],
    biomechanicalReason: 'Середина — переход яма→верх, требует приводящих и ягодиц.',
    corrections: ['Пауза-присед на середине', 'Присед паузный', 'Гакк-присед'],
    loadCues: 'Остановка на 90°.',
    intensityPct: 0.70,
    rationale: 'Середина — ягодицы.',
    references: ['Schoenfeld'],
  },
  pull_start: {
    weakPoint: 'pull_start',
    label: 'Тяга: старт',
    joint: 'таз',
    angleRangeDeg: [0, 20],
    keyJoint: 'таз (старт)',
    weakMuscles: ['Квадрицепс', 'Разгибатели'],
    biomechanicalReason: 'Тяговый старт — как clean off_floor, но без дальнейшего приема. ISPP предиктор.',
    corrections: ['Дефицитная тяга', 'Пауза-тяга', 'Становая тяга'],
    loadCues: 'Дефицит 5см.',
    intensityPct: 0.70,
    rationale: 'Стартовый изометрический.',
    references: ['Essex'],
  },
  pull_lockout: {
    weakPoint: 'pull_lockout',
    label: 'Тяга: замок',
    joint: 'таз',
    angleRangeDeg: [70, 180],
    keyJoint: 'таз (замыкание)',
    weakMuscles: ['Ягодицы', 'Трапеции'],
    biomechanicalReason: 'Замок — замыкание бедер, ягодицы. Слабый = горб.',
    corrections: ['Тяга с плинтов', 'Рывковая тяга', 'Румынская'],
    loadCues: 'Плинты выше колен.',
    intensityPct: 0.75,
    rationale: 'Замок — ягодицы.',
    references: ['Simmons'],
  },
  press_start: {
    weakPoint: 'press_start',
    label: 'Жим/лог: старт',
    joint: 'плечо',
    angleRangeDeg: [0, 30],
    keyJoint: 'плечевой (старт)',
    weakMuscles: ['Дельты', 'Трицепс'],
    biomechanicalReason: 'Старт жима/лог-лифта — из фронтового положения, требует силы плеч.',
    corrections: ['Жим с упоров', 'Толчковый жим', 'Армейский жим'],
    loadCues: 'С упоров без отбива.',
    intensityPct: 0.70,
    rationale: 'Стартовый жим.',
    references: ['Press literature'],
  },
};

export function diagnoseTAWeakPoint(wp: WLWeakPoint): TABiomechInfo | null {
  return TA_BIOMECH[wp] ?? null;
}

export function allTABiomech(): TABiomechInfo[] {
  return Object.values(TA_BIOMECH);
}

export function weakPointsByJoint(joint: string): WLWeakPoint[] {
  const low = joint.toLowerCase();
  return (Object.values(TA_BIOMECH) as TABiomechInfo[])
    .filter(b => b.joint.toLowerCase().includes(low) || b.keyJoint.toLowerCase().includes(low))
    .map(b => b.weakPoint);
}

export function isValidAngleForWeakPoint(wp: WLWeakPoint, angleDeg: number): boolean {
  const b = TA_BIOMECH[wp];
  if (!b) return false;
  const [lo, hi] = b.angleRangeDeg;
  return angleDeg >= lo && angleDeg <= hi;
}
