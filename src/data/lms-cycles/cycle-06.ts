import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-06.ts — Силовой цикл (жим, КМС-МС). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const CYCLE_06: SRCycleTemplate = {
 meta: {
 id: 'cycle-06',
 title: 'Силовой цикл (жим, КМС-МС)',
 direction: 'bench',
 level: 'KMS-MS',
 period: 'strength',
 minBodyWeight: 80,
 sessionsPerWeek: 4,
 weeks: 12,
 correctionPct: 0.005,
 description: '12-недельный силовой цикл для жимовика высокого уровня (КМС-МС). Характеризуется увеличенным тренировочным объёмом и средним весом отягощений для стимуляции дальнейшего прогресса. Включает 4 тренировки в неделю.',
 howItWorks: 'Цикл «Силовой цикл (жим, КМС-МС)». Цикл с акцентом на присед. Тяга и жим фоном, присед — основной прогресс. Параметры: bench, KMS-MS, strength, 12 нед × 4 дн/нед, корректировка ПМ 0.5%/нед. Прогрессия весов: ПМ_нед_N = ПМ_0 × (1 + k)^N (k = 0.5%/нед для natural, ×3-4 для on_course). Фаза делода (при weeks ≥ 6): встроена в distributePhases.',
 conditions: ['Условия соответствия цикла: Уровень атлетов достаточно высокий.', 'Данный цикл может применяться КМС, а также МС, имеющих вес тела 80 кг или более.', 'Весоростовое соотношение должно минимально отклоняться от рекомендованного для данной категории спортивного мастерства; С позиции слабых мест нет каких-либо рекомендаций.', 'Приоритет данных движений средний.', 'В Цикле №6 применяется традиционная схема организации нагрузки, с позиции интенсивности.', 'Принципы высокообъемного тренинга и тренировок на микровесах реализованы частично.', 'В дни тяжелых тренировок часто добавляются раскладки в режиме периода по выходу на пик силы.'],
  tags: ['lms'],

 },
 week1: [
 { exercises: [
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Молотковые сгибания', sets: [{pct:0.56,reps:6,sets:4}] },
 { name: 'Присед', group: 'Тяжелая', coef: 1.3, mnosz: 1, load: 'Молотковые сгибания', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.7,reps:4,sets:4}] },
 { name: 'Пресс в тренажере (скручивания)', group: 'ПР', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:5,sets:4}] },
 { name: 'ОФП', group: 'ПР', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:4}] },
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.35,reps:6,sets:3}] },
 ] },
 { exercises: [
 { name: 'Жим стоя', group: 'ЖМ', coef: 0.8, mnosz: 1, load: 'Молотковые сгибания', sets: [{pct:0.45,reps:6,sets:1},{pct:0.6,reps:5,sets:5}] },
 { name: 'Жим средним хватом', group: 'ПР', coef: 1, mnosz: 1, load: 'Молотковые сгибания', sets: [{pct:0.5,reps:6,sets:1},{pct:0.62,reps:4,sets:4}] },
 { name: 'Жим гантелей', group: 'ЖМ', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:4}] },
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:1},{pct:0.74,reps:4,sets:3}] },
 ] },
 { exercises: [
 { name: 'Присед', group: 'Тяжелая', coef: 1.3, mnosz: 1, load: 'Молотковые сгибания', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.77,reps:3,sets:5}] },
 { name: 'Жим на наклонной', group: 'ПР', coef: 0.8, mnosz: 2, load: 'Молотковые сгибания', sets: [{pct:0.55,reps:6,sets:5}] },
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:6,sets:3}] },
 ] },
 { exercises: [
 { name: 'Жим гантелей вниз головой', group: 'ПР', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.4,reps:6,sets:4}] },
 { name: 'Бицепс стоя', group: 'ЖМ', coef: 0.5, mnosz: 1, load: 'Молотковые сгибания', sets: [{pct:0.5,reps:6,sets:1},{pct:0.6,reps:5,sets:4}] },
 { name: 'Жим гантелей на наклонной', group: 'ЖМ', coef: 0.3, mnosz: 2, load: 'Молотковые сгибания', sets: [{pct:0.5,reps:6,sets:1},{pct:0.58,reps:5,sets:4}] },
 ] },
 ],
};
