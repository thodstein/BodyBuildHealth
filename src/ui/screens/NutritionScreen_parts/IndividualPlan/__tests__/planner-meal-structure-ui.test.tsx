/**
 * planner-meal-structure-ui.test.tsx — lock E1: карточка «Количество приёмов пищи»
 * показывает ТУ ЖЕ структуру, что собирает движок: порог белка с курсом (0.45→0.55 г/кг),
 * тренировочные peri-приёмы и окна болюсов — сверх основных, а не «N приёмов» без них.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { IndividualPlan } from '../index';

const seedBase = () => {
  try {
    localStorage.setItem('he_planner_mode', 'pro');
    localStorage.setItem('he_profile_v2', JSON.stringify({
      settings: {
        personal: { weight: 85, height: 180, age: 30, sex: 'male', bodyFat: 18 },
        training: { primaryGoal: 'mass' },
        pharma: { phase: 'course' },
        nutrition: {},
      },
    }));
  } catch {}
};

const hasText = (re: RegExp) => !!(document.body.textContent || '').match(re);

describe('E1-UI: карточка приёмов = единый источник с движком', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
    cleanup();
    seedBase();
  });

  it('курс учтён: порог белка 0.55 г/кг (85 кг → 47 г) и подпись «(на курсе)»', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    expect(hasText(/\(на курсе\)/)).toBe(true);
    expect(hasText(/≤47 г белка/)).toBe(true);
    // Единый порог с движком: старая карточка всегда считала 0.45 г/кг → 38 г.
    expect(hasText(/≤38 г белка/)).toBe(false);
  });

  it('тренировка: peri-приёмы показаны сверх основных (честный итог)', () => {
    render(<IndividualPlan profile={null} course={[]} labs={[]} labAnalysis={null} />);
    // Тумблер без текста: кликаем кнопку-переключатель рядом с подписью.
    const label = Array.from(document.querySelectorAll('span'))
      .find(s => (s.textContent || '').includes('Привязать рацион к тренировке'));
    expect(label, 'подпись тумблера не найдена').toBeTruthy();
    const toggle = label!.previousElementSibling as HTMLElement | null;
    expect(toggle, 'тумблер не найден').toBeTruthy();
    fireEvent.click(toggle!);
    expect(hasText(/\+ [23] peri/)).toBe(true);
    expect(hasText(/идут СВЕРХ основных/)).toBe(true);
  });
});
