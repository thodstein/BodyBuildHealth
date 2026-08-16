/**
 * pl-competition-tab.test.tsx — смоук-тест PLCompetitionTab (мастерская тапера ПЛ,
 * вынесена из SRCBBScreen в отдельную вкладку): рендер панели соревнований,
 * параметров и тренерской карточки.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PLCompetitionTab, type PLCompetitionTabApi } from '../PLCompetitionTab';
import { PLTaperProvider } from '../taper-state';

const api = (): PLCompetitionTabApi => ({
  builtSrc: null,
  setBuiltSrc: () => {},
  onNote: () => {},
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
    expect(screen.getByDisplayValue('Соревнование 1')).toBeTruthy();
    expect(screen.getByText(/Стратегия прикидов/)).toBeTruthy();
    expect(screen.getByText(/Подобрать тапер автоматически/)).toBeTruthy();
    expect(screen.getAllByText(/Сгенерировать тапер-план/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Добавить тапер к плану/)).toBeTruthy();
  });

  it('бейдж готовности старта в сезоне (weeksToStart=8 → 🧠 75%)', () => {
    render(<PLCompetitionTab api={api()} />);
    expect(screen.getByText(/🧠 75%/)).toBeTruthy();
  });

  it('бейдж готовности: старт через 1 нед → 🧠 92% (тапер-окно)', () => {
    const saved = { plMeetList: [{ id: 'm1', name: 'Старт', weeksToStart: 1, fed: 'ipf', plannedPm: {}, strategy: 'balanced' }], plMainMeetId: 'm1' };
    render(<PLTaperProvider saved={saved}><PLCompetitionTab api={api()} /></PLTaperProvider>);
    expect(screen.getByText(/🧠 92%/)).toBeTruthy();
  });
});
