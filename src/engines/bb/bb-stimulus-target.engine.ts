/**
 * bb-stimulus-target.engine.ts — «стимул в цель», а не «вес поднят» (MAX PRO: руки + дельты + грудь/спина/ноги).
 *
 * Отвечает на вопрос: насколько нагрузка упражнения доходит до целевой мышцы/головки.
 * Канон функции мышцы — TARGET_MUSCLE_DB (анатомия/mmc), канон упражнения — EXERCISE_CATALOG.
 * Здесь только связка: головки, сетап-чеклист, линия сопротивления, читинг-карта, RIR-норма, ROM-норма.
 * Чистые функции, без мутаций. ESM-safe (статические импорты).
 */
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';

export type StimulusFlag =
  | 'wrongHead'
  | 'setupRisk'
  | 'resistanceLineGap'
  | 'romShort'
  | 'stabilityGap'
  | 'rirMismatch'
  | 'synergistTakeover';

export interface HeadFunction {
  head: string; // 'triceps_long'
  muscle: string; // 'triceps'
  label: string; // 'Длинная головка трицепса'
  stretchCondition: string; // когда головка растянута
  loadedBy: string[]; // имена-ориентиры упражнений
}

/** Функции головок (сверено с TARGET_MUSCLE_DB + bb-labels + EXERCISE_CATALOG.targetMuscle). */
export const HEAD_FUNCTIONS: Record<string, HeadFunction> = {
  triceps_long: {
    head: 'triceps_long', muscle: 'triceps', label: 'Длинная головка трицепса (масса)',
    stretchCondition: 'Плечо согнуто — руки над головой / за головой',
    loadedBy: ['Французский жим', 'Разгибания из-за головы', 'Overhead'],
  },
  triceps_lateral: {
    head: 'triceps_lateral', muscle: 'triceps', label: 'Латеральная головка трицепса',
    stretchCondition: 'Нагружается в любом разгибании локтя; пик — в сокращённой',
    loadedBy: ['Разгибание на блоке', 'Кикбэк', 'Жим узким'],
  },
  biceps_long: {
    head: 'biceps_long', muscle: 'biceps', label: 'Длинная головка бицепса (пик)',
    stretchCondition: 'Плечо сзади корпуса — руки висят (наклонная скамья) + супинация',
    loadedBy: ['Наклонная скамья', 'Байесовское сгибание', 'Драг-сгибание'],
  },
  biceps_short: {
    head: 'biceps_short', muscle: 'biceps', label: 'Короткая головка бицепса',
    stretchCondition: 'Локоть впереди корпуса — Скамья Скотта, паучьи, концентрированные',
    loadedBy: ['Скамья Скотта', 'Паучьи', 'Концентрированные'],
  },
  brachialis: {
    head: 'brachialis', muscle: 'biceps', label: 'Брахиалис (толщина руки)',
    stretchCondition: 'Нейтральный/пронированный хват — молот',
    loadedBy: ['Молот', 'Hammer'],
  },
  delt_mid: {
    head: 'delt_mid', muscle: 'shoulders', label: 'Средняя дельта (ширина)',
    stretchCondition: 'Отведение в плоскости лопатки, наклон ~15°',
    loadedBy: ['Махи в стороны', 'Lateral raise', 'Тяга к подбородку до сосков'],
  },
  delt_rear: {
    head: 'delt_rear', muscle: 'shoulders', label: 'Задняя дельта',
    stretchCondition: 'Наклон 60-70°, локти вверх',
    loadedBy: ['Махи в наклоне', 'Face pull', 'Тяга к лицу'],
  },
  delt_front: {
    head: 'delt_front', muscle: 'shoulders', label: 'Передняя дельта',
    stretchCondition: 'Жим вверх перед собой, локти под грифом',
    loadedBy: ['Армейский жим', 'Жим гантелей сидя'],
  },
  chest_upper: {
    head: 'chest_upper', muscle: 'chest', label: 'Верх груди (ключичная)',
    stretchCondition: 'Скамья 30° (не 45°), гриф к подбородку/верху груди',
    loadedBy: ['Жим на наклонной 30°', 'Жим гантелей на наклонной'],
  },
  chest_mid: {
    head: 'chest_mid', muscle: 'chest', label: 'Середина груди',
    stretchCondition: 'Горизонтальный жим, локти 75°, гриф к соскам',
    loadedBy: ['Жим штанги лёжа', 'Жим гантелей лёжа', 'Сведение в тренажёре'],
  },
  chest_lower: {
    head: 'chest_lower', muscle: 'chest', label: 'Низ груди',
    stretchCondition: 'Наклон вперёд 30-40° (брусья) или скамья −15°',
    loadedBy: ['Брусья грудным стилем', 'Жим на decline'],
  },
  back_width: {
    head: 'back_width', muscle: 'back', label: 'Ширина спины (широчайшие)',
    stretchCondition: 'Вис/растяжение внизу, тяга локтями к карманам',
    loadedBy: ['Подтягивания', 'Тяга верхнего блока'],
  },
  back_thickness: {
    head: 'back_thickness', muscle: 'back', label: 'Толщина спины (центр/ромбы)',
    stretchCondition: 'Наклон с упором, локти в стороны 60-90°, сведение лопаток',
    loadedBy: ['Тяга Т-грифа', 'Тяга с упором грудью', 'Тяга горизонтального блока'],
  },
  quads: {
    head: 'quads', muscle: 'quads', label: 'Квадрицепс',
    stretchCondition: 'Глубокий присед (бёдра ниже параллели), пятки прижаты',
    loadedBy: ['Приседания', 'Гакк-присед', 'Жим ногами', 'Разгибания ног (прямая мышца)'],
  },
  hamstrings: {
    head: 'hamstrings', muscle: 'hamstrings', label: 'Бицепс бедра',
    stretchCondition: 'Шарнир: таз назад (RDL) или полное сгибание колена (curl)',
    loadedBy: ['Румынская тяга', 'Сгибания ног'],
  },
  glutes: {
    head: 'glutes', muscle: 'glutes', label: 'Ягодицы',
    stretchCondition: 'Таз до прямой с паузой 2с (хип-траст), толчок пяткой',
    loadedBy: ['Ягодичный мост/хип-траст'],
  },
  calves: {
    head: 'calves', muscle: 'calves', label: 'Икры',
    stretchCondition: 'Полная амплитуда ниже уровня платформы, пауза 2с вверху',
    loadedBy: ['Подъёмы на носки стоя'],
  },
  traps: {
    head: 'traps', muscle: 'traps', label: 'Трапеции (верх)',
    stretchCondition: 'Опущенные плечи внизу, подъём строго вверх с паузой 1-2с',
    loadedBy: ['Шраги со штангой/гантелями', 'Шраги Келсо (середина)'],
  },
  forearms: {
    head: 'forearms', muscle: 'forearms', label: 'Предплечья (хват)',
    stretchCondition: 'Предплечья зафиксированы, движение только кистями, 15-20 повторов',
    loadedBy: ['Сгибания запястий', 'Валик/роллер'],
  },
  abs: {
    head: 'abs', muscle: 'abs', label: 'Пресс (прямая мышца)',
    stretchCondition: 'Скручивание грудью к тазу / подкручивание таза, пауза в пике',
    loadedBy: ['Скручивания', 'Подъём ног в висе'],
  },
};

