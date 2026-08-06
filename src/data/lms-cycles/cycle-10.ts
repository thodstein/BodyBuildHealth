import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-10.ts — Выносливость (жим, КМС-МС). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.004).
 */
export const CYCLE_10: SRCycleTemplate = {
  meta: {
    id: 'cycle-10',
    title: 'Выносливость (жим, КМС-МС)',
    direction: 'bench',
    level: 'KMS-MS',
    period: 'endurance',
    minBodyWeight: 80,
    sessionsPerWeek: 3,
    weeks: 12,
    correctionPct: 0.004,
    sourceWeeks: true,
    description: 'Выносливость (жим, КМС-МС).',
    howItWorks: 'Инструкция №10. СРЦ для жимовика (КМС-МС). Выносливость. 18.11.2019 2 Циклы для жимовиков Статья включает описание и требования саморасчитывающегося цикла для опытных жимовиков, рассчитанного на совершенствование силовой выносливости. Силовая выносливость и работа в большом количестве повторений является необходимой базой для перехода к более интенсивным периодам подготовки. Как правило именно такие периоды относятся к глубокому межсезонью, когда до соревнований еще далеко и есть время потренироваться с акцентом на набор мышечной массы и повышение результатов в многоповторных сетах. Нужно сразу заметить, что данный СРЦ не имеет в своем составе каких бы то ни было базовых упражнений, не нацел',
    conditions: ['Условия соответствия цикла: Уровень спортсмена средний (КМС-МС).', 'Предполагается, что пользователь цикла уже довольно опытный, возможно участвовал в соревнованиях.', 'Величины нагрузки таковы, что атлету без специальной подготовки будет невозможно нормально восстановиться от нагрузки.', 'Весоростовое соотношение должно быть оптимальным или с малыми отклонениями.', 'Минимальный вес атлета для его соответствия указанному циклу — 80 кг; Предполагается, что атлет уже имеет поставленную технику жима лежа, освоил упор в ноги, сведение лопаток и мост.', 'Что касается процента корректировки, то он изначально выставлен в низкое значение – 0,4%.', 'В случае, если первые 3-4 недели нагрузок хорошо переносятся спортсменом, то можно повысить его до 0,5-0,6% или даже более.'],
  },
  week1: [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:1},{pct:0.45,reps:10,sets:5}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Жим гантелей лежа на накл скамье', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Бицепс стоя', group: '', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:4}] },
      { name: 'Французский жим', group: '', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:5}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:5}] },
      { name: 'Разгибания с гантелью из-за головы', group: '', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:4}] },
      { name: 'Жим гантелей', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.5,reps:10,sets:4}] },
      { name: 'Бицепс с гантелями', group: '', coef: 0.4, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.62,reps:8,sets:4}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:1},{pct:0.45,reps:10,sets:5}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Жим гантелей лежа на накл скамье', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Бицепс стоя', group: '', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:4}] },
      { name: 'Французский жим', group: '', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:5}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:5}] },
      { name: 'Разгибания с гантелью из-за головы', group: '', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:4}] },
      { name: 'Жим гантелей', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.5,reps:10,sets:4}] },
      { name: 'Бицепс с гантелями', group: '', coef: 0.4, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.62,reps:8,sets:4}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.38,reps:12,sets:4}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.3,reps:12,sets:5}] },
      { name: 'Бицепс стоя', group: '', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.65,reps:10,sets:4}] },
      { name: 'Французский жим', group: '', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.47,reps:12,sets:1},{pct:0.58,reps:10,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:12,sets:3},{pct:0.33,reps:10,sets:3}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Разгибания с гантелью из-за головы', group: '', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:3},{pct:0.46,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:12,sets:4},{pct:0.6,reps:15,sets:1}] },
      { name: 'Жим гантелей', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
      { name: 'Бицепс с гантелями', group: '', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:5}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Жим гантелей лежа на накл скамье', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4},{pct:0.4,reps:10,sets:4}] },
      { name: 'Бицепс стоя', group: '', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:12,sets:4}] },
      { name: 'Французский жим', group: '', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:12,sets:1},{pct:0.45,reps:10,sets:3},{pct:0.52,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4},{pct:0.38,reps:10,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:12,sets:1},{pct:0.45,reps:10,sets:3},{pct:0.52,reps:8,sets:3}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Разгибания с гантелью из-за головы', group: '', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4},{pct:0.4,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.47,reps:12,sets:1},{pct:0.55,reps:20,sets:1}] },
      { name: 'Жим гантелей', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:2},{pct:0.45,reps:10,sets:2}] },
      { name: 'Бицепс с гантелями', group: '', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.3,reps:12,sets:5}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:5}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:4}] },
      { name: 'Бицепс стоя', group: '', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:12,sets:1},{pct:0.55,reps:10,sets:4}] },
      { name: 'Французский жим', group: '', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.33,reps:12,sets:3},{pct:0.37,reps:10,sets:3}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.55,reps:10,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
      { name: 'Разгибания с гантелью из-за головы', group: '', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3},{pct:0.45,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.58,reps:10,sets:1},{pct:0.63,reps:8,sets:3}] },
      { name: 'Жим гантелей', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:3},{pct:0.5,reps:10,sets:3}] },
      { name: 'Бицепс с гантелями', group: '', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3},{pct:0.46,reps:10,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4},{pct:0.57,reps:8,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Жим гантелей лежа на накл скамье', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: '', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.45,reps:12,sets:1},{pct:0.6,reps:10,sets:3},{pct:0.62,reps:8,sets:3}] },
      { name: 'Французский жим', group: '', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:3},{pct:0.55,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.37,reps:12,sets:3},{pct:0.42,reps:10,sets:3}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.57,reps:8,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:5}] },
      { name: 'Разгибания с гантелью из-за головы', group: '', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.62,reps:10,sets:1},{pct:0.68,reps:8,sets:3}] },
      { name: 'Жим гантелей', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:3},{pct:0.55,reps:10,sets:3}] },
      { name: 'Бицепс с гантелями', group: '', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:3},{pct:0.52,reps:10,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:10,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Жим гантелей лежа на накл скамье', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:1},{pct:0.45,reps:10,sets:4}] },
      { name: 'Бицепс стоя', group: '', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.55,reps:12,sets:5}] },
      { name: 'Французский жим', group: '', coef: 0.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:3},{pct:0.6,reps:12,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.33,reps:12,sets:3},{pct:0.4,reps:10,sets:3}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:3},{pct:0.4,reps:10,sets:3}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:5}] },
      { name: 'Разгибания с гантелью из-за головы', group: '', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:5}] },
      { name: 'Жим гантелей', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3},{pct:0.47,reps:10,sets:3}] },
      { name: 'Бицепс с гантелями', group: '', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3},{pct:0.46,reps:10,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:12,sets:3},{pct:0.33,reps:10,sets:3}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:5}] },
      { name: 'Жим гантелей лежа на накл скамье', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3},{pct:0.46,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: '', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:1},{pct:0.48,reps:10,sets:5}] },
      { name: 'Французский жим', group: '', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:3},{pct:0.54,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.36,reps:10,sets:4},{pct:0.4,reps:8,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3},{pct:0.45,reps:10,sets:3}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:3},{pct:0.38,reps:10,sets:3}] },
      { name: 'Разгибания с гантелью из-за головы', group: '', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:2},{pct:0.51,reps:10,sets:2}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.42,reps:12,sets:1},{pct:0.48,reps:10,sets:3},{pct:0.53,reps:8,sets:3}] },
      { name: 'Жим гантелей', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.32,reps:12,sets:3},{pct:0.38,reps:10,sets:3}] },
      { name: 'Бицепс с гантелями', group: '', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.38,reps:12,sets:3},{pct:0.44,reps:10,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:3},{pct:0.38,reps:10,sets:3}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
      { name: 'Жим гантелей лежа на накл скамье', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.43,reps:12,sets:3},{pct:0.5,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: '', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.54,reps:10,sets:5}] },
      { name: 'Французский жим', group: '', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:3},{pct:0.59,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:4},{pct:0.42,reps:8,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.36,reps:12,sets:3},{pct:0.4,reps:10,sets:3}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3},{pct:0.42,reps:10,sets:3}] },
      { name: 'Разгибания с гантелью из-за головы', group: '', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.57,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.55,reps:10,sets:1},{pct:0.6,reps:8,sets:4}] },
      { name: 'Жим гантелей', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:3},{pct:0.43,reps:10,sets:3}] },
      { name: 'Бицепс с гантелями', group: '', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.41,reps:12,sets:1},{pct:0.47,reps:10,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.57,reps:12,sets:6}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.38,reps:12,sets:3},{pct:0.42,reps:10,sets:3}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
      { name: 'Жим гантелей лежа на накл скамье', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:3},{pct:0.52,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: '', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.62,reps:10,sets:3}] },
      { name: 'Французский жим', group: '', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:3},{pct:0.5,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.49,reps:10,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3},{pct:0.45,reps:10,sets:3}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.44,reps:12,sets:3},{pct:0.47,reps:10,sets:3}] },
      { name: 'Разгибания с гантелью из-за головы', group: '', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:1},{pct:0.6,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.62,reps:10,sets:1},{pct:0.71,reps:8,sets:3}] },
      { name: 'Жим гантелей', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:3},{pct:0.52,reps:10,sets:3}] },
      { name: 'Бицепс с гантелями', group: '', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.55,reps:10,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.56,reps:12,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Жим гантелей лежа на накл скамье', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:3},{pct:0.56,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: '', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.65,reps:10,sets:3}] },
      { name: 'Французский жим', group: '', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:5}] },
      { name: 'Разгибания с гантелью из-за головы', group: '', coef: 0.4, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.62,reps:8,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.44,reps:12,sets:1},{pct:0.54,reps:12,sets:3},{pct:0.6,reps:10,sets:3}] },
      { name: 'Жим гантелей', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:3},{pct:0.51,reps:10,sets:3}] },
      { name: 'Бицепс с гантелями', group: '', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.57,reps:10,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:3},{pct:0.38,reps:10,sets:3}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Жим гантелей лежа на накл скамье', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.44,reps:12,sets:3},{pct:0.48,reps:10,sets:4}] },
      { name: 'Бицепс стоя', group: '', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:12,sets:1},{pct:0.62,reps:10,sets:4}] },
      { name: 'Французский жим', group: '', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:5}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:4}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:5}] },
      { name: 'Разгибания с гантелью из-за головы', group: '', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.58,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.45,reps:12,sets:1},{pct:0.52,reps:15,sets:1},{pct:0.6,reps:20,sets:1}] },
      { name: 'Жим гантелей', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3},{pct:0.45,reps:10,sets:3}] },
      { name: 'Бицепс с гантелями', group: '', coef: 0.4, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.5,reps:10,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:5}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:12,sets:4},{pct:0.35,reps:10,sets:4}] },
      { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
      { name: 'Жим гантелей лежа на накл скамье', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:3},{pct:0.41,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: '', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:3},{pct:0.48,reps:10,sets:3}] },
      { name: 'Французский жим', group: '', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:5}] },
      { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.42,reps:12,sets:3},{pct:0.47,reps:10,sets:3}] },
      { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.3,reps:12,sets:4}] },
      { name: 'Разгибания с гантелью из-за головы', group: '', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:3},{pct:0.45,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.55,reps:10,sets:1},{pct:0.63,reps:10,sets:4}] },
      { name: 'Жим гантелей', group: '', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.3,reps:12,sets:4},{pct:0.33,reps:10,sets:4}] },
      { name: 'Бицепс с гантелями', group: '', coef: 0.4, mnosz: 2, load: 'Легкая', sets: [{pct:0.35,reps:12,sets:3},{pct:0.42,reps:10,sets:3}] },
      { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
    ] },
    ],
  ],
};
