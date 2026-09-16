import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WLDiagnosticsHub } from '../WLDiagnosticsHub';

const KEY = 'he_wl_diagnostics_hub_v1';
const HIST = 'he_ta_phase_hist_v1';

beforeEach(() => {
  localStorage.clear();
});

function seed(patch: Record<string, unknown>) {
  localStorage.setItem(KEY, JSON.stringify(patch));
}

describe('ta v5 UI', () => {
  it('turnover: ввод мс + сед даёт ноту ухода', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.change(screen.getByPlaceholderText('420'), { target: { value: '600' } });
    fireEvent.change(screen.getByPlaceholderText('75'), { target: { value: '120' } });
    const note = container.querySelector('[data-wl="turnover-note"]');
    expect(note?.textContent).toMatch(/медленный/);
  });
  it('turnover через сид: перетягиваешь + баланс тяг', () => {
    seed({ yMaxCm: '135', turnoverMs: '600', catchKneeDeg: '120', pullPowerW: '2000', progBw: '80' });
    const { container } = render(<WLDiagnosticsHub />);
    expect(container.querySelector('[data-wl="turnover-note"]')?.textContent).toMatch(/перетягиваешь/);
    expect(container.querySelector('[data-wl="pull-balance"]')?.textContent).toMatch(/садись быстрее/);
  });
  it('толчок: увод назад + быстрый dip → drive-нота Nagao', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🦾 Толчок' }));
    fireEvent.change(screen.getByPlaceholderText('5'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Быстрое сгибание коленей в dip' }));
    expect(container.querySelector('[data-wl="jerk-drive-note"]')?.textContent).toMatch(/Nagao/);
  });
  it('LVP присед лёгкий → баллистик-нота', () => {
    seed({ lvpLift: 'squat', lvp50: '2.0', lvp65: '1.8', lvp75: '1.5', lvp90: '1.3' });
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '⚡ VBT/FvR' }));
    expect(container.querySelector('[data-wl="lvp-ballistic"]')?.textContent).toMatch(/тормозной фазой/);
  });
  it('возраст + re-screen фаз в Summary', () => {    seed({ progAge: '45' });
    localStorage.setItem(HIST, JSON.stringify([
      { date: '2026-09-01', weakPoints: ['snatch_mid', 'jerk_dip'] },
      { date: '2026-09-10', weakPoints: ['jerk_dip'] },
    ]));
    const { container } = render(<WLDiagnosticsHub />);
    expect(container.querySelector('[data-wl="age-scale"]')?.textContent).toMatch(/Q-masters/);
    expect(container.querySelector('[data-wl="phase-trend"]')?.textContent).toMatch(/ушло: snatch_mid/);
  });
  it('П1: возраст подтягивается из профиля разово', () => {
    localStorage.setItem('he_profile_v2', JSON.stringify({ personal: { age: 52 } }));
    const { container } = render(<WLDiagnosticsHub />);
    expect(container.querySelector('[data-wl="age-scale"]')?.textContent).toMatch(/Q-masters/);
    expect((container.querySelector('[data-wl="prog-age"]') as HTMLInputElement)?.value).toBe('52');
  });
  it('П2: Kinovea-разбор сам ставит turnoverMs (ручной приоритетнее)', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '📹 Видео' }));
    const lines = ['time,x,y'];
    for (let i = 0; i < 10; i++) lines.push(`${(i / 30).toFixed(3)},0,${i * 10}`);
    for (let i = 1; i <= 8; i++) lines.push(`${((9 + i) / 30).toFixed(3)},0,${90 - i * 7}`);
    fireEvent.change(container.querySelector('textarea')!, { target: { value: lines.join('\n') } });
    fireEvent.click(screen.getByRole('button', { name: '📊 Разобрать Kinovea CSV' }));
    expect(container.textContent).toMatch(/turnover \d+мс/);
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    expect(container.querySelector('[data-wl="turnover-note"]')?.textContent).toMatch(/уход \d+мс/);
  });
  it('П3: снимки мощности дают тренд Вт', () => {
    localStorage.setItem('he_ta_pullpower_hist_v1', JSON.stringify([
      { date: '2026-09-01', watts: 1800 },
      { date: '2026-09-10', watts: 1950 },
    ]));
    const { container } = render(<WLDiagnosticsHub />);
    expect(container.querySelector('[data-wl="power-trend"]')?.textContent).toMatch(/\+150Вт/);
  });
  it('П4: мастерам считается Q-masters числом', () => {
    seed({ progAge: '45', progBw: '80', progSnatch: '100', progCj: '125' });
    const { container } = render(<WLDiagnosticsHub />);
    expect(container.textContent).toMatch(/Q-masters \d+\.\d+/);
  });
  it('волна рывок+взятие → анти-смешивание в Коррекции', () => {
    seed({ snatchWeak: ['snatch_mid'], cleanWeak: ['clean_mid'] });
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
    expect(container.querySelector('[data-wl="wave-mix"]')?.textContent).toMatch(/разноси по дням/);
    expect(container.querySelector('[data-wl="corrective"]')?.textContent).toMatch(/\[Рывок\]|\[Взятие\]/);
  });
});
