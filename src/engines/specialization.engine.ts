/** specialization.engine.ts — качественная специализация на каждую группу мышц.
 * Профессиональный подход: для каждой группы — свой протокол специализации
 * (упражнения, частота, интенсивность, техники, RIR, отдых, порядок). */
import { EXERCISE_CATALOG } from '../core/exercise-catalog';
import type { Exercise } from '../core/types';

export interface SpecializationInput {
  targetGroup: string;
  level: 'beginner' | 'intermediate' | 'advanced' | string;
  equipment: string[];
  weakPoints: string[];
  injuries: { muscle: string; from: string; to?: string }[];
  daysPerWeek: number;
}

export interface SpecializedExercise {
  id: string;
  name: string;
  group: string;
  type: 'compound' | 'isolation';
  sets: number;
  reps: string;
  rir: number;
  rest: number;
  order: number;
  technique?: string;
  note?: string;
}

export interface SpecializedDay {
  dayNumber: number;
  focus: string;
  exercises: SpecializedExercise[];
  targetVolume: number;
}

export interface SpecializationProtocol {
  groupName: string;
  frequency: string;
  totalSets: string;
  duration: string;
  keyPrinciples: string[];
  exerciseOrder: { name: string; sets: number; reps: string; rir: number; rest: number; technique?: string; note?: string }[];
  intensityTechniques: string[];
  nutritionTips: string[];
}

// ═══ ПРОТОКОЛЫ СПЕЦИАЛИЗАЦИИ ДЛЯ КАЖДОЙ ГРУППЫ ═══

// ═══ ПРОТОКОЛЫ СПЕЦИАЛИЗАЦИИ — ДЕТАЛЬНЫЕ ПОДГРУППЫ ═══

