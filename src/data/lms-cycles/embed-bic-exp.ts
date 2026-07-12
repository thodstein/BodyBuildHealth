import type { SRCycleTemplate } from './lms-types';

/**
 * embed-bic-exp.ts — Встраиваемый: бицепс, продвинутый. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const EMBED_BIC_EXP: SRCycleTemplate = {
 meta: {
 id: 'embed-bic-exp',
 title: 'Встраиваемый: бицепс, продвинутый',
 direction: 'bodybuilding',
 level: 'MS-MSMK',
 period: 'strength',
 sessionsPerWeek: 1,
 weeks: 12,
 correctionPct: 0.005,
 description: '12-недельный встраиваемый микроцикл для строгого подъёма на бицепс (продвинутый, МС-МСМК). Высокоинтенсивные техники для преодоления застоя и дальнейшего роста результата в строгом подъёме.',
 howItWorks: 'Встраиваемый: бицепс, продвинутый. Направление: бодибилдинг; уровень: МС — МСМК; период: силовой. 12-недельный встраиваемый микроцикл для строгого подъёма на бицепс (продвинутый, МС-МСМК). Высокоинтенсивные техники для преодоления застоя и дальнейшего роста результата в строгом подъёме. Принцип построения — саморасчитывающаяся прогрессия: раскладка первой недели повторяется все 12 недель, а вес каждого упражнения на неделе N считается как ПМ0 × (1 + k)^N, где k = 0.5% за неделю (режим — натуральный или на курсе — задаётся при генерации плана). Тоннаж и КПШ растут вместе с ПМ, относительная интенсивность удерживается в рамках заданной раскладки. Объём: 1 тренировки в неделю, 12 недель.',
 conditions: [],
 tags: ['lms'],
 },
 week1: [
 { exercises: [
 { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.43,reps:6,sets:3},{pct:0.5,reps:5,sets:3}] },
 { name: 'Подъем обратным хватом стоя', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
 { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:1},{pct:0.6,reps:2,sets:2},{pct:0.7,reps:1,sets:2}] },
 { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
 { name: 'Пресс в тренажере (скручивания)', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4},{pct:0.7,reps:3,sets:4}] },
 { name: 'Концентрированный подъем', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
 { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
 { name: 'Упражнение комплекса', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:4,sets:1},{pct:0.68,reps:4,sets:4}] },
 { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:1},{pct:0.65,reps:2,sets:5}] },
 { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:5,sets:5}] },
 { name: 'Пресс в тренажере (скручивания)', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:6,sets:5}] },
 { name: 'Концентрированный подъем', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:5,sets:5}] },
 ] },
 ],
};
