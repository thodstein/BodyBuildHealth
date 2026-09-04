import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { WLDiagnosticsHub } from '../WLDiagnosticsHub';

beforeEach(() => { localStorage.clear(); });

describe('WLDiagnosticsHub PRO', () => {
  it('рендерит заголовок и 4 вкладки', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    expect(container.textContent).toContain('ТА-диагностика');
    expect(screen.getAllByText(/Рывок/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Взятие/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Толчок/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Мобильность/)).toBeTruthy();
  });
  it('выбор слабых фаз рывка', async () => {
    render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    const btn = await screen.findByText(/Рывок: отрыв/);
    fireEvent.click(btn);
    expect(await screen.findByText(/deficit_snatch/)).toBeTruthy();
  });
  it('применить без выбора — тост', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    const btns = screen.getAllByText(/Применить в ТА-конструктор/);
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => expect(container.textContent).toContain('не выбраны'), { timeout: 2000 });
  });
  it('применить с выбором — bridge', async () => {
    render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(await screen.findByText(/Рывок: отрыв/));
    await screen.findByText(/deficit_snatch/);
    const btns = screen.getAllByText(/Применить в ТА-конструктор/);
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    expect(localStorage.getItem('he_planner_apply')).toContain('weakpoints');
  });
  it('E1 аудит плана: покрытие + худшая фаза → разбор', async () => {
    const miniPlan: any = {
      id: 't', mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 2, patternId: 'x',
      weeksData: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, week: 1, sessionTag: 'snatch_day', character: 'тяж', exercises: [{ id: 'deficit_snatch', name: 'Рывок с дефицита', group: 'legs', pattern: 'hinge', role: 'primary', character: 'тяж', sets: 3, reps: '3', rir: 2, weight: 60, workSets: [{ reps: 3, rir: 2, weight: 60 }], warmupSets: [] }] }] },
        { week: 2, phase: 'accumulation', sessions: [] },
      ],
      workMax: {}, rationale: [],
    };
    localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify(miniPlan));
    const { container } = render(<WLDiagnosticsHub />);
    await waitFor(() => expect(container.textContent).toContain('покрытие фаз 1/11'), { timeout: 2000 });
    const worst = await screen.findByText(/Худшая фаза:/);
    fireEvent.click(worst);
    await waitFor(() => expect(container.textContent).toContain('Худшая фаза плана'), { timeout: 2000 });
  });
  it('E1 аудит без плана — подсказка собрать', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    await waitFor(() => expect(container.textContent).toContain('план ТА не собран'), { timeout: 2000 });
  });
  it('E2 причина фазы показана под карточкой', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(await screen.findByText(/Рывок: отрыв/));
    await waitFor(() => expect(container.textContent).toContain('Причина:'), { timeout: 2000 });
  });
  it('E3 топ-3 коррекции + выбор ⭐', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(await screen.findByText(/Рывок: отрыв/));
    await waitFor(() => expect(container.textContent).toContain('Топ-3 коррекции'), { timeout: 2000 });
    const stars = container.querySelectorAll('button[aria-pressed]');
    const star = Array.from(stars).find(b => b.textContent === '☆');
    expect(star).toBeTruthy();
    fireEvent.click(star!);
    expect(JSON.parse(localStorage.getItem('he_wl_diagnostics_hub_v1') || '{}').preferredCorr?.snatch_off_floor).toBeTruthy();
  });
});
