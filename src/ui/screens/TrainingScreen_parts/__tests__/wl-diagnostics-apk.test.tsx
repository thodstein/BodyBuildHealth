import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { WLDiagnosticsHub } from '../WLDiagnosticsHub';

beforeEach(() => { localStorage.clear(); });

describe('WLDiagnosticsHub APK UI', () => {
  it('галочек нет — только кнопки-карточки (OHS 6 + dip)', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    fireEvent.click(screen.getAllByText(/Мобильность/)[0]);
    const ohs = container.querySelectorAll('[data-wl="ohs-card"]');
    expect(ohs.length).toBe(6);
    expect(ohs[0].getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(ohs[0]);
    expect(ohs[0].getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getAllByText(/Взятие/)[0]);
    expect(container.querySelector('[data-wl="imtp-dip"]')).toBeTruthy();
  });
  it('селектов нет — попапы PopupSelect (Движение/Отклонение/Лифт)', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    expect(container.querySelector('select')).toBeNull();
    // два попап-триггера на табе рывка + один на VBT
    expect(container.querySelectorAll('.pl-popupselect').length).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: /VBT\/FvR/ }));
    expect(container.querySelectorAll('.pl-popupselect').length).toBe(1);
    // попап открывается, выбор применяется в состояние
    fireEvent.click(container.querySelector('.pl-popupselect')!);
    const opts = await screen.findAllByText('Толчок');
    fireEvent.click(opts[opts.length - 1]);
    expect(JSON.parse(localStorage.getItem('he_wl_diagnostics_hub_v1') || '{}').lvpLift).toBe('clean');
  });
  it('W5 доминантность + OHS риск-рамка + заметки в экспорте', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /VBT\/FvR/ }));
    expect(container.textContent).toContain('force-доминантно');
    fireEvent.click(screen.getAllByText(/Мобильность/)[0]);
    expect(container.textContent).toContain('Скрининг, не диагноз');
    expect(container.querySelector('[data-wl="ohs-risk"]')).toBeNull();
    fireEvent.click(container.querySelectorAll('[data-wl="ohs-card"]')[0]);
    expect(container.querySelector('[data-wl="ohs-risk"]')).toBeTruthy();
    const { buildWLCsv, buildWLDiagnosticsHtml } = await import('../../../../engines/strength-sport/strength-sport-wl-export.engine');
    const snap: any = { weakPoints: [], score: 100, level: 'ok', verification: 0.3, findings: [], notes: ['Взятие — force-доминантно (Arauz 2025)'] };
    expect(buildWLDiagnosticsHtml(snap)).toContain('Заметки');
    expect(buildWLCsv(snap)).toContain('notes');
  });
  it('кнопки 44px+: табы, слабые фазы, выдача', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    const tabs = container.querySelectorAll('[data-wl="tab"]');
    expect(tabs.length).toBe(7);
    tabs.forEach(b => {
      const h = (b as HTMLElement).style.minHeight;
      expect(parseInt(h, 10)).toBeGreaterThanOrEqual(44);
    });
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(await screen.findByText(/Рывок: отрыв/));
    const weak = container.querySelector('[data-wl="weak"]') as HTMLElement;
    expect(parseInt(weak.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    for (const hook of ['apply', 'apply-bottom', 'export-html', 'print', 'export-csv']) {
      const el = container.querySelector(`[data-wl="${hook}"]`) as HTMLElement;
      expect(el).toBeTruthy();
      expect(parseInt(el.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    }
  });
  it('инпуты 16px/44px — без iOS-зума, серого текста нет', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    // открываем слабую фазу — появляется спец-блок с недельными инпутами
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(await screen.findByText(/Рывок: отрыв/));
    const inputs = Array.from(container.querySelectorAll('input')) as HTMLElement[];
    expect(inputs.length).toBeGreaterThan(5);
    inputs.forEach(i => {
      expect(parseInt(i.style.fontSize, 10)).toBeGreaterThanOrEqual(16);
      expect(parseInt(i.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    });
    // ни одного inline color: DIM / var(--text-dim) в хабе
    const html = container.innerHTML;
    expect(html).not.toContain('var(--text-dim');
  });
  it('вертикали нет — сетки auto-fit, LVP-ряд 80px убит', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    const html = container.innerHTML;
    expect(html).not.toContain('80px 1fr');
    expect(html).not.toContain('1fr 1fr 1fr');
    expect(html).toContain('auto-fit');
  });
  it('W3 barbell-гейт: подписи «штанга» + флаг system-скорости', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /VBT\/FvR/ }));
    expect(container.textContent).toContain('м/с (штанга)');
    fireEvent.change(container.querySelector('input[placeholder="1.75"]')!, { target: { value: '3.5' } });
    await screen.findByText(/Похоже на system-скорость/);
    expect(container.querySelector('[data-wl="vel-guard"]')).toBeTruthy();
  });
  it('W5 доминантность + OHS риск-рамка + заметки в экспорте', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /VBT\/FvR/ }));
    expect(container.textContent).toContain('force-доминантно');
    fireEvent.click(screen.getAllByText(/Мобильность/)[0]);
    expect(container.textContent).toContain('Скрининг, не диагноз');
    expect(container.querySelector('[data-wl="ohs-risk"]')).toBeNull();
    fireEvent.click(container.querySelectorAll('[data-wl="ohs-card"]')[0]);
    expect(container.querySelector('[data-wl="ohs-risk"]')).toBeTruthy();
    const { buildWLCsv, buildWLDiagnosticsHtml } = await import('../../../../engines/strength-sport/strength-sport-wl-export.engine');
    const snap: any = { weakPoints: [], score: 100, level: 'ok', verification: 0.3, findings: [], notes: ['Взятие — force-доминантно (Arauz 2025)'] };
    expect(buildWLDiagnosticsHtml(snap)).toContain('Заметки');
    expect(buildWLCsv(snap)).toContain('notes');
  });
  it('W4 съёмка: метаданные → флаг, rough → ≈', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /Видео/ }));
    expect(container.querySelector('[data-wl="video-quality"]')?.textContent).toContain('Нет метаданных');
    fireEvent.change(container.querySelector('input[placeholder="1.2"]')!, { target: { value: '1.2' } });
    fireEvent.change(container.querySelector('input[placeholder="4"]')!, { target: { value: '4' } });
    fireEvent.click(screen.getByText('Сбоку ←'));
    await screen.findByText(/Геометрия съёмки в допуске/);
    fireEvent.click(screen.getByText('Спереди'));
    await screen.findByText(/Вид спереди/);
    expect(JSON.parse(localStorage.getItem('he_wl_diagnostics_hub_v1') || '{}').videoSide).toBe('front');
  });
  it('W7 кросс-чек: заявка вне RMSE → флаг расхождения', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: /VBT\/FvR/ }));
    const fill = (ph: string, v: string) => fireEvent.change(container.querySelector(`input[placeholder="${ph}"]`)!, { target: { value: v } });
    fill('80', '80'); fill('1.95', '1.95'); fill('0.8', '0.8'); fill('110', '110'); fill('1.45', '1.45'); fill('1.85', '1.85');
    await screen.findByText(/SnatchTh/);
    fireEvent.change(container.querySelector('[data-wl="attempt-sn"]')!, { target: { value: '200' } });
    await screen.findByText(/Заявка выше модели/);
    expect(container.querySelector('[data-wl="base-div"]')).toBeTruthy();
  });
  it('W8 голеностоп L/R: градусы + флаг асимметрии + персист', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Мобильность/)[0]);
    expect(container.querySelector('[data-wl="ktw"]')).toBeNull();
    fireEvent.change(container.querySelector('[data-wl="ktw-l"]')!, { target: { value: '8' } });
    fireEvent.change(container.querySelector('[data-wl="ktw-r"]')!, { target: { value: '13' } });
    await screen.findByText(/асимметрия 5см/);
    expect(container.textContent).toContain('≈28.8°');
    expect(container.textContent).toContain('≈46.8°');
    const stored = JSON.parse(localStorage.getItem('he_wl_diagnostics_hub_v1') || '{}');
    expect(stored.kneeToWallL).toBe('8');
    expect(stored.kneeToWallR).toBe('13');
    expect(stored.kneeToWallCm).toBeUndefined();
  });
  it('W9 пофазная тяга: ISPP<85% → first + открыть фазу', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Взятие/)[0]);
    fireEvent.change(container.querySelector('input[placeholder="250"]')!, { target: { value: '250' } });
    fireEvent.change(container.querySelector('input[placeholder="220"]')!, { target: { value: '200' } });
    await screen.findByText(/Первая тяга — изометрия/);
    expect(container.querySelector('[data-wl="pull-phase"]')).toBeTruthy();
    fireEvent.click(screen.getByText(/Открыть фазу на разбор/));
    await waitFor(() => expect(container.textContent).toContain('числовые углы + биомеханика'));
    expect(container.textContent).toContain('deficit_snatch');
  });
  it('W6 стрип покрытия + APK-шапка печати', async () => {
    const first = render(<WLDiagnosticsHub />);
    expect(first.container.querySelector('[data-wl="coverage"]')).toBeNull();
    first.unmount();
    localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify({
      id: 't', mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 1, patternId: 'x',
      weeksData: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, week: 1, sessionTag: 'snatch_day', character: 'тяж', exercises: [{ id: 'deficit_snatch', name: 'Рывок с дефицита', group: 'legs', pattern: 'hinge', role: 'primary', character: 'тяж', sets: 3, reps: '3', rir: 2, weight: 60, workSets: [{ reps: 3, rir: 2, weight: 60 }], warmupSets: [] }] }] },
      ],
      workMax: {}, rationale: [],
    }));
    const { container } = render(<WLDiagnosticsHub />);
    await waitFor(() => expect(container.querySelector('[data-wl="coverage"]')).toBeTruthy());
    const { buildWLDiagnosticsHtml } = await import('../../../../engines/strength-sport/strength-sport-wl-export.engine');
    const snap: any = { weakPoints: [], score: 88, level: 'warn', verification: 0.3, findings: [] };
    expect(buildWLDiagnosticsHtml(snap)).not.toContain('ТА-хаб PRO (APK)');
    const apk = buildWLDiagnosticsHtml(snap, { apkHeader: true });
    expect(apk).toContain('ТА-хаб PRO (APK)');
    expect(apk).toContain('Score 88');
  });
});
