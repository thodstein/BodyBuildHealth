import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { StrongmanDiagnosticsHub } from '../StrongmanDiagnosticsHub';

beforeEach(() => {
  localStorage.clear();
  (HTMLCanvasElement.prototype as any).getContext = vi.fn(() => null);
});

describe('StrongmanDiagnosticsHub corrective + top nav', () => {
  it('верхняя навигация: 7 табов + применить, дубль шапки внизу удалён', () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    expect(container.querySelector('[data-sm="bottom-nav"]')).toBeNull();
    const top = container.querySelector('[data-sm="top-nav"]');
    expect(top).toBeTruthy();
    expect((top as HTMLElement).style.position).not.toBe('sticky');
    for (const id of ['press', 'carry', 'load', 'grip', 'mobility', 'video', 'correction']) {
      expect(top!.querySelector(`[data-sm="top-tab-${id}"]`)).toBeTruthy();
    }
    expect(top!.querySelector('[data-sm="top-apply"]')).toBeTruthy();
  });
  it('таб Коррекция: пустое состояние без фаз', () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    expect(document.body.textContent).toContain('Выбери 1–4 слабые фазы');
  });
  it('таб Коррекция: фаза → причина → топ с дозой/кью/прогрессией + сессия + волна', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-card"]')).toBeTruthy());
    const card = document.body.textContent || '';
    expect(card).toContain('Доза:');
    expect(card).toContain('Кью:');
    expect(card).toContain('Прогрессия:');
    expect(card).toContain('Источник:');
    expect(document.body.querySelector('[data-sm="corr-session"]')).toBeTruthy();
    expect(document.body.querySelector('[data-sm="corr-block"]')).toBeTruthy();
  });
  it('кнопка коррекции пишет мост с smCorrections', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    const btn = await screen.findByText(/Коррекцию в Стронг/);
    fireEvent.click(btn);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    expect(localStorage.getItem('he_planner_apply')).toContain('smCorrections');
  });
  it('хинт Видео: sway 4см → топ-упражнение + переход в Коррекцию', async () => {
    localStorage.setItem('he_strongman_diagnostics_hub_v1', JSON.stringify({ swayCm: '4' }));
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(container.querySelector('[data-sm="top-tab-video"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-video"]')).toBeTruthy());
    expect(document.body.textContent).toContain('yoke_walk →');
    fireEvent.click(screen.getByText(/Открыть Коррекцию/));
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-tab"]')).toBeTruthy());
  });
  it('хинт асимметрии: L/R 100/90 → слабее справа + добивка', async () => {
    localStorage.setItem('he_strongman_diagnostics_hub_v1', JSON.stringify({ leftMax: '100', rightMax: '90' }));
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(container.querySelector('[data-sm="top-tab-mobility"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-split"]')).toBeTruthy());
    expect(document.body.textContent).toContain('Слабее справа');
  });
  it('хинт мобильности: OHS 2 провала → щадящие дозы + переход', async () => {
    localStorage.setItem('he_strongman_diagnostics_hub_v1', JSON.stringify({ ohsKneeValgus: true, ohsHipBelowParallel: false }));
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(container.querySelector('[data-sm="top-tab-mobility"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-mobility"]')).toBeTruthy());
    expect(document.body.textContent).toContain('щадящие дозы');
  });
  it('⭐: клик ставит предпочитаемую, персист и мост несут smPreferredCorr', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    const stars = await screen.findAllByText('☆');
    expect(stars.length).toBeGreaterThan(0);
    fireEvent.click(stars[0]);
    await waitFor(() => expect(screen.getAllByText('⭐').length).toBeGreaterThan(0));
    expect(localStorage.getItem('he_sm_preferred_corr_v1')).toContain('sm_log');
    const btn = await screen.findByText(/Коррекцию в Стронг/);
    fireEvent.click(btn);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    expect(localStorage.getItem('he_planner_apply')).toContain('smPreferredCorr');
    expect(localStorage.getItem('he_planner_apply')).toContain('smCorrectiveDetail');
  });
  it('P1: замер sway 6см → RU-теги ошибок в Коррекции', async () => {
    localStorage.setItem('he_strongman_diagnostics_hub_v1', JSON.stringify({ swayCm: '6' }));
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-errtags"]')).toBeTruthy());
    expect(document.body.textContent).toContain('Качание');
  });
  it('P4/P6: волна с дозой причины — строки с sm_ id и @%', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-block-lines"]')).toBeTruthy());
    const txt = document.body.querySelector('[data-sm="corr-block-lines"]')?.textContent || '';
    expect(txt).toMatch(/sm_log/);
    expect(txt).toMatch(/@/);
  });
  it('D2: фильтры подбора — уровень персистится, зал режет топ (ROUND-9: 5→3)', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-filters"]')).toBeTruthy());
    // было: 3 (в фазе было ровно 3 записи) → стало 5: ROUND-9 добил пул фазы до 5 вариантов
    expect(document.body.querySelectorAll('[data-sm="corr-row"]').length).toBe(5);
    fireEvent.click(screen.getByText('Штанга'));
    // было: 2 → стало 3: из 5 кандидатов под штангу проходят 3 (выбор шире)
    await waitFor(() => expect(document.body.querySelectorAll('[data-sm="corr-row"]').length).toBe(3));
    fireEvent.click(screen.getByText('Новичок'));
    expect(screen.getByText('Новичок').getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('he_strongman_diagnostics_hub_v1')).toContain('corrLevel');
    const applyBtn = await screen.findByText(/Коррекцию в Стронг/);
    fireEvent.click(applyBtn);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    expect(localStorage.getItem('he_planner_apply')).toContain('smCorrEquipment');
  });
  it('O1: фильтр без совпадений — честная нота вместо пустой карточки', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="top-tab-correction"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-row"]')).toBeTruthy());
    fireEvent.click(screen.getByText('Свой вес'));
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-empty-phase"]')).toBeTruthy());
    expect(document.body.textContent).toContain('ослабь фильтры');
  });
  it('C5: асимметрия + grip-фаза → мост несёт smUnilateral', async () => {
    localStorage.setItem('he_strongman_diagnostics_hub_v1', JSON.stringify({ gripWeak: ['grip'], leftMax: '100', rightMax: '90' }));
    render(<StrongmanDiagnosticsHub />);
    const btns = screen.getAllByText(/Применить в Стронг/);
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    const raw = localStorage.getItem('he_planner_apply') || '';
    expect(raw).toContain('smUnilateral');
    expect(raw).toContain('farmers_grip');
  });
  it('C6: мост несёт smWaveSets волны', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    const btns = screen.getAllByText(/Применить в Стронг/);
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    const raw = localStorage.getItem('he_planner_apply') || '';
    expect(raw).toContain('smWaveSets');
  });
});
