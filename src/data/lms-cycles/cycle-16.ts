import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-16.ts — Выносливость (жим, II-КМС, 2 дн). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const CYCLE_16: SRCycleTemplate = {
  meta: {
    id: 'cycle-16',
    title: 'Выносливость (жим, II-КМС, 2 дн)',
    direction: 'bench',
    level: 'II-KMS',
    period: 'endurance',
    minBodyWeight: 60,
    sessionsPerWeek: 2,
    weeks: 12,
    correctionPct: 0.005,
    sourceWeeks: true,
    description: 'Выносливость (жим, II-КМС, 2 дн).',
    howItWorks: 'Инструкция №16. СРЦ для жимовика уровнем II-КМС под два тренировочных дня. Выносливость. 14.01.2020 16 Циклы для жимовиков Головинский СРЦ После публикации СРЦ15 стало понятно, что двухдневные циклы имеют высокую актуальность. Данные программы весьма востребованы людьми, которые имеют сменный график работы и, кроме того, могут использоваться атлетами со сниженным весоростовым соотношением, так как последним будет настоятельно рекомендовано держать тренировочный объем в определенных рамках. Инструкция №16 описывает цикл под две тренировки в неделю, но уже с прицелом на силовую выносливость. Это позволит людям со сменным графиком иметь полный инструментарий для увеличения жима лежа. СРЦ15 и СР',
    conditions: ['Условия соответствия цикла: Целевая аудитория данного СРЦ – это жимовики начального или среднего уровня со сложным графиком работы.', 'Также программа может использоваться атлетами, которым нужно набирать вес, при условии создания ими профицита калорий.', 'В плане присутствуют приседания – это значит, что атлет должен быть готов их выполнять и обладает достаточным техническим мастерством в данном упражнении.', 'Рекомендованная манера – приседания в низкий сед; Атлет должен соблюдать спортивный режим, работать над собой, следить за всесторонним и гармоничным развитием.', 'Это значит, что цикл не рекомендуется атлетам, которые весят меньше.', 'Весоростовое соотношение может быть любым и существенного значения не имеет; Если атлет имеет какую-либо травму в фазе обострения, то начинать цикл не рекомендуется; Цикл включает две тренировки в рамках недельного микроцикла.', 'В остальные дни атлет может делать легкую зарядку или упражнения на гибкость.'],
  },
  week1: [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:1},{pct:0.71,reps:8,sets:1}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.46,reps:12,sets:1},{pct:0.6,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.36,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:20,sets:1}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:4}] },
    ] },
  ],
  weeks: [
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:1},{pct:0.71,reps:8,sets:1}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.46,reps:12,sets:1},{pct:0.6,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.36,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:20,sets:1}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:10,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.56,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:1},{pct:0.72,reps:8,sets:1}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.62,reps:10,sets:1}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:10,sets:4}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:1}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:10,sets:1}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.58,reps:10,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.52,reps:12,sets:1},{pct:0.66,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:12,sets:1},{pct:0.58,reps:20,sets:1}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:10,sets:4}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:1}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:10,sets:1},{pct:0.7,reps:8,sets:1},{pct:0.77,reps:8,sets:1}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:10,sets:1},{pct:0.58,reps:8,sets:1}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:12,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:1},{pct:0.75,reps:8,sets:1}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.53,reps:10,sets:1},{pct:0.65,reps:8,sets:1}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:20,sets:1}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.58,reps:8,sets:1},{pct:0.67,reps:8,sets:1}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:1}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.43,reps:10,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.43,reps:10,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.48,reps:10,sets:3}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:1},{pct:0.62,reps:20,sets:1}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.38,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:1}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.52,reps:12,sets:1},{pct:0.62,reps:10,sets:1}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:1},{pct:0.68,reps:8,sets:1}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:1},{pct:0.67,reps:8,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:10,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:20,sets:1}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.53,reps:10,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:1}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.6,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.58,reps:10,sets:1},{pct:0.65,reps:8,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.58,reps:10,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:1},{pct:0.7,reps:8,sets:1}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.6,reps:10,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Тяжелая', sets: [{pct:0.5,reps:12,sets:1},{pct:0.65,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:1}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.63,reps:10,sets:1},{pct:0.71,reps:10,sets:1}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:10,sets:1},{pct:0.7,reps:8,sets:1}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:5}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:12,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:1},{pct:0.6,reps:15,sets:1}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:15,sets:1}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:1},{pct:0.6,reps:8,sets:3}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:8,sets:3}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.57,reps:10,sets:1},{pct:0.65,reps:10,sets:1},{pct:0.73,reps:8,sets:1}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.35,reps:10,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:1}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:1},{pct:0.65,reps:8,sets:1}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:4}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.6,reps:10,sets:3}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:15,sets:1}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:10,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.62,reps:8,sets:1},{pct:0.67,reps:8,sets:1}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:2},{pct:0.6,reps:8,sets:2}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:10,sets:3}] },
    ] },
    ],
    [
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:3}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Жим на наклонной', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:15,sets:1}] },
      { name: 'Бицепс стоя', group: 'ОФП', coef: 0.5, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.55,reps:10,sets:1},{pct:0.67,reps:8,sets:1}] },
      { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:12,sets:4}] },
    ] },
    { exercises: [
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
      { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.52,reps:10,sets:1},{pct:0.62,reps:8,sets:1},{pct:0.72,reps:8,sets:1}] },
      { name: 'Жим лежа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.5,reps:12,sets:1},{pct:0.63,reps:10,sets:3}] },
      { name: 'Французский жим', group: 'ОФП', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.55,reps:10,sets:4}] },
    ] },
    ],
  ],
};
