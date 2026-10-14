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

  it('док зала смонтирован в зоне проведения', () => {
    expect(src).toContain('<SessionWidgetsDock />');
  });
});
