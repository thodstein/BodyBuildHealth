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
    // Без живой сессии «+ Сет» писать некуда — кнопка становится стартом.
    expect(html).not.toContain('+ Сет');
    expect(html).toContain('data-act="pult-start"');
  });
  it('A1b старт виджета не мёртвый: шлёт he-workout-open', async () => {
    const { render, fireEvent } = await import('@testing-library/react');
    const { requestOpenSession } = await import('../WorkoutSessionWidgets');
    let got = 0;
    const h = () => { got += 1; };
    window.addEventListener('he-workout-open', h);
    requestOpenSession();
    expect(got).toBe(1);
    const { container, unmount } = render(<WorkoutDayCard state={DEMO} />);
    fireEvent.click(container.querySelector('[data-act="day-start"]') as HTMLElement);
    expect(got).toBe(2);
    window.removeEventListener('he-workout-open', h);
    unmount();
  });
  it('A1c state-проп и авто-состояние не ломают порядок хуков', async () => {
    const { render, cleanup } = await import('@testing-library/react');
    const { container, rerender, unmount } = render(<WorkoutMiniPult />);
    rerender(<WorkoutMiniPult state={DEMO} />);
    rerender(<WorkoutMiniPult />);
    expect(container.querySelector('[data-widget="workout-pult"]')).not.toBeNull();
    unmount();
    cleanup();
  });
  it('A1d «+ Сет» без открытого плеера открывает проведение (кнопка не мёртвая)', async () => {
    const { render, fireEvent } = await import('@testing-library/react');
    const LIVE = {
      dayLabel: 'Жим',
      exercises: [{ name: 'Жим', done: 2, total: 4, weight: 80 }],
      live: {
        sessionId: 's1', focus: 'Грудь', date: '2026-09-13', setsDone: 2, setsPlanned: 4,
        volumeKg: 1200, currentExercise: 'Жим', progressPct: 50,
      },
    };
    let opened = 0;
    const onOpen = () => { opened += 1; };
    window.addEventListener('he-workout-open', onOpen);
    const { container, unmount } = render(<WorkoutMiniPult state={LIVE as never} />);
    fireEvent.click(container.querySelector('[data-act="pult-next"]') as HTMLElement);
    // Плеера нет → quick-set никто не подхватил → пульт ведёт в проведение,
    // иначе подход молча терялся (жалоба «кнопки не работают»).
    expect(opened).toBe(1);
    window.removeEventListener('he-workout-open', onOpen);
    unmount();
  });
  it('A1e живой плеер обрабатывает quick-set — пульт не уводит со экрана', async () => {
    const { render, fireEvent } = await import('@testing-library/react');
    const { requestQuickSet } = await import('../WorkoutSessionWidgets');
    const LIVE = {
      dayLabel: 'Жим',
      exercises: [{ name: 'Жим', done: 2, total: 4, weight: 80 }],
      live: {
        sessionId: 's1', focus: 'Грудь', date: '2026-09-13', setsDone: 2, setsPlanned: 4,
        volumeKg: 1200, currentExercise: 'Жим', progressPct: 50,
      },
    };
    // Эмулируем SessionPlayer: обработчик подтверждает, что подход записан.
    const player = (ev: Event) => { (ev as CustomEvent).detail?.handled?.(); };
    window.addEventListener('he-workout-quick-set', player);
    expect(requestQuickSet()).toBe(true);
    let opened = 0;
    const onOpen = () => { opened += 1; };
    window.addEventListener('he-workout-open', onOpen);
    const { container, unmount } = render(<WorkoutMiniPult state={LIVE as never} />);
    fireEvent.click(container.querySelector('[data-act="pult-next"]') as HTMLElement);
    expect(opened).toBe(0);
    window.removeEventListener('he-workout-quick-set', player);
    window.removeEventListener('he-workout-open', onOpen);
    unmount();
  });
  it('A1f карточка дня не прячет упражнения молча: «+ ещё N»', async () => {
    const { render } = await import('@testing-library/react');
    const BIG = {
      dayLabel: 'День ног',
      exercises: [
        { name: 'Присед', done: 0, total: 4 },
        { name: 'Жим ногами', done: 0, total: 3 },
        { name: 'Румынская', done: 0, total: 3 },
        { name: 'Сгибания', done: 0, total: 3 },
        { name: 'Икры', done: 0, total: 4 },
        { name: 'Планка', done: 0, total: 2 },
      ],
    };
    const { container, unmount } = render(<WorkoutDayCard state={BIG as never} />);
    expect(container.querySelectorAll('[data-ex]').length).toBe(4);
    const more = container.querySelector('[data-daycard-more]') as HTMLElement;
    expect(more).not.toBeNull();
    expect(more.textContent).toContain('+ ещё 2 упражнения');
    unmount();
  });
  it('A1g BIG-режим не показывает «Нет упражнений» при смене дня', async () => {
    const { render, fireEvent } = await import('@testing-library/react');
    const LONG = {
      dayLabel: 'День 1',
      exercises: [
        { name: 'Жим', done: 1, total: 4 },
        { name: 'Разводка', done: 0, total: 3 },
        { name: 'Трицепс', done: 0, total: 3 },
      ],
    };
    const SHORT = { dayLabel: 'День 2', exercises: [{ name: 'Присед', done: 0, total: 5 }] };
    const { container, rerender, unmount } = render(<WorkoutBigMode state={LONG as never} />);
    const next = () => fireEvent.click(container.querySelector('[data-act="big-next"]') as HTMLElement);
    next();
    next();
    // Стоим на третьем упражнении, день сменился на одно упражнение.
    rerender(<WorkoutBigMode state={SHORT as never} />);
    expect(container.textContent).toContain('Присед');
    expect(container.textContent).not.toContain('Нет упражнений');
    expect(container.textContent).toContain('1 из 1');
    unmount();
  });
  it('A2 карточка дня: упражнения + старт/пропуск', () => {
    const html = renderToStaticMarkup(<WorkoutDayCard state={DEMO} />);
    expect(html).toContain('data-widget="workout-daycard"');
    expect(html).toContain('Жим');
    expect(html).toContain('Начать');
  });
  it('A2b нет мёртвых кнопок: «Пропуск» только с обработчиком, BIG без onFinish ведёт в плеер', () => {
    const day = renderToStaticMarkup(<WorkoutDayCard state={DEMO} />);
    expect(day).not.toContain('data-act="day-skip"');
    expect(renderToStaticMarkup(<WorkoutDayCard state={DEMO} onSkip={() => {}} />)).toContain('data-act="day-skip"');
    const big = renderToStaticMarkup(<WorkoutBigMode state={DEMO} />);
    expect(big).not.toContain('data-act="big-finish"');
    expect(big).toContain('data-act="big-open"');
    expect(renderToStaticMarkup(<WorkoutBigMode state={DEMO} onFinish={() => {}} />)).toContain('data-act="big-finish"');
  });
  it('A3 BIG: без живой сессии — старт, с сессией — ГОТОВО', () => {
    const idle = renderToStaticMarkup(<WorkoutBigMode state={DEMO} />);
    expect(idle).toContain('data-widget="workout-big"');
    expect(idle).toContain('data-act="big-start"');
    expect(idle).not.toContain('data-act="big-done"');
    const withDone = renderToStaticMarkup(<WorkoutBigMode state={DEMO} onDoneSet={() => {}} />);
    expect(withDone).toContain('data-act="big-done"');
    expect(withDone).toContain('ГОТОВО');
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
    // «Карточка дня» и BIG-режим жили в доке без обработчиков: «Начать»,
    // «ГОТОВО» и «Завершить» молчали. Теперь в зале одна рабочая кнопка.
    expect(html).not.toContain('data-sub="big"');
    expect(html).not.toContain('data-sub="day"');
    const fs = await import('node:fs');
    const css = fs.readFileSync('src/styles-native.css', 'utf-8');
    expect(css).toContain('data-widget="session-dock"');
  });
  it('док: развёрнутый зал действительно начинает проведение', async () => {
    const { render, fireEvent } = await import('@testing-library/react');
    const { SessionWidgetsDock } = await import('../SessionWidgetsDock');
    localStorage.clear();
    let opened = 0;
    const { container, unmount } = render(<SessionWidgetsDock onOpen={() => { opened += 1; }} />);
    fireEvent.click(container.querySelector('[data-act="dock-toggle"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-act="pult-start"]') as HTMLElement);
    expect(opened).toBe(1);
    unmount();
  });
  it('док: выбор раздела сам раскрывает док (не нужно жать ▴)', async () => {
    const { render, fireEvent, cleanup } = await import('@testing-library/react');
    const { SessionWidgetsDock } = await import('../SessionWidgetsDock');
    const { container, unmount } = render(<SessionWidgetsDock />);
    expect(container.querySelector('[data-dock-body]')).toBeNull();
    fireEvent.click(container.querySelector('[data-dock="timers"]') as HTMLElement);
    expect(container.querySelector('[data-dock-body="timers"]')).not.toBeNull();
    fireEvent.click(container.querySelector('[data-dock="train"]') as HTMLElement);
    expect(container.querySelector('[data-dock-body="train"]')).not.toBeNull();
    unmount();
    cleanup();
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
    // Док не должен стоять над главным действием: «Начать тренировку» — первым.
    const chooser = container.querySelector('[data-session="chooser"]') as HTMLElement;
    const dock = container.querySelector('[data-widget="session-dock"]') as HTMLElement;
    expect(chooser).not.toBeNull();
    expect(chooser.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();
  });
  it('все три календаря рендерятся + панель', () => {
    expect(renderToStaticMarkup(<ScheduleDayStrip />)).toContain('data-cal="daystrip"');
    expect(renderToStaticMarkup(<ScheduleWeekMatrix />)).toContain('data-cal="weekmatrix"');
    expect(renderToStaticMarkup(<ScheduleMonthHeat />)).toContain('data-cal="monthheat"');
    expect(renderToStaticMarkup(<MedScheduleCalendarPanel />)).toContain('data-tab="month"');
  });
});