export function headsForMuscle(muscle: string): string[] {
  const m = String(muscle || '').toLowerCase();
  return Object.values(HEAD_FUNCTIONS)
    .filter((h) => h.muscle === m || (m === 'arms' && (h.muscle === 'biceps' || h.muscle === 'triceps')))
    .map((h) => h.head);
}

export interface CheatingEntry {
  deviation: string; // что делает пользователь (ключевые слова)
  steals: string; // кто забирает нагрузку
}

export interface ExerciseStimulus {
  key: string;
  ids: string[]; // id каталога
  nameRe: RegExp[]; // fallback по русскому имени
  headsHit: string[]; // головки, получающие стимул
  headsPartial?: string[]; // частичный стимул
  alternativesForMissed?: Record<string, string[]>; // слабая головка -> чем закрыть
  setup: string[]; // чек-лист положения корпуса/суставов
  resistanceLine: string; // линия сопротивления + где пик
  peakPoint: 'lengthened' | 'mid' | 'short';
  needsPause: boolean; // пауза в пике обязательна
  stability: 'low' | 'med' | 'high'; // требования к стабильности
  cheating: CheatingEntry[]; // отклонение -> кто забирает
  rirTarget: [number, number]; // норма RIR: изоляция 1-2, база 2-3
  rom: string; // норма полной амплитуды
}

