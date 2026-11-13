/**
 * protocol-dose-ul.test.ts — проход 36: таблицы протоколов печатают предел
 * рядом с верхней границей дозы, если она выше UL реестра.
 *
 * Правило проекта: клинические диапазоны (Mg 400–600, Zn 50, B6 25) остаются
 * диапазонами, но пользователь обязан видеть предел. Раньше «Магний 400-600 мг»
 * и «Цинк 50 мг» выглядели как обычная рекомендация при UL 350 и 40.
 */
import { describe, it, expect } from 'vitest';
import { doseUlHint } from '../supportProtocolsShared';
import { NUTRIENT_LIMITS_V2 } from '../../../../engines/support-limits';

const ul = (n: string) => `${NUTRIENT_LIMITS_V2[n].value}`;

describe('doseUlHint: верхняя граница выше UL', () => {
  it('магний 400-600 → предел 350', () => {
    expect(doseUlHint('Магний (глицинат) 400-600 мг', '400-600 мг')).toContain(ul('magnesium'));
  });

  it('магний 200-400 → предел 350', () => {
    expect(doseUlHint('Магний (глицинат) 200-400 мг', '200-400 мг')).toContain(ul('magnesium'));
  });

  it('магний 200-300 → в пределах, плашки нет', () => {
    expect(doseUlHint('Магний глицинат', '200-300 мг')).toBeNull();
  });

  it('цинк 25-50 → предел 40', () => {
    expect(doseUlHint('Цинк (пиколинат) 25-50 мг', '25-50 мг')).toContain(ul('zinc'));
    expect(doseUlHint('Цинк', '30 мг')).toBeNull();
  });

  it('B6 10-25 → предел 12 (25 мг выше UL добавок)', () => {
    expect(doseUlHint('Витамин B6 (пиридоксин) 10-25 мг', '10-25 мг')).toContain(ul('vitamin_b6'));
    expect(doseUlHint('Витамин B6', '10 мг')).toBeNull();
  });

  it('витамин D: 4000 МЕ — ровно UL, 5000+ — выше', () => {
    expect(doseUlHint('Витамин D3', '2000-4000 МЕ')).toBeNull();
    expect(doseUlHint('Витамин D3', '5000-10000 МЕ')).toContain(ul('vitamin_d'));
  });

  it('витамин E: 400 МЕ ≈ 268 мг (в UL 300), 800 МЕ — выше', () => {
    expect(doseUlHint('Витамин E', '200-400 МЕ')).toBeNull();
    expect(doseUlHint('Витамин E', '800 МЕ')).toContain(ul('vitamin_e'));
  });

  it('селен: 200 мкг — норма, 400 мкг — выше 255', () => {
    expect(doseUlHint('Селен (селенометионин)', '200 мкг')).toBeNull();
    expect(doseUlHint('Селен', '400 мкг')).toContain(ul('selenium'));
  });

  it('железо выше Safe Level 40 подписано', () => {
    expect(doseUlHint('Железо (бисглицинат)', '100 мг')).toContain(ul('iron'));
    expect(doseUlHint('Железо', '25 мг')).toBeNull();
  });
});

describe('doseUlHint: не сравнивает то, что сравнивать нельзя', () => {
  it('вес-зависимые дозы (мг/кг) — без плашки', () => {
    expect(doseUlHint('УДХК (TUDCA)', '13-15 мг/кг/сут')).toBeNull();
  });

  it('вещества без нутриентного предела — без плашки', () => {
    expect(doseUlHint('NAC', '1200 мг')).toBeNull();
    expect(doseUlHint('Берберин', '1500 мг')).toBeNull();
    expect(doseUlHint('Тестостерон энантат', '500 мг/нед')).toBeNull();
  });

  it('неизвестная строка/пустая доза — без плашки', () => {
    expect(doseUlHint('', '')).toBeNull();
    expect(doseUlHint('Магний', '')).toBeNull();
  });
});
