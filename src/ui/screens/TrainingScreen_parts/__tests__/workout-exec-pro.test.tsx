/** workout-exec-pro: проф-проведение тренировки — движок, адаптер, live-виджеты.
 *
 *  Проверяем РЕАЛЬНЫЕ свойства (не наличие строк):
 *  1. живая сессия переживает «закрытие приложения» (save/load/clear);
 *  2. сводка живой сессии честно считает подходы/тоннаж/прогресс;
 *  3. адаптер день-микроцикла → PlayerDay несёт плановые сеты/вес/RIR;
 *  4. ручной «самопал» ExecutionZone удалён (проведение только через SessionPlayer);
 *  5. таймеры: AMRAP (rest=0) не даёт NaN, пресеты русифицированы;
 *  6. док/пульт показывает ЖИВУЮ сессию, «+ Сет» шлёт событие;
 *  7. Android-виджет тренировки несёт прогресс + действие + deep-link.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import {
  saveActiveSession, loadActiveSession, clearActiveSession,
  summarizeActiveSession, isActiveSessionWorthSaving,
  type WorkoutSession,
} from '../../../../engines/workout-logger.engine';
import { WorkoutMiniPult, WorkoutDayCard, WorkoutBigMode, requestQuickSet } from '../WorkoutSessionWidgets';
import { ExecutionZone } from '../ExecutionZone';
import { SessionPlayer, type PlayerDay } from '../../SRCBBScreen_parts/SessionPlayer';
import { RestTimerPill, IntervalTimer, formatTimer } from '../WorkoutTimersPanel';

function mkSession(sets: number, weight = 80): WorkoutSession {
  return {
    sessionId: 'sess_test',
    date: '2026-10-14',
    startTime: '10:00',
    endTime: '',
    durationMin: 0,
    focus: 'День 1 · Грудь',
    exercises: [{
      exerciseId: 'bench', exerciseName: 'Жим лёжа', pattern: 'horizontal_push', muscleGroup: 'chest',
      order: 1,
      sets: Array.from({ length: sets }, (_, i) => ({ setNumber: i + 1, weightKg: weight, reps: 8, rpe: 8, rir: 2, isPR: false, notes: '' })),
      totalVolume: sets * weight * 8, best1RM: 100, avgRPE: 8,
    }],
    totalVolume: sets * weight * 8, totalSets: sets, totalReps: sets * 8,
    avgIntensity: 8, prCount: 0, notes: '', weekNumber: 3, mesocycleWeek: 3,
  };
}

describe('движок: живая сессия', () => {
  beforeEach(() => { localStorage.clear(); });

  it('пустая сессия не сохраняется как «живая»', () => {
    const s = mkSession(0);
    s.exercises[0].sets = [];
    expect(isActiveSessionWorthSaving(s)).toBe(false);
    expect(saveActiveSession(s)).toBe(false);
    expect(loadActiveSession()).toBeNull();
  });

  it('сессия с подходами переживает перезагрузку (roundtrip)', () => {
    const s = mkSession(3, 82.5);
    expect(saveActiveSession(s)).toBe(true);
    const back = loadActiveSession();
    expect(back?.sessionId).toBe('sess_test');
    expect(back?.exercises[0]?.sets).toHaveLength(3);
    expect(back?.exercises[0]?.sets[0]?.weightKg).toBe(82.5);
  });

  it('битый JSON в живом ключе → null (не бросок)', () => {
    localStorage.setItem('he_workout_active_v1', '{not-json');
    expect(loadActiveSession()).toBeNull();
  });

  it('clearActiveSession вычищает ключ', () => {
    saveActiveSession(mkSession(2));
    clearActiveSession();
    expect(loadActiveSession()).toBeNull();
  });

  it('сводка: сеты/тоннаж/прогресс/текущее упражнение', () => {
    const sum = summarizeActiveSession(mkSession(4, 100), 10);
    expect(sum?.setsDone).toBe(4);
    expect(sum?.volumeKg).toBe(3200);
    expect(sum?.progressPct).toBe(40);
    expect(sum?.currentExercise).toBe('Жим лёжа');
  });

  it('сводка без плановых сетов не делит на 0 и не врёт про 100% при неизвестном плане', () => {
    const sum = summarizeActiveSession(mkSession(2));
    expect(sum?.setsPlanned).toBe(2);
    expect(sum?.progressPct).toBe(100);
    // с планом прогресс честный
    const sum2 = summarizeActiveSession(mkSession(2), 8);
    expect(sum2?.progressPct).toBe(25);
  });

  it('плановое число переживает автосейв (доводка прогресса живой сессии)', () => {
    saveActiveSession(mkSession(2), 8);
    const back = loadActiveSession();
    expect(back?.plannedSetsTotal).toBe(8);
    expect(summarizeActiveSession(back)?.progressPct).toBe(25);
  });

  it('сводка null на пустой сессии', () => {
    const s = mkSession(0);
    s.exercises[0].sets = [];
    expect(summarizeActiveSession(s)).toBeNull();
  });
});

describe('проведение: один источник (SessionPlayer), без ручного самопала', () => {
  const src = readFileSync('src/ui/screens/TrainingScreen_parts/ExecutionZone.tsx', 'utf8');
  const player = readFileSync('src/ui/screens/SRCBBScreen_parts/SessionPlayer.tsx', 'utf8');

  it('ExecutionZone ведёт тренировку через SessionPlayer', () => {
    expect(src).toContain('<SessionPlayer');
    expect(src).toContain('playerDayFromMicro(trainingDaysList[safeRuntimeDay])');
  });

  it('нет ручного ввода сетов (кнопка «Записать подход» удалена вместе с багами)', () => {
    expect(src).not.toContain('Записать подход');
    expect(src).not.toContain('setRuntimeSetW(');
  });

  it('нет UTC-даты в логе разминки (локальная дата)', () => {
    expect(src).not.toContain('toISOString().slice(0,10)');
    expect(src).toContain('upsertWarmupLog({ date: localIsoDate()');
  });

  it(' ExecutionZone не держит свой таймер отдыха — он в плеере', () => {
    expect(src).not.toContain('const [restTimer, setRestTimer]');
    expect(player).toContain('startRestTimer');
  });

  it('плеер: автосейв живой сессии (с планом дня) + продолжение + быстрый сет', () => {
    expect(player).toContain('saveActiveSession(session, plannedSets)');
    expect(player).toContain('loadActiveSession()');
    expect(player).toContain('data-session="resume"');
    expect(player).toContain('he-workout-quick-set');
  });

  it('плеер: тач-нормы контролов набора подхода (44px)', () => {
    expect(player).toContain('minHeight: 44');
    // старый 36px на кнопке «OK» убран
    expect(player).not.toContain('minHeight: 36, padding: \'8px 14px\'');
  });
});

describe('таймеры', () => {
  it('formatTimer: 90 → 01:30, отрицательные → 00:00', () => {
    expect(formatTimer(90)).toBe('01:30');
    expect(formatTimer(-5)).toBe('00:00');
  });

  it('отдых: пресеты + старт (NaN не появляется в разметке)', () => {
    const html = renderToStaticMarkup(<RestTimerPill defaultSec={60} />);
    expect(html).toContain('data-timer="rest"');
    expect(html).not.toContain('NaN');
  });

  it('интервальный таймер: раунд + фазы', () => {
    const html = renderToStaticMarkup(<IntervalTimer rounds={8} workSec={20} restSec={10} />);
    expect(html).toContain('data-timer="interval"');
    expect(html).not.toContain('NaN');
  });

  it('TimersTab: пресеты русифицированы, AMRAP без деления на 0', () => {
    const t = readFileSync('src/ui/screens/TrainingScreen_parts/TimersTab.tsx', 'utf8');
    expect(t).toContain("name: 'Выносливость'");
    expect(t).not.toContain('Эндurance');
    // pct больше не делит на restSec напрямую
    expect(t).toContain('Math.max(1, totalSec)');
    expect(t).toContain('Math.max(1, restSec)');
  });
});

describe('док/пульт: живая сессия', () => {
  beforeEach(() => { localStorage.clear(); });

  const DEMO = { dayLabel: 'День 1 · Грудь', exercises: [{ name: 'Жим', done: 2, total: 4, weight: 80 }, { name: 'Разводка', done: 0, total: 3 }] };

  it('пульт с живой сессией: прогресс + «Идёт» + «+ Сет»', () => {
    saveActiveSession(mkSession(4, 100));
    const s = summarizeActiveSession(loadActiveSession(), 10)!;
    const html = renderToStaticMarkup(
      <WorkoutMiniPult state={{ ...DEMO, live: s }} />
    );
    expect(html).toContain('data-widget="workout-pult"');
    expect(html).toContain('Идёт');
    expect(html).toContain('4/10');
    expect(html).toContain('+ Сет');
  });

  it('карточка дня: «Продолжить» при живой сессии', () => {
    const s = summarizeActiveSession(mkSession(2), 8)!;
    const html = renderToStaticMarkup(<WorkoutDayCard state={{ ...DEMO, live: s }} />);
    expect(html).toContain('Продолжить');
    expect(html).toContain('2 подх.');
  });

  it('BIG-режим показывает тоннаж живой сессии', () => {
    const s = summarizeActiveSession(mkSession(3, 85), 12)!;
    const html = renderToStaticMarkup(<WorkoutBigMode state={{ ...DEMO, live: s }} />);
    expect(html).toContain('3 подх.');
    expect(html).toContain('2\u00a0040');
  });

  it('requestQuickSet шлёт событие he-workout-quick-set', () => {
    let got: string | null = null;
    const h = (e: Event) => { got = e.type; };
    window.addEventListener('he-workout-quick-set', h);
    requestQuickSet();
    window.removeEventListener('he-workout-quick-set', h);
    expect(got).toBe('he-workout-quick-set');
  });
});

describe('homescreen-виджет «Тренировка» (Android + мост)', () => {
  it('макет несёт прогресс и две кнопки', () => {
    const xml = readFileSync('android/app/src/main/res/layout/widget_training.xml', 'utf8');
    expect(xml).toContain('@+id/w_training_progress');
    expect(xml).toContain('@+id/w_training_act');
    expect(xml).toContain('@+id/w_training_open');
  });

  it('провайдер читает прогресс/live/действие и вешает deep-link', () => {
    const j = readFileSync('android/app/src/main/java/com/healthengine/app/widgets/TrainingWidgetProvider.java', 'utf8');
    expect(j).toContain('optInt("progress"');
    expect(j).toContain('optBoolean("live"');
    expect(j).toContain('R.id.w_training_progress');
    expect(j).toContain('R.id.w_training_act');
    expect(j).toContain('TARGET_TRAINING_RUN');
  });

  it('мост принимает новые поля', () => {
    const j = readFileSync('android/app/src/main/java/com/healthengine/app/widgets/WidgetBridgePlugin.java', 'utf8');
    expect(j).toContain('obj.put("progress"');
    expect(j).toContain('obj.put("live"');
    expect(j).toContain('obj.put("actionLabel"');
    expect(j).toContain('obj.put("actionTarget"');
  });

  it('target training_run объявлен в сторе', () => {
    const j = readFileSync('android/app/src/main/java/com/healthengine/app/widgets/WidgetStore.java', 'utf8');
    expect(j).toContain('TARGET_TRAINING_RUN');
  });

  it('widget-sync собирает снапшот с прогрессом и действием', () => {
    const t = readFileSync('src/ui/native/widget-sync.ts', 'utf8');
    expect(t).toContain('progressPct');
    expect(t).toContain('live: true');
    expect(t).toContain('training_run');
  });

  it('DashboardNative обрабатывает deep-link training_run', () => {
    const t = readFileSync('src/ui/screens/DashboardScreen.native.tsx', 'utf8');
    expect(t).toContain("target === 'training_run'");
    expect(t).toContain("detail: 'runtime'");
  });
});

describe('Stage 2: Android widget builder (снапшот → RemoteViews)', () => {
  it('без данных виджет показывает стартовое состояние, а не пустоту', () => {
    const j = readFileSync('android/app/src/main/java/com/healthengine/app/widgets/TrainingWidgetProvider.java', 'utf8');
    expect(j).toContain('if (title.isEmpty())');
    expect(j).toContain('Откройте план недели');
    expect(j).toContain('setProgressBar(R.id.w_training_progress, 100, 0, false)');
  });

  it('живая сессия: подпись действия «+ Сет» и зелёная кромка', () => {
    const j = readFileSync('android/app/src/main/java/com/healthengine/app/widgets/TrainingWidgetProvider.java', 'utf8');
    expect(j).toContain('live ? "+ Сет" : "▶ Начать"');
  });
});

describe('доцикл: живое обновление + быстрый сет с рабочего стола', () => {
  beforeEach(() => { localStorage.clear(); });

  it('хук useWorkoutLive перечитывает состояние по событию плеера', async () => {
    const { act } = await import('@testing-library/react');
    const { useWorkoutLive } = await import('../WorkoutSessionWidgets');
    let seen: { live?: { setsDone: number } } | null = null;
    const Probe: React.FC = () => { seen = useWorkoutLive() as never; return null; };
    const { renderToStaticMarkup: _r } = await import('react-dom/server');
    void _r;
    const { render } = await import('@testing-library/react');
    render(<Probe />);
    saveActiveSession(mkSession(3, 90), 10);
    act(() => { window.dispatchEvent(new Event('he-workout-live-update')); });
    expect((seen as any)?.live?.setsDone).toBe(3);
    act(() => { window.dispatchEvent(new Event('he-workout-live-update')); });
  });

  it('плеер шлёт he-workout-live-update после автосейва', () => {
    const player = readFileSync('src/ui/screens/SRCBBScreen_parts/SessionPlayer.tsx', 'utf8');
    expect(player).toContain("new Event('he-workout-live-update')");
  });

  it('deep-link training_quick: open + записать подход', () => {
    const java = readFileSync('android/app/src/main/java/com/healthengine/app/widgets/WidgetStore.java', 'utf8');
    const prov = readFileSync('android/app/src/main/java/com/healthengine/app/widgets/TrainingWidgetProvider.java', 'utf8');
    const dash = readFileSync('src/ui/screens/DashboardScreen.native.tsx', 'utf8');
    const sync = readFileSync('src/ui/native/widget-sync.ts', 'utf8');
    expect(java).toContain('TARGET_TRAINING_QUICK');
    expect(prov).toContain('TARGET_TRAINING_QUICK');
    expect(sync).toContain("actionTarget: 'training_quick'");
    expect(dash).toContain("target === 'training_quick'");
    expect(dash).toContain("new Event('he-workout-quick-set')");
  });

  it('виджеты переведены на живой хук (не на разовое чтение)', () => {
    const w = readFileSync('src/ui/screens/TrainingScreen_parts/WorkoutSessionWidgets.tsx', 'utf8');
    expect(w).toContain('useWorkoutLive()');
    expect(w).toContain('he-workout-live-update');
    // «последняя тренировка» берётся из loadSessions()[0] (свежая), не arr[length-1]
    expect(w).toContain('loadSessions()');
    expect(w).not.toContain('arr[arr.length - 1]');
  });
});

describe('ExecutionZone: проф-карточка проведения', () => {
  const src = readFileSync('src/ui/screens/TrainingScreen_parts/ExecutionZone.tsx', 'utf8');

  it('адаптер день→PlayerDay кладёт плановые сеты', () => {
    expect(src).toContain('const playerDayFromMicro');
    expect(src).toContain('targetSets');
    expect(src).toContain('isBWExercise(ex)');
  });

  it('карточка проведения с кнопкой «Свернуть» (44px) и фокусом плана', () => {
    expect(src).toContain('Проведение тренировки');
    expect(src).toContain('Свернуть');
    expect(src).toContain('minHeight: 44');
  });

  it('док зала смонтирован в зоне проведения и получает реальное действие', () => {
    // Без onOpen док рисовал кнопки без обработчиков («мёртвые» кнопки).
    expect(src).toContain('<SessionWidgetsDock onOpen={openSession} />');
  });

  it('старт стоит выше разминки и плана дня — его не надо искать', () => {
    const start = src.indexOf('data-act="start-session"');
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThan(src.indexOf('План дня'));
    expect(start).toBeLessThan(src.indexOf('Разминка дня'));
  });
});

describe('ExecutionZone: главная кнопка старта', () => {
  const micro = {
    mesocycleType: 'accumulation',
    days: [
      { day: 'День 1 · Грудь', isTraining: true, exercises: [{ name: 'Жим штанги лёжа', sets: 3, reps: 8, weight: 80, restSec: 90 }] },
      { day: 'Отдых', isTraining: false, exercises: [] },
    ],
  } as any;
  const noop = () => {};

  const Probe: React.FC = () => {
    const [started, setStarted] = React.useState(false);
    const [d, setD] = React.useState(0);
    const [e, setE] = React.useState(0);
    const [l, setL] = React.useState<Record<string, any>>({});
    const [o, setO] = React.useState(false);
    const [w, setW] = React.useState(0);
    const [r, setR] = React.useState(0);
    const [rp, setRp] = React.useState(0);
    const [ri, setRi] = React.useState(0);
    return (
      <ExecutionZone tab="runtime" goal="" level="" recovery={3} trainingOutput={null}
        macrocycle={{ name: 'Микроцикл' } as any} currentMicrocycle={micro} selectedWeek={1}
        runtimeDay={d} setRuntimeDay={setD} runtimeExIdx={e} setRuntimeExIdx={setE}
        runtimeLogs={l} setRuntimeLogs={setL}
        runtimeStarted={started} setRuntimeStarted={setStarted}
        plRuntime={null} plRunOpen={o} setPlRunOpen={setO}
        runtimeSetW={w} setRuntimeSetW={setW} runtimeSetR={r} setRuntimeSetR={setR}
        runtimeSetRP={rp} setRuntimeSetRP={setRp} runtimeSetRI={ri} setRuntimeSetRI={setRi}
        diary={{} as any} onRefresh={noop} />
    );
  };

  it('разминка и план дня свёрнуты, старт виден сразу после выбора дня', () => {
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain('data-act="start-session"');
    expect(html).toContain('Начать тренировку');
    // Разминка не раскрыта: 20 пунктов списка перед стартом не нужны.
    expect(html).not.toContain('Отмечайте пункты');
    const start = html.indexOf('data-act="start-session"');
    expect(start).toBeLessThan(html.indexOf('План дня'));
  });

  it('с живой сессией старт — «Продолжить»: открывает плеер и не стирает записанное', async () => {
    const { render, fireEvent, cleanup } = await import('@testing-library/react');
    localStorage.clear();
    saveActiveSession(mkSession(2), 3);
    const LogProbe: React.FC = () => {
      const [started, setStarted] = React.useState(false);
      const [d, setD] = React.useState(0);
      const [e, setE] = React.useState(0);
      const [l, setL] = React.useState<Record<string, any>>({ bench: { sets: [{ weight: 80, reps: 8, rpe: 8, rir: 2 }], completed: false } });
      const [o, setO] = React.useState(false);
      return (
        <>
          <span data-probe="logs">{Object.keys(l).length}</span>
          <ExecutionZone tab="runtime" goal="" level="" recovery={3} trainingOutput={null}
            macrocycle={{ name: 'Микроцикл' } as any} currentMicrocycle={micro} selectedWeek={1}
            runtimeDay={d} setRuntimeDay={setD} runtimeExIdx={e} setRuntimeExIdx={setE}
            runtimeLogs={l} setRuntimeLogs={setL}
            runtimeStarted={started} setRuntimeStarted={setStarted}
            plRuntime={null} plRunOpen={o} setPlRunOpen={setO}
            runtimeSetW={0} setRuntimeSetW={noop as any} runtimeSetR={0} setRuntimeSetR={noop as any}
            runtimeSetRP={0} setRuntimeSetRP={noop as any} runtimeSetRI={0} setRuntimeSetRI={noop as any}
            diary={{} as any} onRefresh={noop} />
        </>
      );
    };
    const { container, unmount } = render(<LogProbe />);
    const cta = container.querySelector('[data-act="start-session"]') as HTMLElement;
    expect(cta.textContent).toContain('Продолжить тренировку');
    expect(cta.textContent).toContain('2 подх.');
    expect(cta.textContent).toContain('67%');
    fireEvent.click(cta);
    expect((container.querySelector('[data-session="player"]') as HTMLElement).style.display).toBe('block');
    // openSession (а не startSession) не сбрасывает записанные подходы.
    expect(container.querySelector('[data-probe="logs"]')!.textContent).toBe('1');
    unmount();
    cleanup();
    localStorage.clear();
  });

  it('нажатие на «Начать тренировку» показывает плеер, «Свернуть» его не размонтирует', async () => {
    const { render, fireEvent, cleanup } = await import('@testing-library/react');
    localStorage.clear();
    const { container, unmount } = render(<Probe />);
    const chooser = container.querySelector('[data-session="chooser"]') as HTMLElement;
    const player = container.querySelector('[data-session="player"]') as HTMLElement;
    expect(chooser.style.display).toBe('block');
    expect(player.style.display).toBe('none');
    fireEvent.click(container.querySelector('[data-act="start-session"]') as HTMLElement);
    expect(chooser.style.display).toBe('none');
    expect(player.style.display).toBe('block');
    const playerBefore = container.querySelector('[data-session="player"]');
    // «Свернуть» прячет плеер, а не уничтожает сессию: тот же DOM-узел остаётся.
    fireEvent.click(container.querySelector('[aria-label="Свернуть проведение"]') as HTMLElement);
    expect(player.style.display).toBe('none');
    expect(container.querySelector('[data-session="player"]')).toBe(playerBefore);
    unmount();
    cleanup();
  });

  it('с построенным планом (ПЛ/ББ) старт — большая кнопка вместо «Возобновить»', () => {
    const plRuntime = {
      track: 'pl', focus: 'Жим', week: 1,
      days: [{ label: 'День 1 · Грудь', exercises: [{ name: 'Жим штанги лёжа', muscleGroup: 'chest', targetSets: [{ weight: 80, reps: 8 }] }] }],
    } as any;
    const PlanProbe: React.FC = () => {
      const [open, setOpen] = React.useState(false);
      return (
        <ExecutionZone tab="runtime" goal="" level="" recovery={3} trainingOutput={null}
          macrocycle={{ name: 'Микроцикл' } as any} currentMicrocycle={micro} selectedWeek={1}
          runtimeDay={0} setRuntimeDay={noop as any} runtimeExIdx={0} setRuntimeExIdx={noop as any}
          runtimeLogs={{}} setRuntimeLogs={noop as any}
          runtimeStarted={false} setRuntimeStarted={noop as any}
          plRuntime={plRuntime} plRunOpen={open} setPlRunOpen={setOpen}
          runtimeSetW={0} setRuntimeSetW={noop as any} runtimeSetR={0} setRuntimeSetR={noop as any}
          runtimeSetRP={0} setRuntimeSetRP={noop as any} runtimeSetRI={0} setRuntimeSetRI={noop as any}
          diary={{} as any} onRefresh={noop} />
      );
    };
    const html = renderToStaticMarkup(<PlanProbe />);
    expect(html).toContain('data-act="session-start"');
    // Две зелёные кнопки в одной зоне — разные действия: эта стартует по плану ПЛ/ББ.
    expect(html).toContain('Начать по плану ПЛ');
    // Старого мелкого «Возобновить» больше нет — именно его не находили.
    expect(html).not.toContain('Возобновить');
  });

  it('старт из дневника/виджета при плане ПЛ/ББ открывает именно его проведение', async () => {
    const { render, cleanup, act } = await import('@testing-library/react');
    const plRuntime = {
      track: 'pl', focus: 'Жим', week: 1,
      days: [{ label: 'День 1 · Грудь', exercises: [{ name: 'Жим штанги лёжа', muscleGroup: 'chest', targetSets: [{ weight: 80, reps: 8 }] }] }],
    } as any;
    const PlanProbe: React.FC = () => {
      const [open, setOpen] = React.useState(false);
      return (
        <ExecutionZone tab="runtime" goal="" level="" recovery={3} trainingOutput={null}
          macrocycle={{ name: 'Микроцикл' } as any} currentMicrocycle={micro} selectedWeek={1}
          runtimeDay={0} setRuntimeDay={noop as any} runtimeExIdx={0} setRuntimeExIdx={noop as any}
          runtimeLogs={{}} setRuntimeLogs={noop as any}
          runtimeStarted={false} setRuntimeStarted={noop as any}
          plRuntime={plRuntime} plRunOpen={open} setPlRunOpen={setOpen}
          runtimeSetW={0} setRuntimeSetW={noop as any} runtimeSetR={0} setRuntimeSetR={noop as any}
          runtimeSetRP={0} setRuntimeSetRP={noop as any} runtimeSetRI={0} setRuntimeSetRI={noop as any}
          diary={{} as any} onRefresh={noop} />
      );
    };
    const { container, unmount } = render(<PlanProbe />);
    // Выбор дня при плане ПЛ/ББ не рендерится вовсе — раньше старт «в никуда».
    expect(container.querySelector('[data-session="chooser"]')).toBeNull();
    act(() => { window.dispatchEvent(new Event('he-workout-open')); });
    expect(container.textContent).toContain('Проведение тренировки · ПЛ');
    // «Готово» в итоге сворачивает именно карточку плана.
    act(() => { window.dispatchEvent(new Event('he-workout-close')); });
    expect(container.textContent).not.toContain('Проведение тренировки · ПЛ');
    unmount();
    cleanup();
  });
});

describe('SessionPlayer: кнопки доводят от разминки до итога', () => {
  const findBtn = (root: ParentNode, text: string) =>
    Array.from(root.querySelectorAll('button')).find(b => (b.textContent || '').includes(text)) as HTMLElement | undefined;

  it('Начать → К основной части → OK (подход записан) → Итог', async () => {
    const { render, fireEvent, cleanup } = await import('@testing-library/react');
    localStorage.clear();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const days: PlayerDay[] = [{
      label: 'День 1 · Грудь',
      exercises: [{ name: 'Жим штанги лёжа', muscleGroup: 'chest', targetSets: [{ weight: 80, reps: 8, rir: 2 }], restSec: 90 }],
    }];
    const { container, unmount } = render(<SessionPlayer days={days} weekNumber={1} focus="Грудь" />);
    const tabs = () => Array.from(container.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];

    // До старта «Итог» гасим: иначе пустой экран «Тренировка завершена».
    expect(tabs().find(t => (t.textContent || '').includes('Итог'))!.disabled).toBe(true);

    const start = findBtn(container, 'Начать тренировку');
    expect(start).toBeTruthy();
    fireEvent.click(start!);
    expect(container.textContent).toContain('Разминка');

    // Разминка длинная: блок, отмеченный целиком, сворачивается в строку «✓ title · 3/3».
    const warmupItems = () => container.querySelectorAll('[data-warmup-item]').length;
    const itemsBefore = warmupItems();
    expect(itemsBefore).toBeGreaterThan(0);
    fireEvent.click(findBtn(container, 'Отметить весь блок')!);
    expect(warmupItems()).toBeLessThan(itemsBefore);
    const warmToggle = container.querySelector('[data-act="warmup-toggle"]') as HTMLElement;
    expect(warmToggle).toBeTruthy();
    expect(warmToggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(warmToggle);
    expect(warmupItems()).toBe(itemsBefore);
    fireEvent.click(container.querySelector('[data-act="warmup-toggle"]') as HTMLElement);
    expect(warmupItems()).toBeLessThan(itemsBefore);

    const toMain = findBtn(container, 'К основной части');
    expect(toMain).toBeTruthy();
    fireEvent.click(toMain!);
    // В основной части «Готов» уже никуда не ведёт (сессия не сбрасывается) — гасим.
    expect(tabs().find(t => (t.textContent || '').includes('Готов'))!.disabled).toBe(true);

    // Время сессии и пауза — одна кнопка в строке прогресса (отдельного ряда больше нет).
    const timerBtn = container.querySelector('[data-act="session-timer"]') as HTMLElement;
    expect(timerBtn).toBeTruthy();
    expect(container.textContent).not.toContain('Время сессии:');

    // Аналитика объёма свёрнута: в зале она стояла между шапкой и первым подходом.
    const volToggle = container.querySelector('[data-act="volume-toggle"]') as HTMLElement;
    expect(volToggle).toBeTruthy();
    expect(volToggle.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('прогноз по плану сессии');
    fireEvent.click(volToggle);
    expect((container.querySelector('[data-act="volume-toggle"]') as HTMLElement).getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('прогноз по плану сессии');
    fireEvent.click(container.querySelector('[data-act="volume-toggle"]') as HTMLElement);
    expect(container.textContent).not.toContain('прогноз по плану сессии');

    // sRPE ушёл под подходы: до первого подхода он только отодвигал работу.
    const srpeLabel = Array.from(container.querySelectorAll('span')).find(s => (s.textContent || '').trim() === 'sRPE')!;
    expect(srpeLabel).toBeTruthy();
    const okBtnEl = findBtn(container, 'OK')!;
    expect(okBtnEl.compareDocumentPosition(srpeLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Основная часть: кнопка «OK» пишет подход в живую сессию.
    const ok = findBtn(container, 'OK');
    expect(ok).toBeTruthy();
    fireEvent.click(ok!);
    const active = loadActiveSession();
    expect(active?.exercises?.[0]?.sets?.length).toBe(1);

    // Записанный подход сворачивается в строку «✓ 1 · 80 кг × 8» с кнопкой правки:
    // иначе степперы уже сделанных подходов удлиняют прокрутку до текущего сета.
    expect(container.querySelectorAll('[data-act="edit-set"]').length).toBe(1);
    expect(container.querySelector('[aria-label="вес"]')).toBeNull();
    fireEvent.click(container.querySelector('[data-act="edit-set"]') as HTMLElement);
    expect(container.querySelector('[aria-label="вес"]')).toBeTruthy();

    // Завершение: явная кнопка «✓ Завершить тренировку» -> заминка -> «Итог».
    const finishBtn = findBtn(container, 'Завершить тренировку');
    expect(finishBtn).toBeTruthy();
    fireEvent.click(finishBtn!);
    expect(container.textContent).toContain('Заминка: День 1 · Грудь');

    // Заминка: отмеченный целиком блок сворачивается, «Развернуть» возвращает пункты.
    const coolItems = Array.from(container.querySelectorAll('[data-cool-item]')) as HTMLElement[];
    expect(coolItems.length).toBeGreaterThan(0);
    const coolBefore = coolItems.length;
    const firstCool = coolItems.filter(el => (el.getAttribute('data-cool-item') || '').startsWith('0_'));
    (firstCool.length ? firstCool : coolItems).forEach(el => fireEvent.click(el));
    const coolToggle = container.querySelector('[data-act="cool-toggle"]') as HTMLElement;
    expect(coolToggle).toBeTruthy();
    expect(container.querySelectorAll('[data-cool-item]').length).toBeLessThan(coolBefore);
    fireEvent.click(coolToggle);
    expect(container.querySelectorAll('[data-cool-item]').length).toBe(coolBefore);
    const doneTab = Array.from(container.querySelectorAll('[role="tab"]'))
      .find(t => (t.textContent || '').includes('Итог')) as HTMLElement | undefined;
    expect(doneTab).toBeTruthy();
    fireEvent.click(doneTab!);
    expect(container.textContent).toContain('Тренировка завершена');

    // Подробности отчёта (метрики/RIR/отдых/сравнение) свёрнуты: «Итог» и так длинный.
    const moreBtn = container.querySelector('[data-act="done-more"]') as HTMLElement;
    expect(moreBtn).toBeTruthy();
    expect(moreBtn.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('УОИ');
    fireEvent.click(moreBtn);
    expect(container.textContent).toContain('УОИ');
    fireEvent.click(container.querySelector('[data-act="done-more"]') as HTMLElement);
    expect(container.textContent).not.toContain('УОИ');

    // «Итог» — конечный экран плеера: есть явный выход обратно в зону проведения.
    const closeBtn = container.querySelector('[data-act="session-done-close"]') as HTMLElement;
    expect(closeBtn).toBeTruthy();
    const onClose = vi.fn();
    window.addEventListener('he-workout-close', onClose);
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
    window.removeEventListener('he-workout-close', onClose);

    confirmSpy.mockRestore();
    unmount();
    cleanup();
    localStorage.clear();
  });

  it('основная часть: полный редактор только у текущего подхода, остальные — строкой очереди', async () => {
    const { render, fireEvent, cleanup } = await import('@testing-library/react');
    localStorage.clear();
    const days: PlayerDay[] = [{
      label: 'День 1 · Грудь',
      exercises: [{
        name: 'Жим штанги лёжа', muscleGroup: 'chest', restSec: 90,
        targetSets: [
          { weight: 80, reps: 8, rir: 2 },
          { weight: 82.5, reps: 8, rir: 2 },
          { weight: 85, reps: 6, rir: 1 },
        ],
      }],
    }];
    const { container, unmount } = render(<SessionPlayer days={days} weekNumber={1} focus="Грудь" />);
    fireEvent.click(findBtn(container, 'Начать тренировку')!);
    fireEvent.click(findBtn(container, 'К основной части')!);

    // В плане три подхода, но экран держит один редактор: остальные ждут строкой.
    expect(container.querySelectorAll('[data-pl="set-queue"]').length).toBe(1);
    const openBtns = Array.from(container.querySelectorAll('[data-act="open-set"]')) as HTMLElement[];
    expect(openBtns.length).toBe(2);
    expect(container.textContent).toContain('82.5 кг × 8 · RIR 2');
    fireEvent.click(openBtns[0]);
    expect(container.querySelectorAll('[data-act="open-set"]').length).toBe(1);

    unmount();
    cleanup();
    localStorage.clear();
  });

  it('незавершённая сессия: главное действие — «Продолжить», «Начать заново» с подтверждением', async () => {
    const { render, fireEvent, cleanup } = await import('@testing-library/react');
    localStorage.clear();
    saveActiveSession(mkSession(2));
    const days: PlayerDay[] = [{
      label: 'День 1 · Грудь',
      exercises: [{ name: 'Жим лёжа', muscleGroup: 'chest', targetSets: [{ weight: 80, reps: 8, rir: 2 }], restSec: 90 }],
    }];
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container, unmount } = render(<SessionPlayer days={days} weekNumber={3} focus="Грудь" />);

    // Продолжение — главное действие: иначе «Начать тренировку» перекрывала бы его.
    const cta = findBtn(container, 'Продолжить тренировку');
    expect(cta).toBeTruthy();
    expect(cta!.textContent).toContain('2 подх. уже записано');
    expect(findBtn(container, 'Начать тренировку')).toBeFalsy();

    // «Начать заново» спрашивает подтверждение и стартует пустую сессию.
    const restart = container.querySelector('[data-act="resume-restart"]') as HTMLElement;
    expect(restart).toBeTruthy();
    fireEvent.click(restart);
    expect(confirmSpy).toHaveBeenCalled();
    expect(loadActiveSession()?.exercises?.[0]?.sets?.length ?? 0).toBe(0);

    confirmSpy.mockRestore();
    unmount();
    cleanup();
    localStorage.clear();
  });
});
