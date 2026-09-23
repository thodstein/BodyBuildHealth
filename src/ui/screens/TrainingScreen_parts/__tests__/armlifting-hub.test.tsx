import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArmliftingDiagnosticsHub } from '../ArmliftingDiagnosticsHub';

describe('W-AL UI: хаб армлифтинга', () => {
  it('рендер: замеры + вердикт-хинт без данных', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect(screen.getByLabelText(/RT кг/)).toBeTruthy();
    expect(screen.getByLabelText(/CoC уровень/)).toBeTruthy();
    expect(screen.getByLabelText(/Excalibur кг/)).toBeTruthy();
    expect(document.body.textContent).toContain('Введи замеры');
  });
  it('ROUND-10: ICS спец-блока — кнопка есть, клик даёт честный ответ (календарь/пусто)', async () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    const btn = document.body.querySelector('[data-arm="lift-export-ics"]');
    expect(btn).not.toBeNull();
    fireEvent.click(btn!);
    await waitFor(() => expect(document.body.textContent).toMatch(/Календарь \.ics|Спец-блок пуст/));
  });
  it('ROUND-10: чипы покрытия снарядов — 0/7 без замеров, RT отмечается после ввода', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    const cov = document.querySelector('[data-arm="lift-coverage"]');
    expect(cov).not.toBeNull();
    expect(cov!.textContent).toContain('Покрытие снарядов: 0/7');
    const chips = cov!.querySelectorAll('[data-covered]');
    expect(chips.length).toBe(7);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '100' } });
    const cov2 = document.querySelector('[data-arm="lift-coverage"]')!;
    expect(cov2.textContent).toContain('Покрытие снарядов: 1/7');
    const rt = Array.from(cov2.querySelectorAll('[data-covered]')).find((c) => (c.textContent || '').includes('RT'));
    expect(rt!.getAttribute('data-covered')).toBe('true');
  });
  it('ROUND-10: аудит плана — пусто без плана, покрытие звена с планом + метка дыры', async () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect(document.querySelector('[data-arm="lift-plan-empty"]')).not.toBeNull();
    // apollon_axle — только пул «пальцы» (rolling_thunder закрыл бы и выносливость)
    window.localStorage.setItem('he_arm_plan_saved', JSON.stringify({ plan: { weeks: [{ week: 1, sessions: [{ day: 1, sessionTag: 'GripHeavy', exercises: [{ exerciseId: 'apollon_axle', sets: 4 }] }] }] } }));
    fireEvent(window, new Event('he-arm-plan-saved'));
    await waitFor(() => expect(document.querySelector('[data-arm="lift-plan-empty"]')).toBeNull());
    const card = document.querySelector('[data-arm="lift-plan-audit"]')!;
    expect(card.textContent).toMatch(/покрытие звеньев 1\/5 \(20%\)/);
    const chips = Array.from(card.querySelectorAll('[data-covered]'));
    expect(chips.length).toBe(5);
    expect(chips.filter((c) => c.getAttribute('data-covered') === 'true').length).toBe(1);
    expect(card.querySelectorAll('[data-worst="true"]').length).toBe(1);
  });
  it('RT 65.25 → 50% и вердикт многоборья', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '65.25' } });
    expect(document.body.textContent).toContain('50%');
    expect(document.body.textContent).toContain('Многоборье');
  });
  it('пустой мост — честный тост, без отправки', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.click(screen.getByText(/В Арм-конструктор/));
    expect(document.body.textContent).toContain('Нечего отправлять');
  });
  it('W5c: кнопки экспорта рендерятся', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect(screen.getByText('🖨 HTML')).toBeTruthy();
    expect(screen.getByText('📥 CSV')).toBeTruthy();
    expect(screen.getByText('🖨 Печать')).toBeTruthy();
  });
  it('W6: сид из арм-хаба при первом входе (своего ключа нет)', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    try {
      localStorage.setItem('he_arm_diagnostics_hub_v4', JSON.stringify({ rtKg: '77', axleKg: '', pinchSec: '', excalKg: '', sex: 'male', bwKg: '90' }));
    } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect((screen.getByLabelText(/RT кг/) as HTMLInputElement).value).toBe('77');
  });
  it('W6: свой ввод приоритетнее сида (свой ключ есть — чужое не затирает)', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    try {
      localStorage.setItem('he_arm_diagnostics_hub_v4', JSON.stringify({ rtKg: '77', sex: 'male', bwKg: '90' }));
      localStorage.setItem('he_armlifting_diag_v1', JSON.stringify({ rtKg: '60', sex: 'male' }));
    } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    expect((screen.getByLabelText(/RT кг/) as HTMLInputElement).value).toBe('60');
  });
  it('превью плана: что встанет (упражнения + волна) после диагноза', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '100' } });
    fireEvent.click(screen.getByText('🔍 Диагностика'));
    fireEvent.click(screen.getByText('Срыв с пола'));
    const prev = document.querySelector('[data-arm="lift-bridge-preview"]');
    expect(prev).toBeTruthy();
    expect(prev!.textContent).toContain('Что встанет в план');
    expect(prev!.textContent).toContain('Волна');
  });
  it('мост с RT — тост про армлифтинг + трек arm', () => {
    try { localStorage.clear(); } catch { /* noop */ }
    render(<ArmliftingDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/RT кг/), { target: { value: '80' } });
    fireEvent.click(screen.getByText(/В Арм-конструктор/));
    expect(document.body.textContent).toContain('армлифтинг');
    expect(localStorage.getItem('he_training_planning_track')).toBe('arm');
  });
});
