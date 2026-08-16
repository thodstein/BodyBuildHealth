/**
 * pl-competition-tab.test.tsx — смоук-тест PLCompetitionTab (мастерская тапера ПЛ,
 * вынесена из SRCBBScreen в отдельную вкладку): рендер панели соревнований,
 * параметров и тренерской карточки.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PLCompetitionTab, type PLCompetitionTabApi } from '../PLCompetitionTab';

const api = (): PLCompetitionTabApi => ({
  builtSrc: null,
  setBuiltSrc: () => {},
  onNote: () => {},
  taper: {
    meetList: [{ id: 'm1', name: 'Шоу 1', weeksToStart: 8, fed: 'ipf', plannedPm: { 'Присед': 200 }, strategy: 'balanced' }],
    setMeetList: () => {},
    mainMeetId: 'm1', setMainMeetId: () => {},
    applyMainMeet: () => {}, addMeet: () => {}, removeMeet: () => {},
    bw: 82, setBw: () => {}, targetBw: 80, setTargetBw: () => {},
    weeksToMeet: 8, setWeeksToMeet: () => {}, taperWeeksToAdd: 2, setTaperWeeksToAdd: () => {},
    attemptStrategy: 'balanced', setAttemptStrategy: () => {},
    peakMode: 'classic', setPeakMode: () => {}, peakLayout: 'attempts', setPeakLayout: () => {},
    taperWeightGoal: 'auto', setTaperWeightGoal: () => {},
    taperFed: 'ipf', setTaperFed: () => {},
    taperActualPm: {}, setTaperActualPm: () => {}, taperPlannedPm: {}, setTaperPlannedPm: () => {},
    taperAttemptOverride: {}, setTaperAttemptOverride: () => {},
    mockMeetOn: true, setMockMeetOn: () => {}, meetWeekOn: true, setMeetWeekOn: () => {}, postMeetOn: true, setPostMeetOn: () => {},
    taperNote: '', setTaperNote: () => {}, taperPlan: null, setTaperPlan: () => {},
  },
  cycle: {
    peds: [], pedDoses: {}, courseIntensity: 'moderate', pedAuto: false,
    autoRegMode: 'off', autoRegResult: { topSetPctMultiplier: 1, volumeMultiplier: 1, rirShift: 0, deload: false, decisions: [] } as never,
    plCalorieSurplus: 0, plProteinPerKg: 1.8, selectedCycleId: 'c1', pmSquat: 180, pmBench: 120, pmDead: 220,
  },
  coach: {
    buildCtx: () => ({ fatigue: 55, acwr: { ratio: 1.2, zone: 'optimal' as const }, currentWeight: 82, targetWeight: 80, weeksToMeet: 8, weeklyK: 0.01 }),
    applyRecommendation: () => {},
    diarySessions: [],
  },
});

describe('PLCompetitionTab', () => {
  it('рендерит сезон, параметры и тренерскую карточку', () => {
    render(<PLCompetitionTab api={api()} />);
    expect(screen.getByText(/Соревнования сезона \+ тапер/)).toBeTruthy();
    expect(screen.getByDisplayValue('Шоу 1')).toBeTruthy();
    expect(screen.getByText(/Стратегия прикидов/)).toBeTruthy();
    expect(screen.getByText(/Подобрать тапер автоматически/)).toBeTruthy();
    expect(screen.getAllByText(/Сгенерировать тапер-план/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Добавить тапер к плану/)).toBeTruthy();
  });
});
