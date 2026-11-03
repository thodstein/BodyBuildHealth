/**
 * bb-hub-catalog-limit.test.tsx — кап каталога в «Разборе» больше не молчит.
 *
 * Дефект (аудит хабов, п. 11): пикер резал каталог до 80, библиотека — до 40
 * из ~600 упражнений, без единого слова. Пользователь видел 40 упражнений и
 * считал, что их всего 40; 14% каталога было недостижимо без поиска.
 *
 * Локи:
 *  - подпись «80 из N» / «40 из N» появляется только при реальном обрезании;
 *  - поиск идёт по ВСЕМУ каталогу, поэтому упражнение за пределами капа находится;
 *  - поиск сужает и библиотеку (раньше он на неё не влиял вовсе).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BBDiagnosticsHub } from '../BBDiagnosticsHub';
import { catalogLimitNote } from '../bb-hub-exercise-tab';
import { EXERCISE_CATALOG } from '../../../../core/exercise-catalog';

const TOTAL = EXERCISE_CATALOG.length;

const openExerciseTab = () => {
  render(<BBDiagnosticsHub />);
  fireEvent.click(screen.getByRole('button', { name: /Разбор/ }));
};

const sheetOptions = () => Array.from(document.querySelectorAll('[data-bb="sheet-option"]')).map((o) => o.textContent || '');

describe('каталог «Разбора»: кап назван, а не скрыт', () => {
  beforeEach(() => { localStorage.clear(); });

  it('подпись нужна только при обрезании; числа — настоящие', () => {
    expect(catalogLimitNote(TOTAL, TOTAL, 'picker')).toBeNull();
    expect(catalogLimitNote(TOTAL, TOTAL, 'library')).toBeNull();
    const picker = catalogLimitNote(80, TOTAL, 'picker')!;
    expect(picker).toContain('80');
    expect(picker).toContain(String(TOTAL));
    expect(picker).toMatch(/поиск/);
    const lib = catalogLimitNote(40, TOTAL, 'library')!;
    expect(lib).toContain('40');
    expect(lib).toContain(String(TOTAL));
  });

  it('без поиска: шторка говорит «80 из N», библиотека — «40 из N»', () => {
    openExerciseTab();
    const picker = document.querySelector('[data-bb="catalog-limit-picker"]')?.textContent || '';
    expect(picker).toContain('80');
    expect(picker).toContain(String(TOTAL));
    const lib = document.querySelector('[data-bb="catalog-limit-library"]')?.textContent || '';
    expect(lib).toContain('40');
    expect(lib).toContain(String(TOTAL));
  });

  it('упражнение вне первых 80 достижимо поиском; поиск сужает и библиотеку', () => {
    const deep = EXERCISE_CATALOG[EXERCISE_CATALOG.length - 1] as any;
    expect(deep?.name).toBeTruthy();
    openExerciseTab();

    // до поиска в шторке его нет — кап 80 реален
    fireEvent.click(screen.getByTestId('bb-exercise'));
    expect(sheetOptions().some((t) => t.includes(String(deep.name)))).toBe(false);
    fireEvent.click(document.querySelector('[data-bb="sheet-done"]') as HTMLElement);

    // поиск по имени ищет по всему каталогу — упражнение находится
    fireEvent.change(screen.getByTestId('bb-ex-search'), { target: { value: String(deep.name) } });
    fireEvent.click(screen.getByTestId('bb-exercise'));
    expect(sheetOptions().some((t) => t.includes(String(deep.name)))).toBe(true);

    // библиотека сузилась до совпадений: капа больше нет, карточка видна
    expect(document.querySelector('[data-bb="catalog-limit-library"]')).toBeNull();
    expect(screen.getByRole('button', { name: `Разобрать ${deep.name}` })).toBeTruthy();
  });
});