/** Руки + дельты + грудь/спина/ноги. Мышц без записей нет = диагноз молчит (neutral). */
export const EXERCISE_STIMULUS_DB: ExerciseStimulus[] = [
  {
    key: 'pushdown',
    ids: ['tricep_pushdown_rope', 'tricep_pushdown_bar', 'tricep_pushdown_single'],
    nameRe: [/разгибание.*блок/i, /блок.*(канат|вер[её]вк)/i, /pushdown/i],
    headsHit: ['triceps_lateral'],
    headsPartial: [],
    alternativesForMissed: { triceps_long: ['Французский жим лёжа', 'Разгибания из-за головы в блоке'] },
    setup: ['Локти прижаты к корпусу и неподвижны', 'Корпус вертикально, без наклона вперёд', 'Хват сверху, кисти жёсткие'],
    resistanceLine: 'Трос тянет строго вверх — пик момента внизу, в сокращённой. Пауза 1с внизу обязательна, иначе пик теряется',
    peakPoint: 'short',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'локти вперёд/вверх', steals: 'передняя дельта' },
      { deviation: 'раскачка корпусом', steals: 'грудь и широчайшие (моментум вместо трицепса)' },
      { deviation: 'неполное выпрямление', steals: 'теряется пиковое сокращение латеральной' },
    ],
    rirTarget: [1, 2],
    rom: 'Полное выпрямление рук ↔ сгибание локтя ~90° и выше',
  },
  {
    key: 'overhead_ext',
    ids: ['overhead_tricep_ext', 'overhead_tricep_db_both', 'tricep_overhead_rope', 'bb_triceps_long'],
    nameRe: [/из-за голов/i, /над голов/i, /overhead/i],
    headsHit: ['triceps_long'],
    alternativesForMissed: { triceps_lateral: ['Разгибание на блоке с канатом'] },
    setup: ['Плечи согнуты — локти у головы/за головой', 'Локти зафиксированы, не разъезжаются', 'Корпус вертикально, поясница нейтраль'],
    resistanceLine: 'Нагрузка максимальна внизу, в растянутой длинной головке. Опускай за голову, не ко лбу',
    peakPoint: 'lengthened',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'локти разъезжаются в стороны', steals: 'грудь и передняя дельта' },
      { deviation: 'неполное опускание (до лба)', steals: 'теряется растяжение длинной головки' },
    ],
    rirTarget: [1, 2],
    rom: 'Глубокое опускание за голову ↔ полное выпрямление',
  },
  {
    key: 'french_press',
    ids: ['tricep_push', 'french_press_bar', 'french_press_db', 'db_skullcrusher'],
    nameRe: [/француз/i, /skullcrusher/i, /череп/i],
    headsHit: ['triceps_long'],
    alternativesForMissed: { triceps_lateral: ['Разгибание на блоке с канатом'] },
    setup: ['Локти зафиксированы над плечами', 'Опускание за голову (не ко лбу) = растяжение', 'Не разводить локти'],
    resistanceLine: 'Пик в растянутой длинной головке внизу. Пауза 1с внизу',
    peakPoint: 'lengthened',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'локти в стороны', steals: 'передняя дельта' },
      { deviation: 'дожим грудью (мостик)', steals: 'грудь вместо трицепса' },
    ],
    rirTarget: [1, 2],
    rom: 'За голову ↔ выпрямление, локти неподвижны',
  },
  {
    key: 'kickback',
    ids: ['kickback', 'kickback_v2', 'kickback_cable', 'cable_tricep_kickback', 'tricep_kickback_cable'],
    nameRe: [/кикб[еэ]к/i, /kickback/i, /разгибание.*наклон/i],
    headsHit: ['triceps_lateral'],
    alternativesForMissed: { triceps_long: ['Французский жим лёжа'] },
    setup: ['Корпус в наклоне ~45°, локоть выше корпуса и зафиксирован', 'Разгибание до прямой руки с паузой 1с'],
    resistanceLine: 'Пик в сокращённой вверху. Лёгкий вес + идеальная форма, не гонись за весом',
    peakPoint: 'short',
    needsPause: true,
    stability: 'high',
    cheating: [
      { deviation: 'локоть падает вниз', steals: 'задняя дельта' },
      { deviation: 'рывок корпусом', steals: 'моментум вместо пикового сокращения' },
    ],
    rirTarget: [1, 2],
    rom: 'Согнутая рука ↔ полное выпрямление с паузой',
  },
  {
    key: 'incline_curl',
    ids: ['incline_db_curl', 'curl_db_incline_45', 'bb_biceps_long', 'bayesian_curl', 'drag_curl'],
    nameRe: [/наклон.*скам/i, /incline.*curl/i, /байес/i, /bayesian/i, /драг/i, /drag.*curl/i],
    headsHit: ['biceps_long'],
    alternativesForMissed: { biceps_short: ['Скамья Скотта', 'Паучьи сгибания'], brachialis: ['Молот'] },
    setup: ['Скамья 30-45° назад, руки висят сзади корпуса = растяжение', 'Локти прижаты, не уходят вперёд', 'Супинация (разворот мизинца наружу) вверху'],
    resistanceLine: 'Пик в растянутой внизу. Пауза 1с внизу + пик 1с вверху',
    peakPoint: 'lengthened',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'локти вперёд', steals: 'короткая головка и передняя дельта' },
      { deviation: 'раскачка корпусом', steals: 'поясница и дельты вместо бицепса' },
    ],
    rirTarget: [1, 2],
    rom: 'Полный вис внизу ↔ полное сгибание с супинацией',
  },
  {
    key: 'preacher_curl',
    ids: ['preacher_curl', 'preacher_hammer'],
    nameRe: [/скотт/i, /скамь.*скотта/i, /preacher/i, /пауч/i, /spider/i, /концентр/i, /concentration/i],
    headsHit: ['biceps_short'],
    headsPartial: ['biceps_long'],
    alternativesForMissed: { biceps_long: ['Подъём на наклонной скамье', 'Байесовское сгибание'], brachialis: ['Молот'] },
    setup: ['Подмышки на скамье, плечо зафиксировано', 'Полное растяжение внизу, без отбива'],
    resistanceLine: 'Натяжение по всей дуге, акцент — середина/пик. Пауза 1с в пике',
    peakPoint: 'mid',
    needsPause: true,
    stability: 'low',
    cheating: [
      { deviation: 'отрыв плеча от скамьи', steals: 'передняя дельта' },
      { deviation: 'укороченная амплитуда сверху', steals: 'теряется пиковое сокращение' },
    ],
    rirTarget: [1, 2],
    rom: 'Полное растяжение внизу ↔ полный пик вверху',
  },
  {
    key: 'hammer_curl',
    ids: ['hammer_curl'],
    nameRe: [/молот/i, /hammer/i],
    headsHit: ['brachialis'],
    headsPartial: ['biceps_long'],
    alternativesForMissed: { biceps_long: ['Подъём на наклонной скамье'], biceps_short: ['Скамья Скотта'] },
    setup: ['Нейтральный хват (ладони друг к другу)', 'Локти прижаты, без раскачки'],
    resistanceLine: 'Равномерное натяжение, акцент — брахиалис под бицепсом (толщина руки)',
    peakPoint: 'mid',
    needsPause: false,
    stability: 'low',
    cheating: [{ deviation: 'раскачка', steals: 'дельты и поясница' }],
    rirTarget: [1, 2],
    rom: 'Полное разгибание ↔ полное сгибание',
  },
  {
    key: 'lateral_raise',
    ids: ['lateral_raise', 'lateral_raise_cable', 'lateral_raise_machine', 'lateral_raise_single', 'lateral_raise_v2'],
    nameRe: [/махи.*сторон/i, /развед.*сторон/i, /lateral.*raise/i, /дельт.*махи/i],
    headsHit: ['delt_mid'],
    alternativesForMissed: { delt_rear: ['Махи в наклоне', 'Face pull'], delt_front: ['Армейский жим'] },
    setup: ['Наклон вперёд ~15°, лопатки опущены', 'Веди локтями, мизинец выше большого', 'До уровня плеч — не выше'],
    resistanceLine: 'Гантель тянет вниз всю дугу; трос снизу даёт равномерное натяжение. Пауза 1с вверху',
    peakPoint: 'mid',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'выше плеч', steals: 'трапеция' },
      { deviation: 'раскачка корпусом', steals: 'моментум вместо дельты' },
      { deviation: 'кисти ведут, локти прямые', steals: 'трапеция и предплечья' },
    ],
    rirTarget: [1, 2],
    rom: 'Руки вдоль тела ↔ уровень плеч с паузой',
  },
  {
    key: 'rear_delt',
    ids: ['rear_delt_fly', 'rear_delt_machine'],
    nameRe: [/задн.*дельт/i, /rear.*delt/i, /махи.*наклон/i, /face.?pull/i, /тяга к лицу/i],
    headsHit: ['delt_rear'],
    alternativesForMissed: { delt_mid: ['Махи в стороны с опорой'] },
    setup: ['Наклон 60-70°', 'Локти вверх (не назад), мизинец ведёт', 'Своди лопатки, не кругли спину'],
    resistanceLine: 'Пик в сведении лопаток. Пауза 1с в пике',
    peakPoint: 'short',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'локти назад вдоль тела', steals: 'широчайшие' },
      { deviation: 'кругление спины', steals: 'нагрузка уходит с дельты, риск поясницы' },
    ],
    rirTarget: [1, 2],
    rom: 'Руки внизу/сведены ↔ разведение с паузой',
  },
  {
    key: 'ohp',
    ids: ['ohp', 'ohp_seated', 'ohp_seated_bar', 'ohp_seated_db', 'ohp_db', 'db_press', 'smith_shoulder_press'],
    nameRe: [/армейский/i, /жим.*сидя/i, /жим.*стоя/i, /overhead.*press/i, /ohp/i],
    headsHit: ['delt_front'],
    headsPartial: ['delt_mid'],
    alternativesForMissed: { delt_mid: ['Махи в стороны'], delt_rear: ['Махи в наклоне'] },
    setup: ['Локти под грифом', 'Таз напряжён, без прогиба поясницы', 'Жим до выпрямления без щелчка локтей'],
    resistanceLine: 'База: грузит переднюю дельту + трицепс. Для средней — это компромисс, не изоляция',
    peakPoint: 'mid',
    needsPause: false,
    stability: 'high',
    cheating: [
      { deviation: 'прогиб поясницы', steals: 'верх груди вместо дельты' },
      { deviation: 'неполная амплитуда', steals: 'теряется верхняя доля движения' },
    ],
    rirTarget: [2, 3],
    rom: 'Гриф к ключице ↔ выпрямление рук',
  },
  {
    key: 'incline_press',
    ids: ['incline_bar', 'incline_db', 'smith_incline'],
    nameRe: [/наклон.*жим/i, /жим.*наклон/i, /incline.*press/i],
    headsHit: ['chest_upper'],
    alternativesForMissed: { chest_mid: ['Жим штанги лёжа', 'Сведение в тренажёре'], chest_lower: ['Брусья грудным стилем'] },
    setup: ['Скамья 30° (не 45°)', 'Лопатки сведены+опущены, грудь колесом', 'Локти 75° к корпусу, гриф к подбородку/верху груди'],
    resistanceLine: 'Пик в растянутой внизу. Угол 45° переносит нагрузку на переднюю дельту — главный вор верха груди',
    peakPoint: 'lengthened',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'угол 45°', steals: 'передняя дельта' },
      { deviation: 'локти 90° в стороны', steals: 'плечевой сустав (стресс вместо стимула)' },
      { deviation: 'отбив от груди', steals: 'моментум вместо растянутой позиции' },
    ],
    rirTarget: [2, 3],
    rom: 'Гриф к верху груди ↔ выпрямление (гантели — со сведением)',
  },
  {
    key: 'flat_press',
    ids: ['bench_bar', 'bench_db', 'machine_chest_press'],
    nameRe: [/жим штанги лёжа/i, /жим гантелей лёжа/i, /bench(?!.*incline)/i, /жим в смите/i, /жим в тренажёре/i],
    headsHit: ['chest_mid'],
    alternativesForMissed: { chest_upper: ['Жим на наклонной 30°'], chest_lower: ['Брусья грудным стилем'] },
    setup: ['Лопатки сведены вниз, грудь колесом', 'Локти 75° к корпусу', 'Гриф к соскам, без отбива'],
    resistanceLine: 'База середины груди. Сведение гантелей вверху добавляет пиковое сокращение',
    peakPoint: 'mid',
    needsPause: false,
    stability: 'med',
    cheating: [
      { deviation: 'локти 90° в стороны', steals: 'плечевой сустав (стресс вместо груди)' },
      { deviation: 'отбив от груди', steals: 'моментум вместо стимула' },
      { deviation: 'чрезмерный мост', steals: 'низ груди и трицепс вместо середины' },
    ],
    rirTarget: [2, 3],
    rom: 'Гриф к соскам ↔ выпрямление',
  },
  {
    key: 'dips_decline',
    ids: ['dips_chest', 'decline_bar', 'decline_db'],
    nameRe: [/брусья/i, /dips/i, /отрицательн/i, /decline/i],
    headsHit: ['chest_lower'],
    alternativesForMissed: { chest_upper: ['Жим на наклонной 30°'], chest_mid: ['Жим гантелей лёжа'] },
    setup: ['Брусья: наклон корпуса 30-40° вперёд, локти в стороны', 'Decline: гриф к низу груди', 'Глубокое опускание с растяжением'],
    resistanceLine: 'Низ груди работает в растянутой внизу. Вертикальные брусья — уже трицепс, не грудь',
    peakPoint: 'lengthened',
    needsPause: false,
    stability: 'high',
    cheating: [
      { deviation: 'вертикальный корпус на брусьях', steals: 'трицепс вместо низа груди' },
      { deviation: 'короткая амплитуда сверху', steals: 'теряется растяжение низа груди' },
    ],
    rirTarget: [2, 3],
    rom: 'Глубокое опускание ↔ мощное сведение вверх',
  },
  {
    key: 'fly_stretch',
    ids: ['fly_db', 'fly_cable', 'dumbbell_pullover'],
    nameRe: [/разводк/i, /fly_db/i, /пуловер/i, /pullover/i],
    headsHit: ['chest_mid'],
    alternativesForMissed: { chest_upper: ['Жим на наклонной 30°'] },
    setup: ['Локти слегка согнуты и зафиксированы', 'Широкий полукруг — как обнимаешь дерево', 'Вес вторичен, форма первична'],
    resistanceLine: 'Изоляция в растянутой — главный стимул здесь, не вес. Пауза 1-2с внизу',
    peakPoint: 'lengthened',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'сгибание локтей в жим', steals: 'трицепс вместо растяжения груди' },
      { deviation: 'слишком тяжёлый вес', steals: 'передняя дельта' },
    ],
    rirTarget: [1, 2],
    rom: 'Широкое растяжение внизу ↔ сведение вверху',
  },
  {
    key: 'crossover_peak',
    ids: ['crossover_cable', 'pec_deck', 'butterfly'],
    nameRe: [/кроссовер/i, /crossover/i, /пек/i, /pec.?deck/i, /бабочк/i, /butterfly/i, /сведение.*тренаж/i],
    headsHit: ['chest_mid'],
    alternativesForMissed: { chest_upper: ['Жим на наклонной 30°'] },
    setup: ['Корпус слегка вперёд, плечи опущены', 'Сведение до касания/креста с паузой 1-2с', 'Не отпускай вес резко'],
    resistanceLine: 'Пик в сокращённой — здесь держится то, чего нет в жимах. Пауза в сведении обязательна',
    peakPoint: 'short',
    needsPause: true,
    stability: 'low',
    cheating: [{ deviation: 'короткое сведение без паузы', steals: 'теряется пиковое сокращение — главный смысл упражнения' }],
    rirTarget: [1, 2],
    rom: 'Растяжение ↔ полное сведение с паузой',
  },
  {
    key: 'vertical_pull',
    ids: ['pullup', 'pullup_wide', 'pulldown', 'pulldown_wide', 'pulldown_vbar', 'pulldown_single', 'lat_pulldown', 'chinup', 'pullup_neutral'],
    nameRe: [/подтягиван/i, /pull.?up/i, /тяга верхн/i, /pulldown/i, /пуллдаун/i, /верхн.*блок/i],
    headsHit: ['back_width'],
    alternativesForMissed: { back_thickness: ['Тяга Т-грифа', 'Тяга горизонтального блока'] },
    setup: ['Тяга локтями вниз к карманам, не кистями', 'Лопатки вниз-назад, грудь вперёд', 'Тяга к верхней части груди, не за голову'],
    resistanceLine: 'Широчайшие растянуты в висе и сокращаются по всей дуге. Сведение лопаток вверху + медленный возврат 2-3с',
    peakPoint: 'lengthened',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'тяга за голову', steals: 'шея и плечевой сустав (стресс вместо ширины)' },
      { deviation: 'раскачка корпусом', steals: 'моментум вместо широчайших' },
      { deviation: 'тяга кистями без сведения лопаток', steals: 'бицепс вместо спины' },
    ],
    rirTarget: [1, 3],
    rom: 'Полный вис с растяжением ↔ подбородок/гриф к груди',
  },
  {
    key: 'horizontal_row',
    ids: ['row_bar', 'row_tbar', 'row_db', 'seated_row', 'row_seal', 'row_pendlay', 'yates_row', 'row_cable_single'],
    nameRe: [/тяга штанги в наклоне/i, /тяга гантели/i, /т-гриф/i, /t.?bar/i, /seal row/i, /тяга горизонтального/i],
    headsHit: ['back_thickness'],
    headsPartial: ['back_width'],
    alternativesForMissed: { back_width: ['Подтягивания', 'Тяга верхнего блока'] },
    setup: ['Локти в стороны 60-90° (центр) — вдоль тела только для широчайших', 'Тяга к низу живота/груди', 'Сведение лопаток на 1с, корпус фиксирован'],
    resistanceLine: 'Толщина строится сведением лопаток в пике. Без паузы — гребля бицепсом',
    peakPoint: 'mid',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'раскачка корпусом', steals: 'поясница вместо центра спины' },
      { deviation: 'тяга кистями без сведения', steals: 'бицепс вместо ромбовидных' },
      { deviation: 'кругление спины', steals: 'нагрузка уходит с мышц, риск поясницы' },
    ],
    rirTarget: [2, 3],
    rom: 'Растяжение с грудью вперёд ↔ сведение лопаток 1с',
  },
  {
    key: 'squat_press',
    ids: ['squat', 'hack_squat', 'squat_smith', 'leg_press', 'bulgarian_split_squat', 'bulgarian_split', 'bulgarian_split_db', 'bulgarian_bw'],
    nameRe: [/присед/i, /squat/i, /гакк/i, /hack/i, /жим ногами/i, /leg.?press/i, /болгар/i, /bulgarian/i],
    headsHit: ['quads'],
    headsPartial: ['glutes'],
    setup: ['Стопы ширина плеч, носки чуть наружу', 'Колени по линии носков, не внутрь', 'Глубина: бёдра ниже параллели, пятки прижаты'],
    resistanceLine: 'Квадрицепс в растянутой внизу — глубина решает. Полуприсед = потерянный стимул',
    peakPoint: 'lengthened',
    needsPause: false,
    stability: 'high',
    cheating: [
      { deviation: 'колени внутрь (вальгус)', steals: 'связки колена (травма вместо стимула)' },
      { deviation: 'полуприсед', steals: 'теряется растянутая позиция — главный драйвер' },
      { deviation: 'таз вверх первым (гудморнинг)', steals: 'поясница и ягодицы вместо квадрицепса' },
    ],
    rirTarget: [2, 3],
    rom: 'Бёдра ниже параллели ↔ выпрямление без блокировки',
  },
  {
    key: 'leg_extension',
    ids: ['leg_ext', 'leg_ext_v2', 'leg_ext_single', 'single_leg_extension'],
    nameRe: [/разгибание ног/i, /leg.?ext/i],
    headsHit: ['quads'],
    setup: ['Спинка вертикально, валик на голеностопе', 'Пауза 1-2с вверху, возврат 3с'],
    resistanceLine: 'Пик в сокращённой — изоляция прямой мышцы бедра. Добивка после базы, не замена',
    peakPoint: 'short',
    needsPause: true,
    stability: 'low',
    cheating: [{ deviation: 'рывок и отрыв таза', steals: 'моментум вместо пикового сокращения' }],
    rirTarget: [1, 2],
    rom: 'Полное сгибание ↔ разгибание с паузой',
  },
  {
    key: 'rdl_hinge',
    ids: ['rdl', 'deadlift_romanian', 'good_morning', 'single_leg_rdl', 'single_leg_rdl_v2', 'kb_single_leg_rdl'],
    nameRe: [/румын/i, /rdl/i, /гудморнинг/i, /good.?morning/i],
    headsHit: ['hamstrings'],
    headsPartial: ['glutes'],
    setup: ['Таз назад (шарнир), штанга скользит по ногам', 'Колени мягкие 15-20°, спина нейтраль', 'Растяжение сзади внизу 1с'],
    resistanceLine: 'Бицепс бедра в растянутой под нагрузкой — эталон stretch-mediated. Кругление убивает всё',
    peakPoint: 'lengthened',
    needsPause: true,
    stability: 'med',
    cheating: [
      { deviation: 'кругление поясницы', steals: 'межпозвоночные диски (травма вместо бицепса бедра)' },
      { deviation: 'штанга далеко от ног', steals: 'поясница вместо задней цепи' },
      { deviation: 'присед вместо шарнира', steals: 'квадрицепс вместо бицепса бедра' },
    ],
    rirTarget: [2, 3],
    rom: 'Растяжение сзади ↔ сокращение ягодицами вперёд',
  },
  {
    key: 'leg_curl_iso',
    ids: ['leg_curl', 'leg_curl_lying', 'leg_curl_seated', 'leg_curl_single', 'single_leg_curl'],
    nameRe: [/сгибание ног/i, /leg.?curl/i, /норд/i, /nordic/i],
    headsHit: ['hamstrings'],
    setup: ['Таз прижат к скамье', 'Пауза 1с в пике, медленный возврат'],
    resistanceLine: 'Пик в сокращённой. Пара к RDL: шарнир + сгибание = полный бицепс бедра',
    peakPoint: 'short',
    needsPause: true,
    stability: 'low',
    cheating: [{ deviation: 'отрыв таза', steals: 'поясница и моментум вместо пика бицепса' }],
    rirTarget: [1, 2],
    rom: 'Полное разгибание ↔ полное сгибание с паузой',
  },
  {
    key: 'hip_thrust_glute',
    ids: ['hip_thrust', 'hip_thrust_single', 'single_leg_glute_bridge'],
    nameRe: [/хип/i, /hip.?thrust/i, /ягодичный мост/i, /glute.?bridge/i],
    headsHit: ['glutes'],
    setup: ['Подбородок прижат, взгляд вперёд', 'Таз до прямой линии (не выше — без переразгибания)', 'Пауза 2с вверху'],
    resistanceLine: 'Пик в сокращённой вверху. Лучшее упражнение для ягодиц по EMG именно с паузой',
    peakPoint: 'short',
    needsPause: true,
    stability: 'low',
    cheating: [
      { deviation: 'переразгибание поясницы', steals: 'поясница вместо ягодиц' },
      { deviation: 'толчок носками', steals: 'квадрицепс вместо ягодиц' },
    ],
    rirTarget: [1, 2],
    rom: 'Растяжение внизу ↔ таз в линию с паузой 2с',
  },
  {
    key: 'calf_raise_iso',
    ids: ['calf_raise', 'calf_raise_single', 'standing_calf'],
    nameRe: [/носк/i, /calf/i, /подъём на носки/i, /икроножн/i, /икр/i],
    headsHit: ['calves'],
    setup: ['Ниже уровня платформы (ступенька)', 'Колено прямо стоя / 90° сидя (камбаловидная)', 'Пауза 2с вверху, растяжение 2с внизу'],
    resistanceLine: 'Икры растут от полной амплитуды + пауз. Пружинистые пол-амплитуды = впустую',
    peakPoint: 'lengthened',
    needsPause: true,
    stability: 'low',
    cheating: [
      { deviation: 'короткая амплитуда/пружинишь', steals: 'ахилл вместо икроножной' },
      { deviation: 'согнутые колени стоя', steals: 'камбаловидная вместо икроножной (не ошибка, если цель — она)' },
    ],
    rirTarget: [1, 2],
    rom: 'Ниже платформы ↔ верх на носках с паузой 2с',
  },
  {
    key: 'shrug_trap',
    ids: ['shrug_bar', 'shrug_db', 'shrug_behind', 'shrug_cable', 'kelso_shrug'],
    nameRe: [/шраг/i, /shrug/i, /келсо/i, /kelso/i, /трапеци/i],
    headsHit: ['traps'],
    setup: ['Руки прямые вдоль тела', 'Движение строго вверх-вниз', 'Пауза 1-2с вверху'],
    resistanceLine: 'Верх трапеции работает в сокращённой. Пауза вверху — весь смысл; без неё — пустые пожимания',
    peakPoint: 'short',
    needsPause: true,
    stability: 'low',
    cheating: [
      { deviation: 'вращение плечами', steals: 'суставная сумка (стресс вместо стимула)' },
      { deviation: 'рывок ногами/подсед', steals: 'моментум вместо верха трапеций' },
      { deviation: 'тяга руками (сгибание локтей)', steals: 'бицепс вместо трапеций' },
    ],
    rirTarget: [1, 2],
    rom: 'Опущенные плечи ↔ верх с паузой 1-2с',
  },
  {
    key: 'wrist_forearm',
    ids: ['wrist_curl', 'wrist_curl_db', 'wrist_curl_v2', 'wrist_curl_db_v2', 'wrist_curl_reverse', 'curl_wrist', 'curl_wrist_reverse', 'curl_wrist_db', 'wrist_extension_db', 'wrist_roller'],
    nameRe: [/запяст/i, /кист/i, /wrist/i, /валик/i, /roller/i, /предплеч/i, /forearm/i],
    headsHit: ['forearms'],
    setup: ['Предплечья лежат на бёдрах/скамье и неподвижны', 'Движение только кистями', 'Полная амплитуда, 15-20 повторов'],
    resistanceLine: 'Мелкая мышца — стимул от полной амплитуды и жжения, не от веса. Тяжёлый вес зовёт бицепс',
    peakPoint: 'short',
    needsPause: true,
    stability: 'low',
    cheating: [
      { deviation: 'помогают локти и плечи', steals: 'бицепс вместо предплечий' },
      { deviation: 'укороченная амплитуда', steals: 'теряется единственное преимущество изоляции' },
    ],
    rirTarget: [1, 2],
    rom: 'Полное разгибание кисти ↔ полное сгибание',
  },
  {
    key: 'crunch_abs',
    ids: ['crunch', 'crunch_reverse', 'cable_crunch', 'cable_crunch_v2', 'crunch_cable_kneeling', 'crunch_machine', 'decline_crunch', 'swiss_ball_crunch', 'crunch_bicycle'],
    nameRe: [/скручиван/i, /crunch/i, /велосипед/i],
    headsHit: ['abs'],
    setup: ['Поясница прижата', 'Скручивание грудью к тазу (не подъём корпуса)', 'Пауза 1с в пике'],
    resistanceLine: 'Пресс сокращается скручиванием, а не подъёмом. Подъём корпуса — уже сгибатели бедра',
    peakPoint: 'short',
    needsPause: true,
    stability: 'low',
    cheating: [
      { deviation: 'подъём корпуса вместо скручивания', steals: 'сгибатели бедра вместо пресса' },
      { deviation: 'тяга руками за голову', steals: 'шея вместо пресса' },
      { deviation: 'раскачка/инерция', steals: 'моментум вместо пикового сокращения' },
    ],
    rirTarget: [1, 2],
    rom: 'Растяжение ↔ полное скручивание с паузой',
  },
  {
    key: 'hanging_leg_abs',
    ids: ['hanging_leg', 'knee_raise'],
    nameRe: [/подъём ног/i, /подъём колен/i, /hanging/i, /ног.*висе/i],
    headsHit: ['abs'],
    setup: ['Вис без раскачки', 'Подкручивание таза вверху (не просто ноги)', 'Медленное опускание 3с'],
    resistanceLine: 'Низ пресса включается подкручиванием таза. Просто махи ногами — сгибатели бедра',
    peakPoint: 'short',
    needsPause: false,
    stability: 'med',
    cheating: [
      { deviation: 'раскачка', steals: 'моментум вместо пресса' },
      { deviation: 'ноги без подкручивания таза', steals: 'сгибатели бедра вместо низа пресса' },
    ],
    rirTarget: [1, 2],
    rom: 'Вис ↔ колени/носки к груди с подкручиванием таза',
  },
];