const PROTOCOLS: Record<string, SpecializationProtocol> = {

// ─── ГРУДЬ ───
chest_upper: {
  groupName: 'Верхняя грудь',
  frequency: '2× в неделю',
  totalSets: '12-16 сетов/нед',
  duration: '8-10 нед, делод на 5-6 нед',
  keyPrinciples: [
    'Угол 30-45° — ключ к верхнему отделу грудных',
    'Глубокое растяжение + пауза 1с в нижней точке',
    'Контролируемый негатив 3-4с',
    'Сведение лопаток (retraction) для изоляции',
  ],
  exerciseOrder: [
    { name: 'Жим штанги на наклонной скамье (30°)', sets: 4, reps: '6-8', rir: 2, rest: 150, technique: 'Пауза 1с на груди', note: 'Главное массонаборное для верха' },
    { name: 'Жим гантелей на наклонной скамье (45°)', sets: 4, reps: '8-10', rir: 1, rest: 120, technique: 'Глубокое растяжение', note: 'Большая амплитуда' },
    { name: 'Сведение в кроссовере снизу вверх (низ-верх)', sets: 3, reps: '12-15', rir: 0, rest: 60, technique: 'Дроп-сет', note: 'Изоляция верха' },
    { name: 'Отжимания с ногами на возвышении', sets: 2, reps: 'AMRAP', rir: 0, rest: 60, note: 'Финальный отказ' },
  ],
  intensityTechniques: [
    'Дроп-сеты на кроссовере: 15 → -20% → 10 → -20% → AMRAP',
    'Пауза 2с в растянутой позиции',
    'Rest-pause: 8 + 3 + 2 (15с отдых)',
  ],
  nutritionTips: ['Белок 2.2-2.5 г/кг', 'Углеводы 40-60г перед тренировкой', 'Creatine 5г/день'],
},

chest_middle: {
  groupName: 'Средняя грудь',
  frequency: '2× в неделю',
  totalSets: '12-16 сетов/нед',
  duration: '8-10 нед, делод на 5-6 нед',
  keyPrinciples: [
    'Горизонтальные жимы — основа для средней части',
    'Широкий хват для большего растяжения',
    'Гантели дают большую амплитуду чем штанга',
    'Кроссовер — постоянное напряжение throughout',
  ],
  exerciseOrder: [
    { name: 'Жим штанги лёжа на горизонтальной скамье', sets: 4, reps: '6-8', rir: 2, rest: 150, technique: 'Пауза 1с', note: 'База для средней груди' },
    { name: 'Жим гантелей на горизонтальной скамье', sets: 4, reps: '8-10', rir: 1, rest: 120, note: 'Больше амплитуды' },
    { name: 'Сведение гантелей лёжа (flyes)', sets: 3, reps: '12-15', rir: 0, rest: 60, technique: 'Мизинцы внутрь', note: 'Изоляция' },
    { name: 'Сведение в кроссовере (горизонтально)', sets: 3, reps: '15-20', rir: 0, rest: 45, technique: 'Дроп-сет', note: 'Пампинг' },
  ],
  intensityTechniques: ['Дроп-сеты на кроссовере', 'Предутомление: flyes 15 → жим 8', 'Rest-pause на жиме'],
  nutritionTips: ['Белок 2.2-2.5 г/кг', 'Углеводы перед тренировкой', 'Creatine 5г/день'],
},

chest_lower: {
  groupName: 'Нижняя грудь',
  frequency: '1-2× в неделю',
  totalSets: '8-12 сетов/нед',
  duration: '6-8 нед',
  keyPrinciples: [
    'Деклинация (головой вниз) — для нижнего отдела',
    'Отжимания на брусьях с наклоном вперёд — база',
    'Кроссовер сверху вниз — идеальная изоляция',
    'Нижняя грудь быстрее восстанавливается — можно чаще',
  ],
  exerciseOrder: [
    { name: 'Отжимания на брусьях (с наклоном корпуса вперёд)', sets: 4, reps: '6-10', rir: 2, rest: 120, technique: 'Наклон вперёд 30°', note: 'База для низа груди' },
    { name: 'Жим гантелей на скамье с деклинацией (-15°)', sets: 3, reps: '8-10', rir: 1, rest: 120, note: 'Добивка низа' },
    { name: 'Сведение в кроссовере (сверху вниз)', sets: 3, reps: '12-15', rir: 0, rest: 60, technique: 'Дроп-сет', note: 'Изоляция' },
    { name: 'Отжимания от пола (узко, ноги выше)', sets: 2, reps: 'AMRAP', rir: 0, rest: 60, note: 'Финал' },
  ],
  intensityTechniques: ['Дроп-сеты на кроссовере', 'Частичные в нижней трети', 'Rest-pause на брусьях'],
  nutritionTips: ['Белок 2.0-2.3 г/кг', 'Отжимания на брусьях требуют сильного трицепса'],
},

// ─── СПИНА ───
back_lats: {
  groupName: 'Широчайшие (ширина)',
  frequency: '2× в неделю',
  totalSets: '14-18 сетов/нед',
  duration: '8-12 нед',
  keyPrinciples: [
    'Вертикальные тяги — единственный путь к ширине',
    'Подтягивания — король, блочная тяга — замена',
    'Широкий хват → внешняя часть, узкий → нижняя',
    'Контролируемый негатив 3-4с — эксцентрик решает',
  ],
  exerciseOrder: [
    { name: 'Подтягивания (широкий хват)', sets: 4, reps: '6-10', rir: 2, rest: 150, technique: 'Пауза 1с вверху', note: 'Король для ширины' },
    { name: 'Тяга верхнего блока широким хватом', sets: 4, reps: '10-12', rir: 1, rest: 90, note: 'Замена подтягиваниям' },
    { name: 'Тяга верхнего блока обратным хватом', sets: 3, reps: '12-15', rir: 1, rest: 75, note: 'Нижняя часть широчайших' },
    { name: 'Пулловер в кроссовере (стоя)', sets: 3, reps: '15-20', rir: 0, rest: 60, technique: 'Дроп-сет', note: 'Изоляция широчайших' },
  ],
  intensityTechniques: ['Негатив 4-5с на подтягиваниях', 'Пауза 2с в верхней точке', 'Частические в растянутой позиции'],
  nutritionTips: ['Белок 2.0-2.4 г/кг', 'Спина любит объём', 'Омега-3 2-3г/день'],
},

back_thickness: {
  groupName: 'Толщина спины (средняя)',
  frequency: '2× в неделю',
  totalSets: '14-18 сетов/нед',
  duration: '8-12 нед',
  keyPrinciples: [
    'Горизонтальные тяги — толщина и детализация',
    'Тяга штанги в наклоне — главное упражнение',
    'Сведение лопаток в конце — пиковое сокращение',
    'Разная ширина хвата → разные области спины',
  ],
  exerciseOrder: [
    { name: 'Тяга штанги в наклоне (хват сверху)', sets: 4, reps: '6-8', rir: 2, rest: 150, technique: 'Сведение лопаток', note: 'База для толщины' },
    { name: 'Тяга гантели одной рукой в наклоне', sets: 4, reps: '8-10', rir: 1, rest: 90, technique: 'Растяжение внизу', note: 'Односторонняя работа' },
    { name: 'Тяга нижнего блока к поясу (V-рукоять)', sets: 3, reps: '10-12', rir: 1, rest: 75, note: 'Добивка' },
    { name: 'Тяга Т-грифа', sets: 3, reps: '12-15', rir: 0, rest: 60, technique: 'Дроп-сет', note: 'Пампинг' },
  ],
  intensityTechniques: ['Пиковое сокращение 2с', 'Rest-pause на тяге штанги', '1.5 повторения на тяге блока'],
  nutritionTips: ['Белок 2.0-2.4 г/кг', 'Толщина требует тяжёлых весов', 'Creatine 5г/день'],
},

back_lower: {
  groupName: 'Поясница (разгибатели)',
  frequency: '1-2× в неделю',
  totalSets: '6-10 сетов/нед',
  duration: '6-8 нед',
  keyPrinciples: [
    'Гиперэкстензии — главное упражнение',
    'Становая/румынская тяга — база (но осторожно)',
    'Поясница работает во всех тягах — не переборщи',
    'Статика (планка) укрепляет кор',
  ],
  exerciseOrder: [
    { name: 'Гиперэкстензии (с отягощением)', sets: 4, reps: '10-15', rir: 1, rest: 60, technique: 'Пауза 1с вверху', note: 'Главное для поясницы' },
    { name: 'Румынская тяга', sets: 3, reps: '8-10', rir: 2, rest: 150, note: 'База (задняя цепь)' },
    { name: 'Good morning (наклоны со штангой)', sets: 3, reps: '10-12', rir: 1, rest: 90, note: 'Изоляция поясницы' },
    { name: 'Планка (статика)', sets: 3, reps: '45-60с', rir: 0, rest: 45, note: 'Кор' },
  ],
  intensityTechniques: ['Пауза в пиковой точке', 'Дроп-сеты на гиперэкстензии', 'Суперсет: гиперэкстензия + планка'],
  nutritionTips: ['Белок 2.0 г/кг', 'Поясница восстанавливается долго — 1-2× достаточно'],
},

// ─── НОГИ ───
legs_quads: {
  groupName: 'Квадрицепс',
  frequency: '1-2× в неделю',
  totalSets: '14-20 сетов/нед',
  duration: '8-10 нед, делод на 4-5 нед',
  keyPrinciples: [
    'Глубокий присед (ниже параллели) — полная амплитуда',
    'Жим ногами — безопасная перегрузка',
    'Разгибания — изоляция и пампинг после базы',
    'Пауза 2с в нижней точке приседа',
  ],
  exerciseOrder: [
    { name: 'Приседания со штангой на плечах', sets: 4, reps: '5-8', rir: 2, rest: 180, technique: 'Пауза 1с внизу', note: 'Король для квадрицепса' },
    { name: 'Жим ногами (стопы низко и узко)', sets: 4, reps: '10-12', rir: 1, rest: 120, note: 'Акцент на квадрицепс' },
    { name: 'Гакк-приседания (или фронтальный присед)', sets: 3, reps: '8-10', rir: 1, rest: 120, note: 'Изоляция квадрицепса' },
    { name: 'Разгибания ног в тренажёре сидя', sets: 3, reps: '15-20', rir: 0, rest: 45, technique: 'Дроп-сет + частичные', note: 'Пампинг' },
  ],
  intensityTechniques: ['Дроп-сеты на разгибаниях: 15 → -20% → 12 → -20% → AMRAP', 'Пауза 2с внизу приседа', '1.5 повторения на жиме ногами', 'Rest-pause на разгибаниях'],
  nutritionTips: ['Углеводы 4-6 г/кг в день ног', 'Белок 2.0-2.3 г/кг', 'Электролиты (Na/K/Mg)', 'Creatine 5г/день'],
},

legs_hamstrings: {
  groupName: 'Бицепс бедра',
  frequency: '1-2× в неделю',
  totalSets: '10-14 сетов/нед',
  duration: '8-10 нед',
  keyPrinciples: [
    'Румынская тяга — главное в растянутой позиции',
    'Сгибания ног — изоляция в сокращённой позиции',
    'Бицепс бедра любит растяжение — глубокая Румынская',
    'Контролируемый негатив — эксцентрик решает',
  ],
  exerciseOrder: [
    { name: 'Румынская тяга (RDL)', sets: 4, reps: '8-10', rir: 2, rest: 150, technique: 'Растяжение, не касание пола', note: 'Главное для бицепса бедра' },
    { name: 'Сгибания ног в тренажёре лёжа', sets: 4, reps: '10-12', rir: 1, rest: 75, note: 'Изоляция' },
    { name: 'Сгибания ног сидя (другая головка)', sets: 3, reps: '12-15', rir: 1, rest: 60, note: 'Короткая головка' },
    { name: 'Гудморнинги (good mornings)', sets: 3, reps: '10-12', rir: 1, rest: 90, note: 'Добивка' },
  ],
  intensityTechniques: ['Дроп-сеты на сгибаниях', 'Пауза 2с в растянутой позиции (RDL)', 'Rest-pause: 12 + 4 + 3', 'Негатив 4с на сгибаниях'],
  nutritionTips: ['Белок 2.0-2.3 г/кг', 'Бицепс бедра чувствителен к объёму', 'Creatine 5г/день'],
},

legs_glutes: {
  groupName: 'Ягодицы',
  frequency: '2-3× в неделю',
  totalSets: '10-16 сетов/нед',
  duration: '8-10 нед',
  keyPrinciples: [
    'Ягодичный мостик — главное изолирующее',
    'Глубокий присед и выпады — база',
    'Пиковое сокращение в верхней точке мостика',
    'Ягодицы любят частоту — можно 3×/нед',
  ],
  exerciseOrder: [
    { name: 'Ягодичный мостик со штангой (или с пола)', sets: 4, reps: '8-12', rir: 2, rest: 120, technique: 'Пауза 2с вверху', note: 'Главное для ягодиц' },
    { name: 'Болгарские сплит-приседания (выпады сзади)', sets: 4, reps: '10-12', rir: 1, rest: 90, note: 'Односторонняя работа' },
    { name: 'Отведение ноги назад в кроссовере', sets: 3, reps: '15-20', rir: 0, rest: 45, technique: 'Дроп-сет', note: 'Изоляция большой ягодичной' },
    { name: 'Жим ногами (стопы высоко и широко)', sets: 3, reps: '12-15', rir: 1, rest: 90, note: 'Акцент на ягодицы' },
  ],
  intensityTechniques: ['Пауза 2-3с в пиковой точке мостика', 'Дроп-сеты на отведениях', 'Суперсет: мостик + отведение'],
  nutritionTips: ['Белок 2.0-2.3 г/кг', 'Ягодицы любят объём и частоту'],
},

legs_calves: {
  groupName: 'Икры',
  frequency: '3-5× в неделю',
  totalSets: '12-20 сетов/нед',
  duration: '6-8 нед',
  keyPrinciples: [
    'Икры требуют высокой частоты — 3-5×/нед',
    'Пауза 2с в растянутой позиции (внизу)',
    'Пиковое сокращение 2с в верхней точке',
    'Икроножная + камбаловидная — тренируй обе',
  ],
  exerciseOrder: [
    { name: 'Подъём на носки стоя (в тренажёре или на степе)', sets: 4, reps: '10-12', rir: 2, rest: 60, technique: 'Пауза 2с внизу + 2с вверху', note: 'Икроножная (gastrocnemius)' },
    { name: 'Подъём на носки сидя (в тренажёре)', sets: 4, reps: '15-20', rir: 1, rest: 60, note: 'Камбаловидная (soleus)' },
    { name: 'Подъём на носки одной ногой (на степе)', sets: 3, reps: '12-15', rir: 0, rest: 45, technique: 'Дроп-сет', note: 'Односторонняя работа' },
    { name: 'Прыжки на скакалке (или прыжки на месте)', sets: 2, reps: 'AMRAP', rir: 0, rest: 45, note: 'Финал — взрывная работа' },
  ],
  intensityTechniques: ['Дроп-сеты: 15 → -20% → 12 → -20% → AMRAP', 'Пауза 2с внизу + 2с вверху', 'Rest-pause: 15 + 5 + 4 (10с)', 'Частичные в верхней половине'],
  nutritionTips: ['Белок 2.0 г/кг', 'Икры — выносливые мышцы, нужен объём', 'Тренируй икры в конце любой тренировки'],
},

// ─── ПЛЕЧИ ───
shoulders_front: {
  groupName: 'Передняя дельта',
  frequency: '1-2× в неделю',
  totalSets: '8-12 сетов/нед',
  duration: '6-8 нед',
  keyPrinciples: [
    'Передняя дельта работает во всех жимах — не переборщи',
    'Жим над головой — база, но не нужен большой объём',
    'Фронтальные махи — изоляция, но осторожно с суставом',
    'Передняя дельта часто перетренирована у жимовиков',
  ],
  exerciseOrder: [
    { name: 'Жим гантелей сидя (или армейский жим)', sets: 4, reps: '6-8', rir: 2, rest: 150, note: 'База для передней дельты' },
    { name: 'Фронтальные махи гантелями (перед собой)', sets: 3, reps: '12-15', rir: 1, rest: 60, technique: 'Мизинец вверх', note: 'Изоляция' },
    { name: 'Фронтальные махи кабелем (одной рукой)', sets: 3, reps: '15-20', rir: 0, rest: 45, technique: 'Дроп-сет', note: 'Пампинг' },
  ],
  intensityTechniques: ['Дроп-сеты на махах', 'Rest-pause: 12 + 4 + 3', 'Суперсет: жим + фронтальные махи'],
  nutritionTips: ['Белок 2.0-2.3 г/кг', 'Не перегружай — передняя дельта и так работает в жимах'],
},

shoulders_side: {
  groupName: 'Средняя дельта (ширина плеч)',
  frequency: '3× в неделю',
  totalSets: '12-18 сетов/нед',
  duration: '8-10 нед',
  keyPrinciples: [
    'Средняя дельта — ключ к визуальной ширине плеч',
    'Тренируй 3×/нед — она восстанавливается быстро',
    'Кабель лучше гантелей — постоянное напряжение',
    'Мизинец вверх в верхней точке — активация средней дельты',
  ],
  exerciseOrder: [
    { name: 'Махи гантелями в стороны', sets: 4, reps: '12-15', rir: 1, rest: 60, technique: 'Мизинец вверх, большие пальцы вниз', note: 'Главное для ширины' },
    { name: 'Махи кабелем в стороны (одной рукой)', sets: 4, reps: '15-20', rir: 0, rest: 45, technique: 'Дроп-сет в последнем', note: 'Постоянное напряжение' },
    { name: 'Махи в кроссовере (две рукояти снизу)', sets: 3, reps: '15-20', rir: 0, rest: 45, note: 'Добивка' },
  ],
  intensityTechniques: ['Myo-reps: 15 + 3×5 (15с отдых)', 'Дроп-сеты: 15 → -20% → 12 → -20% → AMRAP', 'Rest-pause: 15 + 5 + 4', 'Частичные в верхней 1/3'],
  nutritionTips: ['Белок 2.0-2.3 г/кг', 'Средняя дельта любит частоту — 3× лучше чем 1×18', 'Не используй большой вес — форма важнее'],
},

shoulders_rear: {
  groupName: 'Задняя дельта',
  frequency: '2-3× в неделю (можно каждый день)',
  totalSets: '8-14 сетов/нед',
  duration: '6-8 нед',
  keyPrinciples: [
    'Задняя дельта отстаёт у 90% атлетов — приоритет!',
    'Махи назад + face pulls — основные движения',
    'Можно тренировать каждый день (band pull-aparts)',
    'Задняя дельта мала — нужен высокий RIR',
  ],
  exerciseOrder: [
    { name: 'Обратные махи гантелями в наклоне (rear delt fly)', sets: 4, reps: '15-20', rir: 1, rest: 60, note: 'Главное для задней дельты' },
    { name: 'Тяга к лицу (face pulls) в кроссовере', sets: 4, reps: '15-20', rir: 1, rest: 60, technique: 'Локти вверх', note: 'Задняя дельта + вращательная манжета' },
    { name: 'Обратные махи в кроссовере (сверху-назад)', sets: 3, reps: '15-20', rir: 0, rest: 45, technique: 'Дроп-сет', note: 'Пампинг' },
    { name: 'Band pull-aparts (резиновая лента)', sets: 3, reps: '20-30', rir: 0, rest: 30, note: 'Можно каждый день' },
  ],
  intensityTechniques: ['Дроп-сеты', 'Суперсет: rear delt fly + face pull', 'Частические в растянутой позиции', 'Band pull-aparts ежедневно (5×20)'],
  nutritionTips: ['Белок 2.0 г/кг', 'Задняя дельта любит объём и частоту', 'Омега-3 для вращательной манжеты'],
},

// ─── РУКИ ───
arms_biceps: {
  groupName: 'Бицепс',
  frequency: '2-3× в неделю',
  totalSets: '12-18 сетов/нед',
  duration: '6-8 нед',
  keyPrinciples: [
    'Супинация кисти — пиковое сокращение бицепса',
    'Контролируемый негатив 3с — эксцентрик решает',
    'Разный хват: прямой (длинная), молоток (брахиалис)',
    'Наклонная скамья — растяжение длинной головки',
  ],
  exerciseOrder: [
    { name: 'Подъём штанги на бицепс стоя', sets: 4, reps: '8-10', rir: 2, rest: 90, technique: 'Супинация, без раскачивания', note: 'База' },
    { name: 'Подъём гантелей на наклонной скамье', sets: 4, reps: '10-12', rir: 1, rest: 75, technique: 'Растяжение внизу', note: 'Длинная головка' },
    { name: 'Подъём гантелей с супинацией (стоя)', sets: 3, reps: '12-15', rir: 1, rest: 60, note: 'Пиковое сокращение' },
    { name: 'Сгибания на блоке (канатом или прямой)', sets: 3, reps: '15-20', rir: 0, rest: 45, technique: 'Дроп-сет', note: 'Пампинг' },
  ],
  intensityTechniques: ['21s: 7 нижних + 7 верхних + 7 полных', 'Дроп-сеты на блоке: 12 → -20% → 10 → -20% → AMRAP', 'Rest-pause: 10 + 4 + 3', 'Суперсет: бицепс + трицепс'],
  nutritionTips: ['Белок 2.2-2.5 г/кг', 'Бицепс любит объём', 'Creatine для малых мышц'],
},

arms_triceps: {
  groupName: 'Трицепс (2/3 объёма руки!)',
  frequency: '2-3× в неделю',
  totalSets: '12-18 сетов/нед',
  duration: '6-8 нед',
  keyPrinciples: [
    'Трицепс = 2/3 объёма руки — тренируй первым!',
    'Длинная головка: overhead (французский, разгибания из-за головы)',
    'Латеральная: жим узко, отжимания брусья',
    'Контролируй локти — прижаты для изоляции',
  ],
  exerciseOrder: [
    { name: 'Жим лёжа узким хватом (или отжимания узко)', sets: 4, reps: '6-8', rir: 2, rest: 120, note: 'База для трицепса' },
    { name: 'Французский жим (лежа или из-за головы)', sets: 4, reps: '10-12', rir: 1, rest: 75, note: 'Длинная головка' },
    { name: 'Разгибания на блоке сверху (канатом)', sets: 3, reps: '12-15', rir: 1, rest: 60, technique: 'Разведение в конце', note: 'Латеральная головка' },
    { name: 'Разгибания из-за головы на блоке', sets: 3, reps: '15-20', rir: 0, rest: 45, technique: 'Дроп-сет', note: 'Пампинг длинной головки' },
  ],
  intensityTechniques: ['Дроп-сеты на блоке: 12 → -20% → 10 → -20% → AMRAP', 'Rest-pause: 10 + 4 + 3', 'Суперсет: трицепс + бицепс', 'Предутомление: разгибания 15 → жим узко 8'],
  nutritionTips: ['Белок 2.2-2.5 г/кг', 'Трицепс больше бицепса — больше объёма!', 'Creatine 5г/день'],
},

arms_forearms: {
  groupName: 'Предплечье',
  frequency: '2-3× в неделю',
  totalSets: '6-10 сетов/нед',
  duration: '6-8 нед',
  keyPrinciples: [
    'Хват — сила предплечья = сила во всех тяговых',
    'Сгибания запястий — сгибатели',
    'Разгибания запястий — разгибатели (часто забыты)',
    'Статика (вис на перекладине) — мощно для хвата',
  ],
  exerciseOrder: [
    { name: 'Сгибания запястий со штангой (предплечья на скамье)', sets: 4, reps: '15-20', rir: 1, rest: 60, note: 'Сгибатели' },
    { name: 'Разгибания запястий со штангой (предплечья на скамье)', sets: 3, reps: '15-20', rir: 1, rest: 60, note: 'Разгибатели' },
    { name: 'Вис на перекладине (статика)', sets: 3, reps: 'макс. сек', rir: 0, rest: 60, note: 'Сила хвата' },
    { name: 'Сгибания с gripping device (или теннисный мяч)', sets: 3, reps: '20-30', rir: 0, rest: 45, note: 'Добивка' },
  ],
  intensityTechniques: ['Дроп-сеты на сгибаниях запястий', 'Суперсет: сгибания + разгибания', 'Статика: увеличивай время виса каждую неделю'],
  nutritionTips: ['Белок 2.0 г/кг', 'Предплечья восстанавливаются быстро — 2-3×'],
},

// ─── КОР ───
core: {
  groupName: 'Кор (пресс)',
  frequency: '3-4× в неделю',
  totalSets: '10-16 сетов/нед',
  duration: '6-8 нед',
  keyPrinciples: [
    'Верхний пресс: скручивания, нижний: подъём ног, боковой: боковая планка',
    'Пресс = мышцы, тренируй с отягощением',
    'Контролируемое скручивание, а не закидывание ногами',
    'Пресс работает во всех базовых — не переборщи',
  ],
  exerciseOrder: [
    { name: 'Подъём ног в висе (или лёжа на скамье)', sets: 4, reps: '12-15', rir: 1, rest: 60, technique: 'Контроль, без маха', note: 'Нижний пресс' },
    { name: 'Скручивания на блоке (стоя на коленях)', sets: 4, reps: '12-15', rir: 1, rest: 60, technique: 'Скручивание, не сгибание', note: 'Верхний пресс с отягощением' },
    { name: 'Боковая планка (на каждую сторону)', sets: 3, reps: '30-45с', rir: 0, rest: 45, note: 'Боковой пресс + стабилизация' },
    { name: 'Ab wheel (колесо для пресса)', sets: 3, reps: '10-12', rir: 1, rest: 60, technique: 'Контроль спины', note: 'Всё ядро' },
  ],
  intensityTechniques: ['Дроп-сеты на скручиваниях', 'Rest-pause: 12 + 5 + 4', 'Суперсет: подъём ног + скручивания', 'Планка с hip dips'],
  nutritionTips: ['Пресс виден при 12-15% жира — питание важнее', 'Белок 2.0-2.3 г/кг', '3-4×/нед достаточно'],
},

};

