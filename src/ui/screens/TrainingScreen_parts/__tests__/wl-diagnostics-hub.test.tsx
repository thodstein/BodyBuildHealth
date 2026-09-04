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
  it('E4 Δ симуляции показана в топ-3 при наличии плана', async () => {
    const miniPlan: any = {
      id: 't', mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 2, patternId: 'x',
      weeksData: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, week: 1, sessionTag: 'snatch_day', character: 'тяж', exercises: [{ id: 'deficit_snatch', name: 'Рывок с дефицита', group: 'legs', pattern: 'hinge', role: 'primary', character: 'тяж', sets: 3, reps: '3', rir: 2, weight: 60, workSets: [{ reps: 3, rir: 2, weight: 60 }], warmupSets: [] }] }] },
        { week: 2, phase: 'accumulation', sessions: [] },
      ],
      workMax: { snatch: 80 }, rationale: [],
    };
    localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify(miniPlan));
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(screen.getAllByText(/Рывок: середина тяги/)[0]);
    await waitFor(() => expect(container.textContent).toContain('покрытие 1/11 → 2/11'), { timeout: 2000 });
  });
  it('E6 инъекция в план + откат', async () => {
    const miniPlan: any = {
      id: 't', mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 2, patternId: 'x',
      weeksData: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, week: 1, sessionTag: 'snatch_day', character: 'тяж', exercises: [{ id: 'deficit_snatch', name: 'Рывок с дефицита', group: 'legs', pattern: 'hinge', role: 'primary', character: 'тяж', sets: 3, reps: '3', rir: 2, weight: 60, workSets: [{ reps: 3, rir: 2, weight: 60 }], warmupSets: [] }] }] },
        { week: 2, phase: 'accumulation', sessions: [{ day: 1, week: 2, sessionTag: 'snatch_day', character: 'тяж', exercises: [{ id: 'deficit_snatch', name: 'Рывок с дефицита', group: 'legs', pattern: 'hinge', role: 'primary', character: 'тяж', sets: 3, reps: '3', rir: 2, weight: 60, workSets: [{ reps: 3, rir: 2, weight: 60 }], warmupSets: [] }] }] },
      ],
      workMax: { snatch: 80 }, rationale: [],
    };
    localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify(miniPlan));
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок: середина тяги/)[0]);
    fireEvent.click(await screen.findByText(/Вставить коррекции/));
    await waitFor(() => expect(container.textContent).toContain('Вставлено коррекций'), { timeout: 2000 });
    expect(localStorage.getItem('he_strength_sport_plan_v1')).toContain('pause_snatch');
    expect(localStorage.getItem('he_strength_sport_plan_prev_v1')).not.toContain('pause_snatch');
    fireEvent.click(await screen.findByText(/↩ Откат/));
    await waitFor(() => expect(container.textContent).toContain('восстановлен до инъекции'), { timeout: 2000 });
    expect(localStorage.getItem('he_strength_sport_plan_v1')).not.toContain('pause_snatch');
  });
  it('E7 jerk dip метрика: оптимум 10см/200мс', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Толчок/)[0]);
    fireEvent.change(container.querySelector('input[placeholder="10"]')!, { target: { value: '10' } });
    fireEvent.change(container.querySelector('input[placeholder="200"]')!, { target: { value: '200' } });
    await waitFor(() => expect(container.textContent).toContain('Dip 10см за 200мс'), { timeout: 2000 });
    expect(container.textContent).toContain('оптимален');
  });
  it('E7 Kinovea CSV → метрики + bfPCA', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Видео/)[0]);
    const ta = container.querySelector('textarea')!;
    fireEvent.change(ta, { target: { value: 't,x,y\n0,0,0\n0.033,0.5,10\n0.066,1,25\n0.1,0.5,45\n0.133,0,60' } });
    fireEvent.click(screen.getByText(/Разобрать Kinovea CSV/));
    await waitFor(() => expect(container.textContent).toContain('Kinovea:'), { timeout: 2000 });
    expect(container.textContent).toContain('bfPCA P1');
  });
  it('E8 углы с видео → сводка + валидация фаз', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(screen.getAllByText(/Рывок: фиксация в седе/)[0]);
    fireEvent.click(screen.getAllByText(/Видео/)[0]);
    const ta = container.querySelectorAll('textarea')[1];
    fireEvent.change(ta, { target: { value: 't,hip,knee,ankle,shoulder\n0,100,80,40,160\n0.1,95,70,38,155\n0.2,90,65,36,150' } });
    await waitFor(() => expect(container.textContent).toContain('Кадров: 3'), { timeout: 2000 });
    expect(container.textContent).toContain('OHS-прогноз по углам');
  });
  it('E9 антропометрия → хват + в профиль', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Мобильность/)[0]);
    fireEvent.change(container.querySelector('input[placeholder="180"]')!, { target: { value: '180' } });
    fireEvent.change(container.querySelector('input[placeholder="182"]')!, { target: { value: '190' } });
    await waitFor(() => expect(container.textContent).toContain('Длинные руки'), { timeout: 2000 });
    fireEvent.click(screen.getByText(/Размах\/плечи в профиль/));
    expect(JSON.parse(localStorage.getItem('he_profile_v2') || '{}').personal?.armSpanCm).toBe(190);
  });
  it('E10 женские бенчмарки при sex=female', async () => {
    localStorage.setItem('he_profile_v2', JSON.stringify({ personal: { sex: 'female' } }));
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /VBT\/FvR/ }));
    await waitFor(() => expect(container.textContent).toContain('Женские бенчмарки пика'), { timeout: 2000 });
  });
  it('E11 ножницы толчка → асимметрия + снимок', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Мобильность/)[0]);
    fireEvent.change(container.querySelector('input[placeholder="95 нож"]')!, { target: { value: '85' } });
    fireEvent.change(container.querySelector('input[placeholder="100 нож"]')!, { target: { value: '100' } });
    await waitFor(() => expect(container.textContent).toContain('Ножницы 15%'), { timeout: 2000 });
    fireEvent.click(screen.getByText(/Снимок ножниц/));
    expect(JSON.parse(localStorage.getItem('he_ta_split_jerk_hist') || '[]').length).toBe(1);
  });
  it('E12 попытки: заявка 100 → 90/96/102', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /VBT\/FvR/ }));
    fireEvent.change(container.querySelector('input[placeholder="125"]')!, { target: { value: '100' } });
    await waitFor(() => expect(container.textContent).toContain('Толчок: 90 / 96 / 102'), { timeout: 2000 });
  });
  it('E13 IMTP/RFD: dip → невалиден', async () => {
    localStorage.setItem('he_profile_v2', JSON.stringify({ personal: { weight: 90 } }));
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Взятие/)[0]);
    fireEvent.change(container.querySelector('input[placeholder="250"]')!, { target: { value: '200' } });
    fireEvent.change(container.querySelector('input[placeholder="220"]')!, { target: { value: '200' } });
    fireEvent.change(container.querySelector('input[placeholder="7000"]')!, { target: { value: '4000' } });
    await waitFor(() => expect(container.textContent).toContain('×BW'), { timeout: 2000 });
    const cb = container.querySelector('input[type="checkbox"]')!;
    fireEvent.click(cb);
    await waitFor(() => expect(container.textContent).toContain('невалиден'), { timeout: 2000 });
  });
});
