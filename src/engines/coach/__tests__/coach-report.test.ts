import { describe, expect, it } from 'vitest';
import {
  buildCoachReport,
  buildCoachReportHtml,
  buildCoachReportText,
  readReportSessions,
  type ReportSession,
} from '../coach-report.engine';

const PERIOD = { from: '2026-11-02', to: '2026-11-08', label: 'неделя 02.11–08.11' };

const session = (date: string, sets: Array<[string, number, number]>): ReportSession => ({
  date,
  tonnage: sets.reduce((sum, [, w, r]) => sum + w * r, 0),
  sets: sets.map(([exercise, weight, reps]) => ({ exercise, weight, reps })),
});

const base = {
  athlete: { name: 'Иван', direction: 'ПЛ', goal: 'Присед 200', group: 'Вечерняя', startedAt: '2026-09-01' },
  period: PERIOD,
  weights: [
    { date: '2026-10-30', kg: 83 },
    { date: '2026-11-02', kg: 82.5 },
    { date: '2026-11-08', kg: 82 },
  ],
};

describe('отчёт: арифметика', () => {
  it('считает только период, тоннаж по подходам', () => {
    const r = buildCoachReport({
      ...base,
      sessions: [
        session('2026-10-30', [['присед', 100, 5]]),
        session('2026-11-02', [['присед', 100, 5], ['жим', 80, 5]]),
        session('2026-11-04', [['присед', 110, 3]]),
      ],
    });
    expect(r.sessions).toBe(2);
    expect(r.trainingDays).toBe(2);
    expect(r.tonnage).toBe(500 + 400 + 330);
    const squat = r.exercises.find(e => e.exercise === 'присед')!;
    expect(squat.tonnage).toBe(500 + 330);
    expect(squat.sets).toBe(2);
    expect(squat.best).toEqual({ exercise: 'присед', weight: 110, reps: 3 });
  });

  it('максимум по записям: только если он достигнут в периоде, и с оговоркой', () => {
    const r = buildCoachReport({
      ...base,
      sessions: [
        session('2026-10-30', [['присед', 130, 1]]), // вне периода — максимум
        session('2026-11-04', [['присед', 110, 3]]),
      ],
    });
    expect(r.personalBests).toEqual([]);
    const text = buildCoachReportText(r);
    expect(text).not.toContain('настоящий ПМ');

    const withPr = buildCoachReport({
      ...base,
      sessions: [
        session('2026-10-30', [['присед', 100, 5]]),
        session('2026-11-04', [['присед', 120, 3]]),
      ],
    });
    expect(withPr.personalBests[0]).toMatchObject({ exercise: 'присед', weight: 120, date: '2026-11-04', inPeriod: true });
    expect(buildCoachReportText(withPr)).toContain('а не «настоящий ПМ»');
  });

  it('вес: первое и последнее взвешивание периода и изменение', () => {
    const r = buildCoachReport({ ...base, sessions: [] });
    expect(r.weight.first).toEqual({ date: '2026-11-02', kg: 82.5 });
    expect(r.weight.last).toEqual({ date: '2026-11-08', kg: 82 });
    expect(r.weight.changeKg).toBe(-0.5);
    expect(r.weight.count).toBe(2);
  });

  it('одно взвешивание — изменения нет (null), а не ноль', () => {
    const r = buildCoachReport({
      ...base,
      weights: [{ date: '2026-11-02', kg: 82.5 }],
      sessions: [],
    });
    expect(r.weight.changeKg).toBeNull();
    expect(r.weight.count).toBe(1);
  });

  it('пустой период: честный текст без нулей-обещаний', () => {
    const r = buildCoachReport({ ...base, sessions: [] });
    expect(r.sessions).toBe(0);
    expect(r.exercises).toEqual([]);
    const text = buildCoachReportText(r);
    expect(text).toContain('Тренировок в дневнике за период нет');
    expect(text).toContain('Вес');
  });

  it('заметки и журнал фильтруются периодом', () => {
    const r = buildCoachReport({
      ...base,
      sessions: [],
      notes: [
        { createdAt: '2026-11-03T10:00:00.000Z', title: 'Сон', body: '6 ч' },
        { createdAt: '2026-10-20T10:00:00.000Z', title: 'Старое', body: 'вне периода' },
      ],
      coachLog: [
        {
          id: 'l1',
          athleteId: 'a1',
          date: '2026-11-03',
          kind: 'lift',
          exercise: 'присед',
          sets: 3,
          reps: 5,
          weightKg: 100,
          rpe: 8,
          note: '',
          createdAt: '2026-11-03T10:00:00.000Z',
          updatedAt: '2026-11-03T10:00:00.000Z',
        },
        {
          id: 'l2',
          athleteId: 'a1',
          date: '2026-10-01',
          kind: 'lift',
          exercise: 'жим',
          sets: 3,
          reps: 5,
          weightKg: 80,
          rpe: 8,
          note: '',
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
        },
      ],
    });
    expect(r.notes).toHaveLength(1);
    expect(r.coachLogCount).toBe(1);
  });
});

describe('отчёт: безопасность и читаемость', () => {
  it('HTML экранирует имя и заметки (нет исполняемого тега)', () => {
    const r = buildCoachReport({
      ...base,
      athlete: { ...base.athlete, name: '<script>alert(1)</script>' },
      sessions: [],
      notes: [{ createdAt: '2026-11-03T10:00:00.000Z', title: '<b>x</b>', body: '<img src=x onerror=alert(1)>' }],
    });
    const html = buildCoachReportHtml(r);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
  });

  it('числа в тексте — с запятой, как принято в интерфейсе', () => {
    const r = buildCoachReport({
      ...base,
      sessions: [session('2026-11-03', [['присед', 102.5, 3]])],
    });
    expect(buildCoachReportText(r)).toContain('102,5');
  });
});

describe('разбор дневника', () => {
  it('training_log: имя упражнения из exerciseName, тоннаж по подходам', () => {
    const sessions = readReportSessions({
      training_log: [
        { id: '1', date: '2026-11-03', exerciseName: 'Присед', sets: [{ weight: 100, reps: 5 }] },
        { id: '2', date: '2026-11-03', exerciseName: 'Жим', sets: [{ weight: 80, reps: 5 }, { weight: 85, reps: 3 }] },
      ],
    });
    expect(sessions).toHaveLength(2);
    expect(sessions[0].sets[0]).toEqual({ exercise: 'Присед', weight: 100, reps: 5 });
    expect(sessions[1].tonnage).toBe(400 + 255);
  });

  it('workout_log читается, только если training_log пуст', () => {
    const sessions = readReportSessions({
      workout_log: [
        {
          date: '2026-11-02',
          exercises: [{ name: 'Тяга', sets: [{ weight: 150, reps: 3 }] }],
        },
      ],
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sets[0]).toEqual({ exercise: 'Тяга', weight: 150, reps: 3 });
  });

  it('мусор и будущее не ломают разбор', () => {
    expect(readReportSessions({ training_log: [null, 'x', { date: 'nope' }] })).toEqual([]);
  });
});