// Подгруппы для UI
export const SPECIALIZATION_GROUPS: { id: string; label: string; category: string }[] = [
  { id: 'chest_upper', label: 'Верхняя грудь', category: 'Грудь' },
  { id: 'chest_middle', label: 'Средняя грудь', category: 'Грудь' },
  { id: 'chest_lower', label: 'Нижняя грудь', category: 'Грудь' },
  { id: 'back_lats', label: 'Широчайшие (ширина)', category: 'Спина' },
  { id: 'back_thickness', label: 'Толщина спины', category: 'Спина' },
  { id: 'back_lower', label: 'Поясница', category: 'Спина' },
  { id: 'legs_quads', label: 'Квадрицепс', category: 'Ноги' },
  { id: 'legs_hamstrings', label: 'Бицепс бедра', category: 'Ноги' },
  { id: 'legs_glutes', label: 'Ягодицы', category: 'Ноги' },
  { id: 'legs_calves', label: 'Икры', category: 'Ноги' },
  { id: 'shoulders_front', label: 'Передняя дельта', category: 'Плечи' },
  { id: 'shoulders_side', label: 'Средняя дельта (ширина)', category: 'Плечи' },
  { id: 'shoulders_rear', label: 'Задняя дельта', category: 'Плечи' },
  { id: 'arms_biceps', label: 'Бицепс', category: 'Руки' },
  { id: 'arms_triceps', label: 'Трицепс (2/3 руки!)', category: 'Руки' },
  { id: 'arms_forearms', label: 'Предплечье', category: 'Руки' },
  { id: 'core', label: 'Кор (пресс)', category: 'Кор' },
];

