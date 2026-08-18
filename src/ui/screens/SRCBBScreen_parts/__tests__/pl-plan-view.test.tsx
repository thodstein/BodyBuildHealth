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
  runFocus: null, diaryAutoreg: null, calibratePmFromDiary: () => {},
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
    fireEvent.click(screen.getAllByText('🤖 Авто')[0]);
    // auto ×0.9: 185×0.9 = 166.5 (round 0.1)
    expect(screen.getAllByText('166.5').length).toBeGreaterThan(0);
    expect(screen.queryByText('185')).toBeNull();
    // карточка «Попытки на соревнования» тоже масштабируется и показывает hint множителя
    expect(screen.getByText(/попытки ×0\.90/)).toBeTruthy();
  });
});
