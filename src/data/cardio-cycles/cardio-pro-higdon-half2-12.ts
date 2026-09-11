/**
 * cardio-pro-higdon-half2-12.ts — ГОТОВЫЙ ЦИКЛ: Hal Higdon Novice 2
 * Half Marathon, 12 недель (опытным новичкам).
 * Дословно по PDF-таблице источника (мили): Вт/Чт 3→5 миль легко;
 * Ср 3→5 миль (чётные недели — в темпе гонки «pace»); Сб long 4→12 миль;
 * Вс кросс 60 мин; нед.6 — 5K Race, нед.9 — 10K Race, нед.12 — старт.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const MI = (mi: number): number => Math.round(mi * 10);
const run = (mi: number, pace: boolean, dow: number): CardioTemplateSession => ({
  type: pace ? 'miss' : 'zone2', durationMin: MI(mi), equipment: 'running',
  purpose: `${mi} мили ${pace ? 'в темпе гонки (pace)' : 'легко, разговорный темп'}.`, dayOfWeek: dow,
});
const cross = (dow: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: 60, equipment: 'cycling', purpose: 'Кросс 60 мин легко.', dayOfWeek: dow,
});

/** [вт, ср, ср-pace?, чт, сб-long/race] в милях. */
const PLAN: Array<[number, number, boolean, number, number | string]> = [
  [3, 3, false, 3, 4], [3, 3, true, 3, 5], [3, 4, false, 3, 6], [3, 4, true, 3, 7],
  [3, 4, false, 3, 8], [3, 4, true, 3, '5K'], [3, 5, false, 3, 9], [3, 5, true, 3, 10],
  [3, 5, false, 3, '10K'], [3, 5, true, 3, 11], [3, 5, false, 3, 12], [3, 2, true, 2, 'HM'],
];

function buildWeek(w: number): CardioTemplateWeek {
  const [tu, we, pace, th, sat] = PLAN[w - 1];
  const sessions: CardioTemplateSession[] = [run(tu, false, 1), run(we, pace, 2), run(th, false, 3)];
  if (typeof sat === 'number') {
    sessions.push(run(sat, false, 5));
  } else {
    const min = sat === 'HM' ? 135 : sat === '10K' ? 60 : 30;
    sessions.push({ type: 'hiit', durationMin: min, equipment: 'running', purpose: sat === 'HM' ? 'СТАРТ: полумарафон 13.1 мили!' : `Старт ${sat} вместо long!`, dayOfWeek: 5 });
  }
  sessions.push(cross(6));
  const phase = sat === 'HM' ? 'peak' : w >= 10 ? 'taper' : w <= 3 ? 'base' : 'build';
  return { sessions, phase, taper: w >= 10 || undefined, note: sat === 'HM' ? 'День старта!' : w === 11 ? 'Пик long 12 миль.' : undefined };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 12 }, (_, i) => buildWeek(i + 1));

export const CARDIO_PRO_HIGDON_HALF2_12: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-higdon-half2-12',
    title: 'Хигдон Half Novice 2 — 12 недель (с темповыми средами)',
    goal: 'health',
    goalFit: ['health', 'maintenance'],
    weeks: 12,
    sessionsPerWeek: 5,
    level: ['beginner', 'intermediate'],
    sport: 'run',
    period: 'build',
    equipment: ['running', 'cycling'],
    lowImpact: false,
    kind: 'explicit',
    description: 'Половинка для бегавших: среды в темпе гонки по чётным неделям, long 4→12 миль.',
    howItWorks: 'Вт/Чт легко, Ср легко/pace чередование, Сб long, Вс кросс; нед.6 — 5K, нед.9 — 10K.',
    conditions: ['Бегали полумарафон/марафон или уверенные 5×/нед', '5 д/нед'],
    tags: ['run', 'half-marathon', 'higdon', 'pace', 'pro'],
    taperWeeks: [10, 11, 12],
    sourceLabel: 'Hal Higdon Novice 2 Half Marathon Printable PDF (таблица 12 недель, мили)',
  },
  preset: { goal: 'health', totalWeeks: 12, daysAvailable: 6, level: 'intermediate', equipment: ['running', 'cycling'], periodizationModel: 'linear' },
  weeks,
};
