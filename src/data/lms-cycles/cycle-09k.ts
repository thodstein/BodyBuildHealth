import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-09k.ts — Смешанный (тяга+жим, классика). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.015).
 */
export const CYCLE_09K: SRCycleTemplate = {
 meta: {
 id: 'cycle-09k',
 title: 'Смешанный (тяга+жим, классика)',
 direction: 'deadlift_bench',
 level: 'MS-MSMK',
 period: 'mixed',
 minBodyWeight: 80,
 sessionsPerWeek: 3,
 weeks: 12,
 correctionPct: 0.015,
 description: '12-недельный смешанный цикл (тяга+жим, классическая стойка) для уровня МС-МСМК. Сочетает силовую и гипертрофическую работу для комплексного развития в тяге классической и жиме лёжа.',
 howItWorks: 'Смешанный (тяга+жим, классика). Направление: тяга и жим; уровень: МС — МСМК; период: смешанный. 12-недельный смешанный цикл (тяга+жим, классическая стойка) для уровня МС-МСМК. Сочетает силовую и гипертрофическую работу для комплексного развития в тяге классической и жиме лёжа. Принцип построения — саморасчитывающаяся прогрессия: раскладка первой недели повторяется все 12 недель, а вес каждого упражнения на неделе N считается как ПМ0 × (1 + k)^N, где k = 1.5% за неделю (режим — натуральный или на курсе — задаётся при генерации плана). Тоннаж и КПШ растут вместе с ПМ, относительная интенсивность удерживается в рамках заданной раскладки. Объём: 3 тренировки в неделю, 12 недель; минимальный вес тела 80 кг.',
 conditions: ['Условия соответствия цикла: Высокий уровень атлетов.', 'Данный цикл может применяться МС, а также МСМК, имеющих вес тела 80 кг или более.', 'Весоростовое соотношение должно минимально отклоняться от рекомендованного для данной категории спортивного мастерства; Цикл рассчитан на спортсменов, у которых доминирующим движением является становая тяга.', 'В СРЦ 9 используются средние значения интенсивности по ходу цикла.', 'Учитывая смешанный характер цикла, атлет не должен в ходе разминки, заминки или подводящих подходах в упражнениях, выполнять более 6 повторений, чтобы избежать избыточного закисления или (и) накопления усталости.'],
  tags: ['lms'],

 },
 week1: [
 { exercises: [
 { name: 'ТЯГА', group: '', coef: 1, mnosz: 1.4, load: 'Средняя', sets: [{pct:2,reps:0,sets:4},{pct:4,reps:0,sets:3}] },
 ] },
 { exercises: [
 { name: 'ЖИМ', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:5,reps:0,sets:6}] },
 { name: 'ТЯГА', group: '', coef: 1, mnosz: 1.4, load: 'Легкая', sets: [{pct:4,reps:0,sets:4}] },
 { name: 'ЖИМ', group: '', coef: 1, mnosz: 0.8, load: 'Легкая', sets: [{pct:5,reps:0,sets:5}] },
 { name: 'ОФП', group: '', coef: 1, mnosz: 0.5, load: 'Средняя', sets: [{pct:1,reps:0,sets:6},{pct:4,reps:0,sets:5}] },
 { name: 'ТЯГА', group: '', coef: 1, mnosz: 1.4, load: 'Легкая', sets: [{pct:5,reps:0,sets:5}] },
 { name: 'ОФП', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:5,reps:0,sets:5}] },
 { name: 'ОФП', group: '', coef: 1, mnosz: 1.2, load: 'Средняя', sets: [{pct:1,reps:0,sets:6},{pct:4,reps:0,sets:4}] },
 { name: 'ЖИМ', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:1,reps:0,sets:5},{pct:4,reps:0,sets:4}] },
 { name: 'ОФП', group: '', coef: 1, mnosz: 0.8, load: 'Легкая', sets: [{pct:5,reps:0,sets:5}] },
 ] },
 { exercises: [
 { name: 'ТЯГА', group: '', coef: 1, mnosz: 1.4, load: 'Средняя', sets: [{pct:2,reps:0,sets:6},{pct:4,reps:0,sets:4}] },
 { name: 'ЖИМ', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:1,reps:0,sets:6},{pct:5,reps:0,sets:5}] },
 { name: 'ТЯГА', group: '', coef: 1, mnosz: 1.4, load: 'Легкая', sets: [{pct:6,reps:0,sets:3}] },
 { name: 'ЖИМ', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:5,reps:0,sets:5}] },
 { name: 'ЖИМ', group: '', coef: 1, mnosz: 0.8, load: 'Легкая', sets: [{pct:5,reps:0,sets:5}] },
 { name: 'ТЯГА', group: '', coef: 1, mnosz: 1.4, load: 'Легкая', sets: [{pct:5,reps:0,sets:3}] },
 { name: 'ОФП', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:1,reps:0,sets:6},{pct:5,reps:0,sets:5}] },
 { name: 'ОФП', group: '', coef: 1, mnosz: 1.2, load: 'Легкая', sets: [{pct:5,reps:0,sets:6}] },
 { name: 'ЖИМ', group: '', coef: 1, mnosz: 1, load: 'Средняя', sets: [{pct:1,reps:0,sets:6},{pct:5,reps:0,sets:5}] },
 { name: 'ОФП', group: '', coef: 1, mnosz: 0.8, load: 'Легкая', sets: [{pct:4,reps:0,sets:6}] },
 ] },
 ],
};
