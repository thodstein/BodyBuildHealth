/**
 * lab-bound-delta.test.ts — проход 144: разность двух записей доказывается
 * только у точных чисел.
 *
 * Экран проверки импорта печатал «↑ >800 → >1000 (+25%)»: процент считался
 * прямо из чисел бланка, хотя «>800» — не 800, а «не меньше 800», и «>1000» —
 * не 1000. Направление и величина такого изменения неизвестны. Правило теперь
 * одно (`labDelta`), и оно же отвечает на вопрос «можно ли вообще сравнивать»
 * (`boundsComparable`).
 */
import { describe, it, expect } from 'vitest';
import { boundsComparable, labDelta } from '../lab-bound';

describe('проход 144: можно ли сравнивать записи', () => {
  it('два точных числа — можно', () => {
    expect(boundsComparable(undefined, undefined)).toBe(true);
  });

  it('граница с любой стороны — нельзя', () => {
    expect(boundsComparable('>', undefined)).toBe(false);
    expect(boundsComparable(undefined, '<')).toBe(false);
    expect(boundsComparable('>', '>')).toBe(false);
  });
});

describe('проход 144: направление и процент «было → стало»', () => {
  it('точные числа считаются как раньше', () => {
    expect(labDelta({ value: 40 }, { value: 50 })).toEqual({ arrow: '↑', pct: 25 });
    expect(labDelta({ value: 50 }, { value: 40 })).toEqual({ arrow: '↓', pct: -20 });
    expect(labDelta({ value: 40 }, { value: 40 })).toEqual({ arrow: '→', pct: 0 });
  });

  it('прошлое 0 — стрелка есть, процента нет', () => {
    expect(labDelta({ value: 0 }, { value: 5 })).toEqual({ arrow: '↑', pct: null });
  });

  it('«>800 → >1000» — ни стрелки, ни процента', () => {
    expect(labDelta({ value: 800, bound: '>' }, { value: 1000, bound: '>' }))
      .toEqual({ arrow: '', pct: null });
  });

  it('граница только у новой записи тоже снимает вывод', () => {
    expect(labDelta({ value: 800 }, { value: 1000, bound: '>' }))
      .toEqual({ arrow: '', pct: null });
  });

  it('граница только у прошлой записи — тоже', () => {
    expect(labDelta({ value: 800, bound: '<' }, { value: 1000 }))
      .toEqual({ arrow: '', pct: null });
  });
});
