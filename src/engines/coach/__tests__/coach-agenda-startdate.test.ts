/**
 * coach-agenda-startdate.test.ts — планёр берёт день плана по ЯКОРЮ (`startDate`).
 *
 * До этого планёр, виджет и плеер считали «какой день плана на дату» каждый
 * по-своему: планёр — позицией дня недели в графике (при 5-дневном плане и
 * трёх тренировках дни 4–5 не показывались никогда), плеер — всегда первым днём.
 * Теперь правило одно (`engines/training-day.engine`), а якорь пишут продюсеры
 * `he_pl_runtime`.
 */
import { describe, expect, it } from 'vitest';
import { collectAgenda } from '../coach-agenda.engine';

const MON = '2026-11-02'; // понедельник

function mem(pairs: Record<string, unknown> = {}) {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(pairs)) {
    if (v === undefined) continue;
    map.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    raw: map,
  };
}

/** График профиля: Пн/Ср/Пт. */
const PROFILE = {
  settings: {
    training: {
      daysPerWeek: 3,
      schedule: {
        enabled: true,
        scheduleType: 'weekly',
        weeklyDays: [true, false, true, false, true, false, false],
        startTime: '18:00',
      },
    },
  },
};

/** Пять дней плана: у каждого свой ярлык, чтобы видеть выбранный индекс. */
const PLAN_DAYS = [1, 2, 3, 4, 5].map((n) => ({
  label: `План ${n}`,
  exercises: [{ targetSets: [1, 2, 3] }],
}));

const trainingRows = (storage: ReturnType<typeof mem>) =>
  collectAgenda(storage, { from: MON, to: '2026-11-13', today: MON })
    .filter((ev) => ev.source === 'training')
    .map((ev) => `${ev.date} ${ev.title.includes('План') ? ev.title.slice(ev.title.indexOf('План')) : ev.title}`);

describe('планёр: день плана по якорю startDate', () => {
  it('5-дневный план при 3 тренировках в неделю проходит дни 1…5 (раньше 4–5 были недостижимы)', () => {
    const rows = trainingRows(
      mem({
        he_profile_v2: PROFILE,
        he_pl_runtime: { focus: 'Фулбоди', days: PLAN_DAYS, startDate: MON },
      }),
    );
    expect(rows).toEqual([
      '2026-11-02 План 1',
      '2026-11-04 План 2',
      '2026-11-06 План 3',
      '2026-11-09 План 4',
      '2026-11-11 План 5',
      // Шестой тренировочный день — план пошёл по кругу.
      '2026-11-13 План 1',
    ]);
  });

  it('без startDate поведение прежнее: индекс по позиции дня недели', () => {
    const rows = trainingRows(
      mem({
        he_profile_v2: PROFILE,
        he_pl_runtime: { focus: 'Фулбоди', days: PLAN_DAYS },
      }),
    );
    expect(rows).toEqual([
      '2026-11-02 План 1',
      '2026-11-04 План 2',
      '2026-11-06 План 3',
      '2026-11-09 План 1',
      '2026-11-11 План 2',
      '2026-11-13 План 3',
    ]);
  });

  it('pattern «2 через 1» с якорем не ставит тренировку в день отдыха цикла', () => {
    const storage = mem({
      he_profile_v2: {
        settings: {
          training: {
            daysPerWeek: 4,
            schedule: { enabled: true, scheduleType: 'pattern', pattern: { work: 2, off: 1 }, startTime: '18:00' },
          },
        },
      },
      he_pl_runtime: { focus: 'Фулбоди', days: PLAN_DAYS, startDate: MON },
    });
    const dates = collectAgenda(storage, { from: MON, to: '2026-11-08', today: MON })
      .filter((ev) => ev.source === 'training')
      .map((ev) => ev.date);
    // Пн/Вт работа, Ср отдых, Чт/Пт работа, Сб отдых, Вс работа.
    expect(dates).toEqual(['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06', '2026-11-08']);
  });
});
