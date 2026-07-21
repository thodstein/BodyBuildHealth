import type { SRCycleTemplate } from './lms-types';

/**
 * embed-bic-beg.ts — Встраиваемый: бицепс, новичок. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const EMBED_BIC_BEG: SRCycleTemplate = {
 meta: {
 id: 'embed-bic-beg',
 title: 'Встраиваемый: бицепс, новичок',
 direction: 'bodybuilding',
 level: 'novice',
 period: 'strength',
 sessionsPerWeek: 1,
 weeks: 12,
 correctionPct: 0.005,
 description: '12-недельный встраиваемый микроцикл для строгого подъёма на бицепс (новичок). Целевая проработка сгибателей рук для укрепления и роста. Может быть встроен в любой тренировочный план.',
 howItWorks: 'Цикл «Встраиваемый: бицепс, новичок». Встройка для бицепса: специализация в основном цикле. Добавочный объём на бицепс без перетрена. Параметры: bodybuilding, novice, strength, 12 нед × 1 дн/нед, корректировка ПМ 0.5%/нед. Прогрессия весов: ПМ_нед_N = ПМ_0 × (1 + k)^N (k = 0.5%/нед для natural, ×3-4 для on_course). Фаза делода (при weeks ≥ 6): встроена в distributePhases.',
 conditions: [],
 tags: ['lms'],
 },
 week1: [
 { exercises: [
 { name: 'Пресс в тренажере (скручивания)', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:4,sets:3},{pct:0.6,reps:3,sets:3}] },
 { name: 'Бицепс стоя со штангой', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5}] },
 { name: 'Кисть стоя', group: '', coef: 1, mnosz: 2, sets: [{pct:0.4,reps:6,sets:4}] },
 { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:3,sets:3},{pct:0.62,reps:1,sets:3},{pct:0.72,reps:1,sets:3}] },
 { name: 'Молотковые сгибания', group: '', coef: 1, mnosz: 1, sets: [{pct:0.58,reps:2,sets:5}] },
 { name: 'Упражнение комплекса', group: '', coef: 1, mnosz: 2, sets: [{pct:0.5,reps:4,sets:1},{pct:0.6,reps:4,sets:4}] },
 { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4},{pct:0.7,reps:3,sets:4}] },
 { name: 'Бицепс стоя со штангой', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:5,sets:5}] },
 { name: 'Концентрированный подъем', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:5,sets:5}] },
 ] },
 ],
};