function norm(s: string): string {
  return String(s || '').toLowerCase().trim();
}

function findCatalogId(ex: { id?: string; name?: string }): string | null {
  const wantId = ex.id ? norm(ex.id) : '';
  if (wantId) {
    const hit = (EXERCISE_CATALOG as any[]).find((c) => norm(c.id) === wantId);
    if (hit) return String(hit.id);
  }
  if (ex.name) {
    const low = norm(ex.name);
    const hit = (EXERCISE_CATALOG as any[]).find((c) => norm(c.name) === low || norm(c.id) === low);
    if (hit) return String(hit.id);
  }
  return ex.id ? String(ex.id) : null;
}

/** Резолв записи стимула: по id каталога, иначе по имени (рус/eng fallback). */
export function resolveStimulus(ex: { id?: string; name?: string }): ExerciseStimulus | null {
  const catId = findCatalogId(ex);
  if (catId) {
    const byId = EXERCISE_STIMULUS_DB.find((r) => r.ids.map(norm).includes(norm(catId)));
    if (byId) return byId;
  }
  const nm = norm(ex.name || ex.id || '');
  if (!nm) return null;
  return EXERCISE_STIMULUS_DB.find((r) => r.nameRe.some((re) => re.test(nm))) || null;
}

/** Какие головки грузит упражнение напрямую (строго headsHit, без partial). */
export function headsHitOf(ex: { id?: string; name?: string }): string[] {
  const rec = resolveStimulus(ex);
  if (!rec) return [];
  return [...rec.headsHit];
}

