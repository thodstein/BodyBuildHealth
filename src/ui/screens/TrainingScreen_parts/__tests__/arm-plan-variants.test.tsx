/**
 * arm-plan-variants.test.tsx — №2 сохранённые варианты арм-планов.
 *
 * Сохранить текущий (с правками) → список → загрузить → удалить; кап 10;
 * битый стор не роняет загрузку.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor, loadArmVariants, saveArmVariants } from '../ArmAutoConstructor';

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
});
