/**
 * pl-plan-view.test.tsx — смоук-тест PLPlanView (план цикла ПЛ, вынесен из SRCBBScreen):
 * рендер календаря, план-таблицы, тапер-меток и карточки прикидов без падений.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { PLPlanView, type PLPlanViewApi } from '../PLPlanView';
import type { LMSBuildOutput } from '../../../../engines/lms/lms-builder.engine';

const mkEx = (name: string, pct: number, sets: number, load?: string) => ({
  name, group: 'Грудь', coef: 1, mnosz: 1, pm: 200, rir: 2,
  ...(load ? { load } : {}),
  workSets: [{ pct, reps: 3, sets, weight: 160, rir: 2 }],
});

const mkDay = (taper = false) => ({
  exercises: [
    mkEx('Присед', taper ? 0.8 : 0.85, taper ? 2 : 3, 'main'),
    mkEx('Жим лежа', taper ? 0.8 : 0.85, taper ? 2 : 3, 'main'),
    mkEx('Тяга к поясу', 0.7, taper ? 2 : 4),
  ],
  metrics: { tonnage: 1000, kpsh: 20, avgWeight: 50, relIntensity: 0.7, intFB: 0, uoi: 0 } as never,
});

const plan = (): LMSBuildOutput => ({
  template: { meta: { title: 'Тестовый цикл', correctionPct: 0.005 } } as never,
  progressionRationale: '',
  cycleMetrics: { tonnage: 0, kpsh: 0, avgWeight: 0, relIntensity: 0, intFB: 0, uoi: 0, sessions: 0, perSession: [] } as never,
  weeks: [
    { week: 1, pmRow: { 'Присед': 200, 'Жим лежа': 140 }, days: [mkDay(false)], sourcePhase: 'base' },
    { week: 2, pmRow: { 'Присед': 200, 'Жим лежа': 140 }, days: [mkDay(false)], sourcePhase: 'base' },
    { week: 7, pmRow: { 'Присед': 200, 'Жим лежа': 140 }, days: [mkDay(true)], taperWeek: true, sourcePhase: 'peak' },
    { week: 8, pmRow: { 'Присед': 200, 'Жим лежа': 140 }, days: [mkDay(true)], taperWeek: true, sourcePhase: 'peak', meetAttempts: { strategy: 'balanced', lifts: [{ name: 'Присед', opener: 185, second: 192.5, third: 202.5, target: 202.5, warmup: [{ pct: 0.4, weight: 75, reps: 5 }] }] } },
  ] as never,
});

const api = (): PLPlanViewApi => ({
  builtSrc: plan() as never,
  setBuiltSrc: () => {},
  srcWeek: 1, setSrcWeek: () => {},
  srcEdits: {}, setSrcEdits: () => {},
  srcAdditions: {}, setSrcAdditions: () => {},
  editMode: false, setEditMode: () => {},
  setKey: () => '', effSet: (_w, _d, _e, _s, ws) => ws,
  dayKey: () => '', addExToDay: () => {},
  pickerDay: null, setPickerDay: () => {}, pickerGroup: 'chest', setPickerGroup: () => {},
  pickerExName: '', setPickerExName: () => {}, pickerScheme: { sets: 3, reps: 8, weight: 40 }, setPickerScheme: () => {},
  days: 3, calendarView: 'tapered', setCalendarView: () => {},
  bridgeSessions: [], setBridgeWeek: () => {}, bridgeWeek: 1,
  onNote: () => {}, buildSrc: () => {},
  selectedCycleId: 'cycle-01', cycleWeeks: 8, goal: 'strength', level: 'II-KMS',
  peds: [], pedDoses: {}, pedAuto: false, courseIntensity: 'moderate',
  autoRegMode: 'off', setAutoRegMode: () => {}, autoRegResult: { topSetPctMultiplier: 1, volumeMultiplier: 1, rirShift: 0, deload: false, decisions: [] } as never,
  bridgeRir: 0, pmSquat: 180, pmBench: 120, pmDead: 220,
  best: { cycle: { meta: { id: 'cycle-01', title: 'Тестовый цикл', direction: 'powerlifting', period: 'силовой', level: 'II-KMS', weeks: 8, sessionsPerWeek: 3, correctionPct: 0.005 } }, score: 0, rationale: [], warnings: [] } as never,
  plWeakPoints: [],
  linked: { readiness: { recovery: 80, fatigue: 30, sleep: 70 } } as never,
  runFocus: null, diaryAutoreg: null, calibratePmFromDiary: () => {}, applyPmFromCycle: () => {},
  e1rmSeries: [], exerciseE1rm: [], exTrendSeries: [], playerDays: [],
  selectedTrendEx: null, setSelectedTrendEx: () => {},
  tempoStr: '', getTempo: () => ({ tempo: '', restSec: 90 } as never), methodHints: { volumeMult: 1, technique: null, label: '' },
});

describe('PLPlanView', () => {
  it('рендерит план: тапер-метки, календарь, упражнения', () => {
    render(<PLPlanView api={api()} />);
    expect(screen.getAllByText(/📉 Тапер/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Календарь цикла с тапером/)).toBeTruthy();
    expect(screen.getAllByText(/Присед/).length).toBeGreaterThan(0);
  });

  it('на финальной тапер-неделе рендерится карточка прикидов', () => {
    const a = api();
    a.srcWeek = 8;
    render(<PLPlanView api={a} />);
    expect(screen.getAllByText(/Соревновательный день|прикиды|Прикиды/).length).toBeGreaterThan(0);
  });

  it('без краха при пустом дневнике (e1rmSeries пуст)', () => {
    const a = api();
    render(<PLPlanView api={a} />);
    expect(screen.getAllByText(/Присед/).length).toBeGreaterThan(0);
  });

  it('карточка прикидов: переключение «🤖 Авто» меняет веса на лету (база из pmRow, множитель в отображении)', () => {
    const a = api();
    a.srcWeek = 8;
    a.autoRegResult = { topSetPctMultiplier: 0.9, volumeMultiplier: 1, rirShift: 0, deload: false, decisions: [] } as never;
    const Harness = () => {
      const [mode, setMode] = useState<'off' | 'auto' | 'diary'>('off');
      return <PLPlanView api={{ ...a, autoRegMode: mode, setAutoRegMode: m => setMode(m) }} />;
    };
    render(<Harness />);
    // off: база из pmRow 200 (balanced) → присед 185/192.5/205
    expect(screen.getAllByText('185').length).toBeGreaterThan(0);
    expect(screen.queryByText('166.5')).toBeNull();
    // «Попытки на соревнования» считаются от ПМ ПО ЦИКЛУ (pmRow финальной недели 200),
    // а не от «дневниковых» PM0-полей (pmSquat 180 → было бы 157.5/166.5/180)
    expect(screen.getByText(/рекоменд.: 175\/185\/200/)).toBeTruthy();
    expect(screen.getByText(/рекоменд.: 122\.5\/130\/140/)).toBeTruthy();
    expect(screen.queryByText(/рекоменд.: 157\.5\/166\.5\/180/)).toBeNull();
    fireEvent.click(screen.getAllByText('🤖 Авто')[0]);
    // auto ×0.9: 185×0.9 = 166.5 (round 0.1)
    expect(screen.getAllByText('166.5').length).toBeGreaterThan(0);
    expect(screen.queryByText('185')).toBeNull();
    // карточка «Попытки на соревнования» тоже масштабируется и показывает hint множителя
    expect(screen.getByText(/попытки ×0\.90/)).toBeTruthy();
  });

  it('кнопка «📊 Из цикла» ставит ПМ0 из прогноза цикла (pmRow финальной недели), а не из дневника', () => {
    const a = api();
    a.srcWeek = 8;
    let applied: { squat: number; bench: number; deadlift: number } | null = null;
    let noted = '';
    a.applyPmFromCycle = pm => { applied = pm; };
    a.onNote = n => { noted = n; };
    render(<PLPlanView api={a} />);
    // кнопка активна: pmRow финальной недели даёт ПМ 200/140, отличные от PM0-полей 180/120
    const btn = screen.getByText(/📊 Из цикла/);
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    expect(applied).toEqual({ squat: 200, bench: 140, deadlift: 220 });
    expect(noted).toContain('📊 ПМ0 установлены из цикла');
    expect(noted).toContain('присед 200 · жим 140 · тяга 220');
  });

  it('кнопка «📊 Из цикла» неактивна, когда ПМ по циклу совпадает с PM0-полями', () => {
    const a = api();
    a.srcWeek = 8;
    a.pmSquat = 200; a.pmBench = 140; a.pmDead = 220;
    render(<PLPlanView api={a} />);
    expect((screen.getByText(/📊 Из цикла/) as HTMLButtonElement).disabled).toBe(true);
  });

  it('карточка попыток: серия из дневника видна в бейдже «📈 Из дневника» (жим «Жим штанги лёжа» из каталога)', () => {
    const a = api();
    a.srcWeek = 8;
    // Серия строится в SRCBBScreen через detectLift: «Жим штанги лёжа» → bench (раньше
    // матчинг подстрокой «жим лёжа» не ловил каноническое имя каталога — серия не строилась).
    a.e1rmSeries = [
      { lift: 'squat', label: 'Присед', color: '#00e68a', pts: [{ date: '2026-08-01', val: 190 }, { date: '2026-08-10', val: 195 }] },
      { lift: 'bench', label: 'Жим', color: '#60a5fa', pts: [{ date: '2026-08-01', val: 135 }, { date: '2026-08-10', val: 140 }] },
      { lift: 'deadlift', label: 'Становая', color: '#f59e0b', pts: [{ date: '2026-08-01', val: 230 }] },
    ];
    let noted = '';
    a.onNote = n => { noted = n; };
    render(<PLPlanView api={a} />);
    // бейдж показывает последние значения серий
    expect(screen.getByText(/📈 Из дневника \(присед 195 · жим 140 · тяга 230\)/)).toBeTruthy();
    const btn = screen.getByText(/📈 Из дневника/);
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    // клик без реального стейта ПМ0 не падает (в тесте calibratePmFromDiary — no-op)
    fireEvent.click(btn);
    expect(noted).toContain('ПМ0 обновлены из дневника');
  });

  it('карточка попыток: без серий дневника кнопка «📈 Из дневника» не disabled, клик — подсказка', () => {
    const a = api();
    a.srcWeek = 8;
    a.e1rmSeries = [];
    let noted = '';
    a.onNote = n => { noted = n; };
    render(<PLPlanView api={a} />);
    const btn = screen.getByText('📈 Из дневника') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(noted).toContain('нет записей 1ПМ');
  });
});