/** Чем закрыть слабую головку. */
export function alternativesForHead(head: string): string[] {
  const out: string[] = [];
  for (const rec of EXERCISE_STIMULUS_DB) {
    if (rec.headsHit.includes(head)) {
      const label = rec.setup[0] ? `${rec.key}` : rec.key;
      void label;
      // человеческие имена берём из headsHit-записей через loadedBy канона головки
      out.push(rec.key);
    }
    const alt = rec.alternativesForMissed?.[head];
    if (alt) for (const a of alt) if (!out.includes(a)) out.push(a);
  }
  const canon = HEAD_FUNCTIONS[head]?.loadedBy || [];
  for (const c of canon) if (!out.includes(c)) out.push(c);
  return out.slice(0, 6);
}

/** Сетап-гид для PROF-карточки: чек-лист + куда уйдёт нагрузка. */
export function setupGuideFor(headOrMuscle: string): { checklist: string[]; leaks: string[] } {
  const key = norm(headOrMuscle);
  const recs = EXERCISE_STIMULUS_DB.filter(
    (r) => r.headsHit.includes(key) || r.headsHit.some((h) => HEAD_FUNCTIONS[h]?.muscle === key),
  );
  const checklist: string[] = [];
  const leaks: string[] = [];
  for (const r of recs.slice(0, 3)) {
    for (const s of r.setup.slice(0, 2)) if (!checklist.includes(s)) checklist.push(s);
    for (const c of r.cheating.slice(0, 2)) {
      const leak = `${c.deviation} → ${c.steals}`;
      if (!leaks.includes(leak)) leaks.push(leak);
    }
  }
  return { checklist: checklist.slice(0, 5), leaks: leaks.slice(0, 4) };
}

