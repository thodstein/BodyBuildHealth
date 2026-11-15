/**
 * coach-course.test.ts — план курса (фарма) как назначение тренера.
 *
 * Проверяем обещания, а не геттеры:
 *  • план не «подбирает» дозы: всё, что пришло, проверяется по техническим лимитам;
 *  • строки курса имеют детерминированные id с префиксом `coach_course_` — по ним
 *    идёт замена, и записи атлета не затираются;
 *  • «снять курс атлета → выдать другому» сохраняет препарат, дозу и недели;
 *  • битый план отклоняется с понятной причиной.
 */
import { describe, expect, it } from 'vitest';
import {
  COACH_COURSE_ID_PREFIX,
  COURSE_ITEMS_MAX,
  COURSE_PLAN_VERSION,
  courseItemLine,
  coursePlanErrorText,
  courseRowsFor,
  describeCoursePlan,
  emptyCoursePlan,
  makeCourseItem,
  normalizeCoursePlan,
  planFromCourseRows,
  type CoachCoursePlan,
} from '../coach-course.engine';

const plan = (patch: Partial<CoachCoursePlan> = {}): CoachCoursePlan => ({
  version: COURSE_PLAN_VERSION,
  startDate: '2026-11-20',
  note: '',
  items: [
    {
      substanceId: 'test_e',
      name: 'Тестостерон энантат',
      doseValue: 500,
      doseUnit: 'мг',
      frequency: 2,
      startWeek: 1,
      endWeek: 12,
    },
  ],
  ...patch,
});

describe('проверка плана', () => {
  it('пустой план — отдельная причина, а не «ok»', () => {
    expect(normalizeCoursePlan(null).error).toBe('not-object');
    expect(normalizeCoursePlan([]).error).toBe('not-object');
    expect(normalizeCoursePlan({ version: 2, items: [] }).error).toBe('version');
    expect(normalizeCoursePlan({ version: COURSE_PLAN_VERSION, items: [] }).error).toBe('empty');
  });

  it('препарат без дозы или названия отбрасывает весь план', () => {
    expect(
      normalizeCoursePlan({
        version: COURSE_PLAN_VERSION,
        startDate: '',
        items: [{ substanceId: 'test_e', name: 'Тестостерон', doseValue: 0, doseUnit: 'мг', frequency: 2, startWeek: 1, endWeek: 8 }],
      }).error,
    ).toBe('item');
  });

  it('больше лимита препаратов — отказ, а не «обрежем молча»', () => {
    const items = Array.from({ length: COURSE_ITEMS_MAX + 1 }, () => ({
      substanceId: 'test_e',
      name: 'Тестостерон',
      doseValue: 100,
      doseUnit: 'мг',
      frequency: 1,
      startWeek: 1,
      endWeek: 2,
    }));
    expect(normalizeCoursePlan({ version: COURSE_PLAN_VERSION, items }).error).toBe('limit');
  });

  it('недели и доза приводятся к разумному виду, а дата — только ISO', () => {
    const r = normalizeCoursePlan({
      version: COURSE_PLAN_VERSION,
      startDate: '20.11.2026',
      note: '  приём  ',
      items: [
        {
          substanceId: 'test_e',
          name: 'Тестостерон',
          doseValue: '500.004',
          doseUnit: 'мг',
          frequency: 2,
          startWeek: 8,
          endWeek: 2,
        },
      ],
    });
    expect(r.error).toBeNull();
    expect(r.plan?.startDate).toBe('');
    expect(r.plan?.note).toBe('приём');
    expect(r.plan?.items[0]).toMatchObject({ doseValue: 500, startWeek: 8, endWeek: 8 });
  });

  it('причины сформулированы для человека', () => {
    expect(coursePlanErrorText('empty')).toContain('ни одного препарата');
    expect(coursePlanErrorText('limit')).toContain(String(COURSE_ITEMS_MAX));
    expect(coursePlanErrorText(null)).toBe('');
  });

  it('пустой черновик берёт сегодняшнюю дату только если она ISO', () => {
    expect(emptyCoursePlan('2026-11-20').startDate).toBe('2026-11-20');
    expect(emptyCoursePlan('сегодня').startDate).toBe('');
  });
});

