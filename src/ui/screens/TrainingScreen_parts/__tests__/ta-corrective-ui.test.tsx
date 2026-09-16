import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WLDiagnosticsHub } from '../WLDiagnosticsHub';
import { buildStrengthSportPlan } from '../../../../engines/strength-sport/strength-sport-builder.engine';

describe('ta corrective tab UI', () => {
  it('таб Коррекция есть и просит выбрать фазы', () => {
    render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
    expect(screen.getByText(/Коррекция движений — структурировано/)).toBeTruthy();
  });
  it('выбор фазы + таб Коррекция показывает упражнения с дозами и ⭐', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    fireEvent.click(screen.getByText('Рывок: уход под штангу'));
    fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
    const picks = container.querySelectorAll('[data-wl="corrective-pick"]');
    expect(picks.length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector('[data-wl="corrective"]')?.textContent).toMatch(/@/);
  });
  it('замер петли в Видео даёт хинт с упражнениями и переходом', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    fireEvent.change(screen.getByPlaceholderText('xLoop см'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: '📹 Видео' }));
    const hint = container.querySelector('[data-wl="corrective-video"]');
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toMatch(/Рывковая тяга|рывок с дефицита/i);
    fireEvent.click(screen.getByRole('button', { name: /Открыть Коррекцию/ }));
    expect(container.querySelector('[data-wl="corrective"]')).toBeTruthy();
  });
  it('C9: петля в табе Рывок даёт хинт на месте (без похода в Видео)', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    fireEvent.change(screen.getByPlaceholderText('xLoop см'), { target: { value: '8' } });
    const hint = container.querySelector('[data-wl="corrective-snatch"]');
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toMatch(/Гриф уходит вперёд/);
    fireEvent.click(hint?.querySelector('button') as HTMLElement);
    expect(container.querySelector('[data-wl="corrective"]')).toBeTruthy();
  });
  it('петля ≤4 — хинта нет (молчим на шум)', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    fireEvent.change(screen.getByPlaceholderText('xLoop см'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '📹 Видео' }));
    expect(container.querySelector('[data-wl="corrective-video"]')).toBeNull();
  });
  it('мобильность-причина даёт хинт в Мобильности с переходом', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🧘 Мобильность' }));
    fireEvent.click(screen.getByRole('button', { name: 'OHS: Пятки плоско' }));
    fireEvent.click(screen.getByRole('button', { name: 'OHS: Колени без вальгуса' }));
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    fireEvent.click(screen.getByText('Рывок: фиксация в седе'));
    fireEvent.click(screen.getByRole('button', { name: '🧘 Мобильность' }));
    const hint = container.querySelector('[data-wl="corrective-mobility"]');
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toMatch(/щадящие дозы/);
    fireEvent.click(hint?.querySelector('button') as HTMLElement);
    expect(container.querySelector('[data-wl="corrective"]')).toBeTruthy();
  });
  it('асимметрия ножниц ≥7% даёт split-хинт с переходом', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🧘 Мобильность' }));
    fireEvent.change(screen.getByPlaceholderText('95 нож'), { target: { value: '90' } });
    fireEvent.change(screen.getByPlaceholderText('100 нож'), { target: { value: '100' } });
    const hint = container.querySelector('[data-wl="corrective-split"]');
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toMatch(/Толчковый баланс|толчок в ножницы/i);
    fireEvent.click(hint?.querySelector('button') as HTMLElement);
    expect(container.querySelector('[data-wl="corrective"]')).toBeTruthy();
  });
  it('ножницы в норме — split-хинта нет', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🧘 Мобильность' }));
    fireEvent.change(screen.getByPlaceholderText('95 нож'), { target: { value: '99' } });
    fireEvent.change(screen.getByPlaceholderText('100 нож'), { target: { value: '100' } });
    expect(container.querySelector('[data-wl="corrective-split"]')).toBeNull();
  });
  it('C8 E2E: ⭐ tall_snatch → в плане tall_snatch (не подмена legacy)', () => {
    const plan = buildStrengthSportPlan({ mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 4, daysPerWeek: 3, workMax: { snatch: 100, cleanJerk: 120, backSquat: 150, deadlift: 180 } } as any);
    localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify(plan));
    localStorage.removeItem('he_strength_sport_plan_prev_v1');
    localStorage.removeItem('he_wl_diagnostics_hub_v1');
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    fireEvent.click(screen.getByRole('button', { name: 'Рывок: уход под штангу' }));
    fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
    fireEvent.click(screen.getByRole('button', { name: /Выбрать Высокий рывок/ }));
    const injectBtn = container.querySelector('[data-wl="corrective"] [data-wl="inject"]') as HTMLElement;
    expect(injectBtn).toBeTruthy();
    fireEvent.click(injectBtn);
    const saved = JSON.parse(localStorage.getItem('he_strength_sport_plan_v1') || '{}');
    const holder = saved.weeksData ? saved : saved.plan;
    const ex = holder.weeksData[0].sessions.flatMap((s: any) => s.exercises).find((e: any) => e.id === 'tall_snatch');
    expect(ex).toBeTruthy();
    expect(ex.name).toMatch(/Высокий/);
  });
  it('клик ⭐ ставит preferred и показывает сессию + вставку', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🦾 Толчок' }));
    fireEvent.click(screen.getByText('Толчок: подсед'));
    fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
    const star = container.querySelector('[data-wl="corrective-pick"] button') as HTMLElement;
    expect(star).toBeTruthy();
    fireEvent.click(star);
    expect(container.querySelector('[data-wl="corrective"]')?.textContent).toMatch(/Коррекционная сессия/);
    expect(container.querySelector('[data-wl="inject"]')).toBeTruthy();
  });
});
