import type { SRCycleTemplate } from './lms-types';

/**
 * block-bench-int.ts — Блочный: жим, средний. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..4 генерируются прогрессией PM (correctionPct=0.025).
 */
export const BLOCK_BENCH_INT: SRCycleTemplate = {
 meta: {
 id: 'block-bench-int',
 title: 'Блочный: жим, средний',
 direction: 'bench',
 level: 'II-MS',
 period: 'peak',
 minBodyWeight: 60,
 sessionsPerWeek: 4,
 weeks: 4,
 correctionPct: 0.025,
 description: '4-недельный блочный цикл для жимовиков среднего уровня. Направлен на преодоление плато через варьирование объёма и интенсивности в жиме лёжа. Повторяемый формат до остановки прогресса.',
 howItWorks: 'Цикл «Блочный: жим, средний». Акцент: жим лёжа как главное движение. Волна 4 недели с подводкой к пиковому подъёму в последнюю неделю. Параметры: bench, II-MS, peak, 4 нед × 4 дн/нед, корректировка ПМ 2.5%/нед. Прогрессия весов: ПМ_нед_N = ПМ_0 × (1 + k)^N (k = 2.5%/нед для natural, ×3-4 для on_course). Фаза делода (при weeks ≥ 6): встроена в distributePhases.',
 conditions: ['Условия соответствия цикла: 1.', 'Циклы рассчитаны на спортсменов-жимовиков, то есть атлетов, которые систематически готовятся только в жиме лежа.', 'Предполагается, что спортсмены имеют представление о технике выполнения упражнений и поставленный двигательный навык.', 'Допускается наличие изъянов в технике, однако при условии, что атлет постоянно совершенствует техническое мастерство.', 'В соответствии с классификационными требованиями федерации WPC, циклы рекомендованы атлетам: Уровня до II разряда – Уровня I-МС – Уровня выше МС – ; 2.', 'Предполагается, что атлет соблюдает спортивный режим, работает над собой и ведет активный образ жизни.', 'Циклы не подойдут людям, имеющим напряженную или излишне нервную работу, или же занятость, связанную с тяжелым физическим трудом; 3.'],
  tags: ['lms'],

 },
 week1: [
 { exercises: [
 { name: 'Присед', group: 'СФП', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:1},{pct:0.61,reps:3,sets:2},{pct:0.7,reps:1,sets:2}] },
 { name: 'Пресс в тренажере (скручивания)', group: 'Сгибания обратным хватом', coef: 1, mnosz: 1, sets: [{pct:0.53,reps:4,sets:1},{pct:0.6,reps:3,sets:2},{pct:0.72,reps:2,sets:2},{pct:0.84,reps:1,sets:2}] },
 { name: 'Присед', group: 'СФП', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.66,reps:3,sets:1},{pct:0.75,reps:2,sets:2},{pct:0.8,reps:1,sets:2}] },
 { name: 'Жим лежа', group: 'Сгибания обратным хватом', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
 { name: 'Бицепс стоя', group: 'СФП', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:4}] },
 { name: 'Бицепс с гантелями', group: 'ОФП', coef: 1, mnosz: 2, sets: [{pct:0.4,reps:6,sets:4}] },
 { name: 'Жим лежа', group: 'Сгибания обратным хватом', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:5}] },
 { name: 'Жим лежа', group: 'Сгибания обратным хватом', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.75,reps:1,sets:2},{pct:0.85,reps:1,sets:2}] },
 ] },
 { exercises: [
 { name: 'Жим стоя', group: 'СФП', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
 { name: 'Жим средним хватом', group: 'Сгибания обратным хватом', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:4,sets:2},{pct:0.72,reps:1,sets:2},{pct:0.8,reps:1,sets:2}] },
 { name: 'Жим без ног', group: 'СФП', coef: 1, mnosz: 2, sets: [{pct:0.5,reps:5,sets:5}] },
 { name: 'Молотковые сгибания', group: 'СФП', coef: 1, mnosz: 1, sets: [{pct:0.57,reps:6,sets:4}] },
 { name: 'Сгибания кисти стоя', group: 'Сгибания обратным хватом', coef: 1, mnosz: 1, sets: [{pct:0.56,reps:3,sets:3},{pct:0.65,reps:2,sets:3},{pct:0.75,reps:1,sets:3}] },
 { name: 'Присед', group: 'СФП', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.66,reps:3,sets:3},{pct:0.75,reps:1,sets:3}] },
 ] },
 { exercises: [
 { name: 'Пресс в тренажере (скручивания)', group: 'Сгибания обратным хватом', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4},{pct:0.66,reps:1,sets:3}] },
 { name: 'Присед', group: 'СФП', coef: 1, mnosz: 1, sets: [{pct:0.61,reps:3,sets:1},{pct:0.71,reps:2,sets:2},{pct:0.8,reps:2,sets:2},{pct:0.84,reps:1,sets:2},{pct:0.91,reps:1,sets:2}] },
 { name: 'Жим лежа', group: 'Сгибания обратным хватом', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:3},{pct:0.7,reps:1,sets:2},{pct:0.8,reps:1,sets:2},{pct:0.85,reps:1,sets:2}] },
 { name: 'Жим лежа', group: 'Сгибания обратным хватом', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:3,sets:3},{pct:0.7,reps:1,sets:3}] },
 ] },
 { exercises: [
 { name: 'Жим стоя', group: 'СФП', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:4}] },
 { name: 'Жим средним хватом', group: 'Сгибания обратным хватом', coef: 1, mnosz: 1, sets: [{pct:0.66,reps:3,sets:3},{pct:0.75,reps:1,sets:3}] },
 { name: 'Жим на наклонной', group: 'СФП', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:4}] },
 { name: 'Молотковые сгибания', group: 'СФП', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:4,sets:4}] },
 ] },
 ],
};
