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
