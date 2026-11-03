/**
 * BB-G-08 · «Что делать дальше» в шапке хаба: карточка из данных + рабочий переход.
 *
 * Локи:
 *  - на пустом хабе карточка есть (это и есть ответ «с чего начать»), и в ней
 *    не больше двух шагов;
 *  - шаг ведёт ровно туда, что написано: `screen` → событие `training-open-tab`
 *    (белый список TrainingScreen), `tab` → переключение вкладки внутри хаба;
 *  - текст шага не дублирует табы (иначе на экране два одинаковых «Скрининга»).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';

const card = (): Element | null => document.querySelector('[data-bb="next-actions"]');
const rows = (): Element[] => Array.from(document.querySelectorAll('[data-bb="next-action"]'));

describe('BB-G-08 · что делать дальше', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('пустой хаб: карточка из 1–2 шагов, а не пустое место', () => {
    render(<BBDiagnosticsHub />);
    const el = card();
    expect(el).not.toBeNull();
    const list = rows();
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(2);
    // шаги пронумерованы порядком приоритета
    expect(list[0].getAttribute('data-action')).toBe('data');
    // без данных совет «снять подходы» не появляется
    expect(list.some((r) => r.getAttribute('data-action') === 'mrv')).toBe(false);
  });

  it('у шага есть место: deep-link уходит событием training-open-tab', () => {
    // Боль ≥4/10 — ограничитель с внешним адресом (Ортопедия).
    localStorage.setItem('he_bb_diagnostics_hub_v1', JSON.stringify({ pmDuring: '6' }));
    render(<BBDiagnosticsHub />);
    const btn = rows().find((r) => r.getAttribute('data-target-type') === 'screen');
    expect(btn).toBeTruthy();
    const target = btn!.getAttribute('data-target')!;
    const spy = vi.fn();
    window.addEventListener('training-open-tab', spy as EventListener);
    fireEvent.click(btn!);
    window.removeEventListener('training-open-tab', spy as EventListener);
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as CustomEvent).detail).toBe(target);
  });

  it('шаг без места (собрать план) — не кнопка: он не подменяет кнопку ББ-авто', () => {
    render(<BBDiagnosticsHub />);
    const plan = rows().find((r) => r.getAttribute('data-action') === 'plan');
    if (!plan) return; // план есть в сторе — шага нет, это тоже корректно
    expect(plan.tagName).not.toBe('BUTTON');
    expect(plan.getAttribute('data-target')).toBeNull();
  });

  it('внутренний шаг переключает вкладку хаба, а не уводит из экрана', () => {
    render(<BBDiagnosticsHub />);
    const tabStep = rows().find((r) => r.getAttribute('data-target-type') === 'tab');
    expect(tabStep).toBeTruthy();
    const target = tabStep!.getAttribute('data-target')!;
    const spy = vi.fn();
    window.addEventListener('training-open-tab', spy as EventListener);
    fireEvent.click(tabStep!);
    window.removeEventListener('training-open-tab', spy as EventListener);
    // deep-link-событие не отправлено — остались внутри хаба
    expect(spy).not.toHaveBeenCalled();
    const active = document.querySelector(`[data-bb="tab"][data-active="1"]`);
    expect(active).not.toBeNull();
    expect(screen.getAllByText(/Что делать дальше/)[0]).toBeInTheDocument();
    // вкладка действительно доступна (id из белого списка вкладок хаба)
    expect(['weak', 'screening', 'exercise', 'stimulus', 'symmetry', 'volume']).toContain(target);
  });

  it('названия шагов не дублируют табы (иначе getByRole-запросы и SR путаются)', () => {
    render(<BBDiagnosticsHub />);
    for (const r of rows()) {
      const name = (r.getAttribute('aria-label') || r.textContent || '').trim();
      // «Скрининг»/«Разбор»/«Стимул-карта» — это табы; шаг может быть про скрининг,
      // но не с заголовочным написанием таба.
      expect(name.startsWith('Скрининг')).toBe(false);
      expect(name.startsWith('Разбор')).toBe(false);
      expect(name.startsWith('Стимул-карта')).toBe(false);
    }
  });
});
