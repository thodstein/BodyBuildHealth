/**
 * cardio-constructor.test.tsx — SSR/CSR smoke пошагового мастера кардио:
 * степпер, сборка, интеграции, библиотека, дневник.
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardioConstructor } from '../CardioConstructor';
import { getCardioLink, clearCardioLink } from '../../../../engines/lms/cardio-bridge';
import { buildBbMacrocycle, serializeBbMacro, deserializeBbMacro } from '../../../../engines/lms/macrocycle.engine';
import { loadCardioCycles, loadActiveCardioCycle } from '../../../../engines/lms/cardio.engine';
import { buildBBContestPrepPlan, serializeBBContestPrepPlan, isoAddDays, isoToday } from '../../../../engines/bb/bb-contest-prep.engine';
import { saveAnnualTrainingPlan } from '../../../../engines/annual-training/annual-training-storage';
import { annualPlanFromMacro } from '../../../../engines/annual-training/block-builders.engine';

const CYCLES_KEY = 'he_cardio_cycles';
const ACTIVE_KEY = 'he_active_cardio_cycle';
const LINK_KEY = 'he_cardio_link';
const BB_MACRO_KEY = 'he_bb_macro';
const WIZARD_KEY = 'he_cardio_wizard_state';
const PROFILE_KEY = 'he_profile_v2';
const ANNUAL_PLAN_KEY = 'he_annual_training_plan_v1';
const ANNUAL_CARDIO_KEY = 'he_annual_cardio_cycles';

beforeEach(() => {
  try {
    localStorage.removeItem(CYCLES_KEY);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem(LINK_KEY);
    localStorage.removeItem(BB_MACRO_KEY);
    localStorage.removeItem(WIZARD_KEY);
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(ANNUAL_PLAN_KEY);
    localStorage.removeItem(ANNUAL_CARDIO_KEY);
    clearCardioLink();
  } catch { /* ignore */ }
});

/** Сид годового плана (ББ-макро 52 нед → план из блоков). */
function seedAnnualPlan(): void {
  const macro = buildBbMacrocycle({ level: 'intermediate', totalWeeks: 52 });
  saveAnnualTrainingPlan(annualPlanFromMacro(macro));
}

/** Сид профиля с единым prep-планом ББ (goals.bbContestPrepPlan). */
function seedPrepPlan(): void {
  const plan = buildBBContestPrepPlan({
    sex: 'male', category: 'mens_physique', weightKg: 80,
    experienceLevel: 'intermediate', enhanced: false, prepCount: 0,
    showDate: isoAddDays(isoToday(), 60), weeksOut: 2, trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate', waterStrategy: 'minimal', sodiumStrategy: 'constant',
  }, { prepWeeks: 8, taperWeeks: 2 });
  localStorage.setItem(PROFILE_KEY, JSON.stringify({
    settings: {
      goals: { bbContestPrepPlan: serializeBBContestPrepPlan(plan) },
      personal: { weight: 80, sex: 'male' },
      health: { chronicConditions: [] },
      nutrition: {}, lifestyle: {}, training: {}, pharma: {}, labs: { status: 'none', summary: {} }, symptoms: { recent: {} },
    },
  }));
}

