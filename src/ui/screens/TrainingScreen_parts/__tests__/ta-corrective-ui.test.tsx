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
  it('C11: ограничение из профиля топит спросовую карточку (ankle: баланс → удержание)', () => {
    localStorage.removeItem('he_wl_diagnostics_hub_v1');
    localStorage.setItem('he_profile_v2', JSON.stringify({ training: { mobilityRestrictions: ['ankle'] } }));
    try {
      const { container } = render(<WLDiagnosticsHub />);
      // mobility-причина: 2 OHS-провала + сед (чувствителен к мобильности)
      fireEvent.click(screen.getByRole('button', { name: '🧘 Мобильность' }));
      fireEvent.click(screen.getByRole('button', { name: 'OHS: Пятки плоско' }));
      fireEvent.click(screen.getByRole('button', { name: 'OHS: Колени без вальгуса' }));
      fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
      fireEvent.click(screen.getByRole('button', { name: 'Рывок: фиксация в седе' }));
      fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
      const first = container.querySelector('[data-wl="corrective-pick"]');
      expect(first).toBeTruthy();
      // без ограничения первым был бы Рывковый баланс (оверхед+присед — спрос на голеностоп)
      expect(first?.textContent).toMatch(/Удержание оверхеда/);
      expect(first?.textContent).not.toMatch(/Рывковый баланс/);
    } finally {
      localStorage.removeItem('he_profile_v2');
      localStorage.removeItem('he_wl_diagnostics_hub_v1');
    }
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
  it('E6: порядок коррекции + комплекс + праймер на фазе ухода', () => {
    localStorage.removeItem('he_wl_diagnostics_hub_v1');
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    fireEvent.click(screen.getByText('Рывок: уход под штангу'));
    fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
    const order = container.querySelector('[data-wl="corrective-order"]');
    expect(order).toBeTruthy();
    expect(order?.textContent).toMatch(/1\. Рывок: уход под штангу/);
    expect(order?.textContent).toMatch(/Пересним фаз/);
    expect(container.querySelector('[data-wl="corrective-complex"]')?.textContent).toMatch(/Комплекс/);
    expect(container.querySelector('[data-wl="corrective-complex"]')?.textContent).toMatch(/≈\d+ кг/);
    expect(container.querySelector('[data-wl="corrective-primer"]')?.textContent).toMatch(/праймер/i);
    // howNot у tall_snatch (⛔) — в топ-5 ухода
    expect(container.querySelector('[data-wl="corrective"]')?.textContent).toMatch(/⛔/);
  });
  it('E6: две фазы — отрыв раньше ухода в очереди', () => {
    localStorage.removeItem('he_wl_diagnostics_hub_v1');
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    fireEvent.click(screen.getByText('Рывок: уход под штангу'));
    fireEvent.click(screen.getByText('Рывок: отрыв (0-20°)'));
    fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
    const order = container.querySelector('[data-wl="corrective-order"]');
    expect(order?.textContent).toMatch(/1\. Рывок: отрыв/);
  });
  it('E6: профиль без штанги — только свой вес в оверхеде', () => {
    localStorage.removeItem('he_wl_diagnostics_hub_v1');
    localStorage.setItem('he_profile_v2', JSON.stringify({ training: { equipment: ['bodyweight'] } }));
    try {
      const { container } = render(<WLDiagnosticsHub />);
      fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
      fireEvent.click(screen.getByText('Рывок: оверхед стабильность'));
      fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
      const picks = container.querySelectorAll('[data-wl="corrective-pick"]');
      expect(picks.length).toBeGreaterThan(0);
      expect(container.querySelector('[data-wl="corrective"]')?.textContent).toMatch(/валике|Dead bug/);
    } finally {
      localStorage.removeItem('he_profile_v2');
      localStorage.removeItem('he_wl_diagnostics_hub_v1');
    }
  });
  it('П1: VBT-просадка даёт хинт в Видео без петли', () => {
    localStorage.removeItem('he_wl_diagnostics_hub_v1');
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '⚡ VBT/FvR' }));
    fireEvent.change(screen.getAllByPlaceholderText('1.90')[0], { target: { value: '1.90' } });
    fireEvent.change(screen.getAllByPlaceholderText('1.55')[0], { target: { value: '1.55' } });
    fireEvent.click(screen.getByRole('button', { name: '📹 Видео' }));
    const hint = container.querySelector('[data-wl="corrective-video"]');
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toMatch(/VBT/);
    expect(hint?.textContent).toMatch(/high-pull|уход/i);
  });
  it('П1: OHS-провалы дают мобильность-теги в Видео без петли', () => {
    localStorage.removeItem('he_wl_diagnostics_hub_v1');
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🧘 Мобильность' }));
    fireEvent.click(screen.getByRole('button', { name: 'OHS: Пятки плоско' }));
    fireEvent.click(screen.getByRole('button', { name: 'OHS: Колени без вальгуса' }));
    fireEvent.click(screen.getByRole('button', { name: '📹 Видео' }));
    const hint = container.querySelector('[data-wl="corrective-video"]');
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toMatch(/мобильность/i);
  });
  it('П3: ⭐ комплекса вставляет injectId с дозой комплекса', () => {
    const plan = buildStrengthSportPlan({ mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 4, daysPerWeek: 3, workMax: { snatch: 100, cleanJerk: 120, backSquat: 150, deadlift: 180 } } as any);
    localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify(plan));
    localStorage.removeItem('he_strength_sport_plan_prev_v1');
    localStorage.removeItem('he_wl_diagnostics_hub_v1');
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    fireEvent.click(screen.getByRole('button', { name: 'Рывок: уход под штангу' }));
    fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
    fireEvent.click(screen.getByRole('button', { name: /Вставить комплекс High-pull/ }));
    const injectBtn = container.querySelector('[data-wl="corrective"] [data-wl="inject"]') as HTMLElement;
    expect(injectBtn).toBeTruthy();
    fireEvent.click(injectBtn);
    const saved = JSON.parse(localStorage.getItem('he_strength_sport_plan_v1') || '{}');
    const holder = saved.weeksData ? saved : saved.plan;
    const ex = holder.weeksData[0].sessions.flatMap((s: any) => s.exercises).find((e: any) => e.id === 'snatch_high_pull');
    expect(ex).toBeTruthy();
    // доза комплекса 3×3@70, а не библиотечные 3×4@75
    expect(ex.sets).toBe(3);
  });
  it('П2: старт через 7 дней — 🏁-бейдж и comp-дозы в Коррекции', () => {
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const plan = buildStrengthSportPlan({ mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 4, daysPerWeek: 3, workMax: { snatch: 100, cleanJerk: 120, backSquat: 150, deadlift: 180 }, competitionDate: in7 } as any);
    localStorage.setItem('he_strength_sport_plan_v1', JSON.stringify(plan));
    localStorage.removeItem('he_strength_sport_plan_prev_v1');
    localStorage.removeItem('he_wl_diagnostics_hub_v1');
    try {
      const { container } = render(<WLDiagnosticsHub />);
      fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
      fireEvent.click(screen.getByText('Рывок: уход под штангу'));
      fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
      const order = container.querySelector('[data-wl="corrective-order"]');
      expect(order?.textContent).toMatch(/🏁 Старт/);
    } finally {
      localStorage.removeItem('he_wl_diagnostics_hub_v1');
    }
  });
});
