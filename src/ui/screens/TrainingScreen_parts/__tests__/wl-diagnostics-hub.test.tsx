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
    fireEvent.click(screen.getByRole('button', { name: /Видео/ }));
    const ta = container.querySelector('textarea')!;
    fireEvent.change(ta, { target: { value: 't,x,y\n0,0,0\n0.033,0.5,10\n0.066,1,25\n0.1,0.5,45\n0.133,0,60' } });
    fireEvent.click(screen.getByText(/Разобрать Kinovea CSV/));
    await waitFor(() => expect(container.textContent).toContain('Kinovea:'), { timeout: 2000 });
    expect(container.textContent).toContain('bfPCA P1');
  });
  it('V4-A повторный парс растит историю + EWMA-тренд', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Видео/ }));
    const ta = container.querySelector('textarea')!;
    const csv = 't,x,y\n0,0,0\n0.033,0.5,10\n0.066,1,25\n0.1,0.5,45\n0.133,0,60';
    fireEvent.change(ta, { target: { value: csv } });
    fireEvent.click(screen.getByText(/Разобрать Kinovea CSV/));
    await waitFor(() => expect(container.textContent).toContain('Kinovea:'), { timeout: 2000 });
    fireEvent.click(screen.getByText(/Разобрать Kinovea CSV/));
    await waitFor(() => expect(container.textContent).toContain('История трекинга (2)'), { timeout: 2000 });
    expect(JSON.parse(localStorage.getItem('he_ta_bar_tracking_v1') || '[]').length).toBe(2);
  });
  it('V4-B инъекция + Sinclair уходят в экспорт без ошибок', async () => {
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
    fireEvent.change(container.querySelector('input[placeholder="80"]')!, { target: { value: '81' } });
    const snI = Array.from(container.querySelectorAll('input[placeholder="100"]'));
    fireEvent.change(snI[snI.length - 1], { target: { value: '100' } });
    const cjI = Array.from(container.querySelectorAll('input[placeholder="125"]'));
    fireEvent.change(cjI[cjI.length - 1], { target: { value: '125' } });
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(screen.getAllByText(/Рывок: середина тяги/)[0]);
    fireEvent.click(await screen.findByText(/Вставить коррекции/));
    await waitFor(() => expect(container.textContent).toContain('Вставлено коррекций'), { timeout: 2000 });
    fireEvent.click(screen.getAllByText(/🖨 HTML/)[0]);
    await waitFor(() => expect(container.textContent).toContain('биомеханика + коррекции'), { timeout: 2000 });
  });
  it('V4-C coverage-strip при наличии плана', async () => {
    const miniPlan: any = {
      id: 't', mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 1, patternId: 'x',
      weeksData: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, week: 1, sessionTag: 'snatch_day', character: 'тяж', exercises: [{ id: 'deficit_snatch', name: 'Рывок с дефицита', group: 'legs', pattern: 'hinge', role: 'primary', character: 'тяж', sets: 3, reps: '3', rir: 2, weight: 60, workSets: [{ reps: 3, rir: 2, weight: 60 }], warmupSets: [] }] }] },
      ],
      workMax: {}, rationale: [],
    };
    localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify(miniPlan));
    const { container } = render(<WLDiagnosticsHub />);
    await waitFor(() => expect(container.textContent).toContain('рыв.отрыв 3'), { timeout: 2000 });
    expect(container.textContent).toContain('рыв.серед 0');
  });
  it('V7-B aux-строка: присед виден в аудите', async () => {
    const miniPlan: any = {
      id: 't', mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 1, patternId: 'x',
      weeksData: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, week: 1, sessionTag: 'strength_day', character: 'тяж', exercises: [{ id: 'back_squat', name: 'Присед', group: 'legs', pattern: 'squat', role: 'primary', character: 'тяж', sets: 4, reps: '5', rir: 2, weight: 100, workSets: [{ reps: 5, rir: 2, weight: 100 }], warmupSets: [] }] }] },
      ],
      workMax: {}, rationale: [],
    };
    localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify(miniPlan));
    const { container } = render(<WLDiagnosticsHub />);
    // back_squat по каталогу WL_WEAKPOINT_CORRECTION закрывает только squat_mid (corr-приоритет)
    await waitFor(() => expect(container.textContent).toContain('прис.серед 4'), { timeout: 2000 });
    expect(container.textContent).toContain('прис.низ 0');
    expect(container.textContent).toContain('тяга.старт 0');
  });
  it('V4-C LVP-sparkline рисуется из ramp-ввода', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /VBT\/FvR/ }));
    await waitFor(() => expect(container.querySelector('svg polyline')).toBeTruthy(), { timeout: 2000 });
  });
  it('V4-C OHS снимок сохраняется', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Мобильность/)[0]);
    fireEvent.click(screen.getByText(/Снимок OHS/));
    await waitFor(() => expect(container.textContent).toContain('Снимок OHS'), { timeout: 2000 });
    expect(JSON.parse(localStorage.getItem('he_ta_ohs_hist_v1') || '[]').length).toBe(1);
  });
  it('V4-C печать без popup → честный фолбэк', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByText(/🖨 Печать/));
    await waitFor(() => expect(container.textContent).toMatch(/Всплывающие окна|Печать недоступна/), { timeout: 2000 });
  });
  it('V5-A bridge несёт попытки + Sinclair', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.change(container.querySelector('input[placeholder="80"]')!, { target: { value: '81' } });
    const snI = Array.from(container.querySelectorAll('input[placeholder="100"]'));
    fireEvent.change(snI[snI.length - 1], { target: { value: '100' } });
    const cjI = Array.from(container.querySelectorAll('input[placeholder="125"]'));
    fireEvent.change(cjI[cjI.length - 1], { target: { value: '125' } });
    fireEvent.click(screen.getByRole('button', { name: /VBT\/FvR/ }));
    fireEvent.change(container.querySelector('input[placeholder="125"]')!, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /🏋️ Рывок/ }));
    fireEvent.click(screen.getAllByText(/Рывок: отрыв/)[0]);
    const btns = screen.getAllByText(/Применить в ТА-конструктор/);
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => expect(container.textContent).toContain('Применено'), { timeout: 2000 });
    const payload = localStorage.getItem('he_planner_apply') || '';
    expect(payload).toContain('taAttempts');
    expect(payload).toContain('taSinclair');
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
  it('E14 экспорт v2: HTML с биомеханикой', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(screen.getAllByText(/Рывок: отрыв/)[0]);
    fireEvent.click(screen.getAllByText(/🖨 HTML/)[0]);
    await waitFor(() => expect(container.textContent).toContain('биомеханика + коррекции'), { timeout: 2000 });
  });
  it('E15 ICS календарь спец-блока', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(screen.getAllByText(/Рывок: отрыв/)[0]);
    fireEvent.click(await screen.findByText(/📅 ICS/));
    await waitFor(() => expect(container.textContent).toContain('ICS календарь'), { timeout: 2000 });
  });
  it('E16 годовой синк своим ключом', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(screen.getAllByText(/Рывок: отрыв/)[0]);
    fireEvent.click(await screen.findByText(/В годовой синк/));
    await waitFor(() => expect(container.textContent).toContain('Годовой синк ТА'), { timeout: 2000 });
    expect(localStorage.getItem('he_ta_annual_sync_v1')).toContain('snatch_off_floor');
    expect(localStorage.getItem('he_strength_annual_sync_v1')).toBeNull();
  });
  it('V5-B стартовая неделя синка учитывается', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(screen.getAllByText(/Рывок: отрыв/)[0]);
    fireEvent.change(container.querySelector('input[placeholder="1"]')!, { target: { value: '5' } });
    fireEvent.click(await screen.findByText(/В годовой синк/));
    await waitFor(() => expect(container.textContent).toContain('нед 5–'), { timeout: 2000 });
    expect(JSON.parse(localStorage.getItem('he_ta_annual_sync_v1') || '{}').weeks?.[0]?.week).toBe(5);
  });
  it('V7-C конец года: хвост «поддержание фаз»', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(screen.getAllByText(/Рывок: отрыв/)[0]);
    fireEvent.change(container.querySelector('input[placeholder="1"]')!, { target: { value: '1' } });
    fireEvent.change(container.querySelector('input[placeholder="—"]')!, { target: { value: '8' } });
    fireEvent.click(await screen.findByText(/В годовой синк/));
    await waitFor(() => expect(container.textContent).toContain('нед 1–8'), { timeout: 2000 });
    const stored = JSON.parse(localStorage.getItem('he_ta_annual_sync_v1') || '{}');
    expect(stored.weeks?.length).toBe(8);
    expect(stored.weeks?.[7]?.focus).toEqual([]);
  });
  it('V3 прогресс: сумма + Sinclair + снимок', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.change(container.querySelector('input[placeholder="80"]')!, { target: { value: '81' } });
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    const snatchInputs = Array.from(container.querySelectorAll('input[placeholder="100"]'));
    fireEvent.change(snatchInputs[snatchInputs.length - 1], { target: { value: '100' } });
    const cjInputs = Array.from(container.querySelectorAll('input[placeholder="125"]'));
    fireEvent.change(cjInputs[cjInputs.length - 1], { target: { value: '125' } });
    await waitFor(() => expect(container.textContent).toContain('Sinclair 289'), { timeout: 2000 });
    expect(container.textContent).toContain('2025-2028');
    fireEvent.click(screen.getByText(/📸 Снимок/));
    expect(JSON.parse(localStorage.getItem('he_ta_progress_hist_v1') || '[]').length).toBe(1);
    expect(JSON.parse(localStorage.getItem('he_ta_progress_hist_v1') || '[]')[0].cycle).toBe('2025-2028');
  });
  it('V3 MediaPipe: кнопка проверки', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Видео/ }));
    fireEvent.click(screen.getByText(/Проверить MediaPipe/));
    await waitFor(() => expect(container.textContent).toMatch(/проверяем|модель доступна|нет сети/), { timeout: 5000 });
  });
  it('V9-B aux-таб: присед → биомеханика + топ-3 + причина', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /База/ }));
    fireEvent.click(screen.getAllByText(/Присед: внизу/)[0]);
    await waitFor(() => expect(container.textContent).toContain('Топ-3 коррекции'), { timeout: 2000 });
    expect(container.textContent).toContain('Причина:');
  });
  it('V9-B aux-фаза уходит в bridge и инъекцию', async () => {
    const miniPlan: any = {
      id: 't', mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 1, patternId: 'x',
      weeksData: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, week: 1, sessionTag: 'strength_day', character: 'тяж', exercises: [{ id: 'back_squat', name: 'Присед', group: 'legs', pattern: 'squat', role: 'primary', character: 'тяж', sets: 4, reps: '5', rir: 2, weight: 100, workSets: [{ reps: 5, rir: 2, weight: 100 }], warmupSets: [] }] }] },
      ],
      workMax: { backSquat: 120 }, rationale: [],
    };
    localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify(miniPlan));
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /База/ }));
    fireEvent.click(screen.getAllByText(/Тяга: старт/)[0]);
    const btns = screen.getAllByText(/Применить в ТА-конструктор/);
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => expect(container.textContent).toContain('Применено'), { timeout: 2000 });
    expect(localStorage.getItem('he_planner_apply')).toContain('pull_start');
  });
  it('V7-A FvR: рывок ±1.5кг, взятие — оценка', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /VBT\/FvR/ }));
    const fill = (ph: string, v: string) => fireEvent.change(container.querySelector(`input[placeholder="${ph}"]`)!, { target: { value: v } });
    fill('80', '80'); fill('1.95', '1.95'); fill('0.8', '0.8'); fill('110', '110'); fill('1.45', '1.45'); fill('1.85', '1.85');
    await waitFor(() => expect(container.textContent).toContain('SnatchTh'), { timeout: 2000 });
    fireEvent.click(screen.getByText(/Толчковая тяга/));
    await waitFor(() => expect(container.textContent).toContain('CleanTh'), { timeout: 2000 });
    expect(container.textContent).toContain('оценка');
  });
  it('V6-B3 IMTP ручной вес без профиля', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Взятие/)[0]);
    fireEvent.change(container.querySelector('input[placeholder="250"]')!, { target: { value: '200' } });
    fireEvent.change(container.querySelector('input[placeholder="90"]')!, { target: { value: '80' } });
    await waitFor(() => expect(container.textContent).toContain('×BW'), { timeout: 2000 });
  });
  it('V6-B1 ноты инъекции персистятся и переживают remount', async () => {
    const miniPlan: any = {
      id: 't', mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 1, patternId: 'x',
      weeksData: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, week: 1, sessionTag: 'snatch_day', character: 'тяж', exercises: [{ id: 'deficit_snatch', name: 'Рывок с дефицита', group: 'legs', pattern: 'hinge', role: 'primary', character: 'тяж', sets: 3, reps: '3', rir: 2, weight: 60, workSets: [{ reps: 3, rir: 2, weight: 60 }], warmupSets: [] }] }] },
      ],
      workMax: { snatch: 80 }, rationale: [],
    };
    localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify(miniPlan));
    const first = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(screen.getAllByText(/Рывок: середина тяги/)[0]);
    fireEvent.click(await screen.findByText(/Вставить коррекции/));
    await waitFor(() => expect(first.container.textContent).toContain('Вставлено коррекций'), { timeout: 2000 });
    const stored = JSON.parse(localStorage.getItem('he_wl_diagnostics_hub_v1') || '{}');
    expect(Array.isArray(stored.lastInjectNotes) && stored.lastInjectNotes.length).toBeGreaterThan(0);
    first.unmount();
    const second = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/🖨 HTML/)[0]);
    await waitFor(() => expect(second.container.textContent).toContain('биомеханика + коррекции'), { timeout: 2000 });
  });
});
