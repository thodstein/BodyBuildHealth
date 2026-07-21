import type { SRCycleTemplate } from './lms-types';

/**
 * block-bench-exp.ts — Блочный: жим, продвинутый. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..4 генерируются прогрессией PM (correctionPct=0.005).
 */
export const BLOCK_BENCH_EXP: SRCycleTemplate = {
 meta: {
 id: 'block-bench-exp',
 title: 'Блочный: жим, продвинутый',
 direction: 'bench',
 level: 'MS-MSMK',
 period: 'peak',
 minBodyWeight: 60,
 sessionsPerWeek: 4,
 weeks: 4,
 correctionPct: 0.005,
 description: '4-недельный блочный цикл для продвинутых жимовиков уровня МС-МСМК. Высокоинтенсивный тренинг с продвинутыми методами для максимальной стимуляции роста результата. 4 тренировки в неделю.',
 howItWorks: 'Цикл «Блочный: жим, продвинутый». Акцент: жим лёжа как главное движение. Волна 4 недели с подводкой к пиковому подъёму в последнюю неделю. Параметры: bench, MS-MSMK, peak, 4 нед × 4 дн/нед, корректировка ПМ 0.5%/нед. Прогрессия весов: ПМ_нед_N = ПМ_0 × (1 + k)^N (k = 0.5%/нед для natural, ×3-4 для on_course). Фаза делода (при weeks ≥ 6): встроена в distributePhases.',
 conditions: ['Условия соответствия цикла: 1.', 'Циклы рассчитаны на спортсменов-жимовиков, то есть атлетов, которые систематически готовятся только в жиме лежа.', 'Предполагается, что спортсмены имеют представление о технике выполнения упражнений и поставленный двигательный навык.', 'Допускается наличие изъянов в технике, однако при условии, что атлет постоянно совершенствует техническое мастерство.', 'В соответствии с классификационными требованиями федерации WPC, циклы рекомендованы атлетам: Уровня до II разряда – Уровня I-МС – Уровня выше МС – ; 2.', 'Предполагается, что атлет соблюдает спортивный режим, работает над собой и ведет активный образ жизни.', 'Циклы не подойдут людям, имеющим напряженную или излишне нервную работу, или же занятость, связанную с тяжелым физическим трудом; 3.'],
  tags: ['lms'],

 },
 week1: [
 { exercises: [
 { name: 'Жим гантелей на наклонной', group: '', coef: 1, mnosz: 1, sets: [{pct:0.51,reps:3,sets:2},{pct:0.6,reps:1,sets:3}] },
 { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:2},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:2,sets:2}] },
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:3},{pct:0.7,reps:2,sets:3}] },
 { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.76,reps:1,sets:2}] },
 { name: 'Бицепс стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:4}] },
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.77,reps:1,sets:2}] },
 ] },
 { exercises: [
 { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.52,reps:5,sets:5}] },
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.7,reps:4,sets:4}] },
 { name: 'Сгибание кисти стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.52,reps:5,sets:5}] },
 { name: 'Пресс в тренажере (скручивания)', group: '', coef: 1, mnosz: 2, sets: [{pct:0.47,reps:5,sets:5}] },
 { name: 'Жим гантелей на наклонной', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:3},{pct:0.71,reps:2,sets:3}] },
 ] },
 { exercises: [
 { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:2},{pct:0.7,reps:1,sets:2},{pct:0.76,reps:1,sets:2},{pct:0.85,reps:1,sets:2}] },
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.66,reps:3,sets:3},{pct:0.75,reps:1,sets:3}] },
 { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.56,reps:3,sets:1},{pct:0.65,reps:2,sets:3}] },
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.8,reps:2,sets:2},{pct:0.86,reps:1,sets:2}] },
 ] },
 { exercises: [
 { name: 'Жим без ног', group: '', coef: 1, mnosz: 1, sets: [{pct:0.52,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
 { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 1, sets: [{pct:0.51,reps:4,sets:1},{pct:0.6,reps:4,sets:4}] },
 { name: 'Жим на наклонной', group: '', coef: 1, mnosz: 2, sets: [{pct:0.51,reps:5,sets:5}] },
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:2}] },
 ] },
 ],
};
