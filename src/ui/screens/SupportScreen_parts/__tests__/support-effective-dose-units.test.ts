/**
 * support-effective-dose-units.test.ts — проход 26: справочник доз не врёт о единицах.
 *
 * Дефект: блок «Справочник терапевтических диапазонов» печатал «мг» для КАЖДОЙ
 * строки, игнорируя собственный label: «Витамин D3 (МЕ): 1000–5000 мг» (это
 * 200 000 МЕ), «B12 (мкг): 500–2000 мг». Тот же миллиграмм уезжал в окно дозы
 * из fallback-ветки `doseWindowFor` (фолат 400–1000 мкг подписывался «мг»).
 *
 * Заодно: верхняя граница диапазона — клинический стандарт и может быть выше
 * UL (D3 5000 против 4000, Zn 50 против 40, Mg 600 против 350). Теперь предел
 * печатается рядом с диапазоном, чтобы строка не выглядела разрешением.
 */
import { describe, it, expect } from 'vitest';
import { DOSE_RANGES, doseRangeText } from '../SupportEffectiveDose';
import { doseWindowFor } from '../../../../engines/support-hub-evidence.engine';
import { NUTRIENT_LIMIT_INFO } from '../../../../engines/support-plan/types';
import { resolveNutrient } from '../../../../engines/support-limits';

describe('справочник доз: единицы', () => {
  it('у каждой строки есть единица', () => {
    for (const [key, r] of Object.entries(DOSE_RANGES)) {
      expect(r.unit, key).toBeTruthy();
      expect(['мг', 'мкг', 'МЕ'], key).toContain(r.unit);
    }
  });

  it('D3 печатается в МЕ, а не в миллиграммах', () => {
    const t = doseRangeText('vitamin_d3');
    expect(t).toContain('1000–5000 МЕ');
    expect(t).not.toContain('мг');
    expect(t).toContain('UL 4000 МЕ');
  });

  it('B12 и фолат — мкг', () => {
    expect(doseRangeText('b12')).toContain('500–2000 мкг');
    expect(doseRangeText('folate')).toContain('400–1000 мкг');
  });

  it('предел печатается рядом с диапазоном, который его превышает', () => {
    expect(doseRangeText('zinc')).toBe('Цинк (элемент): 15–50 мг · UL 40 мг');
    expect(doseRangeText('magnesium')).toContain('UL 350 мг');
  });

  it('железо подписано Safe Level, а не UL', () => {
    const t = doseRangeText('iron');
    expect(t).toContain('Safe Level 40 мг');
    expect(t).not.toContain('UL 40');
  });
});

// ── Системный гард: у КАЖДОЙ строки с пределом реестра предел напечатан ──
describe('справочник доз: предел реестра напечатан у всех строк', () => {
  it('любая строка с UL/SafeLevel показывает предел и его единицу', () => {
    const missing: string[] = [];
    for (const key of Object.keys(DOSE_RANGES)) {
      const canon = resolveNutrient(key);
      const info = canon ? NUTRIENT_LIMIT_INFO[canon] : undefined;
      if (!info || !(info.value > 0)) continue;
      if (info.kind !== 'UL' && info.kind !== 'SafeLevel') continue;
      const t = doseRangeText(key);
      if (!t.includes(String(info.value))) missing.push(`${key}: нет ${info.value} в «${t}»`);
    }
    expect(missing).toEqual([]);
  });

  it('единица предела не «мг» по умолчанию', () => {
    // D3 (МЕ), фолат (мкг) — предел обязан быть в их шкале
    expect(doseRangeText('vitamin_d3')).toContain('UL 4000 МЕ');
    expect(doseRangeText('folate')).toContain('UL 1000 мкг');
  });
});

describe('doseWindowFor: единица окна из таблицы диапазонов', () => {
  it('фолат получает мкг, а не мг', () => {
    const w = doseWindowFor('folate', {} as never, DOSE_RANGES as never);
    expect(w.hasData).toBe(true);
    expect(w.unit).toBe('мкг');
    expect(w.max).toBe(1000);
  });

  it('креатин остаётся в мг', () => {
    const w = doseWindowFor('creatine', {} as never, DOSE_RANGES as never);
    expect(w.unit).toBe('мг');
  });
});
