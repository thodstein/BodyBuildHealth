/**
 * Injury Prevention + Rehab + Cycle Designer + Blood Work Engine
 *
 * Injury Prevention: prehab routines per exercise pattern, warmup sets, mobility work
 * Rehab Engine: injury-specific recovery protocols with phase progression
 * Cycle Designer: AAS cycle builder with compound selection, dosing, PCT timing
 * Blood Work Analyzer: drug-specific lab panel recommendations with scheduling
 *
 * @module injury-cycle-blood-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PrehabRoutine {
  exerciseName: string;
  targetPattern: string;
  exercises: { name: string; sets: number; reps: number; holdSec: number; band: boolean; notes: string }[];
  frequency: string;
  durationMin: number;
}

export interface InjuryRehabPhase {
  phase: 'acute' | 'subacute' | 'strengthening' | 'return_to_sport';
  weeks: number;
  exercises: { name: string; sets: number; reps: number; intensity: string; frequency: string; notes: string }[];
  restrictions: string[];
  goals: string[];
}

export interface RehabProtocol {
  injury: string;
  totalWeeks: number;
  phases: InjuryRehabPhase[];
  returnCriteria: string[];
}

export interface CycleCompound {
  name: string;
  dosageMg: number;
  frequencyPerWeek: number;
  startWeek: number;
  endWeek: number;
  ester: string;
  class: string;
}

export interface CycleDesign {
  name: string;
  totalWeeks: number;
  compounds: CycleCompound[];
  pctStartWeek: number;
  pctProtocol: { compound: string; dosageMg: number; frequency: string; weeks: number; scheme?: string }[];
  onCycleSupport: string[];
  labSchedule: { week: number; panel: string; markers: string[] }[];
  expectedResults: string;
  riskLevel: 'beginner' | 'intermediate' | 'advanced' | 'extreme';
}

export interface BloodWorkPanel {
  name: string;
  markers: string[];
  frequency: string;
  estimatedCost: string;
}

export interface BloodWorkSchedule {
  preCycle: BloodWorkPanel[];
  during: { week: number; panels: string[] }[];
  postCycle: BloodWorkPanel[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Prehab Engine
// ═══════════════════════════════════════════════════════════════════════════

const PREHAB_DB: PrehabRoutine[] = [
  {
    exerciseName: 'Приседания (все вариации)',
    targetPattern: 'squat',
    exercises: [
      { name: 'Clamshell (ракушка)', sets: 2, reps: 15, holdSec: 0, band: true, notes: 'Активация ягодиц, колени наружу' },
      { name: 'Hip Airplane', sets: 2, reps: 8, holdSec: 3, band: false, notes: 'Стабильность тазобедренного' },
      { name: 'Goblet Squat (пауза 3с)', sets: 2, reps: 6, holdSec: 3, band: false, notes: 'Контроль глубины, позиция торса' },
      { name: 'Ankle Mobilization', sets: 2, reps: 10, holdSec: 0, band: false, notes: 'Дорсифлексия 30°+' },
    ],
    frequency: 'Перед каждой squat-тренировкой',
    durationMin: 8,
  },
  {
    exerciseName: 'Становая тяга',
    targetPattern: 'hinge',
    exercises: [
      { name: 'Dead Bug', sets: 2, reps: 8, holdSec: 5, band: false, notes: 'Брейсинг кора, нейтральный позвоночник' },
      { name: 'Bird Dog', sets: 2, reps: 8, holdSec: 3, band: false, notes: 'Стабильность при разгибании' },
      { name: 'Cat-Cow', sets: 2, reps: 10, holdSec: 0, band: false, notes: 'Мобильность позвоночника' },
      { name: 'Band Good Morning', sets: 2, reps: 12, holdSec: 0, band: true, notes: 'Паттерн hip hinge с сопротивлением' },
      { name: 'RDL (пустой гриф)', sets: 2, reps: 10, holdSec: 0, band: false, notes: 'Растяжка задней цепи' },
    ],
    frequency: 'Перед каждой deadlift-тренировкой',
    durationMin: 10,
  },
  {
    exerciseName: 'Жим лёжа',
    targetPattern: 'horizontal_push',
    exercises: [
      { name: 'Band Pull-Apart', sets: 2, reps: 15, holdSec: 0, band: true, notes: 'Активация задних дельт и ромбовидных' },
      { name: 'External Rotation (band)', sets: 2, reps: 12, holdSec: 0, band: true, notes: 'Ротаторная манжета' },
      { name: 'Scapular Push-Up', sets: 2, reps: 10, holdSec: 2, band: false, notes: 'Стабильность лопаток' },
      { name: 'Wall Slide', sets: 2, reps: 8, holdSec: 3, band: false, notes: 'Мобильность плеч, upward rotation' },
    ],
    frequency: 'Перед каждой bench-тренировкой',
    durationMin: 7,
  },
  {
    exerciseName: 'Жим над головой',
    targetPattern: 'vertical_push',
    exercises: [
      { name: 'Dead Hang', sets: 1, reps: 1, holdSec: 30, band: false, notes: 'Декомпрессия плеч' },
      { name: 'Shoulder Dislocates (PVC)', sets: 2, reps: 10, holdSec: 0, band: false, notes: 'Мобильность плечевого пояса' },
      { name: 'YTWL Complex', sets: 1, reps: 8, holdSec: 2, band: false, notes: 'Все плоскости движения лопаток' },
      { name: 'External Rotation (side-lying)', sets: 2, reps: 12, holdSec: 0, band: false, notes: 'Infraspinatus/teres minor' },
    ],
    frequency: 'Перед каждой overhead-тренировкой',
    durationMin: 8,
  },
  {
    exerciseName: 'Подтягивания / тяги',
    targetPattern: 'vertical_pull',
    exercises: [
      { name: 'Scapular Pull-Up', sets: 2, reps: 8, holdSec: 2, band: false, notes: 'Активация нижних трапеций' },
      { name: 'Banded Lat Stretch', sets: 2, reps: 5, holdSec: 15, band: true, notes: 'Растяжка широчайших' },
      { name: 'Face Pull (light)', sets: 2, reps: 15, holdSec: 1, band: false, notes: 'Внешнее вращение + задние дельты' },
    ],
    frequency: 'Перед каждой pull-тренировкой',
    durationMin: 6,
  },
];

export function getPrehabRoutine(pattern: string): PrehabRoutine | undefined {
  return PREHAB_DB.find(p => p.targetPattern === pattern);
}

export function getAllPrehabRoutines(): PrehabRoutine[] {
  return PREHAB_DB;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Rehab Engine
// ═══════════════════════════════════════════════════════════════════════════

const REHAB_PROTOCOLS: Record<string, RehabProtocol> = {
  knee_acl: {
    injury: 'Повреждение ПКС (колено)',
    totalWeeks: 24,
    phases: [
      {
        phase: 'acute', weeks: 2,
        exercises: [
          { name: 'Quad Sets (изометрия)', sets: 3, reps: 10, intensity: '0%', frequency: '3×/день', notes: 'Напряжение квадрицепса 10с' },
          { name: 'Ankle Pumps', sets: 3, reps: 20, intensity: '0%', frequency: '3×/день', notes: 'Профилактика ТЭЛА' },
        ],
        restrictions: ['Полная разгрузка', 'Костыли', 'Лёд 20мин каждый час'],
        goals: ['Контроль отёка', 'Полное пассивное разгибание'],
      },
      {
        phase: 'subacute', weeks: 4,
        exercises: [
          { name: 'Straight Leg Raise', sets: 3, reps: 10, intensity: '0%', frequency: '2×/день', notes: 'Без отставания квадрицепса' },
          { name: 'Heel Slides', sets: 3, reps: 10, intensity: '0%', frequency: '2×/день', notes: 'Сгибание до 90°' },
          { name: 'Glute Bridge', sets: 3, reps: 12, intensity: '0%', frequency: '1×/день', notes: 'Активация ягодиц' },
        ],
        restrictions: ['Брейс в покое', 'Ходьба с костылями'],
        goals: ['ROM 0-90°', 'Активация квадрицепса без отставания'],
      },
      {
        phase: 'strengthening', weeks: 12,
        exercises: [
          { name: 'Leg Press (двумя)', sets: 3, reps: 12, intensity: '50-70%', frequency: '3×/нед', notes: 'Постепенное увеличение' },
          { name: 'Step-Ups (низкие)', sets: 3, reps: 10, intensity: 'BW', frequency: '3×/нед', notes: 'Контроль колена' },
          { name: 'Hamstring Curl', sets: 3, reps: 12, intensity: '60%', frequency: '3×/нед', notes: 'Изолированно' },
          { name: 'Single Leg Balance', sets: 3, reps: 1, intensity: 'BW', frequency: 'Ежедневно', notes: 'Проприоцепция 30с+' },
        ],
        restrictions: ['Без бега', 'Без прыжков', 'Без ротационных движений'],
        goals: ['Полный ROM', 'Сила 80% от здоровой ноги', 'Ходьба без хромоты'],
      },
      {
        phase: 'return_to_sport', weeks: 6,
        exercises: [
          { name: 'Bulgarian Split Squat', sets: 3, reps: 8, intensity: '60-80%', frequency: '3×/нед', notes: 'С отягощением' },
          { name: 'Box Jumps (низкие)', sets: 3, reps: 5, intensity: 'BW', frequency: '2×/нед', notes: 'Мягкое приземление' },
          { name: 'Agility Ladder', sets: 3, reps: 1, intensity: 'BW', frequency: '2×/нед', notes: 'Координация' },
        ],
        restrictions: ['Избегать контактных видов спорта'],
        goals: ['Сила 95%+ от здоровой', 'Прыжок 90%+', 'Спринт без боли'],
      },
    ],
    returnCriteria: ['Сила ≥95%', 'Прыжок ≥90%', 'Hop test симметричный', 'Отсутствие отёка после нагрузки'],
  },
  shoulder_rotator: {
    injury: 'Повреждение ротаторной манжеты',
    totalWeeks: 16,
    phases: [
      {
        phase: 'acute', weeks: 2,
        exercises: [
          { name: 'Pendulum Swings', sets: 3, reps: 20, intensity: '0%', frequency: '3×/день', notes: 'Пассивная мобилизация' },
          { name: 'Scapular Retraction', sets: 3, reps: 10, intensity: '0%', frequency: '2×/день', notes: 'Лопатки вместе' },
        ],
        restrictions: ['Без нагрузки', 'Без подъёмов над головой', 'Лёд 15мин 4×/день'],
        goals: ['Контроль боли', 'Пассивный ROM'],
      },
      {
        phase: 'subacute', weeks: 4,
        exercises: [
          { name: 'External Rotation (no weight)', sets: 3, reps: 15, intensity: '0%', frequency: '2×/день', notes: 'Локоть прижат' },
          { name: 'Internal Rotation (no weight)', sets: 3, reps: 15, intensity: '0%', frequency: '2×/день', notes: 'Без боли' },
          { name: 'Wall Slides', sets: 3, reps: 8, intensity: '0%', frequency: '2×/день', notes: 'Активная мобильность' },
        ],
        restrictions: ['Только изометрия', 'Без отягощений'],
        goals: ['Активный ROM без боли', 'Активация лопаточных стабилизаторов'],
      },
      {
        phase: 'strengthening', weeks: 8,
        exercises: [
          { name: 'Band External Rotation', sets: 3, reps: 12, intensity: 'Light', frequency: '4×/нед', notes: 'Прогрессия сопротивления' },
          { name: 'YTWL with light weight', sets: 2, reps: 8, intensity: '1-2kg', frequency: '4×/нед', notes: 'Все плоскости' },
          { name: 'Prone Horizontal Abduction', sets: 3, reps: 10, intensity: '1-2kg', frequency: '3×/нед', notes: 'Задние дельты' },
        ],
        restrictions: ['Без жимов над головой', 'Без тяжёлых жимов'],
        goals: ['Сила внешней ротации ≥80%', 'Без боли при активности'],
      },
      {
        phase: 'return_to_sport', weeks: 2,
        exercises: [
          { name: 'Dumbbell Press (light)', sets: 3, reps: 12, intensity: '40-50%', frequency: '3×/нед', notes: 'Постепенное возвращение' },
          { name: 'Cable Row', sets: 3, reps: 10, intensity: '60%', frequency: '3×/нед', notes: 'Без боли' },
        ],
        restrictions: ['Избегать резких overhead движений'],
        goals: ['Жим без боли', 'Полный функциональный ROM'],
      },
    ],
    returnCriteria: ['Без боли при жиме', 'Внешняя ротация 90%+', 'Empty can test отрицательный'],
  },
  lower_back: {
    injury: 'Боль в пояснице (неспецифическая)',
    totalWeeks: 8,
    phases: [
      {
        phase: 'acute', weeks: 1,
        exercises: [
          { name: 'Cat-Cow', sets: 3, reps: 10, intensity: '0%', frequency: '3×/день', notes: 'Медленно, без боли' },
          { name: 'Dead Bug', sets: 3, reps: 6, intensity: '0%', frequency: '2×/день', notes: 'Брейсинг кора' },
          { name: 'Diaphragmatic Breathing', sets: 3, reps: 5, intensity: '0%', frequency: '3×/день', notes: '360° дыхание' },
        ],
        restrictions: ['Без сгибаний', 'Без скручиваний', 'Без нагрузки на спину'],
        goals: ['Контроль боли', 'Активация глубоких мышц кора'],
      },
      {
        phase: 'subacute', weeks: 3,
        exercises: [
          { name: 'Bird Dog', sets: 3, reps: 8, intensity: 'BW', frequency: '2×/день', notes: 'Без ротации таза' },
          { name: 'Side Plank', sets: 3, reps: 1, intensity: 'BW', frequency: '2×/день', notes: 'Держать 20-30с' },
          { name: 'Glute Bridge', sets: 3, reps: 12, intensity: 'BW', frequency: '2×/день', notes: 'Активация ягодиц' },
          { name: 'McGill Curl-Up', sets: 3, reps: 8, intensity: 'BW', frequency: '2×/день', notes: 'Фиксация поясницы' },
        ],
        restrictions: ['Без осевой нагрузки', 'Без сгибаний позвоночника под нагрузкой'],
        goals: ['Активация кора без боли', 'Стабильность в динамике'],
      },
      {
        phase: 'strengthening', weeks: 3,
        exercises: [
          { name: 'Goblet Squat (light)', sets: 3, reps: 10, intensity: '30-40%', frequency: '3×/нед', notes: 'Нейтральный позвоночник' },
          { name: 'Trap Bar Deadlift (light)', sets: 3, reps: 8, intensity: '40-50%', frequency: '2×/нед', notes: 'Альтернатива классике' },
          { name: 'Pallof Press', sets: 3, reps: 10, intensity: 'Band', frequency: '3×/нед', notes: 'Антиротация' },
        ],
        restrictions: ['Без максимальных весов', 'Без округления спины'],
        goals: ['Присед 60% без боли', 'Тяга 50% без боли'],
      },
      {
        phase: 'return_to_sport', weeks: 1,
        exercises: [
          { name: 'Back Squat', sets: 3, reps: 5, intensity: '70%', frequency: '3×/нед', notes: 'Постепенно' },
          { name: 'Deadlift', sets: 3, reps: 3, intensity: '70%', frequency: '2×/нед', notes: 'Фокус на технику' },
        ],
        restrictions: ['Избегать отказа', 'RPE ≤ 8'],
        goals: ['Возврат к 80% рабочих весов без боли'],
      },
    ],
    returnCriteria: ['Без боли 24ч после тренировки', 'Полный ROM без ограничений', 'Обычные веса без боли'],
  },
};

export function getRehabProtocol(injury: string): RehabProtocol | undefined {
  return REHAB_PROTOCOLS[injury];
}

export function getAllRehabProtocols(): { injury: string; weeks: number }[] {
  return Object.entries(REHAB_PROTOCOLS).map(([k, v]) => ({ injury: v.injury, weeks: v.totalWeeks }));
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Blood Work Schedule Engine
// ═══════════════════════════════════════════════════════════════════════════

const BLOOD_PANELS: Record<string, BloodWorkPanel> = {
  basic_health: {
    name: 'Базовое здоровье',
    markers: ['ОАК (HCT, HGB, RBC, WBC, PLT)', 'АЛТ, АСТ, ГГТ', 'Креатинин, Мочевина', 'Липидный профиль', 'Глюкоза'],
    frequency: 'Каждые 4-6 недель на курсе',
    estimatedCost: '3,000-5,000 ₽',
  },
  hormone_panel: {
    name: 'Гормональная панель',
    markers: ['Тестостерон общий', 'Тестостерон свободный', 'Эстрадиол (E2)', 'Пролактин', 'ЛГ, ФСГ', 'ГСПГ', 'ДГТ'],
    frequency: 'До курса, на 4-й неделе, перед ПКТ, через 4 нед ПКТ',
    estimatedCost: '5,000-8,000 ₽',
  },
  cardiac_panel: {
    name: 'Кардио-панель',
    markers: ['NT-proBNP', 'hs-TnI', 'CK-MB', 'Галектин-3', 'АД мониторинг'],
    frequency: 'До курса, каждые 8 недель при риске',
    estimatedCost: '4,000-6,000 ₽',
  },
  renal_panel: {
    name: 'Почечная панель',
    markers: ['Цистатин С', 'Креатинин', 'СКФ (CKD-EPI)', 'Микроальбуминурия', 'KIM-1 (опционально)'],
    frequency: 'До курса, каждые 4-6 недель',
    estimatedCost: '2,500-4,000 ₽',
  },
  liver_deep: {
    name: 'Печень (расширенная)',
    markers: ['АЛТ, АСТ, ГГТ, ЩФ', 'Билирубин общий + прямой', 'Желчные кислоты', 'CK-18 (опционально)', 'FibroMax'],
    frequency: 'При использовании оральных ААС — каждые 4 недели',
    estimatedCost: '4,000-7,000 ₽',
  },
  thyroid: {
    name: 'Щитовидная',
    markers: ['ТТГ', 'Т4 своб.', 'Т3 своб.', 'Реверсивный Т3'],
    frequency: 'При использовании ГР — каждые 8 недель',
    estimatedCost: '2,000-3,000 ₽',
  },
  coagulation: {
    name: 'Коагулограмма',
    markers: ['Фибриноген', 'D-димер', 'АЧТВ', 'ПТИ/INR', 'Антитромбин III'],
    frequency: 'При HCT >50% или использовании станазолола',
    estimatedCost: '2,500-3,500 ₽',
  },
};

export function getBloodPanels(): BloodWorkPanel[] {
  return Object.values(BLOOD_PANELS);
}

export function getBloodWorkSchedule(hasOrals: boolean, hasTren: boolean, hasGH: boolean, has19nor: boolean): BloodWorkSchedule {
  const preCycle: BloodWorkPanel[] = [
    BLOOD_PANELS.basic_health, BLOOD_PANELS.hormone_panel, BLOOD_PANELS.cardiac_panel, BLOOD_PANELS.renal_panel,
  ];
  if (hasOrals) preCycle.push(BLOOD_PANELS.liver_deep);
  if (hasGH) preCycle.push(BLOOD_PANELS.thyroid);

  const during: BloodWorkSchedule['during'] = [];
  for (let w = 4; w <= 16; w += 4) {
    const panels = ['basic_health', 'hormone_panel'];
    if (hasOrals) panels.push('liver_deep');
    if (hasTren || hasGH) panels.push('renal_panel');
    if (hasGH) panels.push('thyroid');
    during.push({ week: w, panels });
  }

  const postCycle: BloodWorkPanel[] = [
    BLOOD_PANELS.hormone_panel, BLOOD_PANELS.basic_health,
  ];

  return { preCycle, during, postCycle };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Cycle Designer
// ═══════════════════════════════════════════════════════════════════════════

const CYCLE_TEMPLATES: CycleDesign[] = [
  {
    name: 'Новичок (Тестостерон соло)', totalWeeks: 12,
    compounds: [
      { name: 'Тестостерон энантат', dosageMg: 400, frequencyPerWeek: 2, startWeek: 1, endWeek: 12, ester: 'enanthate', class: 'testosterone' },
    ],
    pctStartWeek: 14,
    pctProtocol: [
      { compound: 'Кломифен', dosageMg: 50, frequency: 'ежедневно', weeks: 2 },
      { compound: 'Кломифен', dosageMg: 25, frequency: 'ежедневно', weeks: 2 },
    ],
    onCycleSupport: ['TUDCA 500мг', 'Омега-3 4г', 'Магний 400мг'],
    labSchedule: [
      { week: 0, panel: 'Pre-cycle', markers: ['ОАК','Биохимия','Гормоны','Липиды'] },
      { week: 6, panel: 'Mid-cycle', markers: ['ОАК','Биохимия','E2','Липиды'] },
      { week: 12, panel: 'End-cycle', markers: ['ОАК','Биохимия','Гормоны'] },
    ],
    expectedResults: '+6-10 кг за цикл. Прирост силы 15-25%. Удержание 60-70% после ПКТ.',
    riskLevel: 'beginner',
  },
  {
    name: 'Средний (Тест + Оральный)', totalWeeks: 12,
    compounds: [
      { name: 'Тестостерон энантат', dosageMg: 500, frequencyPerWeek: 2, startWeek: 1, endWeek: 12, ester: 'enanthate', class: 'testosterone' },
      { name: 'Метандростенолон', dosageMg: 30, frequencyPerWeek: 7, startWeek: 1, endWeek: 6, ester: 'oral', class: 'oral_17aa' },
    ],
    pctStartWeek: 14,
    pctProtocol: [
      { compound: 'Кломифен', dosageMg: 50, frequency: 'ежедневно', weeks: 2 },
      { compound: 'Кломифен', dosageMg: 25, frequency: 'ежедневно', weeks: 2 },
      { compound: 'Тамоксифен', dosageMg: 20, frequency: 'ежедневно', weeks: 4 },
    ],
    onCycleSupport: ['TUDCA 1000мг', 'NAC 1200мг', 'Омега-3 6г', 'Магний 400мг', 'Анастрозол 0.25мг 2×/нед (при E2↑)'],
    labSchedule: [
      { week: 0, panel: 'Baseline', markers: ['ОАК','Биохимия','Печень','Гормоны','Липиды'] },
      { week: 4, panel: 'Mid-cycle', markers: ['Печень','E2','Липиды'] },
      { week: 8, panel: 'Late', markers: ['ОАК','Биохимия','Печень','E2','Липиды'] },
      { week: 12, panel: 'End', markers: ['ОАК+Биохимия+Гормоны+Липиды'] },
    ],
    expectedResults: '+8-12 кг. Быстрый старт от орального. Повышенная гепатотоксичность.',
    riskLevel: 'intermediate',
  },
  {
    name: 'Продвинутый (Тест + Трен + Мастерон)', totalWeeks: 12,
    compounds: [
      { name: 'Тестостерон энантат', dosageMg: 250, frequencyPerWeek: 2, startWeek: 1, endWeek: 12, ester: 'enanthate', class: 'testosterone' },
      { name: 'Тренболон энантат', dosageMg: 300, frequencyPerWeek: 2, startWeek: 1, endWeek: 10, ester: 'enanthate', class: 'trenbolone' },
      { name: 'Дростанолон пропионат', dosageMg: 400, frequencyPerWeek: 3, startWeek: 1, endWeek: 12, ester: 'propionate', class: 'drostanolone' },
    ],
    pctStartWeek: 16,
    pctProtocol: [
      { compound: 'Кломифен', dosageMg: 50, frequency: 'ежедневно', weeks: 2 },
      { compound: 'Кломифен', dosageMg: 25, frequency: 'ежедневно', weeks: 2 },
      { compound: 'Тамоксифен', dosageMg: 20, frequency: 'ежедневно', weeks: 6 },
      { compound: 'ХГЧ', dosageMg: 500, frequency: '2×/нед', weeks: 3, scheme: '3/1 (3 нед через 1)' },
    ],
    onCycleSupport: ['TUDCA 1000мг', 'NAC 1200мг', 'Омега-3 6г', 'Магний 600мг', 'Каберголин 0.25мг 2×/нед (профилактика)'],
    labSchedule: [
      { week: 0, panel: 'Full baseline', markers: ['ОАК','Биохимия','Печень','Почки','Гормоны','Липиды','Пролактин','PSA'] },
      { week: 4, panel: 'Check', markers: ['Печень','E2','Пролактин','Липиды'] },
      { week: 8, panel: 'Check', markers: ['ОАК','Печень','Почки','E2','Пролактин','Липиды','PSA'] },
      { week: 12, panel: 'End', markers: ['Полная панель + ПКТ-план'] },
    ],
    expectedResults: '+6-10 кг сухой массы. Значительный прирост силы. Агрессия, потливость, бессонница.',
    riskLevel: 'advanced',
  },
];

export function getCycleTemplates(): CycleDesign[] {
  return CYCLE_TEMPLATES;
}

export function designCustomCycle(
  compounds: { name: string; dosageMg: number; freq: number; startWeek: number; endWeek: number; ester: string; class: string }[],
  name: string,
): CycleDesign {
  const maxEndWeek = Math.max(...compounds.map(c => c.endWeek));
  const has19nor = compounds.some(c => c.class === 'trenbolone' || c.class === 'nandrolone');
  const hasOrals = compounds.some(c => c.ester === 'oral' || c.class === 'oral_17aa');

  // PCT start: 5 × longest half-life days after last pin
  const esterHL: Record<string, number> = { propionate: 2, acetate: 2, enanthate: 14, cypionate: 18, decanoate: 21, undecanoate: 60, oral: 1 };
  const maxHL = Math.max(...compounds.map(c => esterHL[c.ester] || 7));
  const pctStartWeek = maxEndWeek + Math.ceil(maxHL / 7);

  const riskLevel: CycleDesign['riskLevel'] = compounds.length >= 4 ? 'extreme'
    : compounds.length >= 3 ? 'advanced'
    : compounds.length >= 2 && has19nor ? 'advanced'
    : 'intermediate';

  return {
    name,
    totalWeeks: maxEndWeek,
    compounds: compounds.map(c => ({ ...c, frequencyPerWeek: c.freq })) as CycleCompound[],
    pctStartWeek,
    pctProtocol: has19nor
      ? [
          { compound: 'ХГЧ', dosageMg: 500, frequency: '2×/нед', weeks: 3, scheme: '3/1 (3 нед через 1)' },
          { compound: 'Кломифен', dosageMg: 50, frequency: 'ежедневно', weeks: 2 },
          { compound: 'Кломифен', dosageMg: 25, frequency: 'ежедневно', weeks: 2 },
          { compound: 'Тамоксифен', dosageMg: 20, frequency: 'ежедневно', weeks: 4 },
        ]
      : [
          { compound: 'Кломифен', dosageMg: 50, frequency: 'ежедневно', weeks: 2 },
          { compound: 'Кломифен', dosageMg: 25, frequency: 'ежедневно', weeks: 2 },
          { compound: 'Тамоксифен', dosageMg: 20, frequency: 'ежедневно', weeks: 4 },
        ],
    onCycleSupport: hasOrals
      ? ['TUDCA 1000мг', 'NAC 1200мг', 'Омега-3 6г', 'Магний 400мг']
      : ['Омега-3 4г', 'Магний 400мг', 'Цинк 50мг'],
    labSchedule: [],
    expectedResults: 'Индивидуально',
    riskLevel,
  };
}