describe('CardioConstructor — SSR', () => {
  it('рендерит степпер из 5 шагов и навигацию', () => {
    const html = renderToStaticMarkup(<CardioConstructor />);
    expect(html).toContain('Кардио-конструктор');
    expect(html).toContain('1 Параметры');
    expect(html).toContain('2 Старты');
    expect(html).toContain('3 Предпросмотр');
    expect(html).toContain('4 Управление');
    expect(html).toContain('5 Дневник');
    expect(html).toContain('Назад');
  });

  it('шаг 1 показывает цель, горизонт, быстрые старты и живой предпросмотр', () => {
    const html = renderToStaticMarkup(<CardioConstructor />);
    expect(html).toContain('Цель цикла');
    expect(html).toContain('Сушка');
    expect(html).toContain('Горизонт');
    expect(html).toContain('Быстрые старты');
    expect(html).toContain('Структура фаз');
    expect(html).toContain('Предпросмотр цикла');
    expect(html).toContain('Параметры пользователя');
    expect(html).toContain('Из профиля');
    expect(html).toContain('ЧСС покоя');
  });

  it('шаг 1: taper вкл по умолчанию + визуальная карта фаз в предпросмотре', () => {
    const html = renderToStaticMarkup(<CardioConstructor />);
    expect(html).toContain('Taper: вкл');
    expect(html).toContain('Пик-неделя: вкл');
    expect(html).toContain('Фазы по неделям');
    expect(html).toContain('taper 2 нед');
    expect(html).toContain('База');
    expect(html).toContain('Поддержание');
  });

  it('шаг 1: предпросмотр показывает прогноз адаптации VO2max', () => {
    const html = renderToStaticMarkup(<CardioConstructor />);
    expect(html).toContain('+VO2MAX');
    expect(html).toContain('Прогноз адаптации');
    expect(html).toMatch(/\+\d+(\.\d+)?%/);
  });

  it('шаг 1: при малом числе дней предупреждение об урезании сессий', () => {
    localStorage.setItem('he_cardio_wizard_state', JSON.stringify({ version: 2, goal: 'cut', totalWeeks: 8, daysAvailable: 1, recoveryLow: false, bodyWeight: 80, taperWeeks: 2, peakWeek: true, phaseAuto: true, phaseBase: 0, phaseBuild: 0, phaseMaint: 0, level: 'intermediate', equipment: [], lowImpact: false, age: 30, sex: 'male', restingHr: 0, legDays: [] }));
    const html = renderToStaticMarkup(<CardioConstructor />);
    expect(html).toContain('сессии урезаны');
  });
});