export interface HeadCoverage {
  head: string;
  covered: boolean;
  by: string[]; // имена упражнений плана, бьющих в головку
}

/**
 * Покрытие слабых головок текущим планом: есть ли хоть одно упражнение, бьющее в головку.
 * Чистая функция — план не мутирует. Пустой план/головки → [].
 */
export function auditHeadCoverage(
  plan: { weeks?: Array<{ sessions?: Array<{ exercises?: Array<{ exerciseName?: string; name?: string; id?: string }> }> }> } | null | undefined,
  weakHeads: string[],
): HeadCoverage[] {
  const heads = [...new Set((weakHeads || []).map((h) => String(h).toLowerCase().trim()).filter((h) => HEAD_FUNCTIONS[h]))];
  if (!heads.length) return [];
  const byHead: Record<string, string[]> = {};
  for (const h of heads) byHead[h] = [];
  try {
    const sessions = Array.isArray(plan?.weeks) ? (plan as NonNullable<typeof plan>).weeks!.flatMap((w) => w.sessions || []) : [];
    for (const s of sessions) {
      for (const ex of s.exercises || []) {
        const id = String((ex as any).exerciseName || (ex as any).id || '');
        const nm = String((ex as any).name || id);
        let hits: string[] = [];
        try { hits = headsHitOf({ id: id || undefined, name: nm }); } catch { /* noop */ }
        for (const h of hits) {
          if (byHead[h] && !byHead[h].includes(nm)) byHead[h].push(nm);
        }
      }
    }
  } catch { /* noop */ }
  return heads.map((h) => ({ head: h, covered: byHead[h].length > 0, by: byHead[h].slice(0, 4) }));
}

