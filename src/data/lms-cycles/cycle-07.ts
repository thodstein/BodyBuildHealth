import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-07.ts — Выход на пик (троеборье, МС-МСМК). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const CYCLE_07: SRCycleTemplate = {
 meta: {
 id: 'cycle-07',
 title: 'Выход на пик (троеборье, МС-МСМК)',
 direction: 'powerlifting',
 level: 'MS-MSMK',
 period: 'peak',
 minBodyWeight: 70,
 sessionsPerWeek: 5,
 weeks: 12,
 correctionPct: 0.005,
 description: '12-недельный цикл выхода на пик для троеборца уровня МС-МСМК. Сфокусирован на подведение к соревнованиям с максимизацией 1ПМ в трёх движениях. Интенсивная схема нагрузки с 5 тренировками в неделю.',
 howItWorks: 'Цикл «Выход на пик (троеборье, МС-МСМК)». Цикл с акцентом на становую тягу. Приседания и жим фоном, тяга — основной прогресс. Параметры: powerlifting, MS-MSMK, peak, 12 нед × 5 дн/нед, корректировка ПМ 0.5%/нед. Прогрессия весов: ПМ_нед_N = ПМ_0 × (1 + k)^N (k = 0.5%/нед для natural, ×3-4 для on_course). Фаза делода (при weeks ≥ 6): встроена в distributePhases.',
 conditions: ['Условия соответствия цикла: Высокий уровень атлетов.', 'Данный цикл может применяться МС, а также МСМК, имеющих вес тела 70 кг или более.', 'Необходимо не только обеспечить должный уровень восстановления, но и ввести дополнительные меры для его ускорения (модификация рациона, массаж, активный отдых и подобное).', 'В случае последнего можно повысить процент корректировки до 1-1,5 или даже выше.', 'В Цикле №7 применяется интенсивная схема организации нагрузки.', 'Принципы высокообъемного тренинга и тренировок на микровесах реализованы только в плоскости легких тренировок.', 'Основная часть нагрузки нацелена на интенсивную работу на высоком проценте.'],
  tags: ['lms'],

 },
 week1: [
 { exercises: [
 { name: 'Присед', group: 'Тяжелая', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.54,reps:5,sets:1},{pct:0.65,reps:4,sets:1},{pct:0.74,reps:3,sets:3},{pct:0.8,reps:1,sets:3}] },
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Наклоны', sets: [{pct:0.6,reps:4,sets:4}] },
 { name: 'Присед на груди', group: 'Тяжелая', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.66,reps:3,sets:1},{pct:0.75,reps:2,sets:5}] },
 { name: 'Молотковые сгибания', group: 'ЖМ', coef: 0.8, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:5,sets:5}] },
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:3},{pct:0.77,reps:1,sets:3}] },
 ] },
 { exercises: [
 { name: 'Жим стоя', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Наклоны', sets: [{pct:0.5,reps:5,sets:5},{pct:0.59,reps:4,sets:5}] },
 { name: 'Жим средним хватом', group: 'ПР', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.76,reps:1,sets:3}] },
 { name: 'Жим гантелей', group: 'ЖМ', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:6,sets:5}] },
 { name: 'Становая тяга', group: 'ОФП', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:1,sets:2}] },
 ] },
 { exercises: [
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
 { name: 'Тяга на прямых ногах', group: 'ОФП', coef: 1.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:5,sets:5}] },
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Наклоны', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Наклоны', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:5,sets:5}] },
 ] },
 { exercises: [
 { name: 'Присед', group: 'Тяжелая', coef: 1.3, mnosz: 1, load: 'Легкая', sets: [{pct:0.5,reps:4,sets:1},{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:3},{pct:0.78,reps:1,sets:2}] },
 { name: 'Пресс в тренажере (скручивания)', group: 'ПР', coef: 1, mnosz: 1, load: 'Наклоны', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
 { name: 'Присед', group: 'Тяжелая', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:5,sets:5}] },
 { name: 'Жим на наклонной', group: 'ПР', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.4,reps:5,sets:5}] },
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:2,sets:2}] },
 ] },
 { exercises: [
 { name: 'Опциональная тяга', group: 'ОФП', coef: 1.4, mnosz: 1, load: 'Наклоны', sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:5}] },
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:1},{pct:0.75,reps:2,sets:1},{pct:0.85,reps:1,sets:2}] },
 { name: 'Присед на груди', group: 'Тяжелая', coef: 1.3, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:5,sets:5}] },
 ] },
 ],
};
