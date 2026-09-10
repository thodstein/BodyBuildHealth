/**
 * cardio-row-short.ts — короткие гребные циклы:
 * CARDIO_ROW_2K_4 (Concept2 2K 4-Week, сжатый) и
 * CARDIO_ROW_BEGINNER_8 (British Rowing Beginner 8 недель: техника →
 * дистанция → 2000 м; damper ≤4; fitness-boost бег/ходьба опционально).
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const row = (d: number, p: string, workSec?: number, restSec?: number, reps?: number, dow?: number): CardioTemplateSession => ({
  type: workSec ? 'hiit' : 'zone2', durationMin: d, equipment: 'rowing', purpose: p, dayOfWeek: dow,
  structured: workSec && restSec && reps ? [{ workSec, restSec, reps, target: 'pace', note: 'Сплит /500м по среднему темпу' }] : undefined,
});
const ez = (d: number, p: string, dow?: number): CardioTemplateSession => ({ type: 'zone2', durationMin: d, equipment: 'rowing', purpose: p, dayOfWeek: dow });
const rec = (d: number, p: string, dow?: number): CardioTemplateSession => ({ type: 'recovery', durationMin: d, equipment: 'rowing', purpose: p, dayOfWeek: dow });

// ─── 2K 4 недели (сжатый Concept2) ───
const w4: CardioTemplateWeek[] = [
  { sessions: [row(20, 'ТЕСТ 2000 м.', undefined, undefined, undefined, 0), row(26, 'Интервалы 4×4 мин / 2 мин.', 240, 120, 4, 2), row(24, 'Интервалы 6×2 мин / 1 мин.', 120, 60, 6, 4)], phase: 'base', note: 'Старт + тест.' },
  { sessions: [row(30, 'Интервалы 5×4 мин / 2 мин.', 240, 120, 5, 0), row(30, 'Интервалы 3×6 мин / 3 мин.', 360, 180, 3, 2), row(28, 'Интервалы 8×2 мин / 1 мин.', 120, 60, 8, 4)], phase: 'build', note: 'Объём.' },
  { sessions: [row(28, 'Интервалы 6×3 мин / 2 мин.', 180, 120, 6, 0), row(26, 'Интервалы 4×5 мин / 3 мин.', 300, 180, 4, 2), row(22, 'Интервалы 12×1 мин / 1 мин.', 60, 60, 12, 4)], phase: 'build', note: 'Скорость.' },
  { sessions: [row(20, 'ТЕСТ 2000 м — финал!', undefined, undefined, undefined, 0), rec(20, 'Лёгкая гребля 20 мин.', 2), ez(25, 'Ровная 25 мин.', 4)], phase: 'peak', taper: true, note: 'Подводка + тест.' },
];

export const CARDIO_ROW_2K_4: CardioCycleTemplate = {
  meta: {
    id: 'cardio-row-2k-4',
    title: 'Гребля 2K — 4 недели (Concept2, сжатый)',
    goal: 'health',
    goalFit: ['health', 'maintenance', 'cut'],
    weeks: 4,
    sessionsPerWeek: 3,
    level: ['intermediate', 'advanced'],
    sport: 'row',
    period: 'peak',
    equipment: ['rowing'],
    lowImpact: true,
    kind: 'explicit',
    description: 'Быстрая подводка к тесту 2000 м за 4 недели: тест → объём → скорость → тест.',
    howItWorks: 'Неделя = 3 интервальные; темп — по сплиту; 4-я — подводка + финальный тест.',
    conditions: ['Гребёте 30 мин непрерывно', 'Знаете свой сплит /500м'],
    tags: ['row', 'erg', '2k', 'peak', 'low-impact'],
    taperWeeks: [4],
    sourceLabel: 'Concept2 2000m Training Plan — 4-week version',
  },
  preset: { goal: 'health', totalWeeks: 4, daysAvailable: 3, level: 'intermediate', equipment: ['rowing'], lowImpact: true },
  weeks: w4,
};

// ─── British Rowing Beginner 8 недель ───
const WB: CardioTemplateWeek[] = [
  { sessions: [row(10, '1 мин гребля низкой интенсивности / 1 мин отдых ×5. Damper ≤4, техника: драйв ногами → корпус → руки.', 60, 60, 5, 0), row(13, '5 мин гребля / 3 мин отдых ×2.', 300, 180, 2, 2)], phase: 'base', note: 'Привыкание + техника (темп, последовательность, осанка).' },
  { sessions: [row(15, '2 мин гребля / 1 мин отдых ×5. Гребём плавно, мощный драйв — медленный возврат.', 120, 60, 5, 0), row(24, '5 мин гребля / 3 мин лёгкой ×3.', 300, 180, 3, 2)], phase: 'base', note: 'Рост времени + техника.' },
  { sessions: [row(22, '500 м средней интенсивности / 2 мин отдых ×4. Записывайте время каждого.', 500, 120, 4, 0), row(15, '10 мин: 5 мин легко + 5 мин средне.', 300, 60, 2, 2)], phase: 'base', note: 'Первые 500-метровки + сплит-контроль.' },
  { sessions: [row(20, '1000 м средне / 5 мин отдых ×2.', 1000, 300, 2, 0), row(15, '15 мин: 3 легко / 3 средне ×...', 180, 60, 3, 2)], phase: 'build', note: 'Дистанция вместо времени: чем усерднее — тем быстрее финиш.' },
  { sessions: [row(20, '30 гребков легко + 10 средне ×5.', 30, 20, 5, 0), row(15, 'Первые 2000 м средней интенсивности! Запишите время.', undefined, undefined, undefined, 2)], phase: 'build', note: 'Первый 2000 м! Сплит-ориентир: сумма 4×500м + 20 с, делить на 4.' },
  { sessions: [row(12, '1 мин высоко / 1 мин отдых ×6 — первые HIIT!', 60, 60, 6, 0), row(18, '2000 м средней интенсивности.', undefined, undefined, undefined, 2)], phase: 'build', note: 'Короткие высокие + закрепление 2000 м.' },
  { sessions: [row(15, '2 мин высоко / 1 мин ×5.', 120, 60, 5, 0), row(15, '1500 м средне-быстро.', undefined, undefined, undefined, 2)], phase: 'build', note: 'Скорость + выносливость.' },
  { sessions: [row(12, '1 мин высоко / 1 мин ×6.', 60, 60, 6, 0), row(15, 'ФИНАЛ: 2000 м на время! Сравните с нед.5.', undefined, undefined, undefined, 2)], phase: 'peak', taper: true, note: 'Финал: техника + темп + время.' },
];

export const CARDIO_ROW_BEGINNER_8: CardioCycleTemplate = {
  meta: {
    id: 'cardio-row-beginner-8',
    title: 'Гребля с нуля — 8 недель (British Rowing)',
    goal: 'health',
    goalFit: ['health', 'maintenance'],
    weeks: 8,
    sessionsPerWeek: 2,
    sessionsPerWeekMax: 3,
    level: ['beginner'],
    sport: 'row',
    period: 'base',
    equipment: ['rowing'],
    lowImpact: true,
    kind: 'explicit',
    description: 'Уверенные 2000 м за 8 недель: техника (damper ≤4) → дистанция → скорость → тест.',
    howItWorks: '2 сессии/нед + опциональный бег/ходьба; нед.5 — первый 2000 м; нед.8 — финал.',
    conditions: ['Доступ к гребному тренажёру', '2 д/нед'],
    tags: ['row', 'beginner', 'technique', 'low-impact'],
    sourceLabel: 'British Rowing Go Row Beginners Training Plan (8 недель)',
  },
  preset: { goal: 'health', totalWeeks: 8, daysAvailable: 2, level: 'beginner', equipment: ['rowing'], lowImpact: true },
  weeks: WB,
};