export interface StimulusCtx {
  weakHead?: string | null;
  setupIssues?: string[]; // свободные метки отклонений, напр. ['локти вперёд']
  cheating?: boolean | null;
  rirActual?: number | null;
  rangeFull?: boolean | null; // false = укороченная амплитуда
  tempoHasPause?: boolean | null;
}

export interface StimulusBreakdown {
  setup: number;
  profile: number;
  line: number;
  rom: number;
  stability: number;
  effort: number;
}

export interface StimulusDiagnosis {
  record: ExerciseStimulus | null;
  headsHit: string[];
  headsMissed: string[]; // головки мышцы, не получающие стимул
  flags: StimulusFlag[];
  issues: string[];
  score: number | null; // 0-100 «доля в цель», null = нет записи (neutral)
  breakdown: StimulusBreakdown | null;
}

const HEADS_BY_MUSCLE: Record<string, string[]> = {
  triceps: ['triceps_long', 'triceps_lateral'],
  biceps: ['biceps_long', 'biceps_short', 'brachialis'],
  shoulders: ['delt_mid', 'delt_rear', 'delt_front'],
  chest: ['chest_upper', 'chest_mid', 'chest_lower'],
  back: ['back_width', 'back_thickness'],
  quads: ['quads'],
  hamstrings: ['hamstrings'],
  glutes: ['glutes'],
  calves: ['calves'],
  traps: ['traps'],
  forearms: ['forearms'],
  abs: ['abs'],
};

function muscleOfHead(head: string): string {
  return HEAD_FUNCTIONS[head]?.muscle || '';
}

/**
 * Слабая зона хаба (delt_mid, chest_upper, quads, chest, back…) → головка стимула.
 * Канонические fallback: chest→chest_mid, back→back_width, shoulders→delt_mid,
 * biceps→biceps_long, triceps→triceps_long. traps/forearms/abs → null (нет записей).
 */
