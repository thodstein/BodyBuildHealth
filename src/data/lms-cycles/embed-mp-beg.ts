import type { SRCycleTemplate } from './lms-types';

/**
 * embed-mp-beg.ts — Встраиваемый: жим стоя, новичок. Импортировано из xlsm (Этап A1/B3). Обезличено.
 * Раскладка недели 1; недели 2..12 генерируются прогрессией PM (correctionPct=0.005).
 */
export const EMBED_MP_BEG: SRCycleTemplate = {
 meta: {
 id: 'embed-mp-beg',
 title: 'Встраиваемый: жим стоя, новичок',
 direction: 'bench',
 level: 'novice',
 period: 'strength',
 sessionsPerWeek: 1,
 weeks: 12,
 correctionPct: 0.005,
 description: '12-недельный встраиваемый микроцикл для жима стоя (новичок). Может быть добавлен в любой основной цикл для укрепления плечевого пояса и развития армейского жима без ущерба для основной специализации.',
 howItWorks: 'Цикл «Встраиваемый: жим стоя, новичок». Встройка в основной цикл: добавляет жимовые протоколы в микро-периоде. Не самостоятельный цикл. Параметры: bench, novice, strength, 12 нед × 1 дн/нед, корректировка ПМ 0.5%/нед. Прогрессия весов: ПМ_нед_N = ПМ_0 × (1 + k)^N (k = 0.5%/нед для natural, ×3-4 для on_course). Фаза делода (при weeks ≥ 6): встроена в distributePhases.',
 conditions: [],
 tags: ['lms'],
 },
 week1: [
 { exercises: [
 { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.52,reps:6,sets:4},{pct:0.6,reps:5,sets:4}] },
 { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.55,reps:5,sets:1},{pct:0.65,reps:4,sets:4}] },
 { name: 'Жим стоя', group: '', coef: 1, mnosz: 1, sets: [{pct:0.45,reps:6,sets:4},{pct:0.5,reps:5,sets:4}] },
 { name: 'Жим средним хватом', group: '', coef: 1, mnosz: 1, sets: [{pct:0.5,reps:5,sets:1},{pct:0.6,reps:4,sets:1},{pct:0.7,reps:4,sets:4}] },
 ] },
 ],
};
