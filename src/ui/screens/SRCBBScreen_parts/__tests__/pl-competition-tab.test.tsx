/**
 * pl-competition-tab.test.tsx — смоук-тест PLCompetitionTab (мастерская тапера ПЛ,
 * вынесена из SRCBBScreen в отдельную вкладку): рендер панели соревнований,
 * параметров и тренерской карточки.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PLCompetitionTab, type PLCompetitionTabApi } from '../PLCompetitionTab';
import { PLTaperProvider } from '../taper-state';

const api = (): PLCompetitionTabApi => ({
  builtSrc: null,
  setBuiltSrc: () => {},
  onNote: () => {},
  autoRegMode: 'off',
  setAutoRegMode: () => {},
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
    expect(screen.getAllByText(/Пик-блок на окно/).length).toBeGreaterThan(0);
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

  it('клик по «🤖 Авто» вызывает api.setAutoRegMode + заметку (реальный переключатель)', () => {
    const calls: string[] = [];
    const notes: string[] = [];
    const a = api();
    a.setAutoRegMode = m => { calls.push(m); };
    a.onNote = m => { notes.push(m); };
    render(<PLCompetitionTab api={a} />);
    fireEvent.click(screen.getByText('🤖 Авто'));
    expect(calls).toEqual(['auto']);
    expect(notes).toEqual(['🔄 Режим авторегуляции: 🤖 Авто']);
  });

  it('активный режим подсвечен: auto → «🤖 Авто» активна, «ВЫКЛ» нет', () => {
    const a = api();
    a.cycle.autoRegMode = 'auto';
    render(<PLCompetitionTab api={a} />);
    const autoBtn = screen.getByText('🤖 Авто');
    expect(autoBtn.style.background).toBe('rgb(96, 165, 250)');
    expect(autoBtn.style.color).toBe('rgb(0, 0, 0)');
    const offBtn = screen.getByText('ВЫКЛ');
    expect(offBtn.style.color).not.toBe('rgb(0, 0, 0)');
  });

  it('активный режим «ВЫКЛ» тоже подсвечен (фон #71717a, текст чёрный)', () => {
    render(<PLCompetitionTab api={api()} />);
    const offBtn = screen.getByText('ВЫКЛ');
    expect(offBtn.style.background).toBe('rgb(113, 113, 122)');
    expect(offBtn.style.color).toBe('rgb(0, 0, 0)');
  });

  it('кнопка «Тапер по сезону» рендерится с числом стартов и disabled без плана', () => {
    render(<PLCompetitionTab api={api()} />);
    const btn = screen.getByText(/Тапер по сезону/);
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
