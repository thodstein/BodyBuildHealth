/**
 * planner-mode-tabs.test.tsx — проверка поведения режимов планировщика в UI:
 * - pro: видны все 6 вкладок и продвинутые карточки настроек;
 * - simple: скрыты Отчёт/Нагрузка/Тапер и продвинутые карточки (v2 Скоринг, Фаза и препараты);
 * - minimal: остаются вкладки «Настройки» + «План» (быстрый должен показывать план), 3 цели (масса/сушка/поддержание), ручное КБЖУ.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';

const clickTab = (label: string) => {
  const tab = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes(label));
  if (!tab) throw new Error(`Button not found: ${label}`);
  fireEvent.click(tab);
};

const hasButton = (label: RegExp) => Array.from(document.querySelectorAll('button')).some(b => (b.textContent || '').match(label));

const hasText = (re: RegExp) => !!(document.body.textContent || '').match(re);

describe('планировщик: вкладки по режиму', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
  });

  it('pro — видны все 6 вкладок', () => {
    try { localStorage.setItem('he_planner_mode', 'pro'); } catch {}
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    for (const t of ['Настройки', 'План', 'Компоновщик', 'Отчёт', 'Нагрузка БЖУ', 'Тапер ББ']) {
      expect(hasButton(new RegExp(t))).toBe(true);
    }
  });

  it('simple — скрыты Отчёт/Нагрузка/Тапер, остаются Настройки/План/Компоновщик', () => {
    try { localStorage.setItem('he_planner_mode', 'simple'); } catch {}
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    for (const t of ['Настройки', 'План', 'Компоновщик']) {
      expect(hasButton(new RegExp(t))).toBe(true);
    }
    expect(hasButton(/Отчёт/)).toBe(false);
    expect(hasButton(/Нагрузка БЖУ/)).toBe(false);
    expect(hasButton(/Тапер ББ/)).toBe(false);
  });

  it('simple — продвинутые карточки настроек скрыты, базовая «Цель» видна', () => {
    try { localStorage.setItem('he_planner_mode', 'simple'); } catch {}
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    expect(hasText(/v2 Скоринг/)).toBe(false);
    expect(hasText(/Фаза и препараты/)).toBe(false);
    expect(hasText(/Диетические паузы/)).toBe(false);
    expect(hasText(/🎯?Цель/)).toBe(true);
  });

  it('переключение в «Простой» в шапке скрывает вкладку Отчёт', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    expect(hasButton(/Отчёт/)).toBe(true);
    clickTab('Простой');
    expect(hasButton(/Отчёт/)).toBe(false);
    expect(hasButton(/Нагрузка БЖУ/)).toBe(false);
  });
});

describe('планировщик: быстрый (minimal) режим', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
    try { localStorage.setItem('he_planner_mode', 'minimal'); } catch {}
  });

  it('остаётся вкладка «Настройки» + «План» (быстрый режим должен показывать план)', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    expect(hasButton(/Настройки/)).toBe(true);
    expect(hasButton(/План/)).toBe(true);
    expect(hasButton(/Компоновщик/)).toBe(false);
    expect(hasButton(/Отчёт/)).toBe(false);
  });

  it('только 3 цели: масса, сушка, поддержание', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    expect(hasButton(/Массонабор/)).toBe(true);
    expect(hasButton(/Сушка/)).toBe(true);
    expect(hasButton(/Поддержка/)).toBe(true);
    expect(hasButton(/Сила/)).toBe(false);
    expect(hasButton(/Похудение/)).toBe(false);
    expect(hasButton(/Рекомпозиция/)).toBe(false);
  });

  it('доступно ручное КБЖУ (тоггл «✏️ Ручное КБЖУ»)', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    expect(hasButton(/Ручное КБЖУ/)).toBe(true);
    clickTab('Ручное КБЖУ');
    expect(hasButton(/Белки/)).toBe(true);
    expect(hasButton(/Жиры/)).toBe(true);
    expect(hasButton(/Углеводы/)).toBe(true);
  });
});
