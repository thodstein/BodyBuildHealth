/**
 * arm-plan-variants.test.tsx — №2 сохранённые варианты арм-планов.
 *
 * Сохранить текущий (с правками) → список → загрузить → удалить; кап 10;
 * битый стор не роняет загрузку.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor, loadArmVariants, saveArmVariants, compareArmVariants } from '../ArmAutoConstructor';

beforeEach(() => {
  localStorage.clear();
});

function build() {
  render(<ArmAutoConstructor />);
  fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
  fireEvent.click(screen.getByText('⚡ Собрать план'));
  fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
}

describe('Arm plan variants', () => {
  it('load/save roundtrip + битый стор', () => {
    expect(loadArmVariants()).toEqual([]);
    localStorage.setItem('he_arm_plan_variants', 'not-json');
    expect(loadArmVariants()).toEqual([]);
    localStorage.setItem('he_arm_plan_variants', JSON.stringify([{ id: 'x' }, null, 5]));
    expect(loadArmVariants()).toEqual([]);
    saveArmVariants([{ id: 'a', name: 'A', dateIso: '2026-09-10', plan: { weeks: [] } } as any]);
    expect(loadArmVariants().length).toBe(1);
  });

  it('сохранить → список → загрузить → удалить', () => {
    build();
    fireEvent.click(screen.getByRole('button', { name: /Варианты плана/ }));
    fireEvent.change(screen.getByLabelText('Название варианта'), { target: { value: 'Мой пик' } });
    fireEvent.click(screen.getByText(/Сохранить вариант/));
    expect(document.body.textContent).toContain('Мой пик');
    expect(document.body.textContent).toContain('Вариант сохранён');
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить Мой пик' }));
    expect(document.body.textContent).toContain('Вариант загружен');
    fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
    fireEvent.click(screen.getByRole('button', { name: /Варианты плана/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить Мой пик' }));
    expect(document.body.textContent).toContain('Вариант удалён');
    expect(loadArmVariants().length).toBe(0);
  });

  it('кап 10: одиннадцатый вытесняет старый', () => {    build();
    fireEvent.click(screen.getByRole('button', { name: /Варианты плана/ }));
    for (let i = 0; i < 11; i++) {
      fireEvent.change(screen.getByLabelText('Название варианта'), { target: { value: `V${i}` } });
      fireEvent.click(screen.getByText(/Сохранить вариант/));
    }
    const list = loadArmVariants();
    expect(list.length).toBe(10);
    expect(list[0].name).toBe('V10');
    expect(list.some((v) => v.name === 'V0')).toBe(false);
  });

  it('импорт JSON: валидный добавляет, битый даёт ошибку', async () => {
    build();
    fireEvent.click(screen.getByRole('button', { name: /Варианты плана/ }));
    const input = screen.getByLabelText('Импорт варианта JSON') as HTMLInputElement;
    const good = new File([JSON.stringify({ name: 'Из файла', plan: { pattern: { id: 'p', name: 'P' }, weeks: [] } })], 'plan.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [good] } });
    await screen.findByText('📥 Импортирован: Из файла');
    expect(loadArmVariants().some((v) => v.name === 'Из файла')).toBe(true);
    const bad = new File(['{oops'], 'bad.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [bad] } });
    await screen.findByText('⚠ Битый JSON-файл');
  });

  it('compareArmVariants: недели/сеты/дельты по мышцам', () => {
    const mk = (sets: number, muscle = 'wrist_flexors') => ({
      pattern: { id: 'p', name: 'P' },
      weeks: [{ week: 1, phase: 'accumulation', sessions: [{ exercises: [{ muscle, sets }] }] }],
    });
    expect(compareArmVariants(null as any, mk(1))).toBeNull();
    const d = compareArmVariants(mk(4), mk(7))!;
    expect(d.weeksA).toBe(1);
    expect(d.setsA).toBe(4);
    expect(d.setsB).toBe(7);
    expect(d.rows).toEqual([{ muscle: 'wrist_flexors', a: 4, b: 7, d: 3 }]);
    const same = compareArmVariants(mk(4), mk(4))!;
    expect(same.rows.every((r) => r.d === 0)).toBe(true);
  });

  it('UI: выбор двух вариантов показывает дельты', () => {
    build();
    fireEvent.click(screen.getByRole('button', { name: /Варианты плана/ }));
    fireEvent.change(screen.getByLabelText('Название варианта'), { target: { value: 'VA' } });
    fireEvent.click(screen.getByText(/Сохранить вариант/));
    fireEvent.change(screen.getByLabelText('Название варианта'), { target: { value: 'VB' } });
    fireEvent.click(screen.getByText(/Сохранить вариант/));
    const toggles = screen.getAllByRole('button', { name: /Сравнить V/ });
    expect(toggles.length).toBe(2);
    fireEvent.click(toggles[0]);
    fireEvent.click(toggles[1]);
    expect(document.body.textContent).toContain('Объёмы идентичны.');
  });
});
