import type { SRCycleTemplate } from './lms-types';

/**
 * cycle-04.ts — Силовой цикл (армрестлинг, верх). Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const CYCLE_04: SRCycleTemplate = {
 meta: {
 id: 'cycle-04',
 title: 'Силовой цикл (армрестлинг, верх)',
 direction: 'armwrestling',
 level: 'II-KMS',
 period: 'strength',
 minBodyWeight: 80,
 sessionsPerWeek: 3,
 weeks: 12,
 correctionPct: 0.005,
 description: '12-недельный силовой цикл для армрестлера-верховика уровня II-КМС. Укрепляет связки и мышцы рук, развивает специальную силовую выносливость и взрывную силу. Включает 3 тренировки в неделю с акцентом на кисть, бицепс и широчайшие.',
 howItWorks: 'Силовой цикл (армрестлинг, верх). Направление: армрестлинг; уровень: II разряд — КМС; период: силовой. 12-недельный силовой цикл для армрестлера-верховика уровня II-КМС. Укрепляет связки и мышцы рук, развивает специальную силовую выносливость и взрывную силу. Включает 3 тренировки в неделю с акцентом на кисть, бицепс и широчайшие. Принцип построения — саморасчитывающаяся прогрессия: раскладка первой недели повторяется все 12 недель, а вес каждого упражнения на неделе N считается как ПМ0 × (1 + k)^N, где k = 0.5% за неделю (режим — натуральный или на курсе — задаётся при генерации плана). Тоннаж и КПШ растут вместе с ПМ, относительная интенсивность удерживается в рамках заданной раскладки. Объём: 3 тренировки в неделю, 12 недель; минимальный вес тела 80 кг.',
 conditions: [],
 },
 week1: [
 { exercises: [
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.4,reps:6,sets:3}] },
 { name: 'Боковой нажим', group: '', coef: 0.8, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
 { name: 'Кисть РР', group: '', coef: 1.2, mnosz: 2, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
 { name: 'Тяга верхнего блока', group: '', coef: 0.3, mnosz: 7, load: 'Средняя', sets: [{pct:0.52,reps:6,sets:2}] },
 { name: 'Бицепс', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.4,reps:5,sets:3}] },
 { name: 'Приведение к плечу', group: '', coef: 1.2, mnosz: 1, load: 'Легкая', sets: [{pct:0.45,reps:6,sets:3}] },
 { name: 'Иммитация верха', group: '', coef: 1, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:4}] },
 { name: 'Кисть РР ', group: '', coef: 1.2, mnosz: 1, load: 'Средняя', sets: [{pct:0.68,reps:5,sets:3}] },
 { name: 'Жим стоя', group: '', coef: 0.6, mnosz: 1, load: 'Лекгкая', sets: [{pct:0.48,reps:4,sets:4}] },
 { name: 'Натяжка', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.43,reps:6,sets:3}] },
 ] },
 { exercises: [
 { name: 'Отведение СБ', group: '', coef: 0.5, mnosz: 2, load: 'Средняя', sets: [{pct:0.55,reps:5,sets:5}] },
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Легкая', sets: [{pct:0.48,reps:6,sets:3}] },
 { name: 'Кисть РР', group: '', coef: 1.2, mnosz: 2, load: 'Средняя', sets: [{pct:0.65,reps:4,sets:4}] },
 { name: 'Подтягивание ', group: '', coef: 0.3, mnosz: 2, load: 'Легкая', sets: [{pct:0.47,reps:6,sets:3}] },
 { name: 'Бицепс', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.5,reps:4,sets:4}] },
 ] },
 { exercises: [
 { name: 'Жим лежа', group: '', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{pct:0.52,reps:6,sets:1},{pct:0.65,reps:6,sets:3}] },
 { name: 'Отведение СБ', group: '', coef: 0.5, mnosz: 2, load: 'Легкая', sets: [{pct:0.37,reps:4,sets:4}] },
 { name: 'Имитация (статика)', group: '', coef: 0.8, mnosz: 7, load: 'Легкая', sets: [{pct:0.44,reps:6,sets:3}] },
 { name: 'Подтягивание ', group: '', coef: 0.3, mnosz: 2, load: 'Средняя', sets: [{pct:0.52,reps:6,sets:3}] },
 ] },
 ],
};
