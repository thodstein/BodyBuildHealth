/**
 * cardio-pro-higdon-mar1-18.ts — ГОТОВЫЙ ЦИКЛ: Hal Higdon Novice 1
 * Marathon, 18 недель (первый марафон, >1 млн финишёров).
 * Дословно по таблице источника (мили): Пн/Пт отдых; Вт/Чт 3→5 миль легко;
 * Ср 3→10 миль (sorta-long); Сб long 6→20 миль с откатами каждую 3-ю неделю;
 * Вс кросс; нед.8 — Half Marathon вместо long; нед.16-18 — taper 12/8/марафон.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const MI = (mi: number): number => Math.round(mi * 10);
const run = (mi: number, dow: number, extra = ''): CardioTemplateSession => ({
  type: 'zone2', durationMin: MI(mi), equipment: 'running',
  purpose: `${mi} мили легко, разговорный темп.${extra ? ' ' + extra : ''}`, dayOfWeek: dow,
});
const cross = (dow: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: 45, equipment: 'cycling', purpose: 'Кросс 45 мин (вело/плавание/ходьба).', dayOfWeek: dow,
});

/** [вт, ср, чт, сб-long/race] в милях. */
const PLAN: Array<[number, number, number, number | string]> = [
  [3, 3, 3, 6], [3, 3, 3, 7], [3, 4, 3, 5], [3, 4, 3, 9],
  [3, 5, 3, 10], [3, 5, 3, 7], [3, 6, 3, 12], [3, 6, 3, 'HM'],
  [3, 7, 4, 10], [3, 7, 4, 15], [4, 8, 4, 16], [4, 8, 5, 12],
  [4, 9, 5, 18], [5, 9, 5, 14], [5, 10, 5, 20], [5, 8, 4, 12],
  [4, 6, 3, 8], [3, 4, 2, 'M'],
];

function buildWeek(w: number): CardioTemplateWeek {
  const [tu, we, th, sat] = PLAN[w - 1];
  const sessions: CardioTemplateSession[] = [run(tu, 1), run(we, 2, w >= 9 ? 'Sorta-long.' : ''), run(th, 3)];
  if (sat === 'M') {
    sessions.push({ type: 'hiit', durationMin: 260, equipment: 'running', purpose: 'СТАРТ: марафон 26.2 мили! Первые мили — сдержанно.', dayOfWeek: 5 });
  } else if (sat === 'HM') {
    sessions.push({ type: 'hiit', durationMin: 130, equipment: 'running', purpose: 'Старт Half Marathon вместо long — прикидка темпа марафона.', dayOfWeek: 5 });
  } else {
    sessions.push(run(sat as number, 5, 'Long: не пропускать; каждые 3 нед — откат.'));
  }
  sessions.push(cross(6));
  const phase = sat === 'M' ? 'peak' : w >= 16 ? 'taper' : w <= 4 ? 'base' : 'build';
  const stepback = [3, 6, 12, 14].includes(w);
  return {
    sessions, phase, deload: stepback || undefined, taper: w >= 16 || undefined,
    note: sat === 'M' ? 'День марафона!' : sat === 'HM' ? 'Прикидка-половинка.' : w === 15 ? 'Пик long 20 миль.' : stepback ? 'Откатная неделя.' : undefined,
  };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 18 }, (_, i) => buildWeek(i + 1));

export const CARDIO_PRO_HIGDON_MAR1_18: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-higdon-mar1-18',
    title: 'Хигдон Marathon Novice 1 — 18 недель (первый марафон)',
    goal: 'health',
    goalFit: ['health', 'maintenance'],
    weeks: 18,
    sessionsPerWeek: 4,
    sessionsPerWeekMax: 5,
    level: ['beginner'],
    sport: 'run',
    period: 'build',
    equipment: ['running', 'cycling'],
    lowImpact: false,
    kind: 'explicit',
    description: 'Первый марафон: только объёмы без скорости, long 6→20 миль, половинка на 8-й неделе.',
    howItWorks: 'Вт/Чт легко, Ср sorta-long 3→10, Сб long с откатами, Вс кросс; нед.8 — HM; нед.16-18 — taper.',
    conditions: ['Бегаете год+, стартовали 5K–half', '4 д/нед + кросс'],
    tags: ['run', 'marathon', 'beginner', 'higdon', 'pro'],
    deloadWeeks: [3, 6, 12, 14],
    taperWeeks: [16, 17, 18],
    sourceLabel: 'Hal Higdon Novice 1 Marathon (таблица 18 недель, мили)',
  },
  preset: { goal: 'health', totalWeeks: 18, daysAvailable: 5, level: 'beginner', equipment: ['running', 'cycling'], periodizationModel: 'linear' },
  weeks,
};
