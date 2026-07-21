import type { SRCycleTemplate } from './lms-types';

/**
 * block-bench-beg.ts — Блочный: жим, новичок. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..4 генерируются прогрессией PM (correctionPct=0.02).
 */
export const BLOCK_BENCH_BEG: SRCycleTemplate = {
 meta: {
 id: 'block-bench-beg',
 title: 'Блочный: жим, новичок',
 direction: 'bench',
 level: 'novice',
 period: 'peak',
 minBodyWeight: 60,
 sessionsPerWeek: 3,
 weeks: 4,
 correctionPct: 0.02,
 description: '4-недельный блочный цикл для начинающих жимовиков. Сфокусирован на освоение техники жима лёжа и базовой силовой подготовки. Постепенное увеличение нагрузки с контролем восстановления и возможностью повторения.',
 howItWorks: 'Цикл «Блочный: жим, новичок». Акцент: жим лёжа как главное движение. Волна 4 недели с подводкой к пиковому подъёму в последнюю неделю. Параметры: bench, novice, peak, 4 нед × 3 дн/нед, корректировка ПМ 2.0%/нед. Прогрессия весов: ПМ_нед_N = ПМ_0 × (1 + k)^N (k = 2.0%/нед для natural, ×3-4 для on_course). Фаза делода (при weeks ≥ 6): встроена в distributePhases.',
 conditions: ['Условия соответствия цикла: 1.', 'Циклы рассчитаны на спортсменов-жимовиков, то есть атлетов, которые систематически готовятся только в жиме лежа.', 'Предполагается, что спортсмены имеют представление о технике выполнения упражнений и поставленный двигательный навык.', 'Допускается наличие изъянов в технике, однако при условии, что атлет постоянно совершенствует техническое мастерство.', 'В соответствии с классификационными требованиями федерации WPC, циклы рекомендованы атлетам: Уровня до II разряда – Уровня I-МС – Уровня выше МС – ; 2.', 'Предполагается, что атлет соблюдает спортивный режим, работает над собой и ведет активный образ жизни.', 'Циклы не подойдут людям, имеющим напряженную или излишне нервную работу, или же занятость, связанную с тяжелым физическим трудом; 3.'],
  tags: ['lms'],

 },
 week1: [
 { exercises: [
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:1},{pct:0.62,reps:3,sets:3},{pct:0.74,reps:2,sets:3}] },
 { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:2},{pct:0.75,reps:1,sets:2},{pct:0.83,reps:1,sets:2}] },
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.66,reps:3,sets:1},{pct:0.75,reps:2,sets:3},{pct:0.8,reps:1,sets:3}] },
 { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
 { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:5,sets:5}] },
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.66,reps:3,sets:1},{pct:0.75,reps:3,sets:5}] },
 ] },
 { exercises: [
 { name: 'Становая тяга', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.61,reps:2,sets:1},{pct:0.7,reps:2,sets:2},{pct:0.78,reps:2,sets:2},{pct:0.86,reps:1,sets:2}] },
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:3,sets:3},{pct:0.75,reps:2,sets:3},{pct:0.82,reps:1,sets:3}] },
 { name: 'Бицепс стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
 { name: 'Пресс в тренажере (скручивания)', group: '', coef: 1, mnosz: 2, sets: [{pct:0.5,reps:5,sets:5}] },
 { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:5,sets:5}] },
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.62,reps:3,sets:1},{pct:0.7,reps:2,sets:3},{pct:0.76,reps:1,sets:3},{pct:0.8,reps:1,sets:3}] },
 ] },
 { exercises: [
 { name: 'Присед', group: '', coef: 1, mnosz: 1, sets: [{pct:0.51,reps:4,sets:1},{pct:0.62,reps:3,sets:3},{pct:0.75,reps:2,sets:3}] },
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, sets: [{pct:0.66,reps:3,sets:4},{pct:0.75,reps:1,sets:4}] },
 { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:1},{pct:0.61,reps:4,sets:4}] },
 { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:4},{pct:0.6,reps:3,sets:4}] },
 ] },
 ],
};
