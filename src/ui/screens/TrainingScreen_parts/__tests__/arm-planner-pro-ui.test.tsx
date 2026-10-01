/**
 * arm-planner-pro-ui.test.tsx — PRO-PLAN поверхность арм-конструктора:
 * стиль прогрессии, мульти-старты (маркеры недель), база-якорь (LegsCore), CSV.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';

beforeEach(() => {
  localStorage.clear();
});

function openPlanSec() {
  fireEvent.click(screen.getByRole('button', { name: '4 Сплит и цикл' }));
  const head = screen.getAllByRole('button', { name: /Периодизация и старты/ }).find((b) => b.getAttribute('aria-expanded') != null);
  expect(head, 'секция периодизации').toBeTruthy();
  if (head && head.getAttribute('aria-expanded') === 'false') fireEvent.click(head);
}
function openSec(re: RegExp) {
  const head = screen.getAllByRole('button', { name: re }).find((b) => b.getAttribute('aria-expanded') != null);
  expect(head, `секция ${re}`).toBeTruthy();
  if (head && head.getAttribute('aria-expanded') === 'false') fireEvent.click(head);
}
const isoInWeeks = (n: number) => new Date(Date.now() + n * 7 * 86400000).toISOString().slice(0, 10);

describe('Arm PRO-PLAN UI', () => {
  it('секция «Периодизация и старты»: стили прогрессии выбираются', () => {
    render(<ArmAutoConstructor />);
    openPlanSec();
    const chips = document.querySelectorAll('[data-arm="prog-style"] .ad-chip');
    expect(chips.length).toBe(4);
    const dbl = Array.from(chips).find((c) => c.textContent?.includes('Двойная'))!;
    fireEvent.click(dbl);
    expect(dbl.getAttribute('data-active')).toBe('true');
    expect(document.body.textContent).toContain('повторы +1/нед в блоке');
  });

  it('старт добавляется в список и показывает окно тейпера', () => {
    render(<ArmAutoConstructor />);
    openPlanSec();
    fireEvent.change(screen.getByLabelText('Неделя старта'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'A · главный' }));
    fireEvent.click(screen.getByRole('button', { name: '＋ Добавить старт' }));
    const list = document.querySelector('[data-arm="peak-list"]')!;
    expect(list.textContent).toContain('Н6');
    expect(list.textContent).toContain('главный');
    const notes = document.querySelectorAll('[data-arm="peak-note"]');
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].textContent).toContain('🏁');
  });

  it('старт невалидной недели не добавляется', () => {
    render(<ArmAutoConstructor />);
    openPlanSec();
    fireEvent.change(screen.getByLabelText('Неделя старта'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: '＋ Добавить старт' }));
    expect(document.querySelector('[data-arm="peak-list"]')).toBeNull();
  });

  it('P0-3: блоки специализации — добавить блок, выбрать цель, превью расписания', () => {
    const { container } = render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '2 Атлет' }));
    openSec(/Слабые зоны/);
    fireEvent.click(screen.getByRole('switch', { name: /Специализация/ }));
    fireEvent.click(screen.getByRole('button', { name: '＋ Добавить блок специализации' }));
    const block = container.querySelector('[data-arm="spec-block"]');
    expect(block, 'блок специализации').not.toBeNull();
    const targetsRow = block!.querySelectorAll('.ad-chips')[0] as HTMLElement;
    const chip = within(targetsRow).getByText('Пронаторы');
    fireEvent.click(chip);
    expect(chip.getAttribute('data-active')).toBe('true');
    const prev = container.querySelector('[data-arm="spec-preview"]');
    expect(prev?.textContent).toContain('нед 1-');
    expect(prev?.textContent).toContain('pronators');
  });

  it('P0-4: авто-пик из даты старта (кнопка → старт в списке)', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '2 Атлет' }));
    openSec(/PRO: старт WAF/);
    fireEvent.change(screen.getByLabelText(/Дата старта/), { target: { value: isoInWeeks(5) } });
    fireEvent.click(screen.getByRole('button', { name: '4 Сплит и цикл' }));
    openPlanSec();
    const btn = document.querySelector('[data-arm="auto-peak"]') as HTMLElement;
    expect(btn, 'кнопка авто-пика').not.toBeNull();
    expect(btn.textContent).toContain('Н5'); // старт через 5 нед → неделя 5 плана
    fireEvent.click(btn);
    const list = document.querySelector('[data-arm="peak-list"]');
    expect(list?.textContent).toContain('Н5');
  });

  it('P0-1/P0-2: после сборки — разминка в плане и карточка «План vs факт»', () => {
    const { container } = render(<ArmAutoConstructor />);
    // вес базы → тяжёлые упражнения получают вес и разминку
    fireEvent.click(screen.getByRole('button', { name: '2 Атлет' }));
    openSec(/Рабочие максимумы/);
    fireEvent.change(screen.getByLabelText(/База \(кг\)/), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: '4 Сплит и цикл' }));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    expect(container.querySelector('[data-arm="ex-warmup"]'), 'строка разминки').not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '6 Веса и качество' }));
    expect(container.querySelector('[data-arm="plan-fact-card"]'), 'карточка план↔факт').not.toBeNull();
    expect(container.querySelector('[data-arm="export-csv"]')).toBeNull(); // CSV — на шаге экспорта
  });

  it('P1/P2: тумблеры ротации, drop-set и строгой частоты', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '4 Сплит и цикл' }));
    expect(screen.getByRole('switch', { name: /Только точная частота/ })).toBeTruthy();
    openPlanSec();
    const rot = screen.getByRole('switch', { name: /Ротация упражнений/ });
    fireEvent.click(rot);
    expect(rot.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: /Drop-set/ })).toBeTruthy();
  });

  it('P1-10: чек-ин недели сохраняется и показывается', () => {
    const { container } = render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '4 Сплит и цикл' }));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    fireEvent.click(screen.getByRole('button', { name: '6 Веса и качество' }));
    openSec(/Чек-ин недели/);
    fireEvent.change(screen.getByLabelText('Чек-ин боль'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Чек-ин вес'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить чек-ин недели/ }));
    const rows = container.querySelector('[data-arm="checkin-rows"]');
    expect(rows?.textContent).toContain('боль 5');
    expect(String(localStorage.getItem('he_arm_checkins_v1'))).toContain('elbowPain010');
  });

  it('PRO-PLAN: настройки контура (ротация) восстанавливаются из варианта', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '4 Сплит и цикл' }));
    openPlanSec();
    fireEvent.click(screen.getByRole('switch', { name: /Ротация упражнений/ }));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
    openSec(/Варианты плана/);
    fireEvent.change(screen.getByLabelText('Название варианта'), { target: { value: 'ПРО-вариант' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить вариант/ }));
    // выключаем ротацию и загружаем вариант — настройка должна вернуться
    fireEvent.click(screen.getByRole('button', { name: '4 Сплит и цикл' }));
    const rot = screen.getByRole('switch', { name: /Ротация упражнений/ });
    fireEvent.click(rot);
    expect(rot.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
    fireEvent.click(screen.getByRole('button', { name: /Загрузить ПРО-вариант/ }));
    fireEvent.click(screen.getByRole('button', { name: '4 Сплит и цикл' }));
    openPlanSec();
    expect(screen.getByRole('switch', { name: /Ротация упражнений/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('паритет: карточка аудита 12 точек + добивка худшей точки', () => {
    const { container } = render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '4 Сплит и цикл' }));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    fireEvent.click(screen.getByRole('button', { name: '6 Веса и качество' }));
    expect(container.querySelector('[data-arm="plan-audit-card"]')).not.toBeNull();
    expect(container.querySelector('[data-arm="plan-audit-cover"]')?.textContent).toMatch(/Покрытие:/);
    const points = container.querySelectorAll('[data-arm="plan-audit-points"] [data-covered]');
    expect(points.length).toBe(12);
    const btn = container.querySelector('[data-arm="plan-audit-worst"]') as HTMLElement | null;
    if (btn) {
      fireEvent.click(btn);
      expect(document.body.textContent).toContain('Добито');
    }
  });

  it('план с стартом и якорем: маркер недели, LegsCore, CSV-кнопка', () => {
    const { container } = render(<ArmAutoConstructor />);
    // недели 10 → окно старта Н6 целиком внутри плана
    fireEvent.click(screen.getByRole('button', { name: '1 Параметры' }));
    fireEvent.change(screen.getByLabelText('Недель'), { target: { value: '10' } });
    openPlanSec();
    fireEvent.change(screen.getByLabelText('Неделя старта'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'A · главный' }));
    fireEvent.click(screen.getByRole('button', { name: '＋ Добавить старт' }));
    fireEvent.click(screen.getByRole('switch', { name: /База-якорь/ }));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    // план: неделя 1 с якорем
    expect(document.body.textContent).toContain('LegsCore');
    // маркер старта на пилюле недели 6
    const pill6 = container.querySelector('button[aria-label*="старт A"]');
    expect(pill6, 'пилюля старта').not.toBeNull();
    fireEvent.click(pill6!);
    const peakNote = container.querySelector('[data-arm="week-peak"]');
    expect(peakNote?.textContent).toContain('Старт (A)');
    // CSV-кнопка в экспорте
    fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
    const csv = container.querySelector('[data-arm="export-csv"]');
    expect(csv, 'CSV-кнопка').not.toBeNull();
    expect((csv as HTMLButtonElement).disabled).toBe(false);
  });
});
