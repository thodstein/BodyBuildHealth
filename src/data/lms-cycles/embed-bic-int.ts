import type { SRCycleTemplate } from './lms-types';

/**
 * embed-bic-int.ts — Встраиваемый: бицепс, средний. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const EMBED_BIC_INT: SRCycleTemplate = {
 meta: {
 id: 'embed-bic-int',
 title: 'Встраиваемый: бицепс, средний',
 direction: 'bodybuilding',
 level: 'II-MS',
 period: 'strength',
 sessionsPerWeek: 1,
 weeks: 12,
 correctionPct: 0.005,
 description: '12-недельный встраиваемый микроцикл для строгого подъёма на бицепс (средний уровень). Увеличение объёма и интенсивности для стимуляции гипертрофии бицепса без помех основной подготовке.',
 howItWorks: 'Цикл «Встраиваемый: бицепс, средний». Встройка для бицепса: специализация в основном цикле. Добавочный объём на бицепс без перетрена. Параметры: bodybuilding, II-MS, strength, 12 нед × 1 дн/нед, корректировка ПМ 0.5%/нед. Прогрессия весов: ПМ_нед_N = ПМ_0 × (1 + k)^N (k = 0.5%/нед для natural, ×3-4 для on_course). Фаза делода (при weeks ≥ 6): встроена в distributePhases.',
 conditions: [],
 tags: ['lms'],
 },
 week1: [
 { exercises: [
 { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:5}] },
 { name: 'Пресс в тренажере (скручивания)', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:6,sets:4}] },
 { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:4},{pct:0.68,reps:1,sets:4}] },
 { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:3,sets:3},{pct:0.65,reps:1,sets:3},{pct:0.75,reps:1,sets:3}] },
 { name: 'Кисть стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.45,reps:5,sets:5}] },
 { name: 'Упражнение комплекса', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
 { name: 'Бицепс с гантелями', group: '', coef: 1, mnosz: 2, sets: [{pct:0.55,reps:5,sets:1},{pct:0.6,reps:4,sets:4},{pct:0.7,reps:3,sets:4}] },
 { name: 'Пресс в тренажере (скручивания)', group: '', coef: 1, mnosz: 1, sets: [{pct:0.6,reps:5,sets:5}] },
 { name: 'Концентрированный подъем', group: '', coef: 1, mnosz: 1, sets: [{pct:0.44,reps:5,sets:5}] },
 ] },
 ],
};