describe('строка препарата', () => {
  it('одна строка — препарат, доза, частота, недели', () => {
    expect(courseItemLine(plan().items[0])).toBe('Тестостерон энантат 500 мг · 2/нед · недели 1–12');
  });

  it('частота текстом и одна неделя не ломают формулировку', () => {
    expect(courseItemLine({ ...plan().items[0], frequency: 'каждый день', startWeek: 3, endWeek: 3 })).toBe(
      'Тестостерон энантат 500 мг · каждый день · неделя 3',
    );
  });

  it('сводка считает длительность включительно', () => {
    const summary = describeCoursePlan(plan());
    expect(summary.items).toBe(1);
    expect(summary.weeks).toBe(12);
    expect(summary.lines[0]).toContain('Тестостерон');
  });

  it('форма ввода проверяет то же, что и импорт', () => {
    expect(
      makeCourseItem({
        substanceId: 'test_e',
        name: 'Тестостерон',
        doseValue: 0,
        doseUnit: 'мг',
        frequency: 2,
        startWeek: 1,
        endWeek: 8,
      }),
    ).toBeNull();
    expect(
      makeCourseItem({
        substanceId: 'test_e',
        name: 'Тестостерон',
        doseValue: 250,
        doseUnit: 'мг',
        frequency: 2,
        startWeek: 1,
        endWeek: 8,
      }),
    ).toMatchObject({ doseValue: 250, startWeek: 1, endWeek: 8 });
  });
});

describe('строки курса для базы атлета', () => {
  it('id детерминированные и с префиксом тренера', () => {
    const rows = courseRowsFor(plan());
    expect(rows[0].id).toBe(`${COACH_COURSE_ID_PREFIX}1`);
    expect(rows[0].source).toBe('coach');
    expect(rows[0]).toMatchObject({
      substanceId: 'test_e',
      doseValue: 500,
      doseUnit: 'мг',
      startWeek: 1,
      endWeek: 12,
      startDate: '2026-11-20',
    });
  });

  it('препарат без id из каталога остаётся читаемым, а не пустым', () => {
    const rows = courseRowsFor(
      plan({ items: [{ ...plan().items[0], substanceId: '', name: 'Свой препарат' }] }),
    );
    expect(rows[0].substanceId).toBe('Свой препарат');
  });

  it('план из строк атлета сохраняет препараты и дату', () => {
    const rows = [
      { id: 'x1', substanceId: 'test_e', doseValue: 500, doseUnit: 'мг', frequency: 2, startWeek: 1, endWeek: 12, startDate: '2026-11-20' },
      { id: 'x2', substanceId: 'nandrolone', doseValue: 200, doseUnit: 'мг', frequency: 1, startWeek: 1, endWeek: 10 },
      { id: 'bad', substanceId: '', doseValue: 0 },
      null,
    ];
    const result = planFromCourseRows(rows);
    expect(result.startDate).toBe('2026-11-20');
    expect(result.items.map(i => i.substanceId)).toEqual(['test_e', 'nandrolone']);
  });

  it('пустые строки дают пустой план, а не выдуманный препарат', () => {
    expect(planFromCourseRows([]).items).toEqual([]);
    expect(planFromCourseRows([{}, null, 'строка']).items).toEqual([]);
  });

  it('круг «снял → выдал» сохраняет дозу и недели байт-в-байт', () => {
    const original = plan();
    const again = planFromCourseRows(courseRowsFor(original));
    expect(again.items[0]).toMatchObject({
      substanceId: 'test_e',
      doseValue: 500,
      doseUnit: 'мг',
      frequency: 2,
      startWeek: 1,
      endWeek: 12,
    });
    expect(again.startDate).toBe('2026-11-20');
  });
});
