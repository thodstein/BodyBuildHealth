/**
 * cardio-row-short.ts — короткие гребные циклы:
 * CARDIO_ROW_2K_4 (Concept2 2K 4-Week, сжатый) и
 * CARDIO_ROW_BEGINNER_8 (British Rowing Beginner 8 недель: техника →
 * дистанция → 2000 м; damper ≤4; fitness-boost бег/ходьба опционально).
 *
 * P0-аудит 2026-11: в `workSec` раньше передавались МЕТРЫ (500, 1000) —
 * структурный блок обещал 41 мин работы внутри 22-минутной сессии, а любая
 * сессия с `workSec` автоматически становилась HIIT (даже техника 10 мин).
 * Теперь: workSec всегда СЕКУНДЫ, тип сессии задаётся явно, длительность
 * сессии ≥ суммарного времени структуры.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';
import type { CardioType } from '../../engines/lms/cardio.engine';

const row = (
  d: number,
  p: string,
  workSec: number | undefined,
  restSec: number | undefined,
  reps: number | undefined,
  dow: number | undefined,
  type: CardioType,
): CardioTemplateSession => ({
  type,
  durationMin: d,
  equipment: 'rowing',
  purpose: p,
  dayOfWeek: dow,
  structured: workSec && restSec && reps ? [{ workSec, restSec, reps, target: 'pace', note: 'Сплит /500м по среднему темпу' }] : undefined,
});
const ez = (d: number, p: string, dow?: number): CardioTemplateSession => ({ type: 'zone2', durationMin: d, equipment: 'rowing', purpose: p, dayOfWeek: dow });
const rec = (d: number, p: string, dow?: number): CardioTemplateSession => ({ type: 'recovery', durationMin: d, equipment: 'rowing', purpose: p, dayOfWeek: dow });
const test = (d: number, p: string, dow?: number): CardioTemplateSession => ({ type: 'miss', durationMin: d, equipment: 'rowing', purpose: p, dayOfWeek: dow });

// ─── 2K 4 недели (сжатый Concept2) ───
const w4: CardioTemplateWeek[] = [
  { sessions: [test(20, 'ТЕСТ 2000 м.', 0), row(26, 'Интервалы 4×4 мин / 2 мин.', 240, 120, 4, 2, 'hiit'), row(24, 'Интервалы 6×2 мин / 1 мин.', 120, 60, 6, 4, 'hiit')], phase: 'base', note: 'Старт + тест.' },
  { sessions: [row(30, 'Интервалы 5×4 мин / 2 мин.', 240, 120, 5, 0, 'hiit'), row(34, 'Интервалы 3×6 мин / 3 мин.', 360, 180, 3, 2, 'miss'), row(28, 'Интервалы 8×2 мин / 1 мин.', 120, 60, 8, 4, 'hiit')], phase: 'build', note: 'Объём.' },
  { sessions: [row(32, 'Интервалы 6×3 мин / 2 мин.', 180, 120, 6, 0, 'miss'), row(34, 'Интервалы 4×5 мин / 3 мин.', 300, 180, 4, 2, 'miss'), row(26, 'Интервалы 12×1 мин / 1 мин.', 60, 60, 12, 4, 'hiit')], phase: 'build', note: 'Скорость.' },
  { sessions: [test(20, 'ТЕСТ 2000 м — финал!', 0), rec(20, 'Лёгкая гребля 20 мин.', 2), ez(25, 'Ровная 25 мин.', 4)], phase: 'peak', taper: true, note: 'Подводка + тест.' },
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
// Темп новичка ≈ 2:00/500м → 500 м = 120 с, 1000 м = 240 с.
// «30 гребков легко + 10 средне» ≈ 40 гребков ≈ 90 с работы.
const WB: CardioTemplateWeek[] = [
  { sessions: [row(10, '1 мин гребля низкой интенсивности / 1 мин отдых ×5. Damper ≤4, техника: драйв ногами → корпус → руки.', 60, 60, 5, 0, 'zone2'), row(17, '5 мин гребля / 3 мин отдых ×2.', 300, 180, 2, 2, 'zone2')], phase: 'base', note: 'Привыкание + техника (темп, последовательность, осанка).' },
  { sessions: [row(15, '2 мин гребля / 1 мин отдых ×5. Гребём плавно, мощный драйв — медленный возврат.', 120, 60, 5, 0, 'zone2'), row(24, '5 мин гребля / 3 мин лёгкой ×3.', 300, 180, 3, 2, 'zone2')], phase: 'base', note: 'Рост времени + техника.' },
  { sessions: [row(22, '500 м средней интенсивности / 2 мин отдых ×4. Записывайте время каждого.', 120, 120, 4, 0, 'miss'), row(15, '10 мин: 5 мин легко + 5 мин средне.', 300, 60, 2, 2, 'zone2')], phase: 'base', note: 'Первые 500-метровки + сплит-контроль.' },
  { sessions: [row(20, '1000 м средне / 5 мин отдых ×2.', 240, 300, 2, 0, 'miss'), row(15, '15 мин: 3 легко / 3 средне ×3.', 180, 60, 3, 2, 'zone2')], phase: 'build', note: 'Дистанция вместо времени: чем усерднее — тем быстрее финиш.' },
  { sessions: [row(20, '30 гребков легко + 10 средне ×5.', 90, 30, 5, 0, 'miss'), ez(15, 'Первые 2000 м средней интенсивности! Запишите время.', 2)], phase: 'build', note: 'Первый 2000 м! Сплит-ориентир: сумма 4×500м + 20 с, делить на 4.' },
  { sessions: [row(12, '1 мин высоко / 1 мин отдых ×6 — первые HIIT!', 60, 60, 6, 0, 'hiit'), ez(18, '2000 м средней интенсивности.', 2)], phase: 'build', note: 'Короткие высокие + закрепление 2000 м.' },
  { sessions: [row(15, '2 мин высоко / 1 мин ×5.', 120, 60, 5, 0, 'miss'), ez(15, '1500 м средне-быстро.', 2)], phase: 'build', note: 'Скорость + выносливость.' },
  { sessions: [row(12, '1 мин высоко / 1 мин ×6.', 60, 60, 6, 0, 'hiit'), ez(15, 'ФИНАЛ: 2000 м на время! Сравните с нед.5.', 2)], phase: 'peak', taper: true, note: 'Финал: техника + темп + время.' },
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