export function weakHeadForZone(zone: string): string | null {
  const z = String(zone || '').toLowerCase().trim();
  if (!z) return null;
  if (HEAD_FUNCTIONS[z]) return z;
  const fallback: Record<string, string> = {
    chest: 'chest_mid',
    back: 'back_width',
    shoulders: 'delt_mid',
    biceps: 'biceps_long',
    triceps: 'triceps_long',
    quads: 'quads',
    hamstrings: 'hamstrings',
    glutes: 'glutes',
    calves: 'calves',
    traps: 'traps',
    forearms: 'forearms',
    abs: 'abs',
    legs: 'quads',
    arms: 'biceps_long',
    core: 'abs',
  };
  return fallback[z] || null;
}

export function diagnoseStimulusTarget(
  ex: { id?: string; name?: string; muscle?: string },
  ctx: StimulusCtx = {},
): StimulusDiagnosis {
  const rec = resolveStimulus(ex);
  if (!rec) {
    return { record: null, headsHit: [], headsMissed: [], flags: [], issues: [], score: null, breakdown: null };
  }
  const flags: StimulusFlag[] = [];
  const issues: string[] = [];
  const bd: StimulusBreakdown = { setup: 100, profile: 100, line: 100, rom: 100, stability: 100, effort: 100 };
  const hit = [...rec.headsHit];

  // 1 wrongHead — упражнение мимо слабой головки (выводится из плана, тапы не нужны)
  // Строго: partial-стимул не считается попаданием (молот ≠ тренировка длинной головки)
  let missed: string[] = [];
  if (ctx.weakHead && HEAD_FUNCTIONS[ctx.weakHead]) {
    const wh = ctx.weakHead;
    const musc = muscleOfHead(wh);
    const family = HEADS_BY_MUSCLE[musc] || [];
    const recMuscles = new Set([...rec.headsHit, ...(rec.headsPartial || [])].map(muscleOfHead));
    if (recMuscles.has(musc) && !rec.headsHit.includes(wh)) {
      missed = family.filter((h) => h !== wh && hit.includes(h));
      flags.push('wrongHead');
      const alts = (rec.alternativesForMissed?.[wh] || HEAD_FUNCTIONS[wh]?.loadedBy || []).slice(0, 2).join(', ');
      issues.push(
        `Мимо головки: ${HEAD_FUNCTIONS[wh].label} почти не грузится — ${HEAD_FUNCTIONS[wh].stretchCondition.toLowerCase()}${alts ? `; закрой: ${alts}` : ''}`,
      );
      bd.profile = 45;
    } else if (!recMuscles.has(musc)) {
      missed = [];
    } else {
      missed = family.filter((h) => !hit.includes(h));
    }
  } else {
    const musc = muscleOfHead(rec.headsHit[0]);
    const family = HEADS_BY_MUSCLE[musc] || [];
    missed = family.filter((h) => !hit.includes(h));
  }

  // 2 setupRisk + 9 synergistTakeover — по тапам отклонений
  const taps = (ctx.setupIssues || []).map(norm).filter(Boolean);
  if (taps.length > 0) {
    let matched = 0;
    for (const tap of taps) {
      const words = tap.split(/[\s,;]+/).filter((w) => w.length > 2);
      const entry = rec.cheating.find((c) => {
        const cn = norm(c.deviation);
        return words.some((w) => cn.includes(w)) || cn.split(/[\s,;]+/).some((w) => w.length > 2 && tap.includes(w));
      });
      if (entry) {
        matched++;
        if (!flags.includes('synergistTakeover')) flags.push('synergistTakeover');
        issues.push(`Утечка: ${entry.deviation} → забирает ${entry.steals}`);
      }
    }
    if (matched > 0) {
      flags.push('setupRisk');
      issues.push(`Сетап: ${matched} отклонение(я) — проверь: ${rec.setup.slice(0, 2).join('; ')}`);
      bd.setup = Math.max(30, 100 - matched * 25);
      bd.line = Math.max(40, bd.line - matched * 15);
    } else {
      flags.push('setupRisk');
      issues.push(`Сетап под вопросом (${taps.slice(0, 2).join(', ')}) — эталон: ${rec.setup[0]}`);
      bd.setup = 70;
    }
  }

  // 3 resistanceLineGap — пик в сокращённой без паузы (выводится из плана)
  if (rec.needsPause && ctx.tempoHasPause === false) {
    flags.push('resistanceLineGap');
    issues.push(`Линия: пик нагрузки ${rec.peakPoint === 'short' ? 'в сокращённой' : 'в растянутой'}, а паузы нет — ${rec.resistanceLine.split('.')[0]}`);
    bd.line = Math.min(bd.line, 55);
  }

  // 4 romShort — укороченная амплитуда
  if (ctx.rangeFull === false) {
    flags.push('romShort');
    issues.push(`Амплитуда укорочена — норма: ${rec.rom}`);
    bd.rom = 55;
  }

  // 6 stabilityGap — читинг
  if (ctx.cheating === true) {
    flags.push('stabilityGap');
    const first = rec.cheating[0];
    issues.push(`Стабильность: читинг — momentum вместо мышцы${first ? ` (${first.deviation} → ${first.steals})` : ''}; требование стабильности: ${rec.stability}`);
    bd.stability = 45;
  }

  // 8 rirMismatch — недожим изоляции / пережим базы
  if (ctx.rirActual != null && Number.isFinite(ctx.rirActual)) {
    const [lo, hi] = rec.rirTarget;
    if (ctx.rirActual > hi + 1) {
      flags.push('rirMismatch');
      issues.push(`Недожим: RIR ${ctx.rirActual} при норме ${lo}-${hi} — последние 2 повтора дают основной стимул`);
      bd.effort = 55;
    } else if (ctx.rirActual < lo - 1) {
      flags.push('rirMismatch');
      issues.push(`Пережим: RIR ${ctx.rirActual} при норме ${lo}-${hi} — техника плывёт, нагрузку забирают синергисты`);
      bd.effort = 65;
    }
  }

  const WEIGHTS: Record<StimulusFlag, number> = {
    wrongHead: 25,
    synergistTakeover: 15,
    setupRisk: 10,
    resistanceLineGap: 10,
    romShort: 10,
    stabilityGap: 12,
    rirMismatch: 8,
  };
  let score = 100;
  for (const f of new Set(flags)) score -= WEIGHTS[f] ?? 8;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    record: rec,
    headsHit: hit,
    headsMissed: missed,
    flags: [...new Set(flags)],
    issues: [...new Set(issues)].slice(0, 6),
    score,
    breakdown: bd,
  };
}
