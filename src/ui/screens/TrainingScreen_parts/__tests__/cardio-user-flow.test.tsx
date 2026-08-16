/**
 * cardio-user-flow.test.tsx — интеграционный сценарий «как пользователь»:
 * профиль в localStorage → параметры подтянуты → сборка цикла → расписание
 * недель видно → «📋 Из профиля» восстанавливает изменённые поля.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioConstructor } from '../CardioConstructor';
import { loadCardioCycles } from '../../../../engines/lms/cardio.engine';

const PROFILE_KEY = 'he_profile_v2';
const WIZARD_KEY = 'he_cardio_wizard_state';
const CYCLES_KEY = 'he_cardio_cycles';
const ACTIVE_KEY = 'he_active_cardio_cycle';

function seedProfile(patch: Record<string, unknown>) {
  const base = {
    id: 'u1',
    name: 'Тест',
    role: 'user',
    settings: {
      personal: { age: 35, sex: 'female', height: 165, weight: 70, bodyFat: 22 },
      lifestyle: { restingHR: 62, sleepHours: 7, stressLevel: 4 },
      health: { heartRate: 0 },
      goals: {},
      nutrition: {}, training: {}, pharma: {}, system: {}, labs: {}, symptoms: {},
    },
  };
  const deep = (obj: any, path: string[], val: unknown) => {
    let cur = obj;
    for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
    cur[path[path.length - 1]] = val;
  };
  for (const [pathStr, val] of Object.entries(patch)) deep(base, pathStr.split('.'), val);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(base));
}

beforeEach(() => {
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(WIZARD_KEY);
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /* ignore */ }
});

describe('CardioConstructor — сценарий пользователя', () => {
  it('параметры из профиля: возраст/вес/пол/ЧСС покоя заполнены автоматически', () => {
    seedProfile({});
    render(<CardioConstructor />);
    expect(screen.getByRole('button', { name: /Пол: женский/ })).toBeTruthy();
    expect(screen.getByLabelText('Вес')).toHaveValue(70);
    expect(screen.getByLabelText('Возраст')).toHaveValue(35);
    expect(screen.getByLabelText('ЧСС покоя')).toHaveValue(62);
  });

  it('сборка цикла показывает расписание недель с фазами сразу', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    expect(screen.getByText(/Мин\/нед/)).toBeTruthy();
    expect(screen.getAllByText(/мин ·/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ккал/).length).toBeGreaterThan(0);
    const saved = loadCardioCycles()[0];
    expect(saved.weeks.length).toBeGreaterThan(0);
  });

  it('«📋 Из профиля» восстанавливает параметры после ручного изменения', () => {
    seedProfile({});
    render(<CardioConstructor />);
    const age = screen.getByLabelText('Возраст');
    fireEvent.change(age, { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: /Из профиля/ }));
    expect(screen.getByLabelText('Возраст')).toHaveValue(35);
    expect(screen.getByLabelText('Вес')).toHaveValue(70);
    expect(screen.getByLabelText('ЧСС покоя')).toHaveValue(62);
  });

  it('профиль с другим полом/весом: пол-сегмент и вес соответствуют', () => {
    seedProfile({ 'settings.personal.sex': 'male', 'settings.personal.weight': 88, 'settings.personal.age': 41 });
    render(<CardioConstructor />);
    expect(screen.getByRole('button', { name: /Пол: мужской/ })).toBeTruthy();
    expect(screen.getByLabelText('Вес')).toHaveValue(88);
    expect(screen.getByLabelText('Возраст')).toHaveValue(41);
  });

  it('графа пользователя: карточка с параметрами и кнопками синхронизации', () => {
    seedProfile({ 'settings.personal.sex': 'female', 'settings.personal.weight': 66, 'settings.personal.age': 29, 'settings.lifestyle.restingHR': 58 });
    const html = renderToStaticMarkup(<CardioConstructor />);
    expect(html).toContain('Возраст');
    expect(html).toContain('Вес');
    expect(html).toContain('ЧСС покоя');
    expect(html).toContain('Из профиля');
    expect(html).toContain('В профиль');
  });

  it('«💾 В профиль» сохраняет изменённые параметры в he_profile_v2', () => {
    seedProfile({});
    render(<CardioConstructor />);
    fireEvent.change(screen.getByLabelText('Возраст'), { target: { value: '44' } });
    fireEvent.change(screen.getByLabelText('ЧСС покоя'), { target: { value: '55' } });
    fireEvent.click(screen.getByRole('button', { name: /В профиль/ }));
    expect(screen.getByText(/сохранены в профиль/)).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}');
    expect(saved.settings.personal.age).toBe(44);
    expect(saved.settings.lifestyle.restingHR).toBe(55);
  });

  it('предпросмотр: «План по фазам» и «Taper-план» видны после сборки со стартом', () => {
    seedProfile({});
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.change(screen.getByLabelText('Неделя старта'), { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText('Название (например, Шоу)'), { target: { value: 'Шоу' } });
    fireEvent.click(screen.getByRole('button', { name: /Добавить старт/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    expect(screen.getByText(/План по фазам/)).toBeTruthy();
    expect(screen.getByText(/Taper-план перед стартом/)).toBeTruthy();
    expect(screen.getAllByText(/без HIIT/).length).toBeGreaterThan(0);
  });
});
