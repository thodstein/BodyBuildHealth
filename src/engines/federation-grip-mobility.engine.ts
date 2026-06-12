/**
 * Federation Rules + Grip Training + Mobility Flows + Posture Correction
 *
 * Federation Rules: IPF/WPC/WRPF/USPA rule comparisons, commands, equipment
 * Grip Training: specialized grip protocols (crush, pinch, support, wrist)
 * Mobility Flows: full-body flows for rest/recovery days
 * Posture Engine: assessment tests, corrective exercises, daily routine
 * Competition Calendar: major meets, qualifying totals
 *
 * @module federation-grip-mobility-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface FederationRule {
  fed: string;
  name: string;
  commands: { squat: string[]; bench: string[]; deadlift: string[] };
  equipmentRules: { raw: string; classic_raw: string; equipped: string };
  weightClasses: number[];
  drugTesting: 'WADA' | 'limited' | 'none';
  singletRequired: boolean;
  kneeSleevesAllowed: boolean;
  wristWrapsAllowed: boolean;
  beltAllowed: boolean;
  heelHeightMax: number;
}

export interface GripProtocol {
  name: string;
  type: 'crush' | 'pinch' | 'support' | 'wrist' | 'extensor';
  exercises: { name: string; sets: string; reps: string; frequency: string; notes: string }[];
  weeklySchedule: string;
  progressionModel: string;
}

export interface MobilityFlow {
  name: string;
  durationMin: number;
  targetAreas: string[];
  exercises: { name: string; reps: string; breathing: string; notes: string }[];
}

export interface PostureAssessment {
  view: 'anterior' | 'lateral' | 'posterior';
  test: string;
  normal: string;
  deviation: string;
  condition: string;
  correctiveExercises: string[];
  dailyHabits: string[];
}

export interface CompetitionEvent {
  name: string;
  fed: string;
  date: string;
  location: string;
  type: 'national' | 'regional' | 'international' | 'local';
  qualifyingTotal: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Powerlifting Federation Rules
// ═══════════════════════════════════════════════════════════════════════════

const FEDERATION_RULES: FederationRule[] = [
  {
    fed: 'IPF', name: 'International Powerlifting Federation',
    commands: {
      squat: ['Squat (судья дает)', 'Rack (после возврата)'],
      bench: ['Start (после взятия)', 'Press (после паузы на груди)', 'Rack (после локаута)'],
      deadlift: ['Down (после локаута)'],
    },
    equipmentRules: {
      raw: 'Пояс (10см), наколенники (не sleeves), напульсники. Singlet обязателен.',
      classic_raw: 'Пояс, knee sleeves, напульсники.',
      equipped: 'Squat suit, bench shirt, deadlift suit.',
    },
    weightClasses: [59, 66, 74, 83, 93, 105, 120, 120],
    drugTesting: 'WADA',
    singletRequired: true, kneeSleevesAllowed: true, wristWrapsAllowed: true, beltAllowed: true,
    heelHeightMax: 5,
  },
  {
    fed: 'WPC', name: 'World Powerlifting Congress',
    commands: {
      squat: ['Squat', 'Rack'],
      bench: ['Start', 'Press', 'Rack'],
      deadlift: ['Down'],
    },
    equipmentRules: {
      raw: 'Пояс, наколенники, напульсники. Многослойные костюмы запрещены.',
      classic_raw: 'Knee wraps разрешены в classic raw.',
      equipped: 'Multi-ply suits разрешены.',
    },
    weightClasses: [60, 67.5, 75, 82.5, 90, 100, 110, 125, 140, 140],
    drugTesting: 'limited',
    singletRequired: true, kneeSleevesAllowed: true, wristWrapsAllowed: true, beltAllowed: true,
    heelHeightMax: 10,
  },
  {
    fed: 'WRPF', name: 'World Raw Powerlifting Federation',
    commands: {
      squat: ['Squat', 'Rack'],
      bench: ['Start', 'Press', 'Rack'],
      deadlift: ['Down'],
    },
    equipmentRules: {
      raw: 'Пояс, knee sleeves, wrist wraps.',
      classic_raw: 'Knee wraps в classic raw.',
      equipped: 'Single-ply suits.',
    },
    weightClasses: [56, 60, 67.5, 75, 82.5, 90, 100, 110, 125, 140, 140],
    drugTesting: 'none',
    singletRequired: true, kneeSleevesAllowed: true, wristWrapsAllowed: true, beltAllowed: true,
    heelHeightMax: 10,
  },
  {
    fed: 'USPA', name: 'United States Powerlifting Association',
    commands: {
      squat: ['Start (после unrack)', 'Rack'],
      bench: ['Start', 'Press', 'Rack'],
      deadlift: ['Down'],
    },
    equipmentRules: {
      raw: 'Пояс, knee sleeves, wrist wraps.',
      classic_raw: 'Knee wraps в classic raw.',
      equipped: 'Single-ply.',
    },
    weightClasses: [52, 56, 60, 67.5, 75, 82.5, 90, 100, 110, 125, 140, 140],
    drugTesting: 'limited',
    singletRequired: true, kneeSleevesAllowed: true, wristWrapsAllowed: true, beltAllowed: true,
    heelHeightMax: 5,
  },
];

export function getFederationRules(): FederationRule[] { return FEDERATION_RULES; }

// ═══════════════════════════════════════════════════════════════════════════
// 2. Grip Training Protocols
// ═══════════════════════════════════════════════════════════════════════════

const GRIP_PROTOCOLS: GripProtocol[] = [
  {
    name: 'Crush Grip (Закрытие кисти)', type: 'crush',
    exercises: [
      { name: 'Gripper (Captains of Crush)', sets: '3-5', reps: '3-8', frequency: '2×/нед', notes: 'Прогрессия: T → #0.5 → #1 → #1.5 → #2 → #2.5 → #3. Закрытие — цель.' },
      { name: 'Barbell Finger Curls', sets: '3', reps: '12-15', frequency: '2×/нед', notes: 'Штанга в пальцах, сжать в кулак. Пампинг.' },
      { name: 'Plate Pinch Curls', sets: '3', reps: '8-10', frequency: '1×/нед', notes: 'Два блина вместе гладкой стороной наружу, curl.' },
    ],
    weeklySchedule: 'Пн: тяжёлые grippers (3-5×3-5). Чт: объём grippers (3×8-10) + finger curls.',
    progressionModel: 'Gripper: закройте на 5 чистых → следующий уровень. Finger curl: +1.25 кг/нед.',
  },
  {
    name: 'Pinch Grip (Щипковый хват)', type: 'pinch',
    exercises: [
      { name: 'Plate Pinch Hold', sets: '3-5', reps: 'MAX время', frequency: '2×/нед', notes: 'Два блина гладкой стороной наружу. Удержание на время.' },
      { name: 'Hub Pinch', sets: '3', reps: 'MAX время', frequency: '1×/нед', notes: 'Блин за hub (центральную часть). Очень тяжело.' },
      { name: 'Block Weight Pinch', sets: '3', reps: '3-5 подъёмов', frequency: '1×/нед', notes: 'Block weight (деревянный блок с нагрузкой).'},
    ],
    weeklySchedule: 'Вт: pinch hold (3×max). Пт: block weight (3×3-5) + hub pinch.',
    progressionModel: '+1.25 кг или +5 сек удержания каждую неделю.',
  },
  {
    name: 'Support Grip (Удержание)', type: 'support',
    exercises: [
      { name: 'Dead Hang', sets: '3', reps: 'MAX время', frequency: '3×/нед', notes: 'Вис на турнике. Прогрессия: BW → +5 кг → +10 кг...' },
      { name: 'Farmer Walk', sets: '3-4', reps: '30-60 сек', frequency: '1-2×/нед', notes: 'Тяжёлые гантели/гири. Спина прямая, шаги короткие.' },
      { name: 'Double Overhand Deadlift Hold', sets: '3', reps: '10-15 сек', frequency: '1×/нед', notes: 'Последний подход тяги — удержание в локауте без хватов.' },
      { name: 'Bar Hold (толстый гриф)', sets: '3', reps: 'MAX время', frequency: '1×/нед', notes: 'Fat Gripz или толстый гриф. Значительно тяжелее.' },
    ],
    weeklySchedule: 'Ежедневно: dead hang. Пн/Чт: farmer walk. Сб: DL hold.',
    progressionModel: 'Вис: +5 сек/нед. Farmer: +2.5 кг/нед или +5м.',
  },
  {
    name: 'Wrist & Forearm', type: 'wrist',
    exercises: [
      { name: 'Wrist Curl (сгибание)', sets: '3', reps: '15-20', frequency: '2×/нед', notes: 'Предплечья на скамье. Полная амплитуда.' },
      { name: 'Reverse Wrist Curl (разгибание)', sets: '3', reps: '15-20', frequency: '2×/нед', notes: 'Разгибатели запястья. Хват сверху.' },
      { name: 'Wrist Roller', sets: '3', reps: '2-3 полных цикла', frequency: '1×/нед', notes: 'Верёвка + вес. Скручивать вверх и вниз.' },
      { name: 'Lever Bar (все направления)', sets: '2-3', reps: '8-10', frequency: '1×/нед', notes: 'Radial/ulnar deviation + pronation/supination.' },
    ],
    weeklySchedule: 'Вт/Пт: wrist curl + reverse. Сб: wrist roller.',
    progressionModel: '+1.25 кг/нед на wrist curl. Roller: +0.5 кг или +1 цикл.',
  },
  {
    name: 'Extensor Health (Баланс)', type: 'extensor',
    exercises: [
      { name: 'Rubber Band Extensions', sets: '3-5', reps: '20-30', frequency: 'Ежедневно', notes: 'Резинка на пальцах, разжать. Профилактика дисбаланса.' },
      { name: 'Rice Bucket', sets: '3', reps: '30-60 сек', frequency: '3×/нед', notes: 'Открывать/закрывать кисть в ведре с рисом. Реабилитация.' },
      { name: 'Finger Extensor Bands', sets: '2', reps: '15-20', frequency: '3×/нед', notes: 'Специальные band для каждого пальца.' },
    ],
    weeklySchedule: 'Ежедневно: резинка. 3×/нед: rice bucket.',
    progressionModel: 'Больше повторений или более толстая резинка.',
  },
];

export function getGripProtocols(): GripProtocol[] { return GRIP_PROTOCOLS; }

// ═══════════════════════════════════════════════════════════════════════════
// 3. Mobility Flows (Rest Day Routines)
// ═══════════════════════════════════════════════════════════════════════════

const MOBILITY_FLOWS: MobilityFlow[] = [
  {
    name: 'Full Body Morning Flow', durationMin: 15, targetAreas: ['Весь позвоночник', 'Бёдра', 'Плечи', 'Грудной'],
    exercises: [
      { name: 'Cat-Cow (10 reps)', reps: '10', breathing: 'Вдох — прогиб, выдох — округление', notes: 'Медленно. Каждый позвонок.' },
      { name: 'Thread the Needle', reps: '5/сторону', breathing: 'Выдох на скручивание', notes: 'T-spine rotation.' },
      { name: 'World\'s Greatest Stretch', reps: '5/сторону', breathing: 'Выдох на опускание локтя', notes: 'Hip flexor + T-spine + hamstring.' },
      { name: 'Downward Dog → Upward Dog', reps: '8 циклов', breathing: 'Вдох upward, выдох downward', notes: 'Плавный переход.' },
      { name: '90/90 Hip Switch', reps: '10/сторону', breathing: 'Выдох на переход', notes: 'Колени 90°, переход через сед.' },
      { name: 'Deep Squat Hold', reps: '60 сек', breathing: 'Диафрагмальное', notes: 'Локти раздвигают колени. Пятки на полу.' },
      { name: 'Shoulder CARs', reps: '5/руку', breathing: 'Медленный выдох', notes: 'Controlled Articular Rotations. Максимальный круг.' },
      { name: 'Neck CARs', reps: '5/сторону', breathing: 'Ровное', notes: 'Медленно. Полный круг головой.' },
    ],
  },
  {
    name: 'Hip Opener Flow', durationMin: 10, targetAreas: ['Тазобедренные', 'Пах', 'Ягодицы', 'Поясница'],
    exercises: [
      { name: 'Happy Baby Pose', reps: '60 сек', breathing: 'Диафрагмальное', notes: 'Колени к подмышкам. Поясница на полу.' },
      { name: 'Frog Stretch', reps: '60 сек', breathing: 'Медленный выдох', notes: 'Широко колени, стопы вместе. Опускать таз.' },
      { name: 'Pigeon Pose', reps: '60 сек/ногу', breathing: 'Выдох на наклон', notes: 'Передняя нога 90°. Задняя прямая.' },
      { name: 'Couch Stretch', reps: '60 сек/ногу', breathing: 'Ровное', notes: 'Заднее колено у стены. Таз вперёд.' },
      { name: 'Butterfly', reps: '60 сек', breathing: 'Выдох на наклон', notes: 'Стопы вместе. Локти на бёдра.' },
      { name: 'Pancake Stretch', reps: '60 сек', breathing: 'Выдох на наклон', notes: 'Ноги широко. Наклон вперёд с прямой спиной.' },
    ],
  },
  {
    name: 'Spine & Shoulder Flow', durationMin: 12, targetAreas: ['Позвоночник', 'Плечи', 'Шея', 'Грудной отдел'],
    exercises: [
      { name: 'Foam Roll Thoracic', reps: '60 сек', breathing: 'Выдох на разгибание', notes: 'Ролл под лопатками. Руки за голову.' },
      { name: 'Open Book Stretch', reps: '8/сторону', breathing: 'Выдох на поворот', notes: 'Колени вместе. Верхняя рука раскрывается.' },
      { name: 'Child Pose with Lat Stretch', reps: '60 сек', breathing: 'Диафрагмальное', notes: 'Руки вперёд, таз на пятки. Сместить руки вправо/влево.' },
      { name: 'Wall Shoulder Dislocates', reps: '10', breathing: 'Свободное', notes: 'ПВХ-труба. Максимально узкий хват.' },
      { name: 'Doorway Pec Stretch', reps: '60 сек/сторону', breathing: 'Выдох на углубление', notes: 'Рука на косяке. Корпус вперёд.' },
      { name: 'Brettzel Stretch', reps: '45 сек/сторону', breathing: 'Выдох на скручивание', notes: 'Одна нога согнута поверх другой. Противоположная рука тянется.' },
    ],
  },
];

export function getMobilityFlows(): MobilityFlow[] { return MOBILITY_FLOWS; }

// ═══════════════════════════════════════════════════════════════════════════
// 4. Posture Assessment & Correction
// ═══════════════════════════════════════════════════════════════════════════

const POSTURE_ASSESSMENTS: PostureAssessment[] = [
  {
    view: 'lateral', test: 'Проверка осанки сбоку',
    normal: 'Ухо — плечо — бедро — колено — лодыжка на одной линии.',
    deviation: 'Голова вперёд, плечи округлены.',
    condition: 'Upper Crossed Syndrome (Верхний перекрёстный синдром)',
    correctiveExercises: [
      'Chin tucks 3×10 ежедневно',
      'Band Pull-Apart 3×15',
      'Wall Angel 3×8',
      'Doorway pec stretch 3×30 сек',
      'Face Pull 3×15',
    ],
    dailyHabits: ['Экран на уровне глаз', 'Подушка не выше 10 см', 'Каждые 30 мин — chin tuck'],
  },
  {
    view: 'lateral', test: 'Наклон таза',
    normal: 'ASIS и PSIS на одном уровне (поясница — небольшой лордоз).',
    deviation: 'Таз наклонен вперёд (ASIS ниже PSIS). Поясница — гиперлордоз.',
    condition: 'Lower Crossed Syndrome (Нижний перекрёстный синдром)',
    correctiveExercises: [
      'Glute Bridge 3×15 (держать 2с вверху)',
      'Dead Bug 3×8/сторону',
      'Hip Flexor Stretch 3×30 сек',
      'Plank 3×30-60 сек',
      'RDL с акцентом на ягодицы',
    ],
    dailyHabits: ['Не стоять с выпяченным животом', 'Сидеть на седалищных буграх', 'Растяжка hip flexor после долгого сидения'],
  },
  {
    view: 'anterior', test: 'Положение плеч',
    normal: 'Плечи на одном уровне. Ладони смотрят друг на друга (нейтрально).',
    deviation: 'Плечи подняты к ушам и/или округлены вперёд. Ладони смотрят назад.',
    condition: 'Elevated + Internally Rotated Shoulders',
    correctiveExercises: [
      'Scapular Push-Up 3×10',
      'External Rotation (band) 3×15',
      'Dead Hang 3×30-60 сек',
      'Wall Slide 3×8',
      'Face Pull 3×15 (высоко)',
    ],
    dailyHabits: ['Расслаблять плечи при сидении', 'Монитор на уровне глаз', 'Не спать на животе'],
  },
  {
    view: 'posterior', test: 'Положение лопаток',
    normal: 'Медиальный край лопатки параллелен позвоночнику на расстоянии 7-8 см.',
    deviation: 'Лопатка отходит от грудной клетки ("крыловидная лопатка").',
    condition: 'Scapular Winging (слабый serratus anterior)',
    correctiveExercises: [
      'Serratus Push-Up (push-up plus) 3×10',
      'Wall Slide с акцентом на serratus 3×8',
      'Band Pull-Apart 3×15',
      'Prone Y-Raise 3×10',
    ],
    dailyHabits: ['Не опираться на локоть при сидении', 'Спать на спине'],
  },
  {
    view: 'anterior', test: 'Положение коленей',
    normal: 'Колени направлены вперёд. Q-angle в норме.',
    deviation: 'Колени заваливаются внутрь (вальгус) при приседе/ходьбе.',
    condition: 'Knee Valgus (слабые отводящие бедра + плохая проприоцепция)',
    correctiveExercises: [
      'Clamshell с резиной 3×15',
      'Lateral Band Walk 3×10 шагов/сторону',
      'Single Leg Balance 3×30 сек',
      'Goblet Squat с акцентом на "колени наружу"',
      'Hip Airplane 3×5',
    ],
    dailyHabits: ['Осознанно держать колени над стопами при ходьбе', 'Не скрещивать ноги при сидении'],
  },
];

export function getPostureAssessments(): PostureAssessment[] { return POSTURE_ASSESSMENTS; }
export function getPostureByDeviation(deviation: string): PostureAssessment | undefined {
  return POSTURE_ASSESSMENTS.find(p => p.deviation.toLowerCase().includes(deviation.toLowerCase()));
}
export function getAllCorrectives(): string[] {
  return [...new Set(POSTURE_ASSESSMENTS.flatMap(p => p.correctiveExercises))];
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Competition Calendar (Major Meets)
// ═══════════════════════════════════════════════════════════════════════════

const COMPETITION_CALENDAR: CompetitionEvent[] = [
  { name: 'Чемпионат России (ФПР/IPF)', fed: 'ФПР/IPF', date: 'Март', location: 'Разные города', type: 'national', qualifyingTotal: { '59': 420, '66': 480, '74': 530, '83': 570, '93': 600, '105': 630, '120': 660 } },
  { name: 'Кубок России (ФПР/IPF)', fed: 'ФПР/IPF', date: 'Октябрь', location: 'Разные города', type: 'national', qualifyingTotal: { '59': 400, '66': 460, '74': 510, '83': 550, '93': 580, '105': 610, '120': 640 } },
  { name: 'Чемпионат Европы (EPF/IPF)', fed: 'EPF/IPF', date: 'Май', location: 'Европа', type: 'international', qualifyingTotal: { '59': 500, '66': 560, '74': 610, '83': 650, '93': 680, '105': 710, '120': 740 } },
  { name: 'Чемпионат Мира (IPF)', fed: 'IPF', date: 'Июнь', location: 'Мировая', type: 'international', qualifyingTotal: { '59': 550, '66': 610, '74': 670, '83': 710, '93': 750, '105': 780, '120': 810 } },
  { name: 'WPC World Championships', fed: 'WPC', date: 'Ноябрь', location: 'США/Европа', type: 'international', qualifyingTotal: { '67.5': 500, '75': 550, '82.5': 600, '90': 630, '100': 670, '110': 700 } },
  { name: 'WRPF Pro/Am', fed: 'WRPF', date: 'Разные', location: 'США/Россия', type: 'national', qualifyingTotal: { '75': 500, '82.5': 550, '90': 580, '100': 620, '110': 660 } },
];

export function getCompetitionCalendar(): CompetitionEvent[] { return COMPETITION_CALENDAR; }
export function getQualifyingTotal(fed: string, weightClass: number): number {
  const event = COMPETITION_CALENDAR.find(e => e.fed.toLowerCase().includes(fed.toLowerCase()));
  if (!event) return 0;
  const weights = Object.keys(event.qualifyingTotal).map(Number);
  const closest = weights.reduce((prev, curr) => Math.abs(curr - weightClass) < Math.abs(prev - weightClass) ? curr : prev);
  return event.qualifyingTotal[String(closest)] || 0;
}
