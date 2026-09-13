/** session-widgets-pack: 9 виджетов — проведение + таймеры + календарь. */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { WorkoutMiniPult, WorkoutDayCard, WorkoutBigMode, WorkoutWidgetsPanel } from '../WorkoutSessionWidgets';
import { RestTimerPill, IntervalTimer, SessionClock, formatTimer, WorkoutTimersPanel } from '../WorkoutTimersPanel';
import { buildDayStatus, buildWeekMatrix, buildMonthCells, ScheduleDayStrip, ScheduleWeekMatrix, ScheduleMonthHeat, MedScheduleCalendarPanel } from '../MedScheduleCalendar';

const DEMO = { dayLabel: 'День 1 · Грудь', exercises: [{ name: 'Жим', done: 2, total: 4, weight: 80 }, { name: 'Разводка', done: 0, total: 3 }] };

describe('A проведение (3)', () => {
  it('A1 пульт: прогресс + кнопки 44px+', () => {
    const html = renderToStaticMarkup(<WorkoutMiniPult state={DEMO} />);
    expect(html).toContain('data-widget="workout-pult"');
    expect(html).toContain('progressbar');
    expect(html).toContain('+ Сет');
  });
  it('A2 карточка дня: упражнения + старт/пропуск', () => {
    const html = renderToStaticMarkup(<WorkoutDayCard state={DEMO} />);
    expect(html).toContain('data-widget="workout-daycard"');
    expect(html).toContain('Жим');
    expect(html).toContain('Начать');
  });
  it('A3 BIG: готово + навигация', () => {
    const html = renderToStaticMarkup(<WorkoutBigMode state={DEMO} />);
    expect(html).toContain('data-widget="workout-big"');
    expect(html).toContain('ГОТОВО');
  });
  it('панель: 3 таба', () => {
    const html = renderToStaticMarkup(<WorkoutWidgetsPanel state={DEMO} />);
    expect(html).toContain('data-tab="pult"');
    expect(html).toContain('data-tab="big"');
  });
});

describe('B таймеры (3)', () => {
  it('formatTimer 90 -> 01:30', () => expect(formatTimer(90)).toBe('01:30'));
  it('B1 отдых: пресеты + старт', () => {
    const html = renderToStaticMarkup(<RestTimerPill />);
    expect(html).toContain('data-timer="rest"');
    expect(html).toContain('data-sec="90"');
  });
  it('B2 интервалы: раунд + фазы', () => {
    const html = renderToStaticMarkup(<IntervalTimer />);
    expect(html).toContain('data-timer="interval"');
    expect(html).toContain('Раунд');
  });
  it('B3 сессия: часы + цель', () => {
    const html = renderToStaticMarkup(<SessionClock />);
    expect(html).toContain('data-timer="session"');
  });
  it('панель таймеров: 3 таба', () => {
    const html = renderToStaticMarkup(<WorkoutTimersPanel />);
    expect(html).toContain('data-tab="rest"');
    expect(html).toContain('data-tab="session"');
  });
});

describe('C календарь (3)', () => {
  const db = {
    shots: [{ date: '2026-09-13' }],
    supps: [{ date: '2026-09-13' }, { date: '2026-09-13' }],
    workouts: [{ date: '2026-09-13' }],
    cardio: [],
  };
  it('buildDayStatus считает 4 трека', () => {
    const s = buildDayStatus('2026-09-13', db);
    expect(s.shots).toBe(1);
    expect(s.supps).toBe(2);
    expect(s.workouts).toBe(1);
  });
  it('buildWeekMatrix 7 дат x 3 ряда', () => {
    const m = buildWeekMatrix('2026-09-07', db);
    expect(m.dates).toHaveLength(7);
    expect(m.rows).toHaveLength(3);
    expect(m.rows[0].cells.filter(Boolean).length).toBe(1);
  });
  it('buildMonthCells уровень 0..3', () => {
    const cells = buildMonthCells(2026, 8, db);
    expect(cells.length).toBeGreaterThan(27);
    const hit = cells.find(c => c.date === '2026-09-13');
    expect(hit?.level).toBe(3);
  });
  it('АПК §118: хуки виджетов покрыты native-CSS', async () => {
    const fs = await import('node:fs');
    const css = fs.readFileSync('src/styles-native.css', 'utf-8');
    for (const hook of ['data-widget="workout-pult"', 'data-timer="rest"', 'data-cal="weekmatrix"', 'data-cal="monthheat"', 'prefers-reduced-motion', 'max-width: 380px']) {
      expect(css).toContain(hook);
    }
  });
  it('док: 3 раздела + саб-табы зала + липкий низ', async () => {
    const { SessionWidgetsDock } = await import('../SessionWidgetsDock');
    const html = renderToStaticMarkup(<SessionWidgetsDock />);
    expect(html).toContain('data-widget="session-dock"');
    expect(html).toContain('data-dock="train"');
    expect(html).toContain('data-dock="timers"');
    expect(html).toContain('data-dock="sched"');
    expect(html).toContain('data-sub="big"');
    const fs = await import('node:fs');
    const css = fs.readFileSync('src/styles-native.css', 'utf-8');
    expect(css).toContain('data-widget="session-dock"');
  });
  it('встройка: ExecutionZone runtime несет док (lock против silent-drop)', async () => {
    const { render } = await import('@testing-library/react');
    const { ExecutionZone } = await import('../ExecutionZone');
    const noop = () => {};
    const Wrapper: React.FC = () => {
      const [d, setD] = React.useState(0);
      const [e, setE] = React.useState(0);
      const [l, setL] = React.useState<Record<string, any>>({});
      const [s, setS] = React.useState(false);
      const [o, setO] = React.useState(false);
      const [w, setW] = React.useState(0);
      const [r, setR] = React.useState(0);
      const [rp, setRp] = React.useState(0);
      const [ri, setRi] = React.useState(0);
      return (
        <ExecutionZone tab="runtime" goal="" level="" recovery={0} trainingOutput={null} macrocycle={null}
          selectedWeek={1} currentMicrocycle={null} runtimeDay={d} setRuntimeDay={setD}
          runtimeExIdx={e} setRuntimeExIdx={setE} runtimeLogs={l} setRuntimeLogs={setL}
          runtimeStarted={s} setRuntimeStarted={setS} plRuntime={null} plRunOpen={o} setPlRunOpen={setO}
          runtimeSetW={w} setRuntimeSetW={setW} runtimeSetR={r} setRuntimeSetR={setR}
          runtimeSetRP={rp} setRuntimeSetRP={setRp} runtimeSetRI={ri} setRuntimeSetRI={setRi}
          diary={{} as any} onRefresh={noop} />
      );
    };
    const { container, unmount } = render(<Wrapper />);
    expect(container.querySelector('[data-widget="session-dock"]')).not.toBeNull();
    unmount();
  });
  it('все три календаря рендерятся + панель', () => {
    expect(renderToStaticMarkup(<ScheduleDayStrip />)).toContain('data-cal="daystrip"');
    expect(renderToStaticMarkup(<ScheduleWeekMatrix />)).toContain('data-cal="weekmatrix"');
    expect(renderToStaticMarkup(<ScheduleMonthHeat />)).toContain('data-cal="monthheat"');
    expect(renderToStaticMarkup(<MedScheduleCalendarPanel />)).toContain('data-tab="month"');
  });
});