describe('CardioConstructor — CSR', () => {
  it('навигация: Далее → Далее → предпросмотр с CTA сборки', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    expect(screen.getByText(/Соревнования и старты/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    expect(screen.getByText(/Соберите кардио-цикл/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Собрать и сохранить цикл/ })).toBeTruthy();
  });

  it('шаг «Старты»: taper-режим настраивается на шаге «Параметры» (статус виден в стартах)', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Недель taper увеличить/ }));
    fireEvent.click(screen.getByRole('button', { name: /Пик-неделя старта/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    expect(screen.getByText(/Соревнования и старты/)).toBeTruthy();
    expect(screen.getByText(/taper 3 нед/)).toBeTruthy();
  });

  it('шаг 1: выключение taper напрямую в параметрах — сборка без taper-кривой', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Taper перед стартом/ }));
    expect(screen.getByText(/Taper: выкл/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.change(screen.getByPlaceholderText(/Название/), { target: { value: 'Старт' } });
    fireEvent.change(screen.getByLabelText(/Неделя старта/), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /Добавить старт/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    const saved = loadCardioCycles()[0];
    expect(saved.weeks.some(w => w.phase === 'taper')).toBe(false);
  });

  it('сборка на предпросмотре сохраняет цикл в библиотеку и показывает метрики', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    expect(screen.getByText(/Мин\/нед/)).toBeTruthy();
    expect(screen.getByText(/Ккал\/нед/)).toBeTruthy();
    expect(loadCardioCycles().length).toBe(1);
    expect(JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null')).toBeTruthy();
  });

  it('шапка: прогресс-бар мастера (шаг N из 5) + сводка активного цикла в чипах', () => {
    render(<CardioConstructor />);
    expect(screen.getByText(/Шаг 1 из 5/)).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    expect(screen.getByText(/Шаг 3 из 5/)).toBeTruthy();
    expect(screen.getAllByText(/мин\/нед/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ккал\/нед/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/12 нед/).length).toBeGreaterThan(0);
  });

  it('пресет «Сушка · 16 нед» применяет параметры и виден в предпросмотре', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Пресет: Сушка · 16 нед/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    const saved = loadCardioCycles()[0];
    expect(saved.totalWeeks).toBe(16);
    expect(saved.goal).toBe('cut');
  });

  it('шаг 4: подключение к ПЛ-авто фиксируется в cardio-bridge', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /К ПЛ-авто/ }));
    expect(getCardioLink()?.sport).toBe('pl');
    expect(screen.getByText(/Подключено к ПЛ-авто/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Отключить/ }));
    expect(getCardioLink()).toBeNull();
  });

  it('шаг 4: привязка к годовому плану ББ сохраняет cardioCycleId в макроцикл', () => {
    const macro = buildBbMacrocycle({ level: 'advanced', totalWeeks: 12, trainingFocus: 'hypertrophy' });
    localStorage.setItem(BB_MACRO_KEY, serializeBbMacro(macro));
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /К плану ББ/ }));
    expect(screen.getByText(/Привязано к годовому плану ББ/)).toBeTruthy();
    const restored = deserializeBbMacro(localStorage.getItem(BB_MACRO_KEY) ?? '');
    expect(restored?.cardioCycleId).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Отвязать/ }));
    expect(deserializeBbMacro(localStorage.getItem(BB_MACRO_KEY) ?? '')?.cardioCycleId).toBeUndefined();
  });

  it('шаг 4: сравнение сценариев показывает дифф', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /⇄ Сравнить/ }));
    expect(screen.getByText(/→/)).toBeTruthy();
  });

  it('шаг 4: «Год кардио» показывает визуализацию последовательности циклов', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    expect(screen.getAllByText(/Год кардио/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Итого:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/нед · в среднем/).length).toBeGreaterThan(0);
  });

  it('шаг 5: доступны авто-режим и дневник', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    expect(screen.getByRole('button', { name: /Подстроить сейчас/ })).toBeTruthy();
    expect(screen.getByText(/Дневник выполнения кардио/)).toBeTruthy();
  });

  it('«Сегодня» в шапке ведёт на шаг «Дневник» (быстрый старт)', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    const todayBtn = screen.getByRole('button', { name: /Сегодня/ });
    expect(todayBtn).toBeTruthy();
    fireEvent.click(todayBtn);
    expect(screen.getByText(/Быстрый старт сессии/)).toBeTruthy();
  });

  it('переименование активного цикла сохраняется', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    const input = screen.getByRole('textbox', { name: /Название цикла/ });
    fireEvent.change(input, { target: { value: 'Сушка к Чемпионату' } });
    fireEvent.click(screen.getByRole('button', { name: /Переименовать/ }));
    const saved = loadCardioCycles()[0];
    expect(saved.name).toBe('Сушка к Чемпионату');
    expect(JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? 'null').name).toBe('Сушка к Чемпионату');
  });

  it('параметры мастера восстанавливаются из localStorage', () => {
    localStorage.setItem('he_cardio_wizard_state', JSON.stringify({ version: 2, goal: 'mass', totalWeeks: 10, daysAvailable: 2, recoveryLow: true, bodyWeight: 90, taperWeeks: 3, peakWeek: false, phaseAuto: false, phaseBase: 2, phaseBuild: 3, phaseMaint: 3, level: 'beginner', equipment: ['cycling'], lowImpact: true, age: 40, sex: 'female', restingHr: 60 }));
    const { unmount } = render(<CardioConstructor />);
    expect(screen.getByRole('button', { name: /Цель: Массонабор/ })).toBeTruthy();
    unmount();
  });

  it('персонализация: уровень и оборудование влияют на собранный цикл', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Продвинутый/ }));
    fireEvent.click(screen.getByRole('button', { name: /Оборудование: Вело/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    const saved = loadCardioCycles()[0];
    expect(saved.weeks[0].sessions[0].equipment).toBe('cycling');
  });

  it('«⚙️ Изменить параметры» сбрасывает вариант нагрузки в «Базовый»', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    // Выбрать интенсивный вариант на предпросмотре.
    fireEvent.click(screen.getByRole('button', { name: /Вариант: Интенсивный/ }));
    // Вернуться к параметрам через «⚙️ Изменить параметры» — вариант сбрасывается в базовый.
    fireEvent.click(screen.getByRole('button', { name: /Изменить параметры/ }));
    expect(screen.getByRole('button', { name: /Taper перед стартом/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    const btn = screen.getByRole('button', { name: /Вариант: Базовый/ });
    expect(btn).toBeTruthy();
  });

  it('изменение параметров после сборки → предупреждение «параметры изменены» на предпросмотре', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    // Назад на шаг 1 и меняем цель.
    fireEvent.click(screen.getByRole('button', { name: /Назад/ }));
    fireEvent.click(screen.getByRole('button', { name: /Назад/ }));
    fireEvent.click(screen.getByRole('button', { name: /Цель: Здоровье/ }));
    // Снова к предпросмотру — цикл не пересобран, параметры расходятся.
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    expect(screen.getByText(/Параметры в мастере изменены/)).toBeTruthy();
  });

  it('добавление старта после сборки → предупреждение «параметры изменены»', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    // Назад на шаг 2 и добавляем старт.
    fireEvent.click(screen.getByRole('button', { name: /Назад/ }));
    fireEvent.change(screen.getByPlaceholderText(/Название/), { target: { value: 'Старт' } });
    fireEvent.change(screen.getByLabelText(/Неделя старта/), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: /Добавить старт/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    expect(screen.getByText(/Параметры в мастере изменены/)).toBeTruthy();
  });

  it('prep-план в профиле: кнопка «⚙️ Из prep-плана» видна', () => {
    seedPrepPlan();
    const html = renderToStaticMarkup(<CardioConstructor />);
    expect(html).toContain('Из prep-плана');
    expect(html).toContain('8 нед');
  });

  it('«⚙️ Из prep-плана»: кардио собрано из prep (goal bb_prep, пик-неделя видна)', () => {
    seedPrepPlan();
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Собрать кардио из prep-плана/ }));
    expect(screen.getAllByRole('status').some(s => (s.textContent || '').includes('Кардио построено из prep-плана ББ'))).toBe(true);
    const active = loadActiveCardioCycle();
    expect(active).toBeTruthy();
    expect(active!.goal).toBe('bb_prep');
    expect(active!.weeks.some(w => w.phase === 'peak')).toBe(true);
    expect(active!.weeks.some(w => w.phase === 'taper')).toBe(true);
    expect(screen.getByText(/🎭 Пик-неделя/)).toBeTruthy();
  });

  it('«❤️ Кардио по блокам года»: без годового плана → предупреждение', () => {
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать кардио по блокам года/ }));
    expect(screen.getAllByRole('status').some(s => (s.textContent || '').includes('Сначала постройте макроцикл'))).toBe(true);
  });

  it('«❤️ Кардио по блокам года»: циклы собраны по блокам и видны в списке', () => {
    seedAnnualPlan();
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать кардио по блокам года/ }));
    expect(screen.getAllByRole('status').some(s => /Кардио по блокам года: собрано \d+ циклов/.test(s.textContent || ''))).toBe(true);
    const cycles = loadCardioCycles();
    const annual = cycles.filter(c => c.id.startsWith('annual-cardio-'));
    expect(annual.length).toBeGreaterThan(0);
    const map = JSON.parse(localStorage.getItem(ANNUAL_CARDIO_KEY) || '{}');
    expect(Object.keys(map).length).toBe(annual.length);
    expect(Object.values(map).every((v: string) => annual.some(c => c.id === v))).toBe(true);
    expect(screen.getAllByText(/Кардио · /).length).toBeGreaterThan(0);
  });

  it('«🗑 Сбросить»: маппинг и циклы года удаляются', () => {
    seedAnnualPlan();
    render(<CardioConstructor />);
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать и сохранить цикл/ }));
    fireEvent.click(screen.getByRole('button', { name: /Далее/ }));
    fireEvent.click(screen.getByRole('button', { name: /Собрать кардио по блокам года/ }));
    fireEvent.click(screen.getByRole('button', { name: /Сбросить/ }));
    expect(loadCardioCycles().filter(c => c.id.startsWith('annual-cardio-')).length).toBe(0);
    expect(localStorage.getItem(ANNUAL_CARDIO_KEY)).toBeNull();
    expect(screen.getAllByRole('status').some(s => (s.textContent || '').includes('Кардио по блокам года сброшено'))).toBe(true);
  });
});