// Маппинг подгруппа → основная группа (для распределения объёма)
const SUB_TO_MAIN: Record<string, string> = {
  chest_upper: 'chest', chest_middle: 'chest', chest_lower: 'chest',
  back_lats: 'back', back_thickness: 'back', back_lower: 'back',
  legs_quads: 'legs', legs_hamstrings: 'legs', legs_glutes: 'legs', legs_calves: 'legs',
  shoulders_front: 'shoulders', shoulders_side: 'shoulders', shoulders_rear: 'shoulders',
  arms_biceps: 'arms', arms_triceps: 'arms', arms_forearms: 'arms',
  core: 'core',
};

// Сплит-шаблоны (основные группы)
const SPLIT_TEMPLATES: Record<number, { name: string; days: { groups: string[]; focus: string }[] }> = {
  3: { name: 'Фулбоди 3 дня', days: [
    { groups: ['chest', 'back', 'legs'], focus: 'База' },
    { groups: ['shoulders', 'arms', 'core'], focus: 'Верх' },
    { groups: ['legs', 'back', 'chest'], focus: 'База 2' },
  ]},
  4: { name: 'Верх/Низ 4 дня', days: [
    { groups: ['chest', 'shoulders', 'arms'], focus: 'Верх' },
    { groups: ['legs', 'core'], focus: 'Низ' },
    { groups: ['back', 'arms', 'shoulders'], focus: 'Верх 2' },
    { groups: ['legs', 'core'], focus: 'Низ 2' },
  ]},
  5: { name: 'PPL+Армс 5 дней', days: [
    { groups: ['chest', 'shoulders'], focus: 'Push' },
    { groups: ['back'], focus: 'Pull' },
    { groups: ['legs'], focus: 'Legs' },
    { groups: ['arms'], focus: 'Arms' },
    { groups: ['chest', 'back', 'core'], focus: 'Финал' },
  ]},
  6: { name: 'PPL 6 дней', days: [
    { groups: ['chest', 'shoulders', 'arms'], focus: 'Push' },
    { groups: ['back', 'arms'], focus: 'Pull' },
    { groups: ['legs', 'core'], focus: 'Legs' },
    { groups: ['chest', 'shoulders'], focus: 'Push 2' },
    { groups: ['back'], focus: 'Pull 2' },
    { groups: ['legs', 'core'], focus: 'Legs 2' },
  ]},
};

