import type { SRCycleTemplate } from './lms-types';

/**
 * block-lift-beg.ts — Блочный: троеборье, новичок. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..4 генерируются прогрессией PM (correctionPct=0.02).
 */
export const BLOCK_LIFT_BEG: SRCycleTemplate = {
 meta: {
 id: 'block-lift-beg',
 title: 'Блочный: троеборье, новичок',
 direction: 'powerlifting',
 level: 'novice',
 period: 'peak',
 minBodyWeight: 60,
 sessionsPerWeek: 3,
 weeks: 4,
 correctionPct: 0.02,
 description: '4-недельный блочный цикл для начинающих троеборцев. Охватывает все три соревновательных движения с акцентом на технику и адаптацию к нагрузке. 3 тренировки в неделю, повторяемый формат.',
 howItWorks: 'Цикл «Блочный: троеборье, новичок». Акцент: становая тяга. Короткий 4-недельный блок с подъёмом объёма → интенсивности → пик. Параметры: powerlifting, novice, peak, 4 нед × 3 дн/нед, корректировка ПМ 2.0%/нед. Прогрессия весов: ПМ_нед_N = ПМ_0 × (1 + k)^N (k = 2.0%/нед для natural, ×3-4 для on_course). Фаза делода (при weeks ≥ 6): встроена в distributePhases.',
 conditions: ['Условия соответствия цикла: 1.', 'Циклы рассчитаны на спортсменов-троеборцев, то есть атлетов, которые систематически готовятся к соревнованиям по пауэрлифтингу.', 'Предполагается, что спортсмены имеют представление о технике выполнения упражнений и поставленный двигательный навык.', 'Допускается наличие изъянов в технике, однако при условии, что атлет постоянно совершенствует техническое мастерство.', 'В соответствии с классификационными требованиями федерации WPC, циклы рекомендованы атлетам: Уровня до II разряда – Уровня I-МС – Уровня выше МС – ; 2.', 'Предполагается, что атлет соблюдает спортивный режим, работает над собой и ведет активный образ жизни.', 'Циклы не подойдут людям, имеющим напряженную или излишне нервную работу, или же занятость, связанную с тяжелым физическим трудом; 3.'],
  tags: ['lms'],

 },
 week1: [
 { exercises: [
 { name: 'Присед', group: 'Тяжелая', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.57,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.78,reps:1,sets:2}] },
 { name: 'Присед', group: 'Тяжелая', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
 { name: 'Пресс в тренажере (скручивания)', group: 'ПР', coef: 1, mnosz: 2, load: 'Молотковые сгибания', sets: [{pct:0.65,reps:5,sets:5}] },
 { name: 'Жим гантелей', group: 'ЖМ', coef: 0.4, mnosz: 1, load: 'Средняя', sets: [{pct:0.45,reps:5,sets:5}] },
 { name: 'Становая тяга', group: 'ОФП', coef: 1.4, mnosz: 1, load: 'Легкая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:1,sets:2},{pct:0.83,reps:1,sets:2}] },
 ] },
 { exercises: [
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.7,reps:3,sets:5}] },
 { name: 'Наклоны со штангой', group: 'ЖМ', coef: 0.8, mnosz: 1, load: 'Молотковые сгибания', sets: [{pct:0.55,reps:5,sets:5}] },
 { name: 'Жим стоя', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:0.4,reps:6,sets:4},{pct:0.45,reps:5,sets:4}] },
 { name: 'Жим средним хватом', group: 'ПР', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:2,sets:2}] },
 { name: 'Присед', group: 'Тяжелая', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.65,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.85,reps:1,sets:2}] },
 ] },
 { exercises: [
 { name: 'Жим лежа', group: 'ПР', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.6,reps:3,sets:1},{pct:0.75,reps:3,sets:4}] },
 { name: 'Присед', group: 'Тяжелая', coef: 1.2, mnosz: 1, load: 'Молотковые сгибания', sets: [{pct:0.6,reps:4,sets:4}] },
 { name: 'Жим на наклонной скамье', group: 'ПР', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
 { name: 'Бицепс стоя', group: 'ЖМ', coef: 0.5, mnosz: 1, load: 'Молотковые сгибания', sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:5,sets:5}] },
 ] },
 ],
};
