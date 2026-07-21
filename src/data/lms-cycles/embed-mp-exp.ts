import type { SRCycleTemplate } from './lms-types';

/**
 * embed-mp-exp.ts — Встраиваемый: жим стоя, продвинутый. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const EMBED_MP_EXP: SRCycleTemplate = {
 meta: {
 id: 'embed-mp-exp',
 title: 'Встраиваемый: жим стоя, продвинутый',
 direction: 'bench',
 level: 'MS-MSMK',
 period: 'strength',
 sessionsPerWeek: 1,
 weeks: 12,
 correctionPct: 0.005,
 description: '12-недельный встраиваемый микроцикл для жима стоя (продвинутый, МС-МСМК). Интенсивная проработка плеч с использованием продвинутых методов для преодоления плато в армейском жиме.',
 howItWorks: 'Цикл «Встраиваемый: жим стоя, продвинутый». Встройка в основной цикл: добавляет жимовые протоколы в микро-периоде. Не самостоятельный цикл. Параметры: bench, MS-MSMK, strength, 12 нед × 1 дн/нед, корректировка ПМ 0.5%/нед. Прогрессия весов: ПМ_нед_N = ПМ_0 × (1 + k)^N (k = 0.5%/нед для natural, ×3-4 для on_course). Фаза делода (при weeks ≥ 6): встроена в distributePhases.',
 conditions: [],
 tags: ['lms'],
 },
 week1: [
 { exercises: [
 { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:5}] },
 { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:4}] },
 { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.4,reps:6,sets:4},{pct:0.45,reps:5,sets:4}] },
 { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.45,reps:5,sets:5},{pct:0.55,reps:4,sets:5}] },
 { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:5},{pct:0.56,reps:4,sets:5}] },
 { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:4,sets:1},{pct:0.65,reps:4,sets:4}] },
 ] },
 ],
};
