/**
 * diary-quick-repeat.test.ts — «как вчера»: перенос приёмов предыдущего дня.
 *
 * Контракт: только добавление (ничего не теряем), дубликаты не удваиваются,
 * дата считается по локальному календарю (переходы месяца/года/високосный год).
 */
import { describe, it, expect } from 'vitest';
import {
  mergeMealsFromPrevious,
  previousDateKey,
  repeatItemKey,
} from '../diary/diary-quick-repeat';

describe('previousDateKey', () => {
  it('обычный день', () => {
    expect(previousDateKey('2026-11-05')).toBe('2026-11-04');
  });

  it('начало месяца', () => {
    expect(previousDateKey('2026-03-01')).toBe('2026-02-28');
  });

  it('начало года', () => {
    expect(previousDateKey('2026-01-01')).toBe('2025-12-31');
  });

  it('високосный февраль', () => {
    expect(previousDateKey('2024-03-01')).toBe('2024-02-29');
    expect(previousDateKey('2026-03-01')).toBe('2026-02-28');
  });

  it('невалидную дату возвращает как есть', () => {
    expect(previousDateKey('')).toBe('');
    expect(previousDateKey('вчера')).toBe('вчера');
  });
});

describe('repeatItemKey', () => {
  it('нормализует регистр и пробелы', () => {
    expect(repeatItemKey({ name: ' Яйца ', qty: '100 Г' })).toBe(
      repeatItemKey({ name: 'яйца', qty: '100 г' }),
    );
  });

  it('разное количество — разные порции', () => {
    expect(repeatItemKey({ name: 'Яйца', qty: '100 г' })).not.toBe(
      repeatItemKey({ name: 'Яйца', qty: '150 г' }),
    );
  });
});

describe('mergeMealsFromPrevious', () => {
  const source = {
    Завтрак: [
      { name: 'Яйца', qty: '100 г', kcal: 155, p: 13, f: 11, c: 1 },
      { name: 'Кофе', qty: '200 мл', kcal: 2, p: 0, f: 0, c: 0 },
    ],
    Обед: [{ name: 'Рис', qty: '150 г', kcal: 200, p: 4, f: 1, c: 44 }],
  };

  it('пустой целевой день — переносит всё', () => {
    const r = mergeMealsFromPrevious(undefined, source);
    expect(r.added).toBe(3);
    expect(r.skipped).toBe(0);
    expect(Object.keys(r.meals)).toEqual(['Завтрак', 'Обед']);
    expect(r.meals.Завтрак).toHaveLength(2);
  });

  it('не перезаписывает существующие позиции и не теряет их', () => {
    const target = { Завтрак: [{ name: 'Овсянка', qty: '80 г', kcal: 300 }] };
    const r = mergeMealsFromPrevious(target, source);
    expect(r.added).toBe(3);
    expect(r.meals.Завтрак[0].name).toBe('Овсянка');
    expect(r.meals.Завтрак).toHaveLength(3);
  });

  it('дубликаты по имени и количеству пропускаются (двойной клик не удваивает)', () => {
    const once = mergeMealsFromPrevious(undefined, source);
    const twice = mergeMealsFromPrevious(once.meals, source);
    expect(twice.added).toBe(0);
    expect(twice.skipped).toBe(3);
    expect(twice.meals.Завтрак).toHaveLength(2);
    expect(twice.meals.Обед).toHaveLength(1);
  });

  it('копирует глубоко: правка перенесённой позиции не меняет источник', () => {
    const r = mergeMealsFromPrevious(undefined, source);
    r.meals.Завтрак[0].kcal = 999;
    expect(source.Завтрак[0].kcal).toBe(155);
  });

  it('пустой источник — ничего не добавляет', () => {
    const r = mergeMealsFromPrevious({ Завтрак: [{ name: 'X', qty: '1' }] }, {});
    expect(r.added).toBe(0);
    expect(r.meals.Завтрак).toHaveLength(1);
  });

  it('пустые приёмы в источнике не создают пустых карточек', () => {
    const r = mergeMealsFromPrevious(undefined, { Завтрак: [], Обед: source.Обед });
    expect(Object.keys(r.meals)).toEqual(['Обед']);
  });
});