export function getSpecializationProtocol(group: string): SpecializationProtocol {
  return PROTOCOLS[group] || PROTOCOLS.chest_middle;
}

export function calcSpecializationVolume(input: SpecializationInput): Record<string, { sets: number; status: string; pctOfMav: number }> {
  const mainGroup = SUB_TO_MAIN[input.targetGroup] || 'chest';
  const groups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
  const result: Record<string, { sets: number; status: string; pctOfMav: number }> = {};
  const mavEstimates: Record<string, number> = { chest: 12, back: 16, legs: 16, shoulders: 10, arms: 12, core: 8 };

  for (const g of groups) {
    const isTarget = g === mainGroup;
    const avgMav = mavEstimates[g] || 10;
    const sets = isTarget ? Math.round(avgMav * 1.4) : Math.round(avgMav * 0.5);
    const pct = Math.round(sets / avgMav * 100);
    const status = isTarget ? 'оверлоад' : sets >= avgMav ? 'поддержание' : 'минимум';
    result[g] = { sets, status, pctOfMav: pct };
  }
  return result;
}

export function generateSpecializedWeek(input: SpecializationInput): SpecializedDay[] {
  const { targetGroup, daysPerWeek } = input;
  const protocol = getSpecializationProtocol(targetGroup);
  const mainGroup = SUB_TO_MAIN[targetGroup] || 'chest';
  const template = SPLIT_TEMPLATES[daysPerWeek] || SPLIT_TEMPLATES[4];

  return template.days.map((day, dayIdx) => {
    const exercises: SpecializedExercise[] = [];
    const isTargetDay = day.groups.includes(mainGroup);

    if (isTargetDay) {
      protocol.exerciseOrder.forEach((ex, i) => {
        const cat = EXERCISE_CATALOG.find(e => e.name.toLowerCase().includes(ex.name.toLowerCase().split(' ')[0]) || e.name.includes(ex.name.slice(0, 10)));
        exercises.push({
          id: cat?.id || 'spec_' + i, name: ex.name, group: mainGroup,
          type: i < 2 ? 'compound' as const : 'isolation' as const,
          sets: ex.sets, reps: ex.reps, rir: ex.rir, rest: ex.rest, order: i,
          technique: ex.technique, note: ex.note,
        });
      });
    } else {
      day.groups.filter(g => g !== mainGroup).forEach(g => {
        const pool = EXERCISE_CATALOG.filter(e => e.group === g && e.type === 'compound').slice(0, 1);
        pool.forEach((ex, i) => {
          exercises.push({
            id: ex.id, name: ex.name, group: g, type: 'compound' as const,
            sets: 2, reps: '10-12', rir: 3, rest: 90, order: exercises.length + i,
          });
        });
      });
    }

    return { dayNumber: dayIdx + 1, focus: day.focus, exercises, targetVolume: exercises.reduce((s, e) => s + e.sets, 0) };
  });
}

