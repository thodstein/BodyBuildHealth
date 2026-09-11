/**
 * cardio-pro-higdon-half1-12.ts — ГОТОВЫЙ ЦИКЛ: Hal Higdon Novice 1
 * Half Marathon, 12 недель (4 бега + кросс).
 * Дословно по таблице источника (мили): Пн отдых; Вт/Чт 3→5 миль легко;
 * Ср 2→3 мили или кросс; Пт отдых; Сб кросс 30→60 мин; Вс long 4→10 миль;
 * нед.6 — 5K Race, нед.9 — 10K Race, нед.12 — Half Marathon.
 * Условие источника: умеете бежать 3 мили 3-4×/нед. Темп — разговорный
 * (65-75% HRmax). Минуты — производные от миль (легко 10:00/милю),
 * мили каноничны и лежат в purpose.
 */
import type { CardioCycleTemplate, CardioTemplateSession, CardioTemplateWeek } from './cardio-cycle-types';

const MI = (mi: number): number => Math.round(mi * 10);
const run = (mi: number, purpose: string, dow?: number): CardioTemplateSession => ({
  type: 'zone2', durationMin: MI(mi), equipment: 'running', purpose: `${mi} мили легко, разговорный темп. ${purpose}`, dayOfWeek: dow,
});
const cross = (min: number, dow?: number): CardioTemplateSession => ({
  type: 'recovery', durationMin: min, equipment: 'cycling', purpose: `Кросс ${min} мин легко (вело/плавание/ходьба).`, dayOfWeek: dow,
});

/** [вт, ср, чт, сб-кросс, вс-long] в милях; race вместо long. */
const PLAN: Array<[number, number, number, number, number, string?]> = [
  [3, 2, 3, 30, 4], [3, 2, 3, 30, 4], [3.5, 2, 3.5, 40, 5], [3.5, 2, 3.5, 40, 5],
  [4, 2, 4, 40, 6], [4, 2, 4, 0, 0], [4.5, 3, 4.5, 50, 7], [4.5, 3, 4.5, 50, 8],
  [5, 3, 5, 0, 0], [5, 3, 5, 60, 9], [5, 3, 5, 60, 10], [4, 3, 2, 0, 0],
];
const RACE: Record<number, string> = { 6: 'Старт 5K вместо long!', 9: 'Старт 10K вместо long!', 12: 'СТАРТ: полумарафон 13.1 мили!' };

function buildWeek(w: number): CardioTemplateWeek {
  const [tu, we, th, crossMin, long] = PLAN[w - 1];
  const race = RACE[w];
  const sessions: CardioTemplateSession[] = [
    run(tu, '', 1),
    we > 0 ? run(we, 'или кросс.', 2) : cross(20, 2),
    run(th, '', 3),
  ];
  if (crossMin > 0) sessions.push(cross(crossMin, 5));
  if (race) {
    sessions.push({ type: 'hiit', durationMin: w === 12 ? 130 : w === 9 ? 60 : 30, equipment: 'running', purpose: race, dayOfWeek: 6 });
  } else {
    sessions.push(run(long, 'Long: каждую неделю +1 миля, отдых до и после.', 6));
  }
  const phase = w === 12 ? 'peak' : w >= 10 ? 'taper' : w <= 3 ? 'base' : 'build';
  return {
    sessions, phase,
    taper: w >= 10 || undefined,
    note: race ?? (w === 11 ? 'Пик long 10 миль.' : undefined),
  };
}

const weeks: CardioTemplateWeek[] = Array.from({ length: 12 }, (_, i) => buildWeek(i + 1));

export const CARDIO_PRO_HIGDON_HALF1_12: CardioCycleTemplate = {
  meta: {
    id: 'cardio-pro-higdon-half1-12',
    title: 'Хигдон Half Novice 1 — 12 недель (первый полумарафон)',
    goal: 'health',
    goalFit: ['health', 'maintenance'],
    weeks: 12,
    sessionsPerWeek: 4,
    sessionsPerWeekMax: 5,
    level: ['beginner'],
    sport: 'run',
    period: 'build',
    equipment: ['running', 'cycling'],
    lowImpact: false,
    kind: 'explicit',
    description: 'Первый полумарафон за 12 недель: 4 лёгких бега + кросс, long 4→10 миль, старты 5K/10K.',
    howItWorks: 'Вт/Чт 3→5 миль, Ср легко/кросс, Сб кросс, Вс long; нед.6 — 5K, нед.9 — 10K, нед.12 — старт.',
    conditions: ['Бегаете 3 мили 3-4×/нед', '4 д/нед + кросс'],
    tags: ['run', 'half-marathon', 'beginner', 'higdon', 'pro'],
    taperWeeks: [10, 11, 12],
    sourceLabel: 'Hal Higdon Novice 1 Half Marathon (таблица 12 недель, мили)',
  },
  preset: { goal: 'health', totalWeeks: 12, daysAvailable: 5, level: 'beginner', equipment: ['running', 'cycling'], periodizationModel: 'linear' },
  weeks,
};