export function formatSpecializationSummary(input: SpecializationInput): string[] {
  const protocol = getSpecializationProtocol(input.targetGroup);
  const vol = calcSpecializationVolume(input);
  const result: string[] = [];
  result.push(protocol.groupName + ': ' + protocol.frequency);
  result.push('Объём: ' + protocol.totalSets);
  result.push('Длительность: ' + protocol.duration);
  result.push('');
  result.push('Ключевые принципы:');
  protocol.keyPrinciples.forEach(p => result.push('  - ' + p));
  result.push('');
  result.push('Техники интенсификации:');
  protocol.intensityTechniques.forEach(t => result.push('  - ' + t));
  result.push('');
  result.push('Питание:');
  protocol.nutritionTips.forEach(t => result.push('  - ' + t));
  result.push('');
  result.push('Распределение объёма:');
  for (const [g, v] of Object.entries(vol)) {
    const names: Record<string,string> = { chest:'Грудь', back:'Спина', legs:'Ноги', shoulders:'Плечи', arms:'Руки', core:'Кор' };
    const mainGroup = SUB_TO_MAIN[input.targetGroup] || 'chest';
    result.push('  ' + (g === mainGroup ? '+' : '-') + ' ' + (names[g] || g) + ': ' + v.sets + ' сет/нед (' + v.status + ')');
  }
  return result;
}
